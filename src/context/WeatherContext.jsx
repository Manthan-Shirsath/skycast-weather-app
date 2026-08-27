import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCityWeather } from '../services/weatherApi';
import { CITIES_DATA } from '../data/weatherData';

const WeatherContext = createContext(null);

const DEFAULT_SAVED_CITIES = ['Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'Goa'];

export function WeatherProvider({ children }) {
  const [currentCity, setCurrentCity] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('city') || 'Pune';
  });

  const [weatherData, setWeatherData] = useState(CITIES_DATA['pune']);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Unit settings (persisted in localStorage)
  const [unit, setUnitState] = useState(() => {
    return localStorage.getItem('skycast_unit') || 'C';
  });

  const [windUnit, setWindUnitState] = useState(() => {
    return localStorage.getItem('skycast_wind_unit') || 'km/h';
  });

  const setUnit = (newUnit) => {
    setUnitState(newUnit);
    localStorage.setItem('skycast_unit', newUnit);
  };

  const setWindUnit = (newWindUnit) => {
    setWindUnitState(newWindUnit);
    localStorage.setItem('skycast_wind_unit', newWindUnit);
  };

  // Saved locations (persisted in localStorage)
  const [savedLocations, setSavedLocations] = useState(() => {
    try {
      const stored = localStorage.getItem('skycast_saved_locations');
      return stored ? JSON.parse(stored) : DEFAULT_SAVED_CITIES;
    } catch {
      return DEFAULT_SAVED_CITIES;
    }
  });

  const addSavedLocation = (cityName) => {
    const trimmed = cityName.trim();
    if (!trimmed) return;
    setSavedLocations((prev) => {
      if (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = [...prev, trimmed];
      localStorage.setItem('skycast_saved_locations', JSON.stringify(updated));
      return updated;
    });
  };

  const removeSavedLocation = (cityName) => {
    setSavedLocations((prev) => {
      const updated = prev.filter((c) => c.toLowerCase() !== cityName.toLowerCase());
      localStorage.setItem('skycast_saved_locations', JSON.stringify(updated));
      return updated;
    });
  };

  // Temperature formatting helper
  const formatTemp = useCallback((celsius) => {
    if (celsius === null || celsius === undefined || isNaN(celsius)) return '--°';
    if (unit === 'F') {
      const fahrenheit = Math.round((celsius * 9) / 5 + 32);
      return `${fahrenheit}°`;
    }
    return `${Math.round(celsius)}°`;
  }, [unit]);

  // Wind speed formatting helper
  const formatWind = useCallback((kmh) => {
    if (kmh === null || kmh === undefined || isNaN(kmh)) return '-- km/h';
    if (windUnit === 'mph') {
      const mph = Math.round(kmh * 0.621371);
      return `${mph} mph`;
    } else if (windUnit === 'm/s') {
      const ms = Math.round((kmh / 3.6) * 10) / 10;
      return `${ms} m/s`;
    }
    return `${Math.round(kmh)} km/h`;
  }, [windUnit]);

  // Fetch weather data for a city
  const loadCityWeather = useCallback(async (cityName, isManualRefresh = false) => {
    if (!cityName || !cityName.trim()) return;
    const targetCity = cityName.trim();
    
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await fetchCityWeather(targetCity);
      setWeatherData(data);
      setCurrentCity(data.city);
    } catch (err) {
      console.warn('Live API request failed, checking fallback:', err.message);
      const fallbackKey = targetCity.toLowerCase();
      if (CITIES_DATA[fallbackKey]) {
        setWeatherData(CITIES_DATA[fallbackKey]);
        setCurrentCity(CITIES_DATA[fallbackKey].city);
      } else {
        setErrorMessage(err.message || `Unable to load weather for "${targetCity}".`);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCityWeather(currentCity);
  }, [currentCity, loadCityWeather]);

  // Live WebSocket push subscription
  useEffect(() => {
    let ws = null;
    try {
      ws = new WebSocket('ws://127.0.0.1:8000/ws/weather');
      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'subscribe', city: currentCity }));
      };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'weather_update' && payload.city && payload.data) {
            if (payload.city.toLowerCase() === currentCity.toLowerCase()) {
              setWeatherData(payload.data);
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      };
    } catch (e) {
      // ignore
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [currentCity]);

  const value = {
    currentCity,
    setCurrentCity,
    weatherData,
    isLoading,
    isRefreshing,
    errorMessage,
    setErrorMessage,
    unit,
    setUnit,
    windUnit,
    setWindUnit,
    savedLocations,
    addSavedLocation,
    removeSavedLocation,
    formatTemp,
    formatWind,
    loadCityWeather,
  };

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
}
