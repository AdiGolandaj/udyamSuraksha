"""
Database Configuration & Session Management

SQLAlchemy ORM setup for MySQL database connection.
Provides session factory and dependency injection for route handlers.
"""
from typing import Generator, Optional
from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import Session, sessionmaker, DeclarativeBase
from sqlalchemy.pool import StaticPool
import pymysql

# Make PyMySQL available as MySQLdb so plain mysql:// URLs work without mysqlclient
pymysql.install_as_MySQLdb()

from packages.core.config import settings
from packages.core.logger import setup_logger

logger = setup_logger(__name__)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for model definitions."""
    pass


# Global database engine
engine: Optional[Engine] = None

# Session factory
SessionLocal: Optional[sessionmaker] = None


def init_db_engine() -> Engine:
    """Initialize the database engine."""
    global engine

    try:
        logger.info(f"Initializing database connection: {settings.DATABASE_URL}")
        
        # Create engine with connection pooling
        engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,        # Verify connections before use
            echo=settings.DEBUG,       # Log SQL statements in debug mode
        )
        
        # Test connection
        with engine.connect() as conn:
            logger.info("✓ Database connection successful")
        
        return engine
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


def init_db_session_factory() -> sessionmaker:
    """Initialize the session factory."""
    global SessionLocal, engine

    if not engine:
        init_db_engine()

    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )
    
    logger.info("✓ Session factory initialized")
    return SessionLocal


def get_db_session() -> Generator[Session, None, None]:
    """
    Dependency injection function for FastAPI routes.
    Provides a database session to route handlers.
    
    Usage:
        @router.get("/example")
        async def example(db: Session = Depends(get_db_session)):
            # Use db session here
            pass
    """
    if not SessionLocal:
        init_db_session_factory()

    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


# Legacy function name for backward compatibility
def get_db() -> Generator[Session, None, None]:
    """Legacy function name for get_db_session."""
    return get_db_session()


def close_db() -> None:
    """Close all database connections."""
    global engine
    if engine:
        engine.dispose()
        logger.info("✓ Database engine disposed")


# Initialize on import
try:
    init_db_engine()
    init_db_session_factory()
except Exception as e:
    logger.warning(f"Database initialization deferred: {e}")
