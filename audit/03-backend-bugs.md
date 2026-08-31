# Backend & API Architecture Bugs Report

## Overview
This document details backend service bugs, database connection edge cases, caching issues, memory leaks, and concurrency flaws in the FastAPI service tree.

---

### [BACKEND-01] Memory Leak in `WeatherHub` In-Flight Lock Dictionary
* **Severity:** HIGH / MEMORY LEAK
* **Location:** [`backend/app/services/weather_hub.py:34-41`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/weather_hub.py#L34-L41)
* **Root Cause:**
  `_IN_FLIGHT_LOCKS` is a module-level dictionary storing `asyncio.Lock` instances keyed by cache key:
  ```python
  _IN_FLIGHT_LOCKS: Dict[str, asyncio.Lock] = {}
  _GLOBAL_LOCK = asyncio.Lock()

  async def _get_lock_for_key(key: str) -> asyncio.Lock:
      async with _GLOBAL_LOCK:
          if key not in _IN_FLIGHT_LOCKS:
              _IN_FLIGHT_LOCKS[key] = asyncio.Lock()
          return _IN_FLIGHT_LOCKS[key]
  ```
  Locks created for dynamic coordinate keys (e.g., `weather:point:18.52:73.85`, `weather:city:pune`) are added to `_IN_FLIGHT_LOCKS` and **never removed**.
* **Impact:** As users query various map locations and cities, `_IN_FLIGHT_LOCKS` grows monotonically without bound, leaking memory in long-running processes.

---

### [BACKEND-02] PostgreSQL Health Check Throttling Lockout
* **Severity:** HIGH / DATABASE
* **Location:** [`backend/app/core/database.py:43-69`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/core/database.py#L43-L69)
* **Root Cause:**
  `check_db_health` throttles reconnect attempts using a 30-second window (`_health_check_cooldown = 30.0`):
  ```python
  if not force and (now - _last_health_check_time < _health_check_cooldown):
      return False
  _last_health_check_time = now
  return await init_db()
  ```
  If `init_db()` fails (e.g. PostgreSQL is restarting), `_last_health_check_time` is updated to `now`. For the next 30 seconds, `check_db_health()` returns `False` instantly without retrying connection, even if PostgreSQL becomes ready 500ms later.
* **Impact:** Disables historical snapshot logging and trends API for up to 30 seconds after any transient database glitch.

---

### [BACKEND-03] Positional Index Mismatch in Open-Meteo Batch Ingestion
* **Severity:** MEDIUM / DATA CORRUPTION
* **Location:** [`backend/app/services/weather_hub.py:339-340`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/weather_hub.py#L339-L340)
* **Root Cause:**
  In `ingest_map_weather()`:
  ```python
  for i, meta in enumerate(KEY_MAP_CITIES):
      forecast = data_list[i] if i < len(data_list) else {}
  ```
  `open_meteo.py` issues a multi-coordinate batch request. Open-Meteo API documentation states that batch results are returned in array order, but if any coordinate parameter is malformed or missing data, array length or indexing can shift. Positional indexing `data_list[i]` assumes 1:1 positional alignment without checking returned latitude/longitude.
* **Impact:** Potential cross-contamination of weather metrics between cities (e.g. Pune receiving Mumbai's temperature).

---

### [BACKEND-04] Concurrent Mutation of Active WebSocket Connections List
* **Severity:** MEDIUM / CONCURRENCY
* **Location:** [`backend/app/core/websocket.py:36-44`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/core/websocket.py#L36-L44)
* **Root Cause:**
  In `broadcast()`:
  ```python
  dead_connections = []
  for connection in self.active_connections:
      try:
          await connection.send_json(message)
      except Exception:
          dead_connections.append(connection)

  for dead in dead_connections:
      self.disconnect(dead)
  ```
  Inside `disconnect(websocket)`, `self.active_connections.remove(websocket)` mutates `active_connections`. If another coroutine invokes `connect()` or `broadcast()` concurrently, iterating over `active_connections` throws `RuntimeError: dictionary/list changed size during iteration` or `ValueError: list.remove(x): x not in list`.
* **Impact:** Periodic WebSocket broadcast failures and unhandled server errors under multi-client loads.

---

### [BACKEND-05] Missing Exception Handling in Collector Background Cleanup Cycle
* **Severity:** LOW / RELIABILITY
* **Location:** [`backend/app/services/collector.py:113-116`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/collector.py#L113-L116)
* **Root Cause:**
  `HistoryService.cleanup_old_snapshots(retention_days=30)` executes at the end of every collection cycle. If the database is offline or session creation fails, `logger.debug` swallows the exception without tracking consecutive failures.
* **Impact:** Accumulation of stale database snapshots when retention cleanup fails silently.
