'use client';

import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            'rounded-2xl border border-black/10 bg-white text-slate-950 shadow-lg',
          title: 'text-sm font-semibold',
          description: 'text-sm text-slate-600',
          actionButton:
            'rounded-full bg-slate-950 text-white hover:bg-slate-800',
          cancelButton:
            'rounded-full border border-black/10 bg-white text-slate-700 hover:bg-slate-50',
        },
      }}
    />
  );
}
