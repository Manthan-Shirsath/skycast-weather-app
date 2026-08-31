# SkyCast FastAPI Backend

Lightweight Python FastAPI backend that interfaces with Open-Meteo API and IMD/WIS2.0 providers to supply real-time weather forecasts to the SkyCast React frontend.

## Features

- **FastAPI & Uvicorn**: High performance async backend with automatic Swagger UI (`/docs`).
- **Multi-Provider Architecture**: Pluggable weather providers (Open-Meteo, IMD/WIS2.0, extensible to GFS, WRF, ECMWF).
- **Open-Meteo Geocoding & Weather Forecast**: Fetches accurate coordinates and live weather metrics.
- **IMD/WIS2.0 Integration**: Adapter for India Meteorological Department data via WIS2.0 MQTT (mock fixture + live-mode capable).
- **Data Provenance Tracking**: `source_provenance` field indicates data origin ("open-meteo" | "imd-wis2" | "blended").
- **Pydantic Validation**: Strong typing and serialization for all endpoints.
- **WMO Weather Code Decoding**: Maps standard WMO weather codes to human-readable strings and UI icons.
- **CORS Configured**: Ready for local and production frontend integration.
- **Error Handling**: 404 for unknown locations, 502 for upstream API failures.

## Quick Start

### 1. Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Run the FastAPI Server
```bash
python backend/main.py
```
or via uvicorn directly:
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

## Weather Data Providers

### Current State (as of SIH PS #26068 alignment)

**Production-Ready:**
- **Open-Meteo** (default): Free, no-auth global weather data. Currently the primary live provider.

**Demonstration/Mock Mode:**
- **IMD/WIS2.0**: Reads from fixture file (`backend/app/services/providers/fixtures/wis2_sample_bulletin.json`). MQTT live-mode is architecturally supported but requires real WIS2.0 broker credentials.

### Data Provenance

Every weather response includes a `sourceProvenance` field:
```json
{
  "sourceProvenance": "open-meteo",  // or "imd-wis2", or "blended"
  "provider": "open_meteo",
  "nwpSource": "gfs_seamless",
  "nwpModel": "NOAA GFS (Global Forecast System)",
  "fetchedAt": "2026-08-29T12:30:45Z"
}
```

This directly addresses SIH PS #26068's requirement: **"Why this forecast?"** — evaluators and users can trace any forecast number back to its upstream source.

### Switching Providers

#### Enable IMD/WIS2.0 Live Mode (for future integration with real IMD endpoint)

1. **Obtain WIS2.0 credentials** from IMD (wis2.imdpune.gov.in or designated endpoint)
2. **Set environment variables** in `backend/.env`:
   ```
   IMD_LIVE_MODE=true
   WIS2_BROKER_URL=wis2.imdpune.gov.in:1883
   WIS2_USERNAME=your_imd_username
   WIS2_PASSWORD=your_imd_password
   ```
3. **Restart backend**. The IMD provider will automatically connect via MQTT.

#### Development Mode (Fixture)

By default, IMD provider reads from a static fixture:
```
backend/app/services/providers/fixtures/wis2_sample_bulletin.json
```

This fixture mimics real WIS2.0 GRIB2-derived data structure and includes:
- Current conditions for Pune, Mumbai, New Delhi
- 24-hour hourly forecast (temperature, precipitation, wind)
- 7-day daily forecast
- IMD-tier hazard classifications (Yellow, Orange, Red alerts)

To use: simply leave `IMD_LIVE_MODE=false` (default).

### Adding Future Providers (GFS, WRF, ECMWF)

1. **Create new provider** in `backend/app/services/providers/{provider_name}.py`
2. **Inherit from** `BaseWeatherProvider` (see `base.py`)
3. **Implement required methods**: `geocode_city()`, `fetch_forecast()`, `fetch_batch_forecast()`
4. **Register in weather_hub.py**: Update provider selection logic
5. **Tests**: Add test file in `backend/tests/` following existing pattern

## API Specification

### `GET /api/weather?city={cityName}`

#### Query Parameters:
- `city` (string, required): Name of the city (e.g. `Pune`, `Mumbai`, `London`, `Tokyo`, `New York`)

#### Example Response:
```json
{
  "city": "Pune",
  "region": "Maharashtra",
  "displayLocation": "Pune, Maharashtra",
  "date": "TUESDAY, AUGUST 25",
  "tempC": 27,
  "condition": "Cloudy",
  "feelsLikeC": 28,
  "highC": 28,
  "lowC": 23,
  "humidity": 71,
  "windSpeedKmh": 19,
  "insight": {
    "title": "Passing clouds & scattered rain",
    "description": "Cloud cover will keep conditions pleasant with a slight chance of showers.",
    "rainChance": 51
  },
  "hourly": [
    { "time": "Now", "tempC": 27, "icon": "cloudy", "active": true },
    { "time": "17:00", "tempC": 26, "icon": "cloudy", "active": false },
    { "time": "18:00", "tempC": 25, "icon": "cloudy", "active": false },
    { "time": "19:00", "tempC": 24, "icon": "cloudy", "active": false },
    { "time": "20:00", "tempC": 23, "icon": "cloudy", "active": false },
    { "time": "21:00", "tempC": 24, "icon": "cloudy", "active": false },
    { "time": "22:00", "tempC": 23, "icon": "cloudy", "active": false }
  ],
  "daily": [
    { "day": "Today", "condition": "Light Drizzle", "highC": 28, "lowC": 23, "rainChance": 51, "icon": "rain" },
    { "day": "Wed", "condition": "Light Drizzle", "highC": 28, "lowC": 23, "rainChance": 61, "icon": "rain" },
    { "day": "Thu", "condition": "Moderate Drizzle", "highC": 28, "lowC": 23, "rainChance": 92, "icon": "rain" },
    { "day": "Fri", "condition": "Light Drizzle", "highC": 27, "lowC": 23, "rainChance": 100, "icon": "rain" },
    { "day": "Sat", "condition": "Light Drizzle", "highC": 27, "lowC": 23, "rainChance": 91, "icon": "rain" },
    { "day": "Sun", "condition": "Light Drizzle", "highC": 27, "lowC": 23, "rainChance": 67, "icon": "rain" },
    { "day": "Mon", "condition": "Light Drizzle", "highC": 28, "lowC": 22, "rainChance": 51, "icon": "rain" }
  ]
}
```
