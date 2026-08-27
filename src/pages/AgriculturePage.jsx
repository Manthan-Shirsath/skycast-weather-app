import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import { fetchAgricultureAdvisory } from '../services/weatherApi';
import {
  Sprout,
  Droplets,
  Wind,
  Sun,
  CloudRain,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Info,
  Calendar
} from 'lucide-react';
import { WaterDropIcon } from '../components/WeatherIcons';

const CROPS = [
  { id: 'Cotton', name: 'Cotton', icon: '🌱' },
  { id: 'Sugarcane', name: 'Sugarcane', icon: '🌾' },
  { id: 'Wheat', name: 'Wheat', icon: '🌾' },
  { id: 'Rice', name: 'Rice', icon: '🌾' },
  { id: 'Soybean', name: 'Soybean', icon: '🌿' },
  { id: 'Tomato', name: 'Tomato', icon: '🍅' },
  { id: 'Onion', name: 'Onion', icon: '🧅' },
  { id: 'Groundnut', name: 'Groundnut', icon: '🥜' }
];

const STAGES = [
  'Sowing',
  'Vegetative',
  'Flowering',
  'Fruiting',
  'Harvesting'
];

export function AgriculturePage() {
  const { currentCity, formatTemp, formatWind, loadCityWeather } = useWeather();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const cityParam = searchParams.get('city') || currentCity || 'Pune';
  const cropParam = searchParams.get('crop') || 'Cotton';
  const stageParam = searchParams.get('stage') || 'Flowering';

  const [selectedCrop, setSelectedCrop] = useState(cropParam);
  const [selectedStage, setSelectedStage] = useState(stageParam);
  const [advisoryData, setAdvisoryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync city from URL if needed
  useEffect(() => {
    if (cityParam && (!currentCity || currentCity.toLowerCase() !== cityParam.toLowerCase())) {
      loadCityWeather(cityParam);
    }
  }, [cityParam, currentCity, loadCityWeather]);

  // Load agriculture advisory from centralized backend
  const loadAdvisory = async (city, crop, stage) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchAgricultureAdvisory(city, crop, stage);
      setAdvisoryData(data);
    } catch (err) {
      console.error('Agriculture advisory error:', err);
      setErrorMsg(err.message || 'Unable to load agricultural advisory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdvisory(cityParam, selectedCrop, selectedStage);
  }, [cityParam, selectedCrop, selectedStage]);

  const handleCropChange = (cropId) => {
    setSelectedCrop(cropId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('crop', cropId);
    setSearchParams(newParams);
  };

  const handleStageChange = (stageName) => {
    setSelectedStage(stageName);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('stage', stageName);
    setSearchParams(newParams);
  };

  const handleAskAi = () => {
    const question = `Can I spray my ${selectedCrop} crop tomorrow in ${cityParam}? (Stage: ${selectedStage})`;
    navigate(`/weathergpt?city=${encodeURIComponent(cityParam)}&q=${encodeURIComponent(question)}`);
  };

  const spray = advisoryData?.spraying_advisory || {};
  const irrigation = advisoryData?.irrigation_advisory || {};
  const cropRisk = advisoryData?.crop_weather_risk || {};
  const weatherSnapshot = advisoryData?.weather_snapshot || {};

  const isOptimalSpray = spray.status === 'OPTIMAL';
  const isModerateSpray = spray.status === 'MODERATE';

  return (
    <div className="agriculture-page-flow animate-fade-in">
      {/* 1. Top Header Banner */}
      <section className="agri-header-card stitch-card">
        <div className="agri-header-top">
          <div className="agri-title-group">
            <div className="agri-icon-wrap">
              <Sprout size={28} className="text-emerald-500" />
            </div>
            <div>
              <h1 className="agri-main-title">{t('agri_title', 'Farmer & Agriculture Advisory')}</h1>
              <p className="agri-main-sub">
                {t('agri_sub', 'Weather-grounded spraying, irrigation, and crop protection intelligence for')} <strong>{cityParam}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            className="stitch-btn-primary agri-ask-ai-btn"
            onClick={handleAskAi}
            title="Ask WeatherGPT AI Crop Advisor"
          >
            <Sparkles size={16} />
            <span>{t('ask_ai_advisor', 'Ask AI Crop Advisor')}</span>
          </button>
        </div>

        {/* Crop Selection Strip */}
        <div className="agri-controls-row">
          <div className="agri-control-group">
            <label className="agri-control-label">{t('select_crop', 'Select Crop')}:</label>
            <div className="agri-crop-chips-wrap">
              {CROPS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`agri-crop-chip ${selectedCrop === c.id ? 'active' : ''}`}
                  onClick={() => handleCropChange(c.id)}
                >
                  <span className="crop-emoji">{c.icon}</span>
                  <span className="crop-name">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="agri-control-group">
            <label className="agri-control-label">{t('growth_stage', 'Growth Stage')}:</label>
            <div className="agri-stage-chips-wrap">
              {STAGES.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`agri-stage-chip ${selectedStage === s ? 'active' : ''}`}
                  onClick={() => handleStageChange(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="agri-grid-layout animate-pulse">
          <div className="skeleton-card-block-tall" />
          <div className="skeleton-card-block-tall" />
        </div>
      )}

      {/* Error Card */}
      {!isLoading && errorMsg && (
        <div className="home-error-card">
          <AlertCircle size={40} className="home-error-icon" />
          <h2 className="home-error-title">Agricultural Advisory Unavailable</h2>
          <p className="home-error-desc">{errorMsg}</p>
          <button
            type="button"
            className="stitch-btn-primary"
            onClick={() => loadAdvisory(cityParam, selectedCrop, selectedStage)}
          >
            <RotateCw size={16} />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Main Advisory Content */}
      {!isLoading && !errorMsg && advisoryData && (
        <div className="agri-grid-layout">
          {/* Left Column: Spraying Suitability & Environmental Metrics */}
          <div className="agri-col-left">
            {/* Spraying Suitability Card */}
            <section className={`agri-card stitch-card spray-status-card ${isOptimalSpray ? 'optimal' : isModerateSpray ? 'moderate' : 'unfavorable'}`}>
              <div className="agri-card-header">
                <div className="card-header-icon-title">
                  {isOptimalSpray ? (
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  ) : isModerateSpray ? (
                    <AlertCircle size={24} className="text-amber-500" />
                  ) : (
                    <AlertTriangle size={24} className="text-rose-500" />
                  )}
                  <div>
                    <span className="agri-card-sub">{t('spraying_suitability', 'Spraying Suitability')}</span>
                    <h2 className="agri-card-title">{spray.status} ({spray.score}/100)</h2>
                  </div>
                </div>
                <span className={`agri-status-pill ${spray.status?.toLowerCase()}`}>
                  {spray.status}
                </span>
              </div>

              <p className="agri-summary-text">{spray.summary}</p>

              <div className="agri-spray-window-box">
                <Clock size={16} className="text-slate-400" />
                <div>
                  <span className="spray-window-label">{t('best_spray_window', 'Recommended Window')}:</span>
                  <span className="spray-window-val">{spray.window}</span>
                </div>
              </div>

              {/* Weather Snapshot Parameters */}
              <div className="agri-metrics-pill-grid">
                <div className="agri-metric-pill">
                  <Sun size={15} className="text-amber-500" />
                  <span>Temp: <strong>{formatTemp(weatherSnapshot.temperature_c)}</strong></span>
                </div>
                <div className="agri-metric-pill">
                  <Wind size={15} className="text-emerald-500" />
                  <span>Wind: <strong>{formatWind(weatherSnapshot.wind_speed_kmh)}</strong></span>
                </div>
                <div className="agri-metric-pill">
                  <Droplets size={15} className="text-cyan-500" />
                  <span>Humidity: <strong>{weatherSnapshot.humidity_pct}%</strong></span>
                </div>
                <div className="agri-metric-pill">
                  <CloudRain size={15} className="text-sky-500" />
                  <span>Rain Chance: <strong>{weatherSnapshot.rain_chance_pct}%</strong></span>
                </div>
              </div>
            </section>

            {/* Irrigation Guidance Card */}
            <section className="agri-card stitch-card">
              <div className="agri-card-header">
                <div className="card-header-icon-title">
                  <Droplets size={22} className="text-sky-500" />
                  <div>
                    <span className="agri-card-sub">{t('irrigation_guidance', 'Irrigation Guidance')}</span>
                    <h2 className="agri-card-title">{irrigation.status}</h2>
                  </div>
                </div>
              </div>
              <p className="agri-summary-text">{irrigation.guidance}</p>
              <div className="agri-irrigation-details">
                <div className="detail-row">
                  <span>Next 48h Rain Probability:</span>
                  <strong>{weatherSnapshot.next_48h_rain_prob_pct}%</strong>
                </div>
                <div className="detail-row">
                  <span>Expected 48h Precipitation:</span>
                  <strong>{weatherSnapshot.expected_rain_48h_mm} mm</strong>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Crop Weather Risk & AI Integration */}
          <div className="agri-col-right">
            {/* Crop Weather Risk Card */}
            <section className={`agri-card stitch-card risk-${cropRisk.level?.toLowerCase() || 'low'}`}>
              <div className="agri-card-header">
                <div className="card-header-icon-title">
                  <ShieldAlert size={22} className="text-slate-700" />
                  <div>
                    <span className="agri-card-sub">{t('crop_weather_risk', 'Crop Weather Risk')}</span>
                    <h2 className="agri-card-title">{cropRisk.level} RISK</h2>
                  </div>
                </div>
                <span className={`agri-status-pill ${cropRisk.level?.toLowerCase() || 'low'}`}>
                  {cropRisk.level}
                </span>
              </div>

              <p className="agri-summary-text">{cropRisk.summary}</p>

              {cropRisk.details && cropRisk.details.length > 0 && (
                <ul className="agri-risk-bullets">
                  {cropRisk.details.map((item, idx) => (
                    <li key={idx}>
                      <Info size={14} className="text-amber-500 flex-shrink-0 mt-1" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="agri-disclaimer-note">
                <Info size={13} className="flex-shrink-0" />
                <span>{advisoryData.disclaimer}</span>
              </div>
            </section>

            {/* AI Action Banner */}
            <section className="agri-ai-banner stitch-card-ai" onClick={handleAskAi}>
              <div className="ai-banner-content">
                <div className="ai-banner-icon">
                  <Sparkles size={24} />
                </div>
                <div className="ai-banner-text">
                  <h3 className="ai-banner-title">Need tailored chemical or irrigation schedule?</h3>
                  <p className="ai-banner-desc">
                    Ask WeatherGPT for conversational, field-specific insights grounded in real live data.
                  </p>
                </div>
              </div>
              <ArrowRight size={20} className="ai-banner-arrow" />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
