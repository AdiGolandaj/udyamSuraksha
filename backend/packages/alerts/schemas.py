from typing import List, Optional
from datetime import datetime
from pydantic import Field
from packages.core.schemas import BaseSchema


class AlertGenerateRequest(BaseSchema):
    shop_id: str = Field(description="Shop UUID")
    user_id: str = Field(description="User UUID")
    region_code: str = Field(description="Region code for grouping")


class AlertGenerationResponse(BaseSchema):
    alert_id: str = Field(description="Generated alert UUID (empty when no threshold exceeded)")
    shop_id: str = Field(description="Shop UUID")
    status: str = Field(description="triggered | skipped | error")
    message: Optional[str] = Field(default=None, description="Human-readable status detail")


class AlertResponse(BaseSchema):
    alertId: str
    title: str
    severity: str = Field(description="LOW | MEDIUM | HIGH | CRITICAL")
    category: str = Field(description="FLOOD | WIND | POWER_OUTAGE | LANDSLIDE | HEATWAVE | OTHER")
    affectedItems: List[str] = Field(default_factory=list)
    summary: str
    actionSteps: List[str] = Field(default_factory=list)
    issuedAt: str
    language: str = Field(default="en")


class WeatherData(BaseSchema):
    temperature_c: float
    rainfall_mm_per_hour: float
    wind_speed_kmph: float
    wind_direction: str
    humidity_percent: float
