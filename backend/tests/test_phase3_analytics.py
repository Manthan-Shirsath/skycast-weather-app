import pytest
from backend.app.services.agent.analytics_evaluator import AnalyticsEvaluator
from backend.app.services.agent.comparison_evaluator import ComparisonEvaluator

def test_calculate_trends():
    hourly_slots = [
        {"time": "10:00", "temperature_c": 20, "precipitation_probability": 0},
        {"time": "11:00", "temperature_c": 21, "precipitation_probability": 5},
        {"time": "12:00", "temperature_c": 23, "precipitation_probability": 10},
        {"time": "13:00", "temperature_c": 26, "precipitation_probability": 30},
        {"time": "14:00", "temperature_c": 28, "precipitation_probability": 50},
        {"time": "15:00", "temperature_c": 29, "precipitation_probability": 60},
    ]
    
    analytics = AnalyticsEvaluator.calculate_trends(hourly_slots)
    
    assert analytics["temperature_trend"] == "rising"
    assert analytics["rain_trend"] == "increasing"
    assert analytics["peak_rain_prob"] == 60
    assert analytics["peak_temp"] == 29
    assert analytics["forecast_stability"] == "moderate"
    assert analytics["best_dry_window"] == "Starts around 10:00"

def test_calculate_trends_stable():
    hourly_slots = [
        {"time": "10:00", "temperature_c": 20, "precipitation_probability": 0},
        {"time": "11:00", "temperature_c": 20, "precipitation_probability": 0},
        {"time": "12:00", "temperature_c": 21, "precipitation_probability": 0},
        {"time": "13:00", "temperature_c": 21, "precipitation_probability": 0},
    ]
    
    analytics = AnalyticsEvaluator.calculate_trends(hourly_slots)
    
    assert analytics["temperature_trend"] == "stable"
    assert analytics["rain_trend"] == "stable"
    assert analytics["peak_rain_prob"] == 0
    assert analytics["forecast_stability"] == "stable"

def test_comparison_evaluator():
    daily_data_1 = {"date": "2024-01-01", "temperature_max_c": 25, "precipitation_probability": 0}
    daily_data_2 = {"date": "2024-01-02", "temperature_max_c": 25, "precipitation_probability": 80}
    
    score1 = ComparisonEvaluator.score_weather(daily_data_1)
    score2 = ComparisonEvaluator.score_weather(daily_data_2)
    
    assert score1 > score2
