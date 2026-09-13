export type VisualCondition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Normalizes backend condition string to a base visual condition
 */
export function normalizeWeatherCondition(condition: string | undefined): VisualCondition {
  if (!condition) return 'cloudy'; // Safe fallback
  
  const c = condition.toLowerCase();
  
  if (c.includes('storm') || c.includes('thunder')) return 'storm';
  if (c.includes('snow') || c.includes('ice') || c.includes('blizzard')) return 'snow';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return 'fog';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'rain';
  if (c.includes('clear') || c.includes('sunny') || c.includes('sun')) return 'clear';
  
  // Default for cloudy, partly cloudy, overcast, etc.
  return 'cloudy';
}

/**
 * Determines time of day based on the current local hour at the location.
 * The backend `hourly[0].hour` is guaranteed to be the current local hour.
 * 
 * 05:00-11:59 -> morning
 * 12:00-16:59 -> afternoon
 * 17:00-20:59 -> evening
 * 21:00-04:59 -> night
 */
export function getTimeOfDay(localHour: number | undefined, sunrise?: string, sunset?: string): TimeOfDay {
  // If we don't have the local hour from backend, fallback to browser time
  const hour = localHour !== undefined ? localHour : new Date().getHours();
  
  // Check if we are past sunset / before sunrise (if exact strings are provided, e.g. "18:30")
  if (sunrise && sunset) {
    const sunriseHour = parseInt(sunrise.split(':')[0], 10);
    const sunsetHour = parseInt(sunset.split(':')[0], 10);
    
    if (hour < sunriseHour - 1 || hour > sunsetHour + 1) {
      return 'night';
    }
  } else {
    // Default fallback rules
    if (hour < 5 || hour >= 21) return 'night';
  }
  
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  
  return 'night';
}

export function getWeatherBackground(condition: string | undefined, localHour?: number, sunrise?: string, sunset?: string): string {
  const visualCondition = normalizeWeatherCondition(condition);
  const timeOfDay = getTimeOfDay(localHour, sunrise, sunset);
  
  // Some conditions don't vary by time of day as significantly
  const hasTimeVariations = ['clear', 'cloudy', 'rain'].includes(visualCondition);
  
  if (hasTimeVariations) {
    return `/weather-backgrounds/${visualCondition}/${timeOfDay}.jpg`;
  } else {
    // fog, storm, snow use default for now
    return `/weather-backgrounds/${visualCondition}/default.jpg`;
  }
}
