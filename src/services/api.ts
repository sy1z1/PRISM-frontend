import { clearAuthSession, getAuthToken } from './authStorage';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
const apiBaseUrl = import.meta.env.DEV ? '' : configuredApiBaseUrl;

export const AUTH_EXPIRED_EVENT = 'prism:unauthorized';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const apiUrl = (endpoint: string) => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${apiBaseUrl}${path}`;
};

// Maps a stored legacy URL (/uploads/...) to the authenticated file API.
export const fileEndpointFor = (path: string | null | undefined): string | null => {
  if (!path) return null;
  const clean = path.split('?')[0];
  const fileName = clean.split('/').pop();
  if (!fileName) return null;
  if (clean.startsWith('/uploads/tickets/')) {
    return `/api/files/tickets/${encodeURIComponent(fileName)}`;
  }
  if (clean.startsWith('/uploads/assets/360/')) {
    return `/api/files/assets/360/${encodeURIComponent(fileName)}`;
  }
  if (clean.startsWith('/uploads/assets/thumbnails/')) {
    return `/api/files/assets/thumbnails/${encodeURIComponent(fileName)}`;
  }
  return null;
};

// Kept for external/data URLs. /uploads paths must go through SecureMedia.
export const resolveMediaUrl = (path: string | null | undefined) => {
  if (!path) return '';
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  return apiUrl(fileEndpointFor(path) ?? path);
};

// Fetches an authenticated media file and returns a blob URL. The caller must
// revoke the blob URL when it is no longer needed.
export const fetchMediaBlobUrl = async (path: string | null | undefined): Promise<string | null> => {
  if (!path) return null;
  if (/^(?:data:|blob:)/i.test(path)) return path;
  if (/^https?:/i.test(path)) return path;

  const endpoint = fileEndpointFor(path);
  if (!endpoint) return null;

  const token = getAuthToken();
  const response = await fetch(apiUrl(endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    throw new ApiError('MEDIA_UNAVAILABLE', response.status, 'MEDIA_UNAVAILABLE');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

const getStoredToken = () => getAuthToken();

export const fetchApi = async <T,>(
  endpoint: string,
  init: RequestInit = {},
  token?: string | null
): Promise<T> => {
  const headers = new Headers(init.headers);
  const usingStoredToken = token === undefined;
  const authToken = usingStoredToken ? getStoredToken() : token;
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiUrl(endpoint), { ...init, headers });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const code =
      typeof result?.error === 'string'
        ? result.error
        : typeof result?.message === 'string'
          ? result.message
          : `API_ERROR_${response.status}`;
    const message =
      typeof result?.message === 'string'
        ? result.message
        : `API Error (${response.status}): ${response.statusText}`;

    if (response.status === 401 && usingStoredToken && endpoint !== '/api/identity/login') {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
    }

    throw new ApiError(message, response.status, code);
  }

  return result as T;
};
