"""
Configuration Management

Centralized settings management using Pydantic v2 Settings.
Loads environment variables with type validation and defaults.
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """
    DisasterShield backend settings.
    Loaded from environment variables or .env file.
    """
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=True)

    # ─────────────────────────────────────────
    # FastAPI Configuration
    # ─────────────────────────────────────────
    ENVIRONMENT: str = Field(default="development", description="Environment (development/staging/production)")
    DEBUG: bool = Field(default=True, description="Enable debug mode")
    API_HOST: str = Field(default="0.0.0.0", description="API server host")
    API_PORT: int = Field(default=8000, description="API server port")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FORMAT: str = Field(default="json", description="Log format (json/text)")

    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        description="CORS allowed origins (comma-separated)"
    )

    # ─────────────────────────────────────────
    # Database Configuration
    # ─────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="mysql+pymysql://root:password@localhost:3306/disaster_shield",
        description="MySQL database connection URL"
    )

    # ─────────────────────────────────────────
    # LLM Configuration
    # ─────────────────────────────────────────
    LLM_PROVIDER: str = Field(
        default="google",
        description="LLM provider (google/openai)"
    )
    GOOGLE_API_KEY: str = Field(default="", description="Google Generative AI API key")
    GOOGLE_MODEL_NAME: str = Field(default="gemini-1.5-pro", description="Google model name")
    
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key")
    OPENAI_MODEL_NAME: str = Field(default="gpt-4-turbo", description="OpenAI model name")

    # ─────────────────────────────────────────
    # External APIs
    # ─────────────────────────────────────────
    METEOSOURCE_API_KEY: str = Field(default="", description="Meteosource weather API key")
    METEOSOURCE_BASE_URL: str = Field(
        default="https://www.meteosource.com/api/v1",
        description="Meteosource API base URL"
    )
    
    NOMINATIM_BASE_URL: str = Field(
        default="https://nominatim.openstreetmap.org",
        description="Nominatim API base URL"
    )
    NOMINATIM_USER_AGENT: str = Field(
        default="DisasterShield/1.0",
        description="User agent for Nominatim reverse geocoding"
    )
    
    OPEN_ELEVATION_BASE_URL: str = Field(
        default="https://api.open-elevation.com/api/v1",
        description="Open-Elevation API base URL"
    )
    
    OPENTOPODATA_BASE_URL: str = Field(
        default="https://api.opentopodata.org/v1",
        description="OpenTopoData API base URL"
    )
    
    OVERPASS_BASE_URL: str = Field(
        default="https://overpass-api.de/api/interpreter",
        description="Overpass API base URL"
    )

    # ─────────────────────────────────────────
    # Weather Alert Thresholds
    # ─────────────────────────────────────────
    ALERT_RAIN_THRESHOLD_MM: float = Field(
        default=20.0,
        description="Rainfall threshold (mm/hr) for flood alerts"
    )
    ALERT_WIND_THRESHOLD_KMPH: float = Field(
        default=40.0,
        description="Wind speed threshold (kmph) for wind damage alerts"
    )

    # ─────────────────────────────────────────
    # Location Enrichment
    # ─────────────────────────────────────────
    OVERPASS_SEARCH_RADIUS_METRES: int = Field(
        default=10000,
        description="Search radius (metres) for Overpass amenity queries"
    )

    # ─────────────────────────────────────────
    # Scheduler Configuration
    # ─────────────────────────────────────────
    SCHEDULER_TIMEZONE: str = Field(default="Asia/Kolkata", description="Scheduler timezone")
    ALERT_BATCH_INTERVAL_HOURS: int = Field(default=1, description="Alert batch job interval in hours")
    LOCATION_REFRESH_INTERVAL_DAYS: int = Field(default=30, description="Location refresh interval in days")

    # ─────────────────────────────────────────
    # Rate Limiting
    # ─────────────────────────────────────────
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = Field(default=100, description="Rate limit requests per minute")

    # ─────────────────────────────────────────
    # Security
    # ─────────────────────────────────────────
    API_KEY_SECRET: str = Field(default="dev-secret-key", description="Secret key for signing")

    @field_validator("LLM_PROVIDER")
    @classmethod
    def validate_llm_provider(cls, v: str) -> str:
        if v not in ["google", "openai"]:
            raise ValueError("LLM_PROVIDER must be 'google' or 'openai'")
        return v

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


# Global settings instance
settings = Settings()
