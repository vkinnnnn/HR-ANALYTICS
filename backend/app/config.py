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

    # ROI defaults
    REPLACEMENT_COST: float = 15000.0
    REDUCTION_RATE: float = 0.31

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
