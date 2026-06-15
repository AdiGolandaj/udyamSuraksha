from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from packages.core.logger import setup_logger
from packages.core.database import get_db_session
from .schemas import AlertGenerateRequest, AlertGenerationResponse, AlertResponse
from .service import generate_alert_for_shop, get_active_alerts_for_user

logger = setup_logger(__name__)
router = APIRouter(tags=["Alerts"])


@router.post("/generate", response_model=AlertGenerationResponse)
async def generate_alert(
    request: AlertGenerateRequest,
    db: Session = Depends(get_db_session),
) -> AlertGenerationResponse:
    """
    Generate a weather-triggered, LLM-personalised alert for a specific shop.
    Returns status=skipped when no weather threshold is exceeded.
    """
    logger.info("POST /alerts/generate shop=%s", request.shop_id)
    try:
        return await generate_alert_for_shop(request, db)
    except Exception as exc:
        logger.error("Alert generation error: %s", exc)
        raise HTTPException(status_code=500, detail="Alert generation failed")


@router.get("/{user_id}/active", response_model=List[AlertResponse])
async def get_active_alerts(
    user_id: str,
    db: Session = Depends(get_db_session),
) -> List[AlertResponse]:
    """Fetch all active (unread) alerts for a user."""
    try:
        return await get_active_alerts_for_user(user_id, db)
    except Exception as exc:
        logger.error("Fetch alerts error for user %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Failed to fetch alerts")


@router.get("/health", tags=["System"])
async def alert_health():
    return {"service": "alerts", "status": "ok"}
