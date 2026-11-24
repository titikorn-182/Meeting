'use client';

import { usePathname } from 'next/navigation';
import { WorkspaceProvider } from '@/providers/workspace-provider';
import { AppShell } from './app-shell';

export function Application({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (
    [
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/account',
      '/help',
    ].includes(pathname) ||
    pathname.startsWith('/auth/')
  )
    return children;
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
