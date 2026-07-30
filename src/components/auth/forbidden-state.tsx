export function ForbiddenState({
  title = 'Access denied',
  description = 'Your current role cannot access this section.',
}: Readonly<{
  title?: string;
  description?: string;
}>) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-xl rounded-4xl border border-black/10 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
          Forbidden
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      </section>
    </main>
  );
}
