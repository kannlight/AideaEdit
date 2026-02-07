import os
import abc
from typing import AsyncGenerator, List, Optional
from google import genai
from google.genai import types
from pydantic import BaseModel

class LLMResponse(BaseModel):
    content: str

class LLMService(abc.ABC):
    @abc.abstractmethod
    async def generate_stream(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        pass

    @abc.abstractmethod
    async def generate_sync(self, system_prompt: str, user_prompt: str) -> str:
        pass

class GeminiAdapter(LLMService):
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    async def generate_stream(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        # ローカルLLM移行を見据え、特定のモデルに依存しないデータ構成
        async for chunk in await self.client.aio.models.generate_content_stream(
            model=self.model_name,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt
            ),
            contents=user_prompt
        ):
            if chunk.text:
                yield chunk.text

    async def generate_sync(self, system_prompt: str, user_prompt: str) -> str:
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt
            ),
            contents=user_prompt
        )
        return response.text

# 将来のOllamaAdapterのスタブ
class OllamaAdapter(LLMService):
    async def generate_stream(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        # TODO: Implement using httpx to Ollama API
        yield "Ollama implementation pending"

    async def generate_sync(self, system_prompt: str, user_prompt: str) -> str:
        return "Ollama implementation pending"
