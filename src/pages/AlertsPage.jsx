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
  Building2,
  Clock,
  Radio,
  RefreshCw,
  HelpCircle,
  Shield,
  Layers,
  Thermometer,
  Droplets,
  Calendar
} from 'lucide-react';

const MAJOR_INDIAN_CITIES = [
  'Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'Kolkata', 'Chennai',
  'Hyderabad', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Srinagar', 'Shimla', 'Guwahati'
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

  const getRiskBadgeStyles = (color = 'green') => {
    switch (color.toLowerCase()) {
      case 'red':
        return {
          bg: 'bg-rose-950/80 border-rose-600/80 text-rose-300',
          badge: 'bg-rose-600 text-white',
          glow: 'shadow-rose-900/30 border-rose-500/60',
          pill: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          text: 'Red — Take Action',
          symbol: '🔴'
        };
      case 'orange':
        return {
          bg: 'bg-amber-950/80 border-amber-600/80 text-amber-300',
          badge: 'bg-amber-600 text-white',
          glow: 'shadow-amber-900/30 border-amber-500/60',
          pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          text: 'Orange — Be Prepared',
          symbol: '🟠'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-950/80 border-yellow-600/80 text-yellow-300',
          badge: 'bg-yellow-600 text-slate-950 font-bold',
          glow: 'shadow-yellow-900/30 border-yellow-500/60',
          pill: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          text: 'Yellow — Be Updated',
          symbol: '🟡'
        };
      default:
        return {
          bg: 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300',
          badge: 'bg-emerald-600 text-white',
          glow: 'shadow-emerald-900/20 border-emerald-500/40',
          pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          text: 'Green — Normal / No Action',
          symbol: '🟢'
        };
    }
  };

  const isStale = weatherData?.stale;

  return (
    <div className="alerts-page-container max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* 1. Header & Official Branding */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ⚡ SKYCAST WEATHER RISK
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Rules based on published IMD warning criteria/framework
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Weather Alerts
              <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Risk Center
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time weather risks based on Skycast analysis.
            </p>
          </div>

          {/* City Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              className="w-full md:w-64 flex items-center justify-between px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-white font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin size={16} className="text-sky-400 shrink-0" />
                <span className="truncate">{alertsData?.displayLocation || cityParam}</span>
              </div>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCityDropdownOpen && (
              <div className="absolute right-0 mt-2 w-full md:w-64 max-h-60 overflow-y-auto bg-slate-850 border border-slate-700 rounded-xl shadow-2xl z-50 py-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-750">
                  Select Location
                </div>
                {MAJOR_INDIAN_CITIES.map(c => (
                  <button
                    key={c}
                    onClick={() => handleCitySelect(c)}
                    className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between hover:bg-slate-750 transition-colors ${c.toLowerCase() === cityParam.toLowerCase() ? 'text-sky-400 font-semibold bg-sky-950/40' : 'text-slate-200'}`}
                  >
                    <span>{c}</span>
                    {c.toLowerCase() === cityParam.toLowerCase() && <CheckCircle2 size={14} className="text-sky-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mandatory Transparency Notice */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
          <Info size={15} className="text-sky-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-300">Transparency Notice:</strong> Skycast assessments are derived algorithmic risk evaluations based on published IMD meteorological criteria. Skycast assessments are <strong>not official IMD warnings</strong>.
          </span>
        </div>

        {/* Stale Data Notice */}
        {isStale && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-950/60 border border-amber-700/60 flex items-center gap-2 text-xs text-amber-300">
            <Clock size={14} className="text-amber-400 shrink-0" />
            <span>Weather data may be outdated. Last updated: {new Date(alertsData?.updatedAt || Date.now()).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-sm flex items-center gap-3">
          <AlertOctagon size={18} className="text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !alertsData && (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={24} className="animate-spin text-sky-400" />
          <span>Evaluating real-time weather risk for {cityParam}...</span>
        </div>
      )}

      {/* 2. Prominent Highest Active Risk Hero Card */}
      {highestRiskAlert ? (
        <div className={`p-6 rounded-2xl border ${getRiskBadgeStyles(highestRiskAlert.skycastRiskColour).bg} ${getRiskBadgeStyles(highestRiskAlert.skycastRiskColour).glow} shadow-2xl backdrop-blur-md transition-all`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${getRiskBadgeStyles(highestRiskAlert.skycastRiskColour).badge}`}>
                  {getRiskBadgeStyles(highestRiskAlert.skycastRiskColour).symbol} {highestRiskAlert.skycastRiskLevel.toUpperCase()}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900/80 text-white border border-slate-700">
                  {highestRiskAlert.actionDirective.toUpperCase()}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900/70 text-slate-300 border border-slate-700/80">
                  Basis: {highestRiskAlert.basis ? highestRiskAlert.basis.toUpperCase() : 'FORECAST'}
                </span>
                <span className="text-xs text-slate-300">
                  Valid: {highestRiskAlert.forecastWindow === 'next_24h' ? 'Next 24 hours' : 'Next 3 hours'}
                </span>
              </div>

              <div>
                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  {highestRiskAlert.hazardClassification.replace(/_/g, ' ').toUpperCase()}
                  <span className="text-base font-medium text-slate-300">in {alertsData?.displayLocation || cityParam}</span>
                </h2>
                <p className="text-slate-300 text-sm mt-1">
                  Measured / Forecast: <strong className="text-white">{highestRiskAlert.measuredValue} {highestRiskAlert.unit}</strong>
                  {highestRiskAlert.threshold && (
                    <span className="ml-2 text-slate-400">(Threshold: {highestRiskAlert.threshold} {highestRiskAlert.unit})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
              <button
                onClick={() => navigate(`/map?city=${encodeURIComponent(cityParam)}`)}
                className="px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors shadow-sm"
              >
                <Map size={14} className="text-sky-400" />
                View on Map
              </button>
              <button
                onClick={() => navigate(`/details?city=${encodeURIComponent(cityParam)}`)}
                className="px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors shadow-sm"
              >
                <Compass size={14} className="text-emerald-400" />
                View Weather
              </button>
              <button
                onClick={() => navigate(`/weathergpt?city=${encodeURIComponent(cityParam)}`)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-md"
              >
                <MessageSquare size={14} />
                Ask WeatherGPT
              </button>
            </div>
          </div>

          {/* Explicit Visual Distinction: IMD Classification vs Skycast Risk */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                IMD Hazard Classification
              </span>
              <p className="text-base font-bold text-white">
                {highestRiskAlert.hazardClassification.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
              <span className="text-[11px] text-slate-400">Physical meteorological category defined by IMD criteria.</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Skycast Assessment
              </span>
              <p className="text-base font-bold text-white flex items-center gap-1.5">
                <span>{getRiskBadgeStyles(highestRiskAlert.skycastRiskColour).symbol}</span>
                <span>{highestRiskAlert.skycastRiskLevel.toUpperCase()} — {highestRiskAlert.actionDirective}</span>
              </p>
              <span className="text-[11px] text-slate-400">Derived computational risk based on location profile ({alertsData?.locationProfile || 'urban'}).</span>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Green State (No Active Weather Risks) */
        <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-700/50 shadow-xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-600 text-white">
                  🟢 GREEN — NO ACTIVE WEATHER RISKS
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900/80 text-emerald-300 border border-emerald-800/40">
                  Normal Conditions
                </span>
              </div>
              <h2 className="text-2xl font-black text-white">
                {alertsData?.displayLocation || cityParam} currently has no detected Skycast weather risks.
              </h2>
              <p className="text-sm text-slate-300">
                All evaluated meteorological parameters (rainfall, squall wind, heat, cold, fog) are within normal seasonal range.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/details?city=${encodeURIComponent(cityParam)}`)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
              >
                <Compass size={14} className="text-emerald-400" />
                View Weather Details
              </button>
              <button
                onClick={() => navigate(`/weathergpt?city=${encodeURIComponent(cityParam)}`)}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <MessageSquare size={14} />
                Ask WeatherGPT
              </button>
            </div>
          </div>

          {/* Current Live Overview snapshot */}
          {weatherData && (
            <div className="mt-6 pt-5 border-t border-emerald-800/30 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Temperature</span>
                <p className="text-lg font-bold text-white">{weatherData.tempC}°C</p>
                <span className="text-xs text-slate-400">Feels {weatherData.feelsLikeC || weatherData.tempC}°C</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Condition</span>
                <p className="text-lg font-bold text-white truncate">{weatherData.condition}</p>
                <span className="text-xs text-slate-400">{weatherData.insight?.summary || 'Stable'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Humidity</span>
                <p className="text-lg font-bold text-white">{weatherData.humidity}%</p>
                <span className="text-xs text-slate-400">Wind {weatherData.windSpeedKmh} km/h</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Rain Probability</span>
                <p className="text-lg font-bold text-white">{weatherData.insight?.rainChance || 0}%</p>
                <span className="text-xs text-slate-400">Next 24h</span>
              </div>
            </div>
          )}

          <div className="mt-4 text-[11px] text-slate-400 italic">
            * Note: No active Skycast risk does not mean no danger whatsoever. Always stay updated during rapidly developing localized conditions.
          </div>
        </div>
      )}

      {/* 4. Filter Tabs for All Hazards */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {['All', 'Red', 'Orange', 'Yellow', 'Green'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === tab
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab === 'All' && 'All Hazard Cards'}
              {tab === 'Red' && '🔴 Red (Action)'}
              {tab === 'Orange' && '🟠 Orange (Prepared)'}
              {tab === 'Yellow' && '🟡 Yellow (Updated)'}
              {tab === 'Green' && '🟢 Green (Normal)'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 shrink-0">
          Showing {filteredAlerts.length} item{filteredAlerts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* 5. All Active Hazard Cards List with Expandable "Why?" */}
      <div className="space-y-4">
        {filteredAlerts.map(alert => {
          const Icon = getHazardIcon(alert.hazard, alert.skycastRiskColour);
          const style = getRiskBadgeStyles(alert.skycastRiskColour);
          const isExpanded = !!expandedAlerts[alert.id];

          return (
            <div
              key={alert.id}
              className={`rounded-2xl border ${style.bg} overflow-hidden shadow-lg transition-all`}
            >
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${style.badge} shrink-0 mt-1`}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${style.pill}`}>
                        {style.symbol} {alert.skycastRiskLevel?.toUpperCase()} — {alert.actionDirective}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-900/80 text-slate-300 border border-slate-700">
                        {alert.basis ? alert.basis.toUpperCase() : 'FORECAST'}
                      </span>
                      {alert.locationProfile && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-900/60 text-slate-400 border border-slate-800">
                          Profile: {alert.locationProfile.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {alert.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {alert.explanation}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => toggleExpand(alert.id)}
                    className="px-3.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    <span>Why is this active?</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => navigate(`/map?city=${encodeURIComponent(cityParam)}`)}
                    className="p-2 bg-slate-900/90 hover:bg-slate-800 text-sky-400 rounded-xl border border-slate-700 transition-colors"
                    title="View on Map"
                  >
                    <Map size={15} />
                  </button>
                </div>
              </div>

              {/* Expandable "Why?" and Limitations Section */}
              {isExpanded && (
                <div className="p-5 bg-slate-950/80 border-t border-slate-800/80 space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                        <HelpCircle size={13} className="text-sky-400" />
                        Triggering Meteorological Metrics
                      </h4>
                      <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                        <li>
                          Measured/Forecast Value: <strong className="text-white">{alert.measuredValue} {alert.unit}</strong>
                        </li>
                        <li>
                          Applicable Threshold: <strong className="text-white">{alert.threshold || 'N/A'} {alert.unit}</strong>
                        </li>
                        <li>
                          IMD Hazard Classification: <strong className="text-white">{alert.hazardClassification?.replace(/_/g, ' ')}</strong>
                        </li>
                        <li>
                          Location Profile: <strong className="text-white">{alert.locationProfile}</strong>
                        </li>
                        <li>
                          Rule Framework: <strong className="text-white">{alert.ruleBasis}</strong>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                        <Shield size={13} className="text-amber-400" />
                        Known Meteorological Limitations
                      </h4>
                      <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                        {(alert.limitations || ['General numerical model resolution limitations apply.']).map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-slate-400 text-[11px]">
                    <span>Valid from: {new Date(alert.validFrom || Date.now()).toLocaleTimeString()} to {new Date(alert.validUntil || Date.now() + 86400000).toLocaleTimeString()}</span>
                    <span className="italic">Derived Skycast assessment • Not an official government warning</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 6. Upcoming Forecast Risks Section (Days 1–5) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/30">
                FORECAST
              </span>
              <h3 className="text-lg font-black text-white tracking-tight">Upcoming Risks</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Forecast weather hazards evaluated from multi-day NWP numerical model projections.
            </p>
          </div>
          <Calendar size={18} className="text-slate-500" />
        </div>

        {upcomingRisks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingRisks.map(up => {
              const style = getRiskBadgeStyles(up.skycastRiskColour);
              return (
                <div
                  key={up.id}
                  className={`p-4 rounded-xl border ${style.bg} space-y-2`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{up.day} ({up.timeWindow})</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${style.badge}`}>
                      {up.skycastRiskLevel?.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-100 text-sm">{up.title}</h4>
                  <p className="text-xs text-slate-300">
                    Expected: <strong className="text-white">{up.measuredValue} {up.unit}</strong>
                    {up.probability && <span className="ml-1 text-slate-400">({up.probability}% chance)</span>}
                  </p>
                  <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
                    <span>{up.ruleBasis}</span>
                    <span className="font-semibold text-slate-300">FORECAST</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400">
            No upcoming hazardous weather risks detected for {cityParam} across the 5-day forecast horizon.
          </div>
        )}
      </div>

      {/* 7. Real-time Monitoring & Status Timeline */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-emerald-400 animate-pulse" />
          <span>Real-time WebSocket risk stream active for <strong>{cityParam}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span>Collector cycle: <strong>180s interval</strong></span>
          <span>Evaluation Engine: <strong>IMD Criteria v2.4</strong></span>
        </div>
      </div>

    </div>
  );
}

export default AlertsPage;
