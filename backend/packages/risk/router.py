from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from packages.core.logger import setup_logger
from packages.core.database import get_db_session
from .schemas import RiskScoreRequest, RiskScoreResponse
from .service import compute_risk_score

logger = setup_logger(__name__)
router = APIRouter(tags=["Risk"])


@router.post("/score", response_model=RiskScoreResponse)
async def score_risk(
    request: RiskScoreRequest,
    db: Session = Depends(get_db_session),
) -> RiskScoreResponse:
    """
    Compute a multi-dimensional risk score for a shop using location profile,
    building characteristics, stock sensitivities, and access infrastructure.
    Returns scores per hazard type (flood, wind, power) and LLM recommendations.
    """
    logger.info("POST /risk/score shop=%s", request.shop_id)
    try:
        return await compute_risk_score(request, db)
    except Exception as exc:
        logger.error("Risk scoring error: %s", exc)
        raise HTTPException(status_code=500, detail="Risk scoring failed")


@router.get("/health", tags=["System"])
async def risk_health():
    return {"service": "risk", "status": "ok"}
