import { getVerifiedUser } from '@/lib/supabase/server';
import { SupabaseConfigurationError, requireSupabaseConfiguration } from '@/lib/supabase/config';
import type { Json } from '@/lib/supabase/database.types';
import { isWorkspaceSnapshot, WorkspaceError } from '@/lib/workspace';
import { assertSameOrigin, isUuid, mapDatabaseError, parseWorkspaceCommand } from '@/lib/workspace-validation';

export const dynamic = 'force-dynamic';
const responseHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' };
function fail(error: unknown) {
  const problem = error instanceof WorkspaceError ? error : error instanceof SupabaseConfigurationError
    ? new WorkspaceError('CONFIGURATION_REQUIRED', 503) : new WorkspaceError('CONNECTION_FAILED', 503);
  return Response.json({ error: { code: problem.code, message: problem.message } }, { status: problem.status, headers: responseHeaders });
}
async function clientForUser() {
  const result = await getVerifiedUser();
  if (!result.user) {
    if (result.error && result.error.status && result.error.status >= 500) throw new WorkspaceError('CONNECTION_FAILED', 503);
    throw new WorkspaceError('UNAUTHENTICATED', 401);
  }
  return result.client;
}

export async function GET(request: Request) {
  try {
    const configuration = requireSupabaseConfiguration();
    const requestedOrg = new URL(request.url).searchParams.get('organizationId') || configuration.organizationId;
    if (requestedOrg && !isUuid(requestedOrg)) throw new WorkspaceError('VALIDATION_FAILED', 400);
    const client = await clientForUser();
    const { data, error } = await client.rpc('get_workspace_state', requestedOrg ? { p_organization_id: requestedOrg } : {});
    if (error) throw mapDatabaseError(error);
    if (data && typeof data === 'object' && !('access' in data)) throw new WorkspaceError('SCHEMA_NOT_READY', 503);
    if (!isWorkspaceSnapshot(data)) throw new WorkspaceError('INVALID_RESPONSE', 502);
    return Response.json(data, { headers: responseHeaders });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new WorkspaceError('VALIDATION_FAILED', 415);
    if (Number(request.headers.get('content-length')) > 65536) throw new WorkspaceError('VALIDATION_FAILED', 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 65536) throw new WorkspaceError('VALIDATION_FAILED', 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new WorkspaceError('VALIDATION_FAILED', 400); }
    const command = parseWorkspaceCommand(input);
    const configuration = requireSupabaseConfiguration();
    if (configuration.organizationId && configuration.organizationId !== command.organizationId) throw new WorkspaceError('FORBIDDEN', 403);
    const client = await clientForUser();
    const { data, error } = await client.rpc('workspace_command', {
      p_organization_id: command.organizationId, p_operation: command.operation,
      p_payload: command.payload as Json, p_idempotency_key: command.idempotencyKey,
    });
    if (error) throw mapDatabaseError(error);
    return Response.json(data, { headers: responseHeaders });
  } catch (error) { return fail(error); }
}
