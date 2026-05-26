from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings
from .datastore import Datastore, InMemoryDataStore, PostgresDataStore
from .orm_models import Base

_engine = None
SessionLocal = None

def init_db():
    global _engine, SessionLocal
    settings = get_settings()
    if settings.environment == "test":
        return
    _engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    Base.metadata.create_all(bind=_engine)

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
