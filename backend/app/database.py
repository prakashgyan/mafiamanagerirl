from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from loguru import logger

from .config import get_settings
from .datastore import Datastore, InMemoryDataStore, PostgresDataStore
from .orm_models import Base

_engine = None
SessionLocal = None

_DB_CONNECT_TIMEOUT = 10  # seconds before giving up on a new connection

def init_db():
    global _engine, SessionLocal
    settings = get_settings()
    if settings.environment == "test":
        return
    _engine = create_engine(
        settings.database_url,
        connect_args={"connect_timeout": _DB_CONNECT_TIMEOUT},
        pool_pre_ping=True,
    )
    # Verify connectivity before running DDL so we fail fast with a clear message.
    try:
        with _engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise RuntimeError(
            f"Cannot reach PostgreSQL at startup (timeout={_DB_CONNECT_TIMEOUT}s). "
            f"Check APP_DATABASE_* settings. Original error: {exc}"
        ) from exc

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    Base.metadata.create_all(bind=_engine)
    logger.info("PostgreSQL schema verified/created OK")

def get_db():
    settings = get_settings()
    if settings.environment == "test":
        yield None
        return
    if SessionLocal is None:
        raise Exception("Database not initialized. Call init_db() first.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

_in_memory_datastore = InMemoryDataStore()

def get_datastore(db: Session = None) -> Datastore:
    settings = get_settings()
    if settings.environment == "test":
        return _in_memory_datastore
    if db:
        return PostgresDataStore(db)
    raise Exception("No database session provided in non-test environment")
