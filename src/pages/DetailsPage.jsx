import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import {
  ArrowLeft,
  Thermometer,
  CloudRain,
  Wind,
  Droplets,
  Gauge,
  Sun,
  Eye,
  Sunrise,
  Sunset,
  Cloud,
  Compass,
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
  Check
} from 'lucide-react';
import { WeatherIconRenderer } from '../components/WeatherIcons';

export function DetailsPage() {
  const {
    currentCity,
    weatherData,
    isLoading,
    errorMessage,
    setErrorMessage,
    unit,
    windUnit,
    formatTemp,
    formatWind,
    loadCityWeather,
    refreshWeather
  } = useWeather();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeChartTab, setActiveChartTab] = useState('Temperature'); // 'Temperature' | 'Rain' | 'Humidity' | 'Wind'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Read city and date from URL search parameters
  const cityParam = searchParams.get('city') || currentCity || 'Pune';
  const dateParam = searchParams.get('date');

  // Load weather for searched/param city if not already loaded
  useEffect(() => {
    if (cityParam && (!weatherData || weatherData.city.toLowerCase() !== cityParam.toLowerCase())) {
      loadCityWeather(cityParam);
    }
  }, [cityParam, weatherData, loadCityWeather]);

  const city = weatherData || {};
  const details = city.details || {
    pressureHpa: 1013,
    visibilityKm: 10,
    cloudCoverPct: 40,
    uvIndex: 5.0,
    uvCategory: 'Moderate',
    dewPointC: 20,
    precipitationMm: 0.0,
    sunrise: '06:12 AM',
    sunset: '06:47 PM',
    windDirection: 'NE',
    windDirectionDeg: 45
  };

  const dailyList = city.daily || [];
  const hourlyList = city.hourly || [];

  // Find target selected day from daily forecast if date query param exists
  const selectedDay = useMemo(() => {
    if (!dateParam || dailyList.length === 0) return null;
    return dailyList.find(d => d.date === dateParam) || null;
  }, [dateParam, dailyList]);

  // Handle day pill selection
  const handleSelectDay = (dayItem) => {
    if (dayItem.day === 'Today' || dayItem.date === dailyList[0]?.date) {
      setSearchParams({ city: city.city || cityParam });
    } else {
      setSearchParams({ city: city.city || cityParam, date: dayItem.date });
    }
  };

  const handleResetToToday = () => {
    setSearchParams({ city: city.city || cityParam });
  };

  // Temperature conversions for charts
  const convertTemp = (tempC) => {
    if (tempC === undefined || tempC === null) return 0;
    if (unit === 'F') {
      return Math.round((tempC * 9) / 5 + 32);
    }
    return Math.round(tempC);
  };

  // Prepare chart dataset based on active tab
  const chartConfig = useMemo(() => {
    const hours = hourlyList.slice(0, 12);
    if (hours.length === 0) {
      return {
        title: 'Temperature (°C)',
        unitSuffix: unit === 'F' ? '°F' : '°C',
        points: [],
        minVal: 0,
        maxVal: 40
      };
    }

    let values = [];
    let title = 'Hourly Temperature';
    let unitSuffix = unit === 'F' ? '°F' : '°C';

    if (activeChartTab === 'Temperature') {
      title = `Hourly Temperature (${unitSuffix})`;
      values = hours.map(h => convertTemp(h.tempC));
    } else if (activeChartTab === 'Rain') {
      title = 'Precipitation Probability (%)';
      unitSuffix = '%';
      values = hours.map(h => h.rainChance || 0);
    } else if (activeChartTab === 'Humidity') {
      title = 'Relative Humidity (%)';
      unitSuffix = '%';
      values = hours.map(h => h.humidity || 50);
    } else if (activeChartTab === 'Wind') {
      title = `Wind Speed (${windUnit || 'km/h'})`;
      unitSuffix = ` ${windUnit || 'km/h'}`;
      values = hours.map(h => {
        const kmh = h.windSpeedKmh || 10;
        if (windUnit === 'mph') return Math.round(kmh * 0.621371);
        if (windUnit === 'm/s') return Math.round(kmh / 3.6);
        return kmh;
      });
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;

    // SVG coordinates calculation (width: 760, height: 170)
    const svgW = 760;
    const svgH = 170;
    const padX = 40;
    const padY = 30;

    const computedPoints = values.map((val, idx) => {
      const x = padX + (idx / (values.length - 1)) * (svgW - padX * 2);
      const y = svgH - padY - ((val - min) / range) * (svgH - padY * 2);
      return {
        x,
        y,
        val,
        time: hours[idx]?.time || `${idx * 2}:00`,
        raw: hours[idx]
      };
    });

    const pathD = computedPoints.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = computedPoints[i - 1];
      const midX = (prev.x + pt.x) / 2;
      return `${acc} C ${midX} ${prev.y}, ${midX} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');

    return {
      title,
      unitSuffix,
      points: computedPoints,
      pathD,
      minVal: min,
      maxVal: max,
      svgW,
      svgH,
      padX,
      padY
    };
  }, [activeChartTab, hourlyList, unit, windUnit]);

  // Display fields for active day (selected day or today)
  const displayCondition = selectedDay ? selectedDay.condition : city.condition || 'Mainly Clear';
  const displayIcon = selectedDay ? selectedDay.icon : city.hourly?.[0]?.icon || 'partly-cloudy';
  const displayTemp = selectedDay ? formatTemp(selectedDay.highC) : formatTemp(city.tempC);
  const displayHigh = selectedDay ? formatTemp(selectedDay.highC) : formatTemp(city.highC);
  const displayLow = selectedDay ? formatTemp(selectedDay.lowC) : formatTemp(city.lowC);
  const displayRain = selectedDay ? selectedDay.rainChance : city.insight?.rainChance || city.details?.precipitationMm || 20;
  const displaySunrise = selectedDay?.sunrise || details.sunrise;
  const displaySunset = selectedDay?.sunset || details.sunset;
  const displayWind = selectedDay ? formatWind(selectedDay.maxWindKmh) : formatWind(city.windSpeedKmh);

  return (
    <div className="details-page-layout">
      {/* Top Header Bar with Back Button and Quick Refresh */}
      <div className="details-top-bar-nav">
        <button
          type="button"
          className="details-back-btn"
          onClick={() => navigate(`/?city=${encodeURIComponent(city.city || currentCity || 'Pune')}`)}
          title="Return to main dashboard"
        >
          <ArrowLeft size={16} />
          <span>Back to dashboard</span>
        </button>

        <div className="details-header-actions">
          <button
            type="button"
            className="details-refresh-action-btn"
            onClick={refreshWeather}
            title="Refresh weather data"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {errorMessage ? (
        <div className="details-error-card">
          <AlertCircle size={28} className="text-red-500" />
          <div className="details-error-info">
            <h3 className="details-error-title">Unable to load weather data</h3>
            <p className="details-error-msg">{errorMessage}</p>
          </div>
          <button
            type="button"
            className="details-error-retry-btn"
            onClick={() => {
              setErrorMessage(null);
              loadCityWeather(cityParam);
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {/* Main Top Overview Section */}
      <section className="details-hero-overview-card">
        <div className="details-hero-left">
          <div className="details-hero-badge-row">
            <span className="details-hero-category">Weather Details</span>
            {selectedDay && (
              <span className="details-focus-pill">
                <Calendar size={12} />
                <span>Forecast for {selectedDay.day} ({selectedDay.date})</span>
                <button
                  type="button"
                  className="details-reset-day-btn"
                  onClick={handleResetToToday}
                  title="Reset to today"
                >
                  Reset
                </button>
              </span>
            )}
          </div>

          <h1 className="details-hero-city">{city.displayLocation || `${cityParam}, India`}</h1>
          <span className="details-hero-date">{selectedDay ? selectedDay.date : city.date || 'TODAY'}</span>

          <div className="details-hero-temp-row">
            <div className="details-hero-temp-val">{displayTemp}</div>
            <div className="details-hero-meta-col">
              <span className="details-hero-cond">{displayCondition}</span>
              <span className="details-hero-feels">
                {selectedDay ? `High ${displayHigh} • Low ${displayLow}` : `Feels like ${formatTemp(city.feelsLikeC || city.tempC)}`}
              </span>
            </div>
          </div>
        </div>

        <div className="details-hero-right">
          <div className="details-hero-icon-large">
            <WeatherIconRenderer name={displayIcon} size={84} />
          </div>
          <div className="details-hero-quick-stats">
            <div className="details-quick-stat-item">
              <span className="quick-stat-label">High / Low</span>
              <span className="quick-stat-val">{displayHigh} / {displayLow}</span>
            </div>
            <div className="details-quick-stat-item">
              <span className="quick-stat-label">Humidity</span>
              <span className="quick-stat-val">{city.humidity || 65}%</span>
            </div>
            <div className="details-quick-stat-item">
              <span className="quick-stat-label">Wind</span>
              <span className="quick-stat-val">{displayWind}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7-Day Forecast Day Selector */}
      <section className="details-day-selector-section">
        <div className="details-section-header">
          <span className="details-section-title">7-Day Forecast Timeline</span>
          <span className="details-section-sub">Click a day to inspect forecast details</span>
        </div>

        <div className="details-day-pills-row">
          {dailyList.map((dayItem) => {
            const isDayActive = selectedDay
              ? selectedDay.date === dayItem.date
              : dayItem.day === 'Today';

            return (
              <button
                key={dayItem.date}
                type="button"
                className={`details-day-pill-card ${isDayActive ? 'active' : ''}`}
                onClick={() => handleSelectDay(dayItem)}
              >
                <span className="day-pill-name">{dayItem.day}</span>
                <span className="day-pill-date">{dayItem.date.slice(5)}</span>
                <div className="day-pill-icon">
                  <WeatherIconRenderer name={dayItem.icon} size={22} />
                </div>
                <div className="day-pill-temps">
                  <span className="day-pill-high">{formatTemp(dayItem.highC)}</span>
                  <span className="day-pill-low">{formatTemp(dayItem.lowC)}</span>
                </div>
                <span className="day-pill-rain">{dayItem.rainChance}% rain</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 12 Detailed Weather Statistics Cards */}
      <section className="details-statistics-section">
        <div className="details-section-header">
          <span className="details-section-title">Atmospheric & Environmental Metrics</span>
          <span className="details-section-sub">Accurate metrics retrieved from meteorological sensors</span>
        </div>

        <div className="details-metrics-grid">
          {/* 1. Temperature */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Thermometer size={18} className="text-blue-600" />
              <span className="detail-metric-label">Temperature</span>
            </div>
            <span className="detail-metric-value">{displayTemp}</span>
            <span className="detail-metric-sub">Range: {displayHigh} / {displayLow}</span>
          </div>

          {/* 2. Feels Like */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Sun size={18} className="text-amber-500" />
              <span className="detail-metric-label">Feels Like</span>
            </div>
            <span className="detail-metric-value">{formatTemp(city.feelsLikeC || city.tempC)}</span>
            <span className="detail-metric-sub">Humidity & wind adjusted</span>
          </div>

          {/* 3. Humidity */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Droplets size={18} className="text-sky-500" />
              <span className="detail-metric-label">Humidity</span>
            </div>
            <span className="detail-metric-value">{city.humidity || 65}%</span>
            <span className="detail-metric-sub">Dew point {formatTemp(details.dewPointC)}</span>
          </div>

          {/* 4. Wind Speed & Direction */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Wind size={18} className="text-teal-500" />
              <span className="detail-metric-label">Wind</span>
            </div>
            <div className="detail-metric-sub-val">
              <span className="detail-metric-value">{displayWind}</span>
              <span className="detail-metric-tag">{details.windDirection || 'NE'}</span>
            </div>
            <span className="detail-metric-sub">{details.windDirectionDeg || 45}° compass direction</span>
          </div>

          {/* 5. Atmospheric Pressure */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Gauge size={18} className="text-indigo-500" />
              <span className="detail-metric-label">Pressure</span>
            </div>
            <span className="detail-metric-value">{details.pressureHpa} hPa</span>
            <span className="detail-metric-sub">Surface sea-level barometric</span>
          </div>

          {/* 6. Visibility */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Eye size={18} className="text-slate-600" />
              <span className="detail-metric-label">Visibility</span>
            </div>
            <span className="detail-metric-value">{details.visibilityKm} km</span>
            <span className="detail-metric-sub">Clear line of sight</span>
          </div>

          {/* 7. Cloud Cover */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Cloud size={18} className="text-slate-500" />
              <span className="detail-metric-label">Cloud Cover</span>
            </div>
            <span className="detail-metric-value">{details.cloudCoverPct}%</span>
            <span className="detail-metric-sub">Sky coverage percentage</span>
          </div>

          {/* 8. UV Index */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Sun size={18} className="text-orange-500" />
              <span className="detail-metric-label">UV Index</span>
            </div>
            <div className="detail-metric-sub-val">
              <span className="detail-metric-value">{selectedDay?.uvIndex || details.uvIndex}</span>
              <span className="detail-metric-tag alert-uv">{details.uvCategory}</span>
            </div>
            <span className="detail-metric-sub">Solar radiation exposure</span>
          </div>

          {/* 9. Dew Point */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Compass size={18} className="text-cyan-600" />
              <span className="detail-metric-label">Dew Point</span>
            </div>
            <span className="detail-metric-value">{formatTemp(details.dewPointC)}</span>
            <span className="detail-metric-sub">Condensation threshold</span>
          </div>

          {/* 10. Precipitation */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <CloudRain size={18} className="text-blue-500" />
              <span className="detail-metric-label">Precipitation</span>
            </div>
            <span className="detail-metric-value">{displayRain}%</span>
            <span className="detail-metric-sub">{selectedDay ? `${selectedDay.precipitationMm || 0} mm expected` : `${details.precipitationMm || 0} mm accumulation`}</span>
          </div>

          {/* 11. Sunrise */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Sunrise size={18} className="text-amber-500" />
              <span className="detail-metric-label">Sunrise</span>
            </div>
            <span className="detail-metric-value">{displaySunrise}</span>
            <span className="detail-metric-sub">First morning light</span>
          </div>

          {/* 12. Sunset */}
          <div className="detail-metric-card">
            <div className="metric-card-top">
              <Sunset size={18} className="text-rose-500" />
              <span className="detail-metric-label">Sunset</span>
            </div>
            <span className="detail-metric-value">{displaySunset}</span>
            <span className="detail-metric-sub">Evening dusk</span>
          </div>
        </div>
      </section>

      {/* Weather Forecast Hourly Charts Section */}
      <section className="details-chart-card">
        <div className="details-chart-header-row">
          <div>
            <h3 className="details-chart-title">{chartConfig.title}</h3>
            <span className="details-chart-sub">24-hour meteorological trend</span>
          </div>

          {/* Chart Tabs: Temperature | Rain | Humidity | Wind */}
          <div className="details-chart-tabs-pills">
            <button
              type="button"
              className={`details-chart-tab-btn ${activeChartTab === 'Temperature' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('Temperature')}
            >
              <Thermometer size={14} />
              <span>Temperature</span>
            </button>
            <button
              type="button"
              className={`details-chart-tab-btn ${activeChartTab === 'Rain' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('Rain')}
            >
              <CloudRain size={14} />
              <span>Rain</span>
            </button>
            <button
              type="button"
              className={`details-chart-tab-btn ${activeChartTab === 'Humidity' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('Humidity')}
            >
              <Droplets size={14} />
              <span>Humidity</span>
            </button>
            <button
              type="button"
              className={`details-chart-tab-btn ${activeChartTab === 'Wind' ? 'active' : ''}`}
              onClick={() => setActiveChartTab('Wind')}
            >
              <Wind size={14} />
              <span>Wind</span>
            </button>
          </div>
        </div>

        {/* Dynamic SVG Curve Chart */}
        <div className="details-chart-svg-wrap">
          {chartConfig.points.length > 0 ? (
            <svg viewBox={`0 0 ${chartConfig.svgW} ${chartConfig.svgH}`} className="details-chart-svg">
              {/* Background Reference Grid Lines */}
              <line
                x1={chartConfig.padX}
                y1={chartConfig.padY}
                x2={chartConfig.svgW - chartConfig.padX}
                y2={chartConfig.padY}
                stroke="#F1F5F9"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <line
                x1={chartConfig.padX}
                y1={chartConfig.svgH / 2}
                x2={chartConfig.svgW - chartConfig.padX}
                y2={chartConfig.svgH / 2}
                stroke="#F1F5F9"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <line
                x1={chartConfig.padX}
                y1={chartConfig.svgH - chartConfig.padY}
                x2={chartConfig.svgW - chartConfig.padX}
                y2={chartConfig.svgH - chartConfig.padY}
                stroke="#E2E8F0"
                strokeWidth="1.5"
              />

              {/* Area Gradient Defs */}
              <defs>
                <linearGradient id="detailsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Closed Path Area */}
              <path
                d={`${chartConfig.pathD} L ${chartConfig.points[chartConfig.points.length - 1].x} ${chartConfig.svgH - chartConfig.padY} L ${chartConfig.points[0].x} ${chartConfig.svgH - chartConfig.padY} Z`}
                fill="url(#detailsAreaGrad)"
              />

              {/* Main Line Stroke */}
              <path
                d={chartConfig.pathD}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.75"
                strokeLinecap="round"
              />

              {/* Data Point Nodes and Labels */}
              {chartConfig.points.map((pt, i) => {
                const isHovered = hoveredPoint === i;
                return (
                  <g
                    key={i}
                    className="chart-node-group"
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover vertical guideline */}
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={chartConfig.padY}
                        x2={pt.x}
                        y2={chartConfig.svgH - chartConfig.padY}
                        stroke="#93C5FD"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Point Circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : 4.5}
                      fill="#2563EB"
                      stroke="#FFFFFF"
                      strokeWidth={isHovered ? 2.5 : 2}
                      className="transition-all"
                    />

                    {/* Value Badge Text */}
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      fontSize={isHovered ? '12.5' : '11'}
                      fontWeight="700"
                      fill={isHovered ? '#1D4ED8' : '#0F172A'}
                    >
                      {pt.val}{chartConfig.unitSuffix}
                    </text>

                    {/* Time Label on X-Axis */}
                    <text
                      x={pt.x}
                      y={chartConfig.svgH - 8}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight={isHovered ? '700' : '500'}
                      fill={isHovered ? '#2563EB' : '#64748B'}
                    >
                      {pt.time}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="details-chart-empty">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span>Loading hourly trend...</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
