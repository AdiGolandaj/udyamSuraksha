"""
Risk Scoring Schema Definitions

Pydantic models for request/response validation and documentation.
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from packages.core.schemas import BaseSchema


class RiskScoreRequest(BaseSchema):
    """Request model for risk score computation."""
    shop_id: str = Field(description="Shop UUID")
    user_id: str = Field(description="User UUID")


class RiskCategory(BaseSchema):
    """Risk score breakdown by category."""
    category: str = Field(description="Risk category (flood/wind/power/landslide/other)")
    score: float = Field(description="Score for this category (0.0 - 1.0)")
    top_factors: List[str] = Field(default=[], description="Top contributing factors")


class RiskScoreResponse(BaseSchema):
    """Response model for risk score computation."""
    shop_id: str = Field(description="Shop UUID")
    overall_risk_score: float = Field(description="Overall vulnerability score (0.0 - 1.0)")
    flood_risk_score: float = Field(description="Flood risk component (0.0 - 1.0)")
    wind_risk_score: float = Field(description="Wind damage risk component (0.0 - 1.0)")
    power_outage_risk_score: float = Field(description="Power outage risk component (0.0 - 1.0)")
    risk_level: str = Field(default="medium", description="Overall risk level (low/medium/high/critical)")
    recommendations: List[str] = Field(default=[], description="Risk mitigation recommendations")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Score generation timestamp")
