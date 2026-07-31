'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import type { AppRole } from '@/lib/auth/types';
import { hasAnyRole } from '@/lib/auth/roles';

export function Can({
  anyOf,
  children,
  fallback = null,
}: Readonly<{
  anyOf: readonly AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}>) {
  const { role, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return fallback;
  }

  if (!hasAnyRole(role, ...anyOf)) {
    return fallback;
  }

  return children;
}
