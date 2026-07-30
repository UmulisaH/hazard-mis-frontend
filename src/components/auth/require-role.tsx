'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import type { AppRole } from '@/lib/auth/types';
import { ForbiddenState } from './forbidden-state';

function roleMatches(role: AppRole | null, allowedRoles: readonly AppRole[]) {
  return role !== null && allowedRoles.includes(role);
}

export function RequireRole({
  allowedRoles,
  children,
  fallback,
}: Readonly<{
  allowedRoles: readonly AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}>) {
  const { isBootstrapping, role } = useAuth();

  if (isBootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
          Checking access...
        </div>
      </main>
    );
  }

  if (!roleMatches(role, allowedRoles)) {
    if (fallback) {
      return fallback;
    }

    return (
      <ForbiddenState
        title="Role restricted"
        description="The current session is authenticated, but this role is not permitted to use this page."
      />
    );
  }

  return children;
}
