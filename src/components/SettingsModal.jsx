import React from 'react';
import { X, Globe, Volume2, Bell, Sparkles } from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';

export function SettingsModal({ isOpen, onClose }) {
  const { unit, setUnit, windUnit, setWindUnit, loadCityWeather } = useWeather();
  const { language, changeLanguage, supportedLanguages, t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const quickCities = ['Pune', 'Mumbai', 'New Delhi', 'Bengaluru', 'London', 'New York', 'Tokyo'];

  const handleQuickCity = (city) => {
    loadCityWeather(city);
    navigate(`/?city=${encodeURIComponent(city)}`);
    onClose();
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-overlay animate-scale-up" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">{t('nav_settings', 'Settings & Preferences')}</span>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close Settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. Language Selection (11 Indian & Global Languages) */}
        <div className="settings-group">
          <div className="settings-label-row">
            <Globe size={15} className="text-violet-500" />
            <label className="settings-label">Language / भाषा / भाषा</label>
          </div>
          <div className="settings-lang-grid">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`settings-lang-btn ${language === lang.code ? 'active' : ''}`}
                onClick={() => changeLanguage(lang.code)}
              >
                <span className="lang-native">{lang.nativeName}</span>
                <span className="lang-en">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Temperature Unit */}
        <div className="settings-group">
          <label className="settings-label">Temperature Unit</label>
          <div className="settings-options">
            <button
              type="button"
              className={`settings-opt-btn ${unit === 'C' ? 'active' : ''}`}
              onClick={() => setUnit('C')}
            >
              Celsius (°C)
            </button>
            <button
              type="button"
              className={`settings-opt-btn ${unit === 'F' ? 'active' : ''}`}
              onClick={() => setUnit('F')}
            >
              Fahrenheit (°F)
            </button>
          </div>
        </div>

        {/* 3. Wind Speed Unit */}
        <div className="settings-group">
          <label className="settings-label">Wind Speed Unit</label>
          <div className="settings-options three-col">
            <button
              type="button"
              className={`settings-opt-btn ${windUnit === 'km/h' ? 'active' : ''}`}
              onClick={() => setWindUnit('km/h')}
            >
              km/h
            </button>
            <button
              type="button"
              className={`settings-opt-btn ${windUnit === 'mph' ? 'active' : ''}`}
              onClick={() => setWindUnit('mph')}
            >
              mph
            </button>
            <button
              type="button"
              className={`settings-opt-btn ${windUnit === 'm/s' ? 'active' : ''}`}
              onClick={() => setWindUnit('m/s')}
            >
              m/s
            </button>
          </div>
        </div>

        {/* 4. Quick Locations */}
        <div className="settings-group" style={{ marginBottom: 0 }}>
          <label className="settings-label">Quick Locations</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {quickCities.map((qCity) => (
              <button
                key={qCity}
                type="button"
                className="settings-opt-btn"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => handleQuickCity(qCity)}
              >
                {qCity}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
