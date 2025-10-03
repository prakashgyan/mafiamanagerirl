from __future__ import annotations

from functools import lru_cache
from typing import List, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    secret_key: str = Field(..., description="Secret key for JWT token signing")
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(default=1440, description="Token expiration in minutes")
    cors_origins: List[str] | str = Field(default=[], description="Allowed CORS origins")
    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development", description="Application environment"
    )
    auth_cookie_domain: str | None = Field(default=None, description="Cookie domain")
    auth_cookie_path: str = Field(default="/", description="Cookie path")
    auth_cookie_secure: bool | None = Field(default=None, description="Secure cookie flag")
    auth_cookie_samesite: Literal["lax", "strict", "none"] | None = Field(
        default=None, description="SameSite cookie attribute"
    )
    firestore_project_id: str = Field(..., description="Firestore project ID")
    firestore_database: str = Field(..., description="Firestore database name")
    firestore_credentials_file: str = Field(..., description="Path to Firestore credentials file")
    firestore_emulator_host: str | None = Field(default=None, description="Firestore emulator host")

    @field_validator("cors_origins")
    @classmethod
    def split_origins(cls, v: List[str] | str) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_secure_config(self) -> "Settings":
        """Ensure secure configuration in production/staging environments."""
        if self.environment in {"production", "staging"}:
            # Check for insecure default secret keys
            if len(self.secret_key) < 32:
                raise ValueError(
                    f"APP_SECRET_KEY must be a secure random string (at least 32 characters) "
                    f"in {self.environment} environment"
                )
            
            # Ensure secure cookie settings for production
            if self.auth_cookie_secure is not True and self.environment == "production":
                raise ValueError("APP_AUTH_COOKIE_SECURE must be true in production environment")
        
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
