import os
from pathlib import Path
from dotenv import load_dotenv

# Automatically load backend/.env if present
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# Environment Configurations
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
GOOGLE_WEATHER_API_KEY = os.getenv("GOOGLE_WEATHER_API_KEY", "").strip()
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "").strip()

# Cache TTLs (in seconds)
TTL_CURRENT_WEATHER = int(os.getenv("TTL_CURRENT_WEATHER", "300"))  # 5 minutes
TTL_MAP_WEATHER = int(os.getenv("TTL_MAP_WEATHER", "300"))          # 5 minutes
TTL_FORECAST = int(os.getenv("TTL_FORECAST", "900"))                # 15 minutes
TTL_RADAR_META = int(os.getenv("TTL_RADAR_META", "180"))            # 3 minutes
TTL_ALERTS = int(os.getenv("TTL_ALERTS", "600"))                    # 10 minutes
TTL_GOOGLE_ALERTS = int(os.getenv("TTL_GOOGLE_ALERTS", "600"))      # 10 minutes
TTL_OPENWEATHER_ALERTS = int(os.getenv("TTL_OPENWEATHER_ALERTS", "600")) # 10 minutes

# Background Collector polling intervals (in seconds)
COLLECTOR_POLL_INTERVAL = int(os.getenv("COLLECTOR_POLL_INTERVAL", "180")) # 3 minutes

# Configurable Alert Detection Thresholds
ALERT_THRESHOLDS = {
    "rain": {
        "extreme_precip_mm": float(os.getenv("ALERT_RAIN_EXTREME_PRECIP", "25.0")),
        "extreme_prob_pct": int(os.getenv("ALERT_RAIN_EXTREME_PROB", "90")),
        "severe_precip_mm": float(os.getenv("ALERT_RAIN_SEVERE_PRECIP", "10.0")),
        "severe_prob_pct": int(os.getenv("ALERT_RAIN_SEVERE_PROB", "70")),
        "moderate_precip_mm": float(os.getenv("ALERT_RAIN_MOD_PRECIP", "2.0")),
        "moderate_prob_pct": int(os.getenv("ALERT_RAIN_MOD_PROB", "35")),
    },
    "wind": {
        "extreme_speed_kmh": float(os.getenv("ALERT_WIND_EXTREME", "60.0")),
        "severe_speed_kmh": float(os.getenv("ALERT_WIND_SEVERE", "38.0")),
        "moderate_speed_kmh": float(os.getenv("ALERT_WIND_MOD", "24.0")),
    },
    "temperature": {
        "extreme_heat_c": float(os.getenv("ALERT_TEMP_EXTREME_HEAT", "42.0")),
        "severe_heat_c": float(os.getenv("ALERT_TEMP_SEVERE_HEAT", "37.0")),
        "moderate_heat_c": float(os.getenv("ALERT_TEMP_MOD_HEAT", "33.0")),
        "extreme_cold_c": float(os.getenv("ALERT_TEMP_EXTREME_COLD", "3.0")),
        "severe_cold_c": float(os.getenv("ALERT_TEMP_SEVERE_COLD", "7.0")),
    },
    "uv": {
        "extreme_uv": float(os.getenv("ALERT_UV_EXTREME", "11.0")),
        "severe_uv": float(os.getenv("ALERT_UV_SEVERE", "8.0")),
        "moderate_uv": float(os.getenv("ALERT_UV_MOD", "6.0")),
    },
    "visibility": {
        "extreme_fog_km": float(os.getenv("ALERT_VIS_EXTREME", "0.5")),
        "severe_fog_km": float(os.getenv("ALERT_VIS_SEVERE", "1.5")),
        "moderate_fog_km": float(os.getenv("ALERT_VIS_MOD", "3.0")),
    }
}
