/**
 * Dynamic Weather & Time Visual System
 * Evaluates weather conditions, precipitation, cloud cover, severity, local time, and solar transitions
 * to produce consistent, beautiful, and dynamic meteorological theme states.
 */

/**
 * Parses time string (e.g. "15:30", "06:19", "2026-08-27T15:30:00") into minutes from midnight.
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  try {
    let clean = timeStr;
    if (clean.includes('T')) {
      clean = clean.split('T')[1].slice(0, 5);
    }
    const [h, m] = clean.split(':').map(Number);
    if (isNaN(h)) return null;
    return h * 60 + (isNaN(m) ? 0 : m);
  } catch {
    return null;
  }
}

/**
 * Determine the diurnal phase (dawn, morning, afternoon, dusk, night).
 */
export function getDiurnalPhase({ currentTimeStr, sunriseStr = '06:00', sunsetStr = '18:30' }) {
  let currentMinutes;

  if (currentTimeStr) {
    currentMinutes = parseTimeToMinutes(currentTimeStr);
  }

  if (currentMinutes === null || currentMinutes === undefined) {
    const now = new Date();
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const sunriseMinutes = parseTimeToMinutes(sunriseStr) || (6 * 60);
  const sunsetMinutes = parseTimeToMinutes(sunsetStr) || (18 * 60 + 30);

  // Dawn window: 45 min before sunrise to 45 min after
  const dawnStart = sunriseMinutes - 45;
  const dawnEnd = sunriseMinutes + 45;

  // Dusk window: 45 min before sunset to 60 min after
  const duskStart = sunsetMinutes - 45;
  const duskEnd = sunsetMinutes + 60;

  if (currentMinutes >= dawnStart && currentMinutes <= dawnEnd) {
    return 'dawn';
  }
  if (currentMinutes > dawnEnd && currentMinutes < 12 * 60) {
    return 'morning';
  }
  if (currentMinutes >= 12 * 60 && currentMinutes < duskStart) {
    return 'afternoon';
  }
  if (currentMinutes >= duskStart && currentMinutes <= duskEnd) {
    return 'dusk';
  }
  return 'night';
}

/**
 * Master weather theme state generator.
 */
export function getWeatherThemeState({
  condition = 'Clear',
  weatherCode = 0,
  cloudCover = 0,
  precipitation = 0,
  rainChance = 0,
  hasSevereAlert = false,
  alertSeverity = 'normal',
  currentTimeStr = null,
  sunrise = '06:00',
  sunset = '18:30'
} = {}) {
  const phase = getDiurnalPhase({ currentTimeStr, sunriseStr: sunrise, sunsetStr: sunset });
  const isNight = phase === 'night';
  const isDawnOrDusk = phase === 'dawn' || phase === 'dusk';
  const isMorning = phase === 'morning';

  // Greeting
  let greeting = 'Good day';
  if (phase === 'dawn' || phase === 'morning') greeting = 'Good morning';
  else if (phase === 'afternoon') greeting = 'Good afternoon';
  else if (phase === 'dusk') greeting = 'Good evening';
  else if (phase === 'night') greeting = 'Good night';

  // Severe Alert Override
  if (hasSevereAlert || alertSeverity === 'severe' || alertSeverity === 'extreme') {
    return {
      themeKey: 'severe-warning',
      cardClass: 'hero-theme-severe',
      artType: 'warning-shield',
      phase,
      greeting,
      atmosphereTag: 'Hazard Warning',
      gradient: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 45%, #450A0A 100%)',
      accentGlow: 'rgba(239, 68, 68, 0.45)'
    };
  }

  // Thunderstorm: WMO 95, 96, 99
  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99 || condition.toLowerCase().includes('thunder')) {
    return {
      themeKey: isNight ? 'thunderstorm-night' : 'thunderstorm-day',
      cardClass: 'hero-theme-thunderstorm',
      artType: 'thunderstorm',
      phase,
      greeting,
      atmosphereTag: 'Thunderstorm Active',
      gradient: isNight
        ? 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #0F172A 100%)'
        : 'linear-gradient(135deg, #312E81 0%, #4338CA 50%, #1E1B4B 100%)',
      accentGlow: 'rgba(168, 85, 247, 0.4)'
    };
  }

  // Rain / Drizzle: WMO 51..67, 80..82 or active rain
  const isRain =
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82) ||
    precipitation >= 0.5 ||
    rainChance >= 70 ||
    condition.toLowerCase().includes('rain') ||
    condition.toLowerCase().includes('drizzle');

  if (isRain) {
    if (isNight) {
      return {
        themeKey: 'rain-night',
        cardClass: 'hero-theme-rain-night',
        artType: 'rain-night',
        phase,
        greeting,
        atmosphereTag: 'Rainy Night',
        gradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #0F2847 100%)',
        accentGlow: 'rgba(56, 189, 248, 0.3)'
      };
    }
    return {
      themeKey: 'rain-day',
      cardClass: 'hero-theme-rain-day',
      artType: 'rain',
      phase,
      greeting,
      atmosphereTag: 'Precipitation Active',
      gradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #0284C7 100%)',
      accentGlow: 'rgba(56, 189, 248, 0.4)'
    };
  }

  // Snow: WMO 71..77, 85..86
  const isSnow =
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 85 && weatherCode <= 86) ||
    condition.toLowerCase().includes('snow');

  if (isSnow) {
    return {
      themeKey: isNight ? 'snow-night' : 'snow-day',
      cardClass: 'hero-theme-snow',
      artType: 'snow',
      phase,
      greeting,
      atmosphereTag: 'Snow Conditions',
      gradient: isNight
        ? 'linear-gradient(135deg, #1E293B 0%, #334155 50%, #0F172A 100%)'
        : 'linear-gradient(135deg, #38BDF8 0%, #60A5FA 50%, #93C5FD 100%)',
      accentGlow: 'rgba(224, 242, 254, 0.4)'
    };
  }

  // Fog: WMO 45, 48
  if (weatherCode === 45 || weatherCode === 48 || condition.toLowerCase().includes('fog')) {
    return {
      themeKey: isNight ? 'fog-night' : 'fog-day',
      cardClass: 'hero-theme-fog',
      artType: 'fog',
      phase,
      greeting,
      atmosphereTag: 'Fog / Mist',
      gradient: isNight
        ? 'linear-gradient(135deg, #1E293B 0%, #334155 60%, #1E293B 100%)'
        : 'linear-gradient(135deg, #475569 0%, #64748B 60%, #94A3B8 100%)',
      accentGlow: 'rgba(148, 163, 184, 0.3)'
    };
  }

  // Cloudy: WMO 3 or high cloud coverage
  const isCloudy = weatherCode === 3 || cloudCover >= 70 || condition.toLowerCase().includes('cloudy');
  if (isCloudy) {
    if (isNight) {
      return {
        themeKey: 'cloudy-night',
        cardClass: 'hero-theme-cloudy-night',
        artType: 'moon-cloud',
        phase,
        greeting,
        atmosphereTag: 'Overcast Night',
        gradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #334155 100%)',
        accentGlow: 'rgba(148, 163, 184, 0.25)'
      };
    }
    if (isDawnOrDusk) {
      return {
        themeKey: 'cloudy-dusk',
        cardClass: 'hero-theme-cloudy-dusk',
        artType: 'sun-cloud',
        phase,
        greeting,
        atmosphereTag: phase === 'dawn' ? 'Cloudy Dawn' : 'Cloudy Sunset',
        gradient: 'linear-gradient(135deg, #475569 0%, #7C3AED 45%, #C026D3 100%)',
        accentGlow: 'rgba(192, 38, 211, 0.35)'
      };
    }
    return {
      themeKey: 'cloudy-day',
      cardClass: 'hero-theme-cloudy-day',
      artType: 'sun-cloud',
      phase,
      greeting,
      atmosphereTag: 'Overcast Skies',
      gradient: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #38BDF8 100%)',
      accentGlow: 'rgba(253, 224, 71, 0.3)'
    };
  }

  // Clear / Partly Cloudy: Time of day driven
  if (isNight) {
    return {
      themeKey: 'clear-night',
      cardClass: 'hero-theme-clear-night',
      artType: 'moon',
      phase,
      greeting,
      atmosphereTag: 'Clear Night Skies',
      gradient: 'linear-gradient(135deg, #090D16 0%, #0F172A 45%, #1E1B4B 100%)',
      accentGlow: 'rgba(129, 140, 248, 0.35)'
    };
  }

  if (phase === 'dawn') {
    return {
      themeKey: 'clear-dawn',
      cardClass: 'hero-theme-dawn',
      artType: 'sun',
      phase,
      greeting,
      atmosphereTag: 'Sunrise / Dawn',
      gradient: 'linear-gradient(135deg, #EA580C 0%, #D97706 45%, #F59E0B 100%)',
      accentGlow: 'rgba(251, 191, 36, 0.5)'
    };
  }

  if (phase === 'dusk') {
    return {
      themeKey: 'clear-dusk',
      cardClass: 'hero-theme-dusk',
      artType: 'sun',
      phase,
      greeting,
      atmosphereTag: 'Golden Hour / Sunset',
      gradient: 'linear-gradient(135deg, #C026D3 0%, #EA580C 50%, #F59E0B 100%)',
      accentGlow: 'rgba(249, 115, 22, 0.45)'
    };
  }

  if (isMorning) {
    return {
      themeKey: 'clear-morning',
      cardClass: 'hero-theme-morning',
      artType: 'sun',
      phase,
      greeting,
      atmosphereTag: 'Morning Sunshine',
      gradient: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 45%, #38BDF8 100%)',
      accentGlow: 'rgba(253, 224, 71, 0.5)'
    };
  }

  // Afternoon default
  return {
    themeKey: 'clear-day',
    cardClass: 'hero-theme-day',
    artType: 'sun',
    phase,
    greeting,
    atmosphereTag: 'Daylight Peak',
    gradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 45%, #38BDF8 100%)',
    accentGlow: 'rgba(253, 224, 71, 0.5)'
  };
}
