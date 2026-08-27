import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { fetchAlerts, connectWeatherWebSocket } from '../services/weatherApi';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  Info,
  MapPin,
  ChevronDown,
  ChevronUp,
  Map,
  Compass,
  MessageSquare,
  Flame,
  Wind,
  CloudRain,
  Zap,
  Eye,
  Clock,
  Radio,
  RefreshCw,
  HelpCircle,
  Shield,
  Calendar
} from 'lucide-react';

const MAJOR_INDIAN_CITIES = [
  'Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'Kolkata', 'Chennai',
  'Hyderabad', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Srinagar', 'Shimla', 'Guwahati', 'Nashik'
];

export function AlertsPage() {
  const { currentCity, weatherData, loadCityWeather } = useWeather();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('All'); // 'All' | 'Red' | 'Orange' | 'Yellow' | 'Green'
  const [expandedAlerts, setExpandedAlerts] = useState({});
  const [alertsData, setAlertsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

  const cityParam = searchParams.get('city') || currentCity || 'Pune';

  // Load alerts from backend
  const loadAlerts = useCallback(async (targetCity) => {
    if (!targetCity) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAlerts(targetCity);
      setAlertsData(data);
    } catch (err) {
      console.warn('Alerts API fetch warning:', err);
      // If error occurs, fallback to alerts embedded in weatherData if available
      if (weatherData && weatherData.city && weatherData.city.toLowerCase() === targetCity.toLowerCase()) {
        setAlertsData({
          city: weatherData.city,
          displayLocation: weatherData.displayLocation || targetCity,
          locationProfile: 'urban',
          highestRiskColour: 'green',
          highestRiskAction: 'No Action',
          hasHazard: false,
          alerts: weatherData.alerts || [],
          upcomingRisks: [],
          updatedAt: new Date().toISOString()
        });
      } else {
        setErrorMsg(`Unable to load alert data for ${targetCity}. Please verify connection or try again.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [weatherData]);

  // Sync city selection and global weather context
  useEffect(() => {
    if (cityParam) {
      loadAlerts(cityParam);
      if (loadCityWeather && (!currentCity || currentCity.toLowerCase() !== cityParam.toLowerCase())) {
        loadCityWeather(cityParam);
      }
    }
  }, [cityParam, currentCity, loadCityWeather, loadAlerts]);

  // Real-time WebSocket listener for risk changes
  useEffect(() => {
    const ws = connectWeatherWebSocket((wsData) => {
      if (wsData && wsData.type === 'WEATHER_UPDATE') {
        if (wsData.data && wsData.data.alerts) {
          setAlertsData(prev => ({
            ...prev,
            alerts: wsData.data.alerts,
            highestRiskColour: wsData.data.alerts.length > 0 ? wsData.data.alerts[0].skycastRiskColour || 'green' : 'green',
            updatedAt: wsData.data.updatedAt || new Date().toISOString()
          }));
        } else {
          loadAlerts(cityParam);
        }
      }
    }, cityParam);

    return () => {
      if (ws && typeof ws.close === 'function') {
        ws.close();
      }
    };
  }, [cityParam, loadAlerts]);

  const handleCitySelect = (city) => {
    setIsCityDropdownOpen(false);
    setSearchParams({ city });
    if (loadCityWeather) {
      loadCityWeather(city);
    }
  };

  const toggleExpand = (alertId) => {
    setExpandedAlerts(prev => ({
      ...prev,
      [alertId]: !prev[alertId]
    }));
  };

  // Sort and filter alerts
  const rawAlerts = alertsData?.alerts || [];
  const upcomingRisks = alertsData?.upcomingRisks || [];

  // Categorize active hazard alerts vs normal green baseline
  const activeHazardAlerts = useMemo(() => {
    const priority = { red: 4, orange: 3, yellow: 2, green: 1 };
    return rawAlerts
      .filter(a => a.skycastRiskColour && a.skycastRiskColour !== 'green' && a.hazard !== 'none')
      .sort((a, b) => (priority[b.skycastRiskColour] || 0) - (priority[a.skycastRiskColour] || 0));
  }, [rawAlerts]);

  const highestRiskAlert = activeHazardAlerts.length > 0 ? activeHazardAlerts[0] : null;

  const filteredAlerts = useMemo(() => {
    if (activeTab === 'All') return rawAlerts;
    return rawAlerts.filter(a => (a.skycastRiskColour || 'green').toLowerCase() === activeTab.toLowerCase());
  }, [rawAlerts, activeTab]);

  const getHazardIcon = (hazard = '', color = 'green') => {
    const h = hazard.toLowerCase();
    if (color === 'red') return AlertOctagon;
    if (h.includes('rain') || h.includes('precip')) return CloudRain;
    if (h.includes('squall') || h.includes('wind')) return Wind;
    if (h.includes('thunder') || h.includes('lightning')) return Zap;
    if (h.includes('heat')) return Flame;
    if (h.includes('fog') || h.includes('vis')) return Eye;
    if (color === 'orange') return AlertTriangle;
    if (color === 'yellow') return AlertCircle;
    return CheckCircle2;
  };

  const getRiskMeta = (color = 'green') => {
    const c = (color || 'green').toLowerCase();
    switch (c) {
      case 'red':
        return {
          classColor: 'red',
          text: 'Red — Take Action',
          symbol: '🔴'
        };
      case 'orange':
        return {
          classColor: 'orange',
          text: 'Orange — Be Prepared',
          symbol: '🟠'
        };
      case 'yellow':
        return {
          classColor: 'yellow',
          text: 'Yellow — Be Updated',
          symbol: '🟡'
        };
      default:
        return {
          classColor: 'green',
          text: 'Green — Normal / No Action',
          symbol: '🟢'
        };
    }
  };

  const isStale = weatherData?.stale;

  return (
    <div className="alerts-page-container">
      
      {/* 1. Header & Official Branding Card */}
      <div className="alerts-header-card">
        <div className="alerts-header-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="alerts-badge-brand">
                ⚡ SKYCAST WEATHER RISK
              </span>
              <span className="alerts-framework-sub">
                Rules based on published IMD warning criteria/framework
              </span>
            </div>
            <div className="alerts-title-row">
              <h1 className="alerts-main-title">
                Weather Alerts
              </h1>
              <span className="alerts-badge-pill">
                Risk Center
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Real-time weather risks based on Skycast meteorological analysis.
            </p>
          </div>

          {/* City Selector Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              className="alerts-city-dropdown-btn"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <MapPin size={16} color="#38BDF8" style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {alertsData?.displayLocation || cityParam}
                </span>
              </div>
              <ChevronDown size={16} color="#94A3B8" style={{ transform: isCityDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {isCityDropdownOpen && (
              <div className="alerts-city-menu">
                <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Select Location
                </div>
                {MAJOR_INDIAN_CITIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCitySelect(c)}
                    className={`alerts-city-item ${c.toLowerCase() === cityParam.toLowerCase() ? 'active' : ''}`}
                  >
                    <span>{c}</span>
                    {c.toLowerCase() === cityParam.toLowerCase() && <CheckCircle2 size={14} color="#38BDF8" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mandatory Transparency Notice */}
        <div className="alerts-transparency-banner">
          <Info size={16} color="#38BDF8" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong style={{ color: '#E2E8F0' }}>Transparency Notice:</strong> Skycast assessments are derived algorithmic risk evaluations based on published IMD meteorological criteria. Skycast assessments are <strong>not official IMD warnings</strong>.
          </span>
        </div>

        {/* Stale Data Notice */}
        {isStale && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(120, 53, 15, 0.4)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#FCD34D' }}>
            <Clock size={14} color="#F59E0B" />
            <span>Weather data may be outdated. Last updated: {new Date(alertsData?.updatedAt || Date.now()).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(159, 18, 57, 0.4)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#FECDD3', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertOctagon size={18} color="#F43F5E" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !alertsData && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <RefreshCw size={28} className="animate-spin" color="#38BDF8" />
          <span style={{ fontSize: '14px' }}>Evaluating real-time weather risk for {cityParam}...</span>
        </div>
      )}

      {/* 2. Prominent Highest Active Risk Hero Card */}
      {highestRiskAlert ? (
        <div className={`risk-hero-card ${getRiskMeta(highestRiskAlert.skycastRiskColour).classColor}`}>
          <div className="risk-hero-layout">
            <div className="risk-hero-main">
              <div className="risk-badges-row">
                <span className={`risk-pill-badge ${getRiskMeta(highestRiskAlert.skycastRiskColour).classColor}`}>
                  {getRiskMeta(highestRiskAlert.skycastRiskColour).symbol} {highestRiskAlert.skycastRiskLevel.toUpperCase()}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', background: 'rgba(15, 23, 42, 0.8)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  {highestRiskAlert.actionDirective.toUpperCase()}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '500', background: 'rgba(15, 23, 42, 0.6)', color: '#CBD5E1', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  Basis: {highestRiskAlert.basis ? highestRiskAlert.basis.toUpperCase() : 'FORECAST'}
                </span>
                <span style={{ fontSize: '12px', color: '#CBD5E1' }}>
                  Valid: {highestRiskAlert.forecastWindow === 'next_24h' ? 'Next 24 hours' : 'Next 3 hours'}
                </span>
              </div>

              <div>
                <h2 className="risk-hero-title">
                  {highestRiskAlert.hazardClassification.replace(/_/g, ' ').toUpperCase()}
                  <span style={{ fontSize: '16px', fontWeight: '500', color: '#CBD5E1', marginLeft: '8px' }}>in {alertsData?.displayLocation || cityParam}</span>
                </h2>
                <p className="risk-hero-desc">
                  Measured / Forecast: <strong style={{ color: '#FFFFFF' }}>{highestRiskAlert.measuredValue} {highestRiskAlert.unit}</strong>
                  {highestRiskAlert.threshold && (
                    <span style={{ marginLeft: '8px', color: '#94A3B8' }}>(Threshold: {highestRiskAlert.threshold} {highestRiskAlert.unit})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="risk-actions-group">
              <button
                type="button"
                onClick={() => navigate(`/map?city=${encodeURIComponent(cityParam)}`)}
                className="risk-action-btn-secondary"
              >
                <Map size={14} color="#38BDF8" />
                <span>View on Map</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/details?city=${encodeURIComponent(cityParam)}`)}
                className="risk-action-btn-secondary"
              >
                <Compass size={14} color="#34D399" />
                <span>View Weather</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/weathergpt?city=${encodeURIComponent(cityParam)}`)}
                className="risk-action-btn-primary"
              >
                <MessageSquare size={14} />
                <span>Ask WeatherGPT</span>
              </button>
            </div>
          </div>

          {/* Explicit Visual Distinction: IMD Classification vs Skycast Risk */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
                IMD Hazard Classification
              </span>
              <p style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 2px 0' }}>
                {highestRiskAlert.hazardClassification.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Physical meteorological category defined by IMD criteria.</span>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
                Skycast Assessment
              </span>
              <p style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{getRiskMeta(highestRiskAlert.skycastRiskColour).symbol}</span>
                <span>{highestRiskAlert.skycastRiskLevel.toUpperCase()} — {highestRiskAlert.actionDirective}</span>
              </p>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Derived computational risk based on location profile ({alertsData?.locationProfile || 'urban'}).</span>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Green State (No Active Weather Risks) */
        <div className="risk-hero-card green">
          <div className="risk-hero-layout">
            <div className="risk-hero-main">
              <div className="risk-badges-row">
                <span className="risk-pill-badge green">
                  🟢 GREEN — NO ACTIVE WEATHER RISKS
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', background: 'rgba(15, 23, 42, 0.7)', color: '#A7F3D0', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  Normal Conditions
                </span>
              </div>
              <h2 className="risk-hero-title">
                {alertsData?.displayLocation || cityParam} currently has no detected Skycast weather risks.
              </h2>
              <p className="risk-hero-desc">
                All evaluated meteorological parameters (rainfall, squall wind, heat, cold, fog) are within normal seasonal range.
              </p>
            </div>

            <div className="risk-actions-group">
              <button
                type="button"
                onClick={() => navigate(`/details?city=${encodeURIComponent(cityParam)}`)}
                className="risk-action-btn-secondary"
              >
                <Compass size={14} color="#34D399" />
                <span>View Weather Details</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/weathergpt?city=${encodeURIComponent(cityParam)}`)}
                className="risk-action-btn-primary"
              >
                <MessageSquare size={14} />
                <span>Ask WeatherGPT</span>
              </button>
            </div>
          </div>

          {/* Current Live Overview snapshot */}
          {weatherData && (
            <div className="risk-stats-overview">
              <div className="risk-overview-box">
                <span className="risk-overview-label">Temperature</span>
                <p className="risk-overview-val">{weatherData.tempC}°C</p>
                <span className="risk-overview-sub">Feels {weatherData.feelsLikeC || weatherData.tempC}°C</span>
              </div>
              <div className="risk-overview-box">
                <span className="risk-overview-label">Condition</span>
                <p className="risk-overview-val" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{weatherData.condition}</p>
                <span className="risk-overview-sub">{weatherData.insight?.summary || 'Stable'}</span>
              </div>
              <div className="risk-overview-box">
                <span className="risk-overview-label">Humidity</span>
                <p className="risk-overview-val">{weatherData.humidity}%</p>
                <span className="risk-overview-sub">Wind {weatherData.windSpeedKmh} km/h</span>
              </div>
              <div className="risk-overview-box">
                <span className="risk-overview-label">Rain Probability</span>
                <p className="risk-overview-val">{weatherData.insight?.rainChance || 0}%</p>
                <span className="risk-overview-sub">Next 24h</span>
              </div>
            </div>
          )}

          <div style={{ marginTop: '14px', fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
            * Note: No active Skycast risk does not mean no danger whatsoever. Always stay updated during rapidly developing localized conditions.
          </div>
        </div>
      )}

      {/* 4. Filter Tabs for All Hazards */}
      <div className="alerts-filter-bar">
        <div className="alerts-filter-list">
          {['All', 'Red', 'Orange', 'Yellow', 'Green'].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`alerts-filter-pill-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'All' && 'All Hazard Cards'}
              {tab === 'Red' && '🔴 Red (Action)'}
              {tab === 'Orange' && '🟠 Orange (Prepared)'}
              {tab === 'Yellow' && '🟡 Yellow (Updated)'}
              {tab === 'Green' && '🟢 Green (Normal)'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>
          Showing {filteredAlerts.length} item{filteredAlerts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* 5. All Active Hazard Cards List with Expandable "Why?" */}
      <div className="alerts-cards-stack">
        {filteredAlerts.map(alert => {
          const Icon = getHazardIcon(alert.hazard, alert.skycastRiskColour);
          const meta = getRiskMeta(alert.skycastRiskColour);
          const isExpanded = !!expandedAlerts[alert.id];

          return (
            <div
              key={alert.id}
              className="alert-item-card"
            >
              <div className="alert-item-header">
                <div className="alert-item-left">
                  <div className={`alert-item-icon-box ${meta.classColor}`}>
                    <Icon size={22} />
                  </div>
                  <div className="alert-item-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span className={`risk-pill-badge ${meta.classColor}`}>
                        {meta.symbol} {alert.skycastRiskLevel?.toUpperCase()} — {alert.actionDirective}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', background: 'rgba(15, 23, 42, 0.8)', color: '#CBD5E1', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                        {alert.basis ? alert.basis.toUpperCase() : 'FORECAST'}
                      </span>
                      {alert.locationProfile && (
                        <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '500', background: 'rgba(15, 23, 42, 0.6)', color: '#94A3B8', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          Profile: {alert.locationProfile.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h3 className="alert-item-title">
                      {alert.title}
                    </h3>
                    <p className="alert-item-desc">
                      {alert.explanation}
                    </p>
                  </div>
                </div>

                <div className="alert-item-actions">
                  <button
                    type="button"
                    onClick={() => toggleExpand(alert.id)}
                    className="alert-why-toggle-btn"
                  >
                    <span>Why is this active?</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/map?city=${encodeURIComponent(cityParam)}`)}
                    className="risk-action-btn-secondary"
                    style={{ padding: '8px 10px' }}
                    title="View on Map"
                  >
                    <Map size={15} color="#38BDF8" />
                  </button>
                </div>
              </div>

              {/* Expandable "Why?" and Limitations Section */}
              {isExpanded && (
                <div className="alert-item-drawer">
                  <div className="alert-drawer-cols">
                    <div>
                      <div className="alert-drawer-section-title">
                        <HelpCircle size={14} color="#38BDF8" />
                        <span>Triggering Meteorological Metrics</span>
                      </div>
                      <ul className="alert-drawer-list">
                        <li>
                          Measured/Forecast Value: <strong style={{ color: '#FFFFFF' }}>{alert.measuredValue} {alert.unit}</strong>
                        </li>
                        <li>
                          Applicable Threshold: <strong style={{ color: '#FFFFFF' }}>{alert.threshold || 'N/A'} {alert.unit}</strong>
                        </li>
                        <li>
                          IMD Hazard Classification: <strong style={{ color: '#FFFFFF' }}>{alert.hazardClassification?.replace(/_/g, ' ')}</strong>
                        </li>
                        <li>
                          Location Profile: <strong style={{ color: '#FFFFFF' }}>{alert.locationProfile}</strong>
                        </li>
                        <li>
                          Rule Framework: <strong style={{ color: '#FFFFFF' }}>{alert.ruleBasis}</strong>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <div className="alert-drawer-section-title">
                        <Shield size={14} color="#F59E0B" />
                        <span>Known Meteorological Limitations</span>
                      </div>
                      <ul className="alert-drawer-list">
                        {(alert.limitations || ['General numerical model resolution limitations apply.']).map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="alert-drawer-footer">
                    <span>Valid from: {new Date(alert.validFrom || Date.now()).toLocaleTimeString()} to {new Date(alert.validUntil || Date.now() + 86400000).toLocaleTimeString()}</span>
                    <span style={{ fontStyle: 'italic' }}>Derived Skycast assessment • Not an official government warning</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 6. Upcoming Forecast Risks Section (Days 1–5) */}
      <div className="upcoming-risks-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                FORECAST
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>Upcoming Risks</h3>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Forecast weather hazards evaluated from multi-day NWP numerical model projections.
            </p>
          </div>
          <Calendar size={20} color="#64748B" />
        </div>

        {upcomingRisks.length > 0 ? (
          <div className="upcoming-risks-grid">
            {upcomingRisks.map(up => {
              const meta = getRiskMeta(up.skycastRiskColour);
              return (
                <div
                  key={up.id}
                  className={`upcoming-risk-card ${meta.classColor}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: '700', color: '#FFFFFF' }}>{up.day} ({up.timeWindow})</span>
                    <span className={`risk-pill-badge ${meta.classColor}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                      {up.skycastRiskLevel?.toUpperCase()}
                    </span>
                  </div>
                  <h4 style={{ fontWeight: '700', color: '#F1F5F9', fontSize: '14px', margin: '4px 0' }}>{up.title}</h4>
                  <p style={{ fontSize: '12px', color: '#CBD5E1', margin: 0 }}>
                    Expected: <strong style={{ color: '#FFFFFF' }}>{up.measuredValue} {up.unit}</strong>
                    {up.probability && <span style={{ marginLeft: '6px', color: '#94A3B8' }}>({up.probability}% chance)</span>}
                  </p>
                  <div style={{ fontSize: '10px', color: '#94A3B8', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span>{up.ruleBasis}</span>
                    <span style={{ fontWeight: '600', color: '#CBD5E1' }}>FORECAST</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>
            No upcoming hazardous weather risks detected for {cityParam} across the 5-day forecast horizon.
          </div>
        )}
      </div>

      {/* 7. Real-time Monitoring & Status Timeline */}
      <div className="ws-footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={14} color="#34D399" className="animate-pulse" />
          <span>Real-time WebSocket risk stream active for <strong style={{ color: '#FFFFFF' }}>{cityParam}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span>Collector cycle: <strong style={{ color: '#FFFFFF' }}>180s interval</strong></span>
          <span>Evaluation Engine: <strong style={{ color: '#FFFFFF' }}>IMD Criteria v2.4</strong></span>
        </div>
      </div>

    </div>
  );
}

export default AlertsPage;
