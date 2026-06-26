"""
Alerts Service

Per-shop LLM alert generation and regional batch job.
"""
import json
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from packages.core.config import settings
from packages.core.logger import setup_logger
from packages.core.llm_client import llm_client
from packages.core.database import SessionLocal
from packages.core.email import send_alert_email
from .meteosource import fetch_current_weather, exceeds_flood_threshold, exceeds_wind_threshold
from .schemas import AlertGenerateRequest, AlertGenerationResponse, AlertResponse

logger = setup_logger(__name__)

# ── SQL helpers ────────────────────────────────────────────────────────────────

_SHOP_SQL = text("""
    SELECT sp.id, sp.userId, sp.shopName, sp.category,
           sp.district, sp.taluka, sp.regionCode,
           sp.latitude, sp.longitude
    FROM shop_profiles sp
    WHERE sp.id = :shop_id
""")

_LOCATION_SQL = text("""
    SELECT elevationMetres, nearestWaterBodyName, nearestWaterBodyDistanceMetres,
           nearestHospitalDistanceKm, terrainType, slopeAspect
    FROM location_profiles
    WHERE shopProfileId = :shop_id
""")

_STOCK_SQL = text("""
    SELECT si.name, si.category, si.quantity, si.unit,
           si.estimatedValueInr,
           GROUP_CONCAT(ss.type ORDER BY ss.type SEPARATOR ',') AS sensitivities
    FROM stock_items si
    LEFT JOIN stock_sensitivities ss ON si.id = ss.stockItemId
    WHERE si.shopProfileId = :shop_id
    GROUP BY si.id
    ORDER BY si.estimatedValueInr DESC
    LIMIT 15
""")

_USER_SQL = text("""
    SELECT email, name FROM users WHERE id = :user_id
""")

_REGION_SHOPS_SQL = text("""
    SELECT id, userId, shopName, category, latitude, longitude, regionCode
    FROM shop_profiles
    WHERE regionCode = :region_code
      AND latitude IS NOT NULL AND longitude IS NOT NULL
""")

_REGIONS_SQL = text("""
    SELECT regionCode, AVG(latitude) AS lat, AVG(longitude) AS lng
    FROM shop_profiles
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    GROUP BY regionCode
""")

_ACTIVE_ALERTS_SQL = text("""
    SELECT a.id, a.title, a.severity, a.category, a.summary, a.createdAt,
           GROUP_CONCAT(aa.label ORDER BY aa.orderIndex SEPARATOR '|||') AS action_steps
    FROM alerts a
    JOIN alert_recipients ar ON a.id = ar.alertId
    LEFT JOIN alert_actions aa ON a.id = aa.alertId
    WHERE ar.userId = :user_id
      AND a.isActive = true
    GROUP BY a.id, a.title, a.severity, a.category, a.summary, a.createdAt
    ORDER BY a.createdAt DESC
    LIMIT 50
""")

# ── Severity / category guards ─────────────────────────────────────────────────

_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
_CATEGORIES = {"FLOOD", "WIND", "POWER_OUTAGE", "TRANSPORT", "LANDSLIDE", "HEATWAVE", "OTHER"}


def _clean_severity(v: str) -> str:
    return v.upper() if v and v.upper() in _SEVERITIES else "MEDIUM"


def _clean_category(v: str) -> str:
    return v.upper() if v and v.upper() in _CATEGORIES else "OTHER"


# ── JSON extraction ────────────────────────────────────────────────────────────

def _parse_json(text_: str, fallback: dict) -> dict:
    for candidate in (
        text_.strip(),
        (re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text_, re.DOTALL) or type("", (), {"group": lambda *_: None})()).group(1),
        (re.search(r"\{.*\}", text_, re.DOTALL) or type("", (), {"group": lambda *_: None})()).group(0),
    ):
        if candidate:
            try:
                return json.loads(candidate)
            except (json.JSONDecodeError, TypeError):
                continue
    return fallback


# ── Context fetchers ───────────────────────────────────────────────────────────

def _fetch_context(db: Session, shop_id: str) -> tuple[Optional[object], Optional[object], list]:
    shop = db.execute(_SHOP_SQL, {"shop_id": shop_id}).fetchone()
    loc = db.execute(_LOCATION_SQL, {"shop_id": shop_id}).fetchone()
    stock = db.execute(_STOCK_SQL, {"shop_id": shop_id}).fetchall()
    return shop, loc, stock


# ── Prompt builder ─────────────────────────────────────────────────────────────

def _build_alert_prompt(shop, loc, weather: dict, stock: list, trigger: str) -> str:
    stock_lines = "\n".join(
        f"  - {r.name} ({r.quantity} {r.unit}, INR {r.estimatedValueInr:,.0f})"
        f"{' [' + r.sensitivities + ']' if r.sensitivities else ''}"
        for r in stock
    )
    water_info = ""
    if loc and loc.nearestWaterBodyName:
        water_info = f"Near water: {loc.nearestWaterBodyName} ({loc.nearestWaterBodyDistanceMetres:.0f} m)"

    return f"""You are DisasterShield AI — a disaster risk assistant for micro and small businesses in Maharashtra, India.

Shop: {shop.shopName} ({shop.category}) | {shop.district}, {shop.taluka}
Elevation: {loc.elevationMetres or 'unknown'} m | Terrain: {loc.terrainType or 'unknown'}
{water_info}

Current weather: {weather['summary']}
  Rainfall: {weather['rainfall_mm_per_hour']} mm/hr ({weather['rainfall_type']}) — alert threshold: {settings.ALERT_RAIN_THRESHOLD_MM} mm/hr
  Wind: {weather['wind_speed_kmph']} km/h from {weather['wind_direction']} — threshold: {settings.ALERT_WIND_THRESHOLD_KMPH} km/h
  Temperature: {weather['temperature_c']}°C | Cloud cover: {weather['cloud_cover_percent']}%

Triggered by: {trigger}

Stock inventory (top items by value):
{stock_lines or '  (no stock data)'}

Generate a hyper-local disaster alert for this specific shop. Respond ONLY with valid JSON:
{{
  "title": "<10-word alert title>",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "category": "FLOOD|WIND|POWER_OUTAGE|LANDSLIDE|HEATWAVE|OTHER",
  "summary": "<2-3 sentences describing the specific risk to this shop>",
  "affectedItems": ["<item1>", "<item2>"],
  "actionSteps": ["<step1>", "<step2>", "<step3>"]
}}"""


# ── DB writer ──────────────────────────────────────────────────────────────────

def _write_alert(db: Session, llm_data: dict, user_id: str, region_code: str) -> str:
    alert_id = str(uuid.uuid4())
    expires = datetime.utcnow() + timedelta(hours=24)

    # Store plain text summary (not a JSON blob)
    db.execute(text("""
        INSERT INTO alerts
            (id, title, severity, category, summary, affectedRegions, isActive, expiresAt, createdAt, updatedAt)
        VALUES
            (:id, :title, :severity, :category, :summary, :regions, true, :exp, NOW(), NOW())
    """), {
        "id": alert_id,
        "title": str(llm_data.get("title", "Disaster Alert"))[:255],
        "severity": _clean_severity(llm_data.get("severity", "MEDIUM")),
        "category": _clean_category(llm_data.get("category", "OTHER")),
        "summary": str(llm_data.get("summary", ""))[:2000],
        "regions": region_code,
        "exp": expires,
    })

    # Write each action step into alert_actions (its dedicated table)
    action_steps = llm_data.get("actionSteps") or []
    action_ids = []
    for idx, step in enumerate(action_steps[:10]):
        action_id = str(uuid.uuid4())
        action_ids.append(action_id)
        db.execute(text("""
            INSERT INTO alert_actions (id, alertId, label, actionType, orderIndex)
            VALUES (:id, :alertId, :label, :actionType, :idx)
        """), {
            "id": action_id,
            "alertId": alert_id,
            "label": str(step)[:500],
            "actionType": "manual",
            "idx": idx,
        })

    # Create the recipient record
    recipient_id = str(uuid.uuid4())
    db.execute(text("""
        INSERT INTO alert_recipients (id, alertId, userId, isRead)
        VALUES (:id, :alertId, :userId, false)
    """), {"id": recipient_id, "alertId": alert_id, "userId": user_id})

    # Create an AlertActionResult for each action × this recipient so the
    # frontend checklist can track completion state
    for action_id in action_ids:
        db.execute(text("""
            INSERT INTO alert_action_results (id, alertActionId, alertRecipientId, isCompleted)
            VALUES (:id, :actionId, :recipientId, false)
        """), {
            "id": str(uuid.uuid4()),
            "actionId": action_id,
            "recipientId": recipient_id,
        })

    db.commit()
    return alert_id


# ── Public API ─────────────────────────────────────────────────────────────────

async def generate_alert_for_shop(
    request: AlertGenerateRequest,
    db: Session,
    prefetched_weather: dict | None = None,
) -> AlertGenerationResponse:
    shop, loc, stock = _fetch_context(db, request.shop_id)
    if not shop:
        return AlertGenerationResponse(
            alert_id="", shop_id=request.shop_id,
            status="error", message="Shop not found",
        )

    lat = shop.latitude or 0.0
    lng = shop.longitude or 0.0
    # Use the region-level weather if already fetched; only call Meteosource
    # per-shop when triggered directly via the API endpoint (not from the batch)
    weather = prefetched_weather or await fetch_current_weather(lat, lng)

    flood = exceeds_flood_threshold(weather)
    wind = exceeds_wind_threshold(weather)

    if not flood and not wind:
        return AlertGenerationResponse(
            alert_id="", shop_id=request.shop_id,
            status="skipped",
            message=f"No threshold exceeded — rain={weather['rainfall_mm_per_hour']} mm/hr, wind={weather['wind_speed_kmph']} km/h, conditions: {weather['summary']}",
        )

    trigger = ", ".join(filter(None, [
        f"FLOOD (rain {weather['rainfall_mm_per_hour']} mm/hr)" if flood else None,
        f"WIND ({weather['wind_speed_kmph']} km/h)" if wind else None,
    ]))

    prompt = _build_alert_prompt(shop, loc, weather, stock, trigger)
    fallback = {
        "title": f"Weather Alert: {trigger}",
        "severity": "HIGH" if flood else "MEDIUM",
        "category": "FLOOD" if flood else "WIND",
        "summary": f"Weather thresholds exceeded at your location. {trigger}. Take precautionary measures.",
        "affectedItems": [r.name for r in stock[:3]],
        "actionSteps": [
            "Move water-sensitive stock to higher shelves",
            "Secure loose items against wind",
            "Document current inventory for insurance",
        ],
    }

    try:
        if not llm_client:
            raise RuntimeError("LLM client not configured")
        raw = await llm_client.generate(prompt)
        llm_data = _parse_json(raw, fallback)
    except Exception as exc:
        logger.warning("LLM call failed for shop %s, using fallback: %s", request.shop_id, exc)
        llm_data = fallback

    try:
        alert_id = _write_alert(db, llm_data, request.user_id, request.region_code)
    except Exception as exc:
        logger.error("DB write failed for alert: %s", exc)
        alert_id = ""

    # Send email notification (best-effort; never blocks the response)
    if alert_id:
        try:
            user_row = db.execute(_USER_SQL, {"user_id": request.user_id}).fetchone()
            if user_row and user_row.email:
                await send_alert_email(
                    to_email=user_row.email,
                    recipient_name=user_row.name,
                    shop_name=shop.shopName,
                    district=shop.district or "",
                    alert_id=alert_id,
                    alert_title=llm_data.get("title", "Disaster Alert"),
                    severity=_clean_severity(llm_data.get("severity", "MEDIUM")),
                    category=_clean_category(llm_data.get("category", "OTHER")),
                    summary=str(llm_data.get("summary", "")),
                    weather=weather,
                    action_steps=llm_data.get("actionSteps") or [],
                    affected_items=llm_data.get("affectedItems") or [],
                    user_id=request.user_id,
                )
        except Exception as exc:
            logger.error("Email dispatch failed for alert %s: %s", alert_id, exc)

    return AlertGenerationResponse(
        alert_id=alert_id,
        shop_id=request.shop_id,
        status="triggered",
        message=llm_data.get("summary", "")[:500],
    )


async def get_active_alerts_for_user(user_id: str, db: Session) -> List[AlertResponse]:
    rows = db.execute(_ACTIVE_ALERTS_SQL, {"user_id": user_id}).fetchall()
    results = []
    for row in rows:
        action_steps = [s for s in (row.action_steps or "").split("|||") if s]
        results.append(AlertResponse(
            alertId=row.id,
            title=row.title,
            severity=row.severity,
            category=row.category,
            summary=row.summary or "",
            affectedItems=[],
            actionSteps=action_steps,
            issuedAt=row.createdAt.isoformat() if row.createdAt else "",
        ))
    return results


# ── Batch job ──────────────────────────────────────────────────────────────────

async def run_regional_alert_batch() -> None:
    logger.info("Regional alert batch started")
    if SessionLocal is None:
        logger.error("DB session factory not initialised; aborting batch")
        return

    db = SessionLocal()
    ok = failed = skipped = 0
    try:
        regions = db.execute(_REGIONS_SQL).fetchall()
        logger.info("Processing %d regions", len(regions))

        for region in regions:
            try:
                # One Meteosource call per region — passed down to each shop,
                # eliminating N redundant calls for N shops in the same region
                weather = await fetch_current_weather(region.lat, region.lng)
                if not exceeds_flood_threshold(weather) and not exceeds_wind_threshold(weather):
                    continue

                shops = db.execute(_REGION_SHOPS_SQL, {"region_code": region.regionCode}).fetchall()
                for shop in shops:
                    try:
                        req = AlertGenerateRequest(
                            shop_id=shop.id,
                            user_id=shop.userId,
                            region_code=shop.regionCode,
                        )
                        result = await generate_alert_for_shop(req, db, prefetched_weather=weather)
                        if result.status == "triggered":
                            ok += 1
                        else:
                            skipped += 1
                    except Exception as exc:
                        failed += 1
                        logger.error("Alert failed for shop %s: %s", shop.id, exc)
            except Exception as exc:
                logger.error("Region %s weather fetch failed: %s", region.regionCode, exc)
    finally:
        db.close()

    logger.info("Alert batch complete — %d triggered, %d skipped, %d failed", ok, skipped, failed)
