from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from packages.core.schemas import BaseSchema


class LocationEnrichRequest(BaseSchema):
    shop_id: Optional[str] = Field(default=None, description="Shop UUID — omit for stateless enrichment")
    latitude: float = Field(description="Latitude coordinate")
    longitude: float = Field(description="Longitude coordinate")


class AmenityItem(BaseSchema):
    type: str = Field(description="Amenity category (hospital, police, fire_station, …)")
    name: Optional[str] = Field(default=None, description="OSM name tag")
    distance_metres: Optional[float] = Field(default=None, description="Haversine distance from shop")


class LocationEnrichResponse(BaseSchema):
    shop_id: str = Field(description="Shop UUID (empty string for stateless calls)")
    latitude: float
    longitude: float
    # Reverse-geocoded address (Nominatim)
    village: Optional[str] = None
    suburb: Optional[str] = None
    taluka: Optional[str] = None
    district: Optional[str] = None
    postcode: Optional[str] = None
    # Topographic (Open-Elevation + 4-point sampling)
    elevation_metres: float = Field(default=0.0)
    slope_percent: Optional[float] = Field(default=None, description="Percent grade (rise/run × 100)")
    aspect: Optional[str] = Field(default=None, description="Cardinal downslope direction (N/NE/E/…)")
    # Nearby infrastructure (Overpass)
    amenities: List[AmenityItem] = Field(default_factory=list)
    # Metadata
    batch_status: str = Field(default="COMPLETE")
    enriched_at: datetime = Field(default_factory=datetime.utcnow)
