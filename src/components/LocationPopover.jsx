import React from 'react';
import { MapPin, Check, Plus, X } from 'lucide-react';
import { useWeather } from '../context/WeatherContext';
import { useNavigate } from 'react-router-dom';

export function LocationPopover({ isOpen, onClose }) {
  const { currentCity, weatherData, savedLocations, loadCityWeather } = useWeather();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSelectLocation = (cityName) => {
    loadCityWeather(cityName);
    navigate(`/?city=${encodeURIComponent(cityName)}`);
    onClose();
  };

  const handleGoToLocations = () => {
    navigate('/locations');
    onClose();
  };

  return (
    <div className="location-popover-backdrop" onClick={onClose}>
      <div className="location-popover-card" onClick={(e) => e.stopPropagation()}>
        <div className="location-popover-header">
          <div className="location-popover-title">
            <MapPin size={16} className="text-red-500" />
            <span>Select Location</span>
          </div>
          <button className="location-popover-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Current active location */}
        <div className="location-popover-section">
          <span className="location-popover-subtitle">Current Location</span>
          <div className="location-popover-current-item">
            <div className="location-popover-item-left">
              <MapPin size={14} fill="#EF4444" stroke="#EF4444" />
              <div>
                <span className="location-popover-item-name">{weatherData?.city || currentCity}</span>
                <span className="location-popover-item-sub">{weatherData?.region || weatherData?.country}</span>
              </div>
            </div>
            <Check size={16} className="text-blue-600" />
          </div>
        </div>

        {/* Saved locations list */}
        <div className="location-popover-section">
          <div className="location-popover-sub-header">
            <span className="location-popover-subtitle">Saved Places</span>
            <button className="location-popover-manage-btn" onClick={handleGoToLocations}>
              Manage
            </button>
          </div>
          <div className="location-popover-list">
            {savedLocations.map((locName) => {
              const isSelected = locName.toLowerCase() === currentCity.toLowerCase();
              return (
                <div
                  key={locName}
                  className={`location-popover-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectLocation(locName)}
                >
                  <span>{locName}</span>
                  {isSelected && <Check size={14} className="text-blue-600" />}
                </div>
              );
            })}
          </div>
        </div>

        <button className="location-popover-add-btn" onClick={handleGoToLocations}>
          <Plus size={14} />
          <span>Add New Location</span>
        </button>
      </div>
    </div>
  );
}
