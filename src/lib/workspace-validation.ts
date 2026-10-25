import { workspaceCommandSchema } from './workspace-commands';
import { workspaceOperations, WorkspaceError, type WorkspaceCommand } from './workspace';
import { ACCESS_ROLES, STAFF_PAGE_KEYS, isPageList } from './access-control';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}
function invalid(): never {
  throw new WorkspaceError('VALIDATION_FAILED', 400);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 10000, optional = false): string {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()))
    return invalid();
  return value.trim();
}
function id(value: unknown): string {
  if (!isUuid(value)) return invalid();
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid();
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) return invalid();
  return value as T;
}
function date(value: unknown, optional = false): string {
  if (optional && !value) return '';
  const result = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return invalid();
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result)
    return invalid();
  return result;
}
function criteria(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) return invalid();
  return value.map((x) => text(x, 2000));
}
function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) return invalid();
  return value as number;
}

/** Whitelist payload fields; the database independently validates business invariants. */
export function parseWorkspaceCommand(value: unknown): WorkspaceCommand {
  const body = record(value);
  const operation = choice(body.operation, workspaceOperations);
  const p = record(body.payload);
  let payload: Record<string, unknown>;
  const target = () => ({ id: id(p.id), expectedVersion: version(p.expectedVersion) });
  switch (operation) {
    case 'acknowledge_task':
      payload = target();
      break;
    case 'transition_task': {
      const status = choice(p.status, ['in_progress', 'submitted', 'accepted', 'revision']);
      payload = {
        ...target(),
        status,
        note: text(p.note, 10000, !['accepted', 'revision'].includes(status)),
      };
      if (status === 'accepted' || status === 'revision') {
        if (
          !Array.isArray(p.criterionResults) ||
          !p.criterionResults.length ||
          p.criterionResults.length > 100 ||
          !p.criterionResults.every((x) => typeof x === 'boolean')
        )
          return invalid();
        if (status === 'accepted' && !p.criterionResults.every(Boolean)) return invalid();
        payload.criterionResults = p.criterionResults;
      }
      break;
    }
    case 'update_progress': {
      if (
        typeof p.progress !== 'number' ||
        !Number.isFinite(p.progress) ||
        p.progress < 0 ||
        p.progress > 100
      )
        return invalid();
      payload = { ...target(), progress: p.progress, note: text(p.note) };
      break;
    }
    case 'add_evidence': {
      const evidence = record(p.evidence);
      if (evidence.kind !== 'link') throw new WorkspaceError('FEATURE_NOT_AVAILABLE', 422);
      const url = text(evidence.url, 4096);
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return invalid();
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
        return invalid();
      payload = { ...target(), evidence: { kind: 'link', name: text(evidence.name, 500), url } };
      break;
    }
    case 'create_change_request': {
      const type = choice(p.type, ['deadline', 'owner', 'scope']);
      payload = {
        taskId: id(p.taskId),
        expectedVersion: version(p.expectedVersion),
        type,
        reason: text(p.reason),
        proposedValue:
          type === 'deadline'
            ? date(p.proposedValue)
            : type === 'owner'
              ? id(p.proposedValue)
              : text(p.proposedValue),
      };
      break;
    }
    case 'decide_change':
      payload = { ...target(), approved: flag(p.approved), reason: text(p.reason) };
      break;
    case 'authorize_resolution':
      payload = { ...target(), reason: text(p.reason) };
      break;
    case 'close_resolution':
      payload = {
        ...target(),
        criteriaConfirmed: flag(p.criteriaConfirmed),
        reason: text(p.reason, 10000, true),
      };
      break;
    case 'add_resolution':
      payload = {
        title: text(p.title, 500),
        content: text(p.content, 30000),
        meetingId: id(p.meetingId),
        agenda: text(p.agenda, 50),
        type: choice(p.type, ['action', 'approval', 'acknowledgment', 'recurring']),
        unit: text(p.unit, 300),
        coordinatorId: id(p.coordinatorId),
        dueDate: date(p.dueDate, true),
        closureCriteria: criteria(p.closureCriteria),
      };
      break;
    case 'add_task':
      payload = {
        resolutionId: id(p.resolutionId),
        title: text(p.title, 500),
        ownerId: id(p.ownerId),
        reviewerId: id(p.reviewerId),
        unit: text(p.unit, 300),
        priority: choice(p.priority, ['high', 'normal', 'low']),
        dueDate: date(p.dueDate),
        required: flag(p.required),
        description: text(p.description),
        deliverable: text(p.deliverable),
        criteria: criteria(p.criteria),
      };
      break;
    case 'add_meeting': {
      const time = text(p.time, 5);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return invalid();
      if (p.agenda !== undefined && (!Array.isArray(p.agenda) || p.agenda.length > 100))
        return invalid();
      const agenda = ((p.agenda ?? []) as unknown[]).map((value) => {
        const item = record(value);
        return { number: text(item.number, 50), title: text(item.title, 1000) };
      });
      if (new Set(agenda.map((item) => item.number)).size !== agenda.length) return invalid();
      payload = {
        title: text(p.title, 500),
        number: text(p.number, 50),
        date: date(p.date),
        time,
        location: text(p.location, 1000),
        committee: text(p.committee, 500),
        status: choice(p.status, ['scheduled', 'completed']),
        agenda,
      };
      break;
    }
    case 'update_settings': {
      const patch = record(p.patch);
      const safe: Record<string, unknown> = {};
      for (const key of ['acknowledgmentDays', 'reviewDays'])
        if (patch[key] !== undefined) {
          if (!Number.isInteger(patch[key]) || Number(patch[key]) < 1 || Number(patch[key]) > 365)
            return invalid();
          safe[key] = patch[key];
        }
      if (patch.emailNotifications !== undefined)
        safe.emailNotifications = flag(patch.emailNotifications);
      if (patch.reminderDays !== undefined) {
        if (
          !Array.isArray(patch.reminderDays) ||
          patch.reminderDays.length > 10 ||
          !patch.reminderDays.every((x) => Number.isInteger(x) && x >= 0 && x <= 365)
        )
          return invalid();
        safe.reminderDays = [...new Set(patch.reminderDays as number[])];
      }
      if (!Object.keys(safe).length) return invalid();
      payload = { patch: safe };
      break;
    }
    case 'mark_notification_read':
      payload = { id: id(p.id) };
      break;
    case 'mark_all_read':
      payload = {};
      break;
    case 'set_member_role': {
      if (!Number.isSafeInteger(p.expectedVersion) || Number(p.expectedVersion) < 0)
        return invalid();
      payload = {
        profileId: id(p.profileId),
        role: choice(p.role, ACCESS_ROLES),
        expectedVersion: p.expectedVersion,
      };
      break;
    }
    case 'set_role_pages': {
      const role = choice(p.role, ['user', 'executive', 'staff']);
      if (
        !isPageList(p.pages) ||
        (role === 'staff' && p.pages.some((page) => !STAFF_PAGE_KEYS.includes(page)))
      )
        return invalid();
      payload = { role, pages: p.pages, expectedVersion: version(p.expectedVersion) };
      break;
    }
    case 'add_personnel': {
      const firstName = text(p.firstName, 100);
      const lastName = text(p.lastName, 100);
      const email = text(p.email, 254).toLowerCase();
      const unit = text(p.unit, 300);
      if (
        [firstName, lastName, unit].some((value) => /[\u0000-\u001f\u007f]/.test(value)) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
        return invalid();
      payload = { firstName, lastName, email, unit, role: choice(p.role, ACCESS_ROLES) };
      break;
    }
    case 'set_pending_personnel_role': {
      payload = {
        invitationId: id(p.invitationId),
        role: choice(p.role, ACCESS_ROLES),
        expectedVersion: version(p.expectedVersion),
      };
      break;
    }
  }
  const parsed = workspaceCommandSchema.safeParse({
    organizationId: id(body.organizationId),
    operation,
    payload,
    idempotencyKey: id(body.idempotencyKey),
  });
  if (!parsed.success) return invalid();
  return parsed.data;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new WorkspaceError('FORBIDDEN', 403);
}

/** No SQL/schema/credential details returned to the browser. */
export function mapDatabaseError(error: { code?: string; message?: string }): WorkspaceError {
  if (error.code === 'PGRST202' || error.code === '42P01' || error.code === '42883')
    return new WorkspaceError('SCHEMA_NOT_READY', 503);
  if (error.code === '23505') {
    const duplicate = error.message?.match(
      /\b(PERSONNEL_ALREADY_EXISTS|MEMBER_ALREADY_EXISTS)\b/,
    )?.[1];
    if (duplicate) return new WorkspaceError(duplicate, 409);
  }
  if (error.code === '23505' || error.code === '40001' || error.code === '40P01')
    return new WorkspaceError('STALE_VERSION', 409);
  if (error.code === '0A000') return new WorkspaceError('FEATURE_NOT_AVAILABLE', 422);
  const code = error.message?.match(
    /\b(UNAUTHENTICATED|FORBIDDEN|NO_MEMBERSHIP|NOT_FOUND|STALE_VERSION|INVALID_TRANSITION|VALIDATION_FAILED|MISSING_EVIDENCE|SELF_REVIEW_NOT_ALLOWED|AUTHORIZATION_REQUIRED|DEPENDENCY_NOT_READY|IDEMPOTENCY_CONFLICT|FEATURE_NOT_AVAILABLE|ACKNOWLEDGMENT_REQUIRED|MISSING_CRITERIA|PENDING_SUBMISSION|CLOSURE_NOT_READY|INVALID_ASSIGNEE|INVALID_REVIEWER|INVALID_UNIT|INVALID_DEADLINE|LAST_ADMIN_REQUIRED|PAGE_ACCESS_DENIED|INACTIVE_MEMBER|PERSONNEL_ALREADY_EXISTS|MEMBER_ALREADY_EXISTS|INVITATION_CLAIMED|EMAIL_VERIFICATION_REQUIRED)\b/,
  )?.[1];
  if (code)
    return new WorkspaceError(
      code,
      code === 'UNAUTHENTICATED'
        ? 401
        : [
              'FORBIDDEN',
              'NO_MEMBERSHIP',
              'PAGE_ACCESS_DENIED',
              'INACTIVE_MEMBER',
              'EMAIL_VERIFICATION_REQUIRED',
            ].includes(code)
          ? 403
          : code === 'NOT_FOUND'
            ? 404
            : [
                  'STALE_VERSION',
                  'IDEMPOTENCY_CONFLICT',
                  'LAST_ADMIN_REQUIRED',
                  'PERSONNEL_ALREADY_EXISTS',
                  'MEMBER_ALREADY_EXISTS',
                  'INVITATION_CLAIMED',
                ].includes(code)
              ? 409
              : 422,
    );
  if (error.code === '42501') return new WorkspaceError('FORBIDDEN', 403);
  if (error.code?.startsWith('22') || error.code?.startsWith('23'))
    return new WorkspaceError('VALIDATION_FAILED', 422);
  return new WorkspaceError('CONNECTION_FAILED', 503);
}
