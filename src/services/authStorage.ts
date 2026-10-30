// Central auth storage.
//
// The token is kept in sessionStorage so each browser tab has its own isolated
// session. Previously a single localStorage token was shared by every tab in
// the browser profile, so logging in as another account in a second tab
// silently changed the identity used by already-open tabs.
//
// Legacy localStorage entries are migrated once and then removed.

export interface StoredUser {
  userId: string;
  email: string;
  role: string;
  organizationId?: string | null;
  roles?: string[];
}

const TOKEN_KEY = 'prism_token';
const USER_KEY = 'prism_user';
const LEGACY_TOKEN_KEYS = ['prism_token', 'prism_jwt_token', 'token'];
const LEGACY_KEYS = [...LEGACY_TOKEN_KEYS, USER_KEY];

const hasWindow = () => typeof window !== 'undefined';

const sessionStore = (): Storage | null => (hasWindow() ? window.sessionStorage : null);
const localStore = (): Storage | null => (hasWindow() ? window.localStorage : null);

const purgeLegacy = () => {
  const store = localStore();
  if (!store) return;
  LEGACY_KEYS.forEach((key) => store.removeItem(key));
};

// Move any pre-existing localStorage session into this tab's sessionStorage.
const migrateLegacy = () => {
  const legacy = localStore();
  const session = sessionStore();
  if (!legacy || !session) return;

  const legacyToken = LEGACY_TOKEN_KEYS.map((key) => legacy.getItem(key)).find(Boolean) || null;
  const legacyUser = legacy.getItem(USER_KEY);
  if (!legacyToken && !legacyUser) return;

  if (legacyToken && !session.getItem(TOKEN_KEY)) {
    session.setItem(TOKEN_KEY, legacyToken);
  }
  if (legacyUser && !session.getItem(USER_KEY)) {
    session.setItem(USER_KEY, legacyUser);
  }
  purgeLegacy();
};

export const getAuthToken = (): string | null => {
  const session = sessionStore();
  if (!session) return null;
  migrateLegacy();
  return session.getItem(TOKEN_KEY) || null;
};

export const setAuthToken = (token: string) => {
  const session = sessionStore();
  if (!session) return;
  session.setItem(TOKEN_KEY, token);
  purgeLegacy();
};

export const getStoredAuthUser = (): StoredUser | null => {
  const session = sessionStore();
  if (!session) return null;
  migrateLegacy();

  const raw = session.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

export const setAuthSession = (token: string, user?: StoredUser | null) => {
  const session = sessionStore();
  if (!session) return;
  session.setItem(TOKEN_KEY, token);
  if (user) session.setItem(USER_KEY, JSON.stringify(user));
  else session.removeItem(USER_KEY);
  purgeLegacy();
};

export const clearAuthSession = () => {
  const session = sessionStore();
  if (session) {
    session.removeItem(TOKEN_KEY);
    session.removeItem(USER_KEY);
  }
  purgeLegacy();
};