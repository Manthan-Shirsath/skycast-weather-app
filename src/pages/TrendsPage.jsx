import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Clock,
  CloudRain,
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  ShieldAlert,
  ChevronDown,
  MapPin,
  RefreshCw,
  Layers,
  Info,
  CheckCircle2,
  AlertTriangle,
  GitCompare,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight
} from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import { fetchTrends, connectWeatherWebSocket } from '../services/weatherApi';

const POPULAR_CITIES = [
  'Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'Chennai',
  'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Goa',
  'Srinagar', 'Guwahati', 'Kochi', 'Lucknow'
];

// SVG Chart Dimension Constants
const SVG_WIDTH = 700;
const SVG_HEIGHT = 220;
const PADDING = { top: 25, right: 30, bottom: 35, left: 45 };

// Pure helper function for smooth bezier curve generation
function generateChartPath(values, minVal, maxVal) {
  if (!values || values.length === 0) return { path: '', area: '', points: [] };
  const chartW = SVG_WIDTH - PADDING.left - PADDING.right;
  const chartH = SVG_HEIGHT - PADDING.top - PADDING.bottom;
  const range = (maxVal - minVal) || 1;

  const points = values.map((val, idx) => {
    const x = PADDING.left + (idx / (values.length - 1 || 1)) * chartW;
    const normalizedY = (val - minVal) / range;
    const y = PADDING.top + chartH - normalizedY * chartH;
    return { x, y, val };
  });

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 2;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (p1.x - p0.x) / 2;
    const cpY2 = p1.y;
    path += ` C ${cpX1},${cpY1} ${cpX2},${cpY2} ${p1.x},${p1.y}`;
  }

  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;
  const bottomY = PADDING.top + chartH;
  const area = `${path} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

  return { path, area, points };
}

// Helper to render wind direction icon
function renderWindDirectionIcon(dir) {
  const d = (dir || 'W').toUpperCase();
  if (d.includes('N') && d.includes('E')) return <ArrowUpRight size={13} />;
  if (d.includes('N') && d.includes('W')) return <ArrowUpLeft size={13} />;
  if (d.includes('S') && d.includes('E')) return <ArrowDownRight size={13} />;
  if (d.includes('S') && d.includes('W')) return <ArrowDownLeft size={13} />;
  if (d.includes('N')) return <ArrowUp size={13} />;
  if (d.includes('S')) return <ArrowDown size={13} />;
  if (d.includes('E')) return <ArrowRight size={13} />;
  return <ArrowLeft size={13} />;
}

export function TrendsPage() {
  const { currentCity, weatherData, loadCityWeather, unit } = useWeather();
  const [searchParams, setSearchParams] = useSearchParams();

  const cityParam = searchParams.get('city') || currentCity || 'Pune';
  const rangeParam = searchParams.get('range') || '24h';
  const compareParam = searchParams.get('compare') || '';

  const [activeRange, setActiveRange] = useState(rangeParam);
  const [trendsData, setTrendsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(Boolean(compareParam));
  const [compareCity, setCompareCity] = useState(compareParam);

  // Tooltip interaction states
  const [hoveredTempIdx, setHoveredTempIdx] = useState(null);
  const [hoveredRainIdx, setHoveredRainIdx] = useState(null);
  const [hoveredHumidityIdx, setHoveredHumidityIdx] = useState(null);
  const [hoveredWindIdx, setHoveredWindIdx] = useState(null);
  const [hoveredPressureIdx, setHoveredPressureIdx] = useState(null);

  // Unit conversion helpers
  const displayTemp = useCallback((tempC) => {
    if (tempC === null || tempC === undefined) return '--';
    if (unit === 'F') {
      return `${Math.round((tempC * 9) / 5 + 32)}°F`;
    }
    return `${Math.round(tempC)}°C`;
  }, [unit]);

  const displaySpeed = useCallback((kmh) => {
    if (kmh === null || kmh === undefined) return '--';
    if (unit === 'F') {
      return `${Math.round(kmh * 0.621371)} mph`;
    }
    return `${Math.round(kmh)} km/h`;
  }, [unit]);

  // Load trends from PostgreSQL via backend API
  const loadTrends = useCallback(async (city, range, compare = null) => {
    if (!city) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchTrends(city, range, compare);
      setTrendsData(data);
    } catch (err) {
      console.warn('Trends fetch warning:', err);
      setErrorMsg(`Unable to load trends data for ${city}. Please verify backend connection.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync range & compare params from URL
  useEffect(() => {
    if (rangeParam && rangeParam !== activeRange) {
      setActiveRange(rangeParam);
    }
  }, [rangeParam, activeRange]);

  useEffect(() => {
    if (compareParam !== compareCity) {
      setCompareCity(compareParam);
      setIsCompareOpen(Boolean(compareParam));
    }
  }, [compareParam, compareCity]);

  // Load data when city or range changes
  useEffect(() => {
    loadTrends(cityParam, activeRange, compareCity);
    if (loadCityWeather && (!currentCity || currentCity.toLowerCase() !== cityParam.toLowerCase())) {
      loadCityWeather(cityParam);
    }
  }, [cityParam, activeRange, compareCity, currentCity, loadCityWeather, loadTrends]);

  // Real-time WebSocket connection
  useEffect(() => {
    const ws = connectWeatherWebSocket((wsData) => {
      if (wsData && wsData.type === 'WEATHER_UPDATE') {
        loadTrends(cityParam, activeRange, compareCity);
      }
    }, cityParam);

    return () => {
      if (ws && typeof ws.close === 'function') {
        ws.close();
      }
    };
  }, [cityParam, activeRange, compareCity, loadTrends]);

  const handleCitySelect = (city) => {
    setIsCityDropdownOpen(false);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('city', city);
    setSearchParams(newParams);
  };

  const handleRangeChange = (range) => {
    setActiveRange(range);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('range', range);
    setSearchParams(newParams);
  };

  const handleCompareSelect = (city) => {
    setCompareCity(city);
    const newParams = new URLSearchParams(searchParams);
    if (city) {
      newParams.set('compare', city);
    } else {
      newParams.delete('compare');
    }
    setSearchParams(newParams);
  };

  const toggleCompareMode = () => {
    if (isCompareOpen) {
      setIsCompareOpen(false);
      handleCompareSelect('');
    } else {
      setIsCompareOpen(true);
      const defaultCompare = cityParam.toLowerCase() === 'pune' ? 'Mumbai' : 'Pune';
      handleCompareSelect(defaultCompare);
    }
  };

  const observations = useMemo(() => trendsData?.observations || [], [trendsData]);
  const hasData = trendsData && trendsData.status === 'ready' && observations.length >= 2;

  // Temperature chart data
  const tempChartData = useMemo(() => {
    if (!hasData) return null;
    const vals = observations.map(o => o.temperature);
    const min = Math.floor(Math.min(...vals) - 1);
    const max = Math.ceil(Math.max(...vals) + 1);
    return { ...generateChartPath(vals, min, max), min, max, vals };
  }, [hasData, observations]);

  // Rainfall chart data
  const rainChartData = useMemo(() => {
    if (!hasData) return null;
    const precips = observations.map(o => o.precipitation);
    const probs = observations.map(o => o.rainProbability);
    const maxPrecip = Math.max(1.0, Math.ceil(Math.max(...precips) * 1.2));
    return {
      precips,
      probs,
      maxPrecip,
      probPath: generateChartPath(probs, 0, 100)
    };
  }, [hasData, observations]);

  // Humidity chart data
  const humidityChartData = useMemo(() => {
    if (!hasData) return null;
    const vals = observations.map(o => o.humidity);
    const min = Math.max(0, Math.floor(Math.min(...vals) - 5));
    const max = Math.min(100, Math.ceil(Math.max(...vals) + 5));
    return { ...generateChartPath(vals, min, max), min, max, vals };
  }, [hasData, observations]);

  // Wind chart data
  const windChartData = useMemo(() => {
    if (!hasData) return null;
    const vals = observations.map(o => o.windSpeed);
    const min = Math.max(0, Math.floor(Math.min(...vals) - 2));
    const max = Math.ceil(Math.max(...vals) + 4);
    return { ...generateChartPath(vals, min, max), min, max, vals };
  }, [hasData, observations]);

  // Pressure chart data
  const pressureChartData = useMemo(() => {
    if (!hasData) return null;
    const vals = observations.map(o => o.pressure);
    const min = Math.floor(Math.min(...vals) - 2);
    const max = Math.ceil(Math.max(...vals) + 2);
    return { ...generateChartPath(vals, min, max), min, max, vals };
  }, [hasData, observations]);

  const displayLocation = trendsData?.displayLocation || cityParam || 'Pune, Maharashtra, India';

  return (
    <div className="trends-page-root animate-fade-in">
      {/* 1. Header & Source Pills */}
      <section className="trends-header-section">
        <div className="trends-title-group">
          <h1 className="trends-main-title">Climate Trends</h1>
          <p className="trends-main-subtitle">
            Explore recent weather observations, patterns, and Skycast risk history.
          </p>
        </div>

        <div className="trends-source-pills-row">
          <span className="trends-source-pill source-nwp">
            Source: NOAA GFS (Global Forecast System)
          </span>
          <span className="trends-source-pill source-updated">
            Data Updated: Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </section>

      {/* 2. Controls Row: Location Selector, Range Pills, Compare Button */}
      <section className="trends-controls-bar">
        {/* City Dropdown Button */}
        <div className="trends-city-picker-wrapper">
          <button
            type="button"
            className="trends-city-picker-btn"
            onClick={() => setIsCityDropdownOpen(prev => !prev)}
            aria-label="Select city for trends"
          >
            <MapPin size={15} fill="#EF4444" stroke="#EF4444" className="city-pin-icon" />
            <span className="city-picker-name">{displayLocation}</span>
            <ChevronDown size={14} className={`city-arrow-icon ${isCityDropdownOpen ? 'open' : ''}`} />
          </button>

          {isCityDropdownOpen && (
            <div className="trends-city-dropdown-menu">
              <div className="city-dropdown-title">Select Location</div>
              <div className="city-dropdown-grid">
                {POPULAR_CITIES.map(city => (
                  <button
                    key={city}
                    type="button"
                    className={`city-dropdown-option ${city.toLowerCase() === cityParam.toLowerCase() ? 'active' : ''}`}
                    onClick={() => handleCitySelect(city)}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Time Range Segmented Buttons */}
        <div className="trends-range-segmented" role="tablist" aria-label="Time range selector">
          <button
            type="button"
            className={`range-segment-btn ${activeRange === '24h' ? 'active' : ''}`}
            onClick={() => handleRangeChange('24h')}
          >
            24 Hours
          </button>
          <button
            type="button"
            className={`range-segment-btn ${activeRange === '7d' ? 'active' : ''}`}
            onClick={() => handleRangeChange('7d')}
          >
            7 Days
          </button>
          <button
            type="button"
            className={`range-segment-btn ${activeRange === '30d' ? 'active' : ''}`}
            onClick={() => handleRangeChange('30d')}
          >
            30 Days
          </button>
        </div>

        {/* Compare Locations Toggle Button */}
        <button
          type="button"
          className={`trends-compare-btn ${isCompareOpen ? 'active' : ''}`}
          onClick={toggleCompareMode}
          title="Compare weather history across cities"
        >
          <GitCompare size={15} />
          <span>Compare Locations</span>
        </button>
      </section>

      {/* Compare Mode Chips Bar (when active) */}
      {isCompareOpen && (
        <section className="trends-compare-chips-bar animate-fade-in">
          <span className="compare-chips-label">Compare {cityParam} with:</span>
          <div className="compare-chips-list">
            {POPULAR_CITIES.filter(c => c.toLowerCase() !== cityParam.toLowerCase()).slice(0, 8).map(c => (
              <button
                key={c}
                type="button"
                className={`compare-city-chip ${compareCity.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                onClick={() => handleCompareSelect(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3. Skycast Weather Risk Transparency Banner */}
      <section className="trends-risk-notice-banner">
        <div className="risk-notice-left">
          <div className="risk-notice-icon-wrap">
            <Info size={16} className="text-blue-500" />
          </div>
          <p className="risk-notice-text">
            <strong>Skycast Weather Risk:</strong> Rules based on published IMD warning criteria/framework. Skycast assessments are derived meteorological evaluations and not official government warnings.
          </p>
        </div>

        <div className="risk-notice-badge">
          <span className="risk-badge-dot-pulse green" />
          <span className="risk-badge-label">GREEN — No Action</span>
        </div>
      </section>

      {/* 4. Main Body: Loading / Error / Analytics */}
      {isLoading && (
        <div className="trends-status-card loading">
          <RefreshCw size={28} className="animate-spin text-blue-500" />
          <p>Retrieving real weather observations and climate patterns...</p>
        </div>
      )}

      {errorMsg && !isLoading && (
        <div className="trends-status-card error">
          <AlertTriangle size={24} className="text-amber-500" />
          <p>{errorMsg}</p>
          <button
            type="button"
            className="trends-retry-btn"
            onClick={() => loadTrends(cityParam, activeRange, compareCity)}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !errorMsg && !hasData && (
        <div className="trends-no-data-card animate-fade-in">
          <div className="no-data-icon-box">
            <Clock size={36} className="text-blue-500" />
          </div>
          <h2 className="no-data-heading">Not enough historical data yet.</h2>
          <p className="no-data-sub">
            Skycast began archiving real weather observations recently. More data will populate as observations accumulate.
          </p>
          <div className="no-data-meta-grid">
            <div className="meta-box">
              <span className="meta-title">Location:</span>
              <span className="meta-value">{displayLocation}</span>
            </div>
            <div className="meta-box">
              <span className="meta-title">Selected Range:</span>
              <span className="meta-value">{trendsData?.rangeLabel || 'Past 24 Hours'}</span>
            </div>
            <div className="meta-box">
              <span className="meta-title">Stored Snapshots:</span>
              <span className="meta-value">{trendsData?.count || 0} observations</span>
            </div>
            <div className="meta-box">
              <span className="meta-title">History Database:</span>
              <span className="meta-value text-emerald-600">PostgreSQL (Connected)</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Complete Analytics Charts & Visuals Grid */}
      {!isLoading && !errorMsg && hasData && (
        <div className="trends-visuals-container animate-fade-in">
          {/* TOP ROW: 2 CHARTS (Temperature Trend + Rainfall & Precipitation) */}
          <div className="trends-grid-top-2">
            {/* Chart 1: Temperature Trend */}
            <div className="stitch-card trends-v2-chart-card">
              <div className="chart-v2-header">
                <div className="chart-v2-title-group">
                  <div className="chart-v2-icon-wrap temp-icon">
                    <Thermometer size={18} className="text-orange-500" />
                  </div>
                  <div>
                    <h2 className="chart-v2-title">Temperature Trend</h2>
                    <span className="chart-v2-subtitle">Real observed ambient surface temperature</span>
                  </div>
                </div>

                <div className="chart-v2-stats-pills">
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Current</span>
                    <span className="stat-v2-val">{displayTemp(trendsData.temperature?.current)}</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Average</span>
                    <span className="stat-v2-val">{displayTemp(trendsData.temperature?.avg)}</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Min</span>
                    <span className="stat-v2-val">{displayTemp(trendsData.temperature?.min)}</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Max</span>
                    <span className="stat-v2-val">{displayTemp(trendsData.temperature?.max)}</span>
                  </div>
                </div>
              </div>

              {/* Temperature SVG Line Chart */}
              <div className="trends-svg-wrap">
                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="trends-svg-canvas">
                  <defs>
                    <linearGradient id="tempCurveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#F97316" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = PADDING.top + (SVG_HEIGHT - PADDING.top - PADDING.bottom) * pct;
                    const val = Math.round(tempChartData.max - pct * (tempChartData.max - tempChartData.min));
                    return (
                      <g key={pct}>
                        <line
                          x1={PADDING.left}
                          y1={y}
                          x2={SVG_WIDTH - PADDING.right}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeDasharray="4 4"
                        />
                        <text x={PADDING.left - 10} y={y + 4} fill="#94A3B8" fontSize="11" textAnchor="end">
                          {displayTemp(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Gradient Area Fill */}
                  <path d={tempChartData.area} fill="url(#tempCurveGradient)" />

                  {/* Spline Line */}
                  <path
                    d={tempChartData.path}
                    fill="none"
                    stroke="#F97316"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* Data Node Points */}
                  {tempChartData.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredTempIdx === idx ? 6 : 4}
                      fill="#F97316"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredTempIdx(idx)}
                      onMouseLeave={() => setHoveredTempIdx(null)}
                    />
                  ))}
                </svg>

                {/* X Axis Time Labels */}
                <div className="trends-xaxis-labels">
                  {observations.map((obs, idx) => (
                    <span key={idx} className="xaxis-label">
                      {obs.timeLabel}
                    </span>
                  ))}
                </div>

                {/* Hover Tooltip */}
                {hoveredTempIdx !== null && observations[hoveredTempIdx] && (
                  <div
                    className="trends-chart-tooltip"
                    style={{
                      left: `${(tempChartData.points[hoveredTempIdx].x / SVG_WIDTH) * 100}%`,
                      top: '15%'
                    }}
                  >
                    <div className="tooltip-time">{observations[hoveredTempIdx].timeLabel}</div>
                    <div className="tooltip-main">{displayTemp(observations[hoveredTempIdx].temperature)}</div>
                    <div className="tooltip-sub">Feels like: {displayTemp(observations[hoveredTempIdx].feelsLike)}</div>
                    <div className="tooltip-cond">{observations[hoveredTempIdx].condition}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Rainfall & Precipitation */}
            <div className="stitch-card trends-v2-chart-card">
              <div className="chart-v2-header">
                <div className="chart-v2-title-group">
                  <div className="chart-v2-icon-wrap rain-icon">
                    <CloudRain size={18} className="text-blue-500" />
                  </div>
                  <div>
                    <h2 className="chart-v2-title">Rainfall & Precipitation</h2>
                    <span className="chart-v2-subtitle">Observed rainfall (mm) & forecast probability (%)</span>
                  </div>
                </div>

                <div className="chart-v2-stats-pills">
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Total Rainfall</span>
                    <span className="stat-v2-val">{trendsData.rainfall?.total} mm</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Average</span>
                    <span className="stat-v2-val">{trendsData.rainfall?.avg} mm</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Max Period</span>
                    <span className="stat-v2-val">{trendsData.rainfall?.maxPeriod} mm</span>
                  </div>
                </div>
              </div>

              {/* Rain Legend */}
              <div className="trends-chart-legend-row">
                <div className="legend-entry">
                  <span className="legend-line purple-dashed" />
                  <span>Rain Probability (%)</span>
                </div>
                <div className="legend-entry">
                  <span className="legend-line blue-solid" />
                  <span>Precipitation (mm)</span>
                </div>
              </div>

              {/* Rainfall SVG Canvas */}
              <div className="trends-svg-wrap">
                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="trends-svg-canvas">
                  {/* Left (Probability %) & Right (Precipitation mm) Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = PADDING.top + (SVG_HEIGHT - PADDING.top - PADDING.bottom) * pct;
                    const probVal = Math.round(100 - pct * 100);
                    const mmVal = (rainChartData.maxPrecip * (1 - pct)).toFixed(1);
                    return (
                      <g key={pct}>
                        <line
                          x1={PADDING.left}
                          y1={y}
                          x2={SVG_WIDTH - PADDING.right}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeDasharray="4 4"
                        />
                        <text x={PADDING.left - 10} y={y + 4} fill="#8B5CF6" fontSize="11" textAnchor="end">
                          {probVal}%
                        </text>
                        <text x={SVG_WIDTH - PADDING.right + 10} y={y + 4} fill="#0284C7" fontSize="11" textAnchor="start">
                          {mmVal} mm
                        </text>
                      </g>
                    );
                  })}

                  {/* Precipitation Bars */}
                  {observations.map((obs, idx) => {
                    const chartW = SVG_WIDTH - PADDING.left - PADDING.right;
                    const chartH = SVG_HEIGHT - PADDING.top - PADDING.bottom;
                    const barW = Math.max(8, (chartW / observations.length) * 0.5);
                    const cx = PADDING.left + (idx / (observations.length - 1 || 1)) * chartW;
                    const barH = (obs.precipitation / rainChartData.maxPrecip) * chartH;
                    const y = PADDING.top + chartH - barH;

                    return (
                      <rect
                        key={idx}
                        x={cx - barW / 2}
                        y={y}
                        width={barW}
                        height={Math.max(3, barH)}
                        rx="3"
                        fill={obs.precipitation > 0 ? '#38BDF8' : '#BAE6FD'}
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredRainIdx(idx)}
                        onMouseLeave={() => setHoveredRainIdx(null)}
                      />
                    );
                  })}

                  {/* Rain Probability Dashed Spline */}
                  <path
                    d={rainChartData.probPath.path}
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                </svg>

                {/* X Axis Time Labels */}
                <div className="trends-xaxis-labels">
                  {observations.map((obs, idx) => (
                    <span key={idx} className="xaxis-label">
                      {obs.timeLabel}
                    </span>
                  ))}
                </div>

                {/* Hover Tooltip */}
                {hoveredRainIdx !== null && observations[hoveredRainIdx] && (
                  <div
                    className="trends-chart-tooltip"
                    style={{
                      left: `${((PADDING.left + (hoveredRainIdx / (observations.length - 1 || 1)) * (SVG_WIDTH - PADDING.left - PADDING.right)) / SVG_WIDTH) * 100}%`,
                      top: '15%'
                    }}
                  >
                    <div className="tooltip-time">{observations[hoveredRainIdx].timeLabel}</div>
                    <div className="tooltip-main">{observations[hoveredRainIdx].precipitation} mm</div>
                    <div className="tooltip-sub">Rain Chance: {observations[hoveredRainIdx].rainProbability}%</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MIDDLE ROW: 3 CARDS (Humidity, Wind Speed & Direction, Pressure) */}
          <div className="trends-grid-mid-3">
            {/* 1. Relative Humidity */}
            <div className="stitch-card trends-v2-chart-card compact">
              <div className="chart-v2-header">
                <div className="chart-v2-title-group">
                  <div className="chart-v2-icon-wrap humidity-icon">
                    <Droplets size={17} className="text-cyan-500" />
                  </div>
                  <div>
                    <h2 className="chart-v2-title">Relative Humidity</h2>
                    <span className="chart-v2-subtitle">Moisture saturation trend</span>
                  </div>
                </div>

                <div className="chart-v2-stats-pills compact">
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Avg</span>
                    <span className="stat-v2-val">{trendsData.humidity?.avg}%</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Max</span>
                    <span className="stat-v2-val">{trendsData.humidity?.max}%</span>
                  </div>
                </div>
              </div>

              <div className="trends-svg-wrap compact">
                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="trends-svg-canvas">
                  <defs>
                    <linearGradient id="humidityCurveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={humidityChartData.area} fill="url(#humidityCurveGradient)" />
                  <path d={humidityChartData.path} fill="none" stroke="#06B6D4" strokeWidth="2.5" />
                  {humidityChartData.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredHumidityIdx === idx ? 5 : 3.5}
                      fill="#06B6D4"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredHumidityIdx(idx)}
                      onMouseLeave={() => setHoveredHumidityIdx(null)}
                    />
                  ))}
                </svg>

                <div className="trends-xaxis-labels compact">
                  {observations.filter((_, i) => i % 2 === 0).map((obs, idx) => (
                    <span key={idx} className="xaxis-label">{obs.timeLabel}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Wind Speed & Direction */}
            <div className="stitch-card trends-v2-chart-card compact">
              <div className="chart-v2-header">
                <div className="chart-v2-title-group">
                  <div className="chart-v2-icon-wrap wind-icon">
                    <Wind size={17} className="text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="chart-v2-title">Wind Speed & Direction</h2>
                    <span className="chart-v2-subtitle">Dominant: {trendsData.wind?.dominantDirection || 'W'}</span>
                  </div>
                </div>

                <div className="chart-v2-stats-pills compact">
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Avg</span>
                    <span className="stat-v2-val">{displaySpeed(trendsData.wind?.avg)}</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Peak</span>
                    <span className="stat-v2-val">{displaySpeed(trendsData.wind?.max)}</span>
                  </div>
                </div>
              </div>

              <div className="trends-svg-wrap compact">
                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="trends-svg-canvas">
                  <defs>
                    <linearGradient id="windCurveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={windChartData.area} fill="url(#windCurveGradient)" />
                  <path d={windChartData.path} fill="none" stroke="#10B981" strokeWidth="2.5" />
                  {windChartData.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredWindIdx === idx ? 5 : 3.5}
                      fill="#10B981"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredWindIdx(idx)}
                      onMouseLeave={() => setHoveredWindIdx(null)}
                    />
                  ))}
                </svg>

                {/* Wind Compass Direction Arrows Row */}
                <div className="trends-wind-direction-row">
                  {observations.filter((_, i) => i % 2 === 0).map((obs, idx) => (
                    <div key={idx} className="wind-dir-item">
                      <span className="wind-arrow-icon">{renderWindDirectionIcon(obs.windDirection)}</span>
                      <span className="wind-dir-text">{obs.windDirection || 'W'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Atmospheric Pressure */}
            <div className="stitch-card trends-v2-chart-card compact">
              <div className="chart-v2-header">
                <div className="chart-v2-title-group">
                  <div className="chart-v2-icon-wrap pressure-icon">
                    <Gauge size={17} className="text-purple-500" />
                  </div>
                  <div>
                    <h2 className="chart-v2-title">Atmospheric Pressure</h2>
                    <span className="chart-v2-subtitle">Barometric surface trend (hPa)</span>
                  </div>
                </div>

                <div className="chart-v2-stats-pills compact">
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Current</span>
                    <span className="stat-v2-val">{trendsData.pressure?.current} hPa</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Avg</span>
                    <span className="stat-v2-val">{trendsData.pressure?.avg} hPa</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Min</span>
                    <span className="stat-v2-val">{trendsData.pressure?.min} hPa</span>
                  </div>
                  <div className="stat-v2-pill">
                    <span className="stat-v2-label">Max</span>
                    <span className="stat-v2-val">{trendsData.pressure?.max} hPa</span>
                  </div>
                </div>
              </div>

              <div className="trends-svg-wrap compact">
                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="trends-svg-canvas">
                  <defs>
                    <linearGradient id="pressureCurveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={pressureChartData.area} fill="url(#pressureCurveGradient)" />
                  <path d={pressureChartData.path} fill="none" stroke="#8B5CF6" strokeWidth="2.5" />
                  {pressureChartData.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPressureIdx === idx ? 5 : 3.5}
                      fill="#8B5CF6"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredPressureIdx(idx)}
                      onMouseLeave={() => setHoveredPressureIdx(null)}
                    />
                  ))}
                </svg>

                <div className="trends-xaxis-labels compact">
                  {observations.filter((_, i) => i % 2 === 0).map((obs, idx) => (
                    <span key={idx} className="xaxis-label">{obs.timeLabel}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 6. SKYCAST RISK HISTORY TIMELINE */}
          <div className="stitch-card trends-risk-history-card">
            <div className="chart-v2-header">
              <div className="chart-v2-title-group">
                <div className="chart-v2-icon-wrap risk-icon">
                  <ShieldAlert size={18} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="chart-v2-title">Skycast Risk History Timeline</h2>
                  <span className="chart-v2-subtitle">Observed derived risk state transitions (PostgreSQL archive)</span>
                </div>
              </div>
            </div>

            <div className="trends-timeline-body">
              {trendsData.riskHistory && trendsData.riskHistory.length > 0 ? (
                <div className="trends-timeline-list">
                  {trendsData.riskHistory.map((item, idx) => (
                    <div key={idx} className={`timeline-entry-row risk-${item.riskLevel.toLowerCase()}`}>
                      <div className="timeline-node-track">
                        <span className="timeline-node-dot" />
                        {idx < trendsData.riskHistory.length - 1 && <span className="timeline-node-line" />}
                      </div>

                      <div className="timeline-entry-card">
                        <div className="timeline-card-header">
                          <span className={`timeline-risk-badge badge-${item.riskLevel.toLowerCase()}`}>
                            {item.riskLevel.toUpperCase()} — {item.actionDirective}
                          </span>
                          <span className="timeline-card-time">{item.timeLabel}</span>
                        </div>
                        <h3 className="timeline-hazard-title">{item.highestRisk.replace(/_/g, ' ').toUpperCase()}</h3>
                        <p className="timeline-hazard-desc">
                          Hazards: {item.activeHazards || 'none'}
                        </p>
                        <div className="timeline-footer-meta">
                          <span>Temperature at observation: {displayTemp(item.temperature)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="trends-timeline-empty">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                  <p>Conditions have remained within normal thresholds (Green) throughout this observation period.</p>
                </div>
              )}
            </div>

            <div className="trends-timeline-footnote">
              <Info size={14} className="text-slate-400" />
              <span>Skycast risk levels are derived assessments based on published IMD criteria/framework. They are not official IMD warnings.</span>
            </div>
          </div>

          {/* 7. FORECAST VS RECENT OBSERVED WEATHER COMPARISON */}
          {trendsData.forecastVsObserved && (
            <div className="stitch-card trends-fvo-card">
              <div className="chart-v2-header">
                <div className="chart-v2-title-group">
                  <div className="chart-v2-icon-wrap layers-icon">
                    <Layers size={18} className="text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="chart-v2-title">Forecast vs Recent Observed Weather</h2>
                    <span className="chart-v2-subtitle">Separately distinguished real observations vs current prediction</span>
                  </div>
                </div>
              </div>

              <div className="trends-fvo-grid">
                {/* Left: Observed Data */}
                <div className="fvo-column observed-col">
                  <div className="fvo-col-header">OBSERVED DATA (DATABASE)</div>
                  <div className="fvo-row">
                    <span className="fvo-label">Recorded Temperature</span>
                    <span className="fvo-val">{displayTemp(trendsData.forecastVsObserved.observed?.temperature)}</span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Humidity</span>
                    <span className="fvo-val">{trendsData.forecastVsObserved.observed?.humidity}%</span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Observed Rainfall</span>
                    <span className="fvo-val">{trendsData.forecastVsObserved.observed?.precipitation} mm</span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Observed Wind</span>
                    <span className="fvo-val">{displaySpeed(trendsData.forecastVsObserved.observed?.windSpeed)}</span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Condition</span>
                    <span className="fvo-val fvo-cond-badge">{trendsData.forecastVsObserved.observed?.condition}</span>
                  </div>
                </div>

                {/* Center: VS Badge */}
                <div className="fvo-vs-badge-wrap">
                  <span className="fvo-vs-pill">VS</span>
                </div>

                {/* Right: Current Forecast */}
                <div className="fvo-column forecast-col">
                  <div className="fvo-col-header">CURRENT FORECAST (OPEN-METEO)</div>
                  <div className="fvo-row">
                    <span className="fvo-label">Forecast High / Low</span>
                    <span className="fvo-val">
                      {displayTemp(trendsData.forecastVsObserved.forecast?.highTemp)} / {displayTemp(trendsData.forecastVsObserved.forecast?.lowTemp)}
                    </span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Precipitation Chance</span>
                    <span className="fvo-val">{trendsData.forecastVsObserved.forecast?.precipitationChance}%</span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Expected Rain</span>
                    <span className="fvo-val">{trendsData.forecastVsObserved.forecast?.expectedRain} mm</span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Peak Forecast Wind</span>
                    <span className="fvo-val">{displaySpeed(trendsData.forecastVsObserved.forecast?.peakWind)}</span>
                  </div>
                  <div className="fvo-row">
                    <span className="fvo-label">Expected Condition</span>
                    <span className="fvo-val fvo-cond-badge">{trendsData.forecastVsObserved.forecast?.expectedCondition}</span>
                  </div>
                </div>
              </div>

              <div className="trends-fvo-footnote">
                <Info size={14} className="text-slate-400" />
                <span>Comparison presents recent real observations alongside the current numerical weather prediction. Historical forecast verification will be available once forecast archive snapshots accumulate.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrendsPage;
