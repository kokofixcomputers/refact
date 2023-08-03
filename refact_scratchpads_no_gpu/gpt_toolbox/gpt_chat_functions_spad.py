import os
import asyncio

from typing import AsyncIterator, List, Union, Dict, Tuple, Any

import openai

from refact_scratchpads_no_gpu.async_scratchpad import ascratch
from refact_scratchpads_no_gpu.gpt_toolbox.gpt_metering import gpt_prices, calculate_chat_tokens, engine_to_encoding
from refact_scratchpads_no_gpu.gpt_toolbox import vecdb_call, SMC_FUNCTIONS


DEBUG = int(os.environ.get("DEBUG", "0"))


class GptChatWithFunctions(ascratch.AsyncScratchpad):
    def __init__(
            self,
            id: str,  # noqa
            *,
            created: float,
            temperature: float,
            top_p: float,
            max_tokens: int,
            stop_tokens: Union[str, List[str]],
            messages: List[Dict[str, str]],
            model: str,  # always "longthink", don't use  # noqa
            **more,
    ):
        super().__init__(
            id=id,
            created=created,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            stop_tokens=stop_tokens,
            **more,
        )

        self._model_n = "gpt-3.5-turbo"
        if "gpt4" in self.function or "gpt-4" in self.function:
            self._model_n = "gpt-4"
        self.__model_name = None

        self._stream_timeout_sec = 15
        self._accumulate_n_streaming_chunks = 5

        messages = messages or []
        if not messages or messages[0].get('role') != 'system':
            messages = [
                {
                    "role": "system",
                    "content": "You are a coding assistant that outputs short answers, gives links to documentation.",
                }, *messages
            ]
        self._messages = messages
        self._messages_orig_len = len(messages)
        self._on_function = False
        self._function_call = self._get_function_from_msg()
        self._enc = None

    def _get_function_from_msg(self) -> Dict:
        if self._messages:
            last_m = self._messages[-1]
            function = last_m.get('function')
            if not function or function not in SMC_FUNCTIONS:
                return {}
            arg = last_m['content'].strip()
            self._on_function = True
            return {
                'name': function,
                'arguments': arg,
            }
        return {}

    @property
    def _model_name(self) -> str:
        if not self.__model_name:
            model_name = 'gpt-3.5-turbo-0613'
            if self._model_n and (self._model_n == 'gpt-3.5-turbo' or self._model_n == 'gpt-4'):
                model_name = self._model_n + '-0613'
            self.__model_name = model_name
            self._enc = engine_to_encoding(self.__model_name)
        return self.__model_name

    @_model_name.setter
    def _model_name(self, val: str) -> None:
        self.__model_name = val

    def _prices(self) -> Tuple[int, int]:
        return gpt_prices(self._model_name)

    def _new_chat_messages(self):
        return {"chat__messages": self._messages[self._messages_orig_len:]}

    async def _run_function(self) -> AsyncIterator[
        Dict[str, List[Dict[str, str]]]
    ]:
        f_name: str = self._function_call['name']
        f_param: str = self._function_call['arguments']

        if DEBUG:
            self.debuglog(f'CALLING function {f_name} with params {f_param}')

        if f_name == 'vecdb':
            async for res in vecdb_call(self._enc, f_param, 256):
                self._messages.append(res)
                yield self._new_chat_messages()

    def _create_chat_gen(self) -> Any:
        return openai.ChatCompletion.acreate(
            model=self._model_name,
            messages=[
                {
                    "role": x["role"],
                    "content": x["content"]
                }
                for x in self._messages
            ],
            max_tokens=self.max_tokens,
            temperature=self.temp,
            stream=True
        )

    async def _call_openai_api_based_on_stored_messages(
            self,
    ) -> AsyncIterator[
        Dict[str, List[Dict[str, str]]]
    ]:
        if DEBUG:
            self.debuglog(f'MODEL_NAME={self._model_name}')
        self.finish_reason = ''
        accum = ""
        tokens = 0
        role = 'undefined'

        def accumulator_to_a_streaming_packet() -> None:
            nonlocal accum
            self._messages[-1]['content'] += accum
            accum = ""

        create_streaming_msg = True
        try:
            if self._on_function:
                async for res in self._run_function():
                    yield res

            gen = await self._create_chat_gen()
            while True:
                resp = await asyncio.wait_for(gen.__anext__(), self._stream_timeout_sec)
                if not resp:
                    break
                delta = resp.choices[0].delta

                if "role" in delta:
                    role = delta["role"]
                if content := delta.get('content'):
                    accum += content
                    tokens += 1  # assuming 1 token per chunk
                if "finish_reason" in resp.choices[0] and resp.choices[0]["finish_reason"] is not None:
                    self.finish_reason = resp.choices[0]["finish_reason"]
                if self.finish_reason:
                    break
                if tokens % self._accumulate_n_streaming_chunks == 0:
                    if create_streaming_msg:
                        create_streaming_msg = False
                        self._messages.append({
                            "role": role,
                            "content": "",
                        })
                    accumulator_to_a_streaming_packet()
                    yield self._new_chat_messages()

                if self.finish_reason:  # cancelled from main coroutine
                    break

        except asyncio.exceptions.TimeoutError as e:
            self._messages.append({
                "role": role,
                "content": "Chat Timeout",
                "gui_role": 'error'
            })
            yield self._new_chat_messages()
            self.debuglog("CHAT TIMEOUT:", str(type(e)), str(e))
        except Exception as e:
            self._messages.append({
                "role": role,
                "content": str(e),
                "gui_role": 'error'
            })
            yield self._new_chat_messages()
            self.debuglog("CHAT EXCEPTION:", str(type(e)), str(e))

        accumulator_to_a_streaming_packet()
        # FIXME: create_streaming_msg
        yield self._new_chat_messages()

    async def completion(self) -> AsyncIterator[
        Dict[str, List[Dict]]
    ]:
        async for res in self._call_openai_api_based_on_stored_messages():
            yield res

        self.finish_reason = 'END'

    def toplevel_fields(self) -> Dict[str, Any]:
        if not self.finish_reason:
            return {}

        calc_prompt_tokens_n, calc_generated_tokens_n = calculate_chat_tokens(
            self._model_name, self._messages, ""  # FIXME
        )
        return {
            "metering_prompt_tokens_n": calc_prompt_tokens_n,
            "metering_generated_tokens_n": calc_generated_tokens_n,
            "pp1000t_prompt": self._prices()[0],
            "pp1000t_generated": self._prices()[1],
            "model_name": self._model_name,
        }
