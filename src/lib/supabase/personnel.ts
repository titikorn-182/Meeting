/** Compatibility applies only to an absent new RPC, not failures inside it. */
export function isPersonnelClaimUnavailable(
  error: { code?: string; message?: string } | null,
): boolean {
  return error?.code === 'PGRST202' && /\bclaim_workspace_invitations\b/.test(error.message ?? '');
}

/** Only detects an older database policy so the API can request an upgrade. */
export function isLegacyPersonnelVerificationGate(result: unknown): boolean {
  return (
    !!result &&
    typeof result === 'object' &&
    'emailVerified' in result &&
    result.emailVerified === false
  );
}
