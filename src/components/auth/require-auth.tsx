'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth/auth-context';

export function RequireAuth({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isBootstrapping, router]);

  if (isBootstrapping) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
          Loading session...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
