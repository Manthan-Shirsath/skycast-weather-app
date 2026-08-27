import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin,
  Search,
  Settings,
  RotateCw,
  Loader2,
  ChevronDown,
  Home,
  Bot,
  Map as MapIcon,
  AlertTriangle,
  MoreHorizontal,
  TrendingUp,
  Sliders,
  Sparkles,
  X,
  Bell,
  Sprout
} from 'lucide-react';
import { SkycastLogoIcon } from './WeatherIcons';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import { LocationPopover } from './LocationPopover';
import { SettingsModal } from './SettingsModal';
import { NotificationsModal } from './NotificationsModal';

export function Header() {
  const {
    currentCity,
    weatherData,
    unit,
    setUnit,
    isLoading,
    isRefreshing,
    loadCityWeather
  } = useWeather();
  const { t, language } = useTranslation();

  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const searchRef = useRef(null);
  const moreMenuRef = useRef(null);

  // Suggestions for autocomplete
  const popularCities = ['Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'London', 'New York', 'Tokyo', 'Paris', 'Dubai', 'Sydney'];
  const filteredSuggestions = popularCities.filter(c =>
    c.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const displayLocation = weatherData?.displayLocation || `${currentCity}`;
  const hasWarning = weatherData?.alerts && weatherData.alerts.length > 0 && weatherData.alerts[0].severity === 'warning';

  return (
    <header className="app-header-block">
      {/* Top Navbar Row */}
      <div className="header-nav">
        {/* Left: Brand & Location Badge */}
        <div className="brand-location">
          <div className="logo-container" onClick={() => navigate('/')} title="Go to Home">
            <SkycastLogoIcon size={30} />
            <div className="logo-text-group">
              <span className="logo-text">WeatherGPT</span>
              <span className="logo-subtext">AI-POWERED WEATHER INTELLIGENCE</span>
            </div>
          </div>

          <div
            className="location-badge"
            onClick={() => setIsLocationPopoverOpen(true)}
            title="Change location"
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && setIsLocationPopoverOpen(true)}
          >
            <span className="location-pin-icon">
              <MapPin size={16} fill="#EF4444" stroke="#EF4444" />
            </span>
            <span className="location-badge-text">{displayLocation}</span>
            <ChevronDown size={14} className="location-badge-arrow" />
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="search-wrapper" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="search-input-box">
            <input
              type="text"
              className="search-input"
              placeholder="Search city or location"
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
              className="search-icon-btn"
              aria-label="Search"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} strokeWidth={2.2} />
              )}
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && (
            <div className="search-dropdown">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((cityName) => (
                  <div
                    key={cityName}
                    className="search-item"
                    onClick={() => handleSuggestionClick(cityName)}
                  >
                    <span>{cityName}</span>
                    <span className="search-item-region">Live Forecast</span>
                  </div>
                ))
              ) : (
                <div className="search-item" onClick={() => handleSearchSubmit()}>
                  <span>Search for "<strong>{searchQuery}</strong>"</span>
                  <span className="search-item-region">Press Enter</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="nav-actions">
          <button
            type="button"
            className="unit-toggle-btn"
            onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
            title="Toggle °C / °F"
            aria-label="Toggle Temperature Unit"
          >
            °{unit}
          </button>

          <button
            type="button"
            className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={() => loadCityWeather(currentCity, true)}
            title="Refresh current weather data"
            aria-label="Refresh Weather Data"
            disabled={isLoading || isRefreshing}
          >
            <RotateCw size={17} strokeWidth={2.2} />
          </button>

          <button
            type="button"
            className={`notifications-btn ${isNotificationsOpen ? 'active' : ''}`}
            aria-label="Notifications"
            title="Notifications"
            onClick={() => setIsNotificationsOpen(true)}
          >
            <Bell size={18} strokeWidth={2} />
            {hasWarning && <span className="notif-badge-dot" />}
          </button>

          <button
            type="button"
            className={`settings-btn ${isSettingsOpen ? 'active' : ''}`}
            aria-label="Settings"
            title="Settings"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Desktop Sub Navigation Bar Tabs */}
      <nav className="header-subnav-tabs" aria-label="Main Navigation">
        <NavLink
          to={`/?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `subnav-tab-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          {t('nav_home', 'Home')}
        </NavLink>

        <NavLink
          to={`/trends?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `subnav-tab-item ${isActive ? 'active' : ''}`}
        >
          {t('nav_trends', 'Trends')}
        </NavLink>

        <NavLink
          to={`/map?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `subnav-tab-item ${isActive ? 'active' : ''}`}
        >
          {t('nav_map', 'Map')}
        </NavLink>

        <NavLink
          to={`/details?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `subnav-tab-item ${isActive ? 'active' : ''}`}
        >
          {t('nav_details', 'Forecast')}
        </NavLink>

        <NavLink
          to={`/alerts?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `subnav-tab-item ${isActive ? 'active' : ''}`}
        >
          {t('nav_alerts', 'Alerts')}
          {hasWarning && <span className="alerts-badge-dot" />}
        </NavLink>

        <NavLink
          to={`/weathergpt?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `subnav-tab-item weathergpt-tab ${isActive ? 'active' : ''}`}
        >
          <Sparkles size={14} className="weathergpt-tab-sparkle" />
          <span>{t('nav_weathergpt', 'WeatherGPT')}</span>
        </NavLink>

        <NavLink
          to={`/agriculture?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `subnav-tab-item ${isActive ? 'active' : ''}`}
        >
          <Sprout size={14} className="text-emerald-500" />
          <span>{t('nav_agriculture', 'Agriculture')}</span>
        </NavLink>

        <NavLink
          to="/locations"
          className={({ isActive }) => `subnav-tab-item ${isActive ? 'active' : ''}`}
        >
          {t('nav_locations', 'Locations')}
        </NavLink>
      </nav>

      {/* Mobile Bottom Navigation Bar (< 640px) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <NavLink
          to={`/?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          <Home size={20} />
          <span>{t('nav_home', 'Home')}</span>
        </NavLink>

        <NavLink
          to={`/weathergpt?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `mobile-nav-item mobile-ai-item ${isActive ? 'active' : ''}`}
        >
          <Bot size={20} />
          <span>AI</span>
        </NavLink>

        <NavLink
          to={`/map?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <MapIcon size={20} />
          <span>{t('nav_map', 'Map')}</span>
        </NavLink>

        <NavLink
          to={`/alerts?city=${encodeURIComponent(currentCity)}`}
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <AlertTriangle size={20} />
          <span>{t('nav_alerts', 'Alerts')}</span>
          {hasWarning && <span className="mobile-alert-dot" />}
        </NavLink>

        <div className="mobile-more-wrapper" ref={moreMenuRef}>
          <button
            type="button"
            className={`mobile-nav-item ${isMoreMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            aria-label="More options"
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>

          {isMoreMenuOpen && (
            <div className="mobile-more-sheet">
              <div className="mobile-more-header">
                <span>Navigation & Settings</span>
                <button
                  type="button"
                  className="mobile-more-close"
                  onClick={() => setIsMoreMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mobile-more-links">
                <button
                  type="button"
                  className="mobile-sheet-link"
                  onClick={() => {
                    navigate(`/agriculture?city=${encodeURIComponent(currentCity)}`);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <Sprout size={18} className="text-emerald-500" />
                  <span>{t('nav_agriculture', 'Farmer & Agriculture')}</span>
                </button>

                <button
                  type="button"
                  className="mobile-sheet-link"
                  onClick={() => {
                    navigate(`/details?city=${encodeURIComponent(currentCity)}`);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <TrendingUp size={18} />
                  <span>{t('nav_details', 'Forecast & Details')}</span>
                </button>

                <button
                  type="button"
                  className="mobile-sheet-link"
                  onClick={() => {
                    navigate(`/trends?city=${encodeURIComponent(currentCity)}`);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <TrendingUp size={18} />
                  <span>{t('nav_trends', 'Historical Trends')}</span>
                </button>

                <button
                  type="button"
                  className="mobile-sheet-link"
                  onClick={() => {
                    navigate('/locations');
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <MapPin size={18} />
                  <span>{t('nav_locations', 'Saved Locations')}</span>
                </button>

                <button
                  type="button"
                  className="mobile-sheet-link"
                  onClick={() => {
                    setIsNotificationsOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <Bell size={18} />
                  <span>{t('nav_notifications', 'Notifications Center')}</span>
                </button>

                <button
                  type="button"
                  className="mobile-sheet-link"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                >
                  <Sliders size={18} />
                  <span>{t('nav_settings', 'Preferences & Settings')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Location Selector Popover */}
      <LocationPopover
        isOpen={isLocationPopoverOpen}
        onClose={() => setIsLocationPopoverOpen(false)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </header>
  );
}
