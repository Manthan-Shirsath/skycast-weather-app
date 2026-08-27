import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  TrendingUp,
  Map as MapIcon,
  Sliders,
  AlertTriangle,
  Sparkles,
  Sprout,
  Bookmark,
  Bot,
  Zap
} from 'lucide-react';
import { SkycastLogoIcon } from './WeatherIcons';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';

export function Sidebar() {
  const { currentCity, weatherData } = useWeather();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const hasWarning =
    weatherData?.alerts &&
    weatherData.alerts.length > 0 &&
    weatherData.alerts[0].severity === 'warning';

  const navItems = [
    {
      to: `/?city=${encodeURIComponent(currentCity)}`,
      label: t('nav_home', 'Home'),
      icon: Home,
      exact: true
    },
    {
      to: `/trends?city=${encodeURIComponent(currentCity)}`,
      label: t('nav_trends', 'Climate Trends'),
      icon: TrendingUp
    },
    {
      to: `/map?city=${encodeURIComponent(currentCity)}`,
      label: t('nav_map', 'Weather Map'),
      icon: MapIcon
    },
    {
      to: `/details?city=${encodeURIComponent(currentCity)}`,
      label: t('nav_details', 'Forecast'),
      icon: Sliders
    },
    {
      to: `/alerts?city=${encodeURIComponent(currentCity)}`,
      label: t('nav_alerts', 'Alerts'),
      icon: AlertTriangle,
      badge: hasWarning
    },
    {
      to: `/weathergpt?city=${encodeURIComponent(currentCity)}`,
      label: t('nav_weathergpt', 'WeatherGPT'),
      icon: Sparkles,
      highlight: true
    },
    {
      to: `/agriculture?city=${encodeURIComponent(currentCity)}`,
      label: t('nav_agriculture', 'Agriculture'),
      icon: Sprout
    },
    {
      to: '/locations',
      label: t('nav_locations', 'Saved Locations'),
      icon: Bookmark
    }
  ];

  return (
    <aside className="app-left-sidebar" aria-label="Sidebar Navigation">
      {/* 1. Sidebar Brand Header */}
      <div
        className="sidebar-brand-header"
        onClick={() => navigate(`/?city=${encodeURIComponent(currentCity)}`)}
        title="WeatherGPT Home"
        tabIndex={0}
        role="button"
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/?city=${encodeURIComponent(currentCity)}`)}
      >
        <div className="sidebar-logo-icon">
          <SkycastLogoIcon size={28} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">WeatherGPT</span>
          <span className="sidebar-brand-subtitle">AI WEATHER INTELLIGENCE</span>
        </div>
      </div>

      {/* 2. Main Navigation List */}
      <nav className="sidebar-nav-list" aria-label="Main navigation items">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to.split('?')[0]);

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={`sidebar-nav-item ${isActive ? 'active' : ''} ${item.highlight ? 'highlight-ai' : ''}`}
              title={item.label}
            >
              <div className="sidebar-nav-icon-wrap">
                <Icon size={19} className="sidebar-icon" />
                {item.badge && <span className="sidebar-badge-dot" />}
              </div>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.highlight && <span className="sidebar-ai-pill">AI</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* 3. Bottom AI Assistant Card & Status */}
      <div className="sidebar-footer-section">
        <div
          className="sidebar-ai-card"
          onClick={() => navigate(`/weathergpt?city=${encodeURIComponent(currentCity)}`)}
          role="button"
          tabIndex={0}
          title="Open WeatherGPT Assistant"
          onKeyDown={(e) => e.key === 'Enter' && navigate(`/weathergpt?city=${encodeURIComponent(currentCity)}`)}
        >
          <div className="sidebar-ai-card-header">
            <div className="ai-card-icon-wrap">
              <Bot size={16} className="text-violet-400" />
            </div>
            <div className="ai-card-status">
              <span className="status-dot-pulse" />
              <span>Online</span>
            </div>
          </div>
          <p className="ai-card-title">WeatherGPT AI</p>
          <p className="ai-card-prompt">Ask anything about local weather, risks, or forecasts →</p>
        </div>

        <div className="sidebar-nwp-status">
          <Zap size={13} className="text-sky-500" />
          <span>NOAA GFS • Live NWP</span>
        </div>
      </div>
    </aside>
  );
}
export default Sidebar;
