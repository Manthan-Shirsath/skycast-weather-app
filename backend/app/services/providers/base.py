"""
Base Weather Provider Abstraction
Defines the standardized interface for all meteorological data providers (Open-Meteo, IMD, GFS, WRF, ECMWF).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


class BaseWeatherProvider(ABC):
    """Abstract Base Class for Weather Data Providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Unique identifier string for the provider (e.g. 'open_meteo', 'imd', 'gfs')."""
        pass

    @abstractmethod
    async def geocode_city(self, city_name: str) -> Optional[Dict[str, Any]]:
        """
        Geocode a location query string into standardized coordinates.
        Expected return format:
        {
            "name": str,
            "latitude": float,
            "longitude": float,
            "admin1": Optional[str],
            "country": Optional[str],
            "timezone": Optional[str]
        }
        """
        pass

    @abstractmethod
    async def fetch_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Fetch raw multi-parameter weather forecast (current, hourly, daily) for coordinates.
        """
        pass

    @abstractmethod
    async def fetch_batch_forecast(self, coords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Fetch raw forecasts for multiple coordinate pairs in an optimized batch call.
        """
        pass


class BaseRadarProvider(ABC):
    """Abstract Base Class for Radar Imagery & Metadata Providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def fetch_radar_metadata(self) -> Dict[str, Any]:
        """
        Fetch current radar timestamps, color palettes, and tile template URL.
        """
        pass
