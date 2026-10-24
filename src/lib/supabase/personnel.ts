/** Compatibility applies only to an absent new RPC, not failures inside it. */
export function isPersonnelClaimUnavailable(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'PGRST202' && /\bclaim_workspace_invitations\b/.test(error.message ?? '');
}

export function needsVerifiedPersonnelEmail(result: unknown): boolean {
  return !!result && typeof result === 'object' && 'emailVerified' in result && result.emailVerified === false;
}
