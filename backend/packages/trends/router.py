from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from packages.core.logger import setup_logger
from packages.core.database import get_db_session
from .schemas import TrendsRequest, TrendsResponse
from .service import get_trends_for_region

logger = setup_logger(__name__)
router = APIRouter(tags=["Trends"])


@router.post("/regional", response_model=TrendsResponse)
async def regional_trends(
    request: TrendsRequest,
    db: Session = Depends(get_db_session),
) -> TrendsResponse:
    """Aggregate historical alert + rainfall data and generate LLM seasonal insights."""
    logger.info("POST /trends/regional region=%s", request.region_code)
    try:
        return await get_trends_for_region(request.region_code, db)
    except Exception as exc:
        logger.error("Trends error for region %s: %s", request.region_code, exc)
        raise HTTPException(status_code=500, detail="Failed to fetch trends")


@router.get("/{region_code}", response_model=TrendsResponse)
async def get_trends(
    region_code: str,
    db: Session = Depends(get_db_session),
) -> TrendsResponse:
    """GET shortcut — same as POST /regional."""
    try:
        return await get_trends_for_region(region_code, db)
    except Exception as exc:
        logger.error("Trends GET error for %s: %s", region_code, exc)
        raise HTTPException(status_code=500, detail="Failed to fetch trends")


@router.get("/health", tags=["System"])
async def trends_health():
    return {"service": "trends", "status": "ok"}
