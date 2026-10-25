'use client';

import { usePathname } from 'next/navigation';
import { WorkspaceProvider } from '@/providers/workspace-provider';
import { AppShell } from './app-shell';

export function Application({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/'))
    return children;
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
