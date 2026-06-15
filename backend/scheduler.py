"""
APScheduler Background Job Scheduler

Manages periodic batch jobs for the DisasterShield backend:
1. Regional Weather Alert Generation (hourly)
   - One Meteosource call per regionCode
   - Evaluates weather thresholds (rain, wind, power grid stress)
   - Generates LLM-powered alerts for affected MSMEs

2. Location Profile Refresh (every 30 days)
   - Re-fetches Overpass amenity data for each registered shop
   - Updates elevation, terrain, and infrastructure proximity data
   - Tracks schema versioning and batch completion status
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from packages.core.logger import setup_logger
from packages.core.config import settings
from packages.alerts.service import run_regional_alert_batch
from packages.location.service import run_location_refresh_batch

logger = setup_logger(__name__)

# AsyncIO Scheduler for background jobs
scheduler = AsyncIOScheduler()

# Regional Weather Alert Batch Job
# Runs every `ALERT_BATCH_INTERVAL_HOURS` (default 1 hour)
# ────────────────────────────────────────────────────────
scheduler.add_job(
    run_regional_alert_batch,
    trigger=IntervalTrigger(hours=settings.ALERT_BATCH_INTERVAL_HOURS),
    id="alert_batch",
    name="Regional Weather Alert Generation",
    replace_existing=True,
    misfire_grace_time=600,  # Allow 10 minutes of grace for missed runs
    coalesce=True,           # Run missed jobs as a single execution
)
logger.debug(f"✓ Registered 'alert_batch' job (every {settings.ALERT_BATCH_INTERVAL_HOURS}h)")

# Location Enrichment Refresh Batch Job
# Runs every `LOCATION_REFRESH_INTERVAL_DAYS` (default 30 days)
# ───────────────────────────────────────────────────────────
scheduler.add_job(
    run_location_refresh_batch,
    trigger=IntervalTrigger(days=settings.LOCATION_REFRESH_INTERVAL_DAYS),
    id="location_refresh",
    name="Location Profile Refresh",
    replace_existing=True,
    misfire_grace_time=86400,  # Allow 1 day of grace for missed runs
    coalesce=True,
)
logger.debug(f"✓ Registered 'location_refresh' job (every {settings.LOCATION_REFRESH_INTERVAL_DAYS}d)")
