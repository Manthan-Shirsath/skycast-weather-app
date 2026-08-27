import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  ArrowUpRight,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { WeatherIconRenderer } from '../components/WeatherIcons';

// Helper component to programmatic fly to coordinates and handle zoom
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

// Custom map zoom/locate action controls bridge
function MapZoomButtons({ onZoomIn, onZoomOut, onLocate, isLocating }) {
  return (
    <div className="map-controls-group">
      <button
        type="button"
        className="map-control-btn"
        onClick={onZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
      >
        <Plus size={18} />
      </button>
      <button
        type="button"
        className="map-control-btn"
        onClick={onZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <Minus size={18} />
      </button>
      <button
        type="button"
        className={`map-control-btn ${isLocating ? 'locating' : ''}`}
        onClick={onLocate}
        title="Current Location"
        aria-label="Current Location"
      >
        {isLocating ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <Locate size={18} />}
      </button>
    </div>
  );
}

export function MapPage() {
  const { currentCity, weatherData, formatTemp, formatWind, loadCityWeather } = useWeather();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Active layer switched purely client-side without re-fetching external APIs!
  const [activeLayer, setActiveLayer] = useState('Temperature'); // 'Temperature' | 'Rain' | 'Wind' | 'Clouds' | 'Pressure' | 'Humidity' | 'Visibility'
  const [citiesData, setCitiesData] = useState([]);
  const [radarMeta, setRadarMeta] = useState(null);
  const [indiaBoundary, setIndiaBoundary] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [pointWeather, setPointWeather] = useState(null);
  const [mapUpdatedAt, setMapUpdatedAt] = useState(null);
  const [isStaleData, setIsStaleData] = useState(false);

  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingRadar, setIsLoadingRadar] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState(null);

  const [mapCenter, setMapCenter] = useState([22.5, 79.0]); // India center
  const [mapZoom, setMapZoom] = useState(5);
  const mapRef = useRef(null);

  const cityParam = searchParams.get('city');

  // Load Official Survey of India Sovereign Boundary (Includes Jammu & Kashmir, Ladakh, PoK, Gilgit-Baltistan & Aksai Chin)
  useEffect(() => {
    fetch('/india-boundary.json')
      .then((res) => {
        if (!res.ok) throw new Error('Boundary file not found');
        return res.json();
      })
      .then((data) => setIndiaBoundary(data))
      .catch((err) => console.warn('Could not load official India boundary GeoJSON:', err));
  }, []);

  // 1. Fetch Centralized Map Weather Dataset (All variables in ONE call)
  const loadMapData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingCities(true);
    try {
      const data = await fetchMapWeather();
      setCitiesData(data.cities || []);
      setMapUpdatedAt(data.updatedAt);
      setIsStaleData(!!data.stale);
      setNoticeMessage(null);
    } catch (err) {
      console.error('Map data fetch failed:', err);
      setNoticeMessage('Weather data unavailable (re-trying...)');
    } finally {
      setIsLoadingCities(false);
    }
  }, []);

  // 2. Fetch RainViewer Radar Metadata
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

    // 3. Connect to WebSocket for live push updates from background collector
    const ws = connectWeatherWebSocket((msg) => {
      if (msg.type === 'radar_update' && msg.data) {
        setRadarMeta(msg.data);
      } else if (msg.type === 'weather_update') {
        // Subtle background refresh without re-rendering entire map
        loadMapData(false);
      }
    }, currentCity);

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [loadMapData, loadRadar, currentCity]);

  // 4. Handle URL city parameter centering and selection
  useEffect(() => {
    const targetCityName = (cityParam || currentCity || '').toLowerCase();
    if (citiesData.length > 0 && targetCityName) {
      const found = citiesData.find(c => c.name.toLowerCase() === targetCityName);
      if (found) {
        setMapCenter([found.latitude, found.longitude]);
        setMapZoom(7);
        setSelectedCity(found);
        setPointWeather(null);
      }
    }
  }, [cityParam, currentCity, citiesData]);

  // 5. Handle Zoom Actions
  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  // 6. Handle Current Geolocation
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
        setMapZoom(9);
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
          console.error('Point weather lookup failed:', err);
          setNoticeMessage('Failed to fetch weather for your exact location.');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setNoticeMessage('Location access was denied.');
        } else {
          setNoticeMessage('Unable to retrieve your current location.');
        }
        setTimeout(() => setNoticeMessage(null), 5000);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // 7. Handle map clicks to load coordinates weather
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
      console.error('Point lookup error:', err);
    }
  };

  // 8. Instantaneous Local Layer Marker Generator (ZERO network calls on layer switch)
  const createMarkerIcon = useCallback((city) => {
    const isSelected = (selectedCity && selectedCity.name === city.name) ||
      (cityParam && cityParam.toLowerCase() === city.name.toLowerCase());

    let metricValue = `${formatTemp(city.temperature)}`;
    let badgeClass = 'temp-badge';

    if (activeLayer === 'Rain') {
      badgeClass = 'rain-badge';
      metricValue = `${city.rainChance ?? city.rain_probability ?? 20}%`;
    } else if (activeLayer === 'Wind') {
      badgeClass = 'wind-badge';
      const deg = city.windDirectionDeg || city.wind_direction || 0;
      const arrowHtml = `<span class="wind-arrow-icon" style="transform: rotate(${deg}deg); display: inline-block;">↑</span>`;
      metricValue = `${arrowHtml} ${formatWind(city.windSpeed ?? city.wind_speed)}`;
    } else if (activeLayer === 'Clouds') {
      badgeClass = 'clouds-badge';
      metricValue = `${city.cloudCover ?? city.cloud_cover ?? 0}%`;
    } else if (activeLayer === 'Pressure') {
      badgeClass = 'pressure-badge';
      metricValue = `${city.pressure || 1012} hPa`;
    } else if (activeLayer === 'Humidity') {
      badgeClass = 'humidity-badge';
      metricValue = `${city.humidity || 60}%`;
    } else if (activeLayer === 'Visibility') {
      badgeClass = 'visibility-badge';
      metricValue = `${city.visibility || 10} km`;
    }

    const alertIndicatorHtml = city.hasAlert || ['extreme', 'severe'].includes(city.alertSeverity)
      ? `<span class="marker-alert-badge ${city.alertSeverity || 'severe'}" title="Active Weather Warning">⚠️</span>`
      : '';

    const html = `
      <div class="custom-leaflet-marker ${isSelected ? 'marker-selected' : ''} ${badgeClass}">
        <div class="marker-pill-box">
          ${alertIndicatorHtml}
          <span class="marker-pill-city">${city.name}</span>
          <span class="marker-pill-val">${metricValue}</span>
        </div>
        <div class="marker-pin-dot ${city.hasAlert ? 'pulse-alert' : ''}"></div>
      </div>
    `;

    return L.divIcon({
      className: 'leaflet-custom-div-icon',
      html: html,
      iconSize: [116, 42],
      iconAnchor: [58, 42]
    });
  }, [activeLayer, selectedCity, cityParam, formatTemp, formatWind]);

  const activeCityPopup = selectedCity || pointWeather;

  return (
    <div className="weather-map-page-wrapper">
      {/* Real Geographic Leaflet Map */}
      <div className="weather-map-canvas-container">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', borderRadius: '24px' }}
          ref={mapRef}
        >
          <MapController
            center={mapCenter}
            zoom={mapZoom}
            onMapClick={handleMapClick}
          />

          {/* OpenStreetMap Base Map */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />

          {/* Official Sovereign Boundary of India (Survey of India Compliant: PoK & Aksai Chin included) */}
          {indiaBoundary && (
            <GeoJSON
              key="india-sovereign-boundary-layer"
              data={indiaBoundary}
              style={{
                color: '#2563EB',
                weight: 2.6,
                opacity: 0.95,
                fillColor: '#3B82F6',
                fillOpacity: 0.04
              }}
              onEachFeature={(feature, layer) => {
                layer.bindTooltip(
                  '<div style="font-size: 12px; font-weight: 700; color: #1E3A8A; line-height: 1.3;">🇮🇳 Sovereign Territory of India<br/><span style="font-size: 11px; font-weight: 500; color: #475569;">Survey of India Official Boundary (including Jammu & Kashmir, Ladakh, PoK, Gilgit-Baltistan & Aksai Chin)</span></div>',
                  { sticky: true, className: 'leaflet-india-boundary-tooltip' }
                );
              }}
            />
          )}

          {/* Real RainViewer Weather Radar Overlay */}
          {activeLayer === 'Rain' && radarMeta && radarMeta.tileUrl && (
            <TileLayer
              key={radarMeta.timestamp || 'radar-layer'}
              url={radarMeta.tileUrl}
              opacity={0.72}
              zIndex={500}
              attribution={radarMeta.attribution || 'Weather radar by RainViewer'}
            />
          )}

          {/* Official Weather Alert Affected Area Polygons (if provided by Google/official source) */}
          {(weatherData?.alerts || []).filter(a => a.polygon && a.polygon.length > 2).map((alertItem) => (
            <Polygon
              key={alertItem.id}
              positions={alertItem.polygon}
              pathOptions={{
                color: '#E11D48',
                fillColor: '#E11D48',
                fillOpacity: 0.22,
                weight: 2,
                dashArray: '4, 4'
              }}
            >
              <Popup>
                <div className="map-alert-polygon-popup">
                  <div className="font-bold text-red-600">🔴 {alertItem.title || alertItem.event}</div>
                  <div className="text-xs text-slate-600 mt-1"><strong>Authority:</strong> {alertItem.authority}</div>
                  {alertItem.severity && <div className="text-xs text-slate-600"><strong>Severity:</strong> {alertItem.severity}</div>}
                  {alertItem.urgency && <div className="text-xs text-slate-600"><strong>Urgency:</strong> {alertItem.urgency}</div>}
                  {alertItem.instructions && <div className="text-xs text-slate-800 mt-1 bg-amber-50 p-1.5 rounded">{alertItem.instructions}</div>}
                </div>
              </Popup>
            </Polygon>
          ))}

          {/* Real Weather City Markers (Instantly responsive to activeLayer) */}
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

          {/* Point Weather Marker if user clicked on map or used geolocation */}
          {pointWeather && (
            <Marker
              position={[pointWeather.latitude, pointWeather.longitude]}
              icon={L.divIcon({
                className: 'leaflet-custom-div-icon',
                html: `
                  <div class="custom-leaflet-marker marker-selected point-badge">
                    <div class="marker-pill-box">
                      <span class="marker-pill-city">${pointWeather.name}</span>
                      <span class="marker-pill-val">${formatTemp(pointWeather.temperature)}</span>
                    </div>
                    <div class="marker-pin-dot"></div>
                  </div>
                `,
                iconSize: [120, 42],
                iconAnchor: [60, 42]
              })}
            />
          )}
        </MapContainer>
      </div>

      {/* Real-time Status / Live Stream / Error Toast */}
      <div className="map-status-toast">
        {isLoadingCities || isLoadingRadar ? (
          <div className="map-toast-item loading">
            <Loader2 size={14} className="animate-spin text-blue-500" />
            <span>Updating weather data...</span>
          </div>
        ) : isStaleData ? (
          <div className="map-toast-item stale">
            <AlertCircle size={14} className="text-amber-500" />
            <span>Serving cached data (provider reconnecting...)</span>
          </div>
        ) : null}

        {noticeMessage && (
          <div className="map-toast-item error">
            <AlertCircle size={14} className="text-amber-500" />
            <span>{noticeMessage}</span>
            <button
              type="button"
              className="map-toast-close"
              onClick={() => setNoticeMessage(null)}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Top Left Layer Selector (Instant zero-request switching) */}
      <div className="map-layer-selector-card">
        <span className="map-layer-title">Weather Layers</span>
        <div className="map-layer-list">
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'Temperature' ? 'active' : ''}`}
            onClick={() => setActiveLayer('Temperature')}
          >
            <Thermometer size={16} />
            <span>Temperature</span>
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'Rain' ? 'active' : ''}`}
            onClick={() => setActiveLayer('Rain')}
          >
            <CloudRain size={16} />
            <span>Rain Radar</span>
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'Wind' ? 'active' : ''}`}
            onClick={() => setActiveLayer('Wind')}
          >
            <Wind size={16} />
            <span>Wind</span>
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'Clouds' ? 'active' : ''}`}
            onClick={() => setActiveLayer('Clouds')}
          >
            <Cloud size={16} />
            <span>Clouds</span>
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'Pressure' ? 'active' : ''}`}
            onClick={() => setActiveLayer('Pressure')}
          >
            <Gauge size={16} />
            <span>Pressure</span>
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'Humidity' ? 'active' : ''}`}
            onClick={() => setActiveLayer('Humidity')}
          >
            <Droplets size={16} />
            <span>Humidity</span>
          </button>
          <button
            type="button"
            className={`map-layer-btn ${activeLayer === 'Visibility' ? 'active' : ''}`}
            onClick={() => setActiveLayer('Visibility')}
          >
            <Eye size={16} />
            <span>Visibility</span>
          </button>
        </div>
      </div>

      {/* Dynamic Layer Legend (Bottom Left) */}
      <div className="map-legend-card">
        <span className="map-legend-label">
          {activeLayer === 'Temperature' && 'Temperature (°C)'}
          {activeLayer === 'Rain' && 'Precipitation Radar (dBZ / %)'}
          {activeLayer === 'Wind' && 'Wind Speed (km/h)'}
          {activeLayer === 'Clouds' && 'Cloud Coverage (%)'}
          {activeLayer === 'Pressure' && 'Surface Pressure (hPa)'}
          {activeLayer === 'Humidity' && 'Relative Humidity (%)'}
          {activeLayer === 'Visibility' && 'Visibility Distance (km)'}
        </span>
        <div className={`map-legend-gradient-bar ${activeLayer.toLowerCase()}`} />
        <div className="map-legend-values">
          {activeLayer === 'Temperature' && (
            <>
              <span>0°C</span>
              <span>15°C</span>
              <span>25°C</span>
              <span>35°C</span>
              <span>45°C</span>
            </>
          )}
          {activeLayer === 'Rain' && (
            <>
              <span>Light (5 dBZ)</span>
              <span>Moderate</span>
              <span>Heavy (55 dBZ)</span>
            </>
          )}
          {activeLayer === 'Wind' && (
            <>
              <span>0 km/h</span>
              <span>15 km/h</span>
              <span>30 km/h</span>
              <span>50+ km/h</span>
            </>
          )}
          {activeLayer === 'Clouds' && (
            <>
              <span>0% Clear</span>
              <span>50%</span>
              <span>100% Overcast</span>
            </>
          )}
          {activeLayer === 'Pressure' && (
            <>
              <span>980 hPa</span>
              <span>1000 hPa</span>
              <span>1020 hPa</span>
              <span>1035 hPa</span>
            </>
          )}
          {activeLayer === 'Humidity' && (
            <>
              <span>20%</span>
              <span>50%</span>
              <span>80%</span>
              <span>100%</span>
            </>
          )}
          {activeLayer === 'Visibility' && (
            <>
              <span>1 km</span>
              <span>5 km</span>
              <span>10 km</span>
              <span>20+ km</span>
            </>
          )}
        </div>
      </div>

      {/* Official Survey of India Sovereign Territory Badge */}
      <div className="map-soi-compliance-badge" title="Official map depiction as per Survey of India guidelines">
        <span className="map-soi-flag">🇮🇳</span>
        <span className="map-soi-title">Official Map of India</span>
        <span className="map-soi-sub">• Survey of India Boundary (J&K, Ladakh, PoK & Aksai Chin)</span>
      </div>

      {/* Zoom and Geolocation Action Controls (Bottom Right) */}
      <MapZoomButtons
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onLocate={handleLocateMe}
        isLocating={isLocating}
      />

      {/* Selected City Weather Popup Card (Top Right) */}
      {activeCityPopup && (
        <div className="map-city-popup-card">
          <div className="map-city-popup-header">
            <div>
              <h3 className="map-city-popup-name">{activeCityPopup.name}</h3>
              <span className="map-city-popup-cond">{activeCityPopup.condition || 'Mainly Clear'}</span>
            </div>
            <button
              type="button"
              className="map-city-popup-close"
              onClick={() => {
                setSelectedCity(null);
                setPointWeather(null);
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="map-city-popup-temp-row">
            <WeatherIconRenderer name={activeCityPopup.icon || 'partly-cloudy'} size={32} />
            <span className="map-city-popup-temp">{formatTemp(activeCityPopup.temperature)}</span>
          </div>

          <div className="map-city-popup-stats">
            <div className="map-city-popup-metric">
              <Droplets size={14} className="text-blue-500" />
              <span>Rain chance: <strong>{activeCityPopup.rainChance ?? activeCityPopup.rain_probability ?? 20}%</strong></span>
            </div>

            <div className="map-city-popup-metric">
              <ArrowUpRight size={14} className="text-emerald-500" />
              <span>
                Wind: <strong>{formatWind(activeCityPopup.windSpeed ?? activeCityPopup.wind_speed)} ({activeCityPopup.windDirection || activeCityPopup.wind_direction_label || 'NE'})</strong>
              </span>
            </div>

            <div className="map-city-popup-metric">
              <Cloud size={14} className="text-slate-400" />
              <span>Cloud cover: <strong>{activeCityPopup.cloudCover ?? activeCityPopup.cloud_cover ?? 40}%</strong></span>
            </div>

            <div className="map-city-popup-metric">
              <Gauge size={14} className="text-purple-500" />
              <span>Pressure: <strong>{activeCityPopup.pressure || 1012} hPa</strong></span>
            </div>
          </div>

          {/* Active Alert Banner in Popup */}
          {(activeCityPopup.hasAlert || ['extreme', 'severe'].includes(activeCityPopup.alertSeverity)) && (
            <div
              className="map-popup-alert-strip"
              onClick={() => {
                const targetName = activeCityPopup.name.includes('Coordinates') ? currentCity : activeCityPopup.name;
                loadCityWeather(targetName);
                navigate(`/alerts?city=${encodeURIComponent(targetName)}`);
              }}
            >
              <AlertTriangle size={14} className="text-amber-600" />
              <span>Active Warning • Inspect</span>
            </div>
          )}

          {/* View Weather Button */}
          <button
            type="button"
            className="map-city-popup-action-btn"
            onClick={() => {
              const targetName = activeCityPopup.name.includes('Coordinates')
                ? currentCity
                : activeCityPopup.name;
              loadCityWeather(targetName);
              navigate(`/?city=${encodeURIComponent(targetName)}`);
            }}
          >
            <span>View weather</span>
            <ExternalLink size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
