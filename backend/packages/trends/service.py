"""
Trends Service

Aggregates historical alert and TrendDataPoint data for a region, then uses
LLM to generate narrative seasonal insights and recommendations.
"""
import json
import re
from collections import defaultdict
from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import text

from packages.core.logger import setup_logger
from packages.core.llm_client import llm_client
from .schemas import TrendsResponse, TrendDataPoint

logger = setup_logger(__name__)

# ── SQL ───────────────────────────────────────────────────────────────────────

_TREND_POINTS_SQL = text("""
    SELECT trendType, value, unit, recordedAt
    FROM trend_data_points
    WHERE regionCode = :region
      AND recordedAt > DATE_SUB(NOW(), INTERVAL :months MONTH)
    ORDER BY recordedAt
""")

_ALERT_HIST_SQL = text("""
    SELECT
        DATE_FORMAT(a.createdAt, '%Y-%m') AS month,
        a.category,
        COUNT(*) AS cnt
    FROM alerts a
    WHERE a.affectedRegions LIKE :region_pattern
      AND a.createdAt > DATE_SUB(NOW(), INTERVAL :months MONTH)
    GROUP BY month, a.category
    ORDER BY month
""")

_SHOP_COUNT_SQL = text("""
    SELECT COUNT(*) AS cnt FROM shop_profiles WHERE regionCode = :region
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


def _aggregate_alerts(alert_rows: list) -> dict:
    """Group alerts by month and category → {month: {category: count}}."""
    by_month: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    category_totals: dict[str, int] = defaultdict(int)
    for row in alert_rows:
        by_month[row.month][row.category] += row.cnt
        category_totals[row.category] += row.cnt
    return {"by_month": dict(by_month), "category_totals": dict(category_totals)}


def _build_monthly_points(alert_agg: dict) -> List[TrendDataPoint]:
    points = []
    for month, cats in sorted(alert_agg["by_month"].items()):
        total = sum(cats.values())
        points.append(TrendDataPoint(
            month=month,
            rainfall_mm=0.0,         # filled from trend_data_points below
            disruption_count=total,
            avg_risk_score=0.0,
        ))
    return points


def _merge_rainfall(points: List[TrendDataPoint], trend_rows: list) -> None:
    """Add rainfall totals from TrendDataPoint rows into the monthly summary."""
    rain_by_month: dict[str, float] = defaultdict(float)
    for row in trend_rows:
        if row.trendType == "rainfall" and row.recordedAt:
            month = row.recordedAt.strftime("%Y-%m")
            rain_by_month[month] += float(row.value or 0)
    for pt in points:
        if pt.month in rain_by_month:
            pt.rainfall_mm = round(rain_by_month[pt.month], 1)


def _build_prompt(region_code: str, months: int, alert_agg: dict, trend_rows: list, shop_count: int) -> str:
    cat_summary = ", ".join(
        f"{k}: {v}" for k, v in sorted(alert_agg["category_totals"].items(), key=lambda x: -x[1])
    ) or "no alerts recorded"
    total_alerts = sum(alert_agg["category_totals"].values())
    avg_pm = round(total_alerts / max(months, 1), 2)

    return f"""You are DisasterShield AI analysing regional disaster trends in Maharashtra, India.

Region: {region_code}
Analysis period: past {months} months
Registered shops in region: {shop_count}

Alert summary:
  Total alerts: {total_alerts} | Average: {avg_pm}/month
  By category: {cat_summary}

Generate insights and recommendations in valid JSON ONLY:
{{
  "peak_disaster_months": ["June", "July", "August"],
  "most_common_types": ["FLOOD", "WIND"],
  "average_frequency_per_month": {avg_pm},
  "seasonal_insights": "2-3 sentences describing the seasonal risk pattern for this region, referencing monsoon, pre-monsoon heat, etc.",
  "recommendations": [
    "Pre-monsoon stock elevation audit (May)",
    "Insurance policy review before June",
    "Coordinate with local LRDB for early warning alerts"
  ]
}}"""


# ── Public API ────────────────────────────────────────────────────────────────

async def get_trends_for_region(region_code: str, db: Session) -> TrendsResponse:
    months = 6  # default; callers can pass a different TrendsRequest
    trend_rows = db.execute(_TREND_POINTS_SQL, {"region": region_code, "months": months}).fetchall()
    alert_rows = db.execute(_ALERT_HIST_SQL, {
        "region_pattern": f"%{region_code}%", "months": months,
    }).fetchall()
    shop_row = db.execute(_SHOP_COUNT_SQL, {"region": region_code}).fetchone()
    shop_count = int(shop_row.cnt) if shop_row else 0

    alert_agg = _aggregate_alerts(alert_rows)
    data_points = _build_monthly_points(alert_agg)
    _merge_rainfall(data_points, trend_rows)

    total = sum(alert_agg["category_totals"].values())
    avg_pm = round(total / max(months, 1), 2)
    top_cats = [k for k, _ in sorted(alert_agg["category_totals"].items(), key=lambda x: -x[1])]

    fallback = {
        "peak_disaster_months": ["June", "July", "August"],
        "most_common_types": top_cats[:3] or ["FLOOD", "WIND"],
        "average_frequency_per_month": avg_pm,
        "seasonal_insights": (
            f"Region {region_code} shows elevated disaster activity during the monsoon season "
            f"(June–September). {total} disruptions were recorded over {months} months, "
            f"with {top_cats[0] if top_cats else 'flood'} events being most frequent."
        ),
        "recommendations": [
            "Conduct pre-monsoon stock audit and elevation review (May)",
            "Ensure insurance coverage is current before June",
            "Establish emergency contact chain with local LRDB officers",
        ],
    }

    try:
        if not llm_client:
            raise RuntimeError("LLM not configured")
        prompt = _build_prompt(region_code, months, alert_agg, trend_rows, shop_count)
        raw = await llm_client.generate(prompt)
        parsed = _parse_json(raw, fallback)
    except Exception as exc:
        logger.warning("LLM trends failed for region %s: %s", region_code, exc)
        parsed = fallback

    return TrendsResponse(
        region_code=region_code,
        peak_disaster_months=parsed.get("peak_disaster_months", fallback["peak_disaster_months"]),
        most_common_types=parsed.get("most_common_types", top_cats[:3]),
        average_frequency_per_month=float(parsed.get("average_frequency_per_month", avg_pm)),
        seasonal_insights=str(parsed.get("seasonal_insights", fallback["seasonal_insights"])),
        recommendations=parsed.get("recommendations", fallback["recommendations"]),
        data_points=data_points,
    )


# Legacy shim
async def get_regional_trends(region_code: str, months: int = 6) -> dict:
    return {}
