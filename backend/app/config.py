from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # LLM Provider
    LLM_PROVIDER: Literal["openai", "bedrock"] = "openai"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

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

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
