import pytest
import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import select, Index

from backend.app.models.weather_snapshot import Base, WeatherSnapshot
from backend.app.services.history_service import HistoryService
from backend.app.core.database import DATABASE_URL, engine

@pytest.mark.anyio
async def test_weather_snapshot_schema_definition():
    """Verify PostgreSQL model table name, column types, and compound indexes."""
    assert WeatherSnapshot.__tablename__ == "weather_snapshots"

    # Verify key columns exist
    columns = {col.name: col for col in WeatherSnapshot.__table__.columns}
    expected_columns = [
        "id", "timestamp", "city", "display_location", "latitude", "longitude",
        "temperature_c", "feels_like_c", "humidity_pct", "precipitation_mm",
        "rain_probability_pct", "wind_speed_kmh", "wind_direction_deg",
        "wind_direction_label", "cloud_cover_pct", "pressure_hpa", "visibility_km",
        "weather_code", "condition_text", "skycast_risk_level", "highest_risk", "active_hazards"
    ]
    for col_name in expected_columns:
        assert col_name in columns, f"Column '{col_name}' missing from weather_snapshots table schema"

    # Verify compound and single indexes
    index_names = {idx.name for idx in WeatherSnapshot.__table__.indexes}
    assert "idx_weather_snapshots_city_timestamp" in index_names
    assert "idx_weather_snapshots_timestamp" in index_names

@pytest.mark.anyio
async def test_weather_snapshot_serialization():
    """Verify WeatherSnapshot to_dict serialization method."""
    now = datetime.datetime.now(datetime.timezone.utc)
    snapshot = WeatherSnapshot(
        id=1,
        timestamp=now,
        city="pune",
        display_location="Pune, Maharashtra, India",
        latitude=18.52,
        longitude=73.85,
        temperature_c=26.5,
        feels_like_c=27.0,
        humidity_pct=65.0,
        precipitation_mm=12.4,
        rain_probability_pct=80.0,
        wind_speed_kmh=15.0,
        wind_direction_deg=240.0,
        wind_direction_label="WSW",
        cloud_cover_pct=75.0,
        pressure_hpa=1011.0,
        visibility_km=9.0,
        weather_code=61,
        condition_text="Slight Rain",
        skycast_risk_level="yellow",
        highest_risk="heavy_rain",
        active_hazards="heavy_rain"
    )

    data = snapshot.to_dict()
    assert data["id"] == 1
    assert data["city"] == "pune"
    assert data["temperatureC"] == 26.5
    assert data["precipitationMm"] == 12.4
    assert data["skycastRiskLevel"] == "yellow"
    assert data["highestRisk"] == "heavy_rain"

@pytest.mark.anyio
async def test_trends_insufficient_data_response():
    """Verify /api/trends returns honest no-data response without fabricating historical points."""
    trends = await HistoryService.get_trends("UnknownCity", "24h")

    assert trends["city"] == "Unknowncity"
    assert trends["status"] == "insufficient_data"
    assert trends["count"] == 0
    assert "Not enough historical data yet" in trends["message"]
    assert trends["observations"] == []
    assert trends["temperature"]["current"] is None
    assert trends["temperature"]["avg"] is None
    assert trends["rainfall"]["total"] == 0.0
    assert "Skycast risk levels are derived assessments" in trends["disclaimer"]

@pytest.mark.anyio
async def test_trends_forecast_vs_observed_structure():
    """Verify Forecast vs Observed comparison presents both metrics without fabricated accuracy claims."""
    now = datetime.datetime.now(datetime.timezone.utc)
    sample_snapshot = WeatherSnapshot(
        id=10,
        timestamp=now,
        city="pune",
        display_location="Pune, Maharashtra, India",
        temperature_c=25.0,
        humidity_pct=60.0,
        precipitation_mm=0.0,
        wind_speed_kmh=12.0,
        pressure_hpa=1012.0,
        condition_text="Clear",
        skycast_risk_level="green"
    )

    sample_current_weather = {
        "city": "Pune",
        "condition": "Partly Cloudy",
        "highC": 28.0,
        "lowC": 20.0,
        "daily": [{
            "highC": 28.0,
            "lowC": 20.0,
            "rainChance": 30,
            "precipitationMm": 2.5,
            "condition": "Partly Cloudy",
            "maxWindKmh": 18
        }]
    }

    comp = HistoryService._build_forecast_vs_observed(sample_snapshot, sample_current_weather)
    assert comp is not None
    assert comp["hasForecastAccuracyClaim"] is False
    assert "observed" in comp
    assert "forecast" in comp
    assert comp["observed"]["temperature"] == 25.0
    assert comp["forecast"]["highTemp"] == 28.0
    assert comp["forecast"]["rainChance"] == 30

@pytest.mark.anyio
async def test_database_url_configuration():
    """Verify DATABASE_URL is configured for PostgreSQL with asyncpg dialect."""
    assert DATABASE_URL.startswith("postgresql+asyncpg://"), f"Expected postgresql+asyncpg:// but got {DATABASE_URL}"

@pytest.mark.anyio
async def test_history_service_deduplication_logic():
    """Verify 15-minute deduplication skips insertion when weather delta is negligible."""
    now = datetime.datetime.now(datetime.timezone.utc)
    recent_snapshot = WeatherSnapshot(
        id=99,
        timestamp=now - datetime.timedelta(minutes=5),
        city="pune",
        temperature_c=26.0,
        precipitation_mm=0.0,
        wind_speed_kmh=10.0,
        skycast_risk_level="green"
    )

    mock_session = AsyncMock()
    mock_execute_res = MagicMock()
    mock_execute_res.scalar_one_or_none.return_value = recent_snapshot
    mock_session.execute.return_value = mock_execute_res

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session

    weather_data_same = {
        "tempC": 26.1,  # delta < 0.5
        "precipitation": 0.0,
        "humidity": 60,
        "windSpeedKmh": 11.0,  # delta < 5.0
        "alerts": []
    }

    with patch("backend.app.services.history_service.check_db_health", AsyncMock(return_value=True)), \
         patch("backend.app.services.history_service.async_session_factory", mock_factory):
        res = await HistoryService.record_snapshot("pune", weather_data_same)
        # Should return existing snapshot without adding a new row
        assert res is not None
        assert res.id == 99
        mock_session.add.assert_not_called()

@pytest.mark.anyio
async def test_trends_statistical_aggregations():
    """Verify statistical analytics calculation (avg, min, max, total rainfall, dominant wind) on observations."""
    now = datetime.datetime.now(datetime.timezone.utc)
    snapshots = [
        WeatherSnapshot(
            id=1,
            timestamp=now - datetime.timedelta(hours=6),
            city="pune",
            display_location="Pune, Maharashtra, India",
            temperature_c=22.0,
            feels_like_c=22.0,
            humidity_pct=80.0,
            precipitation_mm=5.0,
            rain_probability_pct=90.0,
            wind_speed_kmh=12.0,
            wind_direction_label="WSW",
            pressure_hpa=1010.0,
            condition_text="Rain",
            skycast_risk_level="yellow",
            highest_risk="heavy_rain"
        ),
        WeatherSnapshot(
            id=2,
            timestamp=now - datetime.timedelta(hours=3),
            city="pune",
            display_location="Pune, Maharashtra, India",
            temperature_c=26.0,
            feels_like_c=27.0,
            humidity_pct=65.0,
            precipitation_mm=2.0,
            rain_probability_pct=40.0,
            wind_speed_kmh=16.0,
            wind_direction_label="WSW",
            pressure_hpa=1012.0,
            condition_text="Passing Showers",
            skycast_risk_level="yellow",
            highest_risk="heavy_rain"
        ),
        WeatherSnapshot(
            id=3,
            timestamp=now,
            city="pune",
            display_location="Pune, Maharashtra, India",
            temperature_c=28.0,
            feels_like_c=29.0,
            humidity_pct=50.0,
            precipitation_mm=0.0,
            rain_probability_pct=10.0,
            wind_speed_kmh=14.0,
            wind_direction_label="NW",
            pressure_hpa=1014.0,
            condition_text="Partly Cloudy",
            skycast_risk_level="green",
            highest_risk="normal"
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

        assert trends["status"] == "ready"
        assert trends["count"] == 3
        # Temperature stats
        assert trends["temperature"]["current"] == 28.0
        assert trends["temperature"]["min"] == 22.0
        assert trends["temperature"]["max"] == 28.0
        assert trends["temperature"]["avg"] == round((22.0 + 26.0 + 28.0) / 3, 1)

        # Rainfall stats
        assert trends["rainfall"]["total"] == 7.0
        assert trends["rainfall"]["maxPeriod"] == 5.0
        assert trends["rainfall"]["avg"] == round(7.0 / 3, 2)

        # Dominant wind direction
        assert trends["wind"]["dominantDirection"] == "WSW"

        # Risk transition history
        assert len(trends["riskHistory"]) == 2  # Yellow -> Green
        assert trends["riskHistory"][0]["riskLevel"] == "yellow"
        assert trends["riskHistory"][1]["riskLevel"] == "green"
