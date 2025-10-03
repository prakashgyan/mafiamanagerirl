from __future__ import annotations

import inspect
import logging
import sys
from functools import wraps
from typing import Any, Callable, Mapping

from loguru import logger

from .config import get_settings

_DEV_FORMAT = "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | " \
    "<level>{level: <8}</level> | " \
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - " \
    "<level>{message}</level>"

_PROD_FORMAT = "{time:YYYY-MM-DDTHH:mm:ss.SSSZ} | {level} | {message}"
_SENSITIVE_KEYS = {"password", "secret", "token", "credential", "key"}


def _sanitize(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: _sanitize("***" if any(token in k.lower() for token in _SENSITIVE_KEYS) else v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        collection_type = type(value)
        return collection_type(_sanitize(item) for item in value)
    if hasattr(value, "model_dump"):
        try:
            dumped = value.model_dump()
            return _sanitize(dumped)
        except Exception:  # pragma: no cover - defensive guard
            pass
    return value


def configure_logging() -> None:
    """Configure Loguru logging based on the active environment."""

    settings = get_settings()
    logger.remove()

    if settings.environment in {"development", "test"}:
        logger.add(sys.stdout, level="DEBUG", format=_DEV_FORMAT, backtrace=True, diagnose=True, enqueue=True)
    elif settings.environment == "staging":
        logger.add(sys.stdout, level="INFO", format=_PROD_FORMAT, backtrace=False, diagnose=False, enqueue=True)
    else:
        logger.add(sys.stdout, level="WARNING", format=_PROD_FORMAT, backtrace=False, diagnose=False, enqueue=True)

    class InterceptHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:  # pragma: no cover - thin shim
            try:
                level = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno
            frame, depth = logging.currentframe(), 2
            while frame and frame.f_code.co_filename == logging.__file__:
                frame = frame.f_back
                depth += 1
            logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    for uvicorn_logger in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        logging.getLogger(uvicorn_logger).handlers = []
        logging.getLogger(uvicorn_logger).propagate = True


def log_call(category: str | None = None) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator that emits debug logs when the wrapped callable executes."""

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        signature = inspect.signature(func)
        log_category = category or func.__qualname__

        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            bound = signature.bind_partial(*args, **kwargs)
            bound.apply_defaults()
            payload = {k: v for k, v in bound.arguments.items() if k != "self"}
            logger.bind(category=log_category).debug("Entering {func} with args={args}", func=func.__qualname__, args=_sanitize(payload))
            try:
                result = func(*args, **kwargs)
            except Exception:
                logger.bind(category=log_category).exception("Error in {}", func.__qualname__)
                raise
            logger.bind(category=log_category).debug(
                "Completed {} -> {}",
                func.__qualname__,
                getattr(type(result), "__name__", type(result).__name__ if result is not None else "None"),
            )
            return result

        wrapper.__signature__ = signature  # type: ignore[attr-defined]
        return wrapper

    return decorator
