"""
WeatherGPT Agent Tool Implementations
All tools interact strictly with WeatherDataHub, HistoryService, and AlertDetectionService.
Zero external provider calls or direct HTTP requests are made by any tool.
"""

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
    RecommendationArgs
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
            "source": "central_weather_hub"
        }

    loc_clean = args.location.strip()
    if not loc_clean:
        return {"error": "Location is required"}

    data = await weather_hub.get_weather_for_city(loc_clean)
    details = data.get("details", {})
    insight = data.get("insight", {})

    return {
        "location": data.get("city", loc_clean),
        "display_location": data.get("displayLocation", loc_clean),
        "temperature_c": data.get("tempC"),
        "feels_like_c": data.get("feelsLikeC"),
        "condition": data.get("condition"),
        "humidity_pct": data.get("humidity"),
        "precipitation_mm": details.get("precipitationMm", 0.0),
        "rain_chance_pct": insight.get("rainChance", 0),
        "wind_speed_kmh": data.get("windSpeedKmh"),
        "wind_direction": details.get("windDirection", "N"),
        "pressure_hpa": details.get("pressureHpa", 1013),
        "visibility_km": details.get("visibilityKm", 10.0),
        "uv_index": details.get("uvIndex", 0.0),
        "cloud_cover_pct": details.get("cloudCoverPct", 40),
        "stale": data.get("stale", False),
        "observed_at": data.get("observedAt", data.get("fetchedAt")),
        "source": "central_weather_hub"
    }


# ==============================================================================
# Tool 3: get_forecast
# ==============================================================================

async def get_forecast_tool(args: ForecastArgs) -> Dict[str, Any]:
    """Retrieves concise hourly & daily forecast projections from WeatherDataHub."""
    loc_clean = args.location.strip()
    if not loc_clean:
        return {"error": "Location is required"}

    data = await weather_hub.get_weather_for_city(loc_clean)
    days_limit = max(1, min(7, args.days or 5))

    daily_raw = data.get("daily", [])[:days_limit]
    hourly_raw = data.get("hourly", [])[:12] if args.hourly else []

    daily_summary = [
        {
            "day": d.get("day"),
            "date": d.get("date"),
            "high_c": d.get("highC"),
            "low_c": d.get("lowC"),
            "condition": d.get("condition"),
            "rain_chance_pct": d.get("rainChance", 0),
            "precipitation_sum_mm": d.get("precipitationSum", 0.0),
            "wind_speed_max_kmh": d.get("windSpeedMax", 0.0)
        }
        for d in daily_raw
    ]

    hourly_summary = [
        {
            "time": h.get("time"),
            "temperature_c": h.get("tempC"),
            "feels_like_c": h.get("feelsLikeC"),
            "condition": h.get("condition"),
            "rain_chance_pct": h.get("rainChance", 0)
        }
        for h in hourly_raw
    ]

    return {
        "location": data.get("city", loc_clean),
        "daily_forecast": daily_summary,
        "hourly_forecast": hourly_summary,
        "stale": data.get("stale", False),
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

