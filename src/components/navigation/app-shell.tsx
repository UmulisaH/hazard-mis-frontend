'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Can } from '@/components/auth/can';
import { useAuth } from '@/lib/auth/auth-context';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', note: 'Overview and signals' },
  { href: '/hazards', label: 'Hazards', note: 'Workflow queue' },
  { href: '/hazards/new', label: 'New report', note: 'Capture a hazard' },
  { href: '/ai', label: 'AI', note: 'Model tools' },
  { href: '/profile', label: 'Profile', note: 'Your account' },
] as const;

const ADMIN_LINKS = [
  { href: '/institutions', label: 'Institutions', note: 'Institution master data' },
  { href: '/departments', label: 'Departments', note: 'Department master data' },
  { href: '/hazard-categories', label: 'Hazard categories', note: 'Hazard reference data' },
  { href: '/severity-levels', label: 'Severity levels', note: 'Severity reference data' },
  { href: '/users', label: 'Users', note: 'Role management' },
] as const;

function isActiveRoute(pathname: string, href: string) {
  if (href === '/dashboard' || href === '/ai' || href === '/profile') {
    return pathname === href;
  }

  if (href === '/hazards/new') {
    return pathname === href;
  }

  if (href === '/hazards') {
    return pathname === href || pathname.startsWith('/hazards/') && pathname !== '/hazards/new';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  note,
  active,
  onNavigate,
}: Readonly<{
  href: string;
  label: string;
  note: string;
  active: boolean;
  onNavigate?: () => void;
}>) {
  return (
      <Link
      href={href}
      onClick={onNavigate}
      className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
        active
          ? 'border-amber-200 bg-amber-100 text-slate-950 shadow-[0_14px_40px_rgba(15,23,42,0.12)]'
          : 'border-transparent bg-white/0 text-slate-600 hover:border-slate-200 hover:bg-white/80 hover:text-slate-950'
      }`}
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{label}</span>
        <span
          className={`text-xs ${
            active ? 'text-slate-600' : 'text-slate-500'
          }`}
        >
          {note}
        </span>
      </span>
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active ? 'bg-amber-500' : 'bg-slate-300 group-hover:bg-slate-500'
        }`}
      />
    </Link>
  );
}

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { currentUser, role, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navLinks = NAV_LINKS.filter(
    (link) => !(role !== 'reporter' && link.href === '/hazards/new'),
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.45),transparent_26%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="hidden w-80 shrink-0 border-r border-black/10 bg-white/70 px-5 py-6 backdrop-blur md:flex md:flex-col">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                Hazard MIS
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Safety command center
              </h1>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-black/10 bg-slate-950 p-4 text-white shadow-[0_18px_50px_rgba(15,23,42,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
              Session
            </p>
            <p className="mt-3 break-words text-sm font-medium text-white">
              {currentUser ? currentUser.email : 'Authenticated workspace'}
            </p>
          </div>

          <nav className="mt-6 flex flex-1 flex-col gap-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                note={link.note}
                active={isActiveRoute(pathname, link.href)}
              />
            ))}

            <Can anyOf={['admin']}>
              <div className="mt-4">
                <p className="px-4 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Administration
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {ADMIN_LINKS.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      label={link.label}
                      note={link.note}
                      active={isActiveRoute(pathname, link.href)}
                    />
                  ))}
                </div>
              </div>
            </Can>
          </nav>

          <div className="mt-6 rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={logout}
              className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-black/10 bg-white/80 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Hazard MIS
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {currentUser ? currentUser.email : 'Authenticated workspace'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-label="Open navigation menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-slate-950 shadow-sm transition hover:bg-slate-50"
              >
                <span className="flex flex-col gap-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              </button>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-r border-black/10 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.3)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                  Hazard MIS
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Navigation
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-3xl border border-black/10 bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                Session
              </p>
              <p className="mt-3 break-words text-sm font-medium">
                {currentUser ? currentUser.email : 'Authenticated workspace'}
              </p>
            </div>

            <nav className="mt-5 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  note={link.note}
                  active={isActiveRoute(pathname, link.href)}
                  onNavigate={() => setDrawerOpen(false)}
                />
              ))}

              <Can anyOf={['admin']}>
                <div className="mt-4">
                  <p className="px-4 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Administration
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {ADMIN_LINKS.map((link) => (
                      <NavLink
                        key={link.href}
                        href={link.href}
                        label={link.label}
                        note={link.note}
                        active={isActiveRoute(pathname, link.href)}
                        onNavigate={() => setDrawerOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              </Can>
            </nav>

            <button
              type="button"
              onClick={logout}
              className="mt-4 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
