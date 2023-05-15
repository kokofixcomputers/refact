from setuptools import setup
from setuptools import find_packages


setup(
    name="refact-self-hosting",
    py_modules=["refact_self_hosting"],
    packages=find_packages(),
    package_data={"code_contrast": ["encoding/*.json"]},
    version="0.0.4",
    install_requires=["numpy", "tokenizers", "fastapi", "uvicorn", "uvloop", "termcolor",
                      "huggingface_hub", "tiktoken", "cdifflib", "cloudpickle", "blobfile",
                      "sentencepiece", "dataclasses_json", "torch", "transformers",
                      "smallcloud",
                      "code_contrast",
                      ],
)

