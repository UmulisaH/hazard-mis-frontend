import type { ReactNode } from 'react';

export function FormAlert({
  tone,
  children,
}: Readonly<{
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}>) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    info: 'border-slate-200 bg-slate-50 text-slate-700',
  } as const;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${styles[tone]}`}
    >
      {children}
    </div>
  );
}

export function FieldError({ message }: Readonly<{ message?: string }>) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-rose-700">{message}</p>;
}
