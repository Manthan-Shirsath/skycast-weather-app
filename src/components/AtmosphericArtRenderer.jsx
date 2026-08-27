import React from 'react';

/**
 * Atmospheric Art Renderer
 * High-performance vector-based atmospheric illustrations that bring the hero card to life.
 */
export default function AtmosphericArtRenderer({ artType = 'sun', className = '' }) {
  switch (artType) {
    case 'sun':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <div className="art-sun-rays" />
          <div className="art-sun-core" />
        </div>
      );

    case 'sun-cloud':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <div className="art-sun-subtle" />
          <svg className="art-cloud-layer art-cloud-back" viewBox="0 0 100 60" fill="none">
            <path
              d="M20 45 A 15 15 0 0 1 45 30 A 20 20 0 0 1 80 35 A 15 15 0 0 1 85 45 Z"
              fill="rgba(255, 255, 255, 0.45)"
            />
          </svg>
          <svg className="art-cloud-layer art-cloud-front" viewBox="0 0 120 70" fill="none">
            <path
              d="M15 55 A 18 18 0 0 1 45 40 A 25 25 0 0 1 90 42 A 18 18 0 0 1 105 55 Z"
              fill="rgba(255, 255, 255, 0.85)"
            />
          </svg>
        </div>
      );

    case 'cloudy':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <svg className="art-cloud-layer art-cloud-back" viewBox="0 0 100 60" fill="none">
            <path
              d="M15 48 A 16 16 0 0 1 45 32 A 22 22 0 0 1 82 36 A 16 16 0 0 1 90 48 Z"
              fill="rgba(255, 255, 255, 0.35)"
            />
          </svg>
          <svg className="art-cloud-layer art-cloud-front" viewBox="0 0 120 70" fill="none">
            <path
              d="M10 58 A 20 20 0 0 1 45 42 A 26 26 0 0 1 95 44 A 20 20 0 0 1 110 58 Z"
              fill="rgba(255, 255, 255, 0.75)"
            />
          </svg>
        </div>
      );

    case 'rain':
    case 'rain-night':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          {artType === 'rain-night' && <div className="art-moon-subtle" />}
          <svg className="art-cloud-layer art-cloud-front" viewBox="0 0 120 70" fill="none">
            <path
              d="M12 52 A 18 18 0 0 1 45 38 A 25 25 0 0 1 92 40 A 18 18 0 0 1 108 52 Z"
              fill="rgba(255, 255, 255, 0.7)"
            />
          </svg>
          <div className="art-rain-drops">
            <span className="drop drop-1" />
            <span className="drop drop-2" />
            <span className="drop drop-3" />
            <span className="drop drop-4" />
          </div>
        </div>
      );

    case 'thunderstorm':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <svg className="art-cloud-layer art-cloud-front" viewBox="0 0 120 70" fill="none">
            <path
              d="M12 50 A 18 18 0 0 1 45 36 A 25 25 0 0 1 92 38 A 18 18 0 0 1 108 50 Z"
              fill="rgba(203, 213, 225, 0.85)"
            />
          </svg>
          <svg className="art-lightning-bolt" viewBox="0 0 24 36" fill="none">
            <path
              d="M14 0 L4 18 L12 18 L10 36 L20 16 L13 16 Z"
              fill="#FDE047"
              filter="drop-shadow(0 0 8px rgba(253, 224, 71, 0.8))"
            />
          </svg>
          <div className="art-rain-drops">
            <span className="drop drop-1" />
            <span className="drop drop-2" />
            <span className="drop drop-3" />
          </div>
        </div>
      );

    case 'moon':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <div className="art-moon-core" />
          <div className="art-star star-1" />
          <div className="art-star star-2" />
          <div className="art-star star-3" />
        </div>
      );

    case 'moon-cloud':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <div className="art-moon-core art-moon-offset" />
          <svg className="art-cloud-layer art-cloud-front" viewBox="0 0 120 70" fill="none">
            <path
              d="M15 55 A 18 18 0 0 1 45 40 A 25 25 0 0 1 90 42 A 18 18 0 0 1 105 55 Z"
              fill="rgba(255, 255, 255, 0.6)"
            />
          </svg>
        </div>
      );

    case 'snow':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <svg className="art-cloud-layer art-cloud-front" viewBox="0 0 120 70" fill="none">
            <path
              d="M12 50 A 18 18 0 0 1 45 36 A 25 25 0 0 1 92 38 A 18 18 0 0 1 108 50 Z"
              fill="rgba(255, 255, 255, 0.8)"
            />
          </svg>
          <div className="art-snowflakes">
            <span className="flake flake-1">❄</span>
            <span className="flake flake-2">❄</span>
            <span className="flake flake-3">❄</span>
          </div>
        </div>
      );

    case 'fog':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <div className="art-fog-layer fog-1" />
          <div className="art-fog-layer fog-2" />
          <div className="art-fog-layer fog-3" />
        </div>
      );

    case 'warning-shield':
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <div className="art-warning-pulse" />
          <svg className="art-warning-shield-icon" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      );

    default:
      return (
        <div className={`hero-v2-art-wrapper ${className}`} aria-hidden="true">
          <div className="art-sun-rays" />
          <div className="art-sun-core" />
        </div>
      );
  }
}
