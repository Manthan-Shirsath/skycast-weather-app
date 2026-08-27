import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin,
  Search,
  Settings,
  RotateCw,
  Loader2,
  ChevronDown,
  Bell,
  Sun,
  Moon
} from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import { LocationPopover } from './LocationPopover';
import { SettingsModal } from './SettingsModal';
import { NotificationsModal } from './NotificationsModal';

export function TopBar() {
  const {
    currentCity,
    weatherData,
    unit,
    setUnit,
    isLoading,
    isRefreshing,
    loadCityWeather
  } = useWeather();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const searchRef = useRef(null);

  const popularCities = [
    'Pune',
    'Mumbai',
    'New Delhi',
    'Bengaluru',
    'London',
    'New York',
    'Tokyo',
    'Paris',
    'Dubai',
    'Sydney'
  ];

  const filteredSuggestions = popularCities.filter((c) =>
    c.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const clean = searchQuery.trim();
    if (clean) {
      loadCityWeather(clean);
      const targetPath = location.pathname || '/';
      navigate(`${targetPath}?city=${encodeURIComponent(clean)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSuggestionClick = (cityName) => {
    loadCityWeather(cityName);
    const targetPath = location.pathname || '/';
    navigate(`${targetPath}?city=${encodeURIComponent(cityName)}`);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const displayLocation = weatherData?.displayLocation || currentCity || 'Pune, Maharashtra';
  const hasWarning =
    weatherData?.alerts &&
    weatherData.alerts.length > 0 &&
    weatherData.alerts[0].severity === 'warning';

  return (
    <header className="app-topbar-container" aria-label="Top dashboard controls">
      {/* 1. Location Selector Badge */}
      <div
        className="topbar-location-badge"
        onClick={() => setIsLocationPopoverOpen(true)}
        title="Click to switch location"
        tabIndex={0}
        role="button"
        onKeyDown={(e) => e.key === 'Enter' && setIsLocationPopoverOpen(true)}
      >
        <span className="topbar-location-pin">
          <MapPin size={15} fill="#EF4444" stroke="#EF4444" />
        </span>
        <span className="topbar-location-text">{displayLocation}</span>
        <ChevronDown size={14} className="topbar-location-arrow" />
      </div>

      {/* 2. City / Location Search Input */}
      <div className="topbar-search-wrapper" ref={searchRef}>
        <form onSubmit={handleSearchSubmit} className="topbar-search-form">
          <input
            type="text"
            className="topbar-search-input"
            placeholder="Search city or location..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            aria-label="Search city or location"
          />
          <button
            type="submit"
            className="topbar-search-btn"
            aria-label="Submit search"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Search size={15} strokeWidth={2.2} />
            )}
          </button>
        </form>

        {/* Autocomplete Dropdown */}
        {isSearchOpen && (
          <div className="topbar-search-dropdown">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map((cityName) => (
                <div
                  key={cityName}
                  className="topbar-search-item"
                  onClick={() => handleSuggestionClick(cityName)}
                >
                  <span className="search-item-city">{cityName}</span>
                  <span className="search-item-hint">Live Forecast</span>
                </div>
              ))
            ) : (
              <div className="topbar-search-item" onClick={() => handleSearchSubmit()}>
                <span>
                  Search for "<strong>{searchQuery}</strong>"
                </span>
                <span className="search-item-hint">Press Enter</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Action Controls */}
      <div className="topbar-actions-group">
        {/* Unit Toggle */}
        <button
          type="button"
          className="topbar-action-btn unit-btn"
          onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
          title={`Switch to °${unit === 'C' ? 'F' : 'C'}`}
          aria-label="Toggle temperature unit"
        >
          °{unit}
        </button>

        {/* Refresh */}
        <button
          type="button"
          className={`topbar-action-btn refresh-btn ${isRefreshing ? 'spinning' : ''}`}
          onClick={() => loadCityWeather(currentCity, true)}
          title="Refresh current weather data"
          aria-label="Refresh weather data"
          disabled={isLoading || isRefreshing}
        >
          <RotateCw size={16} strokeWidth={2.2} />
        </button>

        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          className="topbar-action-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {isDarkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <button
          type="button"
          className={`topbar-action-btn notif-btn ${isNotificationsOpen ? 'active' : ''}`}
          onClick={() => setIsNotificationsOpen(true)}
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={17} strokeWidth={2} />
          {hasWarning && <span className="topbar-badge-dot" />}
        </button>

        {/* Settings */}
        <button
          type="button"
          className={`topbar-action-btn settings-btn ${isSettingsOpen ? 'active' : ''}`}
          onClick={() => setIsSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={17} strokeWidth={2} />
        </button>
      </div>

      {/* Modals & Popovers */}
      <LocationPopover
        isOpen={isLocationPopoverOpen}
        onClose={() => setIsLocationPopoverOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </header>
  );
}
export default TopBar;
