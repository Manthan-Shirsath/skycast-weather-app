"""
Legacy radar.py service module.
Delegates radar metadata queries to the Central Weather Data Hub.
"""

from typing import Dict, Any
from backend.app.services.weather_hub import weather_hub


async def get_radar_metadata() -> Dict[str, Any]:
    """Retrieve radar metadata from Central Weather Data Hub."""
    return await weather_hub.get_radar_metadata()
