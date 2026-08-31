# Critical & System-Breaking Bugs Report

## Overview
This document details critical, system-breaking bugs discovered during the comprehensive software engineering audit of the SkyCast weather platform. These issues cause application crashes, API failures, security vulnerabilities, or broken core workflows.

---

### [CRITICAL-01] Parameter Name Mismatch in `chat_weather` Route Crashes AI Agent Endpoint
* **Severity:** CRITICAL / BLOCKER
* **Location:** [`backend/app/routes/chat.py:57`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/routes/chat.py#L57) vs [`backend/app/services/agent/agent.py:131`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/agent/agent.py#L131)
* **Root Cause:**
  In `chat.py`, the endpoint handler calls:
  ```python
  agent_res: AgentResponse = await weather_agent.run(
      message=user_query,
      session_id=req.session_id,
      default_city=req.city or "Pune",
      language=req.language or "en",
      user_role=req.user_role or UserRole.GENERAL_PUBLIC.value,
      context=req.context # <--- BUG: parameter name in method signature is ui_context
  )
  ```
  However, `WeatherGPTAgent.run()` method signature in `agent.py` is defined as:
  ```python
  async def run(
      self,
      message: str,
      session_id: Optional[str] = None,
      default_city: Optional[str] = None,
      language: str = "en",
      user_role: str = "general_public",
      ui_context: Optional[Dict[str, Any]] = None # <--- Named ui_context
  )
  ```
* **Impact:** Any HTTP POST request to `/api/chat` that includes a `context` field in its JSON request payload (which `WeatherGPTPage.tsx` sends on line 84) raises a Python `TypeError: WeatherGPTAgent.run() got an unexpected keyword argument 'context'`, resulting in a 502/500 Server Error for the user.
* **Reproduction Steps:**
  1. Open WeatherGPT page.
  2. Type any question (e.g., "Will it rain today?").
  3. Frontend sends POST `/api/chat` with `{ "message": "...", "context": { ... } }`.
  4. Backend raises `TypeError` and returns HTTP 502 error.

---

### [CRITICAL-02] OWM Tile Proxy Open Relaying and Unvalidated Parameters
* **Severity:** HIGH / SECURITY
* **Location:** [`backend/app/routes/map.py:56-92`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/routes/map.py#L56-L92)
* **Root Cause:**
  The tile proxy endpoint `/api/tiles/owm/{layer}/{z}/{x}/{y}.png` forwards requests directly to OpenWeatherMap using the server's secret `OPENWEATHER_API_KEY`. However:
  1. Zoom level (`z`), tile coordinates (`x`, `y`) are not validated against logical bounds (e.g., negative numbers or zoom > 19).
  2. No rate-limiting or user authentication is enforced on tile requests.
  3. `Response` headers explicitly add `"Access-Control-Allow-Origin": "*"` with public caching headers.
* **Impact:** Allows malicious external actors to exhaust the application's OpenWeatherMap API key quota by scripting arbitrary tile requests through the backend proxy.

---

### [CRITICAL-03] Broken OpenWeatherMap Image Icon URL Resolution in Frontend
* **Severity:** HIGH / UI BREAKAGE
* **Location:** [`src/features/home/WeatherHero.tsx:91`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/src/features/home/WeatherHero.tsx#L91)
* **Root Cause:**
  `WeatherHero.tsx` renders current weather icons using OpenWeatherMap's icon CDN URL:
  ```tsx
  src={`https://openweathermap.org/img/wn/${current?.icon || '01d'}@2x.png`}
  ```
  However, `weather_hub.py` (lines 44-78) decodes weather codes into internal string tokens such as `"sun"`, `"partly-cloudy"`, `"cloudy"`, `"fog"`, `"rain"`, `"snow"`, `"thunderstorm"`. When `current.icon` is `"partly-cloudy"`, the URL becomes `https://openweathermap.org/img/wn/partly-cloudy@2x.png`, which returns an HTTP 404 error from OpenWeatherMap CDN.
* **Impact:** Primary weather condition icons on the main dashboard Hero card fail to load and render as broken image icons.

---

### [CRITICAL-04] Hardcoded Stale Railway Production Backend URL in `vercel.json`
* **Severity:** HIGH / DEPLOYMENT
* **Location:** [`vercel.json:5-9`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/vercel.json#L5-L9)
* **Root Cause:**
  `vercel.json` configures API and WebSocket rewrites to a hardcoded external URL:
  ```json
  "destination": "https://backend-production-24f0.up.railway.app/api/:path*"
  ```
* **Impact:** Any frontend deployment on Vercel bypasses local/container environment variables and attempts to route API and WebSocket traffic to a non-existent or stale Railway instance.

---

### [CRITICAL-05] Socket Hijacking and Unhandled Exception in Port Checker (`main.py`)
* **Severity:** HIGH / STABILITY
* **Location:** [`backend/main.py:38-76`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/main.py#L38-L76)
* **Root Cause:**
  `ensure_single_instance()` attempts to bind a socket to port 8000 on startup to detect running instances. On Windows, socket bind without `SO_REUSEADDR` or abrupt process killing causes socket TIME_WAIT state, preventing uvicorn from binding to 8000 immediately afterward and raising `OSError: [WinError 10048]`.
* **Impact:** Backend server fails to start or crashes in dev environments when restarted quickly.
