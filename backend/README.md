# SkyCast FastAPI Backend

Lightweight Python FastAPI backend that interfaces with Open-Meteo API to provide real-time weather forecasts to the SkyCast React frontend.

## Features

- **FastAPI & Uvicorn**: High performance async backend with automatic Swagger UI (`/docs`).
- **Open-Meteo Geocoding & Weather Forecast**: Fetches accurate coordinates and live weather metrics.
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
