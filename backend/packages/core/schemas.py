"""
Shared Pydantic Models

Base schemas and common request/response models used across all packages.
"""
from typing import Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class BaseSchema(BaseModel):
    """Base model for all schemas — enforces JSON serialization defaults."""
    class Config:
        json_encoders = {
            UUID: str,
            datetime: lambda v: v.isoformat(),
        }


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str


class HealthCheckResponse(BaseSchema):
    """Comprehensive health check response model."""
    status: str = Field(description="Health status")
    service: str = Field(description="Service name")
    version: str = Field(description="Service version")


class ErrorResponse(BaseSchema):
    """Standard error response model."""
    error: str = Field(description="Error message")
    detail: Optional[str] = Field(default=None, description="Additional error details")
    code: int = Field(description="HTTP status code")


class SuccessResponse(BaseSchema):
    """Standard success response model."""
    message: str = Field(description="Success message")
    data: Optional[Any] = Field(default=None, description="Response data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")
