import type { ReactNode } from 'react';

import { RequireAuth } from '@/components/auth/require-auth';
import { HazardWorkflowProvider } from '@/components/hazards/hazard-workflow-provider';
import { AppShell } from '@/components/navigation/app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <RequireAuth>
      <HazardWorkflowProvider>
        <AppShell>{children}</AppShell>
      </HazardWorkflowProvider>
    </RequireAuth>
  );
}
