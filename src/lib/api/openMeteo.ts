export const WMO_WEATHER_MAP: Record<number, [string, string]> = {
  0: ["Sunny", "sun"],
  1: ["Mainly Clear", "sun"],
  2: ["Partly Cloudy", "partly-cloudy"],
  3: ["Cloudy", "cloudy"],
  45: ["Foggy", "fog"],
  48: ["Depositing Rime Fog", "fog"],
  51: ["Light Drizzle", "rain"],
  53: ["Moderate Drizzle", "rain"],
  55: ["Dense Drizzle", "rain"],
  56: ["Light Freezing Drizzle", "rain"],
  57: ["Dense Freezing Drizzle", "rain"],
  61: ["Slight Rain", "rain"],
  63: ["Moderate Rain", "rain"],
  65: ["Heavy Rain", "rain"],
  66: ["Light Freezing Rain", "rain"],
  67: ["Heavy Freezing Rain", "rain"],
  71: ["Light Snow", "snow"],
  73: ["Moderate Snow", "snow"],
  75: ["Heavy Snow", "snow"],
  77: ["Snow Grains", "snow"],
  80: ["Scattered Rain", "rain"],
  81: ["Rain Showers", "rain"],
  82: ["Violent Rain Showers", "rain"],
  85: ["Light Snow Showers", "snow"],
  86: ["Heavy Snow Showers", "snow"],
  95: ["Thunderstorms", "thunderstorm"],
  96: ["Thunderstorm with Hail", "thunderstorm"],
  99: ["Heavy Thunderstorm with Hail", "thunderstorm"],
};

export function decodeWeatherCode(code?: number): [string, string] {
  if (code === undefined || code === null) return ["Partly Cloudy", "partly-cloudy"];
  return WMO_WEATHER_MAP[code] || ["Partly Cloudy", "partly-cloudy"];
}

export async function fetchDirectDashboard(city: string) {
  // 1. Geocode
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) throw new Error("Failed to fetch geocoding data");
  const geoData = await geoRes.json();
  const result = geoData.results?.[0];
  
  if (!result) {
    throw new Error(`Location '${city}' not found.`);
  }
  
  const { latitude: lat, longitude: lon, name, admin1, country } = result;
  
  let displayLoc = name;
  if (admin1 && admin1.toLowerCase() !== name.toLowerCase()) {
    displayLoc += `, ${admin1}`;
  }
  if (country && !displayLoc.includes(country)) {
    displayLoc += `, ${country}`;
  }

  // 2. Fetch Forecast
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&models=gfs_seamless&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,pressure_msl,precipitation,cloud_cover,rain&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,weather_code,surface_pressure,pressure_msl,cloud_cover,visibility,wind_speed_10m,wind_gusts_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,precipitation_hours,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max&timezone=auto`;
  
  const forecastRes = await fetch(forecastUrl);
  let raw: any;
  if (!forecastRes.ok) {
    // Try fallback without models=gfs_seamless
    const fallbackUrl = forecastUrl.replace('&models=gfs_seamless', '');
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) throw new Error("Failed to fetch forecast data from Open-Meteo");
    raw = await fallbackRes.json();
  } else {
    raw = await forecastRes.json();
  }

  const curr = raw.current || {};
  const hourly = raw.hourly || {};
  const daily = raw.daily || {};

  const wCode = curr.weather_code || 0;
  const [cond, icon] = decodeWeatherCode(wCode);

  const currentTemp = curr.temperature_2m !== undefined ? curr.temperature_2m : 25;
  const currentFeels = curr.apparent_temperature !== undefined ? curr.apparent_temperature : currentTemp;

  // Hourly mapping (24 hours from current)
  const hourlyTimes = hourly.time || [];
  const currTimeStr = String(curr.time || "");
  let startIdx = 0;
  
  if (currTimeStr && hourlyTimes.length > 0) {
    const currPrefix = currTimeStr.substring(0, 13);
    const exactMatch = hourlyTimes.findIndex((t: string) => String(t).startsWith(currPrefix));
    if (exactMatch !== -1) {
      startIdx = exactMatch;
    } else {
      const laterMatch = hourlyTimes.findIndex((t: string) => String(t) >= currTimeStr);
      if (laterMatch !== -1) startIdx = laterMatch;
    }
  }

  const hourlyItems = [];
  const endIdx = Math.min(hourlyTimes.length, startIdx + 24);
  for (let i = startIdx; i < endIdx; i++) {
    const tStr = hourlyTimes[i];
    let hourVal = i % 24;
    if (tStr.includes("T")) {
      hourVal = parseInt(tStr.split("T")[1].split(":")[0], 10);
    }
    const formattedTime = `${hourVal.toString().padStart(2, '0')}:00`;
    const hCode = hourly.weather_code?.[i] || 0;
    const [hCond, hIcon] = decodeWeatherCode(hCode);
    
    hourlyItems.push({
      time: formattedTime,
      hour: hourVal,
      temperature_c: hourly.temperature_2m?.[i] !== undefined ? hourly.temperature_2m[i] : currentTemp,
      feels_like_c: hourly.apparent_temperature?.[i] !== undefined ? hourly.apparent_temperature[i] : currentFeels,
      humidity_pct: hourly.relative_humidity_2m?.[i] !== undefined ? hourly.relative_humidity_2m[i] : 60,
      precipitation_mm: hourly.precipitation?.[i] || 0,
      precipitation_probability: hourly.precipitation_probability?.[i] || 0,
      rain_probability_pct: hourly.precipitation_probability?.[i] || 0,
      wind_speed_kmh: hourly.wind_speed_10m?.[i] || 10,
      cloud_cover_pct: hourly.cloud_cover?.[i] || 40,
      pressure_hpa: (hourly.pressure_msl || hourly.surface_pressure)?.[i] || 1013,
      visibility_km: hourly.visibility?.[i] ? hourly.visibility[i] / 1000 : 10,
      uv_index: hourly.uv_index?.[i] || 0,
      weather_code: hCode,
      condition: hCond,
      icon: hIcon
    });
  }

  // Daily mapping (7 days)
  const dailyItems = [];
  const dailyTimes = daily.time || [];
  for (let i = 0; i < Math.min(7, dailyTimes.length); i++) {
    const dateStr = dailyTimes[i];
    let dayName = `Day ${i + 1}`;
    let formattedDate = dateStr;
    try {
      const dObj = new Date(dateStr);
      if (i === 0) {
        dayName = "Today";
      } else {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        dayName = days[dObj.getDay()];
      }
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      formattedDate = `${months[dObj.getMonth()]} ${dObj.getDate()}`;
    } catch (e) {}

    const dCode = daily.weather_code?.[i] || 0;
    const [dCond, dIcon] = decodeWeatherCode(dCode);
    const dRain = daily.precipitation_probability_max?.[i] || 0;

    dailyItems.push({
      day: dayName,
      date: formattedDate,
      date_iso: dateStr,
      high_c: daily.temperature_2m_max?.[i] !== undefined ? daily.temperature_2m_max[i] : currentTemp,
      low_c: daily.temperature_2m_min?.[i] !== undefined ? daily.temperature_2m_min[i] : currentTemp - 5,
      condition: dCond,
      icon: dIcon,
      weather_code: dCode,
      daily_precipitation_probability: dRain,
      rain_probability_pct: dRain,
      precipitation_sum_mm: daily.precipitation_sum?.[i] || 0,
      wind_speed_max_kmh: daily.wind_speed_10m_max?.[i] || 15,
      wind_gusts_max_kmh: daily.wind_gusts_10m_max?.[i] || 25,
      uv_index_max: daily.uv_index_max?.[i] || 5,
      sunrise: daily.sunrise?.[i] ? daily.sunrise[i].split("T")[1].substring(0, 5) : "06:00",
      sunset: daily.sunset?.[i] ? daily.sunset[i].split("T")[1].substring(0, 5) : "18:30"
    });
  }

  // Construct standard Dashboard payload format
  return {
    location: {
      city: name,
      displayLocation: displayLoc,
      latitude: lat,
      longitude: lon,
      country: country || ""
    },
    current: {
      tempC: currentTemp,
      feelsLikeC: currentFeels,
      highC: daily.temperature_2m_max?.[0] !== undefined ? daily.temperature_2m_max[0] : currentTemp,
      lowC: daily.temperature_2m_min?.[0] !== undefined ? daily.temperature_2m_min[0] : currentTemp - 5,
      condition: cond,
      humidity: curr.relative_humidity_2m !== undefined ? curr.relative_humidity_2m : 60,
      windSpeedKmh: curr.wind_speed_10m || 10,
      icon: icon,
      weather_code: wCode,
      details: {
        pressure: curr.pressure_msl || curr.surface_pressure || 1013,
        visibility: hourly.visibility?.[startIdx] ? hourly.visibility[startIdx] / 1000 : 10,
        uv_index: daily.uv_index_max?.[0] || 5,
        precipitation: curr.precipitation || 0,
        cloud_cover: curr.cloud_cover || 40,
        wind_dir: curr.wind_direction_10m || 0
      }
    },
    hourly: hourlyItems,
    daily: dailyItems,
    airQuality: {},
    alerts: [],
    radar: {},
    sun: {
      sunrise: daily.sunrise?.[0] ? daily.sunrise[0].split("T")[1].substring(0, 5) : "06:19",
      sunset: daily.sunset?.[0] ? daily.sunset[0].split("T")[1].substring(0, 5) : "18:51"
    }
  };
}
