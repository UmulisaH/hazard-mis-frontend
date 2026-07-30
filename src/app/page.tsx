'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth/auth-context';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [isAuthenticated, isBootstrapping, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
        Initializing session...
      </div>
    </main>
  );
}
