from typing import Dict, Any

MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "ecmwf_ifs": {
        "id": "ecmwf_ifs",
        "name": "ECMWF IFS",
        "organization": "ECMWF",
        "methodology": "physics_nwp",
        "forecast_type": "deterministic",
        "availability": "operational",
        "how_it_forecasts": "Physics-based numerical weather prediction.",
        "provider": "open_meteo",
        "forecast_horizon_days": 7,
        "update_cadence_hours": 6
    },
    "ecmwf_aifs": {
        "id": "ecmwf_aifs",
        "name": "ECMWF AIFS",
        "organization": "ECMWF",
        "methodology": "machine_learning",
        "forecast_type": "deterministic",
        "availability": "operational",
        "how_it_forecasts": "Machine-learning-based global forecasting system using historical/reanalysis information, with physics-based data assimilation for initial conditions.",
        "provider": "open_meteo",
        "forecast_horizon_days": 7,
        "update_cadence_hours": 6
    },
    "noaa_gfs": {
        "id": "noaa_gfs",
        "name": "NOAA GFS",
        "organization": "NOAA",
        "methodology": "physics_nwp",
        "forecast_type": "deterministic",
        "availability": "operational",
        "how_it_forecasts": "Physics-based numerical weather prediction.",
        "provider": "open_meteo",
        "forecast_horizon_days": 7,
        "update_cadence_hours": 6
    },
    "dwd_icon": {
        "id": "dwd_icon",
        "name": "DWD ICON",
        "organization": "DWD",
        "methodology": "physics_nwp",
        "forecast_type": "deterministic",
        "availability": "operational",
        "how_it_forecasts": "Physics-based numerical weather prediction.",
        "provider": "open_meteo",
        "forecast_horizon_days": 7,
        "update_cadence_hours": 6
    },
    "google_weathernext2": {
        "id": "google_weathernext2",
        "name": "Google WeatherNext 2",
        "organization": "Google DeepMind / Google",
        "methodology": "generative_ai",
        "forecast_type": "probabilistic",
        "availability": "operational",
        "how_it_forecasts": "Generative AI-based probabilistic weather forecasting that produces an ensemble of plausible future atmospheric states.",
        "provider": "open_meteo",
        "forecast_horizon_days": 7,
        "update_cadence_hours": 12
    }
}
