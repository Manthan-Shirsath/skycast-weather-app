"""
Tests for Date/Time Aware Weather Data Resolution Layer
Validates:
1. 'tomorrow evening' retrieval & window aggregation
2. 'tomorrow at 5 PM' exact hour resolution
3. Exact hourly precipitation probability (distinct from daily max)
4. Activity suitability evaluated at exact target hour (17:00)
5. Daily max precipitation vs hourly precipitation distinction
6. Today vs tomorrow date isolation
7. 'this Saturday' vs 'next Saturday' ambiguity resolution
8. Marathi natural language formatting without English string leakages
"""

import pytest
import datetime
from unittest.mock import AsyncMock, patch

from backend.app.services.agent.schemas import ForecastArgs
from backend.app.services.agent.tools import get_forecast_tool
from backend.app.services.agent.context import (
    resolve_temporal_reference,
    conversation_context_tracker,
    format_marathi_weather_reply,
    ConversationContext
)
from backend.app.services.agent.agent import weather_agent


@pytest.fixture
def mock_weather_data():
    """Mock canonical weather dataset containing 7 days and full hourly series."""
    base_date = datetime.date(2026, 8, 29)  # Saturday
    today_iso = "2026-08-29"
    tmrw_iso = "2026-08-30"
    next_sat_iso = "2026-09-05"

    # Build 7 daily items (with high daily max rain probability of 100%)
    daily_items = [
        {
            "day": "Today",
            "date": "Aug 29",
            "date_iso": today_iso,
            "condition": "Cloudy",
            "icon": "cloudy",
            "weather_code": 3,
            "highC": 28,
            "lowC": 22,
            "rainChance": 100,  # Daily max is 100%
            "precipitationSum": 12.5
        },
        {
            "day": "Sun",
            "date": "Aug 30",
            "date_iso": tmrw_iso,
            "condition": "Cloudy",
            "icon": "cloudy",
            "weather_code": 3,
            "highC": 27,
            "lowC": 21,
            "rainChance": 95,  # Daily max is 95%
            "precipitationSum": 15.0
        },
        {
            "day": "Sat",
            "date": "Sep 05",
            "date_iso": next_sat_iso,
            "condition": "Clear",
            "icon": "sun",
            "weather_code": 0,
            "highC": 31,
            "lowC": 23,
            "rainChance": 10,
            "precipitationSum": 0.0
        }
    ]

    # Build multi-day hourly series with varied hourly rain chance
    # Specifically: on 2026-08-30, 17:00 (5 PM) has only 25% rain chance (dry window despite 95% daily max)
    # and evening (17:00-21:00) has average 20% rain chance.
    hourly_series = []
    for day_offset, d_iso in enumerate([today_iso, tmrw_iso, next_sat_iso]):
        for h in range(24):
            # 17:00 on tomorrow has exact 25% rain chance
            if d_iso == tmrw_iso and h == 17:
                rain_prob = 25
                precip = 0.2
            elif d_iso == tmrw_iso and 17 <= h <= 21:
                rain_prob = 20
                precip = 0.1
            elif d_iso == tmrw_iso and 6 <= h <= 12:
                rain_prob = 95  # Morning downpour
                precip = 10.0
            else:
                rain_prob = 15
                precip = 0.0

            hourly_series.append({
                "time_iso": f"{d_iso}T{h:02d}:00",
                "date": d_iso,
                "time": f"{h:02d}:00",
                "hour": h,
                "temperature_c": 26.0 if 12 <= h <= 18 else 22.0,
                "feels_like_c": 27.0 if 12 <= h <= 18 else 23.0,
                "humidity_pct": 75.0,
                "precipitation_mm": precip,
                "rain_probability_pct": rain_prob,
                "wind_speed_kmh": 12.0,
                "cloud_cover_pct": 50.0,
                "weather_code": 3,
                "condition": "Cloudy",
                "icon": "cloudy"
            })

    return {
        "city": "Pune",
        "tempC": 23,
        "feelsLikeC": 25,
        "condition": "Cloudy",
        "humidity": 81,
        "windSpeedKmh": 16,
        "insight": {"rainChance": 100},
        "daily": daily_items,
        "hourly": hourly_series[:24],
        "hourlySeries": hourly_series
    }


# ==============================================================================
# 1. Test 'tomorrow evening' retrieval & window aggregation
# ==============================================================================

@pytest.mark.anyio
async def test_tomorrow_evening_forecast(mock_weather_data):
    """Verifies that asking for tomorrow evening returns evening time range slice."""
    with patch("backend.app.services.agent.tools.weather_hub.get_weather_for_city", new=AsyncMock(return_value=mock_weather_data)):
        res = await get_forecast_tool(ForecastArgs(
            location="Pune",
            date="2026-08-30",
            time_range="evening"
        ))

        assert res["location"] == "Pune"
        assert res["target_date"] == "2026-08-30"
        tp = res["target_period"]
        assert tp is not None
        assert tp["period_type"] == "time_range"
        assert tp["time_range"] == "evening"
        assert tp["window_hours"] == "17:00 - 21:00"
        # Window max rain chance in evening should be 25%, NOT daily max (95%)
        assert tp["rain_chance_pct"] == 25


# ==============================================================================
# 2. Test 'tomorrow at 5 PM' exact hour resolution
# ==============================================================================

@pytest.mark.anyio
async def test_tomorrow_5pm_exact_hour(mock_weather_data):
    """Verifies exact 17:00 hour resolution for tomorrow."""
    with patch("backend.app.services.agent.tools.weather_hub.get_weather_for_city", new=AsyncMock(return_value=mock_weather_data)):
        res = await get_forecast_tool(ForecastArgs(
            location="Pune",
            date="2026-08-30",
            time="17:00"
        ))

        assert res["target_date"] == "2026-08-30"
        tp = res["target_period"]
        assert tp is not None
        assert tp["period_type"] == "exact_hour"
        assert tp["hour"] == "17:00"
        assert tp["rain_chance_pct"] == 25
        assert tp["temperature_c"] == 26


# ==============================================================================
# 3. Test exact hourly precipitation probability vs daily max
# ==============================================================================

@pytest.mark.anyio
async def test_hourly_rain_vs_daily_max(mock_weather_data):
    """
    CRITICAL REQUIREMENT:
    Do NOT use daily precipitation_probability_max (95%) as the rain probability for 17:00 (25%).
    """
    with patch("backend.app.services.agent.tools.weather_hub.get_weather_for_city", new=AsyncMock(return_value=mock_weather_data)):
        res = await get_forecast_tool(ForecastArgs(
            location="Pune",
            date="2026-08-30",
            time="5 PM"
        ))

        tp = res["target_period"]
        # Hourly rain probability must be 25%, not the daily max of 95%
        assert tp["rain_chance_pct"] == 25
        assert res["day_forecast"]["daily_rain_chance_pct"] == 95
        assert tp["rain_chance_pct"] != res["day_forecast"]["daily_rain_chance_pct"]


# ==============================================================================
# 4. Test activity suitability evaluated at exact target hour (17:00)
# ==============================================================================

@pytest.mark.anyio
async def test_activity_suitability_at_1700(mock_weather_data):
    """
    At 17:00 on tomorrow, rain chance is 25% (favorable), whereas morning had 95%.
    The activity suitability must evaluate the 17:00 window.
    """
    with patch("backend.app.services.agent.tools.weather_hub.get_weather_for_city", new=AsyncMock(return_value=mock_weather_data)):
        res = await get_forecast_tool(ForecastArgs(
            location="Pune",
            date="2026-08-30",
            time="17:00",
            activity="cricket"
        ))

        tp = res["target_period"]
        act_eval = tp["activity_suitability"]
        assert act_eval is not None
        assert act_eval["activity"] == "cricket"
        assert act_eval["status"] == "favorable"
        assert "25%" in act_eval["reason"]


# ==============================================================================
# 5. Test today vs tomorrow date isolation
# ==============================================================================

def test_today_vs_tomorrow_isolation():
    base = datetime.date(2026, 8, 29)
    k_today, expr_today, iso_today = resolve_temporal_reference("What is the weather today?", base_date=base)
    assert k_today == "today"
    assert iso_today == "2026-08-29"

    k_tmrw, expr_tmrw, iso_tmrw = resolve_temporal_reference("What is the weather tomorrow?", base_date=base)
    assert k_tmrw == "tomorrow"
    assert iso_tmrw == "2026-08-30"


# ==============================================================================
# 6. Test 'this Saturday' vs 'next Saturday' ambiguity resolution
# ==============================================================================

def test_saturday_ambiguity_resolution():
    base = datetime.date(2026, 8, 29)  # Today is Saturday Aug 29

    # 1. Explicit 'this Saturday' -> today (Aug 29)
    _, expr1, iso1 = resolve_temporal_reference("What about this Saturday?", base_date=base)
    assert iso1 == "2026-08-29"
    assert "this Saturday (today)" in expr1

    # 2. Explicit 'next Saturday' -> Sep 05
    _, expr2, iso2 = resolve_temporal_reference("What about next Saturday?", base_date=base)
    assert iso2 == "2026-09-05"
    assert "next Saturday" in expr2

    # 3. Contextual ambiguity: if conversation was already discussing tomorrow (2026-08-30) and user says "What about Saturday?"
    # It must resolve to next Saturday (2026-09-05)
    _, expr3, iso3 = resolve_temporal_reference(
        "What about Saturday?",
        base_date=base,
        previous_resolved_date="2026-08-30"
    )
    assert iso3 == "2026-09-05"
    assert "next Saturday" in expr3


# ==============================================================================
# 7. Test Marathi natural-language output (Zero English leakages)
# ==============================================================================

def test_marathi_natural_language_formatting():
    # Scenario 1: Tomorrow evening
    reply1 = format_marathi_weather_reply(
        city="पुणे",
        date_key="tomorrow",
        date_expr="tomorrow",
        time_val=None,
        time_range="evening",
        high_c=26,
        low_c=22,
        condition="Cloudy",
        rain_chance=25
    )
    assert "उद्या संध्याकाळी" in reply1
    assert "ढगाळ" in reply1
    assert "tomorrow" not in reply1.lower()
    assert "evening" not in reply1.lower()

    # Scenario 2: Tomorrow at 5 PM cricket
    reply2 = format_marathi_weather_reply(
        city="पुणे",
        date_key="tomorrow",
        date_expr="tomorrow",
        time_val="17:00",
        time_range="evening",
        high_c=26,
        low_c=22,
        condition="Cloudy",
        rain_chance=25,
        activity="cricket"
    )
    assert "उद्या संध्याकाळी ५:०० वाजता" in reply2
    assert "क्रिकेट खेळण्यासाठी हवामान अनुकूल आहे" in reply2
    assert "tomorrow" not in reply2.lower()
    assert "activity_suitability" not in reply2.lower()

    # Scenario 3: Saturday in Marathi
    reply3 = format_marathi_weather_reply(
        city="पुणे",
        date_key="Saturday",
        date_expr="next Saturday (Sep 05)",
        time_val=None,
        time_range=None,
        high_c=30,
        low_c=22,
        condition="Clear",
        rain_chance=10
    )
    assert "पुढील शनिवारी" in reply3
    assert "निरभ्र / स्वच्छ" in reply3
    assert "saturday" not in reply3.lower()
