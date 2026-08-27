import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Clock,
  Calendar,
  CloudRain,
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  ShieldAlert,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Sparkles,
  MapPin,
  RefreshCw,
  Layers,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Snowflake,
  ExternalLink,
  GitCompare
} from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import { fetchTrends, connectWeatherWebSocket } from '../services/weatherApi';

const POPULAR_CITIES = [
  'Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'Chennai',
  'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Goa',
  'Srinagar', 'Guwahati', 'Kochi', 'Lucknow'
];

export function TrendsPage() {
  const { currentCity, weatherData, loadCityWeather, unit } = useWeather();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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

  // Hover state for interactive chart tooltips
  const [hoveredTempIdx, setHoveredTempIdx] = useState(null);
  const [hoveredRainIdx, setHoveredRainIdx] = useState(null);
  const [hoveredHumidityIdx, setHoveredHumidityIdx] = useState(null);
  const [hoveredWindIdx, setHoveredWindIdx] = useState(null);
  const [hoveredPressureIdx, setHoveredPressureIdx] = useState(null);

  // Unit conversion helpers
  const displayTemp = (tempC) => {
    if (tempC === null || tempC === undefined) return '--';
    if (unit === 'F') {
      return `${Math.round((tempC * 9) / 5 + 32)}°F`;
    }
    return `${Math.round(tempC)}°C`;
  };

  const displaySpeed = (kmh) => {
    if (kmh === null || kmh === undefined) return '--';
    if (unit === 'F') {
      return `${Math.round(kmh * 0.621371)} mph`;
    }
    return `${Math.round(kmh)} km/h`;
  };

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

  // Sync range & compare params from URL when they change
  useEffect(() => {
    if (rangeParam && rangeParam !== activeRange) {
      setActiveRange(rangeParam);
    }
  }, [rangeParam]);

  useEffect(() => {
    if (compareParam !== compareCity) {
      setCompareCity(compareParam);
      setIsCompareOpen(Boolean(compareParam));
    }
  }, [compareParam]);

  // Sync state with URL params
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
        // Silently reload trends when new observation snapshot arrives
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

  const observations = trendsData?.observations || [];
  const hasData = trendsData && trendsData.status === 'ready' && observations.length >= 2;

  // Chart rendering helpers
  const svgWidth = 700;
  const svgHeight = 220;
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };

  // Calculate SVG polyline / path coordinates
  const generateChartPath = (values, minVal, maxVal) => {
    if (!values || values.length === 0) return { path: '', area: '', points: [] };
    const chartW = svgWidth - padding.left - padding.right;
    const chartH = svgHeight - padding.top - padding.bottom;
    const range = (maxVal - minVal) || 1;

    const points = values.map((val, idx) => {
      const x = padding.left + (idx / (values.length - 1 || 1)) * chartW;
      const normalizedY = (val - minVal) / range;
      const y = padding.top + chartH - normalizedY * chartH;
      return { x, y, val };
    });

    // Smooth bezier curve generator
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
    const bottomY = padding.top + chartH;
    const area = `${path} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

    return { path, area, points };
  };

  // Temperature chart data
  const tempChartData = useMemo(() => {
    if (!hasData) return null;
    const vals = observations.map(o => o.temperature);
    const min = Math.floor(Math.min(...vals) - 1);
    const max = Math.ceil(Math.max(...vals) + 1);
    return { ...generateChartPath(vals, min, max), min, max, vals };
  }, [hasData, observations]);

  // Rainfall chart data (precipitation mm bars + rain probability line)
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

  return (
    <div className="trends-page-root">
      {/* 1. Header & Official Framework Banner */}
      <section className="trends-header-section">
        <div className="trends-header-content">
          <div className="trends-brand-pill">
            <span className="brand-dot" />
            <span>SKYCAST REAL WEATHER OBSERVATIONS</span>
            <span className="brand-divider">•</span>
            <span>POSTGRESQL HISTORY STORE</span>
          </div>

          <h1 className="trends-title">Weather Trends</h1>
          <p className="trends-subtitle">
            Explore recent weather observations and Skycast risk history.
          </p>

          <div className="trends-transparency-card">
            <Info size={16} className="transparency-icon" />
            <p className="transparency-text">
              <strong>Skycast Weather Risk:</strong> Rules based on published IMD warning criteria/framework. Skycast assessments are derived meteorological evaluations and not official government warnings.
            </p>
          </div>
        </div>

        {/* 2. Control Bar: Location, Range, Compare */}
        <div className="trends-control-bar">
          {/* City Selector Dropdown */}
          <div className="trends-city-selector-wrapper">
            <button
              type="button"
              className="trends-city-btn"
              onClick={() => setIsCityDropdownOpen(prev => !prev)}
            >
              <MapPin size={18} className="city-pin-icon" />
              <span className="city-btn-name">{trendsData?.displayLocation || cityParam}</span>
              <ChevronDown size={16} className={`city-arrow ${isCityDropdownOpen ? 'open' : ''}`} />
            </button>

            {isCityDropdownOpen && (
              <div className="trends-city-menu">
                <div className="trends-city-menu-header">Select Location</div>
                <div className="trends-city-grid">
                  {POPULAR_CITIES.map(city => (
                    <button
                      key={city}
                      type="button"
                      className={`trends-city-option ${city.toLowerCase() === cityParam.toLowerCase() ? 'active' : ''}`}
                      onClick={() => handleCitySelect(city)}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="trends-range-selector" role="tablist" aria-label="Trends Time Range">
            <button
              type="button"
              className={`range-tab-btn ${activeRange === '24h' ? 'active' : ''}`}
              onClick={() => handleRangeChange('24h')}
            >
              24 Hours
            </button>
            <button
              type="button"
              className={`range-tab-btn ${activeRange === '7d' ? 'active' : ''}`}
              onClick={() => handleRangeChange('7d')}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`range-tab-btn ${activeRange === '30d' ? 'active' : ''}`}
              onClick={() => handleRangeChange('30d')}
            >
              30 Days
            </button>
          </div>

          {/* Compare Mode Toggle */}
          <button
            type="button"
            className={`trends-compare-toggle-btn ${isCompareOpen ? 'active' : ''}`}
            onClick={toggleCompareMode}
          >
            <GitCompare size={16} />
            <span>{isCompareOpen ? 'Comparing Locations' : 'Compare Locations'}</span>
          </button>
        </div>

        {/* Compare City Selector Bar when active */}
        {isCompareOpen && (
          <div className="trends-compare-bar animate-fade-in">
            <span className="compare-label">Compare {cityParam} with:</span>
            <div className="compare-chips">
              {POPULAR_CITIES.filter(c => c.toLowerCase() !== cityParam.toLowerCase()).slice(0, 7).map(c => (
                <button
                  key={c}
                  type="button"
                  className={`compare-chip ${compareCity.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                  onClick={() => handleCompareSelect(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. Main Dashboard Body */}
      <div className="trends-body-container">
        {/* Loading State */}
        {isLoading && (
          <div className="trends-loading-state">
            <RefreshCw size={32} className="animate-spin text-blue-400" />
            <p>Retrieving real weather observations from PostgreSQL...</p>
          </div>
        )}

        {/* Error State */}
        {errorMsg && !isLoading && (
          <div className="trends-error-state">
            <AlertTriangle size={24} className="text-amber-400" />
            <p>{errorMsg}</p>
            <button type="button" className="retry-btn" onClick={() => loadTrends(cityParam, activeRange, compareCity)}>
              Retry
            </button>
          </div>
        )}

        {/* Insufficient Data State */}
        {!isLoading && !errorMsg && !hasData && (
          <div className="trends-no-data-card animate-fade-in">
            <div className="no-data-icon-wrap">
              <Clock size={40} className="text-blue-400" />
            </div>
            <h2 className="no-data-title">Not enough historical data yet.</h2>
            <p className="no-data-desc">
              Skycast started collecting weather history recently. More data will appear as observations accumulate.
            </p>
            <div className="no-data-meta-box">
              <div className="meta-point">
                <span className="meta-label">Selected Location:</span>
                <span className="meta-val">{trendsData?.displayLocation || cityParam}</span>
              </div>
              <div className="meta-point">
                <span className="meta-label">Selected Range:</span>
                <span className="meta-val">{trendsData?.rangeLabel || 'Past 24 Hours'}</span>
              </div>
              <div className="meta-point">
                <span className="meta-label">Stored Snapshots:</span>
                <span className="meta-val">{trendsData?.count || 0} real observation(s)</span>
              </div>
              <div className="meta-point">
                <span className="meta-label">History Database:</span>
                <span className={`meta-val ${trendsData?.database?.isAvailable === false ? 'text-amber-400 font-semibold' : 'text-emerald-400'}`}>
                  PostgreSQL {trendsData?.database?.isAvailable === false ? '(Offline / Standby)' : '(Connected)'}
                </span>
              </div>
            </div>

            {/* Current Real Weather Snapshot from Cache */}
            {weatherData && (
              <div className="no-data-current-snapshot">
                <h3 className="snapshot-title">Current Live Snapshot for {weatherData.city}</h3>
                <div className="snapshot-grid">
                  <div className="snapshot-pill">
                    <Thermometer size={16} className="text-orange-400" />
                    <span>Temp: {displayTemp(weatherData.tempC)}</span>
                  </div>
                  <div className="snapshot-pill">
                    <Droplets size={16} className="text-cyan-400" />
                    <span>Humidity: {weatherData.humidity}%</span>
                  </div>
                  <div className="snapshot-pill">
                    <CloudRain size={16} className="text-blue-400" />
                    <span>Rain Chance: {weatherData.insight?.rainChance || 0}%</span>
                  </div>
                  <div className="snapshot-pill">
                    <Wind size={16} className="text-emerald-400" />
                    <span>Wind: {displaySpeed(weatherData.windSpeedKmh)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full Interactive Analytics Dashboard */}
        {!isLoading && !errorMsg && hasData && (
          <div className="trends-analytics-grid animate-fade-in">
            {/* --- 1. TEMPERATURE TREND CHART --- */}
            <div className="trends-chart-card">
              <div className="chart-header">
                <div className="chart-title-wrap">
                  <Thermometer size={20} className="text-orange-400" />
                  <div>
                    <h2 className="chart-title">Temperature</h2>
                    <span className="chart-subtitle">Real observed ambient surface temperature</span>
                  </div>
                </div>
                <div className="chart-summary-pills">
                  <div className="stat-pill">
                    <span className="stat-label">Current:</span>
                    <span className="stat-value">{displayTemp(trendsData.temperature?.current)}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Average:</span>
                    <span className="stat-value">{displayTemp(trendsData.temperature?.avg)}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Min:</span>
                    <span className="stat-value text-cyan-300">{displayTemp(trendsData.temperature?.min)}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Max:</span>
                    <span className="stat-value text-rose-300">{displayTemp(trendsData.temperature?.max)}</span>
                  </div>
                </div>
              </div>

              {/* Temperature SVG Line Chart */}
              <div className="svg-chart-container">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="trends-svg">
                  <defs>
                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB923C" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#FB923C" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = padding.top + (svgHeight - padding.top - padding.bottom) * pct;
                    const val = Math.round(tempChartData.max - pct * (tempChartData.max - tempChartData.min));
                    return (
                      <g key={pct}>
                        <line x1={padding.left} y1={y} x2={svgWidth - padding.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <text x={padding.left - 8} y={y + 4} fill="rgba(255,255,255,0.4)" fontSize="11" textAnchor="end">
                          {displayTemp(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area Fill */}
                  <path d={tempChartData.area} fill="url(#tempGradient)" />

                  {/* Curve Line */}
                  <path d={tempChartData.path} fill="none" stroke="#FB923C" strokeWidth="3" strokeLinecap="round" />

                  {/* Interactive Data Points */}
                  {tempChartData.points.map((p, idx) => (
                    <g key={idx} onMouseEnter={() => setHoveredTempIdx(idx)} onMouseLeave={() => setHoveredTempIdx(null)}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={hoveredTempIdx === idx ? 6 : 3.5}
                        fill="#FB923C"
                        stroke="#1E293B"
                        strokeWidth="2"
                        className="cursor-pointer transition-all"
                      />
                    </g>
                  ))}

                  {/* Hover Crosshair & Card */}
                  {hoveredTempIdx !== null && tempChartData.points[hoveredTempIdx] && (
                    <g>
                      <line
                        x1={tempChartData.points[hoveredTempIdx].x}
                        y1={padding.top}
                        x2={tempChartData.points[hoveredTempIdx].x}
                        y2={svgHeight - padding.bottom}
                        stroke="#FB923C"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    </g>
                  )}
                </svg>

                {/* Hover Tooltip Card */}
                {hoveredTempIdx !== null && observations[hoveredTempIdx] && (
                  <div
                    className="chart-hover-tooltip"
                    style={{
                      left: `${(tempChartData.points[hoveredTempIdx].x / svgWidth) * 100}%`,
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

            {/* --- 2. RAINFALL & PRECIPITATION CHART --- */}
            <div className="trends-chart-card">
              <div className="chart-header">
                <div className="chart-title-wrap">
                  <CloudRain size={20} className="text-blue-400" />
                  <div>
                    <h2 className="chart-title">Rainfall & Precipitation</h2>
                    <span className="chart-subtitle">Observed rainfall (mm) & forecast probability (%)</span>
                  </div>
                </div>
                <div className="chart-summary-pills">
                  <div className="stat-pill">
                    <span className="stat-label">Total Rainfall:</span>
                    <span className="stat-value">{trendsData.rainfall?.total} mm</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Average:</span>
                    <span className="stat-value">{trendsData.rainfall?.avg} mm</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Max Period:</span>
                    <span className="stat-value text-blue-300">{trendsData.rainfall?.maxPeriod} mm</span>
                  </div>
                </div>
              </div>

              {/* Rainfall Bars + Probability Line SVG */}
              <div className="svg-chart-container">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="trends-svg">
                  {/* Grid Lines */}
                  {[0, 0.5, 1].map((pct) => {
                    const y = padding.top + (svgHeight - padding.top - padding.bottom) * pct;
                    const val = (rainChartData.maxPrecip * (1 - pct)).toFixed(1);
                    return (
                      <g key={pct}>
                        <line x1={padding.left} y1={y} x2={svgWidth - padding.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                        <text x={padding.left - 8} y={y + 4} fill="rgba(255,255,255,0.4)" fontSize="11" textAnchor="end">
                          {val} mm
                        </text>
                      </g>
                    );
                  })}

                  {/* Precipitation Bars */}
                  {observations.map((obs, idx) => {
                    const chartW = svgWidth - padding.left - padding.right;
                    const chartH = svgHeight - padding.top - padding.bottom;
                    const barW = Math.max(8, (chartW / observations.length) * 0.55);
                    const cx = padding.left + (idx / (observations.length - 1 || 1)) * chartW;
                    const barH = (obs.precipitation / rainChartData.maxPrecip) * chartH;
                    const y = padding.top + chartH - barH;

                    return (
                      <g key={idx} onMouseEnter={() => setHoveredRainIdx(idx)} onMouseLeave={() => setHoveredRainIdx(null)}>
                        <rect
                          x={cx - barW / 2}
                          y={y}
                          width={barW}
                          height={Math.max(3, barH)}
                          rx="3"
                          fill={obs.precipitation > 0 ? '#38BDF8' : 'rgba(56, 189, 248, 0.2)'}
                          className="cursor-pointer transition-all"
                        />
                      </g>
                    );
                  })}

                  {/* Probability Line */}
                  <path d={rainChartData.probPath.path} fill="none" stroke="#A855F7" strokeWidth="2" strokeDasharray="4 3" opacity="0.85" />
                </svg>

                {/* Rain Legend */}
                <div className="rain-chart-legend">
                  <div className="legend-item">
                    <span className="legend-box bg-sky-400" />
                    <span>Precipitation Accumulation (mm)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-line border-purple-400" />
                    <span>Rain Probability (%)</span>
                  </div>
                </div>

                {/* Hover Tooltip Card */}
                {hoveredRainIdx !== null && observations[hoveredRainIdx] && (
                  <div
                    className="chart-hover-tooltip"
                    style={{
                      left: `${((padding.left + (hoveredRainIdx / (observations.length - 1 || 1)) * (svgWidth - padding.left - padding.right)) / svgWidth) * 100}%`,
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

            {/* --- 3. HUMIDITY & WIND GRID --- */}
            <div className="trends-dual-grid">
              {/* Humidity Card */}
              <div className="trends-chart-card">
                <div className="chart-header">
                  <div className="chart-title-wrap">
                    <Droplets size={20} className="text-cyan-400" />
                    <div>
                      <h2 className="chart-title">Relative Humidity</h2>
                      <span className="chart-subtitle">Moisture saturation trend</span>
                    </div>
                  </div>
                  <div className="chart-summary-pills compact">
                    <span className="stat-pill"><span className="stat-label">Avg:</span> {trendsData.humidity?.avg}%</span>
                    <span className="stat-pill"><span className="stat-label">Max:</span> {trendsData.humidity?.max}%</span>
                  </div>
                </div>

                <div className="svg-chart-container compact">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="trends-svg">
                    <defs>
                      <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={humidityChartData.area} fill="url(#humidityGradient)" />
                    <path d={humidityChartData.path} fill="none" stroke="#22D3EE" strokeWidth="2.5" />
                    {humidityChartData.points.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={hoveredHumidityIdx === idx ? 5 : 3}
                        fill="#22D3EE"
                        stroke="#0F172A"
                        strokeWidth="1.5"
                        onMouseEnter={() => setHoveredHumidityIdx(idx)}
                        onMouseLeave={() => setHoveredHumidityIdx(null)}
                      />
                    ))}
                  </svg>
                </div>
              </div>

              {/* Wind Speed & Direction Card */}
              <div className="trends-chart-card">
                <div className="chart-header">
                  <div className="chart-title-wrap">
                    <Wind size={20} className="text-emerald-400" />
                    <div>
                      <h2 className="chart-title">Wind Speed & Direction</h2>
                      <span className="chart-subtitle">Dominant: {trendsData.wind?.dominantDirection}</span>
                    </div>
                  </div>
                  <div className="chart-summary-pills compact">
                    <span className="stat-pill"><span className="stat-label">Avg:</span> {displaySpeed(trendsData.wind?.avg)}</span>
                    <span className="stat-pill"><span className="stat-label">Peak:</span> {displaySpeed(trendsData.wind?.max)}</span>
                  </div>
                </div>

                <div className="svg-chart-container compact">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="trends-svg">
                    <defs>
                      <linearGradient id="windGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#34D399" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={windChartData.area} fill="url(#windGradient)" />
                    <path d={windChartData.path} fill="none" stroke="#34D399" strokeWidth="2.5" />
                    {windChartData.points.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={hoveredWindIdx === idx ? 5 : 3}
                        fill="#34D399"
                        stroke="#0F172A"
                        strokeWidth="1.5"
                        onMouseEnter={() => setHoveredWindIdx(idx)}
                        onMouseLeave={() => setHoveredWindIdx(null)}
                      />
                    ))}
                  </svg>
                </div>
              </div>
            </div>

            {/* --- 4. ATMOSPHERIC PRESSURE TREND --- */}
            <div className="trends-chart-card">
              <div className="chart-header">
                <div className="chart-title-wrap">
                  <Gauge size={20} className="text-indigo-400" />
                  <div>
                    <h2 className="chart-title">Atmospheric Pressure</h2>
                    <span className="chart-subtitle">Barometric surface trend (hPa)</span>
                  </div>
                </div>
                <div className="chart-summary-pills">
                  <div className="stat-pill"><span className="stat-label">Current:</span> {trendsData.pressure?.current} hPa</div>
                  <div className="stat-pill"><span className="stat-label">Avg:</span> {trendsData.pressure?.avg} hPa</div>
                  <div className="stat-pill"><span className="stat-label">Min:</span> {trendsData.pressure?.min} hPa</div>
                  <div className="stat-pill"><span className="stat-label">Max:</span> {trendsData.pressure?.max} hPa</div>
                </div>
              </div>

              <div className="svg-chart-container compact">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="trends-svg">
                  <path d={pressureChartData.path} fill="none" stroke="#818CF8" strokeWidth="2.5" />
                  {pressureChartData.points.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPressureIdx === idx ? 5 : 3}
                      fill="#818CF8"
                      stroke="#0F172A"
                      strokeWidth="1.5"
                      onMouseEnter={() => setHoveredPressureIdx(idx)}
                      onMouseLeave={() => setHoveredPressureIdx(null)}
                    />
                  ))}
                </svg>
              </div>
            </div>

            {/* --- 5. SKYCAST RISK HISTORY TIMELINE --- */}
            <div className="trends-risk-history-card">
              <div className="chart-header">
                <div className="chart-title-wrap">
                  <ShieldAlert size={20} className="text-amber-400" />
                  <div>
                    <h2 className="chart-title">Skycast Risk History Timeline</h2>
                    <span className="chart-subtitle">Observed derived risk state transitions (PostgreSQL archive)</span>
                  </div>
                </div>
              </div>

              <div className="risk-timeline-container">
                {trendsData.riskHistory && trendsData.riskHistory.length > 0 ? (
                  <div className="risk-timeline-list">
                    {trendsData.riskHistory.map((item, idx) => {
                      const colorClass = `risk-node-${item.riskLevel.toLowerCase()}`;
                      return (
                        <div key={idx} className={`risk-timeline-item ${colorClass}`}>
                          <div className="timeline-dot-wrapper">
                            <span className="timeline-dot" />
                            {idx < trendsData.riskHistory.length - 1 && <span className="timeline-line" />}
                          </div>
                          <div className="timeline-content-card">
                            <div className="timeline-top-row">
                              <span className={`risk-badge badge-${item.riskLevel.toLowerCase()}`}>
                                {item.riskLevel.toUpperCase()} — {item.actionDirective}
                              </span>
                              <span className="timeline-time">{item.timeLabel}</span>
                            </div>
                            <h3 className="timeline-hazard-name">{item.highestRisk.replace(/_/g, ' ').toUpperCase()}</h3>
                            {item.activeHazards && item.activeHazards !== 'None' && (
                              <p className="timeline-hazards-detail">Hazards: {item.activeHazards}</p>
                            )}
                            <div className="timeline-meta-footer">
                              <span>Temperature at observation: {displayTemp(item.temperature)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="risk-timeline-empty">
                    <CheckCircle2 size={24} className="text-emerald-400" />
                    <p>Conditions have remained within normal thresholds (Green) throughout this observation period.</p>
                  </div>
                )}
              </div>

              <div className="risk-disclaimer-footer">
                <Info size={14} />
                <span>Skycast risk levels are derived assessments based on published IMD criteria/framework. They are not official IMD warnings.</span>
              </div>
            </div>

            {/* --- 6. FORECAST VS OBSERVED COMPARISON --- */}
            {trendsData.forecastVsObserved && (
              <div className="trends-forecast-vs-observed-card">
                <div className="chart-header">
                  <div className="chart-title-wrap">
                    <Layers size={20} className="text-purple-400" />
                    <div>
                      <h2 className="chart-title">Forecast vs Recent Observed Weather</h2>
                      <span className="chart-subtitle">Separately distinguished real observations vs current prediction</span>
                    </div>
                  </div>
                </div>

                <div className="fvo-grid">
                  {/* Observed Column */}
                  <div className="fvo-box observed">
                    <div className="fvo-tag tag-observed">OBSERVED DATA (DATABASE)</div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Recorded Temperature:</span>
                      <span className="fvo-metric-val">{displayTemp(trendsData.forecastVsObserved.observed?.temperature)}</span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Humidity:</span>
                      <span className="fvo-metric-val">{trendsData.forecastVsObserved.observed?.humidity}%</span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Observed Rainfall:</span>
                      <span className="fvo-metric-val">{trendsData.forecastVsObserved.observed?.precipitation} mm</span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Observed Wind:</span>
                      <span className="fvo-metric-val">{displaySpeed(trendsData.forecastVsObserved.observed?.windSpeed)}</span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Condition:</span>
                      <span className="fvo-metric-val">{trendsData.forecastVsObserved.observed?.condition}</span>
                    </div>
                  </div>

                  {/* Forecast Column */}
                  <div className="fvo-box forecast">
                    <div className="fvo-tag tag-forecast">CURRENT FORECAST (OPEN-METEO)</div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Forecast High / Low:</span>
                      <span className="fvo-metric-val">
                        {displayTemp(trendsData.forecastVsObserved.forecast?.highTemp)} / {displayTemp(trendsData.forecastVsObserved.forecast?.lowTemp)}
                      </span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Precipitation Chance:</span>
                      <span className="fvo-metric-val">{trendsData.forecastVsObserved.forecast?.rainChance}%</span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Expected Rain:</span>
                      <span className="fvo-metric-val">{trendsData.forecastVsObserved.forecast?.expectedPrecipitation} mm</span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Peak Forecast Wind:</span>
                      <span className="fvo-metric-val">{displaySpeed(trendsData.forecastVsObserved.forecast?.maxWind)}</span>
                    </div>
                    <div className="fvo-metric-row">
                      <span className="fvo-metric-label">Expected Condition:</span>
                      <span className="fvo-metric-val">{trendsData.forecastVsObserved.forecast?.condition}</span>
                    </div>
                  </div>
                </div>

                <div className="fvo-disclaimer-note">
                  <Info size={14} />
                  <span>{trendsData.forecastVsObserved.note}</span>
                </div>
              </div>
            )}

            {/* --- 7. MULTI-LOCATION COMPARISON CARD --- */}
            {trendsData.comparison && trendsData.comparison.status === 'ready' && (
              <div className="trends-comparison-card animate-fade-in">
                <div className="chart-header">
                  <div className="chart-title-wrap">
                    <GitCompare size={20} className="text-teal-400" />
                    <div>
                      <h2 className="chart-title">Location Comparison: {cityParam} vs {trendsData.comparison.city}</h2>
                      <span className="chart-subtitle">Real side-by-side observation metrics</span>
                    </div>
                  </div>
                </div>

                <div className="comparison-table-wrapper">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>{cityParam}</th>
                        <th>{trendsData.comparison.city}</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Current Temperature</td>
                        <td className="font-semibold">{displayTemp(trendsData.temperature?.current)}</td>
                        <td className="font-semibold">{displayTemp(trendsData.comparison.temperature?.current)}</td>
                        <td className="text-blue-300">
                          {Math.abs((trendsData.temperature?.current || 0) - (trendsData.comparison.temperature?.current || 0)).toFixed(1)}° delta
                        </td>
                      </tr>
                      <tr>
                        <td>Average Temperature</td>
                        <td>{displayTemp(trendsData.temperature?.avg)}</td>
                        <td>{displayTemp(trendsData.comparison.temperature?.avg)}</td>
                        <td>--</td>
                      </tr>
                      <tr>
                        <td>Total Rainfall ({trendsData.rangeLabel})</td>
                        <td>{trendsData.rainfall?.total} mm</td>
                        <td>{trendsData.comparison.rainfall?.total} mm</td>
                        <td>{Math.abs((trendsData.rainfall?.total || 0) - (trendsData.comparison.rainfall?.total || 0)).toFixed(1)} mm delta</td>
                      </tr>
                      <tr>
                        <td>Average Humidity</td>
                        <td>{trendsData.humidity?.avg}%</td>
                        <td>{trendsData.comparison.humidity?.avg}%</td>
                        <td>--</td>
                      </tr>
                      <tr>
                        <td>Average Wind Speed</td>
                        <td>{displaySpeed(trendsData.wind?.avg)}</td>
                        <td>{displaySpeed(trendsData.comparison.wind?.avg)}</td>
                        <td>--</td>
                      </tr>
                      <tr>
                        <td>Latest Skycast Risk</td>
                        <td>
                          <span className={`risk-badge mini badge-${trendsData.observations[trendsData.observations.length - 1]?.riskLevel || 'green'}`}>
                            {(trendsData.observations[trendsData.observations.length - 1]?.riskLevel || 'green').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className={`risk-badge mini badge-${trendsData.comparison.latestRisk || 'green'}`}>
                            {(trendsData.comparison.latestRisk || 'green').toUpperCase()}
                          </span>
                        </td>
                        <td>--</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Action Bar Shortcuts */}
        <section className="trends-actions-footer">
          <button
            type="button"
            className="trends-action-card gpt-action"
            onClick={() => navigate(`/weathergpt?city=${encodeURIComponent(cityParam)}`)}
          >
            <div className="action-icon-wrap">
              <Sparkles size={22} />
            </div>
            <div className="action-text-wrap">
              <span className="action-title">Ask WeatherGPT about this trend</span>
              <span className="action-desc">"Why has {cityParam}'s temperature changed recently?"</span>
            </div>
            <ArrowRight size={18} className="action-arrow" />
          </button>

          <button
            type="button"
            className="trends-action-card map-action"
            onClick={() => navigate(`/map?city=${encodeURIComponent(cityParam)}`)}
          >
            <div className="action-icon-wrap">
              <MapPin size={22} />
            </div>
            <div className="action-text-wrap">
              <span className="action-title">View on Weather Map</span>
              <span className="action-desc">Explore regional radar, temperature & wind streamlines</span>
            </div>
            <ArrowRight size={18} className="action-arrow" />
          </button>

          <button
            type="button"
            className="trends-action-card details-action"
            onClick={() => navigate(`/details?city=${encodeURIComponent(cityParam)}`)}
          >
            <div className="action-icon-wrap">
              <ExternalLink size={22} />
            </div>
            <div className="action-text-wrap">
              <span className="action-title">View Detailed Forecast</span>
              <span className="action-desc">Inspect 7-day multi-variable meteorological breakdowns</span>
            </div>
            <ArrowRight size={18} className="action-arrow" />
          </button>
        </section>
      </div>
    </div>
  );
}
