"""
DisasterShield Core Package

Shared utilities used across all service packages:
- Configuration management (settings)
- Structured logging
- Shared Pydantic schemas
- LLM API clients (Google Gemini, OpenAI)
- Database session factory (SQLAlchemy)
"""

__all__ = [
    "settings",
    "setup_logger",
    "get_db_session",
    "llm_client",
    "BaseSchema",
]

from .config import settings
from .logger import setup_logger
from .database import get_db_session, engine, SessionLocal
from .llm_client import llm_client
from .schemas import BaseSchema
