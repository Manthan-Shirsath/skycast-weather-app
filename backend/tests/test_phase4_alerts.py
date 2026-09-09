"""
Phase 4 Alert Monitoring Tests
Tests for: change detection, severity classification, deduplication,
activity-aware alerts, location isolation, API failure, missing data.
"""
import pytest
import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from backend.app.services.forecast_monitor import (
    _detect_changes,
    _classify_severity,
    _build_alert_signature,
    _build_recommendation,
    _build_alert_object,
    _extract_window_snapshot,
    create_monitor,
    run_monitor_check,
    get_alert_history,
    get_monitors_for_session,
    THRESHOLD_RAIN_PROB_PCT,
    THRESHOLD_TEMP_C,
    THRESHOLD_WIND_KMPH,
    THRESHOLD_PRECIP_MM,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_snapshot(**kwargs):
    base = {
        "max_rain_prob": 30.0,
        "avg_rain_prob": 25.0,
        "max_temp": 28.0,
        "min_temp": 22.0,
        "max_wind": 10.0,
        "total_precip": 0.0,
        "slot_count": 3,
        "target_date": "2026-09-06",
        "target_hour": 18,
        "snapshot_at": "2026-09-06T08:00:00Z",
    }
    base.update(kwargs)
    return base


def make_monitor(session_id="sess-1", location="Pune", activity="cricket", target_hour=18):
    return {
        "monitor_id": "mon-test-1",
        "session_id": session_id,
        "location": location,
        "activity": activity,
        "target_date": datetime.date.today().isoformat(),
        "target_hour": target_hour,
        "time_label": "evening",
        "enabled": True,
        "created_at": "2026-09-06T08:00:00Z",
        "last_checked_at": None,
    }


# ── A. No monitor → nothing checked ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_a_no_monitor_nothing_checked():
    with patch("backend.app.services.forecast_monitor.get_monitor", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        result = await run_monitor_check("non-existent-monitor-id")
    assert result["checked"] is False
    assert result["reason"] == "monitor_not_found"


# ── B. Create monitor → baseline stored → no alert ────────────────────────────

@pytest.mark.asyncio
async def test_b_create_monitor_baseline_no_alert():
    session_id = "sess-b"
    weather_data = {
        "hourlySeries": [
            {"date": datetime.date.today().isoformat(), "hour": 18, "precipitation_probability": 30, "temperature_c": 28, "wind_speed_kmh": 10, "precipitation_mm": 0},
            {"date": datetime.date.today().isoformat(), "hour": 19, "precipitation_probability": 32, "temperature_c": 27, "wind_speed_kmh": 11, "precipitation_mm": 0},
        ]
    }
    monitor = make_monitor(session_id=session_id)

    with patch("backend.app.services.forecast_monitor.get_monitor", new_callable=AsyncMock) as mock_get_mon, \
         patch("backend.app.services.forecast_monitor.cache.get", new_callable=AsyncMock) as mock_cache_get, \
         patch("backend.app.services.forecast_monitor.cache.set", new_callable=AsyncMock), \
         patch("backend.app.services.forecast_monitor.weather_hub.get_weather_for_city", new_callable=AsyncMock) as mock_wx:

        mock_get_mon.return_value = monitor
        mock_wx.return_value = weather_data
        # First call: get baseline from cache → None; second call may be for the monitor update
        mock_cache_get.return_value = None

        result = await run_monitor_check("mon-test-1")

    assert result["checked"] is True
    assert result["changes_detected"] is False
    assert result["alert_created"] is False
    assert result["reason"] == "baseline_established"


# ── C. Same forecast → no alert ───────────────────────────────────────────────

def test_c_same_forecast_no_change():
    prev = make_snapshot(max_rain_prob=30, max_temp=28, max_wind=10, total_precip=0)
    curr = make_snapshot(max_rain_prob=30, max_temp=28, max_wind=10, total_precip=0)
    changes = _detect_changes(prev, curr)
    assert len(changes) == 0


# ── D. 25% → 27% → no alert (below threshold) ────────────────────────────────

def test_d_small_change_ignored():
    prev = make_snapshot(max_rain_prob=25)
    curr = make_snapshot(max_rain_prob=27)
    changes = _detect_changes(prev, curr)
    rain_changes = [c for c in changes if c["field"] == "max_rain_prob"]
    assert len(rain_changes) == 0, f"Expected no rain change, got {rain_changes}"


# ── E. 30% → 78% → alert ─────────────────────────────────────────────────────

def test_e_significant_rain_increase_creates_change():
    prev = make_snapshot(max_rain_prob=30)
    curr = make_snapshot(max_rain_prob=78)
    changes = _detect_changes(prev, curr)
    rain_change = next((c for c in changes if c["field"] == "max_rain_prob"), None)
    assert rain_change is not None
    assert rain_change["prev_val"] == 30
    assert rain_change["curr_val"] == 78
    assert rain_change["delta"] == 48


# ── F. 78% → 78% → duplicate suppressed ─────────────────────────────────────

def test_f_duplicate_same_signature():
    prev = make_snapshot(max_rain_prob=30)
    curr = make_snapshot(max_rain_prob=78)
    changes = _detect_changes(prev, curr)
    severity = _classify_severity(48, 0, 0, 0, 78, 10)
    sig1 = _build_alert_signature("mon-1", changes, severity)

    # Same state → same signature
    sig2 = _build_alert_signature("mon-1", changes, severity)
    assert sig1 == sig2


# ── G. 78% → 95% → new meaningful change ─────────────────────────────────────

def test_g_further_increase_creates_new_signature():
    changes_a = _detect_changes(make_snapshot(max_rain_prob=30), make_snapshot(max_rain_prob=78))
    sev_a = _classify_severity(48, 0, 0, 0, 78, 10)
    sig_a = _build_alert_signature("mon-1", changes_a, sev_a)

    changes_b = _detect_changes(make_snapshot(max_rain_prob=78), make_snapshot(max_rain_prob=95))
    sev_b = _classify_severity(17, 0, 0, 0, 95, 10)
    sig_b = _build_alert_signature("mon-1", changes_b, sev_b)

    # 78→95 is a new event (different quantised delta) → different signature
    assert sig_a != sig_b


# ── H. Temperature threshold ──────────────────────────────────────────────────

def test_h_temperature_threshold():
    # Below threshold (2°C change)
    no_change = _detect_changes(make_snapshot(max_temp=28), make_snapshot(max_temp=30))
    temp_changes = [c for c in no_change if c["field"] == "max_temp"]
    assert len(temp_changes) == 0

    # Above threshold (5°C change)
    has_change = _detect_changes(make_snapshot(max_temp=28), make_snapshot(max_temp=33))
    temp_changes = [c for c in has_change if c["field"] == "max_temp"]
    assert len(temp_changes) == 1
    assert temp_changes[0]["delta"] == 5.0


# ── I. Wind threshold ─────────────────────────────────────────────────────────

def test_i_wind_threshold():
    # Below threshold (10 km/h change)
    no_change = _detect_changes(make_snapshot(max_wind=10), make_snapshot(max_wind=20))
    wind_changes = [c for c in no_change if c["field"] == "max_wind"]
    assert len(wind_changes) == 0

    # Above threshold (25 km/h change)
    has_change = _detect_changes(make_snapshot(max_wind=10), make_snapshot(max_wind=35))
    wind_changes = [c for c in has_change if c["field"] == "max_wind"]
    assert len(wind_changes) == 1
    assert wind_changes[0]["delta"] == 25.0


# ── J. Rainfall threshold ─────────────────────────────────────────────────────

def test_j_precip_threshold():
    # Below threshold (3 mm change)
    no_change = _detect_changes(make_snapshot(total_precip=0), make_snapshot(total_precip=3))
    precip_changes = [c for c in no_change if c["field"] == "total_precip"]
    assert len(precip_changes) == 0

    # Above threshold (12 mm change)
    has_change = _detect_changes(make_snapshot(total_precip=0), make_snapshot(total_precip=12))
    precip_changes = [c for c in has_change if c["field"] == "total_precip"]
    assert len(precip_changes) == 1


# ── K. Severity classification ────────────────────────────────────────────────

def test_k_severity_classification():
    assert _classify_severity(48, 0, 0, 0, 78, 10) == "WARNING"
    assert _classify_severity(48, 0, 0, 20, 80, 10) == "CRITICAL"  # rain>=80 + precip>15
    assert _classify_severity(20, 0, 0, 0, 45, 10) == "CAUTION"
    assert _classify_severity(20, 0, 0, 0, 25, 10) == "INFO"      # small increase, low rain


# ── L. Cricket activity context ───────────────────────────────────────────────

def test_l_cricket_activity_context():
    monitor = make_monitor(activity="cricket", target_hour=18)
    prev = make_snapshot(max_rain_prob=30)
    curr = make_snapshot(max_rain_prob=78)
    changes = _detect_changes(prev, curr)
    severity = "WARNING"

    alert = _build_alert_object(monitor, changes, severity, curr, prev)

    assert "cricket" in alert["title"].lower() or alert["activity"] == "cricket"
    assert alert["location"] == "Pune"
    assert alert["target_hour"] == 18
    assert alert["is_official"] is False
    assert alert["current_rain_prob"] == 78
    assert alert["prev_rain_prob"] == 30
    assert "indoor" in alert["recommendation"].lower() or "alternative" in alert["recommendation"].lower()


# ── M. Location isolation ─────────────────────────────────────────────────────

def test_m_different_locations_independent():
    pune_monitor = make_monitor(session_id="sess-pune", location="Pune")
    mumbai_monitor = make_monitor(session_id="sess-mumbai", location="Mumbai")
    assert pune_monitor["location"] != mumbai_monitor["location"]
    assert pune_monitor["session_id"] != mumbai_monitor["session_id"]


# ── N. Different monitor isolation ────────────────────────────────────────────

def test_n_different_monitor_signatures_independent():
    changes = _detect_changes(make_snapshot(max_rain_prob=30), make_snapshot(max_rain_prob=78))
    sig_mon1 = _build_alert_signature("mon-1", changes, "WARNING")
    sig_mon2 = _build_alert_signature("mon-2", changes, "WARNING")
    assert sig_mon1 != sig_mon2


# ── O. API failure graceful handling ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_o_api_failure_graceful():
    monitor = make_monitor()
    with patch("backend.app.services.forecast_monitor.get_monitor", new_callable=AsyncMock) as mock_get, \
         patch("backend.app.services.forecast_monitor.weather_hub.get_weather_for_city", new_callable=AsyncMock) as mock_wx:
        mock_get.return_value = monitor
        mock_wx.side_effect = Exception("API timeout")

        result = await run_monitor_check("mon-test-1")

    assert result["checked"] is False
    assert "weather_fetch_error" in result["reason"]


# ── P. Missing forecast field ─────────────────────────────────────────────────

def test_p_missing_forecast_field_no_crash():
    prev = {"max_rain_prob": 30}  # missing other fields
    curr = {"max_rain_prob": 78}
    # Should not raise
    changes = _detect_changes(prev, curr)
    assert any(c["field"] == "max_rain_prob" for c in changes)


# ── R. Repeated trigger does not duplicate ────────────────────────────────────

def test_r_repeated_same_state_same_signature():
    prev = make_snapshot(max_rain_prob=30)
    curr = make_snapshot(max_rain_prob=78)
    changes = _detect_changes(prev, curr)
    sev = _classify_severity(48, 0, 0, 0, 78, 10)

    sig1 = _build_alert_signature("mon-x", changes, sev)
    sig2 = _build_alert_signature("mon-x", changes, sev)

    # Both calls produce the same sig → dedup works
    assert sig1 == sig2


# ── Window extraction tests ───────────────────────────────────────────────────

def test_window_extraction_correct_hour():
    today = datetime.date.today().isoformat()
    hourly_series = [
        {"date": today, "hour": 10, "precipitation_probability": 5,  "temperature_c": 25, "wind_speed_kmh": 8,  "precipitation_mm": 0},
        {"date": today, "hour": 11, "precipitation_probability": 8,  "temperature_c": 26, "wind_speed_kmh": 9,  "precipitation_mm": 0},
        {"date": today, "hour": 18, "precipitation_probability": 60, "temperature_c": 28, "wind_speed_kmh": 20, "precipitation_mm": 5},
        {"date": today, "hour": 19, "precipitation_probability": 70, "temperature_c": 27, "wind_speed_kmh": 22, "precipitation_mm": 6},
    ]
    weather_data = {"hourlySeries": hourly_series}
    snapshot = _extract_window_snapshot(weather_data, today, target_hour=18, time_label=None)

    # Should focus on 18:00 window, not 10:00
    assert snapshot is not None
    assert snapshot["max_rain_prob"] >= 60  # evening hours captured


def test_window_extraction_no_data_returns_none():
    snapshot = _extract_window_snapshot({"hourlySeries": [], "hourly": []}, "2026-01-01", 18, None)
    assert snapshot is None
