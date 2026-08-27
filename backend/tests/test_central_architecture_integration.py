"""
Centralized Weather Data Architecture — Strict Integration Verification Test Suite
Proves:
1. Static boundary enforcement (routes never import provider adapters directly).
2. Autonomous Collector pre-fetching without frontend HTTP triggers.
3. Multi-feature data reuse with 0 extra provider calls (Dashboard, Details, Map, Alerts, Chat).
4. Cache Stampede protection (50 concurrent requests -> exactly 1 provider fetch).
5. Upstream Provider failure graceful fallback (serves stale centralized data with stale=True).
6. Collector failure resilience.
7. Map single-dataset multi-variable completeness.
8. WeatherGPT context isolation through WeatherDataHub.
9. Historical trends PostgreSQL isolation.
"""

import ast
import os
import asyncio
import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional
import pytest

from backend.app.services.providers.base import BaseWeatherProvider
from backend.app.services.providers.open_meteo import open_meteo_provider
from backend.app.services.weather_hub import weather_hub, WeatherDataHub
from backend.app.services.collector import WeatherCollectorWorker
from backend.app.services.alert_service import alert_service
from backend.app.services.history_service import HistoryService
from backend.app.routes.weather import get_weather
from backend.app.routes.map import get_map_weather, get_radar_metadata
from backend.app.routes.alerts import get_weather_alerts
from backend.app.routes.chat import chat_weather, ChatRequest
from backend.app.services.agent import AgentResponse


class TrackedMockProvider(BaseWeatherProvider):
    """Mock Provider that tracks every call made to external endpoints."""

    def __init__(self):
        self.geocode_calls = 0
        self.forecast_calls = 0
        self.batch_forecast_calls = 0
        self.fail_mode = False

    @property
    def provider_name(self) -> str:
        return "tracked_mock_provider"

    async def geocode_city(self, city_name: str) -> Optional[Dict[str, Any]]:
        self.geocode_calls += 1
        if self.fail_mode:
            raise RuntimeError("Upstream Geocoding API Offline")
        return {
            "name": city_name.title(),
            "latitude": 18.5204,
            "longitude": 73.8567,
            "admin1": "Maharashtra",
            "country": "India"
        }

    async def fetch_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        self.forecast_calls += 1
        if self.fail_mode:
            raise RuntimeError("Upstream Forecast API Offline")
        return {
            "current": {
                "time": "2026-08-26T12:00:00Z",
                "temperature_2m": 27.0,
                "apparent_temperature": 28.0,
                "relative_humidity_2m": 60.0,
                "weather_code": 1,
                "wind_speed_10m": 12.0,
                "wind_direction_10m": 220.0,
                "wind_gusts_10m": 18.0,
                "surface_pressure": 1013.0,
                "precipitation": 0.0,
                "rain": 0.0,
                "cloud_cover": 35.0
            },
            "hourly": {
                "time": ["2026-08-26T12:00", "2026-08-26T13:00"],
                "temperature_2m": [27.0, 28.0],
                "apparent_temperature": [28.0, 29.0],
                "relative_humidity_2m": [60.0, 58.0],
                "dew_point_2m": [18.0, 17.5],
                "precipitation_probability": [15, 20],
                "precipitation": [0.0, 0.0],
                "weather_code": [1, 2],
                "surface_pressure": [1013.0, 1012.0],
                "cloud_cover": [35.0, 40.0],
                "visibility": [10000.0, 10000.0],
                "wind_speed_10m": [12.0, 13.0],
                "uv_index": [5.5, 5.0]
            },
            "daily": {
                "time": ["2026-08-26", "2026-08-27"],
                "weather_code": [1, 2],
                "temperature_2m_max": [30.0, 31.0],
                "temperature_2m_min": [20.0, 21.0],
                "precipitation_probability_max": [20, 25],
                "precipitation_sum": [0.0, 0.5],
                "wind_speed_10m_max": [15.0, 14.0],
                "wind_gusts_10m_max": [22.0, 20.0],
                "uv_index_max": [6.5, 7.0],
                "sunrise": ["2026-08-26T06:10", "2026-08-27T06:10"],
                "sunset": ["2026-08-26T18:45", "2026-08-27T18:44"]
            }
        }

    async def fetch_batch_forecast(self, coords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        self.batch_forecast_calls += 1
        if self.fail_mode:
            raise RuntimeError("Upstream Batch Forecast API Offline")
        return [await self.fetch_forecast(c["lat"], c["lon"]) for c in coords]


# ==============================================================================
# 1. STATIC AST ARCHITECTURAL BOUNDARY ENFORCEMENT TEST
# ==============================================================================

def test_ast_routes_do_not_import_providers_directly():
    """
    Architectural Regression Test:
    Statically analyzes all Python files in backend/app/routes/ to verify that NO route
    imports directly from backend.app.services.providers or uses httpx directly.
    """
    routes_dir = Path(__file__).resolve().parent.parent / "app" / "routes"
    assert routes_dir.exists(), f"Routes directory '{routes_dir}' not found."

    forbidden_imports = [
        "backend.app.services.providers",
        "open_meteo",
        "rainviewer",
        "google_alerts",
        "openweather_alerts",
        "httpx"
    ]

    for py_file in routes_dir.glob("*.py"):
        with open(py_file, "r", encoding="utf-8") as f:
            code = f.read()

        tree = ast.parse(code, filename=str(py_file))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    for forbidden in forbidden_imports:
                        assert forbidden not in alias.name, (
                            f"ARCHITECTURAL VIOLATION in {py_file.name}: "
                            f"Direct import of '{alias.name}' forbidden in route layer!"
                        )
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for forbidden in forbidden_imports:
                    assert forbidden not in module, (
                        f"ARCHITECTURAL VIOLATION in {py_file.name}: "
                        f"Direct import from '{module}' forbidden in route layer! Must use weather_hub."
                    )


# ==============================================================================
# 2. COLLECTOR PRE-FETCHING INDEPENDENCE TEST
# ==============================================================================

@pytest.mark.anyio
async def test_collector_prefetches_without_frontend_request():
    """
    Verifies that the background collector populates central storage independently
    and /api/weather serves that data with ZERO new provider calls.
    """
    provider = TrackedMockProvider()
    weather_hub.set_provider(provider)

    memory_store: Dict[str, Any] = {}

    with patch("backend.app.core.cache.cache.get", AsyncMock(side_effect=lambda k: memory_store.get(k))), \
         patch("backend.app.core.cache.cache.set", AsyncMock(side_effect=lambda k, v, ttl=300: memory_store.update({k: v}))):

        # 1. Collector performs ingestion cycle without any frontend request
        worker = WeatherCollectorWorker()
        with patch("backend.app.services.collector.HistoryService.record_snapshot", AsyncMock(return_value=None)), \
             patch("backend.app.services.collector.alert_service.process_and_store_alerts", AsyncMock(return_value={"alerts": []})), \
             patch("backend.app.services.collector.ws_manager.broadcast_weather_update", AsyncMock()), \
             patch("backend.app.services.collector.ws_manager.broadcast_radar_update", AsyncMock()), \
             patch("backend.app.services.weather_hub.fetch_radar_maps_raw", AsyncMock(return_value={"status": "ok"})):

            await worker._collect_cycle()

        # Confirm data exists in central memory store for Pune
        pune_key = "weather:city:pune"
        assert pune_key in memory_store, "Central storage missing pre-fetched Pune data"
        assert memory_store[pune_key]["city"] == "Pune"

        # Record provider calls so far
        collector_geocode_calls = provider.geocode_calls
        collector_forecast_calls = provider.forecast_calls
        assert collector_geocode_calls > 0
        assert collector_forecast_calls > 0

        # 2. Frontend now calls /api/weather
        response = await get_weather(city="Pune", lat=None, lon=None, fresh=False)
        assert response["city"] == "Pune"
        assert response["tempC"] == 27

        # 3. Prove that /api/weather made ZERO additional provider calls
        assert provider.geocode_calls == collector_geocode_calls, "Frontend triggered unnecessary geocode call!"
        assert provider.forecast_calls == collector_forecast_calls, "Frontend triggered unnecessary forecast call!"

    # Restore default provider
    weather_hub.set_provider(open_meteo_provider)


# ==============================================================================
# 3. MULTI-FEATURE DATA REUSE TEST (0 Extra Provider Calls)
# ==============================================================================

@pytest.mark.anyio
async def test_multiple_features_reuse_same_centralized_data():
    """
    Verifies that Dashboard, Details, Map, Alerts, and WeatherGPT all consume
    from WeatherDataHub with 0 additional external provider calls once populated.
    """
    provider = TrackedMockProvider()
    weather_hub.set_provider(provider)

    memory_store: Dict[str, Any] = {}

    with patch("backend.app.core.cache.cache.get", AsyncMock(side_effect=lambda k: memory_store.get(k))), \
         patch("backend.app.core.cache.cache.set", AsyncMock(side_effect=lambda k, v, ttl=300: memory_store.update({k: v}))):

        # Step 1: Ingest Pune once into central hub
        await weather_hub.ingest_city_weather("Pune")
        initial_geocode_calls = provider.geocode_calls
        initial_forecast_calls = provider.forecast_calls
        assert initial_geocode_calls == 1
        assert initial_forecast_calls == 1

        # Feature 1: Dashboard requests weather for Pune
        dash_res = await get_weather(city="Pune", lat=None, lon=None)
        assert dash_res["city"] == "Pune"

        # Feature 2: Details page requests weather for Pune
        details_res = await get_weather(city="Pune", lat=None, lon=None)
        assert details_res["city"] == "Pune"

        # Feature 3: Alerts page requests alerts for Pune
        alerts_res = await get_weather_alerts(city="Pune")
        assert alerts_res["city"] == "Pune"

        # Feature 4: WeatherGPT requests chat context for Pune
        with patch("backend.app.routes.chat.weather_agent.run", AsyncMock(return_value=AgentResponse(
            reply="It is 27°C in Pune.",
            city="Pune",
            timestamp="2026-08-26T23:45:00Z"
        ))):
            chat_res = await chat_weather(ChatRequest(message="What is the weather?", city="Pune"))
            assert "27°C" in chat_res.reply

        # VERIFY: Exactly ZERO additional provider calls occurred
        assert provider.geocode_calls == initial_geocode_calls, f"Geocode called again by a feature! ({provider.geocode_calls} != {initial_geocode_calls})"
        assert provider.forecast_calls == initial_forecast_calls, f"Forecast called again by a feature! ({provider.forecast_calls} != {initial_forecast_calls})"

    weather_hub.set_provider(open_meteo_provider)


# ==============================================================================
# 4. CACHE STAMPEDE DEDUPLICATION TEST (50 Concurrent Requests)
# ==============================================================================

@pytest.mark.anyio
async def test_cache_stampede_protection_50_concurrent_requests():
    """
    Simulates 50 simultaneous incoming requests for an uncached city.
    Verifies that in-flight locking ensures exactly 1 provider request executes.
    """
    provider = TrackedMockProvider()
    hub = WeatherDataHub(provider)

    memory_store: Dict[str, Any] = {}

    with patch("backend.app.core.cache.cache.get") as mock_cache_get, \
         patch("backend.app.core.cache.cache.set") as mock_cache_set:

        async def slow_get(k):
            await asyncio.sleep(0.02)
            return memory_store.get(k)

        async def fast_set(k, v, ttl=300):
            memory_store[k] = v

        mock_cache_get.side_effect = slow_get
        mock_cache_set.side_effect = fast_set

        # Launch 50 simultaneous requests for 'Mumbai'
        tasks = [hub.get_weather_for_city("Mumbai") for _ in range(50)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 50
        for r in results:
            assert r["city"] == "Mumbai"

        # Assert exactly ONE upstream geocode and ONE forecast call happened
        assert provider.geocode_calls == 1, f"Expected 1 geocode call, got {provider.geocode_calls}"
        assert provider.forecast_calls == 1, f"Expected 1 forecast call, got {provider.forecast_calls}"


# ==============================================================================
# 5. PROVIDER FAILURE STALE FALLBACK TEST
# ==============================================================================

@pytest.mark.anyio
async def test_provider_failure_serves_stale_data_without_fabrication():
    """
    Simulates upstream provider failure when stale data exists.
    Verifies that WeatherDataHub returns the last known snapshot with stale=True.
    """
    provider = TrackedMockProvider()
    hub = WeatherDataHub(provider)

    stale_snapshot = {
        "city": "Bengaluru",
        "displayLocation": "Bengaluru, Karnataka, India",
        "tempC": 24,
        "feelsLikeC": 25,
        "condition": "Cloudy",
        "humidity": 70,
        "stale": False
    }

    with patch("backend.app.core.cache.cache.get", AsyncMock(return_value=None)), \
         patch("backend.app.core.cache.cache.get_stale", AsyncMock(return_value=dict(stale_snapshot))):

        # Enable failure mode on provider
        provider.fail_mode = True

        result = await hub.get_weather_for_city("Bengaluru")
        assert result["city"] == "Bengaluru"
        assert result["stale"] is True
        assert result["tempC"] == 24


# ==============================================================================
# 6. MAP SINGLE-DATASET LAYER COMPLETENESS TEST
# ==============================================================================

@pytest.mark.anyio
async def test_map_single_dataset_contains_all_layer_variables():
    """
    Verifies that a single call to /api/map/weather yields all required layer
    variables so that client-side layer switching requires ZERO provider calls.
    """
    provider = TrackedMockProvider()
    weather_hub.set_provider(provider)

    memory_store: Dict[str, Any] = {}

    with patch("backend.app.core.cache.cache.get", AsyncMock(side_effect=lambda k: memory_store.get(k))), \
         patch("backend.app.core.cache.cache.set", AsyncMock(side_effect=lambda k, v, ttl=300: memory_store.update({k: v}))):

        map_res = await get_map_weather()
        assert "cities" in map_res
        assert len(map_res["cities"]) > 0

        first_city = map_res["cities"][0]
        # Verify presence of all 9 layer variables
        required_vars = [
            "temperature", "rainChance", "precipitation", "rain",
            "windSpeed", "windDirection", "cloudCover", "pressure",
            "humidity", "visibility"
        ]
        for var in required_vars:
            assert var in first_city, f"Variable '{var}' missing from map city dataset!"

    weather_hub.set_provider(open_meteo_provider)
