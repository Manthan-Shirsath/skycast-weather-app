import pytest
import datetime
from backend.app.services.forecast_analytics import ForecastAnalytics
from backend.app.models.forecast import ForecastRun, ForecastValue

def test_forecast_analytics_spread_and_consensus():
    # Create mock runs
    t1 = datetime.datetime(2026, 8, 31, 12, 0, tzinfo=datetime.timezone.utc)
    t2 = datetime.datetime(2026, 8, 31, 13, 0, tzinfo=datetime.timezone.utc)
    
    run1 = ForecastRun(id=1, model_id="m1")
    run1.values = [
        ForecastValue(variable="temperature", valid_time=t1, value=20.0, unit="C"),
        ForecastValue(variable="temperature", valid_time=t2, value=21.0, unit="C")
    ]
    
    run2 = ForecastRun(id=2, model_id="m2")
    run2.values = [
        ForecastValue(variable="temperature", valid_time=t1, value=22.0, unit="C"),
        ForecastValue(variable="temperature", valid_time=t2, value=22.0, unit="C")
    ]
    
    analytics = ForecastAnalytics.analyze([run1, run2])
    
    assert "temperature" in analytics
    temp_data = analytics["temperature"]
    assert temp_data["overall_max_spread"] == 2.0
    
    timeline = temp_data["timeline"]
    assert len(timeline) == 2
    
    assert timeline[0]["timestamp"] == t1.isoformat()
    assert timeline[0]["min"] == 20.0
    assert timeline[0]["max"] == 22.0
    assert timeline[0]["model_disagreement"] == 2.0
    assert timeline[0]["consensus"] == 21.0
    assert timeline[0]["agreement"] == "moderate" # threshold is 1 for high, 2 for mod
    
    assert timeline[1]["model_disagreement"] == 1.0
    assert timeline[1]["agreement"] == "high"
    
    # Periods test
    periods = temp_data["periods"]
    assert len(periods) == 1
    assert periods[0]["date"] == "2026-08-31"
    assert periods[0]["max_spread"] == 2.0
    assert periods[0]["agreement"] == "moderate"

def test_missing_model_for_timestamp():
    t1 = datetime.datetime(2026, 8, 31, 12, 0, tzinfo=datetime.timezone.utc)
    
    run1 = ForecastRun(id=1, model_id="m1")
    run1.values = [
        ForecastValue(variable="temperature", valid_time=t1, value=20.0, unit="C"),
    ]
    
    run2 = ForecastRun(id=2, model_id="m2")
    run2.values = [] # Missing value
    
    analytics = ForecastAnalytics.analyze([run1, run2])
    # Timeline should not be empty because we allow single models to be present
    assert "temperature" in analytics
    assert analytics["temperature"]["timeline"][0]["model_disagreement"] == 0.0
