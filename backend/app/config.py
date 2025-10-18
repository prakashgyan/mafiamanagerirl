from __future__ import annotations

import secrets
from functools import lru_cache
from typing import List, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    secret_key: str = Field(
        default_factory=lambda: secrets.token_urlsafe(48),  # ensures >=32 chars for local dev
        description="Secret key for JWT token signing",
    )
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
    database_url: str | None = Field(default=None, description="PostgreSQL connection URL")
    database_host: str | None = Field(default=None, description="PostgreSQL host")
    database_port: int | None = Field(default=None, description="PostgreSQL port")
    database_user: str | None = Field(default=None, description="PostgreSQL user")
    database_password: str | None = Field(default=None, description="PostgreSQL password")
    database_name: str | None = Field(default=None, description="PostgreSQL database name")
    database_ssl_mode: str | None = Field(default=None, description="PostgreSQL sslmode query parameter")

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

    @model_validator(mode="after")
    def validate_database_config(self) -> "Settings":
        """Ensure a full SQLAlchemy connection string is available."""
        if self.database_url:
            return self

        required_fields = {
            "database_host": self.database_host,
            "database_port": self.database_port,
            "database_user": self.database_user,
            "database_password": self.database_password,
            "database_name": self.database_name,
        }

        missing = [field for field, value in required_fields.items() if value in {None, ""}]
        if missing:
            missing_env = ", ".join(f"APP_{field.upper()}" for field in missing)
            raise ValueError(f"Provide APP_DATABASE_URL or all of {missing_env} to configure the database")

        query: dict[str, str] = {}
        if self.database_ssl_mode:
            query["sslmode"] = self.database_ssl_mode

        url_kwargs = {
            "drivername": "postgresql+psycopg2",
            "username": self.database_user,
            "password": self.database_password,
            "host": self.database_host,
            "port": self.database_port,
            "database": self.database_name,
        }

        if query:
            url_kwargs["query"] = query

        url = URL.create(**url_kwargs)

        # Persist the assembled DSN so downstream code can keep using database_url.
        self.database_url = url.render_as_string(hide_password=False)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
