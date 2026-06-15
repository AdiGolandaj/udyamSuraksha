from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from packages.core.logger import setup_logger
from packages.core.database import get_db_session
from .schemas import BCPGenerateRequest, BCPResponse
from .service import generate_bcp_for_shop

logger = setup_logger(__name__)
router = APIRouter(tags=["BCP"])


@router.post("/generate", response_model=BCPResponse)
async def generate_bcp(
    request: BCPGenerateRequest,
    db: Session = Depends(get_db_session),
) -> BCPResponse:
    """Generate an LLM-personalised Business Continuity Plan for a shop."""
    logger.info("POST /bcp/generate shop=%s", request.shop_id)
    try:
        return await generate_bcp_for_shop(request, db)
    except Exception as exc:
        logger.error("BCP generation error: %s", exc)
        raise HTTPException(status_code=500, detail="BCP generation failed")


@router.get("/{shop_id}", response_model=BCPResponse)
async def get_bcp(shop_id: str, db: Session = Depends(get_db_session)):
    """Fetch the latest BCP for a shop."""
    from sqlalchemy import text
    row = db.execute(
        text("SELECT id FROM bcp_plans WHERE shopProfileId = :sid"), {"sid": shop_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No BCP found for this shop")
    # Regenerate from DB plan — minimal read, no LLM call
    req = BCPGenerateRequest(shop_id=shop_id, user_id="")
    return await generate_bcp_for_shop(req, db)


@router.get("/health", tags=["System"])
async def bcp_health():
    return {"service": "bcp", "status": "ok"}
