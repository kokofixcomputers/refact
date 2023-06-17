import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pathlib import Path

from refact_self_hosting.env import DIR_SSH_KEYS, DIR_CONFIG

__all__ = ["TabSettingsRouter", "get_all_ssh_keys"]

private_key_ext = 'private_key'
fingerprint_ext = 'fingerprint'


def get_all_ssh_keys():
    import glob
    return glob.glob(f'{DIR_SSH_KEYS}/*.{private_key_ext}')


class TabSettingsRouter(APIRouter):
    __chatgpt_config_file = Path(DIR_CONFIG) / "openai.json"
    __default_chatgpt_config = dict(is_enabled=False, api_key="")
    class SSHKey(BaseModel):
        name: str
    class ChatGPTIsEnabled(BaseModel):
        is_enabled: bool
    class ChatGPTApiKey(BaseModel):
        api_key: str

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.add_api_route("/tab-settings-create-ssh-key", self._tab_settings_create_ssh_key, methods=["POST"])
        self.add_api_route("/tab-settings-delete-ssh-key", self._tab_settings_delete_ssh_key, methods=["POST"])
        self.add_api_route("/tab-settings-get-all-ssh-keys", self._tab_settings_get_all_ssh_keys, methods=["GET"])
        self.add_api_route("/tab-api-key-settings-set-enabled-chat-gpt",
                           self._tab_api_key_settings_set_enabled_chat_gpt, methods=["POST"])
        self.add_api_route("/tab-api-key-settings-set-chat-gpt-api-key",
                           self._tab_api_key_settings_set_chat_gpt_api_key, methods=["POST"])
        self.add_api_route("/tab-api-key-settings-get-chat-gpt-info",
                           self._tab_api_key_settings_get_chat_gpt_info, methods=["GET"])

    async def _tab_settings_create_ssh_key(self, data: SSHKey):
        try:
            from cryptography.hazmat.primitives import serialization as crypto_serialization
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.backends import default_backend as crypto_default_backend
            import binascii
            import base64
            import hashlib

            key = rsa.generate_private_key(
                backend=crypto_default_backend(),
                public_exponent=65537,
                key_size=4096
            )

            private_key = key.private_bytes(
                encoding=crypto_serialization.Encoding.PEM,
                format=crypto_serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=crypto_serialization.NoEncryption(),
            )

            with open(f'{DIR_SSH_KEYS}/{data.name}.{private_key_ext}', 'wb') as f:
                f.write(private_key)

            public_key = key.public_key().public_bytes(
                crypto_serialization.Encoding.OpenSSH,
                crypto_serialization.PublicFormat.OpenSSH
            )

            digest = hashlib.sha256(binascii.a2b_base64(public_key[8:])).digest()
            fingerprint = "SHA256:" + base64.b64encode(digest).rstrip(b'=').decode('utf-8')
            with open(f'{DIR_SSH_KEYS}/{data.name}.{fingerprint_ext}', 'w') as f:
                f.write(fingerprint)

            return JSONResponse({
                "name": data.name,
                "public_key": public_key.decode("utf-8"),
                "fingerprint": fingerprint
            })
        except Exception as e:
            response_data = {"message": f"Error: {e}"}
            return JSONResponse(response_data, status_code=500)

    async def _tab_settings_get_all_ssh_keys(self):
        def get_info_from_key(key_path: str):
            key_file = Path(key_path)
            fingerprint_file = key_file.with_suffix(f'.{fingerprint_ext}')
            with open(str(fingerprint_file), 'r') as f:
                fingerprint = f.read()
            return dict(
                name=key_file.stem,
                created_ts=key_file.stat().st_mtime,
                fingerprint=fingerprint
            )

        return JSONResponse([
            get_info_from_key(ssh_key) for ssh_key in get_all_ssh_keys()
        ])

    async def _tab_settings_delete_ssh_key(self, data: SSHKey):
        key_filepath = Path(DIR_SSH_KEYS) / f'{data.name}.{private_key_ext}'
        fingerprint_filepath = Path(DIR_SSH_KEYS) / f'{data.name}.{fingerprint_ext}'
        if key_filepath.exists():
            key_filepath.unlink(missing_ok=False)
        if fingerprint_filepath.exists():
            fingerprint_filepath.unlink(missing_ok=False)
        return JSONResponse("OK")


    def __inject_in_openai_config(self, upd: dict):
        if self.__chatgpt_config_file.exists():
            try:
                with open(str(self.__chatgpt_config_file), "r") as f:
                    config = json.load(f)
            except Exception as _:
                config = self.__default_chatgpt_config
        else:
            config = self.__default_chatgpt_config
        config.update(upd)
        with open(str(self.__chatgpt_config_file), "w") as f:
            json.dump(config, f)

    async def _tab_api_key_settings_set_enabled_chat_gpt(self, data: ChatGPTIsEnabled):
        self.__inject_in_openai_config(dict(is_enabled=data.is_enabled))
        return JSONResponse("OK")

    async def _tab_api_key_settings_set_chat_gpt_api_key(self, data: ChatGPTApiKey):
        self.__inject_in_openai_config(dict(api_key=data.api_key))
        return JSONResponse("OK")

    async def _tab_api_key_settings_get_chat_gpt_info(self):
        if self.__chatgpt_config_file.exists():
            with open(str(self.__chatgpt_config_file), "rb") as f:
                config = json.load(f)
        else:
            config = self.__default_chatgpt_config
        return JSONResponse(config)

