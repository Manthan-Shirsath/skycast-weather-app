"""
Unit Tests for Central Weather Data Hub & Provider Abstraction
Validates:
1. BaseWeatherProvider abstraction compliance.
2. CanonicalWeatherDataset structure and legacy dictionary serialization.
3. WeatherDataHub centralized ingestion, deduplication, Redis caching, and stale fallback.
4. Batch map dataset generation through the hub.
"""

import pytest
import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional

from backend.app.services.providers.base import BaseWeatherProvider
from backend.app.models.canonical_weather import (
    CanonicalLocationMeta,
    CanonicalCurrentWeather,
    CanonicalHourlyItem,
    CanonicalDailyItem,
    CanonicalFreshnessMeta,
    CanonicalWeatherDataset
)
from backend.app.services.weather_hub import WeatherDataHub, decode_weather_code, get_wind_direction_label


class MockTestProvider(BaseWeatherProvider):
    """Test Mock Provider for Hub Integration Tests."""

    @property
    def provider_name(self) -> str:
        return "mock_test_provider"

    async def geocode_city(self, city_name: str) -> Optional[Dict[str, Any]]:
        if city_name.lower() == "invalidcity":
            return None
        return {
            "name": city_name.title(),
            "latitude": 18.5204,
            "longitude": 73.8567,
            "admin1": "Maharashtra",
            "country": "India"
        }

    async def fetch_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        return {
            "current": {
                "time": "2026-08-26T12:00:00Z",
                "temperature_2m": 28.5,
                "apparent_temperature": 30.0,
                "relative_humidity_2m": 65.0,
                "weather_code": 1,
                "wind_speed_10m": 14.0,
                "wind_direction_10m": 240.0,
                "wind_gusts_10m": 20.0,
                "surface_pressure": 1012.0,
                "precipitation": 0.0,
                "rain": 0.0,
                "cloud_cover": 30.0
            },
            "hourly": {
                "time": ["2026-08-26T12:00", "2026-08-26T13:00"],
                "temperature_2m": [28.5, 29.0],
                "apparent_temperature": [30.0, 30.5],
                "relative_humidity_2m": [65.0, 60.0],
                "dew_point_2m": [19.0, 18.5],
                "precipitation_probability": [10, 15],
                "precipitation": [0.0, 0.0],
                "weather_code": [1, 2],
                "surface_pressure": [1012.0, 1011.0],
                "cloud_cover": [30.0, 35.0],
                "visibility": [10000.0, 10000.0],
                "wind_speed_10m": [14.0, 15.0],
                "uv_index": [6.0, 5.5]
            },
            "daily": {
                "time": ["2026-08-26", "2026-08-27"],
                "weather_code": [1, 2],
                "temperature_2m_max": [31.0, 32.0],
                "temperature_2m_min": [21.0, 22.0],
                "precipitation_probability_max": [25, 30],
                "precipitation_sum": [0.0, 1.2],
                "wind_speed_10m_max": [18.0, 16.0],
                "wind_gusts_10m_max": [25.0, 22.0],
                "uv_index_max": [7.0, 8.0],
                "sunrise": ["2026-08-26T06:10", "2026-08-27T06:10"],
                "sunset": ["2026-08-26T18:45", "2026-08-27T18:44"]
            }
        }

    async def fetch_batch_forecast(self, coords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for _ in coords:
            results.append(await self.fetch_forecast(18.52, 73.85))
        return results


@pytest.mark.anyio
async def test_canonical_schema_serialization():
    """Verify CanonicalWeatherDataset serializes into exact legacy shape expected by frontend."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    canonical = CanonicalWeatherDataset(
        location=CanonicalLocationMeta(
            city="Pune",
            display_location="Pune, Maharashtra, India",
            region="Maharashtra",
            country="India",
            latitude=18.52,
            longitude=73.85
        ),
        current=CanonicalCurrentWeather(
            temperature_c=27.4,
            feels_like_c=28.1,
            humidity_pct=62.0,
            dew_point_c=18.0,
            precipitation_mm=0.0,
            rain_mm=0.0,
            rain_probability_pct=20.0,
            wind_speed_kmh=12.0,
            wind_direction_deg=220.0,
            wind_direction_label="SW",
            wind_gusts_kmh=16.0,
            cloud_cover_pct=35.0,
            pressure_hpa=1013.0,
            visibility_km=10.0,
            uv_index=6.0,
            weather_code=1,
            condition="Mainly Clear",
            icon="sun"
        ),
        hourly=[
            CanonicalHourlyItem(
                time="12:00",
                hour=12,
                temperature_c=27.4,
                feels_like_c=28.1,
                humidity_pct=62.0,
                precipitation_mm=0.0,
                rain_probability_pct=20.0,
                wind_speed_kmh=12.0,
                wind_direction_label="SW",
                cloud_cover_pct=35.0,
                pressure_hpa=1013.0,
                visibility_km=10.0,
                uv_index=6.0,
                weather_code=1,
                condition="Mainly Clear",
                icon="sun"
            )
        ],
        daily=[
            CanonicalDailyItem(
                day="Today",
                date="Aug 26",
                high_c=31.0,
                low_c=22.0,
                condition="Mainly Clear",
                icon="sun",
                weather_code=1,
                rain_probability_pct=25.0,
                precipitation_sum_mm=0.0,
                wind_speed_max_kmh=18.0,
                wind_gusts_max_kmh=24.0,
                uv_index_max=7.0,
                sunrise="06:10",
                sunset="18:45"
            )
        ],
        freshness=CanonicalFreshnessMeta(
            provider="mock_test_provider",
            fetched_at=now_iso,
            observed_at=now_iso,
            stale=False
        )
    )

    data = canonical.to_legacy_dict()
    assert data["city"] == "Pune"
    assert data["tempC"] == 27
    assert data["feelsLikeC"] == 28
    assert data["condition"] == "Mainly Clear"
    assert data["details"]["windDirection"] == "SW"
    assert data["details"]["pressureHpa"] == 1013
    assert data["provider"] == "mock_test_provider"
    assert data["stale"] is False
    assert len(data["hourly"]) == 1
    assert len(data["daily"]) == 1


@pytest.mark.anyio
async def test_weather_hub_ingestion_and_caching():
    """Verify WeatherDataHub ingests from provider, normalizes, and serves from cache."""
    provider = MockTestProvider()
    hub = WeatherDataHub(provider)

    with patch("backend.app.services.weather_hub.cache") as mock_cache:
        # 1. First call: Cache miss -> Ingests from provider
        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock()

        result = await hub.get_weather_for_city("Pune")
        assert result["city"] == "Pune"
        assert result["tempC"] == 29 or result["tempC"] == 28
        assert result["provider"] == "mock_test_provider"
        assert mock_cache.set.called

        # 2. Second call: Cache hit -> Serves cached data without calling provider geocode
        mock_cache.get = AsyncMock(return_value=result)
        provider.geocode_city = AsyncMock()

        cached_result = await hub.get_weather_for_city("Pune")
        assert cached_result == result
        assert not provider.geocode_city.called


@pytest.mark.anyio
async def test_weather_hub_stale_fallback_on_provider_error():
    """Verify WeatherDataHub returns stale cached snapshot when provider raises network exception."""
    provider = MockTestProvider()
    hub = WeatherDataHub(provider)

    with patch("backend.app.services.weather_hub.cache") as mock_cache:
        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.get_stale = AsyncMock(return_value={"city": "Pune", "tempC": 26, "stale": False})

        # Simulate provider failure
        provider.geocode_city = AsyncMock(side_effect=Exception("Upstream timeout"))

        result = await hub.get_weather_for_city("Pune")
        assert result["city"] == "Pune"
        assert result["stale"] is True


@pytest.mark.anyio
async def test_weather_hub_map_batch_ingestion():
    """Verify WeatherDataHub map dataset generation aggregates all key cities."""
    provider = MockTestProvider()
    hub = WeatherDataHub(provider)

    with patch("backend.app.services.weather_hub.cache") as mock_cache:
        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock()

        map_data = await hub.get_map_weather_dataset()
        assert "cities" in map_data
        assert map_data["count"] > 10
        assert map_data["cities"][0]["name"] == "Pune"
        assert map_data["provider"] == "mock_test_provider"


@pytest.mark.anyio
async def test_weather_hub_invalid_city_raises_value_error():
    """Verify WeatherDataHub raises ValueError for unknown/unresolvable location."""
    provider = MockTestProvider()
    hub = WeatherDataHub(provider)

    with patch("backend.app.services.weather_hub.cache") as mock_cache:
        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.get_stale = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="Location 'InvalidCity' not found"):
            await hub.get_weather_for_city("InvalidCity")
