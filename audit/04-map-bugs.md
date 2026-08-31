# Map & MapLibre Integration Bugs Report

## Overview
This document details issues related to MapLibre GL JS integration, tile rendering, RainViewer radar overlays, OpenWeatherMap raster layers, map controls, and geographic boundary rendering.

---

### [MAP-01] Missing Error Handling & Fallback for Missing RainViewer Radar Tiles
* **Severity:** HIGH / UI
* **Location:** [`src/features/map/MapPage.tsx:446-459`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/map/MapPage.tsx#L446-L459)
* **Root Cause:**
  `currentTileUrl` constructs RainViewer raster tile URLs using the active timestamp path:
  ```tsx
  return `${radarMeta.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  ```
  RainViewer radar tile servers periodically drop or delay processing for specific past/nowcast timestamps. When MapLibre requests tiles for an unavailable timestamp, tile servers respond with HTTP 404. MapLibre attempts retries continuously, flooding the browser console with network errors and rendering transparent/flickering map tiles during animation playback.
* **Impact:** Visual stuttering and console error spam during radar animation playback.

---

### [MAP-02] Duplicate Navigation Route Definitions (`/map` vs `/maps`)
* **Severity:** MEDIUM / ROUTING
* **Location:** [`src/app/router.tsx:18-20`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/app/router.tsx#L18-L20)
* **Root Cause:**
  `router.tsx` defines two routes pointing to `MapPage`:
  ```tsx
  { path: '/map', element: <MapPage /> },
  { path: '/maps', element: <MapPage /> },
  ```
  Throughout the codebase, navigation buttons use `/map` in some components (e.g. AppLayout) and `/maps` in others (e.g. WeatherHero).
* **Impact:** Toggling between views creates duplicate history entries in the browser back-stack and breaks active tab highlighting in the navigation sidebar.

---

### [MAP-03] Precision Mismatch between Map Clicks and Point Weather Cache Key
* **Severity:** MEDIUM / PRECISION
* **Location:** [`src/features/map/MapPage.tsx:422`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/map/MapPage.tsx#L422) vs [`backend/app/services/weather_hub.py:279`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/weather_hub.py#L279)
* **Root Cause:**
  Frontend sends 4-decimal precision coordinates: `/api/map/point?lat=18.5204&lon=73.8567`.
  However, `weather_hub.py` constructs the Redis cache key using 2-decimal rounding:
  ```python
  cache_key = f"weather:point:{round(lat, 2)}:{round(lon, 2)}"
  ```
  `round(18.5204, 2)` becomes `18.52`. Clicking 800 meters away at `(18.5249, 73.8549)` rounds to the exact same key (`weather:point:18.52:73.85`) and returns cached weather from the previous click point.
* **Impact:** Point weather popups display identical weather data for distinct map click locations within ~1.1 km radius without informing the user that spatial rounding occurred.

---

### [MAP-04] Sovereign Boundary GeoJSON Fetch Blocking Map Initialization
* **Severity:** LOW / PERFORMANCE
* **Location:** [`src/features/map/MapPage.tsx:241-248`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/map/MapPage.tsx#L241-L248)
* **Root Cause:**
  `fetch('/india-boundary.json')` loads the entire sovereign boundary GeoJSON payload on component mount. If network latency is high or static file serving fails, `boundaryGeoJSON` remains null, and boundary overlays fail to render silently without user notification.
* **Impact:** Missing boundary outline indicator when boundary GeoJSON fails to download.
