import pytest
from unittest.mock import AsyncMock
import backend.app.services.agent  # Pre-load to avoid circular import in test
from backend.app.services.alert_service import AlertDetectionService
from backend.app.services.weather_hub import weather_hub
from backend.app.core.cache import cache

@pytest.fixture(autouse=True)
def clear_cache():
    # Clear internal cache dict
    if hasattr(cache, "_cache"):
        cache._cache.clear()
    yield

@pytest.mark.asyncio
async def test_official_alert_city_match(monkeypatch):
    mock_official = {
        "official_alerts_status": "ready",
        "alerts": [
            {
                "title": "Severe Rain in Mumbai",
                "description": "Very heavy rainfall expected over Mumbai and nearby regions.",
                "areas": ["Maharashtra"],
                "severity": "Severe"
            }
        ]
    }
    
    # Mock weather hub to return our custom official alerts
    monkeypatch.setattr(weather_hub, "get_official_alerts", AsyncMock(return_value=mock_official))
    
    mock_weather = {
        "location": {"region": "Maharashtra"},
        "state": "Maharashtra",
        "current": {"temperature": 25, "precipitation": 0, "wind_speed": 10},
        "daily": [{"precipitation_probability_max": 10}],
        "hourly_series": []
    }
    
    service = AlertDetectionService()
    
    # Test match by city name in description
    result = await service.get_alerts_for_location(19.0, 72.8, "Mumbai", mock_weather)
    
    assert result["hasOfficialAlert"] is True
    assert result["official_alerts_status"] == "ready"
    assert len(result["officialAlerts"]) == 1
    assert result["officialAlerts"][0]["location_match_level"] == "city"
    assert result["official"] is True
    assert "Includes active official IMD/government warnings" in result["disclaimer"]

@pytest.mark.asyncio
async def test_official_alert_state_match(monkeypatch):
    mock_official = {
        "official_alerts_status": "ready",
        "alerts": [
            {
                "title": "Statewide Alert",
                "description": "Heavy rainfall in Maharashtra",
                "areas": ["Maharashtra"],
                "severity": "Moderate"
            }
        ]
    }
    
    monkeypatch.setattr(weather_hub, "get_official_alerts", AsyncMock(return_value=mock_official))
    
    # "Pune" is not in the description or areas, but the state is "Maharashtra"
    mock_weather = {
        "location": {"region": "Maharashtra"},
        "current": {"temperature": 25, "precipitation": 0, "wind_speed": 10},
        "daily": [{"precipitation_probability_max": 10}],
        "hourly_series": []
    }
    
    service = AlertDetectionService()
    result = await service.get_alerts_for_location(18.52, 73.85, "Pune", mock_weather)
    
    # It should match because loc_admin1 ("maharashtra") is in areas_lower
    assert result["hasOfficialAlert"] is True
    assert len(result["officialAlerts"]) == 1
    assert result["officialAlerts"][0]["location_match_level"] == "state"

@pytest.mark.asyncio
async def test_official_alert_unrelated_city_in_same_state(monkeypatch):
    mock_official = {
        "official_alerts_status": "ready",
        "alerts": [
            {
                "title": "Severe Alert",
                "description": "Heavy rainfall in Mumbai.",
                "areas": ["Maharashtra"],
                "severity": "Severe"
            }
        ]
    }
    
    monkeypatch.setattr(weather_hub, "get_official_alerts", AsyncMock(return_value=mock_official))
    
    mock_weather = {
        "location": {"region": "Maharashtra"},
        "current": {"temperature": 25, "precipitation": 0, "wind_speed": 10},
        "daily": [{"precipitation_probability_max": 10}],
        "hourly_series": []
    }
    
    service = AlertDetectionService()
    # "Solapur" is in Maharashtra, but the alert specifies "Mumbai".
    result = await service.get_alerts_for_location(17.65, 75.90, "Solapur", mock_weather)
    
    assert result["hasOfficialAlert"] is False
    assert len(result["officialAlerts"]) == 0

@pytest.mark.asyncio
async def test_official_alert_non_matching_location(monkeypatch):
    mock_official = {
        "official_alerts_status": "ready",
        "alerts": [
            {
                "title": "Delhi Alert",
                "description": "Heavy rainfall in Delhi",
                "areas": ["Delhi"],
                "severity": "Moderate"
            }
        ]
    }
    
    monkeypatch.setattr(weather_hub, "get_official_alerts", AsyncMock(return_value=mock_official))
    
    mock_weather = {
        "location": {"region": "Maharashtra"},
        "current": {"temperature": 25, "precipitation": 0, "wind_speed": 10},
        "daily": [{"precipitation_probability_max": 10}],
        "hourly_series": []
    }
    
    service = AlertDetectionService()
    result = await service.get_alerts_for_location(21.14, 79.08, "Nagpur", mock_weather)
    
    assert result["hasOfficialAlert"] is False
    assert len(result["officialAlerts"]) == 0
    assert result["official"] is False
    assert "NOT official IMD warnings" in result["disclaimer"]

@pytest.mark.asyncio
async def test_feed_unavailable_state(monkeypatch):
    mock_official = {
        "official_alerts_status": "unavailable",
        "reason": "timeout"
    }
    
    monkeypatch.setattr(weather_hub, "get_official_alerts", AsyncMock(return_value=mock_official))
    
    mock_weather = {
        "location": {"region": "Maharashtra"},
        "current": {"temperature": 25, "precipitation": 0, "wind_speed": 10},
        "daily": [{"precipitation_probability_max": 10}],
        "hourly_series": []
    }
    
    service = AlertDetectionService()
    result = await service.get_alerts_for_location(21.17, 72.83, "Surat", mock_weather)
    
    # When unavailable, hasOfficialAlert is None to distinguish from "no warning"
    assert result["hasOfficialAlert"] is None
    assert result["official_alerts_status"] == "unavailable"
    assert "currently unavailable" in result["disclaimer"]
    
@pytest.mark.asyncio
async def test_official_distinguished_from_skycast(monkeypatch):
    # Setup mock official alert
    mock_official = {
        "official_alerts_status": "ready",
        "alerts": [
            {
                "title": "Severe Rain in Nashik",
                "description": "Heavy rainfall in Nashik",
                "areas": ["Maharashtra"],
                "severity": "Severe"
            }
        ]
    }
    monkeypatch.setattr(weather_hub, "get_official_alerts", AsyncMock(return_value=mock_official))
    
    # Setup mock weather that triggers a Skycast risk (e.g., extreme precip)
    mock_weather = {
        "location": {"region": "Maharashtra"},
        "current": {
            "temperature_2m": 25, 
            "precipitation": 0, 
            "weather_code": 95
        }, 
        "daily": {
            "precipitation_probability_max": [100],
            "precipitation_sum": [200.0],
            "temperature_2m_max": [30.0],
            "temperature_2m_min": [25.0]
        },
        "hourly_series": []
    }
    
    service = AlertDetectionService()
    result = await service.get_alerts_for_location(19.99, 73.78, "Nashik", mock_weather)
    
    assert result["hasOfficialAlert"] is True
    assert result["hasHazard"] is True
    
    # Verify separation
    assert len(result["officialAlerts"]) == 1
    assert len(result["alerts"]) > 0 # Skycast risk alerts
    assert result["officialAlerts"][0]["title"] == "Severe Rain in Nashik"
    # Skycast risk has different structure
    assert "riskColour" in result["alerts"][0]
