"""
Unit Tests for Skycast Weather Risk Engine
Validates strict separation of IMD Hazard Classification from Skycast Risk Assessment,
exact boundary conditions, location profiles, and non-official metadata constraints.
"""

import pytest
from backend.app.services.alert_engine import SkycastRiskEngine

def make_weather_data(
    precip_24h=0.0,
    wind_gust=10.0,
    weather_code=0,
    t_max=25.0,
    t_min=18.0,
    visibility_m=10000.0,
    rain_prob=20
):
    return {
        "current": {
            "temperature_2m": t_max,
            "wind_speed_10m": wind_gust * 0.7,
            "wind_gusts_10m": wind_gust,
            "weather_code": weather_code,
            "precipitation": 0.0
        },
        "daily": {
            "precipitation_sum": [precip_24h],
            "precipitation_probability_max": [rain_prob],
            "temperature_2m_max": [t_max],
            "temperature_2m_min": [t_min],
            "wind_gusts_10m_max": [wind_gust]
        },
        "hourly": {
            "visibility": [visibility_m]
        },
        "details": {
            "visibilityKm": visibility_m / 1000.0
        }
    }


# ==============================================================================
# 1. IMD RAINFALL HAZARD CLASSIFICATION TESTS (Pure Meteorological Categories)
# ==============================================================================

@pytest.mark.parametrize("precip, expected_hazard_class", [
    (1.0, "no_significant_rain"),
    (2.4, "no_significant_rain"),
    (2.5, "light_rain"),
    (15.5, "light_rain"),
    (15.6, "moderate_rain"),
    (64.4, "moderate_rain"),
    (64.5, "heavy_rain"),
    (115.5, "heavy_rain"),
    (115.6, "very_heavy_rain"),
    (204.4, "very_heavy_rain"),
    (204.5, "extremely_heavy_rain"),
    (300.0, "extremely_heavy_rain")
])
def test_imd_rainfall_hazard_classification(precip, expected_hazard_class):
    """Verifies physical IMD hazard classification is computed accurately regardless of location."""
    data = make_weather_data(precip_24h=precip)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="GenericLocation")
    
    if expected_hazard_class in ["no_significant_rain", "light_rain", "moderate_rain"]:
        # General profile does not trigger yellow/orange/red warning for moderate rain
        assert res["highestRiskColour"] == "green"
    else:
        rain_alerts = [a for a in res["alerts"] if a["hazard"] == "rain"]
        assert len(rain_alerts) == 1
        assert rain_alerts[0]["hazardClassification"] == expected_hazard_class
        assert rain_alerts[0]["official"] is False
        assert rain_alerts[0]["source"] == "skycast"
        assert "ruleBasis" in rain_alerts[0]
        assert "limitations" in rain_alerts[0]


# ==============================================================================
# 2. CONTEXTUAL SKYCAST RAINFALL RISK LEVEL TESTS (Location Profiles)
# ==============================================================================

@pytest.mark.parametrize("precip, expected_class, expected_risk_level", [
    (64.4, "moderate_rain", "green"),
    (64.5, "heavy_rain", "yellow"),
    (115.5, "heavy_rain", "yellow"),
    (115.6, "very_heavy_rain", "orange"),
    (204.4, "very_heavy_rain", "orange"),
    (204.5, "extremely_heavy_rain", "red")
])
def test_general_profile_skycast_risk(precip, expected_class, expected_risk_level):
    data = make_weather_data(precip_24h=precip)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="RuralTown")
    assert res["locationProfile"] == "normal"
    assert res["highestRiskColour"] == expected_risk_level


@pytest.mark.parametrize("precip, expected_class, expected_risk_level", [
    (49.9, "moderate_rain", "green"),
    (50.0, "moderate_rain", "yellow"),      # Urban impact threshold triggers yellow even if IMD class is moderate
    (69.9, "heavy_rain", "yellow"),
    (70.0, "heavy_rain", "orange"),          # Urban impact threshold triggers orange
    (119.9, "very_heavy_rain", "orange"),
    (120.0, "very_heavy_rain", "red")        # Urban inundation threshold triggers red
])
def test_urban_profile_skycast_risk(precip, expected_class, expected_risk_level):
    """Tests urban drainage impact thresholds separating IMD classification from Skycast risk level."""
    data = make_weather_data(precip_24h=precip)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Pune")
    assert res["locationProfile"] == "urban"
    assert res["highestRiskColour"] == expected_risk_level
    if expected_risk_level != "green":
        alert = res["alerts"][0]
        assert alert["hazardClassification"] == expected_class
        assert alert["skycastRiskLevel"] == expected_risk_level
        assert alert["skycastRiskColour"] == expected_risk_level


@pytest.mark.parametrize("precip, expected_class, expected_risk_level", [
    (49.9, "moderate_rain", "green"),
    (50.0, "moderate_rain", "yellow"),
    (99.9, "heavy_rain", "yellow"),
    (100.0, "heavy_rain", "orange"),
    (149.9, "very_heavy_rain", "orange"),
    (150.0, "very_heavy_rain", "red")
])
def test_hilly_profile_skycast_risk(precip, expected_class, expected_risk_level):
    data = make_weather_data(precip_24h=precip)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Srinagar")
    assert res["locationProfile"] == "hilly_landslide_vulnerable"
    assert res["highestRiskColour"] == expected_risk_level


@pytest.mark.parametrize("precip, expected_risk_level", [
    (14.9, "green"),
    (15.0, "yellow"),
    (15.1, "yellow"),
    (16.0, "orange"),
    (30.0, "orange"),
    (30.1, "red")
])
def test_ladakh_profile_skycast_risk(precip, expected_risk_level):
    data = make_weather_data(precip_24h=precip)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Leh")
    assert res["locationProfile"] == "ladakh_vulnerable"
    assert res["highestRiskColour"] == expected_risk_level


# ==============================================================================
# 3. IMD SQUALL & WIND HAZARD CLASSIFICATION & SKYCAST RISK
# ==============================================================================

@pytest.mark.parametrize("gust, expected_hazard_class, expected_risk_level", [
    (39.9, "light_wind", "green"),
    (40.0, "strong_surface_wind", "yellow"),
    (51.0, "strong_surface_wind", "yellow"),
    (52.0, "moderate_squall", "yellow"),       # Official IMD Moderate Squall starts at 52 km/h
    (61.0, "moderate_squall", "yellow"),
    (62.0, "severe_squall", "orange"),         # Official IMD Severe Squall starts at 62 km/h
    (87.0, "severe_squall", "orange"),
    (88.0, "very_severe_squall", "red")        # Official IMD Very Severe Squall starts at 88 km/h
])
def test_squall_classification_and_risk(gust, expected_hazard_class, expected_risk_level):
    data = make_weather_data(wind_gust=gust)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="GenericCity")
    
    wind_alerts = [a for a in res["alerts"] if a["hazard"] == "squall_wind"]
    if expected_risk_level == "green":
        assert len(wind_alerts) == 0
    else:
        assert len(wind_alerts) == 1
        alert = wind_alerts[0]
        assert alert["hazardClassification"] == expected_hazard_class
        assert alert["skycastRiskLevel"] == expected_risk_level
        assert alert["official"] is False
        assert alert["source"] == "skycast"


# ==============================================================================
# 4. IMD HEAT WAVE HAZARD CLASSIFICATION & SKYCAST RISK
# ==============================================================================

@pytest.mark.parametrize("t_max, expected_hazard_class, expected_risk_level", [
    (39.9, "normal_temperature", "green"),
    (40.0, "high_temperature", "yellow"),      # Prerequisite >= 40 C met
    (44.9, "high_temperature", "yellow"),
    (45.0, "heat_wave", "orange"),              # Absolute heatwave >= 45 C
    (46.9, "heat_wave", "orange"),
    (47.0, "severe_heat_wave", "red")           # Absolute severe heatwave >= 47 C
])
def test_heat_wave_classification_and_risk(t_max, expected_hazard_class, expected_risk_level):
    data = make_weather_data(t_max=t_max)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Nagpur")
    
    heat_alerts = [a for a in res["alerts"] if a["hazard"] == "heat_wave"]
    if expected_risk_level == "green":
        assert len(heat_alerts) == 0
    else:
        assert len(heat_alerts) == 1
        alert = heat_alerts[0]
        assert alert["hazardClassification"] == expected_hazard_class
        assert alert["skycastRiskLevel"] == expected_risk_level
        assert alert["official"] is False
        assert alert["source"] == "skycast"
        assert any("Departure-based" in lim for lim in alert["limitations"])


# ==============================================================================
# 5. IMD COLD WAVE HAZARD CLASSIFICATION & SKYCAST RISK
# ==============================================================================

@pytest.mark.parametrize("t_min, expected_hazard_class, expected_risk_level", [
    (10.1, "normal_cold", "green"),
    (10.0, "low_temperature", "yellow"),       # Prerequisite <= 10 C met
    (4.1, "low_temperature", "yellow"),
    (4.0, "cold_wave", "orange"),               # Absolute coldwave <= 4 C
    (2.1, "cold_wave", "orange"),
    (2.0, "severe_cold_wave", "red")            # Absolute severe coldwave <= 2 C
])
def test_cold_wave_classification_and_risk(t_min, expected_hazard_class, expected_risk_level):
    data = make_weather_data(t_min=t_min)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Amritsar")
    
    cold_alerts = [a for a in res["alerts"] if a["hazard"] == "cold_wave"]
    if expected_risk_level == "green":
        assert len(cold_alerts) == 0
    else:
        assert len(cold_alerts) == 1
        alert = cold_alerts[0]
        assert alert["hazardClassification"] == expected_hazard_class
        assert alert["skycastRiskLevel"] == expected_risk_level
        assert alert["official"] is False
        assert alert["source"] == "skycast"
        assert any("Departure-based" in lim for lim in alert["limitations"])


# ==============================================================================
# 6. IMD FOG HAZARD CLASSIFICATION & SKYCAST RISK
# ==============================================================================

@pytest.mark.parametrize("vis_m, expected_hazard_class, expected_risk_level", [
    (1000.0, "no_fog", "green"),
    (999.0, "shallow_fog", "yellow"),
    (500.0, "shallow_fog", "yellow"),
    (499.0, "moderate_fog", "yellow"),
    (200.0, "moderate_fog", "yellow"),
    (199.0, "dense_fog", "orange"),
    (50.0, "dense_fog", "orange"),
    (49.0, "very_dense_fog", "red")
])
def test_fog_classification_and_risk(vis_m, expected_hazard_class, expected_risk_level):
    data = make_weather_data(visibility_m=vis_m)
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Delhi")
    
    fog_alerts = [a for a in res["alerts"] if a["hazard"] == "fog_visibility"]
    if expected_risk_level == "green":
        assert len(fog_alerts) == 0
    else:
        assert len(fog_alerts) == 1
        alert = fog_alerts[0]
        assert alert["hazardClassification"] == expected_hazard_class
        assert alert["skycastRiskLevel"] == expected_risk_level
        assert alert["official"] is False
        assert alert["source"] == "skycast"


# ==============================================================================
# 7. MULTI-HAZARD PRIORITY & OVERRIDE
# ==============================================================================

def test_multiple_simultaneous_hazards():
    # Rainfall (Orange) + Dense Fog (Orange) + Strong Wind (Yellow)
    data = make_weather_data(
        precip_24h=80.0,       # Urban Orange (>= 70)
        wind_gust=45.0,        # Strong Wind (Yellow)
        visibility_m=150.0     # Dense Fog (Orange)
    )
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Pune")
    
    assert res["highestRiskColour"] == "orange"
    assert res["highestRiskAction"] == "Be Prepared"
    assert len(res["alerts"]) == 3
    
    hazard_types = [a["hazard"] for a in res["alerts"]]
    assert "rain" in hazard_types
    assert "squall_wind" in hazard_types
    assert "fog_visibility" in hazard_types


def test_red_priority_override():
    # Extremely heavy rain (Red) + Moderate Fog (Yellow)
    data = make_weather_data(
        precip_24h=140.0,      # Urban Red (>= 120)
        visibility_m=400.0     # Moderate Fog (Yellow)
    )
    res = SkycastRiskEngine.evaluate_all_risks(data, city_name="Mumbai")
    
    assert res["highestRiskColour"] == "red"
    assert res["highestRiskAction"] == "Take Action"
    assert len(res["alerts"]) == 2
