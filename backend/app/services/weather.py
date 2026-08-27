"""
Legacy weather.py service module.
Delegates all data requests to the Central Weather Data Hub.
"""

from typing import List, Dict, Any, Optional, Tuple
from backend.app.services.weather_hub import (
    weather_hub,
    decode_weather_code,
    get_wind_direction_label,
    KEY_MAP_CITIES as KEY_INDIAN_CITIES,
    WMO_WEATHER_MAP
)


async def get_map_weather_data() -> List[Dict[str, Any]]:
    """Retrieve map weather cities dataset from Central Weather Data Hub."""
    res = await weather_hub.get_map_weather_dataset()
    return res.get("cities", [])


async def get_point_weather_data(lat: float, lon: float) -> Dict[str, Any]:
    """Retrieve point weather from Central Weather Data Hub."""
    return await weather_hub.get_point_weather(lat, lon)
