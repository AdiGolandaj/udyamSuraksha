"""
BCP Schema Definitions

Pydantic models for request/response validation and documentation.
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from packages.core.schemas import BaseSchema


class BCPGenerateRequest(BaseSchema):
    """Request model for BCP generation."""
    shop_id: str = Field(description="Shop UUID")
    user_id: str = Field(description="User UUID")


class ChecklistItem(BaseSchema):
    """Individual checklist item."""
    sequence: int = Field(description="Item sequence number")
    description: str = Field(description="Action description")
    priority: str = Field(description="Priority level (low/medium/high)")
    estimated_duration_minutes: Optional[int] = Field(default=None, description="Estimated time in minutes")


class BCPResponse(BaseSchema):
    """Response model for BCP generation."""
    bcp_id: str = Field(description="Generated BCP UUID")
    shop_id: str = Field(description="Shop UUID")
    status: str = Field(description="BCP status (draft/generated/approved)")
    before_checklist: List[ChecklistItem] = Field(default=[], description="Pre-disaster preparation checklist")
    during_checklist: List[ChecklistItem] = Field(default=[], description="During-disaster response checklist")
    after_checklist: List[ChecklistItem] = Field(default=[], description="Post-disaster recovery checklist")
    risk_summary: Optional[str] = Field(default=None, description="Summary of identified risks")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="BCP generation timestamp")
