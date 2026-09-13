# SkyCast Codebase Audit & Migration Guide

## 1. Understand the Entire Application
SkyCast is a highly complex, multi-agent meteorological intelligence platform. It consists of a decoupled architecture with a React-based frontend and a Python-based FastAPI backend, utilizing robust caching and background ingestion patterns.

### Architecture Overview
- **Frontend Framework**: React 19 + Vite + TypeScript. Uses `@heroui/react`, `framer-motion`, `maplibre-gl`, and `recharts` for highly interactive visual layers.
- **Backend Framework**: FastAPI (Python) serving REST APIs and WebSockets.
- **Database**: PostgreSQL (via asyncpg and SQLAlchemy) used for canonical weather history, forecast snapshots, user subscriptions, and chat sessions.
- **Cache**: Redis, heavily used for sub-millisecond responses, deductive caching, and pub/sub message brokering.
- **AI/LLM Providers**: Multi-provider fallback system natively supporting Groq, Sarvam, and OpenAI via `key_rotator.py`.
- **Weather Data**: Open-Meteo (primary), Google Weather/RainViewer (implied/radar).
- **Background Workers**: `collector_worker` and `forecast_ingestion_worker` run continuous loops inside the FastAPI process to fetch, normalize, and cache data independent of user requests.
- **WebSockets**: `/ws` endpoints for real-time monitoring, alert changes, and chat streaming.
- **Deployment**: `docker-compose.yml` defining `backend`, `frontend`, `postgres`, and `redis`.

**High-Level Flow**: A user interacts with the UI (e.g., WeatherGPT). The React frontend hits the FastAPI `/api/chat` route. The `AgentRegistry` dynamically routes the query to a specialized agent (Agriculture, Aviation, General) via `executor.py`. The agent requests weather data through tools (`tools.py`). Tools interact with `weather_hub.py`, which pulls from Redis (if cached) or Open-Meteo (if stale). The LLM processes the data and streams structured JSON back to the client via HTTP/SSE or WebSockets.

---

## 2. Complete Feature Inventory
- WeatherGPT / Conversational Weather (Fully Implemented)
- Multi-Agent Routing (Agriculture, Aviation, Marine, Urban, Disaster) (Fully Implemented)
- AI Tool Calling (search_location, get_current_weather, get_forecast) (Fully Implemented)
- Multi-Model LLM Rotation (Groq, Sarvam) (Fully Implemented)
- Real-time Current Weather & Forecasts (Fully Implemented)
- MapLibre Radar & Overlays (Partially Implemented/UI scaffolding)
- IMD Extreme Weather Alerts & Warning Framework (Fully Implemented)
- Alert Change Visualization / Timeline (Fully Implemented)
- Disaster Risk Assessment (Fully Implemented)
- Agriculture Decision Intelligence (Fully Implemented)
- Aviation/METAR & Marine functionality (Partially Implemented/Placeholder endpoints)
- Weather Trends & Analytics (Fully Implemented)
- WebSocket Monitoring Subscriptions (Fully Implemented)
- Multilingual / i18n support (Fully Implemented via `i18n.ts`)
- Historical Weather Snapshots (Fully Implemented via PostgreSQL)

---

## 3. Feature Documentation

### WeatherGPT & Agent Routing
**Status**: Fully implemented.
**User Experience**: Users chat with an AI that automatically routes their query to a domain expert (e.g., Farmer vs Pilot) and visualizes the response using generative UI widgets (Decision Hero).
**Frontend**: `src/features/weathergpt/WeatherGPTPage.tsx`, `src/components/weather/DecisionHero.tsx`.
**Backend**: `chat.py`, `agent/executor.py`, `agent/registry.py`, `agent/tools.py`.
**AI**: Uses Groq (Llama-3-70b/Mixtral) or Sarvam. System dynamically injects `tools.py` schemas into the prompt.
**Data**: Conversational history persisted in PostgreSQL (`models/chat.py`).

### IMD Warning Framework & Alerts
**Status**: Fully implemented.
**User Experience**: Users see color-coded (Yellow/Orange/Red) alerts based on IMD guidelines for rainfall, heatwaves, and cyclones.
**Backend**: `services/alert_engine.py`, `services/alert_service.py`, `core/imd_rules_config.py`.
**Data**: Deduplicated and evaluated in Redis, persisted to PostgreSQL.

### Background Polling & Ingestion
**Status**: Fully implemented.
**Backend**: `services/collector.py`, `services/forecast_ingestion.py`. Runs continuous `asyncio` loops to pre-fetch data for registered locations.

---

## 4. End-to-End Flows

### WeatherGPT Flow
1. User types "Can I spray pesticide in Nashik?"
2. React frontend POSTs to `backend/app/routes/chat.py`.
3. `chat.py` instantiates `multi_agent.py`.
4. Agent Registry identifies keyword "spray" -> routes to `AGRICULTURE` agent.
5. Agent executes `search_location_tool` -> returns (20°N, 73°E).
6. Agent executes `get_agriculture_tool` -> `weather_hub.py` fetches Open-Meteo soil/wind data.
7. Agent generates structured JSON safety recommendation.
8. Frontend renders `DecisionHero` widget with safety gauge.

---

## 5. Identify All AI Agents and Tools
**Agents** (`registry.py`):
- `GENERAL`: Basic weather and radar.
- `AGRICULTURE`: Crop stress, soil moisture, spraying safety.
- `AVIATION`: Turbulence, wind shear, icing.
- `MARINE`: Swell, wave height, sea temperature.
- `DISASTER`: IMD alerts, evacuation tracking.

**Core Tools** (`tools.py`):
- `search_location`: Geocodes strings.
- `get_current_weather`: Fetches live metrics.
- `get_forecast`: Up to 14 days of data.
- `assess_risk`: Evaluates parameters against safety thresholds.
- `get_agriculture_data`: Fetches soil/evapotranspiration.
- `get_aviation_data`: Fetches cloud base, visibility, wind shear.

---

## 6. External Services
| Service | Purpose | Used By | Authentication | Status |
| ------- | ------- | ------- | -------------- | -------------- |
| **Open-Meteo** | Primary weather / historical / marine API | `providers/open_meteo.py` | None (Open Source) | Fully Supported |
| **Groq** | Ultra-fast LLM inference for WeatherGPT | `key_rotator.py`, `executor.py` | API Key (`GROQ_API_KEY`) | Fully Supported |
| **Sarvam AI** | Regional/Indic language LLM fallback | `key_rotator.py` | API Key (`SARVAM_API_KEY`) | Fully Supported |

---

## 7. Environment Variables
- `LLM_PROVIDER`: Switch between `groq`, `sarvam`, `openai`.
- `GROQ_API_KEY`, `GROQ_API_KEY_FALLBACK`: Authentication for AI.
- `SARVAM_API_KEY`: Authentication for Indic AI.
- `DATABASE_URL`: PostgreSQL connection string (`postgresql+asyncpg://...`).
- `REDIS_URL`: Redis connection string (`redis://redis:6379/0`).
- `COLLECTOR_POLL_INTERVAL`: Configures background worker frequency.
- `ENABLE_BACKGROUND_POLLING`: Toggles async background processes.

---

## 8. Database and Cache Audit
**Database (PostgreSQL via Alembic)**
- `CanonicalWeather`: Historical snapshot of weather at an exact hour.
- `ForecastSnapshot`: Point-in-time prediction vs reality comparisons.
- `ChatSession` / `ChatMessage`: WeatherGPT history.
- `UserSubscription`: Push notification / WebSocket alert registry.

**Cache (Redis)**
- Keys: `weather:current:{lat}:{lon}`, `forecast:{lat}:{lon}`, `alerts:imd:{state}`.
- Relies heavily on TTL expiration to keep data fresh without querying external APIs.

---

## 9. Serverless Migration Risks (CRITICAL)

Moving from Docker/FastAPI to Next.js + Vercel involves significant architectural shifts:

1. **Background Workers (`collector.py`, `forecast_ingestion.py`)**
   - *Current*: Persistent `asyncio` loops running inside FastAPI.
   - *Problem*: Vercel Serverless Functions sleep when idle and have max execution times (10-60s). They cannot run loops.
   - *Solution*: Migrate to Vercel Cron Jobs (`vercel.json`) invoking a specific `/api/cron/ingest` Next.js route on a schedule, or use Upstash QStash.

2. **WebSockets (`core/websocket.py`)**
   - *Current*: Persistent TCP connections holding state in FastAPI memory.
   - *Problem*: Vercel serverless functions do not support long-lived WebSockets.
   - *Solution*: Migrate to Server-Sent Events (SSE) (natively supported via Next.js streaming) or offload to Supabase Realtime / Pusher.

3. **In-Memory Rate Limiting & Connections**
   - *Current*: FastAPI uses global variables and persistent Postgres connection pools (`asyncpg`).
   - *Problem*: Vercel Edge/Serverless spins up thousands of ephemeral instances, which will exhaust standard Postgres connections instantly.
   - *Solution*: MUST use Supabase Transaction Pooler (PgBouncer) or Prisma Accelerate for database connections. Use Upstash Redis for stateless rate-limiting.

4. **Python AI Ecosystem vs TS AI Ecosystem**
   - *Current*: Custom Python `executor.py` managing tool loops.
   - *Problem*: Rewriting the agent loop in TypeScript from scratch is error-prone.
   - *Solution*: Use the Vercel AI SDK (`ai` and `@ai-sdk/openai`), which natively handles tool streaming, max steps, and generative UI in Next.js.

---

## 10. Remove/Simplify Candidates
- `setup_postgres_wsl.sh` / `configure_postgres_wsl.sh`: Dead code/redundant script files. Next.js migration will use managed Supabase anyway.
- The custom `key_rotator.py` logic: Vercel AI SDK handles provider fallbacks and load balancing natively using the `fallback()` function.

---

## 11. Final Feature Matrix

| Feature | Status | Frontend | Backend | AI | DB | Redis | External APIs | Migration Complexity |
| ------- | ------ | -------- | ------- | -- | -- | ----- | ------------- | -------------------- |
| WeatherGPT | Fully Implemented | `WeatherGPTPage.tsx` | `chat.py`, `executor.py` | Groq/Sarvam | `chat.py` | No | Groq API | **High** |
| IMD Alerts | Fully Implemented | `AlertChangeViz.tsx` | `alert_engine.py` | No | `forecast.py` | Yes | Open-Meteo | **Medium** |
| Background Polling | Fully Implemented | N/A | `collector.py` | No | Yes | Yes | Open-Meteo | **Very High** |
| Live Map/Radar | Partially Impl. | `map` features | `map.py` | No | No | Yes | RainViewer | **Low** |
| WebSockets | Fully Implemented | React Hooks | `ws.py` | No | No | Yes | None | **Very High** |

---

## 12. Information Required by the Next.js Architecture Agent

1. **Architecture Blueprint**: The new app MUST use Next.js App Router. Background tasks MUST be converted to Vercel Cron. WebSockets MUST be converted to SSE or Supabase Realtime.
2. **Database Translation**: The Postgres `asyncpg` models need to be rewritten in Prisma or Drizzle ORM to interface with Supabase.
3. **Agent Loop**: The complex `registry.py` and `tools.py` logic needs to be rewritten using Vercel AI SDK's `tool()` function schema, maintaining the strict return types required for the generative UI components like `DecisionHero`.
4. **Tool Definitions**: Preserve the exact JSON signature of tools in `tools.py` as they map directly to React visual components.
