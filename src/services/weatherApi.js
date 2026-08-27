const API_BASE_URL = 'http://127.0.0.1:8000';
const WS_BASE_URL = 'ws://127.0.0.1:8000';

/**
 * Fetch full normalized weather data for a city from centralized backend
 * @param {string} city
 * @returns {Promise<Object>}
 */
export async function fetchCityWeather(city) {
  const query = city ? city.trim() : 'Pune';
  const url = `${API_BASE_URL}/api/weather?city=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errorMsg = errJson.detail || `Failed to fetch weather for "${query}" (Status ${res.status})`;
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Backend server is not reachable. Please ensure FastAPI is running on port 8000.');
    }
    throw err;
  }
}

/**
 * Fetch point weather data for specific geographic coordinates
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>}
 */
export async function fetchPointWeather(lat, lon) {
  const url = `${API_BASE_URL}/api/weather?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Coordinates weather fetch failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error('Point weather error:', err);
    throw err;
  }
}

/**
 * Fetch centralized map dataset containing all layer variables (Temperature, Rain, Wind, Clouds, Pressure, Humidity, Visibility)
 * @returns {Promise<{ cities: Array, count: number, updatedAt: string, stale: boolean }>}
 */
export async function fetchMapWeather() {
  const url = `${API_BASE_URL}/api/map/weather`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Map weather fetch failed (${res.status})`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Map weather fetch error:', err);
    throw err;
  }
}

// Backward-compatible alias
export async function fetchMapCities() {
  const res = await fetchMapWeather();
  return res.cities || [];
}

/**
 * Fetch active weather alerts and safety warnings from Redis-backed Alerts API
 * @param {string} [city] - Optional city name
 * @returns {Promise<{ city?: string, alerts: Array, count: number }>}
 */
export async function fetchAlerts(city) {
  const url = city && city.trim()
    ? `${API_BASE_URL}/api/alerts?city=${encodeURIComponent(city.trim())}`
    : `${API_BASE_URL}/api/alerts`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Alerts fetch failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error('Alerts fetch error:', err);
    throw err;
  }
}

/**
 * Fetch latest cached RainViewer radar metadata & tile URL template
 * @returns {Promise<Object>}
 */
export async function fetchRadarMetadata() {
  const url = `${API_BASE_URL}/api/radar`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Radar metadata fetch failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error('Radar metadata fetch error:', err);
    throw err;
  }
}

/**
 * Send natural language question to WeatherGPT backend
 * @param {string} message
 * @param {string} city
 * @returns {Promise<{ reply: string, city: string, timestamp: string }>}
 */
export async function sendChatQuestion(message, city = 'Pune', history = [], language = 'en') {
  const url = `${API_BASE_URL}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, city, history, language })
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.detail || 'WeatherGPT service unavailable');
  }

  return await res.json();
}

/**
 * Establish live WebSocket connection for background weather & radar push broadcasts
 * @param {Function} onMessage - Callback on receiving push update
 * @param {string} [city] - Optional city to subscribe to
 * @returns {WebSocket}
 */
export function connectWeatherWebSocket(onMessage, city = 'Pune') {
  try {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/weather`);

    ws.onopen = () => {
      if (city) {
        ws.send(JSON.stringify({ action: 'subscribe', city }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (typeof onMessage === 'function') {
          onMessage(payload);
        }
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    ws.onerror = (err) => {
      // Non-blocking WebSocket warning
      console.warn('Weather WebSocket stream offline (polling fallback active).');
    };

    return ws;
  } catch (err) {
    console.warn('Could not initialize WebSocket connection:', err);
    return null;
  }
}

/**
 * Fetch real weather observation trends and Skycast risk history from PostgreSQL
 * @param {string} city
 * @param {string} [range='24h'] - '24h' | '7d' | '30d'
 * @param {string} [compareWith] - Optional secondary city
 * @returns {Promise<Object>}
 */
export async function fetchTrends(city = 'Pune', range = '24h', compareWith = null) {
  const query = city ? city.trim() : 'Pune';
  let url = `${API_BASE_URL}/api/trends?city=${encodeURIComponent(query)}&range=${encodeURIComponent(range)}`;
  if (compareWith && compareWith.trim()) {
    url += `&compareWith=${encodeURIComponent(compareWith.trim())}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `Failed to fetch trends for ${query} (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Backend server is not reachable. Please ensure FastAPI is running on port 8000.');
    }
    throw err;
  }
}

/**
 * Fetch grounded agriculture, spraying, and irrigation advisory for a location and crop
 * @param {string} city
 * @param {string} [crop='Cotton']
 * @param {string} [stage='Flowering']
 * @returns {Promise<Object>}
 */
export async function fetchAgricultureAdvisory(city = 'Pune', crop = 'Cotton', stage = 'Flowering') {
  const query = city ? city.trim() : 'Pune';
  const url = `${API_BASE_URL}/api/agriculture?city=${encodeURIComponent(query)}&crop=${encodeURIComponent(crop)}&stage=${encodeURIComponent(stage)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `Failed to fetch agriculture advisory for ${query} (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Backend server is not reachable. Please ensure FastAPI is running on port 8000.');
    }
    throw err;
  }
}

/**
 * Fetch practical contextual weather recommendations (umbrella, jacket, running, events, travel, drying clothes)
 * @param {string} city
 * @param {string} [activity='all']
 * @returns {Promise<Object>}
 */
export async function fetchRecommendations(city = 'Pune', activity = 'all') {
  const query = city ? city.trim() : 'Pune';
  const url = `${API_BASE_URL}/api/recommendations?city=${encodeURIComponent(query)}&activity=${encodeURIComponent(activity)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `Failed to fetch recommendations for ${query} (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Backend server is not reachable. Please ensure FastAPI is running on port 8000.');
    }
    throw err;
  }
}


