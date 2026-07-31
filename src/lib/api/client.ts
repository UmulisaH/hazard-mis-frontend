import axios, { type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

import {
  normalizeApiError,
  redirectToLogin,
  shouldForceLogoutOnError,
} from './errors';

import { clearAuthStorage, readAccessToken } from '@/lib/auth/session';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

function isJsonBody(data: unknown) {
  return (
    data !== null &&
    typeof data === 'object' &&
    !(data instanceof FormData) &&
    !(data instanceof Blob) &&
    !(data instanceof ArrayBuffer) &&
    !(data instanceof URLSearchParams)
  );
}

function applyRequestHeaders(config: InternalAxiosRequestConfig) {
  const token = readAccessToken();
  config.headers = config.headers ?? {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  if (isJsonBody(config.data) && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }

  config.headers.Accept = 'application/json';
  return config;
}

function errorToastMessage(status: number, message: string) {
  switch (status) {
    case 401:
      return 'Your session expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource could not be found.';
    case 500:
      return 'A server error occurred. Please try again.';
    default:
      return message;
  }
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(applyRequestHeaders);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalizedError = normalizeApiError(error);
    const hasAccessToken = Boolean(readAccessToken());
    const shouldToastInlineFallback =
      (normalizedError.status === 400 || normalizedError.status === 409) &&
      !normalizedError.fieldErrors;

    if (typeof window !== 'undefined') {
      if (
        (normalizedError.status === 401 && hasAccessToken) ||
        normalizedError.status === 403 ||
        normalizedError.status === 404 ||
        normalizedError.status === 500 ||
        shouldToastInlineFallback
      ) {
        toast.error(
          errorToastMessage(normalizedError.status, normalizedError.message),
        );
      } else if (normalizedError.status !== 0 && !normalizedError.fieldErrors) {
        toast.error(normalizedError.message);
      }
    }

    // A 401 from a public page (for example, registration loading reference
    // data after logout) is not an expired session. Only redirect when there
    // is an access token that can actually be invalidated.
    if (shouldForceLogoutOnError(error) && hasAccessToken) {
      clearAuthStorage();
      redirectToLogin('session-expired');
    }

    return Promise.reject(normalizedError);
  },
);

export { apiBaseUrl };
