'use client';

import { useEffect, useState } from 'react';

import { RouteShell } from '@/components/layout/route-shell';
import { FormAlert } from '@/components/auth';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import type { CurrentUserProfile } from '@/lib/auth/types';
import type { NormalizedApiError } from '@/lib/api/types';

function getInitials(name: string | null | undefined) {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) {
    return 'U';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function ProfilePage() {
  const { profile, hydrateProfile } = useAuth();
  const [loading, setLoading] = useState(!profile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (profile) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<CurrentUserProfile>('/users/me');
        if (active) {
          hydrateProfile(response.data);
          setLoading(false);
        }
      } catch (caughtError) {
        if (active) {
          const normalizedError = caughtError as NormalizedApiError;
          setError(normalizedError.message);
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [hydrateProfile, profile]);

  return (
    <RouteShell
      eyebrow="Profile"
      title="Current user profile"
      description="Review your account details."
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-black/10 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="border-b border-black/10 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.9))] px-6 py-8 text-white sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/10 text-2xl font-semibold tracking-tight text-white">
              {loading ? 'U' : getInitials(profile?.fullName)}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
                Profile
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {loading
                  ? 'Loading profile...'
                  : (profile?.fullName ?? 'Unavailable')}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                {loading
                  ? 'Loading profile...'
                  : (profile?.jobTitle ?? 'Unavailable')}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-6 sm:px-8 md:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Email
            </p>
            <p className="mt-2 font-medium text-slate-950">
              {loading
                ? 'Loading profile...'
                : (profile?.email ?? 'Unavailable')}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Phone
            </p>
            <p className="mt-2 font-medium text-slate-950">
              {loading
                ? 'Loading profile...'
                : (profile?.phone ?? 'Unavailable')}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-700 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Department
            </p>
            <p className="mt-2 font-medium text-slate-950">
              {loading
                ? 'Loading profile...'
                : (profile?.department?.name ?? 'Unavailable')}
            </p>
          </div>
        </div>
      </div>
    </RouteShell>
  );
}
