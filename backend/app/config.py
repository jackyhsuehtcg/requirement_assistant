import os
import yaml
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    LLM_PROVIDER: str = "openrouter"
    LLM_MODEL: str = "google/gemini-2.0-flash-exp:free"
    
    OPENROUTER_API_KEY: str = ""
    LM_STUDIO_URL: str = "http://localhost:1234/v1"

    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION_USM: str = "usm_nodes"
    QDRANT_COLLECTION_TEST: str = "test_cases"
    QDRANT_COLLECTION_JIRA: str = "jira_references"
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

@lru_cache()
def get_settings():
    return Settings()

class PromptConfig:
    _prompts = {}

    @classmethod
    def load(cls, path="prompts.yaml"):
        if not os.path.exists(path):
            # Fallback path if running from backend root
            path = os.path.join(os.path.dirname(__file__), "..", "prompts.yaml")
        
        with open(path, "r", encoding="utf-8") as f:
            cls._prompts = yaml.safe_load(f)

    @classmethod
    def get(cls, key: str) -> str:
        if not cls._prompts:
            cls.load()
        return cls._prompts.get(key, "")

# Initial load
try:
    PromptConfig.load()
except Exception as e:
    print(f"Warning: Could not load prompts.yaml: {e}")
