/**
 * API client configuration and utilities.
 * Handles prepending the backend URL dynamically using environment variables.
 */

/**
 * Returns the base URL for API requests.
 * Uses VITE_API_URL if defined, otherwise falls back to empty string (relative path),
 * which is useful for local development proxying or Vercel rewrites.
 */
export function getApiBaseUrl(): string {
  // Vite exposes env vars via import.meta.env
  const baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
  
  // Remove trailing slash if present to avoid '//api'
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

import { fetchDirectDashboard } from './api/openMeteo';
import { getDemoAlerts, getDemoTrends, getDemoForecastIntelligence } from './demo/demoData';

/**
 * Wrapper around standard fetch to automatically prepend the base API URL.
 * Now acts as a frontend-only mock router if the backend is unavailable.
 * 
 * @param endpoint - The API endpoint, e.g. '/api/weather' or 'api/weather'
 * @param init - Standard RequestInit options
 */
export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  
  // Ensure the endpoint starts with a slash if baseUrl is present and doesn't end with one
  let normalizedEndpoint = endpoint;
  if (!normalizedEndpoint.startsWith('/')) {
    normalizedEndpoint = '/' + normalizedEndpoint;
  }
  
  // Frontend-only routing for DEMO MODE: intercept calls to backend and return Open-Meteo or dummy data
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

  try {
    const urlObj = new URL(normalizedEndpoint, 'http://localhost');
    const path = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    const city = searchParams.get('city') || 'Pune';

    if (isDemoMode) {
      if (path.startsWith('/api/weather/dashboard') || path.startsWith('/api/weather/current')) {
        const data = await fetchDirectDashboard(city);
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path.startsWith('/api/weather/alerts') || path.startsWith('/api/v1/alerts/history')) {
        return new Response(JSON.stringify(getDemoAlerts(city)), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path.startsWith('/api/trends')) {
        const range = searchParams.get('range') || '7d';
        return new Response(JSON.stringify(getDemoTrends(city, range)), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path.startsWith('/api/forecast-intelligence')) {
        return new Response(JSON.stringify(getDemoForecastIntelligence(city)), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path.startsWith('/api/map') || path.startsWith('/api/radar') || path.startsWith('/api/tiles')) {
         return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
  } catch (e) {
    console.warn("Error parsing URL in apiFetch mock router:", e);
  }
  
  const url = `${baseUrl}${normalizedEndpoint}`;
  
  try {
    const response = await fetch(url, init);
    return response;
  } catch (err) {
    console.warn(`Backend fetch failed for ${url}, returning empty JSON response as fallback.`);
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
