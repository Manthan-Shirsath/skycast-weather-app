import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { LanguageProvider } from './context/LanguageContext';
import { WeatherProvider, useWeather } from './context/WeatherContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardPage } from './pages/DashboardPage';
import { TrendsPage } from './pages/TrendsPage';
import { MapPage } from './pages/MapPage';
import { DetailsPage } from './pages/DetailsPage';
import { AlertsPage } from './pages/AlertsPage';
import { WeatherGPTPage } from './pages/WeatherGPTPage';
import { LocationsPage } from './pages/LocationsPage';
import { AgriculturePage } from './pages/AgriculturePage';
import { AlertCircle, X } from 'lucide-react';

function AppLayout() {
  const { isLoading, errorMessage, setErrorMessage } = useWeather();

  return (
    <div className={`app-dashboard-shell ${isLoading ? 'is-loading' : ''}`}>
      {/* 1. Fixed Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Main Dashboard Area */}
      <div className="app-main-viewport">
        {/* Top Bar Header */}
        <TopBar />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="error-banner">
            <div className="error-banner-content">
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              className="error-dismiss-btn"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Page Content Container */}
        <main className="app-page-content-area">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/trends" element={<TrendsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/details" element={<DetailsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/weathergpt" element={<WeatherGPTPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/agriculture" element={<AgriculturePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <WeatherProvider>
          <AppLayout />
        </WeatherProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
