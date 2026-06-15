from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from packages.core.logger import setup_logger
from packages.core.database import get_db_session
from .schemas import LocationEnrichRequest, LocationEnrichResponse
from .service import enrich_location

logger = setup_logger(__name__)

router = APIRouter(tags=["Location"])


@router.post("/enrich", response_model=LocationEnrichResponse)
async def enrich(
    request: LocationEnrichRequest,
    db: Session = Depends(get_db_session),
) -> LocationEnrichResponse:
    """
    Enrich a coordinate with reverse-geocoded address, nearest amenities,
    elevation, terrain slope and aspect.

    Triggered on shop registration and by the 30-day APScheduler batch job.
    """
    logger.info("POST /location/enrich (%.5f, %.5f)", request.latitude, request.longitude)
    try:
        return await enrich_location(request, db)
    except Exception as exc:
        logger.error("Location enrichment failed: %s", exc)
        raise HTTPException(status_code=500, detail="Location enrichment failed")


@router.get("/health", tags=["System"])
async def location_health():
    return {"service": "location", "status": "ok"}
