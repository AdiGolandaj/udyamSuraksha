"""
Manual Alert Trigger Script
===========================
Generates a flood alert for Meena Patil's kirana shop in Pune-Mulshi
using mock weather conditions above both flood and wind thresholds.

This exercises the full pipeline:
  mock weather → threshold check → LLM prompt → DB write → HTML email

Usage (from repo root):
    cd backend
    python -m scripts.trigger_alert

Or directly:
    cd backend
    python ../scripts/trigger_alert.py
"""
import asyncio
import sys
import os

# Allow running from repo root or from backend/
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND = os.path.join(_REPO_ROOT, "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Load .env before importing anything that reads settings
from dotenv import load_dotenv
load_dotenv(os.path.join(_BACKEND, ".env"))

from packages.core.database import SessionLocal
from packages.alerts.schemas import AlertGenerateRequest
from packages.alerts.service import generate_alert_for_shop


# ── Target shop ────────────────────────────────────────────────────────────────
# Meena Patil — kirana store 380 m from Mulshi Dam Backwaters, elevation 600 m
TARGET_USER_ID  = "71051de3-02ba-4eab-b2d0-f81efd1240e0"
TARGET_SHOP_ID  = "1ba78a51-074c-4b66-ac8a-96bd83d2397b"
TARGET_REGION   = "pune-mulshi"

# ── Mock weather (above both thresholds: rain > 20 mm/hr, wind > 40 km/h) ─────
MOCK_WEATHER = {
    "temperature_c":         27.0,
    "rainfall_mm_per_hour":  38.0,   # well above the 20 mm/hr flood threshold
    "rainfall_type":         "rain",
    "wind_speed_kmph":       58.0,   # above the 40 km/h wind threshold
    "wind_angle":            225,
    "wind_direction":        "SW",
    "cloud_cover_percent":   95,
    "summary":               "Heavy monsoon rain with strong south-westerly winds",
    "icon":                  "rain",
}


async def main() -> None:
    print("=" * 60)
    print("DisasterShield — Manual Alert Trigger")
    print("=" * 60)
    print(f"  Target user : {TARGET_USER_ID}")
    print(f"  Shop        : {TARGET_SHOP_ID}")
    print(f"  Region      : {TARGET_REGION}")
    print(f"  Rain        : {MOCK_WEATHER['rainfall_mm_per_hour']} mm/hr  (threshold: 20)")
    print(f"  Wind        : {MOCK_WEATHER['wind_speed_kmph']} km/h  (threshold: 40)")
    print()

    db = SessionLocal()
    try:
        req = AlertGenerateRequest(
            shop_id=TARGET_SHOP_ID,
            user_id=TARGET_USER_ID,
            region_code=TARGET_REGION,
        )

        print("Calling generate_alert_for_shop …")
        result = await generate_alert_for_shop(req, db, prefetched_weather=MOCK_WEATHER)

        print()
        print("Result:")
        print(f"  status   : {result.status}")
        print(f"  alert_id : {result.alert_id or '(none)'}")
        print(f"  message  : {result.message[:200]}")
        print()

        if result.status == "triggered":
            print("SUCCESS — alert written to DB and email dispatched.")
            print(f"View in app: http://localhost:3000/msme/{TARGET_USER_ID}/alerts/{result.alert_id}")
        elif result.status == "skipped":
            print("SKIPPED — thresholds not exceeded (did mock weather reach the service?)")
        else:
            print("ERROR — check logs above for details.")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
