# Data Quality & Meteorological Correctness Audit

## Overview
This document evaluates data integrity, unit conversions, meteorological accuracy, weather risk classification, and data freshness across all data pipelines.

---

### [DATA-01] Synthetic Temperature Calculations in Daily Forecast Fallbacks
* **Severity:** HIGH / METEOROLOGICAL INTEGRITY
* **Location:** [`backend/app/services/weather_hub.py:595-596`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/weather_hub.py#L595-L596)
* **Root Cause:**
  In `_normalize_raw_to_canonical()`:
  ```python
  high_c=float(daily_tmax[i]) if i < len(daily_tmax) else current_weather.temperature_c,
  low_c=float(daily_tmin[i]) if i < len(daily_tmin) else current_weather.temperature_c - 5,
  ```
  If upstream provider returns a daily forecast array shorter than 7 days, fallback logic invents daily minimum temperatures by subtracting 5°C from current temperature (`temperature_c - 5`).
* **Impact:** Distorts 7-day forecast data with fabricated temperature values instead of marking unavailable days.

---

### [DATA-02] Pressure Unit & Mean Sea Level vs Surface Pressure Discrepancy
* **Severity:** MEDIUM / METEOROLOGICAL METRICS
* **Location:** [`backend/app/services/weather_hub.py:458`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/weather_hub.py#L458)
* **Root Cause:**
  `live_pressure = float(curr_raw.get("pressure_msl", curr_raw.get("surface_pressure", 1013.0)))`.
  For high-altitude cities (e.g. Leh at 3,500m elevation), surface pressure is ~650 hPa while sea-level pressure is ~1013 hPa. Mixing surface pressure and sea-level pressure across different endpoints causes erratic barometric pressure trends on the Climate and Forecast pages.
* **Impact:** Inconsistent pressure readings for high-altitude geographic locations.

---

### [DATA-03] Precipitation Probability vs Accumulated Rainfall Confusion
* **Severity:** MEDIUM / DATA METRICS
* **Location:** [`src/features/forecast/ForecastPage.tsx:67`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/forecast/ForecastPage.tsx#L67) vs [`src/features/agriculture/AgriculturePage.tsx:167`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/agriculture/AgriculturePage.tsx#L167)
* **Root Cause:**
  In `AgriculturePage.tsx`, crop water needs progress bar uses:
  ```tsx
  style={{ width: `${Math.min(100, (d.precipitation_sum_mm || d.rainChance || 0))}%` }}
  ```
  This adds millimeters of rain (`precipitation_sum_mm`) directly to a percentage probability (`rainChance`), treating 5mm of rain as equivalent to a 5% chance of rain.
* **Impact:** Completely invalid crop water requirement progress calculations.

---

### [DATA-04] IMD Risk Classification Threshold Edge Cases
* **Severity:** LOW / RISK ACCURACY
* **Location:** [`backend/app/services/alert_engine.py:80-120`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/alert_engine.py#L80-L120)
* **Root Cause:**
  `SkycastRiskEngine` evaluates heatwave risks based on absolute maximum temperature (e.g. > 42°C for Red alert). However, official IMD heatwave criteria require comparing current temperatures against historical normal climatological baselines (e.g. +4.5°C above normal). Applying fixed national thresholds marks coastal cities like Mumbai as heatwaves at lower temperatures while missing severe heatwaves in hill stations.
* **Impact:** Geographically uncalibrated weather risk alerts.
