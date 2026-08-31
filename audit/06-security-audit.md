# Security & Compliance Audit Report

## Overview
This document presents a comprehensive security audit of the SkyCast codebase covering authentication, authorization, CORS policy, secrets management, input validation, and container runtime settings.

---

### [SEC-01] Insecure Wildcard CORS Configuration Combined with Credentials
* **Severity:** HIGH / SECURITY
* **Location:** [`backend/main.py:95-102`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/main.py#L95-L102)
* **Root Cause:**
  CORS middleware is configured as follows:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
  Per CORS W3C standards and modern browser implementation, `allow_origins=["*"]` combined with `allow_credentials=True` is an invalid configuration. Web browsers automatically block credentialed cross-origin requests under wildcard origin policies. For uncredentialed requests, wildcard origin allows arbitrary third-party websites to make API calls to the backend and inspect response data.
* **Remediation:** Explicitly define an allowed origins list driven by environment configuration (e.g., `["http://localhost:5173", "https://skycast.app"]`).

---

### [SEC-02] Hardcoded Sensitive Provider Keys & Fallback API Secrets
* **Severity:** HIGH / CREDENTIAL EXPOSURE
* **Location:** [`backend/app/services/agent/agent.py:54-88`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/agent/agent.py#L54-L88) and [`docker-compose.yml:15-22`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/docker-compose.yml#L15-L22)
* **Root Cause:**
  Default API keys and base URLs are present in source files and environment variable fallbacks:
  ```python
  GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
  GROQ_MODEL = os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL") or "openai/gpt-oss-120b"
  ```
  If environment variables are missing, fallback logic attempts to use empty or default strings without raising explicit configuration exceptions on startup.
* **Remediation:** Fail fast during backend startup if required production secrets are missing.

---

### [SEC-03] Unsanitized Input Forwarding in Geocoding & City Search APIs
* **Severity:** MEDIUM / INJECTION
* **Location:** [`backend/app/services/providers/open_meteo.py:22`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/services/providers/open_meteo.py#L22)
* **Root Cause:**
  `geocode_city()` constructs query string using direct string interpolation:
  ```python
  url = f"{GEOCODING_API_URL}?name={city_name}&count=1&language=en&format=json"
  ```
  If `city_name` contains special URL characters (e.g. `&`, `?`, `#`, or non-ASCII characters), the URL query structure is corrupted, causing Open-Meteo HTTP 400 errors.
* **Remediation:** Use `httpx` params dictionary or `urllib.parse.quote()` to properly sanitize all outgoing query parameters.

---

### [SEC-04] Lack of Rate Limiting on Heavy Analytics & Map Endpoints
* **Severity:** MEDIUM / DOS
* **Location:** [`backend/app/routes/trends.py:8-33`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/routes/trends.py#L8-L33) and [`backend/app/routes/climate.py:8-64`](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/backend/app/routes/climate.py#L8-L64)
* **Root Cause:**
  Public REST endpoints `/api/trends` and `/api/climate/*` perform complex PostgreSQL aggregation queries over `WeatherSnapshot` tables without enforcing per-IP rate limiting or request throttling.
* **Remediation:** Implement rate-limiting middleware (e.g., `slowapi`) on heavy analytical endpoints.
