"""
DisasterShield AI & ML Backend API

FastAPI application entry point. Mounts all service routers,
configures middleware, and manages the APScheduler lifecycle.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from packages.core.config import settings
from packages.core.logger import setup_logger
from packages.alerts.router import router as alerts_router
from packages.bcp.router import router as bcp_router
from packages.risk.router import router as risk_router
from packages.forecasts.router import router as forecasts_router
from packages.trends.router import router as trends_router
from packages.location.router import router as location_router
from scheduler import scheduler

# Initialize logger
logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manage FastAPI application lifecycle.
    Starts APScheduler on startup, shuts it down gracefully on shutdown.
    """
    logger.info("🚀 DisasterShield API startup — initializing scheduler")
    scheduler.start()
    
    yield
    
    logger.info("🛑 DisasterShield API shutdown — stopping scheduler")
    scheduler.shutdown()


# FastAPI Application
app = FastAPI(
    title="DisasterShield AI API",
    description="AI & ML backend for personalized disaster alerts and business resilience scoring",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all service routers
app.include_router(alerts_router,    prefix="/alerts",    tags=["Alerts"])
app.include_router(bcp_router,       prefix="/bcp",       tags=["BCP"])
app.include_router(risk_router,      prefix="/risk",      tags=["Risk"])
app.include_router(forecasts_router, prefix="/forecasts", tags=["Forecasts"])
app.include_router(trends_router,    prefix="/trends",    tags=["Trends"])
app.include_router(location_router,  prefix="/location",  tags=["Location"])


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint — confirms API is running."""
    return {
        "status": "ok",
        "service": "DisasterShield AI API",
        "version": "1.0.0",
    }


@app.get("/", tags=["System"])
async def root():
    """API root endpoint — provides service information."""
    return {
        "message": "Welcome to DisasterShield AI API",
        "docs": "/docs",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
