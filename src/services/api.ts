const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const apiBaseUrl = import.meta.env.DEV ? '' : configuredApiBaseUrl;

export const apiUrl = (endpoint: string) => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${apiBaseUrl}${path}`;
};

export const resolveMediaUrl = (path: string | null | undefined) => {
  if (!path) return '';
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  return apiUrl(path);
};

const getStoredToken = () => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('prism_token') ||
    localStorage.getItem('prism_jwt_token') ||
    localStorage.getItem('token');
};

export const fetchApi = async <T,>(
  endpoint: string,
  init: RequestInit = {},
  token?: string | null
): Promise<T> => {
  const headers = new Headers(init.headers);
  const authToken = token === undefined ? getStoredToken() : token;
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiUrl(endpoint), { ...init, headers });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || result?.message || `API Error (${response.status}): ${response.statusText}`);
  }
  return result as T;
};
