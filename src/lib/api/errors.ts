import type { AxiosError } from 'axios';

import type {
  ApiErrorResponse,
  ApiFieldErrors,
  NormalizedApiError,
} from './types';

const AUTH_PATHS = ['/auth/login', '/auth/register'];

function isBrowser() {
  return typeof window !== 'undefined';
}

export function isAuthEndpoint(url?: string | null) {
  if (!url) {
    return false;
  }

  return AUTH_PATHS.some((path) => url.includes(path));
}

export function redirectToLogin(reason: string) {
  if (!isBrowser()) {
    return;
  }

  const loginUrl = new URL('/login', window.location.origin);
  loginUrl.searchParams.set('reason', reason);
  window.location.replace(loginUrl.toString());
}

function toFieldName(message: string) {
  const trimmed = message.trim();
  const prefixes = ['property ', 'field ', 'value '];
  const lower = trimmed.toLowerCase();

  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      return trimmed.slice(prefix.length).split(/[\s.:]/)[0] ?? null;
    }
  }

  const match = trimmed.match(
    /^([a-zA-Z0-9_.-]+)\s+(must|should|cannot|can|is|are|may|needs|requires)/i,
  );
  return match?.[1] ?? null;
}

function normalizeMessage(
  message: string | string[] | undefined,
  fallback: string,
) {
  if (Array.isArray(message)) {
    return message.length > 0 ? message.join('; ') : fallback;
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  return fallback;
}

function addFieldError(
  fieldErrors: ApiFieldErrors,
  fieldName: string,
  entry: string,
) {
  fieldErrors[fieldName] = [...(fieldErrors[fieldName] ?? []), entry];
}

function collectValidationFieldErrors(
  message: string | string[] | undefined,
) {
  const fieldErrors: ApiFieldErrors = {};
  const messages = Array.isArray(message)
    ? message
    : typeof message === 'string'
      ? [message]
      : [];

  for (const entry of messages) {
    const fieldName = toFieldName(entry);
    if (!fieldName) {
      continue;
    }

    addFieldError(fieldErrors, fieldName, entry);
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function collectConflictFieldErrors(
  message: string | string[] | undefined,
) {
  const fieldErrors: ApiFieldErrors = {};
  const messages = Array.isArray(message)
    ? message
    : typeof message === 'string'
      ? [message]
      : [];

  for (const entry of messages) {
    const lower = entry.toLowerCase();

    if (/\bemail\b/.test(lower)) {
      addFieldError(fieldErrors, 'email', entry);
    }

    if (/\brssb(\s*code)?\b/.test(lower)) {
      addFieldError(fieldErrors, 'rssbCode', entry);
    }

    if (/\bdepartment(\s*id)?\b/.test(lower)) {
      addFieldError(fieldErrors, 'departmentId', entry);
    }

    if (/\binstitution\b/.test(lower) && /\bname\b/.test(lower)) {
      addFieldError(fieldErrors, 'name', entry);
    }

    if (/\bdepartment\b/.test(lower) && /\bname\b/.test(lower)) {
      addFieldError(fieldErrors, 'name', entry);
    }

    if (/\bname\b/.test(lower) && /duplicate|already exists|already taken|in use/.test(lower)) {
      addFieldError(fieldErrors, 'name', entry);
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

export function normalizeApiError(
  error: AxiosError<ApiErrorResponse | Record<string, unknown>>,
): NormalizedApiError {
  const response = error.response;
  const data = response?.data;
  const status = response?.status ?? 0;
  const message =
    typeof data === 'object' && data !== null && 'message' in data
      ? (data as ApiErrorResponse).message
      : undefined;

  return {
    status,
    message: normalizeMessage(message, error.message || 'Request failed'),
    fieldErrors:
      status === 400
        ? collectValidationFieldErrors(message)
        : status === 409
          ? collectConflictFieldErrors(message) ??
            collectValidationFieldErrors(message)
          : undefined,
    raw: data ?? error,
  };
}

export function shouldForceLogoutOnError(error: AxiosError<ApiErrorResponse>) {
  return error.response?.status === 401 && !isAuthEndpoint(error.config?.url);
}
