import asyncio
import logging
from typing import Dict, Any, List, Optional
import httpx
from backend.app.services.providers.base import BaseWeatherProvider

logger = logging.getLogger("skycast.provider.open_meteo")

GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast"


class OpenMeteoProvider(BaseWeatherProvider):
    """Open-Meteo Weather Data Provider Implementation with Retry & Rate-Limit Handling."""

    @property
    def provider_name(self) -> str:
        return "open_meteo"

    async def _get_with_retry(self, url: str, timeout: float = 12.0, max_retries: int = 2) -> httpx.Response:
        """Execute GET request with exponential backoff on HTTP 429 Rate Limit responses."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            for attempt in range(max_retries + 1):
                try:
                    res = await client.get(url)
                    if res.status_code == 429:
                        if attempt < max_retries:
                            backoff = (attempt + 1) * 1.5
                            logger.warning("⚠️ [OPEN-METEO 429] Rate limited. Retrying in %.1fs (Attempt %d/%d)...", backoff, attempt + 1, max_retries)
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            logger.error("❌ [OPEN-METEO 429] Rate limit hit and max retries exceeded.")
                    res.raise_for_status()
                    return res
                except httpx.HTTPStatusError as err:
                    if err.response.status_code == 429 and attempt < max_retries:
                        backoff = (attempt + 1) * 1.5
                        await asyncio.sleep(backoff)
                        continue
                    raise err
                except Exception as exc:
                    if attempt < max_retries:
                        await asyncio.sleep(1.0)
                        continue
                    raise exc
            raise RuntimeError("Request failed after retries")

    async def geocode_city(self, city_name: str) -> Optional[Dict[str, Any]]:
        """Query Open-Meteo Geocoding API."""
        logger.info("🌐 [PROVIDER CALL] Open-Meteo Geocode for '%s'", city_name)
        url = f"{GEOCODING_API_URL}?name={city_name}&count=1&language=en&format=json"

        res = await self._get_with_retry(url, timeout=10.0)
        data = res.json()

        results = data.get("results")
        if not results or len(results) == 0:
            return None
        return results[0]

    async def fetch_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        """Query Open-Meteo Forecast API for full current, hourly, and daily metrics using explicit GFS NWP model."""
        logger.info("🌐 [PROVIDER CALL] Open-Meteo GFS Forecast for (%f, %f)", lat, lon)
        url = (
            f"{FORECAST_API_URL}"
            f"?latitude={lat}&longitude={lon}"
            f"&models=gfs_seamless"
            f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,pressure_msl,precipitation,cloud_cover,rain"
            f"&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,surface_pressure,pressure_msl,cloud_cover,visibility,wind_speed_10m,wind_gusts_10m,uv_index"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,precipitation_hours,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max"
            f"&timezone=auto"
        )

        res = await self._get_with_retry(url, timeout=12.0)
        return res.json()

    async def fetch_batch_forecast(self, coords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch query multiple coordinates in a single Open-Meteo request using explicit GFS NWP model."""
        logger.info("🌐 [PROVIDER CALL] Open-Meteo Multi-location GFS batch (%d locations)", len(coords))
        lats = ",".join(str(c["lat"]) for c in coords)
        lons = ",".join(str(c["lon"]) for c in coords)

        url = (
            f"{FORECAST_API_URL}"
            f"?latitude={lats}&longitude={lons}"
            f"&models=gfs_seamless"
            f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,pressure_msl,precipitation,cloud_cover,rain"
            f"&daily=precipitation_probability_max,precipitation_sum,wind_gusts_10m_max"
            f"&timezone=auto"
        )

        res = await self._get_with_retry(url, timeout=14.0)
        raw = res.json()
        return raw if isinstance(raw, list) else [raw]


# Singleton instance
open_meteo_provider = OpenMeteoProvider()

# Backwards-compatible aliases
async def geocode_city_raw(city_name: str) -> Optional[Dict[str, Any]]:
    return await open_meteo_provider.geocode_city(city_name)

async def fetch_forecast_raw(lat: float, lon: float) -> Dict[str, Any]:
    return await open_meteo_provider.fetch_forecast(lat, lon)

async def fetch_batch_forecast_raw(coords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return await open_meteo_provider.fetch_batch_forecast(coords)
