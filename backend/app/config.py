from __future__ import annotations

from functools import lru_cache
from typing import List, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    database_url: str = "sqlite:///./mafia_manager.db"
    secret_key: str = "supersecretkeychange"  # override in .env
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: List[str] | str = [
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        "https://mafiadesk.com",
    ]
    environment: Literal["development", "staging", "production", "test"] = "development"
    auth_cookie_domain: str | None = None
    auth_cookie_path: str = "/"
    auth_cookie_secure: bool | None = None
    auth_cookie_samesite: Literal["lax", "strict", "none"] | None = None

    @field_validator("cors_origins")
    @classmethod
    def split_origins(cls, v: List[str] | str) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
