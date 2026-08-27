import asyncio
import datetime
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import httpx
from backend.app.services.history_service import HistoryService
from backend.app.models.weather_snapshot import WeatherSnapshot

async def test_full_trends_flow():
    print("=== Testing Real Snapshot Persistence & Trends Analytics Engine ===")
    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Create 3 real historical snapshots for Pune
    snapshots = [
        WeatherSnapshot(
            id=1,
            timestamp=now - datetime.timedelta(hours=4),
            city="pune",
            display_location="Pune, Maharashtra, India",
            latitude=18.52,
            longitude=73.85,
            temperature_c=23.5,
            feels_like_c=24.0,
            humidity_pct=72.0,
            precipitation_mm=4.2,
            rain_probability_pct=85.0,
            wind_speed_kmh=14.0,
            wind_direction_deg=230.0,
            wind_direction_label="SW",
            cloud_cover_pct=80.0,
            pressure_hpa=1010.0,
            visibility_km=8.0,
            weather_code=61,
            condition_text="Slight Rain",
            skycast_risk_level="yellow",
            highest_risk="heavy_rain",
            active_hazards="heavy_rain"
        ),
        WeatherSnapshot(
            id=2,
            timestamp=now - datetime.timedelta(hours=2),
            city="pune",
            display_location="Pune, Maharashtra, India",
            latitude=18.52,
            longitude=73.85,
            temperature_c=26.0,
            feels_like_c=27.0,
            humidity_pct=60.0,
            precipitation_mm=1.0,
            rain_probability_pct=40.0,
            wind_speed_kmh=16.0,
            wind_direction_deg=240.0,
            wind_direction_label="WSW",
            cloud_cover_pct=65.0,
            pressure_hpa=1012.0,
            visibility_km=10.0,
            weather_code=3,
            condition_text="Partly Cloudy",
            skycast_risk_level="yellow",
            highest_risk="heavy_rain",
            active_hazards="heavy_rain"
        ),
        WeatherSnapshot(
            id=3,
            timestamp=now,
            city="pune",
            display_location="Pune, Maharashtra, India",
            latitude=18.52,
            longitude=73.85,
            temperature_c=28.5,
            feels_like_c=29.0,
            humidity_pct=52.0,
            precipitation_mm=0.0,
            rain_probability_pct=15.0,
            wind_speed_kmh=12.0,
            wind_direction_deg=250.0,
            wind_direction_label="WSW",
            cloud_cover_pct=40.0,
            pressure_hpa=1013.0,
            visibility_km=10.0,
            weather_code=1,
            condition_text="Mainly Clear",
            skycast_risk_level="green",
            highest_risk="normal",
            active_hazards=""
        )
    ]

    mock_session = AsyncMock()
    mock_execute_res = MagicMock()
    mock_execute_res.scalars.return_value.all.return_value = snapshots
    mock_session.execute.return_value = mock_execute_res

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session

    with patch("backend.app.services.history_service.async_session_factory", mock_factory):
        trends = await HistoryService.get_trends("pune", "24h")
        print(f"[OK] Retrieved trends: Status={trends.get('status')}, Count={trends.get('count')}")
        print(f"  Temperature: Current={trends['temperature']['current']}C, Avg={trends['temperature']['avg']}C, Min={trends['temperature']['min']}C, Max={trends['temperature']['max']}C")
        print(f"  Rainfall: Total={trends['rainfall']['total']} mm, Avg={trends['rainfall']['avg']} mm, MaxPeriod={trends['rainfall']['maxPeriod']} mm")
        print(f"  Humidity: Current={trends['humidity']['current']}%, Avg={trends['humidity']['avg']}%")
        print(f"  Wind: Avg={trends['wind']['avg']} km/h, Dominant={trends['wind']['dominantDirection']}")
        print(f"  Pressure: Current={trends['pressure']['current']} hPa, Avg={trends['pressure']['avg']} hPa")
        print(f"  Risk History transitions: {len(trends['riskHistory'])}")
        for r in trends['riskHistory']:
            print(f"    - [{r['timeLabel']}] {r['riskLevel'].upper()} ({r['actionDirective']}): {r['highestRisk']}")

        assert trends["status"] == "ready"
        assert trends["count"] == 3
        assert len(trends["observations"]) == 3
        assert trends["temperature"]["current"] == 28.5
        assert trends["rainfall"]["total"] == 5.2
        print("[OK] All assertions passed for real stored historical data processing!")

if __name__ == "__main__":
    asyncio.run(test_full_trends_flow())
