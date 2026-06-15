import math
import httpx
from packages.core.config import settings
from packages.core.logger import get_logger

logger = get_logger(__name__)


def _build_query(lat: float, lng: float, radius: int) -> str:
    r = radius
    return f"""
[out:json];
(
  node["amenity"="hospital"](around:{r},{lat},{lng});
  node["amenity"="clinic"](around:{r},{lat},{lng});
  node["amenity"="police"](around:{r},{lat},{lng});
  node["amenity"="fire_station"](around:{r},{lat},{lng});
  node["amenity"="social_facility"](around:{r},{lat},{lng});
  node["emergency"="disaster_response"](around:{r},{lat},{lng});
  node["natural"="water"](around:{r},{lat},{lng});
  node["waterway"="reservoir"](around:{r},{lat},{lng});
  node["waterway"="dam"](around:{r},{lat},{lng});
  node["waterway"~"river|stream"](around:{r},{lat},{lng});
  node["power"="substation"](around:{r},{lat},{lng});
  way["highway"~"primary|secondary|tertiary"](around:5000,{lat},{lng});
);
out center;
""".strip()


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _element_coords(elem: dict) -> tuple[float, float] | None:
    if elem.get("type") == "node":
        lat, lon = elem.get("lat"), elem.get("lon")
    else:
        # ways use `out center` which adds a "center" sub-object
        center = elem.get("center", {})
        lat, lon = center.get("lat"), center.get("lon")
    if lat is None or lon is None:
        return None
    return lat, lon


def _classify(tags: dict) -> str | None:
    amenity = tags.get("amenity")
    if amenity in ("hospital", "clinic", "health_centre"):
        return "hospital"
    if amenity == "police":
        return "police"
    if amenity == "fire_station":
        return "fire_station"
    if amenity == "social_facility":
        return "social_facility"
    if tags.get("emergency") == "disaster_response":
        return "disaster_response"
    if tags.get("natural") == "water":
        return "water"
    waterway = tags.get("waterway")
    if waterway == "reservoir":
        return "reservoir"
    if waterway == "dam":
        return "dam"
    if waterway in ("river", "stream"):
        return waterway
    if tags.get("power") == "substation":
        return "substation"
    highway = tags.get("highway")
    if highway in ("primary", "secondary", "tertiary"):
        return f"road_{highway}"
    return None


async def fetch_amenities(lat: float, lng: float) -> list[dict]:
    """
    Single compound Overpass query returning categorised nearby amenities with distances.

    Each result dict: {category, name, distance_metres, lat, lon}.
    Results are sorted by distance ascending.
    """
    radius = settings.OVERPASS_SEARCH_RADIUS_METRES
    query = _build_query(lat, lng, radius)
    async with httpx.AsyncClient() as client:
        response = await client.post(
            settings.OVERPASS_BASE_URL,
            data={"data": query},
            timeout=45,
        )
        response.raise_for_status()
    elements = response.json().get("elements", [])

    results: list[dict] = []
    for elem in elements:
        coords = _element_coords(elem)
        if coords is None:
            continue
        tags = elem.get("tags", {})
        category = _classify(tags)
        if category is None:
            continue
        dist = _haversine(lat, lng, coords[0], coords[1])
        results.append({
            "category": category,
            "name": tags.get("name"),
            "distance_metres": round(dist, 1),
            "lat": coords[0],
            "lon": coords[1],
        })

    results.sort(key=lambda x: x["distance_metres"])
    return results
