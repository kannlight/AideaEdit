import os
from dataclasses import dataclass
from typing import List, Optional
from dotenv import load_dotenv
from .llm_service import LLMService, GeminiAdapter, OllamaAdapter

load_dotenv()


@dataclass
class ServiceInfo:
    id: str
    name: str
    type: str   # 'gemini' or 'ollama'
    model: str


class ServiceRegistry:
    def __init__(self):
        self._services: List[ServiceInfo] = []
        self._adapters: dict[str, LLMService] = {}
        self._active_id: Optional[str] = None
        self._load_from_env()

    def _load_from_env(self):
        # Gemini
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if api_key and api_key != "YOUR_API_KEY_HERE":
            model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
            info = ServiceInfo(id="gemini", name="Gemini", type="gemini", model=model)
            self._services.append(info)
            self._adapters["gemini"] = GeminiAdapter(api_key=api_key, model_name=model)

        # Ollama services
        ollama_str = os.getenv("OLLAMA_SERVICES", "").strip()
        if ollama_str:
            for i, entry in enumerate(ollama_str.split(",")):
                parts = [p.strip() for p in entry.strip().split("|")]
                if len(parts) != 3:
                    print(f"[ServiceRegistry] Invalid OLLAMA_SERVICES entry (expected name|url|model): {entry}")
                    continue
                name, base_url, model = parts
                service_id = f"ollama_{i}"
                info = ServiceInfo(id=service_id, name=name, type="ollama", model=model)
                self._services.append(info)
                self._adapters[service_id] = OllamaAdapter(base_url=base_url, model_name=model)

        if self._services:
            self._active_id = self._services[0].id
        else:
            print("[ServiceRegistry] Warning: No LLM services configured in .env")

    def get_services(self) -> List[ServiceInfo]:
        return self._services

    def get_active_id(self) -> Optional[str]:
        return self._active_id

    def set_active_id(self, service_id: str) -> bool:
        if service_id in self._adapters:
            self._active_id = service_id
            return True
        return False

    def get_active_adapter(self) -> Optional[LLMService]:
        if self._active_id:
            return self._adapters.get(self._active_id)
        return None


service_registry = ServiceRegistry()


def get_llm_service() -> Optional[LLMService]:
    """現在アクティブなLLMサービスアダプターを返す"""
    return service_registry.get_active_adapter()
