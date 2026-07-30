'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { FieldError } from '../../../components/auth/form-feedback';
import { apiClient } from '@/lib/api/client';
import type { AuthResponse, LoginRequest } from '@/lib/auth/types';
import { useAuth } from '@/lib/auth/auth-context';
import type { NormalizedApiError } from '@/lib/api/types';

type LoginField = keyof LoginRequest;

function getFieldMessage(error: NormalizedApiError | null, field: LoginField) {
  return error?.fieldErrors?.[field]?.[0];
}

function EyeIcon({ open }: Readonly<{ open: boolean }>) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M2.5 12S5.7 5.5 12 5.5 21.5 12 21.5 12 18.3 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path
        d="M4 4l16 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3 12s3.2-6.5 9-6.5c1.2 0 2.3.2 3.3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M21 12s-3.2 6.5-9 6.5c-4.3 0-7.1-2.8-8.6-4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isBootstrapping, setSessionFromAuthResponse } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<NormalizedApiError | null>(null);

  useEffect(() => {
    if (!isBootstrapping && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isBootstrapping, router]);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.trim().length > 0,
    [email, password],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFieldError(null);

    const payload: LoginRequest = {
      email: email.trim(),
      password,
    };

    try {
      const response = await apiClient.post<AuthResponse>(
        '/auth/login',
        payload,
      );
      setSessionFromAuthResponse(response.data);
      toast.success('Signed in successfully.');
      router.replace('/dashboard');
    } catch (error) {
      const normalizedError = error as NormalizedApiError;
      setFieldError(normalizedError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.2))]" />

      <section className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/85 shadow-[0_28px_100px_rgba(15,23,42,0.14)] backdrop-blur lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="relative min-h-64 overflow-hidden bg-slate-950 p-8 text-white lg:min-h-full"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(15,23,42,0.24), rgba(15,23,42,0.72)), url('/auth-workspace.svg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.14),transparent_32%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
                Hazard MIS
              </p>
              <h1 className="mt-4 max-w-sm text-4xl font-semibold tracking-tight">
                Sign in and keep records moving.
              </h1>
            </div>
            <div className="mt-10 grid max-w-sm gap-3 text-sm text-slate-200">
              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Secure access for approved accounts
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                Fast route into hazard review and closure
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center p-6 sm:p-8 lg:p-10">
          <div className="w-full">
            <div className="mb-8 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                Secure access
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Sign in
              </h2>
              <p className="max-w-lg text-sm leading-6 text-slate-600">
                Use your account credentials to continue.
              </p>
            </div>

            <form className="grid gap-5" onSubmit={handleSubmit}>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:bg-white"
                  autoComplete="email"
                  required
                />
                <FieldError message={getFieldMessage(fieldError, 'email')} />
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Password
                <div className="relative mt-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:bg-white"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-4 text-slate-500 transition hover:text-slate-950"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                <FieldError message={getFieldMessage(fieldError, 'password')} />
              </label>

              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </button>

              <p className="text-center text-sm text-slate-600">
                No account yet?{' '}
                <Link
                  href="/register"
                  className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                >
                  Create one here
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
