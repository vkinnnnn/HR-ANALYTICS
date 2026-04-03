from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # LLM Provider
    LLM_PROVIDER: Literal["openai", "openrouter", "bedrock"] = "openrouter"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # OpenRouter
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "nvidia/nemotron-3-super-120b-a12b:free"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # AWS Bedrock
    AWS_REGION: str = "us-east-1"
    BEDROCK_MODEL_ARN: str = ""

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./hr_platform.db"

    # Paths
    OUTPUT_DIR: str = "output"
    DATA_DIR: str = ""
    UPLOAD_DIR: str = ""
    CHECKPOINT_DIR: str = "checkpoints"

    # Pipeline batch processing
    DEFAULT_BATCH_SIZE: int = 50
    MAX_WORKERS: int = 4
    MAX_RETRIES: int = 3
    CHECKPOINT_EVERY_N_BATCHES: int = 5

    # File limits
    MAX_UPLOAD_SIZE_MB: int = 100

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    CHROMA_COLLECTION: str = "workforce_iq_knowledge"

    # Mem0 (per-user memory)
    MEM0_ENABLED: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
