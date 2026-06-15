import asyncio
import math
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from packages.core.logger import setup_logger
from packages.core.database import SessionLocal
from .nominatim import reverse_geocode
from .overpass import fetch_amenities
from .elevation import fetch_elevation, fetch_slope_and_aspect
from .schemas import LocationEnrichRequest, LocationEnrichResponse, AmenityItem

logger = setup_logger(__name__)

# ── Lookup tables ─────────────────────────────────────────────────────────────

_WATER_TYPE: dict[str, str] = {
    "water": "LAKE",
    "river": "RIVER",
    "stream": "STREAM",
    "reservoir": "RESERVOIR",
    "dam": "DAM",
}

_ROAD_TYPE: dict[str, str] = {
    "road_primary": "STATE_HIGHWAY",
    "road_secondary": "DISTRICT_ROAD",
    "road_tertiary": "VILLAGE_ROAD",
}

# ── SQL ───────────────────────────────────────────────────────────────────────

_UPSERT = text("""
INSERT INTO location_profiles (
    id, shopProfileId, latitude, longitude,
    nominatimPlaceId, village, suburb, taluka, district, pincode,
    elevationMetres, terrainSlope, slopeAspect, terrainType,
    nearestWaterBodyName, nearestWaterBodyType, nearestWaterBodyDistanceMetres,
    nearestReservoirName, nearestReservoirDistanceKm,
    nearestDamName, nearestDamDistanceKm,
    nearestHospitalName, nearestHospitalDistanceKm,
    nearestPoliceStationName, nearestPoliceStationDistanceKm,
    nearestFireStationName, nearestFireStationDistanceKm,
    nearestReliefCentreName, nearestReliefCentreDistanceKm,
    nearestLRDBCentreName, nearestLRDBCentreDistanceKm,
    nearestRoadType, nearestPavedRoadDistanceMetres,
    nearestSubstationName, nearestSubstationDistanceKm,
    batchStatus, lastBatchRunAt, createdAt, updatedAt
) VALUES (
    :id, :shopProfileId, :latitude, :longitude,
    :nominatimPlaceId, :village, :suburb, :taluka, :district, :pincode,
    :elevationMetres, :terrainSlope, :slopeAspect, :terrainType,
    :nearestWaterBodyName, :nearestWaterBodyType, :nearestWaterBodyDistanceMetres,
    :nearestReservoirName, :nearestReservoirDistanceKm,
    :nearestDamName, :nearestDamDistanceKm,
    :nearestHospitalName, :nearestHospitalDistanceKm,
    :nearestPoliceStationName, :nearestPoliceStationDistanceKm,
    :nearestFireStationName, :nearestFireStationDistanceKm,
    :nearestReliefCentreName, :nearestReliefCentreDistanceKm,
    :nearestLRDBCentreName, :nearestLRDBCentreDistanceKm,
    :nearestRoadType, :nearestPavedRoadDistanceMetres,
    :nearestSubstationName, :nearestSubstationDistanceKm,
    :batchStatus, :lastBatchRunAt, NOW(), NOW()
) ON DUPLICATE KEY UPDATE
    latitude                      = VALUES(latitude),
    longitude                     = VALUES(longitude),
    nominatimPlaceId              = VALUES(nominatimPlaceId),
    village                       = VALUES(village),
    suburb                        = VALUES(suburb),
    taluka                        = VALUES(taluka),
    district                      = VALUES(district),
    pincode                       = VALUES(pincode),
    elevationMetres               = VALUES(elevationMetres),
    terrainSlope                  = VALUES(terrainSlope),
    slopeAspect                   = VALUES(slopeAspect),
    terrainType                   = VALUES(terrainType),
    nearestWaterBodyName          = VALUES(nearestWaterBodyName),
    nearestWaterBodyType          = VALUES(nearestWaterBodyType),
    nearestWaterBodyDistanceMetres= VALUES(nearestWaterBodyDistanceMetres),
    nearestReservoirName          = VALUES(nearestReservoirName),
    nearestReservoirDistanceKm    = VALUES(nearestReservoirDistanceKm),
    nearestDamName                = VALUES(nearestDamName),
    nearestDamDistanceKm          = VALUES(nearestDamDistanceKm),
    nearestHospitalName           = VALUES(nearestHospitalName),
    nearestHospitalDistanceKm     = VALUES(nearestHospitalDistanceKm),
    nearestPoliceStationName      = VALUES(nearestPoliceStationName),
    nearestPoliceStationDistanceKm= VALUES(nearestPoliceStationDistanceKm),
    nearestFireStationName        = VALUES(nearestFireStationName),
    nearestFireStationDistanceKm  = VALUES(nearestFireStationDistanceKm),
    nearestReliefCentreName       = VALUES(nearestReliefCentreName),
    nearestReliefCentreDistanceKm = VALUES(nearestReliefCentreDistanceKm),
    nearestLRDBCentreName         = VALUES(nearestLRDBCentreName),
    nearestLRDBCentreDistanceKm   = VALUES(nearestLRDBCentreDistanceKm),
    nearestRoadType               = VALUES(nearestRoadType),
    nearestPavedRoadDistanceMetres= VALUES(nearestPavedRoadDistanceMetres),
    nearestSubstationName         = VALUES(nearestSubstationName),
    nearestSubstationDistanceKm   = VALUES(nearestSubstationDistanceKm),
    batchStatus                   = VALUES(batchStatus),
    lastBatchRunAt                = VALUES(lastBatchRunAt),
    updatedAt                     = NOW()
""")

_BATCH_SELECT = text("""
    SELECT shopProfileId, latitude, longitude
    FROM location_profiles
    WHERE lastBatchRunAt IS NULL
       OR lastBatchRunAt < DATE_SUB(NOW(), INTERVAL :days DAY)
       OR batchStatus IN ('PENDING', 'FAILED')
    LIMIT 500
""")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _nearest(amenities: list[dict], *categories: str) -> dict | None:
    matching = [a for a in amenities if a["category"] in categories]
    return min(matching, key=lambda x: x["distance_metres"]) if matching else None


def _terrain_type(slope_pct: float | None) -> str | None:
    if slope_pct is None:
        return None
    if slope_pct < 2.0:
        return "FLAT"
    if slope_pct < 15.0:
        return "SLOPE"
    return "HILLY"


def _km(metres: float | None) -> float | None:
    return round(metres / 1000, 3) if metres is not None else None


# ── Public API ────────────────────────────────────────────────────────────────

async def enrich_location(
    request: LocationEnrichRequest,
    db: Session,
) -> LocationEnrichResponse:
    """
    Orchestrate Nominatim + Overpass + Open-Elevation calls in parallel,
    write results to location_profiles, and return the enriched response.
    """
    lat, lng = request.latitude, request.longitude
    logger.info("Enriching location (%.5f, %.5f) for shop %s", lat, lng, request.shop_id)

    geo, amenities, elevation, slope_aspect = await asyncio.gather(
        reverse_geocode(lat, lng),
        fetch_amenities(lat, lng),
        fetch_elevation(lat, lng),
        fetch_slope_and_aspect(lat, lng),
    )
    slope_pct, aspect = slope_aspect

    # Slope in degrees for DB storage (Prisma field comment says "Degrees")
    slope_deg = math.degrees(math.atan(slope_pct / 100)) if slope_pct is not None else None

    hospital   = _nearest(amenities, "hospital")
    police     = _nearest(amenities, "police")
    fire       = _nearest(amenities, "fire_station")
    relief     = _nearest(amenities, "social_facility")
    lrdb       = _nearest(amenities, "disaster_response")
    water      = _nearest(amenities, "water", "river", "stream")
    reservoir  = _nearest(amenities, "reservoir")
    dam        = _nearest(amenities, "dam")
    substation = _nearest(amenities, "substation")
    road       = _nearest(amenities, "road_primary", "road_secondary", "road_tertiary")

    if request.shop_id:
        _persist(db, {
            "shopProfileId":                  request.shop_id,
            "latitude":                        lat,
            "longitude":                       lng,
            "nominatimPlaceId":                geo.get("place_id"),
            "village":                         geo.get("village"),
            "suburb":                          geo.get("suburb"),
            "taluka":                          geo.get("taluka"),
            "district":                        geo.get("district"),
            "pincode":                         geo.get("postcode"),
            "elevationMetres":                 elevation,
            "terrainSlope":                    slope_deg,
            "slopeAspect":                     aspect,
            "terrainType":                     _terrain_type(slope_pct),
            "nearestWaterBodyName":            water["name"] if water else None,
            "nearestWaterBodyType":            _WATER_TYPE.get(water["category"]) if water else None,
            "nearestWaterBodyDistanceMetres":  water["distance_metres"] if water else None,
            "nearestReservoirName":            reservoir["name"] if reservoir else None,
            "nearestReservoirDistanceKm":      _km(reservoir["distance_metres"]) if reservoir else None,
            "nearestDamName":                  dam["name"] if dam else None,
            "nearestDamDistanceKm":            _km(dam["distance_metres"]) if dam else None,
            "nearestHospitalName":             hospital["name"] if hospital else None,
            "nearestHospitalDistanceKm":       _km(hospital["distance_metres"]) if hospital else None,
            "nearestPoliceStationName":        police["name"] if police else None,
            "nearestPoliceStationDistanceKm":  _km(police["distance_metres"]) if police else None,
            "nearestFireStationName":          fire["name"] if fire else None,
            "nearestFireStationDistanceKm":    _km(fire["distance_metres"]) if fire else None,
            "nearestReliefCentreName":         relief["name"] if relief else None,
            "nearestReliefCentreDistanceKm":   _km(relief["distance_metres"]) if relief else None,
            "nearestLRDBCentreName":           lrdb["name"] if lrdb else None,
            "nearestLRDBCentreDistanceKm":     _km(lrdb["distance_metres"]) if lrdb else None,
            "nearestRoadType":                 _ROAD_TYPE.get(road["category"]) if road else None,
            "nearestPavedRoadDistanceMetres":  road["distance_metres"] if road else None,
            "nearestSubstationName":           substation["name"] if substation else None,
            "nearestSubstationDistanceKm":     _km(substation["distance_metres"]) if substation else None,
            "batchStatus":                     "COMPLETE",
            "lastBatchRunAt":                  datetime.utcnow(),
        })

    return LocationEnrichResponse(
        shop_id=request.shop_id or "",
        latitude=lat,
        longitude=lng,
        village=geo.get("village"),
        suburb=geo.get("suburb"),
        taluka=geo.get("taluka"),
        district=geo.get("district"),
        postcode=geo.get("postcode"),
        elevation_metres=elevation or 0.0,
        slope_percent=slope_pct,
        aspect=aspect,
        amenities=[
            AmenityItem(
                type=a["category"],
                name=a.get("name"),
                distance_metres=a["distance_metres"],
            )
            for a in amenities
        ],
        batch_status="COMPLETE",
    )


def _persist(db: Session, data: dict) -> None:
    try:
        db.execute(_UPSERT, {**data, "id": str(uuid.uuid4())})
        db.commit()
        logger.info("Persisted location profile for shop %s", data["shopProfileId"])
    except Exception as exc:
        db.rollback()
        logger.error("Failed to persist location profile for shop %s: %s", data.get("shopProfileId"), exc)
        raise


# ── Batch job ─────────────────────────────────────────────────────────────────

async def run_location_refresh_batch() -> None:
    """
    Re-enrich every location_profile whose lastBatchRunAt is older than 30 days
    or whose batchStatus is PENDING / FAILED. Called by APScheduler every 30 days.
    """
    logger.info("Location refresh batch started")

    if SessionLocal is None:
        logger.error("DB session factory not initialised; aborting batch")
        return

    db = SessionLocal()
    ok = failed = 0
    try:
        rows = db.execute(_BATCH_SELECT, {"days": 30}).fetchall()
        logger.info("Found %d location profiles to refresh", len(rows))

        for row in rows:
            shop_id = row.shopProfileId
            try:
                db.execute(
                    text("UPDATE location_profiles SET batchStatus = 'RUNNING' WHERE shopProfileId = :sid"),
                    {"sid": shop_id},
                )
                db.commit()

                req = LocationEnrichRequest(
                    shop_id=shop_id,
                    latitude=row.latitude,
                    longitude=row.longitude,
                )
                await enrich_location(req, db)
                ok += 1
            except Exception as exc:
                failed += 1
                logger.error("Batch enrichment failed for shop %s: %s", shop_id, exc)
                try:
                    db.execute(
                        text("""
                            UPDATE location_profiles
                            SET batchStatus = 'FAILED',
                                batchErrorMessage = :msg,
                                updatedAt = NOW()
                            WHERE shopProfileId = :sid
                        """),
                        {"sid": shop_id, "msg": str(exc)[:500]},
                    )
                    db.commit()
                except Exception:
                    db.rollback()
    finally:
        db.close()

    logger.info("Location refresh batch complete — %d OK, %d failed", ok, failed)
