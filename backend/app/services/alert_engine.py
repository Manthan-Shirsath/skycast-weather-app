"""
Skycast Weather Risk Engine
Rule engine implementing risk assessments based on published India Meteorological Department (IMD)
warning frameworks, Standard Operating Procedures (SOP), and impact-based forecasting guidelines.

CRITICAL SEMANTIC PRINCIPLES:
1. IMD Hazard Classifications (e.g. heavy_rain, moderate_squall, heat_wave, dense_fog) are physical
   meteorological categories defined by IMD.
2. Skycast Risk Level & Colour (Green, Yellow, Orange, Red) are our derived computational risk assessments
   based on the applicable impact frameworks (urban, hilly, ladakh, general) and local context.
3. Skycast alerts are NEVER described as "IMD Warnings" or "Official Alerts".
"""

import datetime
from typing import Dict, Any, List, Optional

from backend.app.core.imd_rules_config import (
    CITY_LOCATION_PROFILES,
    RISK_COLOR_PRIORITY,
    COLOR_MEANINGS,
    IMD_RAINFALL_THRESHOLDS,
    URBAN_RAINFALL_THRESHOLDS,
    HILLY_RAINFALL_THRESHOLDS,
    LADAKH_RAINFALL_THRESHOLDS,
    IMD_SQUALL_THRESHOLDS,
    IMD_HEAT_THRESHOLDS,
    IMD_COLD_THRESHOLDS,
    IMD_FOG_THRESHOLDS,
    RULE_REFERENCES
)

class SkycastRiskEngine:
    """
    Centralized rule engine calculating Skycast Weather Risks from normalized weather data
    strictly according to published IMD criteria while separating hazard classifications from
    derived risk levels.
    """

    @staticmethod
    def get_location_profile(city_name: str) -> str:
        """Resolve geographic location classification profile for a city."""
        clean_name = city_name.strip().lower()
        return CITY_LOCATION_PROFILES.get(clean_name, "normal")

    @classmethod
    def evaluate_all_risks(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        display_location: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates all meteorological hazards for a given location and returns a multi-hazard
        Skycast risk assessment payload.
        """
        location_profile = cls.get_location_profile(city_name)
        display_loc = display_location or weather_data.get("displayLocation", city_name)
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        now_iso = now_utc.isoformat()
        valid_until_24h = (now_utc + datetime.timedelta(hours=24)).isoformat()
        valid_until_3h = (now_utc + datetime.timedelta(hours=3)).isoformat()

        active_alerts: List[Dict[str, Any]] = []

        # 1. Evaluate Rainfall Hazard & Risk
        rain_alert = cls._evaluate_rainfall_risk(
            weather_data, city_name, location_profile, now_iso, valid_until_24h
        )
        if rain_alert:
            active_alerts.append(rain_alert)

        # 2. Evaluate Squall & Wind Hazard & Risk
        wind_alert = cls._evaluate_squall_risk(
            weather_data, city_name, location_profile, now_iso, valid_until_3h
        )
        if wind_alert:
            active_alerts.append(wind_alert)

        # 3. Evaluate Thunderstorm Hazard & Risk
        storm_alert = cls._evaluate_thunderstorm_risk(
            weather_data, city_name, location_profile, now_iso, valid_until_3h
        )
        if storm_alert:
            active_alerts.append(storm_alert)

        # 4. Evaluate Heat Wave Hazard & Risk
        heat_alert = cls._evaluate_heat_wave_risk(
            weather_data, city_name, location_profile, now_iso, valid_until_24h
        )
        if heat_alert:
            active_alerts.append(heat_alert)

        # 5. Evaluate Cold Wave Hazard & Risk
        cold_alert = cls._evaluate_cold_wave_risk(
            weather_data, city_name, location_profile, now_iso, valid_until_24h
        )
        if cold_alert:
            active_alerts.append(cold_alert)

        # 6. Evaluate Fog & Low Visibility Hazard & Risk
        fog_alert = cls._evaluate_fog_risk(
            weather_data, city_name, location_profile, now_iso, valid_until_3h
        )
        if fog_alert:
            active_alerts.append(fog_alert)

        # Determine Highest Risk Colour (Priority: RED > ORANGE > YELLOW > GREEN)
        highest_color = "green"
        highest_priority = 1
        for alert in active_alerts:
            color = (alert.get("skycastRiskColour") or alert.get("riskColour") or "green").lower()
            prio = RISK_COLOR_PRIORITY.get(color, 1)
            if prio > highest_priority:
                highest_priority = prio
                highest_color = color

        # If no hazardous weather, create standard Green (No Action) baseline entry
        if not active_alerts:
            active_alerts.append({
                "id": f"skycast-{city_name.lower()}-normal",
                "hazard": "none",
                "hazardClassification": "no_warning",
                "skycastRiskLevel": "green",
                "skycastRiskColour": "green",
                "riskLevel": "green",
                "riskColour": "green",
                "actionDirective": COLOR_MEANINGS["green"]["action"],
                "title": "Skycast Weather Risk: Normal Conditions (Green)",
                "subtitle": "Based on published IMD warning criteria/framework.",
                "basis": "forecast",
                "forecastWindow": "next_24h",
                "observationWindow": None,
                "measuredValue": 0.0,
                "unit": "mm/24h",
                "threshold": None,
                "source": "skycast",
                "official": False,
                "locationProfile": location_profile,
                "ruleBasis": "IMD Standard Operating Procedure for Weather Forecasting",
                "ruleReference": "IMD Standard Operating Procedure for Weather Forecasting Section 4.1",
                "explanation": f"Meteorological parameters for {city_name} are within normal seasonal range. No IMD severe hazard thresholds exceeded.",
                "confidence": "high",
                "confidenceReason": "Consistent NWP multi-parameter stability.",
                "limitations": [
                    "General numerical forecast resolution limitations apply."
                ],
                "validFrom": now_iso,
                "validUntil": valid_until_24h
            })

        # Evaluate Upcoming Forecast Risks (Days 1 to 5)
        upcoming_risks = cls._evaluate_upcoming_risks(weather_data, city_name, location_profile)

        return {
            "city": city_name,
            "displayLocation": display_loc,
            "locationProfile": location_profile,
            "highestRiskColour": highest_color,
            "highestRiskAction": COLOR_MEANINGS[highest_color]["action"],
            "hasHazard": highest_color in ["yellow", "orange", "red"],
            "alerts": active_alerts,
            "upcomingRisks": upcoming_risks,
            "count": len(active_alerts),
            "generatedAt": now_iso,
            "source": "skycast",
            "official": False,
            "disclaimer": "Skycast weather risks are derived computational assessments based on published IMD criteria. They are NOT official IMD warnings."
        }

    @classmethod
    def _evaluate_rainfall_risk(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        location_profile: str,
        valid_from: str,
        valid_until: str
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates 24-hour rainfall accumulation against IMD standard categories and contextual impact frameworks.
        Separates IMD hazardClassification from Skycast skycastRiskLevel.
        """
        daily = weather_data.get("daily", {})
        current = weather_data.get("current", {})

        rain_24h_mm = 0.0
        if isinstance(daily, dict):
            precip_sums = daily.get("precipitation_sum", [0.0])
            rain_24h_mm = float(precip_sums[0]) if precip_sums else 0.0
        elif isinstance(daily, list) and daily:
            rain_24h_mm = float(daily[0].get("precipitationSum", 0.0))

        rain_prob = 0
        if isinstance(daily, dict):
            probs = daily.get("precipitation_probability_max", [0])
            rain_prob = int(probs[0]) if probs else 0

        # Step 1: Determine IMD Standard Hazard Classification (Phenomenon only)
        if rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["extremely_heavy_min"]:  # >= 204.5 mm
            hazard_class = "extremely_heavy_rain"
            hazard_title = "Extremely Heavy Rain"
        elif rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["very_heavy_min"]:     # 115.6 - 204.4 mm
            hazard_class = "very_heavy_rain"
            hazard_title = "Very Heavy Rain"
        elif rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["heavy_min"]:          # 64.5 - 115.5 mm
            hazard_class = "heavy_rain"
            hazard_title = "Heavy Rain"
        elif rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["moderate_min"]:       # 15.6 - 64.4 mm
            hazard_class = "moderate_rain"
            hazard_title = "Moderate Rain"
        elif rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["light_min"]:          # 2.5 - 15.5 mm
            hazard_class = "light_rain"
            hazard_title = "Light Rain"
        else:
            hazard_class = "no_significant_rain"
            hazard_title = "No Significant Rain"

        # Step 2: Determine Skycast-derived Risk Level based on Location Impact Profile
        risk_color: Optional[str] = None
        threshold_used: float = 0.0
        rule_basis_str = RULE_REFERENCES["rainfall_general"]

        if location_profile == "urban":
            rule_basis_str = RULE_REFERENCES["rainfall_urban"]
            if rain_24h_mm >= URBAN_RAINFALL_THRESHOLDS["red_min"]:      # >= 120.0 mm
                risk_color = "red"
                threshold_used = URBAN_RAINFALL_THRESHOLDS["red_min"]
            elif rain_24h_mm >= URBAN_RAINFALL_THRESHOLDS["orange_min"]: # >= 70.0 mm
                risk_color = "orange"
                threshold_used = URBAN_RAINFALL_THRESHOLDS["orange_min"]
            elif rain_24h_mm >= URBAN_RAINFALL_THRESHOLDS["yellow_min"]: # >= 50.0 mm
                risk_color = "yellow"
                threshold_used = URBAN_RAINFALL_THRESHOLDS["yellow_min"]

        elif location_profile == "hilly_landslide_vulnerable":
            rule_basis_str = RULE_REFERENCES["rainfall_hilly"]
            if rain_24h_mm >= HILLY_RAINFALL_THRESHOLDS["red_min"]:      # >= 150.0 mm
                risk_color = "red"
                threshold_used = HILLY_RAINFALL_THRESHOLDS["red_min"]
            elif rain_24h_mm >= HILLY_RAINFALL_THRESHOLDS["orange_min"]: # >= 100.0 mm
                risk_color = "orange"
                threshold_used = HILLY_RAINFALL_THRESHOLDS["orange_min"]
            elif rain_24h_mm >= HILLY_RAINFALL_THRESHOLDS["yellow_min"]: # >= 50.0 mm
                risk_color = "yellow"
                threshold_used = HILLY_RAINFALL_THRESHOLDS["yellow_min"]

        elif location_profile == "ladakh_vulnerable":
            rule_basis_str = RULE_REFERENCES["rainfall_ladakh"]
            if rain_24h_mm >= LADAKH_RAINFALL_THRESHOLDS["red_min"]:      # > 30.0 mm
                risk_color = "red"
                threshold_used = 30.1
            elif rain_24h_mm >= LADAKH_RAINFALL_THRESHOLDS["orange_min"]: # 16.0 - 30.0 mm
                risk_color = "orange"
                threshold_used = LADAKH_RAINFALL_THRESHOLDS["orange_min"]
            elif rain_24h_mm >= LADAKH_RAINFALL_THRESHOLDS["yellow_exact"] and rain_24h_mm < LADAKH_RAINFALL_THRESHOLDS["orange_min"]: # 15.0 mm
                risk_color = "yellow"
                threshold_used = LADAKH_RAINFALL_THRESHOLDS["yellow_exact"]

        else:
            # Standard General Location Profile Mapping
            if rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["extremely_heavy_min"]:  # >= 204.5 mm
                risk_color = "red"
                threshold_used = IMD_RAINFALL_THRESHOLDS["extremely_heavy_min"]
            elif rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["very_heavy_min"]:     # >= 115.6 mm
                risk_color = "orange"
                threshold_used = IMD_RAINFALL_THRESHOLDS["very_heavy_min"]
            elif rain_24h_mm >= IMD_RAINFALL_THRESHOLDS["heavy_min"]:          # >= 64.5 mm
                risk_color = "yellow"
                threshold_used = IMD_RAINFALL_THRESHOLDS["heavy_min"]

        if not risk_color:
            return None

        action_dir = COLOR_MEANINGS[risk_color]["action"]
        confidence = "high" if rain_prob >= 75 else ("medium" if rain_prob >= 40 else "low")
        confidence_reason = f"Forecast precipitation probability {rain_prob}%; 24h accumulation {round(rain_24h_mm, 1)} mm."

        return {
            "id": f"skycast-{city_name.lower()}-rainfall-{risk_color}",
            "hazard": "rain",
            "hazardClassification": hazard_class,
            "skycastRiskLevel": risk_color,
            "skycastRiskColour": risk_color,
            "riskLevel": risk_color,
            "riskColour": risk_color,
            "actionDirective": action_dir,
            "title": f"Skycast Weather Risk: {hazard_title} ({risk_color.capitalize()})",
            "subtitle": "Based on published IMD warning criteria/framework.",
            "basis": "forecast",
            "forecastWindow": "next_24h",
            "observationWindow": None,
            "measuredValue": round(rain_24h_mm, 1),
            "unit": "mm/24h",
            "threshold": threshold_used,
            "source": "skycast",
            "official": False,
            "locationProfile": location_profile,
            "ruleBasis": rule_basis_str,
            "ruleReference": rule_basis_str,
            "explanation": f"Forecast 24-hour rainfall ({round(rain_24h_mm, 1)} mm/24h) corresponds to IMD hazard '{hazard_class.replace('_', ' ')}', evaluated as Skycast {risk_color.upper()} risk for {city_name}.",
            "confidence": confidence,
            "confidenceReason": confidence_reason,
            "limitations": [
                "No real-time soil-moisture or catchment drainage capacity data available",
                "Sub-hourly peak convective bursts (>30mm/hr) not captured in 24h sum"
            ],
            "validFrom": valid_from,
            "validUntil": valid_until
        }

    @classmethod
    def _evaluate_squall_risk(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        location_profile: str,
        valid_from: str,
        valid_until: str
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates squalls and wind gusts against official IMD Wind & Squall Hazard Matrix.
        Uses wind_gusts_10m when available; falls back to wind_speed_10m.
        """
        current = weather_data.get("current", {})
        daily = weather_data.get("daily", {})

        gust_kmh = 0.0
        if isinstance(current, dict) and "wind_gusts_10m" in current and current["wind_gusts_10m"] is not None:
            gust_kmh = float(current["wind_gusts_10m"])
        elif isinstance(daily, dict) and "wind_gusts_10m_max" in daily and daily["wind_gusts_10m_max"]:
            gust_kmh = float(daily["wind_gusts_10m_max"][0])
        else:
            gust_kmh = float(current.get("wind_speed_10m", weather_data.get("windSpeedKmh", 0.0)))

        risk_color: Optional[str] = None
        hazard_class: str = "light_wind"
        threshold_used: float = 0.0

        # Exact IMD Squall & Wind thresholds:
        # Very Severe Squall: >= 88.0 km/h
        # Severe Squall: 62.0 - 87.0 km/h
        # Moderate Squall: 52.0 - 61.0 km/h
        # Strong surface wind: 40.0 - 51.0 km/h
        if gust_kmh >= IMD_SQUALL_THRESHOLDS["very_severe_squall_min"]:  # >= 88.0 km/h
            risk_color = "red"
            hazard_class = "very_severe_squall"
            threshold_used = IMD_SQUALL_THRESHOLDS["very_severe_squall_min"]
        elif gust_kmh >= IMD_SQUALL_THRESHOLDS["severe_squall_min"]:     # 62.0 - 87.0 km/h
            risk_color = "orange"
            hazard_class = "severe_squall"
            threshold_used = IMD_SQUALL_THRESHOLDS["severe_squall_min"]
        elif gust_kmh >= IMD_SQUALL_THRESHOLDS["moderate_squall_min"]:   # 52.0 - 61.0 km/h
            risk_color = "yellow"
            hazard_class = "moderate_squall"
            threshold_used = IMD_SQUALL_THRESHOLDS["moderate_squall_min"]
        elif gust_kmh >= IMD_SQUALL_THRESHOLDS["strong_wind_min"]:       # 40.0 - 51.0 km/h
            risk_color = "yellow"
            hazard_class = "strong_surface_wind"
            threshold_used = IMD_SQUALL_THRESHOLDS["strong_wind_min"]

        if not risk_color:
            return None

        hazard_titles = {
            "strong_surface_wind": "Strong Surface Wind / Brisk Gusts",
            "moderate_squall": "Moderate Squall (52–61 km/h)",
            "severe_squall": "Severe Squall (62–87 km/h)",
            "very_severe_squall": "Very Severe Squall (≥ 88 km/h)"
        }

        return {
            "id": f"skycast-{city_name.lower()}-squall-{risk_color}",
            "hazard": "squall_wind",
            "hazardClassification": hazard_class,
            "skycastRiskLevel": risk_color,
            "skycastRiskColour": risk_color,
            "riskLevel": risk_color,
            "riskColour": risk_color,
            "actionDirective": COLOR_MEANINGS[risk_color]["action"],
            "title": f"Skycast Weather Risk: {hazard_titles[hazard_class]} ({risk_color.capitalize()})",
            "subtitle": "Based on published IMD warning criteria/framework.",
            "basis": "observed" if isinstance(current, dict) and "wind_gusts_10m" in current else "forecast",
            "forecastWindow": "next_3h",
            "observationWindow": "current",
            "measuredValue": round(gust_kmh, 1),
            "unit": "km/h",
            "threshold": threshold_used,
            "source": "skycast",
            "official": False,
            "locationProfile": location_profile,
            "ruleBasis": RULE_REFERENCES["wind_squall"],
            "ruleReference": RULE_REFERENCES["wind_squall"],
            "explanation": f"Wind gusts of {round(gust_kmh, 1)} km/h correspond to IMD classification '{hazard_class.replace('_', ' ')}' (threshold >= {threshold_used} km/h).",
            "confidence": "high",
            "confidenceReason": "Direct 10m wind gust velocity metric.",
            "limitations": [
                "Localized micro-bursts and urban canyon turbulence may create higher localized gusts."
            ],
            "validFrom": valid_from,
            "validUntil": valid_until
        }

    @classmethod
    def _evaluate_thunderstorm_risk(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        location_profile: str,
        valid_from: str,
        valid_until: str
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates thunderstorm risk based on WMO codes (95, 96, 99).
        Explicitly documents lack of direct lightning sensor data.
        """
        current = weather_data.get("current", {})
        code = int(current.get("weather_code", weather_data.get("weather_code", 0)))

        if code not in [95, 96, 99]:
            return None

        if code == 99:
            risk_color = "orange"
            hazard_class = "severe_thunderstorm_with_hail"
            title = "Severe Thunderstorm with Hail"
        elif code == 96:
            risk_color = "orange"
            hazard_class = "thunderstorm_with_hail"
            title = "Thunderstorm with Hail"
        else:
            risk_color = "yellow"
            hazard_class = "moderate_thunderstorm"
            title = "Thunderstorm with Convective Rain"

        return {
            "id": f"skycast-{city_name.lower()}-thunderstorm-{risk_color}",
            "hazard": "thunderstorm",
            "hazardClassification": hazard_class,
            "skycastRiskLevel": risk_color,
            "skycastRiskColour": risk_color,
            "riskLevel": risk_color,
            "riskColour": risk_color,
            "actionDirective": COLOR_MEANINGS[risk_color]["action"],
            "title": f"Skycast Weather Risk: {title} ({risk_color.capitalize()})",
            "subtitle": "Based on published IMD warning criteria/framework.",
            "basis": "forecast",
            "forecastWindow": "next_3h",
            "observationWindow": "current",
            "measuredValue": code,
            "unit": "WMO Code",
            "threshold": 95,
            "source": "skycast",
            "official": False,
            "locationProfile": location_profile,
            "ruleBasis": RULE_REFERENCES["thunderstorm"],
            "ruleReference": RULE_REFERENCES["thunderstorm"],
            "explanation": f"Convective weather instability detected corresponding to IMD '{hazard_class.replace('_', ' ')}'.",
            "confidence": "medium",
            "confidenceReason": f"WMO Weather Code {code} indicates convective storm dynamics.",
            "limitations": [
                "Real-time lightning sensor feeds (e.g. Damini/IITM) are not connected; lightning is not inferred from rainfall alone."
            ],
            "validFrom": valid_from,
            "validUntil": valid_until
        }

    @classmethod
    def _evaluate_heat_wave_risk(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        location_profile: str,
        valid_from: str,
        valid_until: str
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates heatwave criteria against IMD definitions for Plains, Coastal, and Hilly zones.
        Separates IMD hazard classification from Skycast derived risk level.
        """
        daily = weather_data.get("daily", {})
        current = weather_data.get("current", {})

        max_temp = float(current.get("temperature_2m", weather_data.get("tempC", 25.0)))
        if isinstance(daily, dict) and "temperature_2m_max" in daily and daily["temperature_2m_max"]:
            max_temp = float(daily["temperature_2m_max"][0])
        elif isinstance(daily, list) and daily and "highC" in daily[0]:
            max_temp = float(daily[0]["highC"])
        elif "highC" in weather_data:
            max_temp = float(weather_data["highC"])

        risk_color: Optional[str] = None
        hazard_class: str = "normal_temperature"
        threshold_used: float = 0.0

        if location_profile == "coastal":
            if max_temp >= 40.0:
                risk_color = "orange"
                hazard_class = "coastal_severe_heat"
                threshold_used = 40.0
            elif max_temp >= IMD_HEAT_THRESHOLDS["coastal_prerequisite_c"]:  # >= 37.0 C
                risk_color = "yellow"
                hazard_class = "coastal_heat_advisory"
                threshold_used = IMD_HEAT_THRESHOLDS["coastal_prerequisite_c"]

        elif location_profile == "hilly_landslide_vulnerable":
            if max_temp >= 35.0:
                risk_color = "orange"
                hazard_class = "hilly_severe_heat"
                threshold_used = 35.0
            elif max_temp >= IMD_HEAT_THRESHOLDS["hilly_prerequisite_c"]:    # >= 30.0 C
                risk_color = "yellow"
                hazard_class = "hilly_heat_advisory"
                threshold_used = IMD_HEAT_THRESHOLDS["hilly_prerequisite_c"]

        else:
            # Plains
            if max_temp >= IMD_HEAT_THRESHOLDS["plains_severe_heatwave_abs_c"]:  # >= 47.0 C
                risk_color = "red"
                hazard_class = "severe_heat_wave"
                threshold_used = IMD_HEAT_THRESHOLDS["plains_severe_heatwave_abs_c"]
            elif max_temp >= IMD_HEAT_THRESHOLDS["plains_heatwave_abs_c"]:       # >= 45.0 C
                risk_color = "orange"
                hazard_class = "heat_wave"
                threshold_used = IMD_HEAT_THRESHOLDS["plains_heatwave_abs_c"]
            elif max_temp >= IMD_HEAT_THRESHOLDS["plains_prerequisite_c"]:       # >= 40.0 C
                risk_color = "yellow"
                hazard_class = "high_temperature"
                threshold_used = IMD_HEAT_THRESHOLDS["plains_prerequisite_c"]

        if not risk_color:
            return None

        hazard_titles = {
            "high_temperature": "High Summer Temperature (Heat Wave Prerequisite Met)",
            "heat_wave": "Heat Wave (IMD Absolute Temperature Criteria >= 45°C)",
            "severe_heat_wave": "Severe Heat Wave (IMD Absolute Temperature Criteria >= 47°C)",
            "coastal_heat_advisory": "Coastal High Heat Advisory",
            "coastal_severe_heat": "Coastal Severe Heat Stress",
            "hilly_heat_advisory": "Hill Station Elevated Heat",
            "hilly_severe_heat": "Hill Station Severe Heat"
        }

        return {
            "id": f"skycast-{city_name.lower()}-heatwave-{risk_color}",
            "hazard": "heat_wave",
            "hazardClassification": hazard_class,
            "skycastRiskLevel": risk_color,
            "skycastRiskColour": risk_color,
            "riskLevel": risk_color,
            "riskColour": risk_color,
            "actionDirective": COLOR_MEANINGS[risk_color]["action"],
            "title": f"Skycast Weather Risk: {hazard_titles.get(hazard_class, 'Heat Wave')} ({risk_color.capitalize()})",
            "subtitle": "Based on published IMD warning criteria/framework.",
            "basis": "forecast",
            "forecastWindow": "next_24h",
            "observationWindow": None,
            "measuredValue": round(max_temp, 1),
            "unit": "°C",
            "threshold": threshold_used,
            "source": "skycast",
            "official": False,
            "locationProfile": location_profile,
            "ruleBasis": RULE_REFERENCES["heat_wave"],
            "ruleReference": RULE_REFERENCES["heat_wave"],
            "explanation": f"Maximum temperature ({round(max_temp, 1)}°C) meets the IMD '{hazard_class.replace('_', ' ')}' criterion (>= {threshold_used}°C) for {city_name}.",
            "confidence": "high",
            "confidenceReason": "NWP daily maximum temperature projection.",
            "limitations": [
                "Departure-based heatwave criteria (+4.5°C departure) requires 30-year station climatology; evaluated using absolute maximum temperature criteria.",
                "Official IMD heatwave declaration requires criteria met at >= 2 stations in a subdivision for >= 2 consecutive days."
            ],
            "validFrom": valid_from,
            "validUntil": valid_until
        }

    @classmethod
    def _evaluate_cold_wave_risk(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        location_profile: str,
        valid_from: str,
        valid_until: str
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates coldwave criteria against IMD definitions for Plains and Hills.
        Separates IMD hazard classification from Skycast derived risk level.
        """
        daily = weather_data.get("daily", {})
        current = weather_data.get("current", {})

        min_temp = float(current.get("temperature_2m", weather_data.get("tempC", 20.0)))
        if isinstance(daily, dict) and "temperature_2m_min" in daily and daily["temperature_2m_min"]:
            min_temp = float(daily["temperature_2m_min"][0])
        elif isinstance(daily, list) and daily and "lowC" in daily[0]:
            min_temp = float(daily[0]["lowC"])
        elif "lowC" in weather_data:
            min_temp = float(weather_data["lowC"])

        risk_color: Optional[str] = None
        hazard_class: str = "normal_cold"
        threshold_used: float = 0.0

        if location_profile == "hilly_landslide_vulnerable":
            if min_temp <= -5.0:
                risk_color = "red"
                hazard_class = "hilly_severe_cold_wave"
                threshold_used = -5.0
            elif min_temp <= IMD_COLD_THRESHOLDS["hilly_prerequisite_c"]:  # <= 0.0 C
                risk_color = "orange"
                hazard_class = "hilly_cold_wave"
                threshold_used = IMD_COLD_THRESHOLDS["hilly_prerequisite_c"]
        else:
            # Plains
            if min_temp <= IMD_COLD_THRESHOLDS["plains_severe_coldwave_abs_c"]:  # <= 2.0 C
                risk_color = "red"
                hazard_class = "severe_cold_wave"
                threshold_used = IMD_COLD_THRESHOLDS["plains_severe_coldwave_abs_c"]
            elif min_temp <= IMD_COLD_THRESHOLDS["plains_coldwave_abs_c"]:       # <= 4.0 C
                risk_color = "orange"
                hazard_class = "cold_wave"
                threshold_used = IMD_COLD_THRESHOLDS["plains_coldwave_abs_c"]
            elif min_temp <= IMD_COLD_THRESHOLDS["plains_prerequisite_c"]:       # <= 10.0 C
                risk_color = "yellow"
                hazard_class = "low_temperature"
                threshold_used = IMD_COLD_THRESHOLDS["plains_prerequisite_c"]

        if not risk_color:
            return None

        hazard_titles = {
            "low_temperature": "Low Winter Temperature (Cold Wave Prerequisite Met)",
            "cold_wave": "Cold Wave (IMD Absolute Temperature Criteria <= 4°C)",
            "severe_cold_wave": "Severe Cold Wave (IMD Absolute Temperature Criteria <= 2°C)",
            "hilly_cold_wave": "High Altitude Sub-Zero Freezing",
            "hilly_severe_cold_wave": "High Altitude Extreme Deep Freeze"
        }

        return {
            "id": f"skycast-{city_name.lower()}-coldwave-{risk_color}",
            "hazard": "cold_wave",
            "hazardClassification": hazard_class,
            "skycastRiskLevel": risk_color,
            "skycastRiskColour": risk_color,
            "riskLevel": risk_color,
            "riskColour": risk_color,
            "actionDirective": COLOR_MEANINGS[risk_color]["action"],
            "title": f"Skycast Weather Risk: {hazard_titles.get(hazard_class, 'Cold Wave')} ({risk_color.capitalize()})",
            "subtitle": "Based on published IMD warning criteria/framework.",
            "basis": "forecast",
            "forecastWindow": "next_24h",
            "observationWindow": None,
            "measuredValue": round(min_temp, 1),
            "unit": "°C",
            "threshold": threshold_used,
            "source": "skycast",
            "official": False,
            "locationProfile": location_profile,
            "ruleBasis": RULE_REFERENCES["cold_wave"],
            "ruleReference": RULE_REFERENCES["cold_wave"],
            "explanation": f"Minimum temperature ({round(min_temp, 1)}°C) meets the IMD '{hazard_class.replace('_', ' ')}' criterion (<= {threshold_used}°C) for {city_name}.",
            "confidence": "high",
            "confidenceReason": "NWP daily minimum temperature projection.",
            "limitations": [
                "Departure-based coldwave criteria (-4.5°C departure) requires 30-year station climatology; evaluated using absolute minimum temperature criteria."
            ],
            "validFrom": valid_from,
            "validUntil": valid_until
        }

    @classmethod
    def _evaluate_fog_risk(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        location_profile: str,
        valid_from: str,
        valid_until: str
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates surface visibility against IMD Fog & Visibility Classification (Section 4.5).
        Separates IMD hazard classification from Skycast derived risk level.
        """
        hourly = weather_data.get("hourly", {})
        details = weather_data.get("details", {})

        vis_m = 10000.0
        if isinstance(details, dict) and "visibilityKm" in details and details["visibilityKm"] is not None:
            vis_m = float(details["visibilityKm"]) * 1000.0
        elif isinstance(hourly, dict) and "visibility" in hourly and hourly["visibility"]:
            vis_m = float(hourly["visibility"][0])

        if vis_m >= 1000.0:
            return None

        if vis_m <= IMD_FOG_THRESHOLDS["very_dense_max"]:         # < 50 m
            risk_color = "red"
            hazard_class = "very_dense_fog"
            title = "Very Dense Fog (Visibility < 50m)"
            threshold_used = 50.0
        elif vis_m <= IMD_FOG_THRESHOLDS["dense_max"]:            # 50 - 199 m
            risk_color = "orange"
            hazard_class = "dense_fog"
            title = "Dense Fog (Visibility 50–199m)"
            threshold_used = 200.0
        elif vis_m <= IMD_FOG_THRESHOLDS["moderate_max"]:         # 200 - 499 m
            risk_color = "yellow"
            hazard_class = "moderate_fog"
            title = "Moderate Fog (Visibility 200–499m)"
            threshold_used = 500.0
        else:                                                    # 500 - 999 m
            risk_color = "yellow"
            hazard_class = "shallow_fog"
            title = "Shallow Fog (Visibility 500–999m)"
            threshold_used = 1000.0

        return {
            "id": f"skycast-{city_name.lower()}-fog-{risk_color}",
            "hazard": "fog_visibility",
            "hazardClassification": hazard_class,
            "skycastRiskLevel": risk_color,
            "skycastRiskColour": risk_color,
            "riskLevel": risk_color,
            "riskColour": risk_color,
            "actionDirective": COLOR_MEANINGS[risk_color]["action"],
            "title": f"Skycast Weather Risk: {title} ({risk_color.capitalize()})",
            "subtitle": "Based on published IMD warning criteria/framework.",
            "basis": "observed" if isinstance(details, dict) and "visibilityKm" in details else "forecast",
            "forecastWindow": "next_3h",
            "observationWindow": "current",
            "measuredValue": int(vis_m),
            "unit": "meters",
            "threshold": threshold_used,
            "source": "skycast",
            "official": False,
            "locationProfile": location_profile,
            "ruleBasis": RULE_REFERENCES["fog_visibility"],
            "ruleReference": RULE_REFERENCES["fog_visibility"],
            "explanation": f"Surface visibility of {int(vis_m)} meters corresponds to IMD '{hazard_class.replace('_', ' ')}' (< {threshold_used} m).",
            "confidence": "high",
            "confidenceReason": "Surface visibility optical metric.",
            "limitations": [
                "Localized radiation fog patches along river valleys and highways may have lower visibility than regional grid."
            ],
            "validFrom": valid_from,
            "validUntil": valid_until
        }

    @classmethod
    def _get_rainfall_thresholds(cls, location_profile: str) -> Dict[str, float]:
        """Resolves rainfall risk thresholds based on geographic location profile."""
        if location_profile == "urban":
            return {
                "yellow": URBAN_RAINFALL_THRESHOLDS["yellow_min"],
                "orange": URBAN_RAINFALL_THRESHOLDS["orange_min"],
                "red": URBAN_RAINFALL_THRESHOLDS["red_min"],
            }
        elif location_profile == "hilly_landslide_vulnerable":
            return {
                "yellow": HILLY_RAINFALL_THRESHOLDS["yellow_min"],
                "orange": HILLY_RAINFALL_THRESHOLDS["orange_min"],
                "red": HILLY_RAINFALL_THRESHOLDS["red_min"],
            }
        elif location_profile == "ladakh_vulnerable":
            return {
                "yellow": LADAKH_RAINFALL_THRESHOLDS["yellow_min"],
                "orange": LADAKH_RAINFALL_THRESHOLDS["orange_min"],
                "red": LADAKH_RAINFALL_THRESHOLDS["red_min"],
            }
        else:
            return {
                "yellow": IMD_RAINFALL_THRESHOLDS["heavy_min"],
                "orange": IMD_RAINFALL_THRESHOLDS["very_heavy_min"],
                "red": IMD_RAINFALL_THRESHOLDS["extremely_heavy_min"],
            }

    @classmethod
    def _evaluate_upcoming_risks(
        cls,
        weather_data: Dict[str, Any],
        city_name: str,
        location_profile: str
    ) -> List[Dict[str, Any]]:
        """
        Evaluates forecast risks for days 1 to 5 from daily forecast data.
        Returns a list of structured upcoming risks.
        """
        daily = weather_data.get("daily", [])
        upcoming: List[Dict[str, Any]] = []

        if isinstance(daily, list) and len(daily) > 1:
            for idx, d in enumerate(daily[1:5], start=1):
                day_name = d.get("day", f"Day +{idx}")
                date_str = d.get("date", "")
                rain_sum = float(d.get("precipitationSum", 0.0))
                rain_chance = int(d.get("rainChance", 0))
                high_t = float(d.get("highC", 30))
                low_t = float(d.get("lowC", 20))
                wind_gust = float(d.get("windSpeedMax", 15))

                # Check upcoming rainfall
                rain_thresh = cls._get_rainfall_thresholds(location_profile)
                if rain_sum >= rain_thresh["red"]:
                    upcoming.append({
                        "id": f"upcoming-{city_name.lower()}-rain-{idx}-red",
                        "day": day_name,
                        "date": date_str,
                        "timeWindow": f"{day_name} 00:00–24:00",
                        "hazard": "rainfall",
                        "hazardClassification": "extremely_heavy_rain",
                        "skycastRiskLevel": "red",
                        "skycastRiskColour": "red",
                        "actionDirective": "Take Action",
                        "title": f"Extremely Heavy Rain Risk ({day_name})",
                        "basis": "forecast",
                        "measuredValue": rain_sum,
                        "unit": "mm/24h",
                        "threshold": rain_thresh["red"],
                        "probability": rain_chance,
                        "locationProfile": location_profile,
                        "ruleBasis": "IMD Quantitative Precipitation Framework",
                        "explanation": f"Forecast 24h rainfall of {rain_sum} mm on {day_name} exceeds {location_profile} Red threshold ({rain_thresh['red']} mm).",
                        "limitations": [
                            "Numerical forecast precision decreases beyond 48 hours."
                        ],
                        "official": False
                    })
                elif rain_sum >= rain_thresh["orange"]:
                    upcoming.append({
                        "id": f"upcoming-{city_name.lower()}-rain-{idx}-orange",
                        "day": day_name,
                        "date": date_str,
                        "timeWindow": f"{day_name} 00:00–24:00",
                        "hazard": "rainfall",
                        "hazardClassification": "very_heavy_rain",
                        "skycastRiskLevel": "orange",
                        "skycastRiskColour": "orange",
                        "actionDirective": "Be Prepared",
                        "title": f"Very Heavy Rain Risk ({day_name})",
                        "basis": "forecast",
                        "measuredValue": rain_sum,
                        "unit": "mm/24h",
                        "threshold": rain_thresh["orange"],
                        "probability": rain_chance,
                        "locationProfile": location_profile,
                        "ruleBasis": "IMD Quantitative Precipitation Framework",
                        "explanation": f"Forecast 24h rainfall of {rain_sum} mm on {day_name} exceeds {location_profile} Orange threshold ({rain_thresh['orange']} mm).",
                        "limitations": [
                            "Numerical forecast precision decreases beyond 48 hours."
                        ],
                        "official": False
                    })
                elif rain_sum >= rain_thresh["yellow"]:
                    upcoming.append({
                        "id": f"upcoming-{city_name.lower()}-rain-{idx}-yellow",
                        "day": day_name,
                        "date": date_str,
                        "timeWindow": f"{day_name} 00:00–24:00",
                        "hazard": "rainfall",
                        "hazardClassification": "heavy_rain",
                        "skycastRiskLevel": "yellow",
                        "skycastRiskColour": "yellow",
                        "actionDirective": "Be Updated",
                        "title": f"Heavy Rain Risk ({day_name})",
                        "basis": "forecast",
                        "measuredValue": rain_sum,
                        "unit": "mm/24h",
                        "threshold": rain_thresh["yellow"],
                        "probability": rain_chance,
                        "locationProfile": location_profile,
                        "ruleBasis": "IMD Quantitative Precipitation Framework",
                        "explanation": f"Forecast 24h rainfall of {rain_sum} mm on {day_name} exceeds {location_profile} Yellow threshold ({rain_thresh['yellow']} mm).",
                        "limitations": [
                            "Numerical forecast precision decreases beyond 48 hours."
                        ],
                        "official": False
                    })

                # Check upcoming heatwave
                if high_t >= IMD_HEAT_THRESHOLDS["plains_severe_heatwave_abs_c"]:
                    upcoming.append({
                        "id": f"upcoming-{city_name.lower()}-heat-{idx}-red",
                        "day": day_name,
                        "date": date_str,
                        "timeWindow": f"{day_name} 12:00–17:00",
                        "hazard": "heat_wave",
                        "hazardClassification": "severe_heat_wave",
                        "skycastRiskLevel": "red",
                        "skycastRiskColour": "red",
                        "actionDirective": "Take Action",
                        "title": f"Severe Heat Wave Risk ({day_name})",
                        "basis": "forecast",
                        "measuredValue": high_t,
                        "unit": "°C",
                        "threshold": IMD_HEAT_THRESHOLDS["plains_severe_heatwave_abs_c"],
                        "probability": 85,
                        "locationProfile": location_profile,
                        "ruleBasis": "IMD Standard Operating Procedure for Heat Wave",
                        "explanation": f"Forecast maximum temperature of {high_t}°C on {day_name} meets IMD Severe Heat Wave criteria (>= 47°C).",
                        "limitations": ["Urban heat island effects may increase local microclimate temperatures."],
                        "official": False
                    })
                elif high_t >= IMD_HEAT_THRESHOLDS["plains_heatwave_abs_c"]:
                    upcoming.append({
                        "id": f"upcoming-{city_name.lower()}-heat-{idx}-orange",
                        "day": day_name,
                        "date": date_str,
                        "timeWindow": f"{day_name} 12:00–17:00",
                        "hazard": "heat_wave",
                        "hazardClassification": "heat_wave",
                        "skycastRiskLevel": "orange",
                        "skycastRiskColour": "orange",
                        "actionDirective": "Be Prepared",
                        "title": f"Heat Wave Risk ({day_name})",
                        "basis": "forecast",
                        "measuredValue": high_t,
                        "unit": "°C",
                        "threshold": IMD_HEAT_THRESHOLDS["plains_heatwave_abs_c"],
                        "probability": 85,
                        "locationProfile": location_profile,
                        "ruleBasis": "IMD Standard Operating Procedure for Heat Wave",
                        "explanation": f"Forecast maximum temperature of {high_t}°C on {day_name} meets IMD Heat Wave criteria (>= 45°C).",
                        "limitations": ["Urban heat island effects may increase local microclimate temperatures."],
                        "official": False
                    })

                # Check upcoming squall/wind
                if wind_gust >= IMD_SQUALL_THRESHOLDS["very_severe_squall_min"]:
                    upcoming.append({
                        "id": f"upcoming-{city_name.lower()}-wind-{idx}-red",
                        "day": day_name,
                        "date": date_str,
                        "timeWindow": f"{day_name}",
                        "hazard": "squall_wind",
                        "hazardClassification": "very_severe_squall",
                        "skycastRiskLevel": "red",
                        "skycastRiskColour": "red",
                        "actionDirective": "Take Action",
                        "title": f"Very Severe Squall Risk ({day_name})",
                        "basis": "forecast",
                        "measuredValue": wind_gust,
                        "unit": "km/h",
                        "threshold": IMD_SQUALL_THRESHOLDS["very_severe_squall_min"],
                        "probability": 70,
                        "locationProfile": location_profile,
                        "ruleBasis": "IMD SOP for Squalls & Strong Winds",
                        "explanation": f"Forecast wind gusts of {wind_gust} km/h on {day_name} meet IMD Very Severe Squall criteria (>= 88 km/h).",
                        "limitations": ["Peak convective gust duration is typically 10–30 minutes."],
                        "official": False
                    })
                elif wind_gust >= IMD_SQUALL_THRESHOLDS["severe_squall_min"]:
                    upcoming.append({
                        "id": f"upcoming-{city_name.lower()}-wind-{idx}-orange",
                        "day": day_name,
                        "date": date_str,
                        "timeWindow": f"{day_name}",
                        "hazard": "squall_wind",
                        "hazardClassification": "severe_squall",
                        "skycastRiskLevel": "orange",
                        "skycastRiskColour": "orange",
                        "actionDirective": "Be Prepared",
                        "title": f"Severe Squall Risk ({day_name})",
                        "basis": "forecast",
                        "measuredValue": wind_gust,
                        "unit": "km/h",
                        "threshold": IMD_SQUALL_THRESHOLDS["severe_squall_min"],
                        "probability": 70,
                        "locationProfile": location_profile,
                        "ruleBasis": "IMD SOP for Squalls & Strong Winds",
                        "explanation": f"Forecast wind gusts of {wind_gust} km/h on {day_name} meet IMD Severe Squall criteria (>= 62 km/h).",
                        "limitations": ["Peak convective gust duration is typically 10–30 minutes."],
                        "official": False
                    })

        return upcoming
