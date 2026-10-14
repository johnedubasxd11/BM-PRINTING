// Single source of truth for the backend API origin. Development uses the
// Vite proxy (empty base → same-origin /api). Production/other hosts set
// VITE_API_BASE_URL to the deployed backend's HTTPS origin (never localhost).
const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const apiUrl = url => (/^https?:\/\//i.test(url)
  ? url
  : `${apiBase}${url.startsWith('/') ? url : `/${url}`}`);

// fetch wrapper that turns connection failures (backend down, DNS, CORS,
// blocked requests) into a clear message instead of the browser's raw
// "Failed to fetch" TypeError.
export async function apiFetch(url, options) {
  try {
    return await fetch(apiUrl(url), options);
  } catch {
    throw new Error(apiBase
      ? 'Cannot reach the server. Check your internet connection and try again.'
      : 'Cannot reach the server. If you are running this locally, make sure the backend is started (npm run dev).');
  }
}
