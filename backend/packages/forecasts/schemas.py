"""
Forecasts Schema Definitions

Pydantic models for request/response validation and documentation.
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from packages.core.schemas import BaseSchema


class ForecastRequest(BaseSchema):
    """Request model for financial loss forecast."""
    shop_id: str = Field(description="Shop UUID")
    user_id: str = Field(description="User UUID")
    horizon_days: int = Field(default=30, description="Forecast horizon in days")
    scenario: Optional[str] = Field(default=None, description="Specific disaster scenario (flood/wind/power)")


class ForecastDataPoint(BaseSchema):
    """Individual forecast data point."""
    date: str = Field(description="Date of forecast")
    projected_loss_inr: float = Field(description="Projected loss in Indian Rupees")
    confidence_percent: float = Field(description="Confidence level (0-100%)")


class ForecastResponse(BaseSchema):
    """Response model for financial loss forecast."""
    forecast_id: str = Field(description="Forecast UUID")
    shop_id: str = Field(description="Shop UUID")
    horizon_days: int = Field(description="Forecast period in days")
    estimated_stock_loss_inr: float = Field(description="Estimated stock damage cost (INR)")
    estimated_downtime_hours: int = Field(description="Estimated downtime in hours")
    estimated_revenue_loss_inr: float = Field(description="Estimated revenue loss (INR)")
    total_estimated_loss_inr: float = Field(description="Total estimated loss (INR)")
    confidence_percent: float = Field(description="Confidence level (0-100%)")
    data_points: List[ForecastDataPoint] = Field(default=[], description="Detailed forecast breakdown")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Forecast generation timestamp")
