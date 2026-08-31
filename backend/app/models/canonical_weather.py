"""
Canonical Internal Weather Schema
Defines the standardized meteorological data structures produced by the Central Weather Data Hub.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class CanonicalLocationMeta(BaseModel):
    city: str
    display_location: str
    region: Optional[str] = None
    country: Optional[str] = None
    latitude: float
    longitude: float
    timezone: Optional[str] = "auto"


class CanonicalCurrentWeather(BaseModel):
    temperature_c: float
    feels_like_c: float
    humidity_pct: float
    dew_point_c: Optional[float] = None
    precipitation_mm: float = 0.0
    rain_mm: float = 0.0
    precipitation_probability: float = 0.0
    rain_probability_pct: float = 0.0  # legacy compatibility
    wind_speed_kmh: float
    wind_direction_deg: float = 0.0
    wind_direction_label: str = "N"
    wind_gusts_kmh: Optional[float] = None
    cloud_cover_pct: float = 0.0
    pressure_hpa: float = 1013.0
    visibility_km: float = 10.0
    uv_index: float = 0.0
    weather_code: int = 0
    condition: str = "Clear"
    icon: str = "sun"


class CanonicalHourlyItem(BaseModel):
    time: str
    hour: int
    temperature_c: float
    feels_like_c: float
    humidity_pct: float
    precipitation_mm: float = 0.0
    precipitation_probability: float = 0.0
    rain_probability_pct: float = 0.0  # legacy compatibility
    wind_speed_kmh: float
    wind_direction_label: str = "N"
    cloud_cover_pct: float = 0.0
    pressure_hpa: float = 1013.0
    visibility_km: float = 10.0
    uv_index: float = 0.0
    weather_code: int = 0
    condition: str = "Clear"
    icon: str = "sun"


class CanonicalDailyItem(BaseModel):
    day: str
    date: str
    date_iso: Optional[str] = None
    high_c: float
    low_c: float
    condition: str
    icon: str
    weather_code: int = 0
    daily_precipitation_probability: float = 0.0
    rain_probability_pct: float = 0.0  # legacy compatibility
    precipitation_sum_mm: float = 0.0
    wind_speed_max_kmh: float = 0.0
    wind_gusts_max_kmh: float = 0.0
    uv_index_max: float = 0.0
    sunrise: str = "06:00"
    sunset: str = "18:30"


class CanonicalFreshnessMeta(BaseModel):
    provider: str = "open_meteo"
    source_provenance: str = "open-meteo"  # "open-meteo" | "imd-wis2" | "blended"
    nwp_source: str = "gfs_seamless"
    nwp_model: str = "NOAA GFS (Global Forecast System)"
    fetched_at: str
    observed_at: str
    stale: bool = False
    ttl_seconds: int = 300


class CanonicalWeatherDataset(BaseModel):
    location: CanonicalLocationMeta
    current: CanonicalCurrentWeather
    hourly: List[CanonicalHourlyItem]
    daily: List[CanonicalDailyItem]
    freshness: CanonicalFreshnessMeta
    alerts: List[Dict[str, Any]] = Field(default_factory=list)
    hourly_series: List[Dict[str, Any]] = Field(default_factory=list)

    def to_legacy_dict(self) -> Dict[str, Any]:
        """
        Serializes dataset to exact dictionary shape expected by existing frontend & services.
        Ensures 100% backwards compatibility and exposes canonical precipitation fields.
        """
        curr_prob = round(self.current.precipitation_probability or self.current.rain_probability_pct)
        return {
            "city": self.location.city,
            "region": self.location.region or "",
            "country": self.location.country or "",
            "displayLocation": self.location.display_location,
            "latitude": self.location.latitude,
            "longitude": self.location.longitude,
            "tempC": round(self.current.temperature_c),
            "tempF": round((self.current.temperature_c * 9 / 5) + 32),
            "feelsLikeC": round(self.current.feels_like_c),
            "feelsLikeF": round((self.current.feels_like_c * 9 / 5) + 32),
            "condition": self.current.condition,
            "icon": self.current.icon,
            "weather_code": self.current.weather_code,
            "highC": round(self.daily[0].high_c) if self.daily else round(self.current.temperature_c),
            "lowC": round(self.daily[0].low_c) if self.daily else round(self.current.temperature_c),
            "humidity": round(self.current.humidity_pct),
            "windSpeedKmh": round(self.current.wind_speed_kmh),
            "windSpeedMph": round(self.current.wind_speed_kmh * 0.621371),
            "precipitation_probability": curr_prob,
            "insight": {
                "rainChance": curr_prob,
                "summary": f"{self.current.condition} conditions. Rain probability is {curr_prob}%."
            },
            "details": {
                "pressureHpa": round(self.current.pressure_hpa),
                "visibilityKm": round(self.current.visibility_km, 1),
                "uvIndex": round(self.current.uv_index, 1),
                "dewPointC": round(self.current.dew_point_c) if self.current.dew_point_c is not None else None,
                "windGustsKmh": round(self.current.wind_gusts_kmh) if self.current.wind_gusts_kmh is not None else None,
                "windDirection": self.current.wind_direction_label,
                "windDirectionDeg": self.current.wind_direction_deg,
                "cloudCoverPct": round(self.current.cloud_cover_pct),
                "precipitationMm": round(self.current.precipitation_mm, 1),
                "rainMm": round(self.current.rain_mm, 1)
            },
            "hourly": [
                {
                    "time": h.time,
                    "hour": h.hour,
                    "tempC": round(h.temperature_c),
                    "tempF": round((h.temperature_c * 9 / 5) + 32),
                    "feelsLikeC": round(h.feels_like_c),
                    "condition": h.condition,
                    "icon": h.icon,
                    "weather_code": h.weather_code,
                    "precipitation_probability": round(h.precipitation_probability or h.rain_probability_pct),
                    "rainChance": round(h.precipitation_probability or h.rain_probability_pct),
                    "precipitation": round(h.precipitation_mm, 1),
                    "windSpeed": round(h.wind_speed_kmh),
                    "windDirection": h.wind_direction_label,
                    "cloudCover": round(h.cloud_cover_pct),
                    "humidity": round(h.humidity_pct),
                    "pressure": round(h.pressure_hpa),
                    "visibility": round(h.visibility_km, 1),
                    "uvIndex": round(h.uv_index, 1)
                }
                for h in self.hourly
            ],
            "daily": [
                {
                    "day": d.day,
                    "date": d.date,
                    "date_iso": d.date_iso,
                    "condition": d.condition,
                    "icon": d.icon,
                    "weather_code": d.weather_code,
                    "highC": round(d.high_c),
                    "highF": round((d.high_c * 9 / 5) + 32),
                    "lowC": round(d.low_c),
                    "lowF": round((d.low_c * 9 / 5) + 32),
                    "daily_precipitation_probability": round(d.daily_precipitation_probability or d.rain_probability_pct),
                    "precipitation_probability": round(d.daily_precipitation_probability or d.rain_probability_pct),
                    "rainChance": round(d.daily_precipitation_probability or d.rain_probability_pct),
                    "precipitationSum": round(d.precipitation_sum_mm, 1),
                    "windSpeedMax": round(d.wind_speed_max_kmh),
                    "windGustsMax": round(d.wind_gusts_max_kmh),
                    "uvIndexMax": round(d.uv_index_max, 1),
                    "sunrise": d.sunrise,
                    "sunset": d.sunset
                }
                for d in self.daily
            ],
            "hourlySeries": self.hourly_series,
            "provider": self.freshness.provider,

            "sourceProvenance": self.freshness.source_provenance,
            "nwpSource": self.freshness.nwp_source,
            "nwpModel": self.freshness.nwp_model,
            "modelSource": self.freshness.nwp_source,
            "fetchedAt": self.freshness.fetched_at,
            "observedAt": self.freshness.observed_at,
            "stale": self.freshness.stale,
            "alerts": self.alerts
        }
