import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Popup,
  GeoJSON,
  useMap,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useWeather } from '../context/WeatherContext';
import {
  fetchMapWeather,
  fetchRadarMetadata,
  fetchPointWeather,
  connectWeatherWebSocket
} from '../services/weatherApi';

import {
  Thermometer,
  CloudRain,
  Wind,
  Cloud,
  Gauge,
  Droplets,
  Eye,
  Plus,
  Minus,
  Locate,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Layers as LayersIcon,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Map as MapIcon,
  Radar as RadarIcon,
  Satellite as SatelliteIcon,
  Activity,
  Leaf
} from 'lucide-react';
import { WeatherIconRenderer } from '../components/WeatherIcons';

// Helper component for map camera control & clicks
function MapController({ center, zoom, onMapClick }) {
  const map = useMap();

  useEffect(() => {
    if (center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom || 6, { duration: 1.2 });
    }
  }, [center, zoom, map]);

  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng);
      }
    }
  });

  return null;
}

// Custom Zoom and Locate controls
function MapZoomControls({ onZoomIn, onZoomOut, onLocate, isLocating }) {
  return (
    <div className="map-zoom-controls-floating">
      <button
        type="button"
        className="map-zoom-btn"
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
      >
        <Plus size={16} />
      </button>
      <button
        type="button"
        className="map-zoom-btn"
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        className={`map-zoom-btn ${isLocating ? 'locating' : ''}`}
        onClick={onLocate}
        title="Locate Me"
        aria-label="Locate Me"
      >
        {isLocating ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Locate size={16} />}
      </button>
    </div>
  );
}

export function MapPage() {
  const { currentCity, weatherData, formatTemp, formatWind, loadCityWeather, unit } = useWeather();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode and layer toggles
  const [mapMode, setMapMode] = useState('live'); // 'live' | 'radar' | 'satellite' | 'wind'
  const [activeLayers, setActiveLayers] = useState({
    Temperature: true,
    'Rain Radar': true,
    Wind: false,
    Clouds: true,
    Pressure: false,
    Humidity: false,
    Visibility: false
  });
  const [isLayersCardVisible, setIsLayersCardVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false);

  const [citiesData, setCitiesData] = useState([]);
  const [radarMeta, setRadarMeta] = useState(null);
  const [indiaBoundary, setIndiaBoundary] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [pointWeather, setPointWeather] = useState(null);
  const [isStaleData, setIsStaleData] = useState(false);

  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState(null);

  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Central India
  const [mapZoom, setMapZoom] = useState(5);
  const mapRef = useRef(null);
  const mapContainerWrapperRef = useRef(null);

  const cityParam = searchParams.get('city');

  // Load Official Survey of India Boundary
  useEffect(() => {
    fetch('/india-boundary.json')
      .then((res) => {
        if (!res.ok) throw new Error('Boundary file not found');
        return res.json();
      })
      .then((data) => setIndiaBoundary(data))
      .catch((err) => console.warn('Could not load official India boundary GeoJSON:', err));
  }, []);

  // Fetch Centralized Map Weather Dataset
  const loadMapData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingCities(true);
    try {
      const data = await fetchMapWeather();
      setCitiesData(data.cities || []);
      setIsStaleData(!!data.stale);
      setNoticeMessage(null);
    } catch (err) {
      console.error('Map data fetch failed:', err);
      setNoticeMessage('Weather data unavailable (retrying...)');
    } finally {
      setIsLoadingCities(false);
    }
  }, []);

  // Fetch RainViewer Radar Metadata
  const loadRadar = useCallback(async () => {
    setIsLoadingRadar(true);
    try {
      const radar = await fetchRadarMetadata();
      setRadarMeta(radar);
    } catch (err) {
      console.error('Radar metadata fetch failed:', err);
      setNoticeMessage('Radar temporarily unavailable');
    } finally {
      setIsLoadingRadar(false);
    }
  }, []);

  useEffect(() => {
    loadMapData(true);
    loadRadar();

    const ws = connectWeatherWebSocket((msg) => {
      if (msg.type === 'radar_update' && msg.data) {
        setRadarMeta(msg.data);
      } else if (msg.type === 'weather_update') {
        loadMapData(false);
      }
    }, currentCity);

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [loadMapData, loadRadar, currentCity]);

  // Center on city from query param or context
  useEffect(() => {
    const targetCityName = (cityParam || currentCity || 'Pune').toLowerCase();
    if (citiesData.length > 0 && targetCityName) {
      const found = citiesData.find((c) => c.name.toLowerCase() === targetCityName);
      if (found) {
        setMapCenter([found.latitude, found.longitude]);
        setMapZoom(6);
        setSelectedCity(found);
        setPointWeather(null);
      }
    }
  }, [cityParam, currentCity, citiesData]);

  const toggleLayer = (layerName) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerName]: !prev[layerName]
    }));
  };

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (mapContainerWrapperRef.current?.requestFullscreen) {
        mapContainerWrapperRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setNoticeMessage('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setNoticeMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
        setMapZoom(8);
        setSelectedCity(null);
        try {
          const ptData = await fetchPointWeather(latitude, longitude);
          setPointWeather({
            name: 'Your Location',
            latitude,
            longitude,
            ...ptData
          });
        } catch (err) {
          console.error('Point lookup failed:', err);
          setNoticeMessage('Failed to fetch weather for your exact location.');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setNoticeMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied.'
            : 'Unable to retrieve your current location.'
        );
        setTimeout(() => setNoticeMessage(null), 5000);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleMapClick = async (latlng) => {
    try {
      const ptData = await fetchPointWeather(latlng.lat, latlng.lng);
      setSelectedCity(null);
      setPointWeather({
        name: `Coordinates (${latlng.lat.toFixed(2)}, ${latlng.lng.toFixed(2)})`,
        latitude: latlng.lat,
        longitude: latlng.lng,
        ...ptData
      });
    } catch (err) {
      console.error('Point click error:', err);
    }
  };

  // Custom city marker with clean badge design
  const createMarkerIcon = useCallback(
    (city) => {
      const isSelected =
        (selectedCity && selectedCity.name === city.name) ||
        (cityParam && cityParam.toLowerCase() === city.name.toLowerCase());

      const tempDisplay = formatTemp(city.temperature);

      const html = `
        <div class="map-v2-marker-pill ${isSelected ? 'selected-pin' : ''}">
          <span class="marker-city-name">${city.name}</span>
          <span class="marker-city-temp">${tempDisplay}</span>
          ${isSelected ? '<div class="marker-selected-pulse"></div>' : ''}
        </div>
      `;

      return L.divIcon({
        className: 'map-v2-leaflet-div-icon',
        html: html,
        iconSize: [100, 32],
        iconAnchor: [50, 16]
      });
    },
    [selectedCity, cityParam, formatTemp]
  );

  const activeInspectorCity = selectedCity || pointWeather || (citiesData.length > 0 ? citiesData[0] : null);

  const layerItems = [
    { name: 'Temperature', icon: Thermometer },
    { name: 'Rain Radar', icon: CloudRain },
    { name: 'Wind', icon: Wind },
    { name: 'Clouds', icon: Cloud },
    { name: 'Pressure', icon: Gauge },
    { name: 'Humidity', icon: Droplets },
    { name: 'Visibility', icon: Eye }
  ];

  return (
    <div className="map-v2-page-root animate-fade-in" ref={mapContainerWrapperRef}>
      {/* 1. Header & View Switcher Row */}
      <section className="map-v2-header-section">
        <div className="map-v2-title-wrap">
          <h1 className="map-v2-main-title">Weather Map</h1>
          <p className="map-v2-main-subtitle">
            Live weather conditions, radar, and atmospheric data across India.
          </p>
        </div>

        <div className="map-v2-actions-row">
          {/* Mode Switcher Pills */}
          <div className="map-mode-switcher-pills" role="tablist" aria-label="Map Mode">
            <button
              type="button"
              className={`mode-pill-btn ${mapMode === 'live' ? 'active' : ''}`}
              onClick={() => setMapMode('live')}
            >
              <MapIcon size={14} />
              <span>Live Map</span>
            </button>
            <button
              type="button"
              className={`mode-pill-btn ${mapMode === 'radar' ? 'active' : ''}`}
              onClick={() => {
                setMapMode('radar');
                setActiveLayers((prev) => ({ ...prev, 'Rain Radar': true }));
              }}
            >
              <RadarIcon size={14} />
              <span>Radar</span>
            </button>
            <button
              type="button"
              className={`mode-pill-btn ${mapMode === 'satellite' ? 'active' : ''}`}
              onClick={() => setMapMode('satellite')}
            >
              <SatelliteIcon size={14} />
              <span>Satellite</span>
            </button>
            <button
              type="button"
              className={`mode-pill-btn ${mapMode === 'wind' ? 'active' : ''}`}
              onClick={() => {
                setMapMode('wind');
                setActiveLayers((prev) => ({ ...prev, Wind: true }));
              }}
            >
              <Activity size={14} />
              <span>Wind Flow</span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="map-right-actions">
            <button
              type="button"
              className={`map-action-btn ${isLayersCardVisible ? 'active' : ''}`}
              onClick={() => setIsLayersCardVisible((prev) => !prev)}
              title="Toggle Layer Controls"
            >
              <LayersIcon size={15} />
              <span>Layers</span>
            </button>
            <button
              type="button"
              className="map-action-btn"
              onClick={toggleFullscreen}
              title="Fullscreen Map"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>Fullscreen</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Interactive Map Viewport with Floating Cards */}
      <section className="map-v2-canvas-container">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', borderRadius: '24px' }}
          ref={mapRef}
        >
          <MapController center={mapCenter} zoom={mapZoom} onMapClick={handleMapClick} />

          {/* Tile Layer (OSM Base) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />

          {/* Official Survey of India Sovereign Boundary */}
          {indiaBoundary && (
            <GeoJSON
              key="india-sovereign-boundary"
              data={indiaBoundary}
              style={{
                color: '#3B82F6',
                weight: 2.4,
                opacity: 0.9,
                fillColor: '#60A5FA',
                fillOpacity: 0.04
              }}
            />
          )}

          {/* RainViewer Weather Radar Overlay */}
          {activeLayers['Rain Radar'] && radarMeta && radarMeta.tileUrl && (
            <TileLayer
              key={radarMeta.timestamp || 'radar-layer'}
              url={radarMeta.tileUrl}
              opacity={0.65}
              zIndex={500}
              attribution={radarMeta.attribution || 'Weather radar by RainViewer'}
            />
          )}

          {/* Alert Affected Area Polygons */}
          {(weatherData?.alerts || [])
            .filter((a) => a.polygon && a.polygon.length > 2)
            .map((alertItem) => (
              <Polygon
                key={alertItem.id}
                positions={alertItem.polygon}
                pathOptions={{
                  color: '#E11D48',
                  fillColor: '#E11D48',
                  fillOpacity: 0.2,
                  weight: 2,
                  dashArray: '4, 4'
                }}
              >
                <Popup>
                  <div className="font-bold text-red-600">🔴 {alertItem.title || alertItem.event}</div>
                  <div className="text-xs text-slate-600 mt-1">{alertItem.instructions}</div>
                </Popup>
              </Polygon>
            ))}

          {/* City Weather Markers */}
          {citiesData.map((city) => (
            <Marker
              key={city.name}
              position={[city.latitude, city.longitude]}
              icon={createMarkerIcon(city)}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  setSelectedCity(city);
                  setPointWeather(null);
                }
              }}
            />
          ))}

          {/* Point Click Marker */}
          {pointWeather && (
            <Marker
              position={[pointWeather.latitude, pointWeather.longitude]}
              icon={L.divIcon({
                className: 'map-v2-leaflet-div-icon',
                html: `
                  <div class="map-v2-marker-pill selected-pin">
                    <span class="marker-city-name">${pointWeather.name}</span>
                    <span class="marker-city-temp">${formatTemp(pointWeather.temperature)}</span>
                  </div>
                `,
                iconSize: [110, 32],
                iconAnchor: [55, 16]
              })}
            />
          )}
        </MapContainer>

        {/* Floating Top-Left Layer Selector Card */}
        {isLayersCardVisible && (
          <div className="map-v2-layers-card animate-scale-up">
            <h3 className="layers-card-title">Weather Layers</h3>
            <div className="layers-card-list">
              {layerItems.map((layer) => {
                const Icon = layer.icon;
                const isChecked = activeLayers[layer.name];
                return (
                  <label
                    key={layer.name}
                    className={`layer-card-item ${isChecked ? 'active' : ''}`}
                  >
                    <div className="layer-item-left">
                      <Icon size={16} className={isChecked ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className="layer-item-name">{layer.name}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleLayer(layer.name)}
                      className="layer-item-checkbox"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Bottom-Left Color Legend Card */}
        <div className="map-v2-legend-card">
          <span className="map-v2-legend-title">Temperature (°{unit})</span>
          <div className="map-v2-gradient-bar" />
          <div className="map-v2-legend-ticks">
            <span>0°</span>
            <span>15°</span>
            <span>25°</span>
            <span>35°</span>
            <span>45°</span>
          </div>
        </div>

        {/* Floating Top-Right Location Inspector Card */}
        {activeInspectorCity && (
          <div className="map-v2-inspector-card animate-scale-up">
            <div className="inspector-card-header">
              <div>
                <h3 className="inspector-city-title">{activeInspectorCity.name}</h3>
                <span className="inspector-city-sub">
                  {activeInspectorCity.region || 'Maharashtra, India'}
                </span>
              </div>
              <button
                type="button"
                className="inspector-close-btn"
                onClick={() => {
                  setSelectedCity(null);
                  setPointWeather(null);
                }}
                aria-label="Close Inspector"
              >
                <X size={15} />
              </button>
            </div>

            {/* Temperature & Condition Row */}
            <div className="inspector-hero-row">
              <span className="inspector-temp-val">{formatTemp(activeInspectorCity.temperature)}</span>
              <div className="inspector-cond-wrap">
                <WeatherIconRenderer name={activeInspectorCity.icon || 'partly-cloudy'} size={28} />
                <span className="inspector-cond-text">
                  {activeInspectorCity.condition || 'Partly Cloudy'}
                </span>
              </div>
            </div>

            {/* Detailed Meteorological Metrics List */}
            <div className="inspector-metrics-list">
              <div className="inspector-metric-row">
                <span className="metric-row-label">
                  <Droplets size={14} className="text-blue-500" /> Rain chance
                </span>
                <span className="metric-row-val">
                  {activeInspectorCity.rainChance ?? activeInspectorCity.rain_probability ?? 98}%
                </span>
              </div>
              <div className="inspector-metric-row">
                <span className="metric-row-label">
                  <Wind size={14} className="text-emerald-500" /> Wind
                </span>
                <span className="metric-row-val">
                  {formatWind(activeInspectorCity.windSpeed ?? activeInspectorCity.wind_speed ?? 26)} (
                  {activeInspectorCity.windDirection || 'W'})
                </span>
              </div>
              <div className="inspector-metric-row">
                <span className="metric-row-label">
                  <Cloud size={14} className="text-sky-400" /> Cloud cover
                </span>
                <span className="metric-row-val">
                  {activeInspectorCity.cloudCover ?? activeInspectorCity.cloud_cover ?? 60}%
                </span>
              </div>
              <div className="inspector-metric-row">
                <span className="metric-row-label">
                  <Gauge size={14} className="text-purple-500" /> Pressure
                </span>
                <span className="metric-row-val">
                  {activeInspectorCity.pressure || 1007} hPa
                </span>
              </div>
              <div className="inspector-metric-row">
                <span className="metric-row-label">
                  <Droplets size={14} className="text-cyan-500" /> Humidity
                </span>
                <span className="metric-row-val">
                  {activeInspectorCity.humidity || 62}%
                </span>
              </div>
              <div className="inspector-metric-row">
                <span className="metric-row-label">
                  <Eye size={14} className="text-amber-500" /> Visibility
                </span>
                <span className="metric-row-val">
                  {activeInspectorCity.visibility || 10} km
                </span>
              </div>
            </div>

            {/* Active Warning Banner (if warning or active alerts present) */}
            {(activeInspectorCity.hasAlert ||
              ['extreme', 'severe', 'warning'].includes(activeInspectorCity.alertSeverity)) && (
              <div
                className="inspector-alert-banner"
                onClick={() => {
                  const targetName = activeInspectorCity.name.includes('Coordinates')
                    ? currentCity
                    : activeInspectorCity.name;
                  loadCityWeather(targetName);
                  navigate(`/alerts?city=${encodeURIComponent(targetName)}`);
                }}
                role="button"
                tabIndex={0}
              >
                <AlertTriangle size={14} className="text-amber-600" />
                <span>Active Warning • Inspect</span>
              </div>
            )}

            {/* View Full Weather Button */}
            <button
              type="button"
              className="inspector-action-btn"
              onClick={() => {
                const targetName = activeInspectorCity.name.includes('Coordinates')
                  ? currentCity
                  : activeInspectorCity.name;
                loadCityWeather(targetName);
                navigate(`/?city=${encodeURIComponent(targetName)}`);
              }}
            >
              <span>View full weather</span>
              <ExternalLink size={14} />
            </button>
          </div>
        )}

        {/* Floating Bottom-Right Zoom & Locate Controls */}
        <MapZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocate={handleLocateMe}
          isLocating={isLocating}
        />
      </section>

      {/* 3. Bottom 5-Card Metrics Strip */}
      <section className="map-v2-bottom-metrics-strip">
        {/* 1. Precipitation */}
        <div className="stitch-card map-bottom-stat-card">
          <div className="stat-card-icon-wrap blue">
            <CloudRain size={20} className="text-blue-500" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Precipitation (24h)</span>
            <span className="stat-card-main-val">
              {weatherData?.insight?.rainfallMm ?? 0} mm
            </span>
            <span className="stat-card-sub-val">No recent rainfall</span>
          </div>
        </div>

        {/* 2. Wind */}
        <div className="stitch-card map-bottom-stat-card">
          <div className="stat-card-icon-wrap emerald">
            <Wind size={20} className="text-emerald-500" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Wind (Avg)</span>
            <span className="stat-card-main-val">
              {formatWind(weatherData?.windSpeedKmh ?? 26)}
            </span>
            <span className="stat-card-sub-val">West</span>
          </div>
        </div>

        {/* 3. Air Quality */}
        <div className="stitch-card map-bottom-stat-card">
          <div className="stat-card-icon-wrap green">
            <Leaf size={20} className="text-emerald-500" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Air Quality (AQI)</span>
            <span className="stat-card-main-val text-emerald-600">
              {weatherData?.airQuality?.overallAqi ?? 42}
            </span>
            <span className="stat-card-sub-val text-emerald-600 font-semibold">Good</span>
          </div>
        </div>

        {/* 4. Pressure */}
        <div className="stitch-card map-bottom-stat-card">
          <div className="stat-card-icon-wrap purple">
            <Gauge size={20} className="text-purple-500" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Pressure (Avg)</span>
            <span className="stat-card-main-val">
              {weatherData?.details?.pressureHpa ?? 1007} hPa
            </span>
            <span className="stat-card-sub-val">Normal</span>
          </div>
        </div>

        {/* 5. Map Time & Animation Play Trigger */}
        <div className="stitch-card map-bottom-stat-card time-card">
          <div className="stat-card-icon-wrap indigo">
            <Activity size={20} className="text-indigo-500" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Map Time</span>
            <span className="stat-card-main-val time-text">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} •{' '}
              {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
            <button
              type="button"
              className="map-play-animation-btn"
              onClick={() => setIsAnimationPlaying((p) => !p)}
            >
              {isAnimationPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
              <span>{isAnimationPlaying ? 'Pause' : 'Play Animation'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default MapPage;
