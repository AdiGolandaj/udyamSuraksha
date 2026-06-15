import httpx
from packages.core.config import settings
from packages.core.logger import get_logger

logger = get_logger(__name__)

_HEADERS = {"Accept": "application/json"}


async def fetch_current_weather(lat: float, lng: float) -> dict:
    """
    Fetch current weather from Meteosource /point/hourly (sections=current).
    Returns a dict with temperature_c, rainfall_mm_per_hour, wind_speed_kmph,
    wind_direction, and humidity_percent.
    """
    url = f"{settings.METEOSOURCE_BASE_URL}/point/hourly"
    params = {
        "lat": lat,
        "lon": lng,
        "sections": "current",
        "units": "metric",
        "key": settings.METEOSOURCE_API_KEY,
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, headers=_HEADERS, timeout=15)
        response.raise_for_status()
    return _parse_current(response.json())


def _parse_current(data: dict) -> dict:
    current = data.get("current", {})
    wind = current.get("wind", {})
    precip = current.get("precipitation", {})
    # Meteosource metric: wind in m/s → convert to km/h for threshold comparison
    wind_ms = float(wind.get("speed", 0) or 0)
    return {
        "temperature_c": float(current.get("temperature", 0) or 0),
        "rainfall_mm_per_hour": float(precip.get("total", 0) or 0),
        "wind_speed_kmph": round(wind_ms * 3.6, 1),
        "wind_direction": wind.get("dir") or "N",
        "humidity_percent": float(current.get("humidity", 0) or 0),
    }


def exceeds_flood_threshold(weather: dict) -> bool:
    return weather["rainfall_mm_per_hour"] >= settings.ALERT_RAIN_THRESHOLD_MM


def exceeds_wind_threshold(weather: dict) -> bool:
    return weather["wind_speed_kmph"] >= settings.ALERT_WIND_THRESHOLD_KMPH


# Legacy name kept for the scheduler stub
async def fetch_hourly_weather(lat: float, lng: float) -> dict:
    return await fetch_current_weather(lat, lng)
