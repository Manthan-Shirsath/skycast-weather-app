import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import {
  HeroSunIcon,
  WeatherIconRenderer,
  WaterDropIcon
} from '../components/WeatherIcons';
import {
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Wind,
  CloudRain,
  Eye,
  Thermometer,
  Sparkles,
  Mic,
  Search,
  Clock,
  Shield,
  ShieldAlert,
  Calendar,
  Sun,
  Sunset,
  Sunrise,
  Moon,
  RotateCw,
  MapPin,
  RefreshCw,
  Umbrella,
  Compass
} from 'lucide-react';
import { LocationPopover } from '../components/LocationPopover';

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

  const isGreenRisk = !currentAlert ||
    rawRiskColor === 'green' ||
    rawRiskColor === 'normal' ||
    rawRiskColor === 'none' ||
    rawRiskColor === 'low' ||
    currentAlert?.hazard === 'none' ||
    currentAlert?.hazardClassification === 'no_warning' ||
    currentAlert?.title?.toLowerCase().includes('normal');

  const riskLabel = isGreenRisk
    ? 'LOW / NORMAL'
    : rawRiskColor === 'yellow'
      ? 'MODERATE'
      : rawRiskColor === 'orange'
        ? 'HIGH (BE PREPARED)'
        : 'SEVERE (TAKE ACTION)';

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

  // Extract 'Today at a Glance' 4 time intervals (Morning, Afternoon, Evening, Night)
  const todayAtAGlance = useMemo(() => {
    const hourly = city.hourly || [];
    if (hourly.length === 0) return [];

    const slots = [
      { name: 'Morning', icon: 'sun-cloud', fallbackIdx: 2 },
      { name: 'Afternoon', icon: 'sun', fallbackIdx: 4 },
      { name: 'Evening', icon: 'cloud-sun', fallbackIdx: 6 },
      { name: 'Night', icon: 'moon', fallbackIdx: 8 }
    ];

    return slots.map((slot, idx) => {
      // Pick representative hour or fallback from hourly list
      const hItem = hourly[Math.min(slot.fallbackIdx, hourly.length - 1)] || hourly[idx] || {};
      return {
        period: slot.name,
        time: hItem.time || `${idx * 4 + 6}:00`,
        tempC: hItem.tempC ?? (city.tempC ? city.tempC - (idx === 3 ? 4 : idx === 1 ? -2 : 0) : 24),
        condition: hItem.condition || city.condition || 'Clear',
        icon: hItem.icon || slot.icon,
        rainChance: hItem.rainChance ?? (city.insight?.rainChance ?? 0)
      };
    });
  }, [city.hourly, city.tempC, city.condition, city.insight]);

  // Quick prompt questions from translations
  const quickQuestions = [
    t('quick_q_tomorrow', 'Will it rain tomorrow?'),
    t('quick_q_umbrella', 'Do I need an umbrella?'),
    t('quick_q_risk', 'Is there any weather risk?'),
    t('quick_q_travel', 'Is it good for travel?')
  ];

  // Formatted updated time
  const formattedUpdateTime = useMemo(() => {
    if (!city.updatedAt) return t('updated_recently', 'Updated recently');
    try {
      const d = new Date(city.updatedAt);
      return `Updated ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return t('updated_recently', 'Updated recently');
    }
  }, [city.updatedAt, t]);

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
              <span>{t('try_again', 'Try again')}</span>
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
      <div className="dashboard-content-flow home-skeleton-flow animate-pulse">
        {/* Hero Skeleton */}
        <div className="home-hero-skeleton" />
        <div className="skeleton-bar" />
        <div className="home-lower-grid">
          <div className="home-lower-left">
            <div className="skeleton-card-block" />
            <div className="skeleton-card-block" />
          </div>
          <div className="home-lower-right">
            <div className="skeleton-card-block-tall" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content-flow home-experience-root">
      {/* 1. Stale Data Notice Banner (if applicable) */}
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

      {/* 2. WEATHER HERO CARD */}
      <section
        className="home-weather-hero clickable-card"
        onClick={handleHeroClick}
        title="Click to view detailed atmospheric breakdown"
        tabIndex={0}
        role="button"
        onKeyDown={(e) => e.key === 'Enter' && handleHeroClick()}
        aria-label={`Current weather in ${city.city || currentCity}: ${city.tempC}°C, ${city.condition}`}
      >
        <div className="home-hero-content">
          <div className="home-hero-location-row">
            <MapPin size={18} className="home-hero-pin" />
            <span className="home-hero-city">{city.city || currentCity}</span>
            <span className="home-hero-country">{city.country || 'India'}</span>
          </div>

          <div className="home-hero-temp-row">
            <span className="home-hero-temp stitch-display-temp">{formatTemp(city.tempC)}</span>
            <div className="home-hero-condition-group">
              <span className="home-hero-condition">{city.condition || 'Partly Cloudy'}</span>
              <span className="home-hero-feels-like">
                {t('feels_like', 'Feels like')} {formatTemp(city.feelsLikeC)} • H: {formatTemp(city.highC)} L: {formatTemp(city.lowC)}
              </span>
            </div>
          </div>

          <div className="home-hero-metrics-row">
            <div className="home-hero-metric-chip" title="Humidity">
              <WaterDropIcon size={14} color="#38BDF8" />
              <span>{t('humidity', 'Humidity')}: <strong>{city.humidity}%</strong></span>
            </div>
            <div className="home-hero-metric-chip" title="Wind Speed">
              <Wind size={14} className="text-slate-200" />
              <span>{t('wind', 'Wind')}: <strong>{formatWind(city.windSpeedKmh)}</strong></span>
            </div>
            <div className="home-hero-updated-chip" title="Numerical Weather Prediction: NOAA GFS via Open-Meteo">
              <Clock size={12} />
              <span>{city.nwpModel ? `Powered by GFS • ${formattedUpdateTime}` : `Powered by GFS via Open-Meteo • ${formattedUpdateTime}`}</span>
            </div>
          </div>
        </div>

        <div className="home-hero-illustration">
          <HeroSunIcon className="hero-sun-svg" />
        </div>
      </section>

      {/* 3. WEATHERGPT ENTRY BAR */}
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

        {/* 4. QUICK QUESTIONS CHIPS */}
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

      {/* 5. TWO-COLUMN MAIN BODY (Today at a Glance, Rain Today, Weather Risk, 7-Day Outlook) */}
      <div className="home-lower-grid">
        {/* Left Column: Today at a Glance + Rain Today + Weather Risk */}
        <div className="home-lower-left">
          {/* Today at a Glance */}
          <section className="home-glance-card stitch-card" aria-label="Today at a Glance">
            <div className="card-section-header">
              <h2 className="card-section-title">{t('today_at_a_glance', 'Today at a Glance')}</h2>
              <span className="card-section-sub">{t('progression_sub', 'Morning to Night progression')}</span>
            </div>

            <div className="home-glance-periods-grid">
              {todayAtAGlance.map((slot, sIdx) => (
                <div key={sIdx} className="home-glance-period-cell">
                  <span className="period-name">{slot.period}</span>
                  <div className="period-icon-wrap">
                    <WeatherIconRenderer name={slot.icon} size={24} />
                  </div>
                  <span className="period-temp stitch-numeral">{formatTemp(slot.tempC)}</span>
                  <span className="period-rain">
                    <WaterDropIcon size={10} color="#38BDF8" />
                    <span>{slot.rainChance}%</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Rain Today & Outlook Insight */}
          <section
            className="home-rain-card stitch-card clickable-card"
            onClick={handleHeroClick}
            title="Click to view full precipitation charts"
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && handleHeroClick()}
            aria-label="Rain Today Information"
          >
            <div className="home-rain-top">
              <div className="home-rain-header-group">
                <div className="rain-icon-badge">
                  <CloudRain size={18} />
                </div>
                <div>
                  <h2 className="card-section-title">{t('rain_today', 'Rain Today')}</h2>
                  <span className="card-section-sub">
                    {city.insight?.rainChance > 30 ? t('rain_expected', 'Rain expected today') : t('low_rain_prob', 'Low chance of precipitation')}
                  </span>
                </div>
              </div>
              <div className="home-rain-prob-badge">
                <span>{city.insight?.rainChance ?? 0}% Probability</span>
              </div>
            </div>

            <p className="home-rain-desc">
              {city.insight?.description || 'Cloud cover and ambient atmospheric pressure remain stable throughout the day.'}
            </p>

            <div className="home-rain-footer">
              <span className="home-rain-detail-link">{t('view_timeline', 'View Hourly Rain Timeline →')}</span>
            </div>
          </section>

          {/* Weather Risk Card */}
          <section
            className={`home-risk-card stitch-card clickable-card ${riskBadgeClass}`}
            onClick={handleRiskClick}
            title="Click to view Skycast Safety Center & Risk details"
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === 'Enter' && handleRiskClick()}
            aria-label={`Weather Risk: ${riskLabel}`}
          >
            <div className="home-risk-header">
              <div className="home-risk-title-group">
                <ShieldAlert size={20} className="home-risk-icon" />
                <div>
                  <div className="home-risk-sub-badge">{t('skycast_risk', 'Skycast Weather Risk')}</div>
                  <h2 className="home-risk-main-status">{riskLabel}</h2>
                </div>
              </div>
              <ChevronRight size={18} className="home-risk-arrow" />
            </div>

            <p className="home-risk-explanation">
              {currentAlert?.explanation || currentAlert?.title || 'Normal meteorological baseline. No active adverse weather triggers.'}
            </p>

            <div className="home-risk-footer">
              <span className="home-risk-framework-note">{t('imd_criteria_note', 'Based on published IMD warning framework criteria')}</span>
              <span className="home-risk-action-link">{t('safety_center', 'Safety Center →')}</span>
            </div>
          </section>
        </div>

        {/* Right Column: 7-Day Outlook */}
        <div className="home-lower-right">
          <section className="home-forecast-card stitch-card" aria-label="7-Day Outlook">
            <div className="card-section-header">
              <h2 className="card-section-title">{t('seven_day_outlook', '7-Day Outlook')}</h2>
              <span className="card-section-sub">{t('daily_sub', 'Daily temperature & rain forecast')}</span>
            </div>

            <div className="home-forecast-list">
              {city.daily?.map((dayItem, dIdx) => (
                <div
                  key={dIdx}
                  className="home-forecast-row-item"
                  onClick={() => handleDayClick(dayItem)}
                  title={`Click to view full hourly breakdown for ${dayItem.day}`}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => e.key === 'Enter' && handleDayClick(dayItem)}
                >
                  <div className="home-forecast-day-col">
                    <span className="forecast-day-name">{dIdx === 0 ? 'Today' : dayItem.day}</span>
                    <span className="forecast-day-date">{dayItem.date || ''}</span>
                  </div>

                  <div className="home-forecast-condition-col">
                    <WeatherIconRenderer name={dayItem.icon} size={22} />
                    <span className="forecast-condition-text">{dayItem.condition}</span>
                  </div>

                  <div className="home-forecast-rain-col">
                    {dayItem.rainChance > 0 ? (
                      <span className="forecast-rain-pill">
                        <WaterDropIcon size={11} color="#0284C7" />
                        <span>{dayItem.rainChance}%</span>
                      </span>
                    ) : (
                      <span className="forecast-rain-none">--</span>
                    )}
                  </div>

                  <div className="home-forecast-temp-col">
                    <span className="forecast-high stitch-numeral">{formatTemp(dayItem.highC)}</span>
                    <span className="forecast-low stitch-numeral">{formatTemp(dayItem.lowC)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
