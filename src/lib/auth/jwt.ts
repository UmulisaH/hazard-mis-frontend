import type { AppRole, DecodedJwtPayload } from './types';

function base64UrlToBase64(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const missingPadding = padded.length % 4;
  return missingPadding === 0
    ? padded
    : `${padded}${'='.repeat(4 - missingPadding)}`;
}

export function decodeJwtPayload(token: string): DecodedJwtPayload | null {
  const parts = token.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(
      atob(base64UrlToBase64(parts[1])),
    ) as Partial<DecodedJwtPayload>;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.is_safety_officer !== 'boolean' ||
      typeof payload.is_admin !== 'boolean' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      is_safety_officer: payload.is_safety_officer,
      is_admin: payload.is_admin,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

export function isJwtExpired(
  payload: DecodedJwtPayload,
  now = Math.floor(Date.now() / 1000),
) {
  return payload.exp <= now;
}

export function deriveAppRole(
  payload: Pick<DecodedJwtPayload, 'is_admin' | 'is_safety_officer'>,
): AppRole {
  if (payload.is_admin) {
    return 'Admin';
  }

  if (payload.is_safety_officer) {
    return 'Safety Officer';
  }

  return 'Reporter';
}
