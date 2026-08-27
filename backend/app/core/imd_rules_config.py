"""
IMD Warning Criteria and Skycast Weather Risk Configuration
Based on published India Meteorological Department (IMD) standard operating procedures,
impact-based forecasting guidelines, and hazard matrices.
"""

from typing import Dict, Any

# City Geographic Classification Profiles
CITY_LOCATION_PROFILES: Dict[str, str] = {
    # Urban Centres (Subject to urban drainage & concrete run-off thresholds)
    "pune": "urban",
    "mumbai": "urban",
    "new delhi": "urban",
    "delhi": "urban",
    "bengaluru": "urban",
    "bangalore": "urban",
    "chennai": "urban",
    "hyderabad": "urban",
    "kolkata": "urban",
    "ahmedabad": "urban",
    "jaipur": "urban",
    "lucknow": "urban",
    
    # Mountainous / Hilly / Landslide Vulnerable
    "srinagar": "hilly_landslide_vulnerable",
    "shimla": "hilly_landslide_vulnerable",
    "guwahati": "hilly_landslide_vulnerable",
    "darjeeling": "hilly_landslide_vulnerable",
    
    # Cold Desert Arid Zone
    "leh": "ladakh_vulnerable",
    "kargil": "ladakh_vulnerable",
    
    # Coastal Non-Mega Urban
    "goa": "coastal",
    "kochi": "coastal"
}

# Color Hierarchy for Multi-Hazard Aggregation
RISK_COLOR_PRIORITY = {
    "red": 4,
    "orange": 3,
    "yellow": 2,
    "green": 1
}

COLOR_MEANINGS = {
    "green": {
        "title": "No Warning",
        "action": "No Action",
        "guidance": "No severe weather expected. Conditions within normal range."
    },
    "yellow": {
        "title": "Watch",
        "action": "Be Updated",
        "guidance": "Potentially hazardous weather. Keep track of updates."
    },
    "orange": {
        "title": "Alert",
        "action": "Be Prepared",
        "guidance": "Severe weather expected. Disruption to transport and utilities possible."
    },
    "red": {
        "title": "Warning",
        "action": "Take Action",
        "guidance": "Extremely dangerous weather. High threat to life and property. Take immediate protective action."
    }
}

# IMD Rainfall Classification Thresholds (24-Hour Accumulation in mm)
IMD_RAINFALL_THRESHOLDS = {
    "very_light_max": 2.4,
    "light_min": 2.5,
    "light_max": 15.5,
    "moderate_min": 15.6,
    "moderate_max": 64.4,
    "heavy_min": 64.5,
    "heavy_max": 115.5,
    "very_heavy_min": 115.6,
    "very_heavy_max": 204.4,
    "extremely_heavy_min": 204.5
}

# Urban Impact-Based Rainfall Thresholds (24h mm)
URBAN_RAINFALL_THRESHOLDS = {
    "yellow_min": 50.0,
    "orange_min": 70.0,
    "red_min": 120.0
}

# Hilly / Landslide Vulnerable Rainfall Thresholds (24h mm)
HILLY_RAINFALL_THRESHOLDS = {
    "yellow_min": 50.0,
    "orange_min": 100.0,
    "red_min": 150.0
}

# Ladakh Vulnerable Zone Rainfall Thresholds (24h mm)
LADAKH_RAINFALL_THRESHOLDS = {
    "yellow_exact": 15.0,
    "orange_min": 16.0,
    "orange_max": 30.0,
    "red_min": 30.1
}

# IMD Squall & Wind Hazard Matrix (km/h)
# IMD defines a squall as a sudden increase of wind speed >= 29 km/h reaching >= 40 km/h for >= 1 minute.
# Moderate Squall: 52–61 km/h (28–33 knots); Severe: 62–87 km/h (34–47 knots); Very Severe: >= 88 km/h (>= 48 knots).
IMD_SQUALL_THRESHOLDS = {
    "strong_wind_min": 40.0,
    "strong_wind_max": 51.0,
    "moderate_squall_min": 52.0,
    "moderate_squall_max": 61.0,
    "severe_squall_min": 62.0,
    "severe_squall_max": 87.0,
    "very_severe_squall_min": 88.0
}

# IMD Heat Wave Thresholds (Plains / Coastal / Hills)
IMD_HEAT_THRESHOLDS = {
    "plains_prerequisite_c": 40.0,
    "plains_heatwave_abs_c": 45.0,
    "plains_severe_heatwave_abs_c": 47.0,
    "coastal_prerequisite_c": 37.0,
    "hilly_prerequisite_c": 30.0,
    "departure_heatwave_c": 4.5,
    "departure_severe_heatwave_c": 6.5
}

# IMD Cold Wave Thresholds (Plains / Hills)
IMD_COLD_THRESHOLDS = {
    "plains_prerequisite_c": 10.0,
    "plains_coldwave_abs_c": 4.0,
    "plains_severe_coldwave_abs_c": 2.0,
    "hilly_prerequisite_c": 0.0,
    "departure_coldwave_c": -4.5,
    "departure_severe_coldwave_c": -6.5
}

# IMD Fog & Surface Visibility Thresholds (Meters)
IMD_FOG_THRESHOLDS = {
    "shallow_min": 500.0,
    "shallow_max": 999.0,
    "moderate_min": 200.0,
    "moderate_max": 499.0,
    "dense_min": 50.0,
    "dense_max": 199.0,
    "very_dense_max": 49.0
}

# Documented Source References
RULE_REFERENCES = {
    "rainfall_general": "IMD Standard Operating Procedure for Weather Forecasting Section 4.1 (Rainfall Categories)",
    "rainfall_urban": "IMD Published Impact Based Forecasting Guidelines for Urban Inundation & Flash Flood Risk",
    "rainfall_hilly": "IMD SOP for Hilly / Landslide Prone Regions (Mountain Meteorological Guidelines)",
    "rainfall_ladakh": "IMD Ladakh High-Altitude Cold Desert Meteorological Guidance",
    "wind_squall": "IMD Wind & Squall Hazard Matrix for Severe Convective Storms",
    "heat_wave": "IMD Heat Wave Classification & Criteria for Indian Subcontinent",
    "cold_wave": "IMD Cold Wave Criteria for Northwest & Central India",
    "fog_visibility": "IMD Surface Visibility & Fog Classification Matrix (Section 4.5)",
    "thunderstorm": "IMD Convective Weather & Severe Storm Forecasting Matrix"
}
