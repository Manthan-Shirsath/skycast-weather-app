"""
Contextual Weather Recommendation Service
Answers practical consumer questions grounded in real centralized meteorological observations.
Uses WeatherDataHub as the sole data gateway.
"""

from typing import Dict, Any, List, Optional
import datetime
import logging

from backend.app.services.weather_hub import weather_hub

logger = logging.getLogger("skycast.recommendations")


class RecommendationService:
    """
    Computes practical decision recommendations based on centralized weather data.
    """

    @staticmethod
    async def get_recommendations(
        city_name: str,
        activity: str = "all"
    ) -> Dict[str, Any]:
        """
        Generates grounded advisory recommendations for practical everyday scenarios.
        """
        clean_city = city_name.strip()
        act_clean = (activity or "all").strip().lower()

        weather = await weather_hub.get_weather_for_city(clean_city)
        if not weather or not weather.get("city"):
            return {
                "status": "error",
                "message": f"Unable to retrieve current weather for '{clean_city}' to compute recommendations."
            }

        temp_c = weather.get("tempC", 24)
        feels_like_c = weather.get("feelsLikeC", temp_c)
        humidity = weather.get("humidity", 50)
        wind_kmh = weather.get("windSpeedKmh", 10)
        condition = weather.get("condition", "Clear")
        insight = weather.get("insight", {})
        details = weather.get("details", {})
        rain_chance = insight.get("rainChance", 0)
        precipitation_mm = details.get("precipitationMm", 0.0)

        daily = weather.get("daily", [])
        alerts = weather.get("alerts", [])
        has_severe_alert = any(a.get("severity") in ["orange", "red", "warning", "severe"] for a in alerts)

        recs = {}

        # 1. Umbrella Recommendation
        if rain_chance >= 35 or precipitation_mm > 0.5:
            recs["umbrella"] = {
                "activity": "umbrella",
                "title": "Carry an umbrella",
                "verdict": "yes",
                "confidence": "high" if rain_chance >= 60 else "moderate",
                "emoji": "☂️",
                "reasons": [
                    f"Precipitation probability is {rain_chance}%.",
                    f"Current condition: {condition} with {precipitation_mm}mm precipitation."
                ],
                "action": "Keep an umbrella or raincoat accessible today."
            }
        else:
            recs["umbrella"] = {
                "activity": "umbrella",
                "title": "No umbrella needed",
                "verdict": "no",
                "confidence": "high",
                "emoji": "☀️",
                "reasons": [
                    f"Precipitation chance is low ({rain_chance}%).",
                    f"Conditions are expected to remain {condition.lower()}."
                ],
                "action": "You can leave the umbrella at home."
            }

        # 2. Jacket Recommendation
        if feels_like_c < 18 or (temp_c < 20 and wind_kmh > 20):
            recs["jacket"] = {
                "activity": "jacket",
                "title": "Wear a jacket or layer",
                "verdict": "yes",
                "confidence": "high" if feels_like_c < 15 else "moderate",
                "emoji": "🧥",
                "reasons": [
                    f"Apparent temperature feels like {feels_like_c}°C.",
                    f"Wind speed of {wind_kmh} km/h increases wind chill effect."
                ],
                "action": "Wear a light jacket or windbreaker when heading out."
            }
        else:
            recs["jacket"] = {
                "activity": "jacket",
                "title": "No jacket required",
                "verdict": "no",
                "confidence": "high",
                "emoji": "👕",
                "reasons": [
                    f"Temperature is comfortable ({temp_c}°C, feels like {feels_like_c}°C).",
                    "No significant cold fronts or wind chill factors."
                ],
                "action": "Comfortable light casual wear is appropriate."
            }

        # 3. Outdoor Running / Exercise
        if has_severe_alert or rain_chance > 65 or temp_c > 36 or wind_kmh > 35:
            recs["run"] = {
                "activity": "run",
                "title": "Indoor exercise recommended",
                "verdict": "unfavorable",
                "confidence": "high",
                "emoji": "🏋️",
                "reasons": [
                    "Adverse atmospheric conditions detected." if not has_severe_alert else "Active meteorological alert for region.",
                    f"Temp: {temp_c}°C, Rain chance: {rain_chance}%, Wind: {wind_kmh} km/h."
                ],
                "action": "Opt for indoor workout or treadmill sessions."
            }
        else:
            recs["run"] = {
                "activity": "run",
                "title": "Good for outdoor run",
                "verdict": "favorable",
                "confidence": "high",
                "emoji": "🏃",
                "reasons": [
                    f"Moderate temperature ({temp_c}°C) and wind ({wind_kmh} km/h).",
                    f"Rain chance is manageable ({rain_chance}%)."
                ],
                "action": "Great conditions for morning or evening running."
            }

        # 4. Outdoor Event / Picnic
        if has_severe_alert or rain_chance > 45 or temp_c > 38:
            recs["outdoor_event"] = {
                "activity": "outdoor_event",
                "title": "Outdoor event caution",
                "verdict": "caution",
                "confidence": "moderate",
                "emoji": "⚠️",
                "reasons": [
                    f"Elevated rain probability ({rain_chance}%) or thermal index ({temp_c}°C)."
                ],
                "action": "Arrange covered pavilions or backup indoor alternatives."
            }
        else:
            recs["outdoor_event"] = {
                "activity": "outdoor_event",
                "title": "Great for outdoor event",
                "verdict": "favorable",
                "confidence": "high",
                "emoji": "🎉",
                "reasons": [
                    f"Stable weather ({condition}), rain chance {rain_chance}%, pleasant breeze."
                ],
                "action": "Proceed with planned outdoor gatherings."
            }

        # 5. Travel / Road Trip
        if has_severe_alert or wind_kmh > 45 or rain_chance > 80:
            recs["travel"] = {
                "activity": "travel",
                "title": "Travel with caution",
                "verdict": "caution",
                "confidence": "high",
                "emoji": "🚗",
                "reasons": [
                    "Inclement weather may affect highway visibility and traction."
                ],
                "action": "Check route traffic and allow extra transit time."
            }
        else:
            recs["travel"] = {
                "activity": "travel",
                "title": "Clear travel conditions",
                "verdict": "favorable",
                "confidence": "high",
                "emoji": "✈️",
                "reasons": [
                    f"Good atmospheric visibility, manageable wind ({wind_kmh} km/h), rain {rain_chance}%."
                ],
                "action": "Safe for regular road transit and travel."
            }

        # 6. Drying Clothes Outside
        if rain_chance < 25 and humidity < 70 and temp_c > 18:
            recs["drying_clothes"] = {
                "activity": "drying_clothes",
                "title": "Good for drying clothes",
                "verdict": "favorable",
                "confidence": "high",
                "emoji": "🧺",
                "reasons": [
                    f"Low humidity ({humidity}%), good solar radiation, rain chance {rain_chance}%."
                ],
                "action": "Laundry will dry quickly outdoors."
            }
        else:
            recs["drying_clothes"] = {
                "activity": "drying_clothes",
                "title": "Dry clothes indoors",
                "verdict": "unfavorable",
                "confidence": "moderate",
                "emoji": "🏠",
                "reasons": [
                    f"High humidity ({humidity}%) or rain risk ({rain_chance}%)."
                ],
                "action": "Dry clothes under covered balcony or indoors."
            }

        if act_clean != "all" and act_clean in recs:
            selected = recs[act_clean]
        else:
            selected = list(recs.values())

        return {
            "status": "ready",
            "location": weather.get("city", clean_city),
            "display_location": weather.get("displayLocation", clean_city),
            "weather_context": {
                "temperature_c": temp_c,
                "feels_like_c": feels_like_c,
                "condition": condition,
                "humidity_pct": humidity,
                "rain_chance_pct": rain_chance,
                "wind_speed_kmh": wind_kmh,
                "precipitation_mm": precipitation_mm
            },
            "recommendations": selected,
            "data_status": {
                "source": "central_weather_hub",
                "updated_at": weather.get("updatedAt", datetime.datetime.now(datetime.timezone.utc).isoformat()),
                "stale": weather.get("stale", False)
            }
        }
