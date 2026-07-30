const ACCESS_TOKEN_KEY = 'access_token';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getAccessTokenKey() {
  return ACCESS_TOKEN_KEY;
}

export function readAccessToken() {
  if (!isBrowser()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeAccessToken(token: string) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // Ignore storage failures and let the UI surface the login error.
  }
}

export function clearAuthStorage() {
  if (!isBrowser()) {
    return;
  }

  try {
    window.sessionStorage.clear();
  } catch {
    // Ignore storage failures so logout remains best-effort.
  }
}
