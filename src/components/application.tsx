"use client";

import { usePathname } from 'next/navigation';
import { DemoProvider } from './demo-provider';
import { AppShell } from './app-shell';

export function Application({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/')) return children;
  return <DemoProvider><AppShell>{children}</AppShell></DemoProvider>;
}
