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
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // Remove trailing slash if present to avoid '//api'
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

/**
 * Wrapper around standard fetch to automatically prepend the base API URL.
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
  
  const url = `${baseUrl}${normalizedEndpoint}`;
  
  return fetch(url, init);
}
