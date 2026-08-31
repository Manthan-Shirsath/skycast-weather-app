"""
WeatherGPT Agent Tool Implementations
All tools interact strictly with WeatherDataHub, HistoryService, and AlertDetectionService.
Zero external provider calls or direct HTTP requests are made by any tool.
"""

import re
import datetime
from typing import Dict, Any, List, Optional
import logging


from backend.app.services.weather_hub import weather_hub
from backend.app.services.alert_service import alert_service
from backend.app.services.history_service import HistoryService
from backend.app.services.agent.schemas import (
    LocationSearchArgs,
    CurrentWeatherArgs,
    ForecastArgs,
    RiskArgs,
    AlertsArgs,
    HistoricalArgs,
    TrendsArgs,
    MapWeatherArgs,
    FreshnessArgs,
    AgricultureArgs,
    RecommendationArgs,
    LocationComparisonArgs,
    DateComparisonArgs,
    AlertExplanationArgs,
    AnalyzeRainArgs
)

logger = logging.getLogger("skycast.agent.tools")


# ==============================================================================
# Tool 1: search_location
# ==============================================================================

async def search_location_tool(args: LocationSearchArgs) -> Dict[str, Any]:
    """Resolves a natural language location into normalized coordinates & metadata."""
    query_clean = args.query.strip()
    if not query_clean:
        return {"error": "Location query cannot be empty"}

    geo = await weather_hub.provider.geocode_city(query_clean)
    if not geo:
        return {
            "found": False,
            "message": f"Could not find geographic coordinates for '{query_clean}'."
        }

    return {
        "found": True,
        "name": geo.get("name", query_clean.title()),
        "latitude": geo["latitude"],
        "longitude": geo["longitude"],
        "region": geo.get("admin1", ""),
        "country": geo.get("country", ""),
        "timezone": geo.get("timezone", "auto")
    }

# ==============================================================================
# Tool 1b: analyze_rain
# ==============================================================================

async def analyze_rain_tool(args: AnalyzeRainArgs) -> Dict[str, Any]:
    """Analyzes rain timing, duration, and dry windows for a given period."""
    loc_clean = args.location.strip()
    if not loc_clean:
        return {"error": "Location is required"}

    data = await weather_hub.get_weather_for_city(loc_clean)
    hourly_series = data.get("hourlySeries", [])
    
    today_iso = datetime.date.today().isoformat()
    target_date_iso = today_iso
    
    if args.date:
        d_lower = args.date.strip().lower()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", d_lower):
            target_date_iso = d_lower
        elif d_lower in ["tomorrow", "tmrw", "उद्या", "udya"]:
            target_date_iso = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        elif d_lower in ["today", "आज", "now"]:
            target_date_iso = today_iso
        elif d_lower in ["day_after_tomorrow", "परवा"]:
            target_date_iso = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()
        else:
            # Check weekday
            for day_word, target_weekday in [
                ("monday", 0), ("tuesday", 1), ("wednesday", 2), ("thursday", 3),
                ("friday", 4), ("saturday", 5), ("sunday", 6),
                ("सोमवार", 0), ("मंगळवार", 1), ("बुधवार", 2), ("गुरुवार", 3),
                ("शुक्रवार", 4), ("शनिवार", 5), ("रविवार", 6)
            ]:
                if day_word in d_lower:
                    cur_wd = datetime.date.today().weekday()
                    ahead = (target_weekday - cur_wd) % 7
                    if ahead == 0:
                        ahead = 7
                    target_date_iso = (datetime.date.today() + datetime.timedelta(days=ahead)).isoformat()
                    break

    from backend.app.services.agent.rain_evaluator import RainEvaluator
    
    return RainEvaluator.evaluate_rain(
        location=data.get("city", loc_clean),
        date_iso=target_date_iso,
        time_range=args.time_range,
        hourly_series=hourly_series
    )



# ==============================================================================
# Tool 2: get_current_weather
# ==============================================================================

async def get_current_weather_tool(args: CurrentWeatherArgs) -> Dict[str, Any]:
    """Retrieves normalized current weather for a city or coordinates from WeatherDataHub."""
    if args.lat is not None and args.lon is not None:
        data = await weather_hub.get_point_weather(args.lat, args.lon)
        return {
            "location": f"Coordinates ({args.lat}, {args.lon})",
            "temperature_c": data.get("temperature"),
            "feels_like_c": data.get("feelsLike"),
            "condition": data.get("condition"),
            "humidity_pct": data.get("humidity"),
            "precipitation_mm": data.get("precipitation"),
            "wind_speed_kmh": data.get("windSpeed"),
            "wind_direction": data.get("windDirection"),
            "cloud_cover_pct": data.get("cloudCover"),
            "pressure_hpa": data.get("pressure"),
            "stale": data.get("stale", False),
            "observed_at": data.get("updatedAt"),
            "nwp_model": data.get("nwpModel", "NOAA GFS (Global Forecast System)"),
            "nwp_source": data.get("nwpSource", "gfs_seamless"),
            "source": "central_weather_hub"
        }

    loc_clean = args.location.strip()
    if not loc_clean:
        return {"error": "Location is required"}

    data = await weather_hub.get_weather_for_city(loc_clean)
    details = data.get("details", {})
    insight = data.get("insight", {})
    rain_prob = data.get("precipitation_probability", insight.get("rainChance", 0))

    return {
        "location": data.get("city", loc_clean),
        "display_location": data.get("displayLocation", loc_clean),
        "temperature_c": data.get("tempC"),
        "feels_like_c": data.get("feelsLikeC"),
        "condition": data.get("condition"),
        "humidity_pct": data.get("humidity"),
        "precipitation_mm": details.get("precipitationMm", 0.0),
        "precipitation_probability": rain_prob,
        "rain_chance_pct": rain_prob,
        "wind_speed_kmh": data.get("windSpeedKmh"),
        "wind_direction": details.get("windDirection", "N"),
        "pressure_hpa": details.get("pressureHpa", 1013),
        "visibility_km": details.get("visibilityKm", 10.0),
        "uv_index": details.get("uvIndex", 0.0),
        "cloud_cover_pct": details.get("cloudCoverPct", 40),
        "stale": data.get("stale", False),
        "observed_at": data.get("observedAt", data.get("fetchedAt")),
        "nwp_model": data.get("nwpModel", "NOAA GFS (Global Forecast System)"),
        "nwp_source": data.get("nwpSource", "gfs_seamless"),
        "source": "central_weather_hub"
    }


# ==============================================================================
# Tool 3: get_forecast
# ==============================================================================

async def get_forecast_tool(args: ForecastArgs) -> Dict[str, Any]:
    """Retrieves concise hourly & daily forecast projections from WeatherDataHub with date & time awareness."""
    loc_clean = args.location.strip()
    if not loc_clean:
        return {"error": "Location is required"}

    data = await weather_hub.get_weather_for_city(loc_clean)
    days_limit = max(1, min(7, args.days or 5))

    daily_raw = data.get("daily", [])
    hourly_raw = data.get("hourly", [])
    hourly_series = data.get("hourlySeries", [])

    today_iso = datetime.date.today().isoformat()

    # 1. Resolve Target Date
    target_date_iso = today_iso
    if args.date:
        d_lower = args.date.strip().lower()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", d_lower):
            target_date_iso = d_lower
        elif d_lower in ["tomorrow", "tmrw", "उद्या", "udya"]:
            target_date_iso = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        elif d_lower in ["today", "आज", "now"]:
            target_date_iso = today_iso
        elif d_lower in ["day_after_tomorrow", "परवा"]:
            target_date_iso = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()
        else:
            # Check weekday
            for day_word, target_weekday in [
                ("monday", 0), ("tuesday", 1), ("wednesday", 2), ("thursday", 3),
                ("friday", 4), ("saturday", 5), ("sunday", 6),
                ("सोमवार", 0), ("मंगळवार", 1), ("बुधवार", 2), ("गुरुवार", 3),
                ("शुक्रवार", 4), ("शनिवार", 5), ("रविवार", 6)
            ]:
                if day_word in d_lower:
                    cur_wd = datetime.date.today().weekday()
                    ahead = (target_weekday - cur_wd) % 7
                    if ahead == 0:
                        ahead = 7
                    target_date_iso = (datetime.date.today() + datetime.timedelta(days=ahead)).isoformat()
                    break

    # Find matching daily item
    target_daily = None
    for d in daily_raw:
        if d.get("date_iso") == target_date_iso:
            target_daily = d
            break
    if not target_daily and daily_raw:
        if target_date_iso == (datetime.date.today() + datetime.timedelta(days=1)).isoformat() and len(daily_raw) > 1:
            target_daily = daily_raw[1]
        else:
            target_daily = daily_raw[0]

    # 2. Extract Specific Date Hourly Slots from hourly_series
    date_hourly_slots = [
        h for h in hourly_series
        if h.get("date") == target_date_iso or str(h.get("time_iso", "")).startswith(target_date_iso)
    ]
    if not date_hourly_slots:
        # Fallback to next 24h slots if multi-day series not available
        date_hourly_slots = hourly_raw

    # 3. Resolve Target Hour / Specific Time
    target_hour = None
    if args.time:
        t_clean = args.time.strip().lower()
        m_clock = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", t_clean)
        if m_clock:
            hr_val = int(m_clock.group(1))
            meridiem = m_clock.group(3)
            if meridiem == "pm" and hr_val < 12:
                hr_val += 12
            elif meridiem == "am" and hr_val == 12:
                hr_val = 0
            target_hour = hr_val

    # 4. Resolve Target Time Range
    time_range_key = args.time_range.strip().lower() if args.time_range else None
    if not time_range_key and target_hour is not None:
        if 17 <= target_hour <= 21:
            time_range_key = "evening"
        elif 6 <= target_hour <= 11:
            time_range_key = "morning"
        elif 12 <= target_hour <= 16:
            time_range_key = "afternoon"
        elif target_hour >= 22 or target_hour <= 5:
            time_range_key = "night"

    # 5. Build Period / Hourly Targeted Slice
    target_period = None
    if target_hour is not None:
        # Find exact matching hour slot
        matched_slot = None
        for s in date_hourly_slots:
            s_hr = s.get("hour")
            if s_hr is None and ":" in str(s.get("time", "")):
                try:
                    s_hr = int(str(s.get("time")).split(":")[0])
                except Exception:
                    pass
            if s_hr == target_hour:
                matched_slot = s
                break

        if not matched_slot and date_hourly_slots:
            matched_slot = date_hourly_slots[0]

        if matched_slot:
            rain_pct = matched_slot.get("precipitation_probability", matched_slot.get("rain_probability_pct", matched_slot.get("rainChance", 0)))
            precip_mm = matched_slot.get("precipitation_mm", matched_slot.get("precipitation", 0.0))
            temp_val = matched_slot.get("temperature_c", matched_slot.get("tempC", 25))
            feels_val = matched_slot.get("feels_like_c", matched_slot.get("feelsLikeC", temp_val))
            cond_val = matched_slot.get("condition", "Cloudy")
            wind_val = matched_slot.get("wind_speed_kmh", matched_slot.get("windSpeed", 10))

            # Evaluate activity suitability at this specific hour
            activity_eval = None
            if args.activity:
                act = args.activity.lower()
                if rain_pct >= 60 or precip_mm >= 1.0:
                    status = "unfavorable"
                    reason = f"High rain probability ({round(rain_pct)}%) and wet conditions at {target_hour:02d}:00."
                    recommendation = f"Playing {act} outdoors is not recommended due to rain/wet ground risk. Consider indoor alternatives."
                elif rain_pct >= 30 or precip_mm >= 0.3:
                    status = "marginal"
                    reason = f"Moderate rain chance ({round(rain_pct)}%) around {target_hour:02d}:00."
                    recommendation = f"Possible to play {act}, but keep an umbrella handy and check local radar."
                else:
                    status = "favorable"
                    reason = f"Favorable conditions ({cond_val}, {round(temp_val)}°C, rain chance {round(rain_pct)}%) at {target_hour:02d}:00."
                    recommendation = f"Great time for {act} outdoors!"

                activity_eval = {
                    "activity": args.activity,
                    "status": status,
                    "reason": reason,
                    "recommendation": recommendation,
                    "target_date": target_date_iso,
                    "target_time": f"{target_hour:02d}:00",
                    "precipitation_probability": round(rain_pct),
                    "temperature_c": round(temp_val),
                    "condition": cond_val
                }

            target_period = {
                "period_type": "exact_hour",
                "date": target_date_iso,
                "hour": f"{target_hour:02d}:00",
                "temperature_c": round(temp_val),
                "feels_like_c": round(feels_val),
                "precipitation_probability": round(rain_pct),
                "rain_chance_pct": round(rain_pct),  # Exact hourly probability
                "precipitation_mm": round(precip_mm, 1),
                "condition": cond_val,
                "wind_speed_kmh": round(wind_val),
                "activity_suitability": activity_eval
            }

    elif time_range_key:
        range_bounds = {
            "morning": (6, 11),
            "afternoon": (12, 16),
            "evening": (17, 21),
            "night": (22, 23)
        }
        start_hr, end_hr = range_bounds.get(time_range_key, (17, 21))
        range_slots = [
            s for s in date_hourly_slots
            if s.get("hour") is not None and start_hr <= s.get("hour") <= end_hr
        ]
        if not range_slots:
            range_slots = date_hourly_slots[:4]

        if range_slots:
            avg_temp = sum(s.get("temperature_c", s.get("tempC", 25)) for s in range_slots) / len(range_slots)
            max_rain = max(s.get("precipitation_probability", s.get("rain_probability_pct", s.get("rainChance", 0))) for s in range_slots)
            avg_rain = sum(s.get("precipitation_probability", s.get("rain_probability_pct", s.get("rainChance", 0))) for s in range_slots) / len(range_slots)
            sum_precip = sum(s.get("precipitation_mm", s.get("precipitation", 0.0)) for s in range_slots)
            rep_cond = range_slots[0].get("condition", "Cloudy")

            activity_eval = None
            if args.activity:
                act = args.activity.lower()
                if max_rain >= 60 or sum_precip >= 1.5:
                    status = "unfavorable"
                    reason = f"Rain chance reaches {round(max_rain)}% during {time_range_key} with wet conditions."
                    recommendation = f"Outdoor {act} is not recommended in the {time_range_key}. Indoor alternative suggested."
                elif max_rain >= 30:
                    status = "marginal"
                    reason = f"Moderate rain chance ({round(max_rain)}%) during {time_range_key}."
                    recommendation = f"Check local weather radar before starting outdoor {act}."
                else:
                    status = "favorable"
                    reason = f"Good conditions ({rep_cond}, ~{round(avg_temp)}°C, rain chance {round(max_rain)}%) in {time_range_key}."
                    recommendation = f"{time_range_key.title()} is a good time for {act}."

                activity_eval = {
                    "activity": args.activity,
                    "status": status,
                    "reason": reason,
                    "recommendation": recommendation,
                    "target_date": target_date_iso,
                    "target_time": time_range_key,
                    "precipitation_probability": round(max_rain),
                    "temperature_c": round(avg_temp),
                    "condition": rep_cond
                }

            target_period = {
                "period_type": "time_range",
                "date": target_date_iso,
                "time_range": time_range_key,
                "window_hours": f"{start_hr:02d}:00 - {end_hr:02d}:00",
                "avg_temperature_c": round(avg_temp),
                "temperature_c": round(avg_temp),
                "precipitation_probability": round(max_rain),  # Real window max
                "rain_chance_pct": round(max_rain),
                "avg_precipitation_probability": round(avg_rain),
                "avg_rain_chance_pct": round(avg_rain),
                "total_precipitation_mm": round(sum_precip, 1),
                "precipitation_mm": round(sum_precip, 1),
                "condition": rep_cond,
                "activity_suitability": activity_eval,
                "slots": range_slots
            }

    elif args.activity:
        from backend.app.services.agent.activity_evaluator import ActivityEvaluator
        best_time_eval = ActivityEvaluator.evaluate_best_time(args.activity, date_hourly_slots, target_date_iso)
        if best_time_eval:
            target_period = {
                "period_type": "best_time",
                "date": target_date_iso,
                "hour": best_time_eval.get("recommended_start"),
                "temperature_c": best_time_eval.get("temperature_c"),
                "feels_like_c": best_time_eval.get("temperature_c"),
                "precipitation_probability": best_time_eval.get("precipitation_probability"),
                "rain_chance_pct": best_time_eval.get("precipitation_probability"),
                "precipitation_mm": 0.0,
                "condition": best_time_eval.get("condition"),
                "wind_speed_kmh": best_time_eval.get("wind", 10),
                "activity_suitability": best_time_eval
            }

    daily_summary = [
        {
            "day": d.get("day"),
            "date": d.get("date"),
            "date_iso": d.get("date_iso"),
            "high_c": d.get("highC", d.get("high_c")),
            "low_c": d.get("lowC", d.get("low_c")),
            "condition": d.get("condition"),
            "daily_precipitation_probability": d.get("daily_precipitation_probability", d.get("rainChance", d.get("rain_probability_pct", 0))),
            "precipitation_probability": d.get("daily_precipitation_probability", d.get("rainChance", d.get("rain_probability_pct", 0))),
            "rain_chance_pct": d.get("daily_precipitation_probability", d.get("rainChance", d.get("rain_probability_pct", 0))),
            "precipitation_sum_mm": d.get("precipitationSum", d.get("precipitation_sum_mm", 0.0)),
            "wind_speed_max_kmh": d.get("windSpeedMax", d.get("wind_speed_max_kmh", 0.0))
        }
        for d in daily_raw[:days_limit]
    ]

    hourly_summary = [
        {
            "time": h.get("time"),
            "temperature_c": h.get("tempC", h.get("temperature_c")),
            "feels_like_c": h.get("feelsLikeC", h.get("feels_like_c")),
            "condition": h.get("condition"),
            "precipitation_probability": h.get("precipitation_probability", h.get("rainChance", h.get("rain_probability_pct", 0))),
            "rain_chance_pct": h.get("precipitation_probability", h.get("rainChance", h.get("rain_probability_pct", 0)))
        }
        for h in (date_hourly_slots[:12] if date_hourly_slots else hourly_raw[:12])
    ]

    target_daily_rain = target_daily.get("daily_precipitation_probability", target_daily.get("rainChance", target_daily.get("rain_probability_pct", 0))) if target_daily else 0

    return {
        "location": data.get("city", loc_clean),
        "target_date": target_date_iso,
        "target_period": target_period,
        "day_forecast": {
            "day": target_daily.get("day") if target_daily else "Day",
            "date": target_daily.get("date") if target_daily else target_date_iso,
            "date_iso": target_daily.get("date_iso") if target_daily else target_date_iso,
            "high_c": target_daily.get("highC", target_daily.get("high_c", 28)) if target_daily else 28,
            "low_c": target_daily.get("lowC", target_daily.get("low_c", 22)) if target_daily else 22,
            "condition": target_daily.get("condition", "Cloudy") if target_daily else "Cloudy",
            "daily_precipitation_probability": target_daily_rain,
            "precipitation_probability": target_daily_rain,
            "daily_rain_chance_pct": target_daily_rain,
            "precipitation_sum_mm": target_daily.get("precipitationSum", target_daily.get("precipitation_sum_mm", 0.0)) if target_daily else 0.0
        } if target_daily else None,
        "daily_forecast": daily_summary,
        "hourly_forecast": hourly_summary,
        "stale": data.get("stale", False),
        "nwp_model": data.get("nwpModel", "NOAA GFS (Global Forecast System)"),
        "nwp_source": data.get("nwpSource", "gfs_seamless"),
        "source": "central_weather_hub"
    }



# ==============================================================================
# Tool 4: get_weather_risk
# ==============================================================================

async def get_weather_risk_tool(args: RiskArgs) -> Dict[str, Any]:
    """Evaluates computational Skycast Weather Risk assessment based on published IMD criteria."""
    loc_clean = args.location.strip()
    if not loc_clean:
        return {"error": "Location is required"}

    weather_data = await weather_hub.get_weather_for_city(loc_clean)
    alerts_data = await alert_service.get_alerts_for_city(loc_clean, weather_data)

    active_alerts = [
        {
            "hazard": a.get("hazard"),
            "classification": a.get("hazardClassification"),
            "risk_colour": a.get("skycastRiskColour", a.get("riskColour", "green")),
            "action": a.get("actionDirective", "No Action"),
            "title": a.get("title"),
            "measured_value": a.get("measuredValue"),
            "unit": a.get("unit"),
            "threshold": a.get("threshold"),
            "explanation": a.get("explanation"),
            "official": False
        }
        for a in alerts_data.get("alerts", [])
        if a.get("riskColour") in ["yellow", "orange", "red"] or a.get("hazard") != "none"
    ]

    return {
        "location": alerts_data.get("city", loc_clean),
        "highest_risk_colour": alerts_data.get("highestRiskColour", "green"),
        "highest_risk_action": alerts_data.get("highestRiskAction", "No Action"),
        "has_active_hazard": alerts_data.get("hasHazard", False),
        "active_risks": active_alerts,
        "upcoming_risks": alerts_data.get("upcomingRisks", []),
        "disclaimer": "Skycast weather risks are derived from open numerical weather data based on published IMD warning criteria. They are NOT official IMD warnings."
    }


# ==============================================================================
# Tool 5: get_weather_alerts
# ==============================================================================

async def get_weather_alerts_tool(args: AlertsArgs) -> Dict[str, Any]:
    """Retrieves active meteorological alerts from the centralized alerts subsystem."""
    if args.location and args.location.strip():
        return await get_weather_risk_tool(RiskArgs(location=args.location))

    all_alerts_res = await alert_service.get_all_active_alerts()
    return {
        "active_alerts_count": all_alerts_res.get("count", 0),
        "alerts": all_alerts_res.get("alerts", []),
        "source": "central_weather_hub"
    }


# ==============================================================================
# Tool 6: get_historical_weather
# ==============================================================================

async def get_historical_weather_tool(args: HistoricalArgs) -> Dict[str, Any]:
    """Retrieves real stored historical weather observations from PostgreSQL."""
    loc_clean = args.location.strip().lower()
    days = max(1, min(30, args.range_days or 7))
    range_str = "24h" if days <= 1 else ("7d" if days <= 7 else "30d")

    trends = await HistoryService.get_trends(loc_clean, range_str=range_str)
    observations = trends.get("observations", [])

    if len(observations) < 2:
        return {
            "status": "insufficient_data",
            "location": args.location,
            "message": f"Not enough real historical observation snapshots recorded yet in PostgreSQL for {args.location}. Skycast only reports genuine historical observations."
        }

    # Filter metric if requested
    metric_data = None
    if args.metric:
        m_lower = args.metric.lower()
        if "temp" in m_lower:
            metric_data = trends.get("temperature")
        elif "rain" in m_lower or "precip" in m_lower:
            metric_data = trends.get("rainfall")
        elif "wind" in m_lower:
            metric_data = trends.get("wind")
        elif "hum" in m_lower:
            metric_data = trends.get("humidity")
        elif "press" in m_lower:
            metric_data = trends.get("pressure")

    return {
        "status": "ready",
        "location": args.location,
        "range": range_str,
        "observation_count": len(observations),
        "metric_summary": metric_data,
        "temperature_summary": trends.get("temperature"),
        "rainfall_summary": trends.get("rainfall"),
        "first_observation_at": observations[0]["time"] if observations else None,
        "latest_observation_at": observations[-1]["time"] if observations else None,
        "source": "postgresql_observations"
    }


# ==============================================================================
# Tool 7: get_weather_trends
# ==============================================================================

async def get_weather_trends_tool(args: TrendsArgs) -> Dict[str, Any]:
    """Retrieves calculated historical analytics, averages, risk transitions, and city comparisons."""
    loc_clean = args.location.strip()
    trends = await HistoryService.get_trends(
        city_name=loc_clean,
        range_str=args.range or "24h",
        compare_city=args.compare_with
    )

    if trends.get("status") == "insufficient_data":
        return {
            "status": "insufficient_data",
            "location": loc_clean,
            "message": f"Insufficient historical snapshots recorded for {loc_clean}."
        }

    return {
        "status": "ready",
        "location": loc_clean,
        "range": trends.get("rangeLabel", args.range),
        "temperature": trends.get("temperature"),
        "rainfall": trends.get("rainfall"),
        "wind": trends.get("wind"),
        "risk_transitions": trends.get("riskHistory", []),
        "forecast_vs_observed": trends.get("forecastVsObserved"),
        "comparison": trends.get("comparison"),
        "source": "postgresql_trends"
    }


# ==============================================================================
# Tool 8: get_map_weather
# ==============================================================================

async def get_map_weather_tool(args: MapWeatherArgs) -> Dict[str, Any]:
    """Retrieves the unified map weather dataset across key Indian cities."""
    map_dataset = await weather_hub.get_map_weather_dataset()
    cities = map_dataset.get("cities", [])

    # Minimize payload for LLM tokens
    summary_list = [
        {
            "name": c["name"],
            "state": c["state"],
            "temperature_c": c["temperature"],
            "condition": c["condition"],
            "rain_chance_pct": c["rainChance"],
            "wind_speed_kmh": c["windSpeed"],
            "has_alert": c.get("hasAlert", False),
            "alert_severity": c.get("alertSeverity", "normal")
        }
        for c in cities[:15]
    ]

    return {
        "total_monitored_cities": len(cities),
        "cities": summary_list,
        "source": "central_weather_hub"
    }


# ==============================================================================
# Tool 9: get_data_freshness
# ==============================================================================

async def get_data_freshness_tool(args: FreshnessArgs) -> Dict[str, Any]:
    """Inspects central cache timestamps and freshness status for a location."""
    clean_city = args.location.strip().lower()
    key = f"weather:city:{clean_city}"
    return await weather_hub.get_data_freshness(key)


# ==============================================================================
# Tool 10: get_agriculture_advice
# ==============================================================================

async def get_agriculture_advice_tool(args: AgricultureArgs) -> Dict[str, Any]:
    """Provides structured farming, spraying, irrigation, and crop weather risk advisory."""
    from backend.app.services.agriculture_service import AgricultureService
    return await AgricultureService.get_advisory(
        city_name=args.location,
        crop=args.crop or "Cotton",
        growth_stage=args.growth_stage or "Flowering"
    )


# ==============================================================================
# Tool 11: get_weather_recommendations
# ==============================================================================

async def get_weather_recommendations_tool(args: RecommendationArgs) -> Dict[str, Any]:
    """Provides grounded contextual guidance for everyday scenarios (umbrella, jacket, running, travel, events, drying clothes)."""
    from backend.app.services.recommendation_service import RecommendationService
    return await RecommendationService.get_recommendations(
        city_name=args.location,
        activity=args.activity or "all"
    )

# ==============================================================================
# Tool 12: show_visual_explanation
# ==============================================================================

async def show_visual_explanation_tool(args: Any) -> Dict[str, Any]:
    """
    Pass-through tool used by the LLM to render a structured visual explanation card AFTER retrieving data.
    """
    # In tools.py, arguments are typically unpacked into a Pydantic model by the executor.
    # Here, we just return the dictionary for the frontend to render.
    if hasattr(args, 'dict'):
        return args.dict()
    elif isinstance(args, dict):
        return args
    return {
        "phenomenon": getattr(args, "phenomenon", "Weather Condition"),
        "explanation": getattr(args, "explanation", ""),
        "visual_type": getattr(args, "visual_type", "general"),
        "available_facts": getattr(args, "available_facts", []),
        "unavailable_facts": getattr(args, "unavailable_facts", [])
    }


# ==============================================================================
# Tool 13: compare_locations
# ==============================================================================

async def compare_locations_tool(args: LocationComparisonArgs) -> Dict[str, Any]:
    """Compares weather or activity suitability across multiple locations."""
    from backend.app.services.agent.comparison_evaluator import ComparisonEvaluator
    
    if not args.locations or len(args.locations) < 2:
        return {"error": "At least two locations are required for comparison."}
        
    return await ComparisonEvaluator.evaluate_locations(args.locations, args.date, args.activity)


# ==============================================================================
# Tool 14: compare_dates
# ==============================================================================

async def compare_dates_tool(args: DateComparisonArgs) -> Dict[str, Any]:
    """Compares weather or activity suitability across multiple dates for a single location."""
    from backend.app.services.agent.comparison_evaluator import ComparisonEvaluator
    
    if not args.location:
        return {"error": "Location is required for date comparison."}
        
    if not args.dates or len(args.dates) < 2:
        return {"error": "At least two dates are required for comparison."}
        
    return await ComparisonEvaluator.evaluate_dates(args.location, args.dates, args.activity)


# ==============================================================================
# Tool 15: show_weather_alert
# ==============================================================================

async def show_weather_alert_tool(args: AlertExplanationArgs) -> Dict[str, Any]:
    """Pass-through tool used by the LLM to render a structured alert card AFTER retrieving data."""
    if hasattr(args, 'dict'):
        return args.dict()
    return args

