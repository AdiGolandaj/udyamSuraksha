"""
BCP Service

LLM-driven Business Continuity Plan generation with DB persistence.
"""
import json
import re
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from packages.core.logger import setup_logger
from packages.core.llm_client import llm_client
from .schemas import BCPGenerateRequest, BCPResponse, ChecklistItem

logger = setup_logger(__name__)

# ── SQL ───────────────────────────────────────────────────────────────────────

_SHOP_SQL = text("""
    SELECT shopName, category, district, taluka
    FROM shop_profiles
    WHERE id = :shop_id
""")

_STOCK_SQL = text("""
    SELECT si.name, si.category, si.estimatedValueInr,
           GROUP_CONCAT(ss.type ORDER BY ss.type SEPARATOR ',') AS sensitivities
    FROM stock_items si
    LEFT JOIN stock_sensitivities ss ON si.id = ss.stockItemId
    WHERE si.shopProfileId = :shop_id
    GROUP BY si.id
    ORDER BY si.estimatedValueInr DESC
    LIMIT 20
""")

_LOC_SQL = text("""
    SELECT elevationMetres, nearestWaterBodyName, nearestWaterBodyDistanceMetres, terrainType
    FROM location_profiles WHERE shopProfileId = :shop_id
""")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_json(raw: str, fallback: dict) -> dict:
    for src in (
        raw.strip(),
        (re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL) or object()).group(1)
        if re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL) else None,
        (re.search(r"\{.*\}", raw, re.DOTALL) or object()).group(0)
        if re.search(r"\{.*\}", raw, re.DOTALL) else None,
    ):
        if src:
            try:
                return json.loads(src)
            except (json.JSONDecodeError, TypeError):
                pass
    return fallback


def _build_prompt(shop, loc, stock: list) -> str:
    stock_lines = "\n".join(
        f"  - {r.name} ({r.category}, INR {r.estimatedValueInr:,.0f})"
        f"{' [' + r.sensitivities + ']' if r.sensitivities else ''}"
        for r in stock
    )
    water = f"Near water: {loc.nearestWaterBodyName} ({loc.nearestWaterBodyDistanceMetres:.0f} m)" if loc and loc.nearestWaterBodyName else ""
    terrain = f"Terrain: {loc.terrainType}" if loc and loc.terrainType else ""

    return f"""You are DisasterShield AI generating a Business Continuity Plan for an MSME in India.

Shop: {shop.shopName} ({shop.category}) | {shop.district}, {shop.taluka}
{terrain} | {water}

Inventory:
{stock_lines or '  (no stock data)'}

Generate a practical BCP with before/during/after checklists. Respond ONLY in valid JSON:
{{
  "before": [
    {{"sequence": 1, "description": "...", "priority": "high", "duration_minutes": 30}},
    {{"sequence": 2, "description": "...", "priority": "medium", "duration_minutes": 60}}
  ],
  "during": [
    {{"sequence": 1, "description": "...", "priority": "high", "duration_minutes": 10}}
  ],
  "after": [
    {{"sequence": 1, "description": "...", "priority": "high", "duration_minutes": 120}}
  ],
  "risk_summary": "2-3 sentence risk overview specific to this shop."
}}

BEFORE (4-6 items): Preparation — backup stock, elevate perishables, secure insurance docs, emergency contacts.
DURING (3-5 items): Real-time response — evacuate if needed, document damage, shut off power/gas.
AFTER (4-6 items): Recovery — damage assessment, insurance claims, restock, reopen checklist."""


def _to_items(raw_list: list, phase_label: str) -> list[ChecklistItem]:
    items = []
    for i, entry in enumerate(raw_list or []):
        if not isinstance(entry, dict):
            continue
        items.append(ChecklistItem(
            sequence=entry.get("sequence", i + 1),
            description=str(entry.get("description", f"{phase_label} step {i+1}"))[:500],
            priority=str(entry.get("priority", "medium")).lower(),
            estimated_duration_minutes=int(entry["duration_minutes"]) if "duration_minutes" in entry else None,
        ))
    return items


# ── DB write ───────────────────────────────────────────────────────────────────

def _write_bcp(db: Session, shop_id: str, data: dict) -> str:
    plan_id = str(uuid.uuid4())
    db.execute(text("""
        INSERT INTO bcp_plans (id, shopProfileId, completionPercent, generatedAt, lastUpdatedAt)
        VALUES (:id, :sid, 100, NOW(), NOW())
        ON DUPLICATE KEY UPDATE completionPercent = 100, lastUpdatedAt = NOW()
    """), {"id": plan_id, "sid": shop_id})

    # Resolve actual plan id (may differ if ON DUPLICATE KEY updated)
    row = db.execute(
        text("SELECT id FROM bcp_plans WHERE shopProfileId = :sid"), {"sid": shop_id}
    ).fetchone()
    plan_id = row.id if row else plan_id

    # Clear old steps then re-insert
    db.execute(text("DELETE FROM bcp_steps WHERE bcpPlanId = :pid"), {"pid": plan_id})

    phase_map = {
        "BEFORE": data.get("before", []),
        "DURING": data.get("during", []),
        "AFTER": data.get("after", []),
    }
    for phase, steps in phase_map.items():
        for idx, step in enumerate(steps or []):
            if not isinstance(step, dict):
                continue
            db.execute(text("""
                INSERT INTO bcp_steps
                    (id, bcpPlanId, phase, title, description, isCompleted, orderIndex, isOptional)
                VALUES
                    (:id, :pid, :phase, :title, :desc, false, :idx, false)
            """), {
                "id": str(uuid.uuid4()),
                "pid": plan_id,
                "phase": phase,
                "title": str(step.get("description", ""))[:255],
                "desc": str(step.get("description", "")),
                "idx": idx,
            })

    db.commit()
    return plan_id


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_bcp_for_shop(request: BCPGenerateRequest, db: Session) -> BCPResponse:
    shop = db.execute(_SHOP_SQL, {"shop_id": request.shop_id}).fetchone()
    if not shop:
        return BCPResponse(
            bcp_id="", shop_id=request.shop_id, status="error",
            risk_summary="Shop not found.",
        )

    loc = db.execute(_LOC_SQL, {"shop_id": request.shop_id}).fetchone()
    stock = db.execute(_STOCK_SQL, {"shop_id": request.shop_id}).fetchall()

    prompt = _build_prompt(shop, loc, stock)
    fallback = {
        "before": [
            {"sequence": 1, "description": "Photograph all stock for insurance records", "priority": "high", "duration_minutes": 30},
            {"sequence": 2, "description": "Move perishables and water-sensitive stock to upper shelves", "priority": "high", "duration_minutes": 60},
            {"sequence": 3, "description": "Prepare emergency contact list (supplier, insurer, local LRDB)", "priority": "medium", "duration_minutes": 20},
            {"sequence": 4, "description": "Secure loose outdoor items and signage", "priority": "medium", "duration_minutes": 30},
        ],
        "during": [
            {"sequence": 1, "description": "Shut off electrical main if flooding is imminent", "priority": "high", "duration_minutes": 5},
            {"sequence": 2, "description": "Evacuate staff and customers to safe location", "priority": "high", "duration_minutes": 10},
            {"sequence": 3, "description": "Document ongoing damage with photos/video", "priority": "medium", "duration_minutes": 20},
        ],
        "after": [
            {"sequence": 1, "description": "Conduct damage assessment before re-entering premises", "priority": "high", "duration_minutes": 60},
            {"sequence": 2, "description": "File insurance claim with documented evidence", "priority": "high", "duration_minutes": 120},
            {"sequence": 3, "description": "Discard and log any spoiled or water-damaged stock", "priority": "high", "duration_minutes": 90},
            {"sequence": 4, "description": "Contact suppliers to arrange priority restocking", "priority": "medium", "duration_minutes": 60},
        ],
        "risk_summary": f"{shop.shopName} in {shop.district} faces flood and wind risks. Perishable and water-sensitive stock requires pre-disaster elevation.",
    }

    try:
        if not llm_client:
            raise RuntimeError("LLM client not configured")
        raw = await llm_client.generate(prompt)
        data = _parse_json(raw, fallback)
    except Exception as exc:
        logger.warning("LLM failed for BCP (shop %s): %s", request.shop_id, exc)
        data = fallback

    try:
        plan_id = _write_bcp(db, request.shop_id, data)
    except Exception as exc:
        logger.error("BCP DB write failed: %s", exc)
        plan_id = str(uuid.uuid4())

    return BCPResponse(
        bcp_id=plan_id,
        shop_id=request.shop_id,
        status="generated",
        before_checklist=_to_items(data.get("before", []), "Preparation"),
        during_checklist=_to_items(data.get("during", []), "Response"),
        after_checklist=_to_items(data.get("after", []), "Recovery"),
        risk_summary=data.get("risk_summary"),
    )


# Legacy shim kept for backward compatibility
async def generate_bcp(shop_id: str, user_id: str) -> dict:
    logger.warning("generate_bcp() legacy stub called — no DB session available")
    return {}
