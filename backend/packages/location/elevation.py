import math
import httpx
from packages.core.config import settings
from packages.core.logger import get_logger

logger = get_logger(__name__)


async def fetch_elevation(lat: float, lng: float) -> float | None:
    """Single-point elevation lookup. Open-Elevation primary, OpenTopoData fallback."""
    results = await _batch_elevations([(lat, lng)])
    return results[0] if results else None


async def fetch_slope_and_aspect(lat: float, lng: float) -> tuple[float | None, str | None]:
    """
    Sample 4 neighboring points (~111 m apart) via a single batch elevation call
    to compute terrain slope (percent grade) and aspect (cardinal downslope direction).

    Returns (slope_percent, aspect_cardinal) or (None, None) when elevation data
    is unavailable or the terrain is essentially flat.
    """
    delta = 0.001  # ~111 m per degree at the equator
    points = [
        (lat + delta, lng),  # north
        (lat - delta, lng),  # south
        (lat, lng + delta),  # east
        (lat, lng - delta),  # west
    ]

    elevations = await _batch_elevations(points)
    if len(elevations) < 4 or any(e is None for e in elevations):
        logger.warning("Incomplete elevation sample for slope at (%.5f, %.5f)", lat, lng)
        return None, None

    z_n, z_s, z_e, z_w = elevations

    lat_m = 111_320.0                                   # metres per degree latitude
    lon_m = 111_320.0 * math.cos(math.radians(lat))    # metres per degree longitude

    rise_y = (z_n - z_s) / (2 * delta * lat_m)         # northward rise (m/m)
    rise_x = (z_e - z_w) / (2 * delta * lon_m)         # eastward rise (m/m)

    slope_frac = math.sqrt(rise_x ** 2 + rise_y ** 2)
    slope_pct = round(slope_frac * 100, 2)

    # Downslope compass bearing: atan2(-east_rise, -north_rise), 0 = N, 90 = E
    aspect_deg = math.degrees(math.atan2(-rise_x, -rise_y)) % 360
    aspect_cardinal = _to_cardinal(aspect_deg)

    return slope_pct, aspect_cardinal


async def _batch_elevations(points: list[tuple[float, float]]) -> list[float | None]:
    """Batch elevation fetch with OpenTopoData fallback."""
    try:
        return await _open_elevation_batch(points)
    except Exception as exc:
        logger.warning("open-elevation batch failed, trying opentopodata: %s", exc)
    try:
        return await _opentopodata_batch(points)
    except Exception as exc:
        logger.error("opentopodata batch also failed: %s", exc)
    return [None] * len(points)


async def _open_elevation_batch(points: list[tuple[float, float]]) -> list[float | None]:
    url = f"{settings.OPEN_ELEVATION_BASE_URL}/lookup"
    payload = {"locations": [{"latitude": lat, "longitude": lng} for lat, lng in points]}
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, timeout=20)
        response.raise_for_status()
    data = response.json()
    return [r.get("elevation") for r in data.get("results", [])]


async def _opentopodata_batch(points: list[tuple[float, float]]) -> list[float | None]:
    url = f"{settings.OPENTOPODATA_BASE_URL}/srtm90m"
    locations = "|".join(f"{lat},{lng}" for lat, lng in points)
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params={"locations": locations}, timeout=20)
        response.raise_for_status()
    data = response.json()
    return [r.get("elevation") for r in data.get("results", [])]


def _to_cardinal(deg: float) -> str:
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[round(deg / 45) % 8]
