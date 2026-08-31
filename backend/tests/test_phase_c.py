import pytest
from backend.app.services.agent.rain_evaluator import RainEvaluator

def test_rain_evaluator_dry_day():
    hourly_series = [
        {"time_iso": f"2026-08-30T{h:02d}:00", "date": "2026-08-30", "hour": h, "precipitation_probability": 0, "precipitation_mm": 0.0}
        for h in range(24)
    ]
    
    result = RainEvaluator.evaluate_rain("Pune", "2026-08-30", None, hourly_series)
    
    assert result["overall_chance"] == 0
    assert result["total_precipitation_mm"] == 0.0
    assert len(result["rain_periods"]) == 0
    assert len(result["dry_windows"]) == 1
    assert result["dry_windows"][0]["start_time"] == "00:00"
    assert result["dry_windows"][0]["end_time"] == "23:00"

def test_rain_evaluator_heavy_rain_evening():
    hourly_series = [
        {"time_iso": f"2026-08-30T{h:02d}:00", "date": "2026-08-30", "hour": h, "precipitation_probability": 80 if 17 <= h <= 20 else 10, "precipitation_mm": 2.0 if 17 <= h <= 20 else 0.0}
        for h in range(24)
    ]
    
    result = RainEvaluator.evaluate_rain("Pune", "2026-08-30", None, hourly_series)
    
    assert result["overall_chance"] == 80
    assert result["total_precipitation_mm"] == 8.0
    assert len(result["rain_periods"]) == 1
    assert result["rain_periods"][0]["start_time"] == "17:00"
    assert result["rain_periods"][0]["end_time"] == "20:00"
    assert result["rain_periods"][0]["max_chance"] == 80
    
    assert len(result["dry_windows"]) == 2
    assert result["dry_windows"][0]["start_time"] == "00:00"
    assert result["dry_windows"][0]["end_time"] == "16:00"
    assert result["dry_windows"][1]["start_time"] == "21:00"
    assert result["dry_windows"][1]["end_time"] == "23:00"

def test_rain_evaluator_time_range_filter():
    hourly_series = [
        {"time_iso": f"2026-08-30T{h:02d}:00", "date": "2026-08-30", "hour": h, "precipitation_probability": 80 if 17 <= h <= 20 else 10, "precipitation_mm": 2.0 if 17 <= h <= 20 else 0.0}
        for h in range(24)
    ]
    
    result = RainEvaluator.evaluate_rain("Pune", "2026-08-30", "evening", hourly_series)
    
    # Evening is 17 to 21
    assert result["overall_chance"] == 80
    assert result["total_precipitation_mm"] == 8.0
    assert len(result["slots"]) == 5 # 17, 18, 19, 20, 21
    
    # 17-20 is rain, 21 is dry
    assert len(result["rain_periods"]) == 1
    assert result["rain_periods"][0]["start_time"] == "17:00"
    assert result["rain_periods"][0]["end_time"] == "20:00"
    
    assert len(result["dry_windows"]) == 1
    assert result["dry_windows"][0]["start_time"] == "21:00"
    assert result["dry_windows"][0]["end_time"] == "21:00"
