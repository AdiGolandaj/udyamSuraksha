import httpx
from packages.core.config import settings
from packages.core.logger import get_logger

logger = get_logger(__name__)

_HEADERS = {
    "User-Agent": f"{settings.NOMINATIM_USER_AGENT} (contact@disastershield.in)"
}


async def reverse_geocode(lat: float, lng: float) -> dict:
    """
    Reverse-geocode a coordinate via Nominatim.

    Returns a dict with keys: place_id, village, suburb, taluka, district, postcode.
    All values except place_id may be None if Nominatim has no data for that field.
    """
    url = f"{settings.NOMINATIM_BASE_URL}/reverse"
    params = {"lat": lat, "lon": lng, "format": "json", "addressdetails": 1}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, headers=_HEADERS, timeout=10)
        response.raise_for_status()
    return _parse(response.json())


def _parse(data: dict) -> dict:
    addr = data.get("address", {})
    return {
        "place_id": str(data.get("place_id", "")),
        # village: prefer village > town > hamlet > municipality
        "village": (
            addr.get("village")
            or addr.get("town")
            or addr.get("hamlet")
            or addr.get("municipality")
        ),
        "suburb": addr.get("suburb") or addr.get("neighbourhood"),
        # taluka: OSM uses "county" for Indian talukas
        "taluka": addr.get("county") or addr.get("county_council"),
        "district": addr.get("state_district") or addr.get("district"),
        "postcode": addr.get("postcode"),
    }
