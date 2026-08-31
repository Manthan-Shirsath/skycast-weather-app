# 🌤️ SkyCast - Next-Gen Weather Intelligence Platform

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Vite](https://img.shields.io/badge/Vite-8.2+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**SkyCast** is a full-stack weather intelligence application combining real-time global meteorology, interactive Leaflet radar maps, autonomous AI weather reasoning via **WeatherGPT**, multi-tier IMD alert systems, and historical trend analytics.

---

## 🌟 Key Features

- 🛰️ **Live Weather & Geocoding**: Real-time current conditions, hourly forecasts, 7-day outlooks, UV index, air quality metrics, and global city search powered by Open-Meteo.
- 🧠 **Forecast Intelligence (Methodology-Diverse)**: Compare traditional physics-based models (ECMWF IFS, GFS, ICON) against cutting-edge ML (ECMWF AIFS) and Generative AI ensembles (Google WeatherNext 2) side-by-side.
- 🤖 **WeatherGPT AI Agent**: Autonomous multi-turn AI weather assistant powered by Google Gemini with tool calling, weather retrieval, route-planning weather insights, and comparative analysis.
- 🗺️ **Interactive Radar & Satellite Map**: Live precipitation radar overlay using RainViewer with multi-layer controls, wind vectors, temperature heatmaps, and playback time-slider.
- ⚠️ **Multi-Tier Alert System**: IMD-aligned weather warning framework (Green, Yellow, Orange, Red) detecting severe storms, extreme temperatures, precipitation spikes, and gale-force winds.
- 🌾 **Agricultural & Lifestyle Advisory**: Tailored advisories for farming, outdoor sports, travel safety, and daily activity planning.
- 📊 **Historical Trends & Analytics**: Time-series analytics, historical weather snapshots, and climate trend comparisons backed by PostgreSQL and Redis caching.
- ⚡ **Real-time Live Sync**: WebSocket broadcasting for live parameter updates and active background collector polling.

---

## 🏗️ Architecture Overview

```text
weather-app/
├── backend/
│   ├── alembic/                # Database migrations (Alembic)
│   ├── app/
│   │   ├── core/               # App config, Redis cache, DB connections, WebSockets
│   │   ├── models/             # Canonical weather, Chat, and Snapshot schemas
│   │   ├── routes/             # REST endpoints (weather, map, chat, alerts, trends, etc.)
│   │   └── services/           # WeatherHub, WeatherGPT Agent, History Service, Collector
│   ├── main.py                 # FastAPI application & lifespan management
│   ├── requirements.txt        # Python backend dependencies
│   ├── .env.example            # Environment variables template
│   └── README.md               # Backend documentation
├── src/
│   ├── app/                    # Application routing (React Router) & Layouts
│   ├── components/             # Reusable UI widgets (shadcn/ui style), badges, charts
│   ├── features/               # Feature-based domains (forecast, map, weathergpt, etc.)
│   ├── lib/                    # Utility functions and API clients
│   ├── styles/                 # Global CSS (Tailwind)
│   ├── App.tsx                 # Application shell
│   └── main.tsx                # React 19 entry point
├── public/                     # Static assets & icons
├── docs/                       # Architecture & design documents
├── package.json                # Frontend dependencies & run scripts
├── vite.config.js              # Vite bundler configuration
├── CONTRIBUTING.md             # Contributor guidelines
└── LICENSE                     # MIT License
```

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/Manthan-Shirsath/skycast-weather-app.git
cd skycast-weather-app
```

### 2. Install Dependencies

#### Frontend (Node.js)
```bash
npm install
```

#### Backend (Python)
```bash
pip install -r backend/requirements.txt
```

### 3. Setup Environment Variables
Create your local environment file from the provided example:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your **Gemini API Key** (free from [Google AI Studio](https://aistudio.google.com/)):
```env
gemini_api_key=your_actual_gemini_api_key
```

*(Note: PostgreSQL and Redis are optional for core weather functionality. The app automatically falls back gracefully if they are not running locally).*

---

## 💻 Running Locally

### Option A: Run Full Stack (Recommended)
Start both FastAPI backend and React frontend concurrently with a single command:
```bash
npm run dev
```

### Option B: Run Separately
- **Start Backend:**
  ```bash
  npm run dev:backend
  # or: python backend/main.py
  ```
  Backend runs at: `http://127.0.0.1:8000`  
  Interactive Swagger API Docs: `http://127.0.0.1:8000/docs`

- **Start Frontend:**
  ```bash
  npm run dev:frontend
  # or: npm run dev
  ```
  Frontend runs at: `http://localhost:5173`

### Option C: Run with Docker (Containerized Stack)
Build and run the entire full stack (FastAPI Backend, React 19 Production Nginx Server, PostgreSQL, and Redis) with a single command:
```bash
docker compose up --build
```
- **React Frontend (Production Nginx)**: `http://localhost:5173` (or `http://localhost:80`)
- **FastAPI Backend**: `http://localhost:8000`
- **FastAPI Swagger Docs**: `http://localhost:8000/docs`
- **PostgreSQL Database**: `localhost:5432`
- **Redis Cache**: `localhost:6379`

To stop all services:
```bash
docker compose down
```

---

## 🧪 Testing & Linting

- **Run Python Backend Tests**:
  ```bash
  pytest backend/tests/
  ```
- **Run Frontend Linter**:
  ```bash
  npm run lint
  ```

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/CONTRIBUTING.md) for details on our code of conduct, development workflow, and pull request process.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](file:///c:/Users/Manthan/OneDrive/Desktop/New%20folder/weather-app/LICENSE) file for details.
