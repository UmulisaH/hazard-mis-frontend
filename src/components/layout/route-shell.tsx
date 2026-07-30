import type { ReactNode } from 'react';

export function RouteShell({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}>) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.58),rgba(255,255,255,0.22))]" />
      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-[2rem] border border-slate-900/10 bg-white/85 p-6 shadow-[0_28px_100px_rgba(15,23,42,0.1)] backdrop-blur sm:p-8 md:p-10">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="text-base leading-7 text-slate-600">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
