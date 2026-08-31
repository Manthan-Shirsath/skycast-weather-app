# Frontend Architecture & UI Bugs Report

## Overview
This document details frontend bugs identified across React 19 components, React Router navigation, State management, MapLibre rendering, and UI assets.

---

### [FRONTEND-01] MapLibre Sovereign Boundary Layer Exception on Style Switch
* **Severity:** HIGH
* **Location:** [`src/features/map/MapPage.tsx:266-315`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/map/MapPage.tsx#L266-L315)
* **Root Cause:**
  `setupIndiaBoundaryOverlay` attempts to insert `india-boundary-glow` before `rainviewer-layer` or `owm-overlay-layer`:
  ```tsx
  const beforeId = mapInstance.getLayer('rainviewer-layer')
    ? 'rainviewer-layer'
    : mapInstance.getLayer('owm-overlay-layer')
      ? 'owm-overlay-layer'
      : undefined;
  ```
  When switching basemap themes (e.g. from Voyager to Dark), `BASEMAP_STYLES` completely resets the style specification. If `styledata` fires before raster weather layers are added, `mapInstance.addLayer(..., beforeId)` is called with a `beforeId` layer that does not exist in the new style, causing MapLibre to throw an unhandled JavaScript exception.
* **Impact:** Toggling basemap themes or overlay options on the interactive map crashes map rendering.

---

### [FRONTEND-02] Disconnected Dual API Calling Paths for WeatherGPT
* **Severity:** MEDIUM
* **Location:** [`src/features/weathergpt/WeatherGPTPage.tsx:75-88`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/weathergpt/WeatherGPTPage.tsx#L75-L88) vs [`src/lib/api/client.ts:42`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/lib/api/client.ts#L42)
* **Root Cause:**
  `WeatherGPTPage.tsx` bypasses the central `weatherApi` client library in `src/lib/api/client.ts` and issues a direct `fetch('/api/chat', ...)` call with inline JSON formatting. However, `hooks.ts` provides `useWeatherGPT()` which calls `weatherApi.chat()`. `weatherApi.chat()` does not pass `session_id`, `language`, `user_role`, or `context`, creating conflicting behavior between component views.
* **Impact:** Inconsistent conversation state and missing features when invoking AI chat via different UI hooks.

---

### [FRONTEND-03] Recharts Infinite Resize Loop Warning & Grid Overflow
* **Severity:** MEDIUM
* **Location:** [`src/features/forecast/ForecastPage.tsx:91-124`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/forecast/ForecastPage.tsx#L91-L124) and [`src/features/climate/ClimatePage.tsx:142-200`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/climate/ClimatePage.tsx#L142-L200)
* **Root Cause:**
  `<ResponsiveContainer width="100%" height="100%">` is rendered inside CSS grid items (`grid-cols-1 lg:grid-cols-3`) without setting `min-w-0` on parent elements or defining explicit aspect ratios.
* **Impact:** Causes Recharts `ResizeObserver loop completed with undelivered notifications` browser warnings and horizontal page scrolling on smaller screens.

---

### [FRONTEND-04] Locations Page Stale State & Undefined Field Render
* **Severity:** MEDIUM
* **Location:** [`src/features/locations/LocationsPage.tsx:150-160`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/locations/LocationsPage.tsx#L150-L160)
* **Root Cause:**
  When rendering saved location cards:
  ```tsx
  <span>H: {data.highC}° L: {data.lowC}°</span>
  ```
  If `highC` or `lowC` are null or missing from the backend response (which occurs when point weather is returned or upstream geocoding returns partial payloads), React renders `"H: undefined° L: undefined°"`.
* **Impact:** Visual corruption and ugly `undefined°` text displayed on location cards.

---

### [FRONTEND-05] Missing Weather Background Image Folders
* **Severity:** LOW / VISUAL
* **Location:** [`src/lib/weather-visuals.ts:63-66`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/lib/weather-visuals.ts#L63-L66)
* **Root Cause:**
  `getWeatherBackground` constructs image paths such as `/weather-backgrounds/rain/afternoon.jpg`. While `clear`, `cloudy`, `fog`, `rain`, `snow`, and `storm` directories exist in `public/weather-backgrounds`, `rain/morning.jpg` and `rain/night.jpg` reference images with different compression ratios or naming conventions, leading to fallback failures when conditions change.
* **Impact:** Flashing default dark backgrounds when switching between weather conditions.
