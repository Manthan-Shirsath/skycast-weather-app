# SkyCast Forecast Intelligence Suite

## The Shift to Methodology-Diverse Forecasting

Traditionally, weather applications offer side-by-side comparisons of different **Weather Agencies** (e.g., NOAA GFS vs. ECMWF IFS vs. DWD ICON). While this offers some variety, these models are all fundamentally built on the same underlying philosophy: **Physics-based Numerical Weather Prediction (NWP)**.

SkyCast's Forecast Intelligence Suite pioneers **Methodology-Diverse Forecasting**. Instead of just comparing different government agencies, we actively compare radically different approaches to predicting the future state of the atmosphere:

1. **Physics-Based NWP** (The Baseline): Solves complex fluid dynamics equations on supercomputers (GFS, ECMWF IFS, ICON).
2. **Machine Learning (ML) Models**: Fast, data-driven predictions trained on decades of historical reanalysis data (ECMWF AIFS).
3. **Generative & Probabilistic AI**: Ensemble models that capture uncertainty and predict probabilistic outcomes based on AI architecture (Google WeatherNext 2).

This diversity ensures that SkyCast isn't just subject to the systemic biases of one mathematical approach.

## Supported Models

| Model | Type | Description | Integration Endpoint |
|---|---|---|---|
| **ECMWF IFS** | Physics NWP | The European Centre's flagship global deterministic model. | Open-Meteo Base |
| **NOAA GFS** | Physics NWP | The US Global Forecast System, seamless resolution. | Open-Meteo Base |
| **DWD ICON** | Physics NWP | The German Weather Service's non-hydrostatic model. | Open-Meteo Base |
| **ECMWF AIFS** | Machine Learning | ECMWF's Artificial Intelligence Forecasting System. | Open-Meteo AI |
| **Google WeatherNext 2** | GenAI / Ensemble | Google's probabilistic GenAI ensemble forecasting model. | Open-Meteo Ensemble |

*(Note: While DeepMind GraphCast and GenCast were evaluated, they are not currently supported by our upstream provider endpoints in a unified format, so we default to AIFS and WeatherNext 2 for ML/AI diversity).*

## Architecture & Data Flow

### 1. Ingestion Pipeline
The `ForecastIngestionWorker` (`backend/app/services/forecast_ingestion.py`) runs periodically to fetch and normalize data from Open-Meteo's API endpoints. 

- **Deterministic Models**: Fetched from standard Open-Meteo API.
- **Ensemble Models (WeatherNext 2)**: Fetched from the Open-Meteo Ensemble API. 

Because ensemble models (like WeatherNext 2) return multiple probability members (e.g., `member01`, `member02`, ..., `member64`) for a single time step, the ingestion logic dynamically discovers the members rather than hard-coding array bounds.

### 2. Database Schema
To support ensemble members colliding on the exact same `(forecast_run_id, valid_time, lead_hours, variable)`, we expanded the `UniqueConstraint` on the `forecast_values` PostgreSQL table.

The new unique identity is:
```python
UniqueConstraint(
    "forecast_run_id", 
    "valid_time", 
    "lead_hours", 
    "variable", 
    "representation", # Added: e.g., 'deterministic', 'member01', 'member_mean'
    name="uix_forecast_value_identity"
)
```
This ensures deterministic runs and individual ensemble members can coexist perfectly in the same time-series table.

### 3. Frontend Visualization
The `ForecastIntelligencePage.tsx` aggregates the timeseries and plots it using Recharts. 
Due to the sheer volume of data returned by these models across multiple days, we use `minTickGap={40}` on the `XAxis` to prevent label collision and ensure a clean, smooth, readable chart. The legend explicitly labels the methodologies (AI vs. Physics) so users can instantly visually compare the difference in reasoning.

## Future Extensibility
Adding new models (like Nvidia FourCastNet or future GenCast versions) requires only:
1. Adding the model to `ModelRegistry`.
2. Configuring the Open-Meteo parameters in `forecast_ingestion.py`.
3. The dynamic data mapping will handle the rest natively.
