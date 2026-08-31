import pytest
import datetime
import asyncio
from backend.app.services.historical_weather_service import HistoricalWeatherService
from backend.app.models.historical_coverage import HistoricalCoverage
from backend.app.models.weather_snapshot import WeatherSnapshot
from backend.app.core.database import async_session_factory
from sqlalchemy import select, delete
from unittest.mock import patch, AsyncMock, MagicMock

def run_async(coro):
    return asyncio.run(coro)

async def cleanup_db():
    async with async_session_factory() as session:
        await session.execute(delete(HistoricalCoverage).where(HistoricalCoverage.city == 'testcity'))
        await session.execute(delete(WeatherSnapshot).where(WeatherSnapshot.city == 'testcity'))
        await session.commit()

def test_group_into_ranges():
    dates = [
        datetime.date(2025, 8, 1),
        datetime.date(2025, 8, 2),
        datetime.date(2025, 8, 5),
        datetime.date(2025, 8, 6),
        datetime.date(2025, 8, 7),
        datetime.date(2025, 8, 10),
    ]
    ranges = HistoricalWeatherService._group_into_ranges(dates)
    assert len(ranges) == 3
    assert ranges[0] == (datetime.date(2025, 8, 1), datetime.date(2025, 8, 2))
    assert ranges[1] == (datetime.date(2025, 8, 5), datetime.date(2025, 8, 7))
    assert ranges[2] == (datetime.date(2025, 8, 10), datetime.date(2025, 8, 10))

def test_ensure_coverage_completely_missing():
    async def _run():
        await cleanup_db()
        with patch("backend.app.services.historical_weather_service.open_meteo_provider.geocode_city", new_callable=AsyncMock) as mock_geo:
            mock_geo.return_value = {"lat": 1.0, "lon": 2.0, "name": "TestCity", "country": "TC"}
            
            start = datetime.date(2025, 8, 1)
            end = datetime.date(2025, 8, 2)
            
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "hourly": {
                    "time": ["2025-08-01T00:00", "2025-08-02T00:00"],
                    "temperature_2m": [25.0, 26.0],
                    "relative_humidity_2m": [50.0, 60.0],
                    "precipitation": [0.0, 1.0],
                    "wind_speed_10m": [10.0, 12.0],
                    "wind_direction_10m": [90, 180],
                    "surface_pressure": [1013.0, 1010.0],
                    "cloud_cover": [0.0, 10.0],
                    "visibility": [10000, 8000],
                    "weather_code": [0, 1]
                }
            }
            mock_response.raise_for_status = MagicMock()

            # Mock httpx.AsyncClient.get
            with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
                mock_get.return_value = mock_response

                await HistoricalWeatherService.ensure_coverage("testcity", start, end)
                
                assert mock_get.call_count == 1
            
            async with async_session_factory() as session:
                snaps = (await session.execute(select(WeatherSnapshot).where(WeatherSnapshot.city == 'testcity'))).scalars().all()
                assert len(snaps) == 2
                assert snaps[0].temperature_c == 25.0
                
                covs = (await session.execute(select(HistoricalCoverage).where(HistoricalCoverage.city == 'testcity'))).scalars().all()
                assert len(covs) == 2
    run_async(_run())

def test_ensure_coverage_completely_cached():
    async def _run():
        await cleanup_db()
        async with async_session_factory() as session:
            session.add(HistoricalCoverage(city="testcity", coverage_date=datetime.date(2025, 8, 1), provider="open_meteo_archive"))
            session.add(HistoricalCoverage(city="testcity", coverage_date=datetime.date(2025, 8, 2), provider="open_meteo_archive"))
            await session.commit()

        start = datetime.date(2025, 8, 1)
        end = datetime.date(2025, 8, 2)
        
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            await HistoricalWeatherService.ensure_coverage("testcity", start, end)
            assert mock_get.call_count == 0
    run_async(_run())

def test_ensure_coverage_idempotency_and_duplicates():
    async def _run():
        await cleanup_db()
        with patch("backend.app.services.historical_weather_service.open_meteo_provider.geocode_city", new_callable=AsyncMock) as mock_geo:
            mock_geo.return_value = {"lat": 1.0, "lon": 2.0, "name": "TestCity", "country": "TC"}
            
            start = datetime.date(2025, 8, 1)
            end = datetime.date(2025, 8, 1)
            
            mock_response = MagicMock()
            mock_response.json.return_value = {
                "hourly": {
                    "time": ["2025-08-01T00:00", "2025-08-01T01:00"],
                    "temperature_2m": [25.0, 26.0],
                    "relative_humidity_2m": [50.0, 60.0],
                    "precipitation": [0.0, 1.0],
                    "wind_speed_10m": [10.0, 12.0],
                    "wind_direction_10m": [90, 180],
                    "surface_pressure": [1013.0, 1010.0],
                    "cloud_cover": [0.0, 10.0],
                    "visibility": [10000, 8000],
                    "weather_code": [0, 1]
                }
            }
            mock_response.raise_for_status = MagicMock()

            with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
                mock_get.return_value = mock_response

                # Run twice
                await HistoricalWeatherService.ensure_coverage("testcity", start, end)
                
                # Drop coverage to force refetch
                async with async_session_factory() as session:
                    await session.execute(delete(HistoricalCoverage).where(HistoricalCoverage.city == 'testcity'))
                    await session.commit()
                    
                # Run again
                await HistoricalWeatherService.ensure_coverage("testcity", start, end)
                
            # Verify db insertion (should only have 2 rows total due to unique constraint)
            async with async_session_factory() as session:
                snaps = (await session.execute(select(WeatherSnapshot).where(WeatherSnapshot.city == 'testcity'))).scalars().all()
                assert len(snaps) == 2
    run_async(_run())
