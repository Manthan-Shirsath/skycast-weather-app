import React, { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { fetchCityWeather, fetchAlerts } from '../services/weatherApi';
import {
  Plus,
  Trash2,
  MapPin,
  Search,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Wind,
  Thermometer,
  CloudRain,
  ExternalLink,
  RefreshCw,
  Compass
} from 'lucide-react';
import { WeatherIconRenderer } from '../components/WeatherIcons';

export function LocationsPage() {
  const {
    savedLocations,
    addSavedLocation,
    removeSavedLocation,
    formatTemp,
    formatWind,
    loadCityWeather
  } = useWeather();

  const navigate = useNavigate();

  const [locationsData, setLocationsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState(null);
  const searchInputId = useId();

  // Load weather and risk data for all saved locations
  const loadAllSavedLocations = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const results = await Promise.all(
        savedLocations.map(async (locName) => {
          const cityQuery = typeof locName === 'string' ? locName : locName.city;
          try {
            const data = await fetchCityWeather(cityQuery);
            
            // Extract highest risk alert from data
            const alertsList = data.alerts || [];
            const activeRisks = alertsList.filter((a) => a.hazard !== 'none' && a.riskLevel !== 'green');
            const highestRisk = activeRisks.length > 0 ? activeRisks[0] : (alertsList[0] || null);

            return {
              city: data.city || cityQuery,
              displayLocation: data.displayLocation || (data.region ? `${data.city}, ${data.region}` : data.city),
              country: data.country || 'India',
              tempC: data.tempC,
              feelsLikeC: data.feelsLikeC ?? data.tempC,
              condition: data.condition || 'Clear',
              humidity: data.humidity ?? 60,
              windSpeedKmh: data.windSpeedKmh ?? 10,
              rainChance: data.rainChance ?? data.daily?.[0]?.precipitationProbability ?? 0,
              icon: data.hourly?.[0]?.icon || 'partly-cloudy',
              updatedAt: data.updatedAt || new Date().toISOString(),
              highestRisk,
              hasActiveRisk: activeRisks.length > 0,
              activeRiskCount: activeRisks.length,
              stale: !!data.stale,
              raw: data
            };
          } catch (err) {
            console.warn(`Failed to fetch weather for saved location "${cityQuery}":`, err.message);
            return {
              city: cityQuery,
              displayLocation: cityQuery,
              country: 'Unknown',
              tempC: null,
              feelsLikeC: null,
              condition: 'Unavailable',
              humidity: null,
              windSpeedKmh: null,
              rainChance: null,
              icon: 'cloud-sun',
              updatedAt: null,
              highestRisk: null,
              hasActiveRisk: false,
              activeRiskCount: 0,
              error: 'Weather data unavailable',
              stale: true
            };
          }
        })
      );

      setLocationsData(results);
    } catch (err) {
      console.error('Error loading saved locations:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [savedLocations]);

  // Initial load
  useEffect(() => {
    loadAllSavedLocations();
  }, [loadAllSavedLocations]);

  // Centralized WebSocket real-time listener for updates
  useEffect(() => {
    let ws = null;
    try {
      ws = new WebSocket('ws://127.0.0.1:8000/ws/weather');
      
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'weather_update' && payload.city && payload.data) {
            const updatedCity = payload.city.toLowerCase();
            setLocationsData((prev) =>
              prev.map((item) => {
                if (item.city.toLowerCase() === updatedCity) {
                  const data = payload.data;
                  const alertsList = data.alerts || [];
                  const activeRisks = alertsList.filter((a) => a.hazard !== 'none' && a.riskLevel !== 'green');
                  const highestRisk = activeRisks.length > 0 ? activeRisks[0] : (alertsList[0] || null);

                  return {
                    ...item,
                    tempC: data.tempC,
                    feelsLikeC: data.feelsLikeC ?? data.tempC,
                    condition: data.condition || item.condition,
                    humidity: data.humidity ?? item.humidity,
                    windSpeedKmh: data.windSpeedKmh ?? item.windSpeedKmh,
                    rainChance: data.rainChance ?? item.rainChance,
                    icon: data.hourly?.[0]?.icon || item.icon,
                    updatedAt: data.updatedAt || new Date().toISOString(),
                    highestRisk,
                    hasActiveRisk: activeRisks.length > 0,
                    activeRiskCount: activeRisks.length,
                    stale: false
                  };
                }
                return item;
              })
            );
          }
        } catch {
          // ignore parsing error
        }
      };
    } catch {
      // ignore connection error
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Search and Add Location
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const clean = searchInput.trim();
    if (!clean) return;

    // Check if already in saved locations
    const alreadySaved = savedLocations.some(
      (loc) => (typeof loc === 'string' ? loc : loc.city).toLowerCase() === clean.toLowerCase()
    );
    if (alreadySaved) {
      setSearchError(`"${clean}" is already in your saved locations.`);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      // Validate with centralized backend
      const verified = await fetchCityWeather(clean);
      addSavedLocation(verified.city);
      setSearchInput('');
      setSearchSuccess(`Added "${verified.city}" to saved locations!`);
      setTimeout(() => setSearchSuccess(null), 3000);
    } catch (err) {
      setSearchError(err.message || `Location "${clean}" not found.`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickAdd = async (cityName) => {
    setSearchInput(cityName);
    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);
    try {
      const verified = await fetchCityWeather(cityName);
      addSavedLocation(verified.city);
      setSearchInput('');
      setSearchSuccess(`Added "${verified.city}"!`);
      setTimeout(() => setSearchSuccess(null), 3000);
    } catch (err) {
      setSearchError(err.message || `Could not add "${cityName}".`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = (e, cityName) => {
    e.stopPropagation();
    removeSavedLocation(cityName);
  };

  const handleNavigateDetails = (cityName) => {
    loadCityWeather(cityName);
    navigate(`/details?city=${encodeURIComponent(cityName)}`);
  };

  const handleNavigateMap = (cityName) => {
    navigate(`/map?city=${encodeURIComponent(cityName)}`);
  };

  const handleNavigateAlerts = (cityName) => {
    navigate(`/alerts?city=${encodeURIComponent(cityName)}`);
  };

  const getRiskColor = (alert) => {
    if (!alert) return 'green';
    return (alert.skycastRiskColour || alert.riskColour || alert.riskLevel || 'green').toLowerCase();
  };

  return (
    <div className="locations-page-container">
      {/* Top Header Row */}
      <div className="locations-page-header">
        <div>
          <div className="locations-badge-top">
            <Compass size={15} />
            <span>Saved Places Manager</span>
          </div>
          <h2 className="locations-heading">Locations</h2>
          <span className="locations-subheading">Your saved places & live risk monitors</span>
        </div>

        <div className="locations-header-actions">
          <button
            type="button"
            className="locations-refresh-btn"
            onClick={() => loadAllSavedLocations(true)}
            disabled={isRefreshing || isLoading}
            title="Refresh all saved places"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Search & Add City Bar */}
      <div className="locations-search-section">
        <form onSubmit={handleSearchSubmit} className="locations-search-form">
          <div className="locations-search-input-wrap">
            <Search size={18} className="locations-search-icon" />
            <label htmlFor={searchInputId} className="sr-only">Search for a city</label>
            <input
              id={searchInputId}
              type="text"
              className="locations-search-input"
              placeholder="Search for a city to add (e.g. Mumbai, Tokyo, London, Leh)..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (searchError) setSearchError(null);
              }}
            />
            {searchInput && (
              <button
                type="button"
                className="locations-search-clear-btn"
                onClick={() => setSearchInput('')}
                aria-label="Clear search input"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="locations-add-btn"
            disabled={!searchInput.trim() || isSearching}
          >
            {isSearching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Validating...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Add Place</span>
              </>
            )}
          </button>
        </form>

        {/* Search Feedback Messages */}
        {searchError && (
          <div className="locations-msg-banner error">
            <AlertCircle size={15} />
            <span>{searchError}</span>
          </div>
        )}

        {searchSuccess && (
          <div className="locations-msg-banner success">
            <CheckCircle2 size={15} />
            <span>{searchSuccess}</span>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="locations-suggestions-row">
          <span className="locations-suggestions-label">Popular places:</span>
          {['Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'Srinagar', 'Leh', 'Goa'].map((cityChip) => {
            const isAlreadySaved = savedLocations.some(
              (loc) => (typeof loc === 'string' ? loc : loc.city).toLowerCase() === cityChip.toLowerCase()
            );
            return (
              <button
                key={cityChip}
                type="button"
                className={`locations-chip ${isAlreadySaved ? 'saved' : ''}`}
                onClick={() => !isAlreadySaved && handleQuickAdd(cityChip)}
                disabled={isAlreadySaved || isSearching}
                title={isAlreadySaved ? 'Already saved' : `Add ${cityChip}`}
              >
                {isAlreadySaved ? '✓ ' : '+ '}
                {cityChip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Locations Grid */}
      {isLoading ? (
        <div className="locations-loading-state">
          <Loader2 size={36} className="animate-spin text-blue-500" />
          <span>Fetching weather & risk assessments for your saved places...</span>
        </div>
      ) : locationsData.length === 0 ? (
        <div className="locations-empty-state">
          <div className="locations-empty-icon">
            <MapPin size={48} className="text-slate-500" />
          </div>
          <h3>No saved locations yet</h3>
          <p>Search for any city in India or worldwide above to add it to your live monitoring dashboard.</p>
        </div>
      ) : (
        <div className="locations-cards-grid">
          {locationsData.map((loc) => {
            const riskColor = getRiskColor(loc.highestRisk);
            const isNormal = !loc.hasActiveRisk;

            return (
              <div
                key={loc.city}
                className={`location-card-item ${loc.hasActiveRisk ? `risk-${riskColor}` : ''}`}
                onClick={() => handleNavigateDetails(loc.city)}
                title={`Click to view in-depth weather for ${loc.city}`}
              >
                {/* Card Header: Location Name, Region & Delete */}
                <div className="location-card-header">
                  <div className="location-card-title-group">
                    <h3 className="location-card-city">{loc.city}</h3>
                    <span className="location-card-region">{loc.displayLocation}</span>
                  </div>

                  <button
                    type="button"
                    className="location-card-delete-btn"
                    onClick={(e) => handleDelete(e, loc.city)}
                    title={`Remove ${loc.city} from saved places`}
                    aria-label={`Remove ${loc.city}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Main Temperature & Condition Strip */}
                <div className="location-card-main-temp">
                  <div className="location-card-temp-left">
                    <span className="location-card-temp">
                      {loc.tempC !== null ? formatTemp(loc.tempC) : '--°'}
                    </span>
                    <span className="location-card-cond">{loc.condition}</span>
                    {loc.feelsLikeC !== null && (
                      <span className="location-card-feels">
                        Feels like {formatTemp(loc.feelsLikeC)}
                      </span>
                    )}
                  </div>

                  <div className="location-card-icon-wrap">
                    <WeatherIconRenderer name={loc.icon} size={48} />
                  </div>
                </div>

                {/* Metrics Stats Row */}
                <div className="location-card-metrics-row">
                  <div className="location-metric-pill" title="Humidity">
                    <Droplets size={13} className="text-blue-400" />
                    <span>{loc.humidity !== null ? `${loc.humidity}%` : '--'}</span>
                  </div>

                  <div className="location-metric-pill" title="Wind speed">
                    <Wind size={13} className="text-teal-400" />
                    <span>{loc.windSpeedKmh !== null ? formatWind(loc.windSpeedKmh) : '--'}</span>
                  </div>

                  <div className="location-metric-pill" title="Rain probability">
                    <CloudRain size={13} className="text-indigo-400" />
                    <span>{loc.rainChance !== null ? `${loc.rainChance}%` : '0%'}</span>
                  </div>
                </div>

                {/* Skycast Weather Risk Banner (Clickable -> /alerts) */}
                <div
                  className={`location-card-risk-badge ${riskColor}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigateAlerts(loc.city);
                  }}
                  title="Click to inspect Skycast IMD risk evaluation"
                >
                  <div className="location-risk-badge-header">
                    <div className="location-risk-badge-title">
                      {isNormal ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <AlertTriangle size={14} />
                      )}
                      <span>
                        {isNormal
                          ? '🟢 Skycast Weather Risk: Normal'
                          : `⚡ Skycast Weather Risk: ${riskColor.toUpperCase()}`}
                      </span>
                    </div>

                    <span className="location-risk-view-link">
                      Details →
                    </span>
                  </div>

                  <p className="location-risk-badge-desc">
                    {isNormal
                      ? 'No active weather hazards detected (Based on published IMD criteria).'
                      : (loc.highestRisk?.hazardClassification?.replace(/_/g, ' ').toUpperCase() || loc.highestRisk?.title || 'Active hazard advisory')}
                  </p>
                </div>

                {/* Footer Action Buttons */}
                <div className="location-card-footer">
                  <button
                    type="button"
                    className="location-card-action-btn primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigateDetails(loc.city);
                    }}
                  >
                    <span>View Weather</span>
                    <ExternalLink size={13} />
                  </button>

                  <button
                    type="button"
                    className="location-card-action-btn secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigateMap(loc.city);
                    }}
                  >
                    <MapPin size={13} />
                    <span>Map</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
