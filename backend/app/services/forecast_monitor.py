"""
Phase 4: Forecast Monitor Service
Implements the deterministic forecast change detection engine.

Architecture:
  Manual API → ForecastMonitor → fetch forecast → compare vs baseline → detect change → alert

Key design decisions:
- Monitors are stored in Redis under `monitor:<monitor_id>`
- Monitor index per session: `monitors:session:<session_id>`
- Forecast baseline: `forecast_baseline:<monitor_id>`
- Alert history per session: `alerts:session:<session_id>` (list, newest first)
- Deduplication: `last_alert_signature:<monitor_id>` (hash of location:target_date:target_hour:severity:from_val:to_val)

Change Thresholds (documented):
  Rain probability:   > 20 percentage-point change
  Temperature:        > 3 °C change
  Wind speed:         > 15 km/h change
  Precipitation:      > 5 mm change

Severity mapping:
  CRITICAL  — rain >= 80% with precip > 15 mm  or  very severe wind > 50 km/h
  WARNING   — rain >= 60%  or  temp change >= 6°C  or  wind >= 35 km/h
  CAUTION   — rain >= 40%  or  temp change >= 3°C  or  wind >= 15 km/h
  INFO      — any other meaningful change that crossed a threshold
"""

import uuid
import json
import logging
import datetime
import hashlib
from typing import Dict, Any, List, Optional, Tuple

from backend.app.core.cache import cache
from backend.app.services.weather_hub import weather_hub

logger = logging.getLogger("skycast.forecast_monitor")

# ── TTLs ──────────────────────────────────────────────────────────────────────
MONITOR_TTL_SECONDS      = 86400 * 7   # 7 days
BASELINE_TTL_SECONDS     = 86400       # 24 hours
ALERT_HISTORY_TTL        = 86400 * 3   # 3 days
LAST_SIGNATURE_TTL       = 3600        # 1 hour per signature slot

# ── Change thresholds ─────────────────────────────────────────────────────────
THRESHOLD_RAIN_PROB_PCT  = 20    # percentage points
THRESHOLD_TEMP_C         = 3.0   # degrees C
THRESHOLD_WIND_KMPH      = 15.0  # km/h
THRESHOLD_PRECIP_MM      = 5.0   # mm

# ── Redis key helpers ─────────────────────────────────────────────────────────

def _monitor_key(monitor_id: str) -> str:
    return f"monitor:{monitor_id}"

def _session_monitors_key(session_id: str) -> str:
    return f"monitors:session:{session_id}"

def _baseline_key(monitor_id: str) -> str:
    return f"forecast_baseline:{monitor_id}"

def _alerts_key(session_id: str) -> str:
    return f"alerts:session:{session_id}"

def _last_sig_key(monitor_id: str) -> str:
    return f"last_alert_signature:{monitor_id}"


# ── Monitor CRUD ──────────────────────────────────────────────────────────────

async def create_monitor(
    session_id: str,
    location: str,
    activity: Optional[str] = None,
    target_date: Optional[str] = None,
    target_hour: Optional[int] = None,
    time_label: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Create and persist a new monitor context in Redis.
    Returns the monitor dict.
    """
    monitor_id = str(uuid.uuid4())
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    monitor = {
        "monitor_id": monitor_id,
        "session_id": session_id,
        "location": location,
        "activity": activity,
        "target_date": target_date or datetime.date.today().isoformat(),
        "target_hour": target_hour,
        "time_label": time_label,
        "latitude": latitude,
        "longitude": longitude,
        "enabled": True,
        "created_at": now_iso,
        "last_checked_at": None,
    }

    await cache.set(_monitor_key(monitor_id), monitor, ttl=MONITOR_TTL_SECONDS)

    # Add this monitor_id to the session's index list
    session_monitors = await cache.get(_session_monitors_key(session_id)) or []
    if monitor_id not in session_monitors:
        session_monitors.append(monitor_id)
    await cache.set(_session_monitors_key(session_id), session_monitors, ttl=MONITOR_TTL_SECONDS)

    logger.info("🔔 [MONITOR] Created monitor %s for session %s (%s %s %s)",
                monitor_id, session_id, location, activity or "", time_label or "")
    return monitor


async def get_monitor(monitor_id: str) -> Optional[Dict[str, Any]]:
    return await cache.get(_monitor_key(monitor_id))


async def get_monitors_for_session(session_id: str) -> List[Dict[str, Any]]:
    """Returns all monitors for a session."""
    ids = await cache.get(_session_monitors_key(session_id)) or []
    monitors = []
    for mid in ids:
        m = await cache.get(_monitor_key(mid))
        if m and m.get("enabled"):
            monitors.append(m)
    return monitors


async def disable_monitor(monitor_id: str) -> bool:
    m = await cache.get(_monitor_key(monitor_id))
    if not m:
        return False
    m["enabled"] = False
    await cache.set(_monitor_key(monitor_id), m, ttl=MONITOR_TTL_SECONDS)
    return True


# ── Forecast extraction ───────────────────────────────────────────────────────

def _extract_window_snapshot(
    weather_data: Dict[str, Any],
    target_date: str,
    target_hour: Optional[int],
    time_label: Optional[str],
) -> Optional[Dict[str, Any]]:
    """
    Extract a focused forecast snapshot for the monitored time window.
    Returns a dict with rain_prob, temp, wind, precip for the relevant hours.
    """
    hourly_series = weather_data.get("hourlySeries", [])

    # Filter to the target date
    date_slots = [
        h for h in hourly_series
        if h.get("date") == target_date
        or str(h.get("time_iso", "")).startswith(target_date)
    ]

    if not date_slots:
        # Fallback to next 24 h from hourly
        date_slots = weather_data.get("hourly", [])

    if not date_slots:
        return None

    # Resolve comparison window
    if target_hour is not None:
        # Compare a 2-hour window centred on target_hour
        window = [s for s in date_slots if abs((s.get("hour") or 0) - target_hour) <= 1]
        if not window:
            # Widen search
            window = [s for s in date_slots if abs((s.get("hour") or 0) - target_hour) <= 2]
        if not window:
            window = date_slots
    elif time_label:
        label_map = {
            "morning":   (6, 12),
            "afternoon": (12, 17),
            "evening":   (17, 21),
            "night":     (21, 24),
        }
        lo, hi = label_map.get(time_label.lower(), (0, 24))
        window = [s for s in date_slots if lo <= (s.get("hour") or 0) < hi]
        if not window:
            window = date_slots
    else:
        window = date_slots

    rain_probs = [s.get("precipitation_probability", s.get("rainChance", 0)) or 0 for s in window]
    temps      = [s.get("temperature_c", s.get("tempC", 0)) or 0 for s in window]
    winds      = [s.get("wind_speed_kmh", s.get("windSpeed", 0)) or 0 for s in window]
    precips    = [s.get("precipitation_mm", 0) or 0 for s in window]

    return {
        "max_rain_prob":  max(rain_probs),
        "avg_rain_prob":  round(sum(rain_probs) / len(rain_probs), 1),
        "max_temp":       max(temps),
        "min_temp":       min(temps),
        "max_wind":       max(winds),
        "total_precip":   round(sum(precips), 1),
        "slot_count":     len(window),
        "target_date":    target_date,
        "target_hour":    target_hour,
        "snapshot_at":    datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


# ── Change detection ──────────────────────────────────────────────────────────

def _classify_severity(
    rain_delta: float,
    temp_delta: float,
    wind_delta: float,
    precip_delta: float,
    new_rain: float,
    new_wind: float,
) -> str:
    """
    Deterministic severity classification.
    CRITICAL reserved for genuinely severe conditions.
    """
    if (new_rain >= 80 and precip_delta > 15) or new_wind > 50:
        return "CRITICAL"
    if new_rain >= 60 or abs(temp_delta) >= 6 or new_wind >= 35:
        return "WARNING"
    if new_rain >= 40 or abs(temp_delta) >= 3 or new_wind >= 15:
        return "CAUTION"
    return "INFO"


def _detect_changes(
    prev: Dict[str, Any],
    curr: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Compare two forecast snapshots and return a list of meaningful changes.
    Each change: {field, prev_val, curr_val, delta, label, unit}
    Only returns changes that cross the documented thresholds.
    """
    changes = []

    def _check(field, prev_val, curr_val, threshold, label, unit, fmt=".0f"):
        if prev_val is None or curr_val is None:
            return
        delta = curr_val - prev_val
        if abs(delta) >= threshold:
            changes.append({
                "field":    field,
                "prev_val": round(prev_val, 1),
                "curr_val": round(curr_val, 1),
                "delta":    round(delta, 1),
                "label":    label,
                "unit":     unit,
                "worsened": curr_val > prev_val if field in ("max_rain_prob", "max_wind", "total_precip") else False,
            })

    _check("max_rain_prob", prev.get("max_rain_prob"), curr.get("max_rain_prob"),
           THRESHOLD_RAIN_PROB_PCT, "Rain probability", "%")
    _check("max_temp", prev.get("max_temp"), curr.get("max_temp"),
           THRESHOLD_TEMP_C, "Temperature", "°C")
    _check("max_wind", prev.get("max_wind"), curr.get("max_wind"),
           THRESHOLD_WIND_KMPH, "Wind speed", "km/h")
    _check("total_precip", prev.get("total_precip"), curr.get("total_precip"),
           THRESHOLD_PRECIP_MM, "Rainfall", "mm")

    return changes


def _build_alert_signature(
    monitor_id: str,
    changes: List[Dict[str, Any]],
    severity: str,
) -> str:
    """
    Build a deduplication signature based on the observed change event,
    not just current severity. This ensures 78%→78% doesn't re-alert,
    but 78%→95% would create a new alert if it crosses the threshold.
    """
    parts = [monitor_id, severity]
    for c in sorted(changes, key=lambda x: x["field"]):
        # Quantise to nearest 10pp/5°C/10kmh to avoid near-identical re-alerts
        prev_q = round(c["prev_val"] / 10) * 10
        curr_q = round(c["curr_val"] / 10) * 10
        parts.append(f"{c['field']}:{prev_q}->{curr_q}")
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _build_recommendation(changes: List[Dict[str, Any]], activity: Optional[str]) -> str:
    """Generate a deterministic recommendation based on detected changes."""
    act = activity or "outdoor activity"
    high_rain = any(c["field"] == "max_rain_prob" and c["curr_val"] >= 60 for c in changes)
    rain_increase = any(c["field"] == "max_rain_prob" and c["worsened"] for c in changes)
    high_wind = any(c["field"] == "max_wind" and c["curr_val"] >= 35 for c in changes)
    high_temp = any(c["field"] == "max_temp" and c["curr_val"] >= 38 for c in changes)

    if high_rain and rain_increase:
        return f"Prepare an indoor or covered alternative for your {act}. Carry rain gear if proceeding."
    if rain_increase:
        return f"Monitor the rain forecast closely before committing to {act}. Keep a backup plan."
    if high_wind:
        return f"Strong wind conditions expected. Secure loose equipment and reconsider outdoor {act}."
    if high_temp:
        return f"Very high temperatures forecast. Stay hydrated and schedule {act} earlier in the day."
    return f"Review updated conditions before your {act} and adjust plans accordingly."


def _build_alert_object(
    monitor: Dict[str, Any],
    changes: List[Dict[str, Any]],
    severity: str,
    curr_snapshot: Dict[str, Any],
    prev_snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    location = monitor.get("location", "Unknown")
    activity = monitor.get("activity")
    time_label = monitor.get("time_label", "")
    target_date = monitor.get("target_date", "")
    target_hour = monitor.get("target_hour")

    # Build time display
    if target_hour is not None:
        time_display = f"{target_hour:02d}:00"
    elif time_label:
        time_display = time_label.title()
    else:
        time_display = "Today"

    # Primary change (the most severe / rain-first)
    primary = sorted(changes, key=lambda c: (
        c["field"] == "max_rain_prob",
        abs(c["delta"]),
    ), reverse=True)[0] if changes else None

    title_parts = [f"Weather Update"]
    if activity:
        title_parts = [f"{'Cricket' if 'cricket' in (activity or '').lower() else activity.title()} Weather Update"]

    return {
        "alert_id":      str(uuid.uuid4()),
        "monitor_id":    monitor["monitor_id"],
        "session_id":    monitor["session_id"],
        "type":          "forecast_change",
        "severity":      severity,
        "location":      location,
        "activity":      activity,
        "target_date":   target_date,
        "target_hour":   target_hour,
        "time_label":    time_label,
        "time_display":  time_display,
        "title":         " · ".join(title_parts),
        "changes":       changes,
        "primary_change": primary,
        "recommendation": _build_recommendation(changes, activity),
        "why":           f"The forecast for {location} {time_display} has changed significantly.",
        "current_rain_prob": curr_snapshot.get("max_rain_prob"),
        "prev_rain_prob":    prev_snapshot.get("max_rain_prob"),
        "created_at":    now_iso,
        "is_official":   False,   # never claim official status
    }


# ── Main check function ───────────────────────────────────────────────────────

async def run_monitor_check(monitor_id: str) -> Dict[str, Any]:
    """
    Execute one monitoring cycle for a single monitor.
    Returns a result dict:
      { checked, monitor_id, changes_detected, alert_created, alert, reason }
    """
    monitor = await get_monitor(monitor_id)
    if not monitor:
        return {"checked": False, "monitor_id": monitor_id, "reason": "monitor_not_found"}
    if not monitor.get("enabled"):
        return {"checked": False, "monitor_id": monitor_id, "reason": "monitor_disabled"}

    location = monitor["location"]
    target_date = monitor["target_date"]
    target_hour = monitor.get("target_hour")
    time_label = monitor.get("time_label")

    # Fetch current forecast
    try:
        weather_data = await weather_hub.get_weather_for_city(location)
    except Exception as exc:
        logger.warning("ForecastMonitor: failed to fetch weather for %s: %s", location, exc)
        return {
            "checked": False, "monitor_id": monitor_id,
            "reason": f"weather_fetch_error: {exc}"
        }

    curr_snapshot = _extract_window_snapshot(weather_data, target_date, target_hour, time_label)
    if curr_snapshot is None:
        return {"checked": True, "monitor_id": monitor_id, "reason": "no_forecast_data"}

    # Load baseline
    prev_snapshot = await cache.get(_baseline_key(monitor_id))

    # Update last_checked_at
    monitor["last_checked_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await cache.set(_monitor_key(monitor_id), monitor, ttl=MONITOR_TTL_SECONDS)

    # First check: establish baseline, no alert
    if prev_snapshot is None:
        await cache.set(_baseline_key(monitor_id), curr_snapshot, ttl=BASELINE_TTL_SECONDS)
        logger.info("ForecastMonitor: baseline established for %s (%s, rain=%.0f%%)",
                    monitor_id, location, curr_snapshot.get("max_rain_prob", 0))
        return {
            "checked": True,
            "monitor_id": monitor_id,
            "changes_detected": False,
            "alert_created": False,
            "reason": "baseline_established",
            "snapshot": curr_snapshot,
        }

    # Detect changes vs baseline
    changes = _detect_changes(prev_snapshot, curr_snapshot)
    if not changes:
        return {
            "checked": True,
            "monitor_id": monitor_id,
            "changes_detected": False,
            "alert_created": False,
            "reason": "no_significant_change",
        }

    # Classify severity
    rain_delta  = next((c["delta"] for c in changes if c["field"] == "max_rain_prob"), 0)
    temp_delta  = next((c["delta"] for c in changes if c["field"] == "max_temp"), 0)
    wind_delta  = next((c["delta"] for c in changes if c["field"] == "max_wind"), 0)
    precip_delta = next((c["delta"] for c in changes if c["field"] == "total_precip"), 0)

    severity = _classify_severity(
        rain_delta=rain_delta,
        temp_delta=temp_delta,
        wind_delta=wind_delta,
        precip_delta=precip_delta,
        new_rain=curr_snapshot.get("max_rain_prob", 0),
        new_wind=curr_snapshot.get("max_wind", 0),
    )

    # Deduplication
    signature = _build_alert_signature(monitor_id, changes, severity)
    last_sig = await cache.get(_last_sig_key(monitor_id))
    if last_sig == signature:
        logger.info("ForecastMonitor: duplicate suppressed for %s (sig=%s)", monitor_id, signature)
        return {
            "checked": True,
            "monitor_id": monitor_id,
            "changes_detected": True,
            "alert_created": False,
            "reason": "duplicate_suppressed",
            "changes": changes,
        }

    # Build and persist alert
    alert = _build_alert_object(monitor, changes, severity, curr_snapshot, prev_snapshot)
    await _store_alert(monitor["session_id"], alert)
    await cache.set(_last_sig_key(monitor_id), signature, ttl=LAST_SIGNATURE_TTL)

    # Update baseline to current (rolling baseline)
    await cache.set(_baseline_key(monitor_id), curr_snapshot, ttl=BASELINE_TTL_SECONDS)

    logger.info("🚨 ForecastMonitor: alert created for %s (sev=%s, sig=%s)", monitor_id, severity, signature)

    return {
        "checked": True,
        "monitor_id": monitor_id,
        "changes_detected": True,
        "alert_created": True,
        "alert": alert,
        "reason": "alert_generated",
        "changes": changes,
    }


async def _store_alert(session_id: str, alert: Dict[str, Any]):
    """Prepend alert to session alert history (list, newest first)."""
    key = _alerts_key(session_id)
    existing = await cache.get(key) or []
    existing.insert(0, alert)
    existing = existing[:50]  # keep last 50
    await cache.set(key, existing, ttl=ALERT_HISTORY_TTL)


async def get_alert_history(session_id: str) -> List[Dict[str, Any]]:
    return await cache.get(_alerts_key(session_id)) or []
