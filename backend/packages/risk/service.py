"""
Risk Scoring Service

Rule-based component scores (0-100) derived from LocationProfile and StockSensitivity,
combined with an LLM narrative and stored in risk_profiles / risk_suggestions.
"""
import json
import math
import re
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from packages.core.logger import setup_logger
from packages.core.llm_client import llm_client
from .schemas import RiskScoreRequest, RiskScoreResponse

logger = setup_logger(__name__)

# ── SQL ───────────────────────────────────────────────────────────────────────

_SHOP_SQL = text("""
    SELECT shopName, category, district, taluka
    FROM shop_profiles WHERE id = :sid
""")

_LOC_SQL = text("""
    SELECT elevationMetres, terrainSlope, terrainType,
           nearestWaterBodyDistanceMetres, nearestWaterBodyType,
           nearestReservoirDistanceKm, nearestDamDistanceKm,
           nearestHospitalDistanceKm, nearestPoliceStationDistanceKm,
           nearestRoadType, nearestPavedRoadDistanceMetres,
           nearestSubstationDistanceKm,
           powerSupplyType, roofType, buildingType, shopFloorLevel
    FROM location_profiles WHERE shopProfileId = :sid
""")

_STOCK_SQL = text("""
    SELECT COUNT(*) AS total_items,
           SUM(estimatedValueInr) AS total_value,
           SUM(CASE WHEN ss.type = 'WATER'      THEN 1 ELSE 0 END) AS water_sensitive,
           SUM(CASE WHEN ss.type = 'HEAT'       THEN 1 ELSE 0 END) AS heat_sensitive,
           SUM(CASE WHEN ss.type = 'PERISHABLE' THEN 1 ELSE 0 END) AS perishable,
           SUM(CASE WHEN ss.type = 'FRAGILE'    THEN 1 ELSE 0 END) AS fragile
    FROM stock_items si
    LEFT JOIN stock_sensitivities ss ON si.id = ss.stockItemId
    WHERE si.shopProfileId = :sid
""")

# ── Scoring rules ─────────────────────────────────────────────────────────────

def _clamp(v: float) -> int:
    return max(0, min(100, round(v)))


def _flood_score(loc) -> int:
    if loc is None:
        return 50
    score = 0
    # Water proximity: within 500 m is very high risk
    wdist = loc.nearestWaterBodyDistanceMetres or 10_000
    if wdist < 200:
        score += 50
    elif wdist < 500:
        score += 35
    elif wdist < 1_000:
        score += 20
    elif wdist < 2_000:
        score += 10

    # Dam / reservoir proximity
    dam_km = min(loc.nearestDamDistanceKm or 50, loc.nearestReservoirDistanceKm or 50)
    if dam_km < 2:
        score += 30
    elif dam_km < 5:
        score += 15
    elif dam_km < 10:
        score += 5

    # Low elevation increases flood risk
    elev = loc.elevationMetres or 50
    if elev < 10:
        score += 20
    elif elev < 30:
        score += 10

    # Shop floor level
    if str(loc.shopFloorLevel or "").upper() == "BASEMENT":
        score += 20

    return _clamp(score)


def _wind_score(loc) -> int:
    if loc is None:
        return 40
    score = 30  # baseline
    roof = str(loc.roofType or "").upper()
    if roof in ("TIN_SHEET", "THATCHED", "ASBESTOS"):
        score += 30
    elif roof == "TILED":
        score += 15
    building = str(loc.buildingType or "").upper()
    if building == "KUTCHA":
        score += 25
    elif building == "SEMI_PUCCA":
        score += 10
    # High elevation + exposed terrain increases wind risk
    elev = loc.elevationMetres or 50
    if elev > 200:
        score += 10
    return _clamp(score)


def _power_score(loc) -> int:
    if loc is None:
        return 50
    score = 20
    power = str(loc.powerSupplyType or "GRID").upper()
    if power == "GRID":
        score += 20  # fully grid-dependent
    elif power == "MIXED":
        score += 10
    sub_km = loc.nearestSubstationDistanceKm or 5
    if sub_km > 10:
        score += 20
    elif sub_km > 5:
        score += 10
    return _clamp(score)


def _stock_score(stock_row) -> int:
    if stock_row is None or (stock_row.total_items or 0) == 0:
        return 40
    total = stock_row.total_items or 1
    sensitive = (stock_row.water_sensitive or 0) + (stock_row.heat_sensitive or 0) + (stock_row.perishable or 0)
    ratio = sensitive / total
    return _clamp(ratio * 100)


def _location_access_score(loc) -> int:
    if loc is None:
        return 50
    score = 0
    hosp_km = loc.nearestHospitalDistanceKm or 20
    if hosp_km > 15:
        score += 30
    elif hosp_km > 5:
        score += 15
    road = str(loc.nearestRoadType or "VILLAGE_ROAD").upper()
    if road in ("NONE", "KACHCHA"):
        score += 40
    elif road == "VILLAGE_ROAD":
        score += 20
    elif road == "DISTRICT_ROAD":
        score += 10
    return _clamp(score)


def _risk_level(overall: int) -> str:
    if overall >= 75:
        return "CRITICAL"
    if overall >= 55:
        return "HIGH"
    if overall >= 35:
        return "MODERATE"
    return "SAFE"


# ── LLM recommendations ───────────────────────────────────────────────────────

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


def _build_risk_prompt(shop, loc, stock_row, scores: dict) -> str:
    return f"""You are DisasterShield AI computing risk recommendations for an MSME.

Shop: {shop.shopName if shop else 'Unknown'} ({shop.category if shop else 'Unknown'}) | {shop.district if shop else ''}, {shop.taluka if shop else ''}

Computed risk scores (0-100, higher = more vulnerable):
  Flood risk: {scores['flood']}
  Wind risk: {scores['wind']}
  Power outage risk: {scores['power']}
  Stock sensitivity: {scores['stock']}
  Access/recovery: {scores['access']}
  OVERALL: {scores['overall']}

Location highlights:
  Elevation: {loc.elevationMetres if loc else 'unknown'} m
  Nearest water: {loc.nearestWaterBodyDistanceMetres if loc else 'unknown'} m
  Roof type: {loc.roofType if loc else 'unknown'}
  Building type: {loc.buildingType if loc else 'unknown'}

Stock: {stock_row.total_items if stock_row else 0} items | Water-sensitive: {stock_row.water_sensitive if stock_row else 0} | Perishable: {stock_row.perishable if stock_row else 0}

Generate 3-5 specific, actionable risk reduction recommendations. Respond ONLY in valid JSON:
{{
  "recommendations": [
    {{"title": "...", "description": "...", "impact_score": 15}},
    {{"title": "...", "description": "...", "impact_score": 10}}
  ]
}}"""


# ── DB write ───────────────────────────────────────────────────────────────────

def _write_risk(db: Session, shop_id: str, scores: dict, suggestions: list) -> str:
    profile_id = str(uuid.uuid4())
    db.execute(text("""
        INSERT INTO risk_profiles
            (id, shopProfileId, overallScore, floodScore, powerScore, stockScore,
             locationScore, accessScore, riskLevel, lastComputedAt)
        VALUES
            (:id, :sid, :overall, :flood, :power, :stock, :loc, :access, :level, NOW())
        ON DUPLICATE KEY UPDATE
            overallScore   = VALUES(overallScore),
            floodScore     = VALUES(floodScore),
            powerScore     = VALUES(powerScore),
            stockScore     = VALUES(stockScore),
            locationScore  = VALUES(locationScore),
            accessScore    = VALUES(accessScore),
            riskLevel      = VALUES(riskLevel),
            lastComputedAt = NOW()
    """), {
        "id": profile_id, "sid": shop_id,
        "overall": scores["overall"], "flood": scores["flood"],
        "power": scores["power"], "stock": scores["stock"],
        "loc": scores["location"], "access": scores["access"],
        "level": scores["level"],
    })

    row = db.execute(
        text("SELECT id FROM risk_profiles WHERE shopProfileId = :sid"), {"sid": shop_id}
    ).fetchone()
    profile_id = row.id if row else profile_id

    db.execute(text("DELETE FROM risk_suggestions WHERE riskProfileId = :pid"), {"pid": profile_id})
    for idx, s in enumerate(suggestions[:5]):
        db.execute(text("""
            INSERT INTO risk_suggestions
                (id, riskProfileId, title, description, impactScore, isActioned, orderIndex)
            VALUES (:id, :pid, :title, :desc, :impact, false, :idx)
        """), {
            "id": str(uuid.uuid4()), "pid": profile_id,
            "title": str(s.get("title", ""))[:255],
            "desc": str(s.get("description", "")),
            "impact": int(s.get("impact_score", 10)),
            "idx": idx,
        })

    db.commit()
    return profile_id


# ── Public API ────────────────────────────────────────────────────────────────

async def compute_risk_score(request: RiskScoreRequest, db: Session) -> RiskScoreResponse:
    shop = db.execute(_SHOP_SQL, {"sid": request.shop_id}).fetchone()
    loc = db.execute(_LOC_SQL, {"sid": request.shop_id}).fetchone()
    stock_row = db.execute(_STOCK_SQL, {"sid": request.shop_id}).fetchone()

    flood = _flood_score(loc)
    wind = _wind_score(loc)
    power = _power_score(loc)
    stock = _stock_score(stock_row)
    access = _location_access_score(loc)
    overall = _clamp(flood * 0.30 + wind * 0.20 + power * 0.15 + stock * 0.20 + access * 0.15)
    level = _risk_level(overall)

    # RiskProfile DB has no windScore column; store wind exposure in locationScore
    # (locationScore = terrain/wind hazard exposure; floodScore = water/elevation hazard)
    scores = {
        "flood": flood, "wind": wind, "power": power,
        "stock": stock, "location": wind, "access": access,
        "overall": overall, "level": level,
    }

    fallback_suggestions = [
        {"title": "Elevate water-sensitive stock", "description": "Place water-sensitive and perishable items on raised shelves at least 60 cm above floor level.", "impact_score": 15},
        {"title": "Photograph inventory for insurance", "description": "Maintain a photo record of stock updated monthly for faster insurance claims.", "impact_score": 10},
        {"title": "Identify alternate suppliers", "description": "Maintain contacts for at least two alternative suppliers for high-value stock lines.", "impact_score": 8},
    ]

    try:
        if not llm_client:
            raise RuntimeError("LLM not configured")
        raw = await llm_client.generate(_build_risk_prompt(shop, loc, stock_row, scores))
        parsed = _parse_json(raw, {"recommendations": fallback_suggestions})
        suggestions = parsed.get("recommendations", fallback_suggestions)
    except Exception as exc:
        logger.warning("LLM risk recommendations failed for shop %s: %s", request.shop_id, exc)
        suggestions = fallback_suggestions

    try:
        _write_risk(db, request.shop_id, scores, suggestions)
    except Exception as exc:
        logger.error("Risk DB write failed: %s", exc)

    return RiskScoreResponse(
        shop_id=request.shop_id,
        overall_risk_score=round(overall / 100, 2),
        flood_risk_score=round(flood / 100, 2),
        wind_risk_score=round(wind / 100, 2),
        power_outage_risk_score=round(power / 100, 2),
        risk_level=level.lower(),
        recommendations=[s.get("title", "") for s in suggestions],
    )


# Legacy shim
async def compute_risk_score_legacy(shop_id: str) -> dict:
    return {}
