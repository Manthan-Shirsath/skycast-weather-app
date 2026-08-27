"""
Centralized Weather Data Service Facade
Maintains backwards compatibility while delegating all data retrieval and ingestion
to the authoritative Central Weather Data Hub.
"""

from typing import Dict, Any, List, Optional, Tuple
from backend.app.services.weather_hub import (
    weather_hub,
    decode_weather_code,
    get_wind_direction_label,
    KEY_MAP_CITIES,
    WMO_WEATHER_MAP
)


class WeatherDataService:
    """
    Facade for backwards-compatible imports across existing routes and services.
    Delegates all operational weather access to the Central Weather Data Hub.
    """

    @staticmethod
    async def get_city_weather(city_name: str, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch normalized weather for a city through Central Weather Data Hub."""
        return await weather_hub.get_weather_for_city(city_name, force_refresh=force_refresh)

    @staticmethod
    async def get_map_weather_dataset(force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch centralized map weather dataset through Central Weather Data Hub."""
        return await weather_hub.get_map_weather_dataset(force_refresh=force_refresh)

    @staticmethod
    async def get_point_weather(lat: float, lon: float, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch normalized point weather for specific coordinates through Central Weather Data Hub."""
        return await weather_hub.get_point_weather(lat, lon, force_refresh=force_refresh)

    @staticmethod
    async def get_radar_metadata(force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch RainViewer radar metadata through Central Weather Data Hub."""
        return await weather_hub.get_radar_metadata(force_refresh=force_refresh)
