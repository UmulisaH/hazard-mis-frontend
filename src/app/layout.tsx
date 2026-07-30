import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/auth-context';
import { AppToaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hazard MIS Frontend',
  description: 'Role-aware hazard management frontend scaffold',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <AuthProvider>{children}</AuthProvider>
        <AppToaster />
      </body>
    </html>
  );
}
