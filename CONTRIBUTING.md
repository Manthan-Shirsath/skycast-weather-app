# Contributing to SkyCast

Thank you for your interest in contributing to **SkyCast**! Whether you are fixing bugs, adding new weather intelligence modules, enhancing the UI, or improving documentation, your help is warmly welcomed.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Project Structure](#project-structure)
5. [Backend Development](#backend-development)
6. [Frontend Development](#frontend-development)
7. [Submitting a Pull Request](#submitting-a-pull-request)
8. [Reporting Issues](#reporting-issues)

---

## 🤝 Code of Conduct

Please be respectful, collaborative, and constructive when communicating and reviewing code across discussions, issues, and pull requests.

---

## 🚀 Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork locally**:
   ```bash
   git clone https://github.com/<your-username>/skycast-weather-app.git
   cd skycast-weather-app
   ```
3. **Set up upstream remote**:
   ```bash
   git remote add upstream https://github.com/Manthan-Shirsath/skycast-weather-app.git
   ```

---

## 🛠️ Development Workflow

### Prerequisites
- **Node.js** (v18 or newer)
- **Python** (v3.10 or newer)
- *(Optional)* **PostgreSQL** & **Redis** (the app includes in-memory / mock fallbacks for quick testing)

### Setup Environment
1. **Frontend dependencies**:
   ```bash
   npm install
   ```
2. **Backend dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. **Configure Environment Variables**:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Open `backend/.env` and add your Gemini API key (from [Google AI Studio](https://aistudio.google.com/)).

### Running the App
Run both frontend and backend concurrently with a single command:
```bash
npm run dev
```
- **React Frontend**: `http://localhost:5173`
- **FastAPI Backend**: `http://localhost:8000`
- **FastAPI Swagger Docs**: `http://localhost:8000/docs`

---

## 🏗️ Project Structure

```
skycast-weather-app/
├── backend/
│   ├── alembic/              # Database schema migrations
│   ├── app/
│   │   ├── core/             # Config, Cache (Redis), DB connection, WebSockets
│   │   ├── models/           # SQLAlchemy & Pydantic domain models
│   │   ├── routes/           # FastAPI routers (weather, map, chat, alerts, trends, etc.)
│   │   └── services/         # WeatherHub, WeatherGPT Agent, History, Providers
│   ├── main.py               # FastAPI entry point
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variables template
├── src/
│   ├── components/           # Reusable React UI components
│   ├── pages/                # Main application views (Weather, Radar, WeatherGPT, etc.)
│   ├── services/             # Frontend API clients & WebSocket managers
│   ├── App.jsx               # Main React Application
│   └── main.jsx              # React DOM entry point
├── package.json
├── vite.config.js
└── README.md
```

---

## 🧪 Testing

### Backend Tests
Run the test suite using `pytest`:
```bash
pytest backend/tests/
```

### Frontend Linting
Run oxlint:
```bash
npm run lint
```

---

## 📬 Submitting a Pull Request

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-new-feature
   ```
2. **Commit your changes**:
   ```bash
   git commit -m "feat(agent): add multi-city comparative weather tool"
   ```
3. **Push to your fork**:
   ```bash
   git push origin feature/amazing-new-feature
   ```
4. **Open a Pull Request** against the `main` branch with a clear description of the problem solved, changes made, and screenshots/recordings if UI was changed.

---

## 🐛 Reporting Issues

If you find a bug or have a feature suggestion, please open an issue in the repository with:
- A clear, descriptive title.
- Steps to reproduce the bug.
- Expected vs. actual behavior.
- Environment details (OS, Python version, Browser).
