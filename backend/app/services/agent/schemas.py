"""
Agent Schemas & Tool Input/Output Validation Models
"""

from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field


# ==============================================================================
# Tool Input Schemas
# ==============================================================================

class LocationSearchArgs(BaseModel):
    query: str = Field(..., description="The natural language location name or city to search/geocode (e.g. 'Tokyo', 'London', 'Pune', 'Baner Pune')")


class CurrentWeatherArgs(BaseModel):
    location: str = Field(..., description="City or canonical location name (e.g. 'Pune', 'Mumbai', 'Tokyo')")
    lat: Optional[float] = Field(None, description="Optional latitude coordinate if known")
    lon: Optional[float] = Field(None, description="Optional longitude coordinate if known")


class ForecastArgs(BaseModel):
    location: str = Field(..., description="City or canonical location name")
    days: Optional[int] = Field(5, description="Number of forecast days to retrieve (1 to 7)")
    hourly: Optional[bool] = Field(True, description="Whether to include hourly projections for next 24 hours")


class RiskArgs(BaseModel):
    location: str = Field(..., description="City or location name to evaluate Skycast meteorological risk for")


class AlertsArgs(BaseModel):
    location: Optional[str] = Field(None, description="Optional city name to filter active weather warnings for; if omitted, returns all active alerts")


class HistoricalArgs(BaseModel):
    location: str = Field(..., description="City name to fetch real recorded historical observation snapshots for")
    range_days: Optional[int] = Field(7, description="Number of days of history to inspect (1 to 30)")
    metric: Optional[str] = Field(None, description="Specific metric to isolate (e.g. 'temperature', 'precipitation', 'wind', 'humidity')")


class TrendsArgs(BaseModel):
    location: str = Field(..., description="Primary city name to retrieve statistical trend analytics for")
    range: Optional[str] = Field("24h", description="Time window for trends: '24h', '7d', or '30d'")
    compare_with: Optional[str] = Field(None, description="Optional secondary city for side-by-side trend comparison")


class MapWeatherArgs(BaseModel):
    pass


class FreshnessArgs(BaseModel):
    location: str = Field(..., description="City or location name to inspect data age and cache status for")


class AgricultureArgs(BaseModel):
    location: str = Field(..., description="City or location name for agricultural advisory")
    crop: Optional[str] = Field("Cotton", description="Crop name (e.g. Cotton, Sugarcane, Wheat, Rice, Soybean, Tomato, Onion, Groundnut)")
    growth_stage: Optional[str] = Field("Flowering", description="Growth stage (e.g. Sowing, Vegetative, Flowering, Fruiting, Harvesting)")


class RecommendationArgs(BaseModel):
    location: str = Field(..., description="City or location name for practical recommendation")
    activity: Optional[str] = Field("all", description="Activity name ('all', 'umbrella', 'jacket', 'run', 'outdoor_event', 'travel', 'drying_clothes')")


# ==============================================================================
# Tool Execution Output Envelope
# ==============================================================================

class ToolExecutionResult(BaseModel):
    tool: str
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


# ==============================================================================
# UI Response Card & Source Models
# ==============================================================================

SUPPORTED_CARD_TYPES = {
    "text",
    "current_weather",
    "forecast",
    "risk",
    "alert",
    "historical",
    "comparison",
    "location",
    "data_status",
    "agriculture",
    "recommendation"
}

class CardItem(BaseModel):
    type: str = Field(..., description="Controlled card type: 'current_weather', 'forecast', 'risk', 'alert', 'historical', 'comparison', 'location', 'data_status'")
    data: Dict[str, Any] = Field(default_factory=dict)


class SourceItem(BaseModel):
    type: str = "central_weather_data"
    timestamp: str
    provider: Optional[str] = "open_meteo"


# ==============================================================================
# Final Agent Response (100% Backward Compatible + Rich Structure)
# ==============================================================================

class AgentResponse(BaseModel):
    reply: str
    city: str
    timestamp: str
    session_id: Optional[str] = None
    cards: List[CardItem] = Field(default_factory=list)
    sources: List[SourceItem] = Field(default_factory=list)
    data_status: str = "fresh"  # "fresh" | "stale" | "degraded"
