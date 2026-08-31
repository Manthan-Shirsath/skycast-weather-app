import pytest
from backend.app.services.forecast_ai_service import forecast_ai_service, _AI_CACHE

def test_cache_key_stability():
    loc = "Pune"
    analytics1 = {
        "temperature": {
            "overall_max_spread": 2.0,
            "timeline": [{"timestamp": "2026-08-31T00:00:00Z", "spread": 2.0}]
        }
    }
    
    # Identical dictionary but different order (if it had more keys)
    analytics2 = {
        "temperature": {
            "timeline": [{"spread": 2.0, "timestamp": "2026-08-31T00:00:00Z"}],
            "overall_max_spread": 2.0
        }
    }
    
    key1 = forecast_ai_service._generate_cache_key(loc, analytics1)
    key2 = forecast_ai_service._generate_cache_key(loc, analytics2)
    
    assert key1 == key2, "Cache key should be stable regardless of dict key order"
    
    analytics3 = {
        "temperature": {
            "overall_max_spread": 2.1,
            "timeline": [{"timestamp": "2026-08-31T00:00:00Z", "spread": 2.1}]
        }
    }
    key3 = forecast_ai_service._generate_cache_key(loc, analytics3)
    assert key1 != key3, "Cache key must change when analytical input changes"

def test_cache_hit():
    import asyncio
    _AI_CACHE.clear()
    loc = "TestLoc"
    analytics = {"test": 1}
    
    key = forecast_ai_service._generate_cache_key(loc, analytics)
    _AI_CACHE[key] = "Mocked AI Response"
    
    # This shouldn't hit the API because of the cache
    result = asyncio.run(forecast_ai_service.get_analysis(loc, analytics))
    assert result == "Mocked AI Response"
