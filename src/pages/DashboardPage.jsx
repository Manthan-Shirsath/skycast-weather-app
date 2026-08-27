import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import {
  WeatherIconRenderer,
  WaterDropIcon
} from '../components/WeatherIcons';
import {
  Umbrella,
  Sunrise,
  Sunset,
  Gauge,
  Wind,
  Sun,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Search,
  Mic,
  AlertCircle,
  RotateCw,
  MapPin,
  Clock,
  ChevronRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { LocationPopover } from '../components/LocationPopover';
import { HomeMiniMap } from '../components/HomeMiniMap';
import AtmosphericArtRenderer from '../components/AtmosphericArtRenderer';
import { getWeatherThemeState } from '../utils/weatherThemeSystem';

/**
 * Deterministic AQI calculation based on atmospheric metrics
 */
function calculateAirQuality(city) {
  if (city?.airQuality) return city.airQuality;

  const wind = city?.windSpeedKmh || 15;
  const visibility = city?.details?.visibilityKm || 10;
  const humidity = city?.humidity || 50;

  let baseAqi = 38;
  if (visibility < 5) baseAqi += 38;
  else if (visibility < 8) baseAqi += 16;

  if (wind < 6) baseAqi += 18;
  else if (wind > 22) baseAqi -= 10;

  if (humidity > 80 && visibility < 6) baseAqi += 14;

  const aqi = Math.max(18, Math.min(185, Math.round(baseAqi)));

  let status = 'Good';
  let color = '#10B981';
  let levelIdx = 0; // 0..5

  if (aqi <= 50) {
    status = 'Good';
    color = '#10B981';
    levelIdx = 0;
  } else if (aqi <= 100) {
    status = 'Moderate';
    color = '#EAB308';
    levelIdx = 1;
  } else if (aqi <= 150) {
    status = 'Unhealthy (Sens.)';
    color = '#F97316';
    levelIdx = 2;
  } else if (aqi <= 200) {
    status = 'Unhealthy';
    color = '#EF4444';
    levelIdx = 3;
  } else {
    status = 'Very Unhealthy';
    color = '#8B5CF6';
    levelIdx = 4;
  }

  return {
    aqi,
    status,
    color,
    levelIdx,
    pm25: Math.round(aqi * 0.42),
    pm10: Math.round(aqi * 0.75),
    o3: Math.round(18 + aqi * 0.12),
    no2: Math.round(8 + aqi * 0.09),
    so2: Math.round(4 + aqi * 0.07)
  };
}

/**
 * UV index severity text helper
 */
function getUvSeverityText(uv) {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

/**
 * Pressure stability label helper
 */
function getPressureStatus(hpa) {
  if (!hpa) return 'Stable';
  if (hpa > 1018) return 'High';
  if (hpa < 1008) return 'Low';
  return 'Stable';
}

export function DashboardPage() {
  const {
    currentCity,
    weatherData,
    formatTemp,
    formatWind,
    loadCityWeather,
    isLoading,
    errorMessage
  } = useWeather();
  const { t } = useTranslation();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [aiSearchInput, setAiSearchInput] = useState('');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Sync city from URL search param if present
  useEffect(() => {
    const cityParam = searchParams.get('city');
    if (cityParam && cityParam.toLowerCase() !== currentCity.toLowerCase()) {
      loadCityWeather(cityParam);
    }
  }, [searchParams, currentCity, loadCityWeather]);

  const city = weatherData || {};
  const currentAlert = city.alerts && city.alerts.length > 0 ? city.alerts[0] : null;

  // Determine actual risk level and styling
  const rawRiskColor = (
    currentAlert?.skycastRiskColour ||
    currentAlert?.riskColour ||
    currentAlert?.displaySeverity ||
    currentAlert?.severity ||
    'green'
  ).toLowerCase();

  const isGreenRisk =
    !currentAlert ||
    rawRiskColor === 'green' ||
    rawRiskColor === 'normal' ||
    rawRiskColor === 'none' ||
    rawRiskColor === 'low' ||
    currentAlert?.hazard === 'none' ||
    currentAlert?.hazardClassification === 'no_warning' ||
    currentAlert?.title?.toLowerCase().includes('normal');

  const riskLabel = isGreenRisk
    ? 'No Active Weather Alerts'
    : rawRiskColor === 'yellow'
      ? 'MODERATE WEATHER RISK'
      : rawRiskColor === 'orange'
        ? 'HIGH WEATHER RISK (BE PREPARED)'
        : 'SEVERE WEATHER RISK (TAKE ACTION)';

  const riskBadgeClass = isGreenRisk
    ? 'green'
    : rawRiskColor === 'yellow'
      ? 'yellow'
      : rawRiskColor === 'orange'
        ? 'orange'
        : 'red';

  // Navigation handlers
  const handleHeroClick = () => {
    navigate(`/details?city=${encodeURIComponent(currentCity)}`);
  };

  const handleDayClick = (dayItem) => {
    const targetDate = dayItem.date || '';
    navigate(`/details?city=${encodeURIComponent(currentCity)}${targetDate ? `&date=${targetDate}` : ''}`);
  };

  const handleRiskClick = () => {
    navigate(`/alerts?city=${encodeURIComponent(currentCity)}`);
  };

  const handleAiSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const clean = aiSearchInput.trim();
    if (clean) {
      navigate(`/weathergpt?city=${encodeURIComponent(currentCity)}&q=${encodeURIComponent(clean)}`);
    } else {
      navigate(`/weathergpt?city=${encodeURIComponent(currentCity)}`);
    }
  };

  const handleQuickQuestionClick = (question) => {
    navigate(`/weathergpt?city=${encodeURIComponent(currentCity)}&q=${encodeURIComponent(question)}`);
  };

  // 8-hour slice for the hourly section with friendly 12-hour AM/PM format
  const hourlyEight = useMemo(() => {
    const hourly = city.hourly || [];
    if (hourly.length === 0) return [];
    return hourly.slice(0, 8).map((h, idx) => {
      if (idx === 0) return { ...h, displayTime: 'Now' };
      // Format hour string (e.g. "14:00" or hour number to "2 PM")
      let hourNum = h.hour !== undefined ? h.hour : parseInt(h.time, 10);
      if (isNaN(hourNum) && h.time && h.time.includes(':')) {
        hourNum = parseInt(h.time.split(':')[0], 10);
      }
      if (!isNaN(hourNum)) {
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const formattedH = hourNum % 12 === 0 ? 12 : hourNum % 12;
        return { ...h, displayTime: `${formattedH} ${ampm}` };
      }
      return { ...h, displayTime: h.time };
    });
  }, [city.hourly]);

  // Air Quality data
  const aqiData = useMemo(() => {
    return calculateAirQuality(city);
  }, [city]);

  // Formatted updated time & current timestamp
  const { formattedDateString, formattedTimeString } = useMemo(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return { formattedDateString: dateStr, formattedTimeString: timeStr };
  }, []);

  const formattedUpdateTime = useMemo(() => {
    if (!city.updatedAt) return t('updated_recently', 'Updated recently');
    try {
      const d = new Date(city.updatedAt);
      return `Updated ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return t('updated_recently', 'Updated recently');
    }
  }, [city.updatedAt, t]);

  const quickQuestions = [
    t('quick_q_tomorrow', 'Will it rain tomorrow?'),
    t('quick_q_umbrella', 'Do I need an umbrella?'),
    t('quick_q_risk', 'Is there any weather risk?'),
    t('quick_q_travel', 'Is it good for travel?')
  ];

  const uvVal = city?.details?.uvIndex ?? city?.daily?.[0]?.uvIndexMax ?? 5;
  const uvText = `${Math.round(uvVal)} ${getUvSeverityText(uvVal)}`;
  const rainProb = city?.insight?.rainChance ?? city?.daily?.[0]?.rainChance ?? 0;
  const pressureVal = city?.details?.pressureHpa ?? 1012;
  const pressureStatus = getPressureStatus(pressureVal);
  const sunriseTime = city?.daily?.[0]?.sunrise || '06:15';
  const sunsetTime = city?.daily?.[0]?.sunset || '18:53';

  // Dynamic Weather & Time Visual Theme State
  const themeState = useMemo(() => {
    if (!city) {
      return getWeatherThemeState({ condition: 'Clear' });
    }
    return getWeatherThemeState({
      condition: city.condition || 'Clear',
      weatherCode: city.weather_code || 0,
      cloudCover: city.details?.cloudCoverPct || 0,
      precipitation: city.details?.precipitationMm || 0,
      rainChance: rainProb || 0,
      hasSevereAlert: !isGreenRisk,
      alertSeverity: currentAlert?.severity || (isGreenRisk ? 'normal' : 'warning'),
      currentTimeStr: city.observedAt || null,
      sunrise: sunriseTime || '06:00',
      sunset: sunsetTime || '18:30'
    });
  }, [city, rainProb, isGreenRisk, currentAlert, sunriseTime, sunsetTime]);

  /* ==========================================================================
     ERROR STATE
     ========================================================================== */
  if (errorMessage && !weatherData && !isLoading) {
    return (
      <div className="home-error-container animate-fade-in">
        <div className="home-error-card">
          <AlertCircle size={44} className="home-error-icon" />
          <h2 className="home-error-title">{t('weather_unavailable', 'Weather information is temporarily unavailable.')}</h2>
          <p className="home-error-desc">
            We were unable to connect to the weather service for <strong>{currentCity}</strong>. Please check your connection or select another city.
          </p>
          <div className="home-error-actions">
            <button
              type="button"
              className="stitch-btn-primary"
              onClick={() => loadCityWeather(currentCity, true)}
            >
              <RotateCw size={16} />
              <span>{t('retry', 'Retry Connection')}</span>
            </button>
            <button
              type="button"
              className="stitch-btn-secondary"
              onClick={() => setIsLocationModalOpen(true)}
            >
              <MapPin size={16} />
              <span>{t('choose_location', 'Choose another location')}</span>
            </button>
          </div>
        </div>
        <LocationPopover
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
        />
      </div>
    );
  }

  /* ==========================================================================
     SKELETON LOADING STATE
     ========================================================================== */
  if (isLoading && !weatherData) {
    return (
      <div className="dashboard-content-flow home-redesign-root animate-pulse">
        <div className="home-top-grid">
          <div className="skeleton-hero-card" />
          <div className="skeleton-stats-grid">
            <div className="skeleton-stat-card" />
            <div className="skeleton-stat-card" />
            <div className="skeleton-stat-card" />
            <div className="skeleton-stat-card" />
          </div>
        </div>
        <div className="home-main-two-col">
          <div className="home-col-left">
            <div className="skeleton-card-block" />
            <div className="home-lower-row-grid">
              <div className="skeleton-card-block" />
              <div className="skeleton-card-block" />
            </div>
          </div>
          <div className="home-col-right">
            <div className="skeleton-card-block-tall" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content-flow home-redesign-root">
      {/* Stale Data Notice Banner (if applicable) */}
      {city.stale && (
        <div className="home-stale-banner" role="status">
          <Clock size={15} />
          <span>{formattedUpdateTime} • {t('data_delayed_note', 'Weather data may be delayed.')}</span>
          <button
            type="button"
            className="home-stale-refresh-btn"
            onClick={() => loadCityWeather(currentCity, true)}
            title="Force refresh live weather"
          >
            <RotateCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* ====================================================================
          1. TOP ROW: HERO WEATHER CARD + 4 HIGHLIGHT STAT CARDS
          ==================================================================== */}
      <div className="home-top-grid">
        {/* HERO WEATHER CARD (Left) */}
        <section
          className={`home-hero-v2-card clickable-card ${themeState.cardClass}`}
          style={{ background: themeState.gradient }}
          onClick={handleHeroClick}
          title="Click to view detailed atmospheric forecast"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => e.key === 'Enter' && handleHeroClick()}
          aria-label={`Current weather in ${city.city || currentCity}: ${city.tempC}°C, ${city.condition}`}
        >
          <div className="hero-v2-main">
            {/* Top row: Date, Time, Atmosphere Tag, and NWP Model */}
            <div className="hero-v2-date-row">
              <div className="hero-v2-datetime-wrap">
                <span className="hero-v2-date-text">
                  {formattedDateString} • {formattedTimeString}
                </span>
                <span className="hero-v2-atmosphere-badge">{themeState.atmosphereTag}</span>
              </div>
              <span className="hero-v2-nwp-badge" title="Numerical Weather Prediction Model backing this forecast">
                {city.nwpModel || 'NOAA GFS'}
              </span>
            </div>

            {/* Middle row: Temp, Condition, High/Low + Weather Graphic */}
            <div className="hero-v2-center-row">
              <div className="hero-v2-temp-group">
                <span className="hero-v2-temp-num">{formatTemp(city.tempC)}</span>
                <div className="hero-v2-condition-wrap">
                  <h2 className="hero-v2-condition-title">{city.condition || 'Partly Cloudy'}</h2>
                  <span className="hero-v2-feels-like">
                    {t('feels_like', 'Feels like')} {formatTemp(city.feelsLikeC)}
                  </span>
                  <div className="hero-v2-hl-pill">
                    <span className="hl-item"><ArrowUp size={12} className="text-emerald-300" /> {formatTemp(city.highC)}</span>
                    <span className="hl-item"><ArrowDown size={12} className="text-sky-300" /> {formatTemp(city.lowC)}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Atmospheric Vector Art */}
              <div className="hero-v2-art-wrap">
                <AtmosphericArtRenderer artType={themeState.artType} />
              </div>
            </div>

            {/* Bottom row: Metrics strip inside hero */}
            <div className="hero-v2-metrics-strip">
              <div className="hero-v2-metric-cell">
                <WaterDropIcon size={16} color="#38BDF8" />
                <div>
                  <span className="metric-cell-label">{t('humidity', 'Humidity')}</span>
                  <span className="metric-cell-val">{city.humidity}%</span>
                </div>
              </div>

              <div className="hero-v2-metric-cell">
                <Wind size={16} className="text-sky-200" />
                <div>
                  <span className="metric-cell-label">{t('wind', 'Wind')}</span>
                  <span className="metric-cell-val">{formatWind(city.windSpeedKmh)}</span>
                </div>
              </div>

              <div className="hero-v2-metric-cell">
                <Sun size={16} className="text-amber-300" />
                <div>
                  <span className="metric-cell-label">UV Index</span>
                  <span className="metric-cell-val">{uvText}</span>
                </div>
              </div>

              <div className="hero-v2-metric-cell">
                <span className="aqi-leaf-icon">🍃</span>
                <div>
                  <span className="metric-cell-label">Air Quality</span>
                  <span className="metric-cell-val">{aqiData.aqi} {aqiData.status}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 QUICK STAT HIGHLIGHT CARDS (Right) */}
        <div className="home-stats-v2-grid">
          {/* Rain Chance Card */}
          <div className="home-stat-v2-card stitch-card clickable-card" onClick={handleHeroClick}>
            <div className="stat-v2-icon-wrap rain-bg">
              <Umbrella size={22} className="text-sky-500" />
            </div>
            <div className="stat-v2-body">
              <span className="stat-v2-label">{t('rain_chance', 'Rain Chance')}</span>
              <span className="stat-v2-value">{rainProb}%</span>
              <span className={`stat-v2-status-pill ${rainProb > 50 ? 'high' : 'low'}`}>
                {rainProb > 50 ? '• High' : '• Low'}
              </span>
            </div>
          </div>

          {/* Sunrise Card */}
          <div className="home-stat-v2-card stitch-card">
            <div className="stat-v2-icon-wrap sun-bg">
              <Sunrise size={22} className="text-amber-500" />
            </div>
            <div className="stat-v2-body">
              <span className="stat-v2-label">{t('sunrise', 'Sunrise')}</span>
              <span className="stat-v2-value">{sunriseTime}</span>
              <span className="stat-v2-sub">Dawn</span>
            </div>
          </div>

          {/* Sunset Card */}
          <div className="home-stat-v2-card stitch-card">
            <div className="stat-v2-icon-wrap sunset-bg">
              <Sunset size={22} className="text-orange-500" />
            </div>
            <div className="stat-v2-body">
              <span className="stat-v2-label">{t('sunset', 'Sunset')}</span>
              <span className="stat-v2-value">{sunsetTime}</span>
              <span className="stat-v2-sub">Dusk</span>
            </div>
          </div>

          {/* Pressure Card */}
          <div className="home-stat-v2-card stitch-card clickable-card" onClick={handleHeroClick}>
            <div className="stat-v2-icon-wrap pressure-bg">
              <Gauge size={22} className="text-emerald-500" />
            </div>
            <div className="stat-v2-body">
              <span className="stat-v2-label">{t('pressure', 'Pressure')}</span>
              <span className="stat-v2-value">{pressureVal} <span className="text-xs font-normal">hPa</span></span>
              <span className="stat-v2-status-pill stable">
                • {pressureStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. WEATHERGPT AI SMART ENTRY & QUICK QUESTIONS
          ==================================================================== */}
      <section className="home-weathergpt-entry-section" aria-label="Ask WeatherGPT">
        <form onSubmit={handleAiSearchSubmit} className="home-weathergpt-entry-bar">
          <div className="home-ai-input-wrap">
            <Sparkles size={18} className="home-ai-sparkle-icon" />
            <input
              type="text"
              className="home-ai-input"
              placeholder={`${t('ask_anything_placeholder', 'Ask WeatherGPT anything about')} ${city.city || currentCity}...`}
              value={aiSearchInput}
              onChange={(e) => setAiSearchInput(e.target.value)}
              aria-label="Ask WeatherGPT anything"
            />
          </div>
          <div className="home-ai-actions-wrap">
            <button
              type="button"
              className="home-ai-mic-btn"
              onClick={() => navigate(`/weathergpt?city=${encodeURIComponent(currentCity)}`)}
              title="Voice query (open AI assistant)"
              aria-label="Voice input"
            >
              <Mic size={17} />
            </button>
            <button
              type="submit"
              className="home-ai-submit-btn"
              aria-label="Send query to WeatherGPT"
            >
              <Search size={16} />
              <span>{t('ask_ai_btn', 'Ask AI')}</span>
            </button>
          </div>
        </form>

        <div className="home-quick-questions-strip" aria-label="Suggested weather questions">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="home-quick-chip"
              onClick={() => handleQuickQuestionClick(q)}
              title={`Ask WeatherGPT: "${q}"`}
            >
              <Sparkles size={12} className="chip-sparkle" />
              <span>{q}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ====================================================================
          3. MAIN TWO-COLUMN BODY:
             LEFT: Hourly Forecast + (Mini Map & AQI)
             RIGHT: 7-Day Forecast (Tall Card)
          ==================================================================== */}
      <div className="home-main-two-col">
        {/* LEFT COLUMN */}
        <div className="home-col-left">
          {/* HOURLY FORECAST STRIP */}
          <section className="home-hourly-v2-card stitch-card" aria-label="Hourly Forecast">
            <div className="card-header-with-link">
              <h3 className="v2-card-title">{t('hourly_forecast', 'Hourly Forecast')}</h3>
              <button
                type="button"
                className="v2-view-link"
                onClick={handleHeroClick}
                aria-label="View Full Forecast"
              >
                <span>{t('view_full_forecast', 'View Full Forecast')}</span>
                <span className="link-arrow">→</span>
              </button>
            </div>

            <div className="hourly-v2-horizontal-strip">
              {hourlyEight.map((hItem, hIdx) => (
                <div
                  key={hIdx}
                  className={`hourly-v2-cell ${hIdx === 0 ? 'active' : ''}`}
                  onClick={handleHeroClick}
                  title={`${hItem.time}: ${formatTemp(hItem.tempC)}, ${hItem.condition}`}
                >
                  <span className="hourly-v2-time">{hItem.displayTime || (hIdx === 0 ? 'Now' : hItem.time)}</span>
                  <div className="hourly-v2-icon-wrap">
                    <WeatherIconRenderer name={hItem.icon} size={26} />
                  </div>
                  <span className="hourly-v2-temp">{formatTemp(hItem.tempC)}</span>
                  <div className="hourly-v2-rain">
                    <WaterDropIcon size={11} color="#0284C7" />
                    <span>{hItem.rainChance}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* LOWER ROW: MINI WEATHER MAP & AIR QUALITY INDEX */}
          <div className="home-lower-row-grid">
            {/* MINI WEATHER MAP */}
            <HomeMiniMap
              city={city.city || currentCity}
              lat={city.latitude}
              lon={city.longitude}
            />

            {/* AIR QUALITY INDEX CARD */}
            <section className="home-aqi-card stitch-card" aria-label="Air Quality Index">
              <div className="aqi-card-header">
                <div>
                  <h3 className="v2-card-title">{t('air_quality_index', 'Air Quality Index')}</h3>
                  <span className="aqi-status-text" style={{ color: aqiData.color }}>
                    {aqiData.status}
                  </span>
                </div>
                <span className="aqi-numeral-badge" style={{ color: aqiData.color }}>
                  {aqiData.aqi}
                </span>
              </div>

              {/* Spectrum bar */}
              <div className="aqi-spectrum-bar-wrap">
                <div className="aqi-spectrum-gradient" />
                <div
                  className="aqi-spectrum-indicator"
                  style={{ left: `${Math.min(100, (aqiData.aqi / 300) * 100)}%` }}
                />
                <div className="aqi-spectrum-labels">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                  <span>150</span>
                  <span>200</span>
                  <span>300+</span>
                </div>
              </div>

              {/* Pollutants Breakdown */}
              <div className="aqi-pollutants-section">
                <span className="pollutants-title">Pollutants Breakdown</span>
                <div className="pollutants-grid">
                  <div className="pollutant-pill pm25">
                    <span className="pollutant-name">PM2.5</span>
                    <span className="pollutant-val">{aqiData.pm25} µg/m³</span>
                  </div>
                  <div className="pollutant-pill pm10">
                    <span className="pollutant-name">PM10</span>
                    <span className="pollutant-val">{aqiData.pm10} µg/m³</span>
                  </div>
                  <div className="pollutant-pill o3">
                    <span className="pollutant-name">O₃</span>
                    <span className="pollutant-val">{aqiData.o3} ppb</span>
                  </div>
                  <div className="pollutant-pill no2">
                    <span className="pollutant-name">NO₂</span>
                    <span className="pollutant-val">{aqiData.no2} ppb</span>
                  </div>
                  <div className="pollutant-pill so2">
                    <span className="pollutant-name">SO₂</span>
                    <span className="pollutant-val">{aqiData.so2} ppb</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* RIGHT COLUMN: 7-DAY FORECAST */}
        <div className="home-col-right">
          <section className="home-seven-day-v2-card stitch-card" aria-label="7-Day Forecast">
            <div className="card-header-with-link">
              <h3 className="v2-card-title">{t('seven_day_forecast', '7-Day Forecast')}</h3>
              <button
                type="button"
                className="v2-view-link"
                onClick={handleHeroClick}
                aria-label="View Full Forecast"
              >
                <span>{t('view_full_forecast', 'View Full Forecast')}</span>
                <span className="link-arrow">→</span>
              </button>
            </div>

            <div className="seven-day-v2-list">
              {city.daily?.map((dayItem, dIdx) => (
                <div
                  key={dIdx}
                  className="seven-day-v2-row"
                  onClick={() => handleDayClick(dayItem)}
                  title={`Click to view full breakdown for ${dayItem.day}`}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => e.key === 'Enter' && handleDayClick(dayItem)}
                >
                  <div className="seven-day-name-col">
                    <span className="day-name">{dIdx === 0 ? 'Today' : dayItem.day}</span>
                    <span className="day-date">{dayItem.date || ''}</span>
                  </div>

                  <div className="seven-day-icon-col">
                    <WeatherIconRenderer name={dayItem.icon} size={22} />
                  </div>

                  <div className="seven-day-condition-col">
                    <span className="condition-text">{dayItem.condition}</span>
                  </div>

                  <div className="seven-day-rain-col">
                    {dayItem.rainChance > 0 ? (
                      <span className="seven-day-rain-pill">
                        <WaterDropIcon size={10} color="#0284C7" />
                        <span>{dayItem.rainChance}%</span>
                      </span>
                    ) : (
                      <span className="seven-day-rain-none">--</span>
                    )}
                  </div>

                  <div className="seven-day-temp-col">
                    <span className="temp-high">{formatTemp(dayItem.highC)}</span>
                    <span className="temp-low">{formatTemp(dayItem.lowC)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ====================================================================
          4. BOTTOM ROW: WEATHER ALERTS & SAFETY CENTER BANNER
          ==================================================================== */}
      <section
        className={`home-alerts-banner-v2 stitch-card clickable-card ${riskBadgeClass}`}
        onClick={handleRiskClick}
        title="Click to open Safety Center & Alerts"
        tabIndex={0}
        role="button"
        onKeyDown={(e) => e.key === 'Enter' && handleRiskClick()}
        aria-label={`Safety Alert: ${riskLabel}`}
      >
        <div className="alerts-banner-left">
          <div className="alerts-shield-badge">
            {isGreenRisk ? (
              <ShieldCheck size={24} className="text-emerald-500" />
            ) : (
              <ShieldAlert size={24} className="text-amber-500" />
            )}
          </div>
          <div>
            <h4 className="alerts-banner-title">{riskLabel}</h4>
            <p className="alerts-banner-desc">
              {currentAlert?.explanation ||
                currentAlert?.title ||
                `Normal meteorological conditions across ${city.city || currentCity}. No active alerts.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="alerts-banner-action-btn"
          onClick={handleRiskClick}
          aria-label="Open Safety Center"
        >
          <span>Safety Center</span>
          <span className="link-arrow">→</span>
        </button>
      </section>

      {/* Location Popover Modal */}
      <LocationPopover
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </div>
  );
}
