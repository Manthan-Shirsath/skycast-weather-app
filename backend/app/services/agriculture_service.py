"""
Agriculture / Farmer Weather Advisory Service
Grounds crop-specific spraying, irrigation, and hazard advisories in centralized meteorological observations.
Uses WeatherDataHub as the sole data gateway.
"""

from typing import Dict, Any, Optional
import datetime
import logging

from backend.app.services.weather_hub import weather_hub

logger = logging.getLogger("skycast.agriculture")

# Agrometeorological guidelines for common crops
CROP_THRESHOLDS = {
    "cotton": {
        "optimal_temp": (21, 35),
        "critical_stages": ["Flowering", "Boll Formation"],
        "fungal_humidity_thresh": 80,
        "wind_spray_limit_kmh": 16,
    },
    "sugarcane": {
        "optimal_temp": (20, 38),
        "critical_stages": ["Grand Growth", "Ripening"],
        "fungal_humidity_thresh": 85,
        "wind_spray_limit_kmh": 20,
    },
    "wheat": {
        "optimal_temp": (12, 25),
        "critical_stages": ["Crown Root", "Heading", "Grain Filling"],
        "fungal_humidity_thresh": 75,
        "wind_spray_limit_kmh": 15,
    },
    "rice": {
        "optimal_temp": (20, 35),
        "critical_stages": ["Panicle Initiation", "Flowering"],
        "fungal_humidity_thresh": 85,
        "wind_spray_limit_kmh": 18,
    },
    "soybean": {
        "optimal_temp": (18, 30),
        "critical_stages": ["Pod Formation", "Flowering"],
        "fungal_humidity_thresh": 80,
        "wind_spray_limit_kmh": 15,
    },
    "tomato": {
        "optimal_temp": (18, 28),
        "critical_stages": ["Flowering", "Fruiting"],
        "fungal_humidity_thresh": 75,
        "wind_spray_limit_kmh": 14,
    },
    "onion": {
        "optimal_temp": (13, 28),
        "critical_stages": ["Bulb Development"],
        "fungal_humidity_thresh": 70,
        "wind_spray_limit_kmh": 15,
    },
    "groundnut": {
        "optimal_temp": (22, 32),
        "critical_stages": ["Pegging", "Pod Development"],
        "fungal_humidity_thresh": 80,
        "wind_spray_limit_kmh": 16,
    }
}


class AgricultureService:
    """
    Computes weather-grounded farming advisories using Central Weather Data Hub.
    """

    @staticmethod
    async def get_advisory(
        city_name: str,
        crop: str = "Cotton",
        growth_stage: str = "Flowering"
    ) -> Dict[str, Any]:
        """
        Generates structured crop advisory using real normalized weather data.
        """
        clean_city = city_name.strip()
        crop_clean = (crop or "Cotton").strip().capitalize()
        stage_clean = (growth_stage or "Vegetative").strip().capitalize()

        # 1. Fetch real centralized weather data
        weather = await weather_hub.get_weather_for_city(clean_city)
        if not weather or not weather.get("city"):
            return {
                "status": "error",
                "message": f"Unable to fetch weather data for '{clean_city}' to compute agricultural advisory."
            }

        temp_c = weather.get("tempC", 25)
        humidity = weather.get("humidity", 60)
        wind_kmh = weather.get("windSpeedKmh", 10)
        condition = weather.get("condition", "Clear")
        insight = weather.get("insight", {})
        details = weather.get("details", {})
        rain_chance = insight.get("rainChance", 0)
        precipitation_mm = details.get("precipitationMm", 0.0)

        daily = weather.get("daily", [])
        next_48h_rain_prob = max([d.get("rainChance", 0) for d in daily[:2]] or [rain_chance])
        expected_rain_mm = sum([d.get("precipitationSum", 0.0) for d in daily[:2]] or [precipitation_mm])

        crop_profile = CROP_THRESHOLDS.get(crop_clean.lower(), CROP_THRESHOLDS["cotton"])

        # 2. Evaluate Spraying Suitability
        spray_issues = []
        is_spray_favorable = True

        if wind_kmh > crop_profile["wind_spray_limit_kmh"]:
            spray_issues.append(f"Wind speed ({wind_kmh} km/h) exceeds safe drift threshold ({crop_profile['wind_spray_limit_kmh']} km/h).")
            is_spray_favorable = False

        if next_48h_rain_prob > 35 or expected_rain_mm > 2.0:
            spray_issues.append(f"Rain probability ({next_48h_rain_prob}%) poses high wash-off risk.")
            is_spray_favorable = False

        if temp_c > 34:
            spray_issues.append(f"High daytime temperature ({temp_c}°C) can cause rapid chemical droplet evaporation.")
            is_spray_favorable = False

        if is_spray_favorable:
            spraying_status = "OPTIMAL"
            spraying_score = 92
            spraying_window = "Early Morning (6:00 AM - 9:30 AM) or Late Afternoon (4:30 PM - 6:30 PM)"
            spraying_summary = "Weather conditions are suitable for foliar spray with minimal drift and low wash-off risk."
        elif len(spray_issues) == 1:
            spraying_status = "MODERATE"
            spraying_score = 60
            spraying_window = "Early Morning calm window only (6:00 AM - 8:00 AM)"
            spraying_summary = f"Marginal conditions: {spray_issues[0]}"
        else:
            spraying_status = "UNFAVORABLE"
            spraying_score = 25
            spraying_window = "Postpone spraying until weather stabilizes"
            spraying_summary = f"Avoid spraying today: {'; '.join(spray_issues)}"

        # 3. Evaluate Irrigation Guidance
        if expected_rain_mm >= 8.0 or next_48h_rain_prob >= 60:
            irrigation_status = "POSTPONE"
            irrigation_guidance = f"Postpone scheduled irrigation. Significant rainfall (~{expected_rain_mm:.1f} mm) is projected within 48 hours."
        elif expected_rain_mm >= 3.0 or next_48h_rain_prob >= 40:
            irrigation_status = "HOLD / MONITOR"
            irrigation_guidance = f"Moderate rain chance ({next_48h_rain_prob}%). Hold irrigation and monitor soil moisture levels."
        elif temp_c > 32 and humidity < 50:
            irrigation_status = "IRRIGATE (EVENING)"
            irrigation_guidance = "High evaporative demand. Provide light irrigation during evening hours to avoid heat stress."
        else:
            irrigation_status = "NORMAL CYCLE"
            irrigation_guidance = "Maintain standard crop water scheduling based on current soil moisture."

        # 4. Evaluate Disease & Pest Risk
        pest_risks = []
        if humidity >= crop_profile["fungal_humidity_thresh"] and temp_c >= 20 and temp_c <= 32:
            pest_risks.append("Elevated humidity combined with moderate temperatures favors fungal spores and foliar blight.")
        if rain_chance > 50:
            pest_risks.append("Prolonged wet canopy increases risk of bacterial leaf spot and root rots.")
        if temp_c > 35:
            pest_risks.append("Sustained high temperatures may induce thermal stress and flower drop.")

        risk_level = "HIGH" if len(pest_risks) >= 2 else "MODERATE" if len(pest_risks) == 1 else "LOW"
        risk_summary = pest_risks[0] if pest_risks else "Weather stress factors are within normal seasonal baselines."

        # 5. Build structured response
        return {
            "status": "ready",
            "location": weather.get("city", clean_city),
            "display_location": weather.get("displayLocation", clean_city),
            "crop": crop_clean,
            "growth_stage": stage_clean,
            "weather_snapshot": {
                "temperature_c": temp_c,
                "humidity_pct": humidity,
                "wind_speed_kmh": wind_kmh,
                "condition": condition,
                "rain_chance_pct": rain_chance,
                "precipitation_mm": precipitation_mm,
                "next_48h_rain_prob_pct": next_48h_rain_prob,
                "expected_rain_48h_mm": round(expected_rain_mm, 1)
            },
            "spraying_advisory": {
                "status": spraying_status,
                "score": spraying_score,
                "window": spraying_window,
                "summary": spraying_summary,
                "issues": spray_issues
            },
            "irrigation_advisory": {
                "status": irrigation_status,
                "guidance": irrigation_guidance
            },
            "crop_weather_risk": {
                "level": risk_level,
                "summary": risk_summary,
                "details": pest_risks
            },
            "disclaimer": "Agricultural advisory is derived from open meteorological models and general agrometeorological thresholds. Verify local soil conditions and consult official Krishi Vigyan Kendra (KVK) extension agronomists before applying agrochemicals.",
            "data_status": {
                "source": "central_weather_hub",
                "updated_at": weather.get("updatedAt", datetime.datetime.now(datetime.timezone.utc).isoformat()),
                "stale": weather.get("stale", False)
            }
        }
