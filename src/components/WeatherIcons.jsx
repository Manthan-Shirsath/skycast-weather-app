import React from 'react';

// Large radiant sun for the hero banner
export const HeroSunIcon = ({ className = "w-28 h-28" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Sun center */}
    <circle cx="50" cy="50" r="18" fill="#FBBF24" />
    {/* Sun rays */}
    <line x1="50" y1="12" x2="50" y2="24" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="50" y1="76" x2="50" y2="88" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="12" y1="50" x2="24" y2="50" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="76" y1="50" x2="88" y2="50" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="23.1" y1="23.1" x2="31.6" y2="31.6" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="68.4" y1="68.4" x2="76.9" y2="76.9" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="23.1" y1="76.9" x2="31.6" y2="68.4" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="68.4" y1="31.6" x2="76.9" y2="23.1" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

// Partly cloudy with sun behind cloud
export const PartlyCloudyIcon = ({ className = "w-6 h-6", size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Sun behind */}
    <g transform="translate(4, 2)">
      <circle cx="18" cy="11" r="7" fill="#FBBF24" />
      <line x1="18" y1="1" x2="18" y2="3.5" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
      <line x1="25.5" y1="3.5" x2="23.8" y2="5.2" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="11" x2="25.5" y2="11" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
      <line x1="25.5" y1="18.5" x2="23.8" y2="16.8" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
      <line x1="10.5" y1="3.5" x2="12.2" y2="5.2" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
    </g>
    {/* Cloud in front */}
    <path
      d="M10 27.5H25.5C28.5 27.5 30.5 25.3 30.5 22.5C30.5 19.8 28.5 17.8 26 17.6C25.4 13.5 21.8 10.5 17.5 10.5C13.8 10.5 10.7 12.8 9.6 16C6.5 16.3 4 18.8 4 21.8C4 24.9 6.6 27.5 10 27.5Z"
      fill="#E2E8F0"
      stroke="#CBD5E1"
      strokeWidth="1.2"
    />
  </svg>
);

// Clean Cloud icon
export const CloudyIcon = ({ className = "w-6 h-6", size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M11 27H26C29.2 27 31.5 24.6 31.5 21.5C31.5 18.5 29.2 16.3 26.5 16.1C25.8 11.8 22 8.5 17.5 8.5C13.5 8.5 10.2 11 9 14.5C5.8 14.8 3.2 17.5 3.2 20.8C3.2 24.2 6.1 27 11 27Z"
      fill="#E2E8F0"
      stroke="#CBD5E1"
      strokeWidth="1.2"
    />
  </svg>
);

// Scattered Rain icon
export const RainIcon = ({ className = "w-6 h-6", size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Sun peeking (subtle) */}
    <circle cx="23" cy="11" r="5" fill="#FBBF24" />
    <line x1="23" y1="3" x2="23" y2="5" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="28.5" y1="5.5" x2="27" y2="7" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
    {/* Cloud */}
    <path
      d="M9 22H24C26.8 22 28.8 20 28.8 17.5C28.8 15 26.8 13.2 24.5 13C23.9 9.5 20.6 7 16.8 7C13.3 7 10.4 9 9.3 12C6.5 12.3 4.3 14.5 4.3 17.2C4.3 20 6.5 22 9 22Z"
      fill="#E2E8F0"
      stroke="#CBD5E1"
      strokeWidth="1"
    />
    {/* Rain drops */}
    <line x1="10" y1="25" x2="8.5" y2="29" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="25" x2="14.5" y2="29" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
    <line x1="22" y1="25" x2="20.5" y2="29" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Thunderstorm icon
export const ThunderstormIcon = ({ className = "w-6 h-6", size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Cloud */}
    <path
      d="M9 20H25C28 20 30 18 30 15.5C30 13 28 11.2 25.5 11C24.8 7.5 21.2 5 17.2 5C13.5 5 10.4 7.2 9.3 10.2C6.5 10.5 4.3 12.7 4.3 15.4C4.3 18.2 6.5 20 9 20Z"
      fill="#E2E8F0"
      stroke="#CBD5E1"
      strokeWidth="1"
    />
    {/* Rain drops */}
    <line x1="8" y1="23" x2="6.5" y2="27" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="13" y1="23" x2="11.5" y2="27" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
    {/* Lightning Bolt */}
    <polygon points="21,21 17,27 20,27 18,33 24,25 21,25" fill="#FBBF24" />
  </svg>
);

// Snow icon
export const SnowIcon = ({ className = "w-6 h-6", size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M9 22H24C26.8 22 28.8 20 28.8 17.5C28.8 15 26.8 13.2 24.5 13C23.9 9.5 20.6 7 16.8 7C13.3 7 10.4 9 9.3 12C6.5 12.3 4.3 14.5 4.3 17.2C4.3 20 6.5 22 9 22Z"
      fill="#E2E8F0"
      stroke="#CBD5E1"
      strokeWidth="1"
    />
    {/* Snowflakes */}
    <circle cx="10" cy="27" r="1.6" fill="#93C5FD" />
    <circle cx="17" cy="28" r="1.6" fill="#93C5FD" />
    <circle cx="23" cy="27" r="1.6" fill="#93C5FD" />
  </svg>
);

// Fog icon
export const FogIcon = ({ className = "w-6 h-6", size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <line x1="8" y1="14" x2="28" y2="14" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="6" y1="19" x2="30" y2="19" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="10" y1="24" x2="26" y2="24" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// Dark/crisp Sun icon (for daily list)
export const DarkSunIcon = ({ className = "w-6 h-6", size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="16" cy="16" r="6" fill="#1E293B" />
    <line x1="16" y1="3" x2="16" y2="7" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="25" x2="16" y2="29" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
    <line x1="3" y1="16" x2="7" y2="16" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
    <line x1="25" y1="16" x2="29" y2="16" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
    <line x1="6.8" y1="6.8" x2="9.6" y2="9.6" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
    <line x1="22.4" y1="22.4" x2="25.2" y2="25.2" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
    <line x1="6.8" y1="25.2" x2="9.6" y2="22.4" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
    <line x1="22.4" y1="9.6" x2="25.2" y2="6.8" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Mini bright sun on "Now" hourly card
export const MiniSunHeroIcon = ({ className = "w-6 h-6", size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="16" cy="16" r="6" fill="#FBBF24" />
    <line x1="16" y1="4" x2="16" y2="7.5" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="16" y1="24.5" x2="16" y2="28" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="4" y1="16" x2="7.5" y2="16" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="24.5" y1="16" x2="28" y2="16" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="7.5" y1="7.5" x2="10" y2="10" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="22" y1="22" x2="24.5" y2="24.5" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="7.5" y1="24.5" x2="10" y2="22" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="22" y1="10" x2="24.5" y2="7.5" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

// Water droplet
export const WaterDropIcon = ({ size = 14, color = "#38BDF8" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8 1.5C8 1.5 3 7.5 3 10.5C3 13.2614 5.23858 15.5 8 15.5C10.7614 15.5 13 13.2614 13 10.5C13 7.5 8 1.5 8 1.5Z"
      fill={color}
    />
  </svg>
);

// Skycast brand cloud logo
export const SkycastLogoIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9 22H23C26 22 28.5 19.5 28.5 16.5C28.5 13.8 26.5 11.5 23.8 11.1C23.2 7.2 19.8 4.5 16 4.5C12.4 4.5 9.4 6.8 8.4 9.8C5.6 10.2 3.5 12.5 3.5 15.5C3.5 19 6.2 22 9 22Z"
      fill="#60A5FA"
      fillOpacity="0.25"
      stroke="#3B82F6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Dispatcher for any weather condition string or icon name
export const WeatherIconRenderer = ({ name, size = 26, isHeroCard = false }) => {
  switch (name) {
    case 'sun-fill':
    case 'sun-hero':
      return <MiniSunHeroIcon size={size} />;
    case 'sun':
      return <DarkSunIcon size={size} />;
    case 'partly-cloudy':
      return <PartlyCloudyIcon size={size} />;
    case 'cloudy':
      return <CloudyIcon size={size} />;
    case 'rain':
      return <RainIcon size={size} />;
    case 'thunderstorm':
      return <ThunderstormIcon size={size} />;
    case 'snow':
      return <SnowIcon size={size} />;
    case 'fog':
      return <FogIcon size={size} />;
    default:
      return <PartlyCloudyIcon size={size} />;
  }
};
