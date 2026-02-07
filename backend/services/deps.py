import os
from dotenv import load_dotenv
from .llm_service import GeminiAdapter

load_dotenv()

# シングルトンとしてインスタンスを管理
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
llm_service = GeminiAdapter(api_key=GEMINI_API_KEY)
