"""
Forecasts Service

LLM-driven financial loss estimation using stock inventory and regional alert history.
"""
import json
import re
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from packages.core.logger import setup_logger
from packages.core.llm_client import llm_client
from .schemas import ForecastRequest, ForecastResponse, ForecastDataPoint

logger = setup_logger(__name__)

# ── SQL ───────────────────────────────────────────────────────────────────────

_SHOP_SQL = text("""
    SELECT sp.shopName, sp.category, sp.district, sp.taluka, sp.regionCode
    FROM shop_profiles sp WHERE sp.id = :sid
""")

_STOCK_SQL = text("""
    SELECT si.name, si.category, si.quantity, si.unit, si.estimatedValueInr,
           GROUP_CONCAT(ss.type SEPARATOR ',') AS sensitivities
    FROM stock_items si
    LEFT JOIN stock_sensitivities ss ON si.id = ss.stockItemId
    WHERE si.shopProfileId = :sid
    GROUP BY si.id
    ORDER BY si.estimatedValueInr DESC
    LIMIT 20
""")

_ALERT_HISTORY_SQL = text("""
    SELECT a.category, COUNT(*) AS cnt, MAX(a.createdAt) AS last_at
    FROM alerts a
    JOIN alert_recipients ar ON a.id = ar.alertId
    JOIN shop_profiles sp ON ar.userId = sp.userId
    WHERE sp.regionCode = :region AND a.createdAt > DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY a.category
    ORDER BY cnt DESC
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


def _build_prompt(shop, stock: list, alerts: list, request: ForecastRequest) -> str:
    stock_lines = "\n".join(
        f"  - {r.name} ({r.quantity} {r.unit}, INR {r.estimatedValueInr:,.0f})"
        f"{' [' + r.sensitivities + ']' if r.sensitivities else ''}"
        for r in stock
    )
    total_val = sum((r.estimatedValueInr or 0) for r in stock)
    alert_lines = "\n".join(
        f"  - {r.category}: {r.cnt} incidents (last: {r.last_at.strftime('%Y-%m') if r.last_at else 'N/A'})"
        for r in alerts
    ) or "  No historical alerts in region"
    scenario_str = f"Focus scenario: {request.scenario}" if request.scenario else "General multi-hazard scenario"

    return f"""You are DisasterShield AI estimating financial losses for an MSME in India.

Shop: {shop.shopName} ({shop.category}) | {shop.district}, {shop.taluka}
{scenario_str} | Forecast horizon: {request.horizon_days} days

Inventory (top items by value):
{stock_lines or '  (no stock data)'}
Total inventory value: INR {total_val:,.0f}

Historical regional alerts (past 12 months):
{alert_lines}

Estimate the financial impact. Respond ONLY in valid JSON:
{{
  "stock_loss_inr": 45000,
  "downtime_hours": 48,
  "revenue_loss_inr": 30000,
  "confidence_percent": 65,
  "probability": "medium",
  "disaster_type": "Flood",
  "recovery_timeline_days": 7,
  "affected_items": [
    {{"name": "Rice (50 kg bags)", "estimated_damage_inr": 15000}},
    {{"name": "Sugar", "estimated_damage_inr": 8000}}
  ],
  "narrative": "2-3 sentence explanation of estimated losses and key assumptions."
}}

probability must be: low | medium | high"""


def _write_forecast(db: Session, shop_id: str, data: dict) -> str:
    scenario_id = str(uuid.uuid4())
    db.execute(text("""
        INSERT INTO forecast_scenarios
            (id, shopProfileId, disasterType, probability, estimatedLossInr,
             affectedItemCount, estimatedDowntimeDays, recoveryTimelineDays,
             aiNarrative, generatedAt)
        VALUES
            (:id, :sid, :dtype, :prob, :loss, :itemcnt, :downtime, :recovery, :narrative, NOW())
    """), {
        "id": scenario_id,
        "sid": shop_id,
        "dtype": str(data.get("disaster_type", "Multi-hazard"))[:255],
        "prob": str(data.get("probability", "medium"))[:50],
        "loss": float(data.get("stock_loss_inr", 0)) + float(data.get("revenue_loss_inr", 0)),
        "itemcnt": len(data.get("affected_items", [])),
        "downtime": max(1, round(float(data.get("downtime_hours", 0)) / 24)),
        "recovery": int(data.get("recovery_timeline_days", 7)),
        "narrative": str(data.get("narrative", ""))[:2000],
    })

    for item in (data.get("affected_items") or [])[:20]:
        if not isinstance(item, dict):
            continue
        db.execute(text("""
            INSERT INTO forecast_affected_items (id, forecastScenarioId, stockItemName, estimatedDamageInr)
            VALUES (:id, :fid, :name, :dmg)
        """), {
            "id": str(uuid.uuid4()),
            "fid": scenario_id,
            "name": str(item.get("name", "Unknown"))[:255],
            "dmg": float(item.get("estimated_damage_inr", 0)),
        })

    db.commit()
    return scenario_id


# ── Public API ────────────────────────────────────────────────────────────────

async def estimate_financial_loss(request: ForecastRequest, db: Session) -> ForecastResponse:
    shop = db.execute(_SHOP_SQL, {"sid": request.shop_id}).fetchone()
    if not shop:
        return ForecastResponse(
            forecast_id="", shop_id=request.shop_id, horizon_days=request.horizon_days,
            estimated_stock_loss_inr=0, estimated_downtime_hours=0,
            estimated_revenue_loss_inr=0, total_estimated_loss_inr=0,
            confidence_percent=0,
        )

    stock = db.execute(_STOCK_SQL, {"sid": request.shop_id}).fetchall()
    alerts = db.execute(_ALERT_HISTORY_SQL, {"region": shop.regionCode}).fetchall()

    prompt = _build_prompt(shop, stock, alerts, request)
    total_stock_val = sum((r.estimatedValueInr or 0) for r in stock)
    fallback = {
        "stock_loss_inr": round(total_stock_val * 0.15),
        "downtime_hours": 48,
        "revenue_loss_inr": round(total_stock_val * 0.05),
        "confidence_percent": 40,
        "probability": "medium",
        "disaster_type": request.scenario or "Flood",
        "recovery_timeline_days": 7,
        "affected_items": [{"name": r.name, "estimated_damage_inr": round(r.estimatedValueInr * 0.2)} for r in stock[:3]],
        "narrative": f"Estimated based on a typical flood event for {shop.category} businesses in {shop.district}.",
    }

    try:
        if not llm_client:
            raise RuntimeError("LLM not configured")
        raw = await llm_client.generate(prompt)
        data = _parse_json(raw, fallback)
    except Exception as exc:
        logger.warning("LLM forecast failed for shop %s: %s", request.shop_id, exc)
        data = fallback

    try:
        forecast_id = _write_forecast(db, request.shop_id, data)
    except Exception as exc:
        logger.error("Forecast DB write failed: %s", exc)
        forecast_id = str(uuid.uuid4())

    stock_loss = float(data.get("stock_loss_inr", 0))
    revenue_loss = float(data.get("revenue_loss_inr", 0))
    return ForecastResponse(
        forecast_id=forecast_id,
        shop_id=request.shop_id,
        horizon_days=request.horizon_days,
        estimated_stock_loss_inr=stock_loss,
        estimated_downtime_hours=int(data.get("downtime_hours", 0)),
        estimated_revenue_loss_inr=revenue_loss,
        total_estimated_loss_inr=stock_loss + revenue_loss,
        confidence_percent=float(data.get("confidence_percent", 40)),
        data_points=[],
    )


# Legacy shim
async def generate_forecast(shop_id: str, horizon_days: int = 30) -> dict:
    return {}
