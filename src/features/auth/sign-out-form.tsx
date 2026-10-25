'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/app/auth/actions';
import { announceSessionChange } from '@/lib/session-events';

export function SignOutForm({
  label,
  className,
  disabled = false,
}: {
  label: string;
  className: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [, action, pending] = useActionState(async () => {
    announceSessionChange('changing');
    let destination = '/login?error=signout';
    try {
      const result = await signOut();
      destination = result.redirectTo;
    } catch {
      // Keep the recoverable login error when the action cannot be reached.
    } finally {
      // Even an interrupted response must let other tabs revalidate with the server.
      announceSessionChange('changed');
      router.replace(destination);
      router.refresh();
    }
    return null;
  }, null);
  return (
    <form action={action} aria-busy={pending}>
      <button className={className} type="submit" disabled={disabled || pending}>
        {label}
      </button>
    </form>
  );
}
