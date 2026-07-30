import type { ReactNode } from 'react';

import { PublicRoute } from '@/components/auth/public-route';

export default function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <PublicRoute>{children}</PublicRoute>;
}
