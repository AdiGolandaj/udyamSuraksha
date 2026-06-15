"""
Trends Schema Definitions

Pydantic models for request/response validation and documentation.
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from packages.core.schemas import BaseSchema


class TrendsRequest(BaseSchema):
    """Request model for trend analysis."""
    region_code: str = Field(description="Regional code")
    months: int = Field(default=6, description="Analysis period in months")


class TrendDataPoint(BaseSchema):
    """Individual trend data point."""
    month: str = Field(description="Month (YYYY-MM format)")
    rainfall_mm: float = Field(description="Total rainfall in mm")
    disruption_count: int = Field(description="Number of disruptions")
    avg_risk_score: float = Field(description="Average risk score (0.0 - 1.0)")


class RegionalTrendAnalysis(BaseSchema):
    """Comprehensive regional trend analysis."""
    region_code: str = Field(description="Regional code")
    peak_disaster_months: List[str] = Field(default=[], description="Months with highest disaster frequency")
    most_common_types: List[str] = Field(default=[], description="Most common disaster types")
    average_frequency_per_month: float = Field(description="Average disruptions per month")
    seasonal_insights: str = Field(description="Narrative insights on seasonal patterns")
    recommendations: List[str] = Field(default=[], description="Recommendations based on trends")
    data_points: List[TrendDataPoint] = Field(default=[], description="Detailed trend data")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Analysis generation timestamp")


# Alias for backward compatibility
TrendsResponse = RegionalTrendAnalysis
