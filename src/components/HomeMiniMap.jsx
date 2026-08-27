import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, Play, Pause } from 'lucide-react';

// Custom city icon for mini map
const cityIcon = L.divIcon({
  className: 'home-mini-map-marker',
  html: `<div class="mini-marker-pin"><div class="mini-marker-dot"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function MiniMapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export function HomeMiniMap({ city, lat, lon }) {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(9);
  const [isPlaying, setIsPlaying] = useState(false);
  const mapRef = useRef(null);

  const center = [lat || 18.5204, lon || 73.8567];

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoom((z) => Math.min(z + 1, 14));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoom((z) => Math.max(z - 1, 4));
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    setIsPlaying((p) => !p);
  };

  const handleOpenFullMap = () => {
    navigate(`/map?city=${encodeURIComponent(city || 'Pune')}`);
  };

  return (
    <div
      className="home-mini-map-card stitch-card"
      onClick={handleOpenFullMap}
      title="Click to open full interactive weather map & radar"
    >
      <div className="home-mini-map-header">
        <div>
          <h3 className="mini-map-title">Weather Map</h3>
          <span className="mini-map-sub">Live Radar View</span>
        </div>
        <button
          type="button"
          className="mini-map-full-link"
          onClick={handleOpenFullMap}
          aria-label="View Full Map"
        >
          <span>View Full Map</span>
          <span className="link-arrow">→</span>
        </button>
      </div>

      <div className="home-mini-map-canvas-wrap">
        <MapContainer
          center={center}
          zoom={zoom}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          className="home-mini-leaflet-container"
          whenCreated={(map) => {
            mapRef.current = map;
          }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />
          <MiniMapController center={center} zoom={zoom} />
          <Marker position={center} icon={cityIcon} />
        </MapContainer>

        {/* Radar simulated overlay shimmer */}
        <div className={`radar-scan-overlay ${isPlaying ? 'scanning' : ''}`} />

        {/* Mini Map Controls */}
        <div className="mini-map-controls-row" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`mini-radar-play-btn ${isPlaying ? 'active' : ''}`}
            onClick={togglePlay}
            title={isPlaying ? 'Pause Radar Loop' : 'Play Radar Loop'}
            aria-label="Toggle Radar Animation"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>

          <div className="mini-zoom-btn-group">
            <button
              type="button"
              className="mini-zoom-btn"
              onClick={handleZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              className="mini-zoom-btn"
              onClick={handleZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <Minus size={13} />
            </button>
          </div>
        </div>

        {/* City badge overlay */}
        <div className="mini-map-city-pill">
          <span className="city-pill-dot" />
          <span>{city || 'Pune'}</span>
        </div>
      </div>
    </div>
  );
}
