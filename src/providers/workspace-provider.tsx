'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { SupabaseWorkspaceProvider } from '@/components/supabase-workspace-provider';
import { getDataConfiguration } from '@/lib/supabase/config';

// The only production-to-demo import boundary. Fixtures are loaded only in demo mode.
// Browser-only mounting also lets the demo restore storage before its first render.
const DemoWorkspaceProvider = dynamic(
  () => import('@/demo/demo-workspace-provider').then((module) => module.DemoWorkspaceProvider),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-dvh place-items-center" role="status">
        กำลังเปิดพื้นที่ทำงานทดลอง…
      </main>
    ),
  },
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const configuration = getDataConfiguration();
  return configuration.mode === 'demo' ? (
    <DemoWorkspaceProvider>{children}</DemoWorkspaceProvider>
  ) : (
    <SupabaseWorkspaceProvider>{children}</SupabaseWorkspaceProvider>
  );
}
