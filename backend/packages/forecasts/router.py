from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from packages.core.logger import setup_logger
from packages.core.database import get_db_session
from .schemas import ForecastRequest, ForecastResponse
from .service import estimate_financial_loss

logger = setup_logger(__name__)
router = APIRouter(tags=["Forecasts"])


@router.post("/estimate", response_model=ForecastResponse)
async def generate_forecast(
    request: ForecastRequest,
    db: Session = Depends(get_db_session),
) -> ForecastResponse:
    """
    Estimate financial loss over the given horizon using stock inventory,
    historical regional alerts, and LLM scenario modelling.
    """
    logger.info("POST /forecasts/estimate shop=%s horizon=%d", request.shop_id, request.horizon_days)
    try:
        return await estimate_financial_loss(request, db)
    except Exception as exc:
        logger.error("Forecast error: %s", exc)
        raise HTTPException(status_code=500, detail="Forecast estimation failed")


@router.get("/health", tags=["System"])
async def forecasts_health():
    return {"service": "forecasts", "status": "ok"}
