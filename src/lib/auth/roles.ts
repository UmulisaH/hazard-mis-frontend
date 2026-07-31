import type { AppRole } from './types';

export function hasRole(role: AppRole | null | undefined, expected: AppRole) {
  return role === expected;
}

export function hasAnyRole(
  role: AppRole | null | undefined,
  ...expected: AppRole[]
) {
  return role !== null && role !== undefined && expected.includes(role);
}
