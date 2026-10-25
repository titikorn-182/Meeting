import { z } from 'zod';
import { ACCESS_ROLES, isPageList, STAFF_PAGE_KEYS } from './access-control';

const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const version = z.number().int().positive();
const target = z.object({ id, expectedVersion: version });
const text = z.string();
const strings = z.array(text);
const reason = target.extend({ reason: text });
const settings = z.object({
  acknowledgmentDays: z.number().int().min(1).max(365).optional(),
  reviewDays: z.number().int().min(1).max(365).optional(),
  reminderDays: z.array(z.number().int().min(0).max(365)).optional(),
  emailNotifications: z.boolean().optional(),
});
export const commandPayloadSchemas = {
  acknowledge_task: target,
  transition_task: target.extend({
    status: z
      .enum(['assigned', 'in_progress', 'submitted', 'revision', 'accepted', 'cancelled'])
      .refine((status) => ['in_progress', 'submitted', 'revision', 'accepted'].includes(status)),
    note: text.optional(),
    criterionResults: z.array(z.boolean()).optional(),
  }),
  update_progress: target.extend({ progress: z.number().min(0).max(100), note: text }),
  add_evidence: target.extend({
    evidence: z.object({
      kind: z.enum(['file', 'link']).refine((kind) => kind === 'link'),
      name: text,
      url: text.optional(),
    }),
  }),
  create_change_request: z.object({
    taskId: id,
    expectedVersion: version,
    type: z.enum(['deadline', 'owner', 'scope']),
    reason: text,
    proposedValue: text,
  }),
  decide_change: reason.extend({ approved: z.boolean() }),
  authorize_resolution: reason,
  close_resolution: reason.extend({ criteriaConfirmed: z.boolean() }),
  add_resolution: z.object({
    title: text,
    content: text,
    meetingId: id,
    agenda: text,
    type: z.enum(['action', 'approval', 'acknowledgment', 'recurring']),
    unit: text,
    coordinatorId: id,
    dueDate: text.optional(),
    closureCriteria: strings,
  }),
  add_task: z.object({
    resolutionId: id,
    title: text,
    ownerId: id,
    reviewerId: id,
    unit: text,
    priority: z.enum(['high', 'normal', 'low']),
    dueDate: text,
    required: z.boolean(),
    description: text,
    deliverable: text,
    criteria: strings,
  }),
  add_meeting: z.object({
    title: text,
    number: text,
    date: text,
    time: text,
    location: text,
    committee: text,
    status: z.enum(['scheduled', 'completed']),
    agenda: z.array(z.object({ number: text, title: text })).optional(),
  }),
  update_settings: z.object({ patch: settings }),
  mark_notification_read: z.object({ id }),
  mark_all_read: z.object({}),
  set_member_role: z.object({
    profileId: id,
    role: z.enum(ACCESS_ROLES),
    expectedVersion: z.number().int().nonnegative(),
  }),
  set_role_pages: z
    .object({
      role: z.enum(['admin', 'user', 'executive', 'staff']).refine((role) => role !== 'admin'),
      pages: z
        .array(
          z.enum([
            'dashboard',
            'meetings',
            'resolutions',
            'tasks',
            'reviews',
            'changes',
            'reports',
            'team',
            'settings',
            'notifications',
          ]),
        )
        .refine(isPageList),
      expectedVersion: version,
    })
    .refine((p) => p.role !== 'staff' || p.pages.every((page) => STAFF_PAGE_KEYS.includes(page))),
  add_personnel: z.object({
    firstName: text,
    lastName: text,
    email: text,
    unit: text,
    role: z.enum(ACCESS_ROLES),
  }),
  set_pending_personnel_role: z.object({
    invitationId: id,
    role: z.enum(ACCESS_ROLES),
    expectedVersion: version,
  }),
};
export type WorkspaceOperation = keyof typeof commandPayloadSchemas;
export type CommandPayloads = {
  [K in WorkspaceOperation]: z.input<(typeof commandPayloadSchemas)[K]>;
};
function envelope<K extends WorkspaceOperation, S extends z.ZodType>(operation: K, payload: S) {
  return z.object({
    organizationId: id,
    idempotencyKey: id,
    operation: z.literal(operation),
    payload,
  });
}
export const workspaceCommandSchema = z.discriminatedUnion('operation', [
  envelope('acknowledge_task', commandPayloadSchemas.acknowledge_task),
  envelope('transition_task', commandPayloadSchemas.transition_task),
  envelope('update_progress', commandPayloadSchemas.update_progress),
  envelope('add_evidence', commandPayloadSchemas.add_evidence),
  envelope('create_change_request', commandPayloadSchemas.create_change_request),
  envelope('decide_change', commandPayloadSchemas.decide_change),
  envelope('authorize_resolution', commandPayloadSchemas.authorize_resolution),
  envelope('close_resolution', commandPayloadSchemas.close_resolution),
  envelope('add_resolution', commandPayloadSchemas.add_resolution),
  envelope('add_task', commandPayloadSchemas.add_task),
  envelope('add_meeting', commandPayloadSchemas.add_meeting),
  envelope('update_settings', commandPayloadSchemas.update_settings),
  envelope('mark_notification_read', commandPayloadSchemas.mark_notification_read),
  envelope('mark_all_read', commandPayloadSchemas.mark_all_read),
  envelope('set_member_role', commandPayloadSchemas.set_member_role),
  envelope('set_role_pages', commandPayloadSchemas.set_role_pages),
  envelope('add_personnel', commandPayloadSchemas.add_personnel),
  envelope('set_pending_personnel_role', commandPayloadSchemas.set_pending_personnel_role),
]);
export type WorkspaceCommand = z.infer<typeof workspaceCommandSchema>;
const identified = z.object({ id });
const versioned = identified.extend({ version });
/** RPC return shapes from migrations 004–006; empty results are valid only for mark-all. */
export const commandResultSchemas = {
  acknowledge_task: identified,
  transition_task: identified,
  update_progress: identified,
  add_evidence: identified,
  create_change_request: identified,
  decide_change: identified,
  authorize_resolution: identified,
  close_resolution: identified,
  add_resolution: identified,
  add_task: identified,
  add_meeting: identified,
  update_settings: identified,
  mark_notification_read: identified,
  mark_all_read: z.object({}).strict(),
  set_member_role: versioned,
  set_pending_personnel_role: versioned,
  set_role_pages: z.object({ policyVersion: version }),
  add_personnel: identified.extend({ status: z.literal('pending') }),
};
export type CommandResults = {
  [K in WorkspaceOperation]: z.output<(typeof commandResultSchemas)[K]>;
};
export type CommandResult = CommandResults[WorkspaceOperation];
function decodeWithSchema<S extends z.ZodType>(schema: S, value: unknown): z.output<S> | null {
  const parsed = z.safeParse(schema, value);
  return parsed.success ? parsed.data : null;
}
export function decodeCommandResult<K extends WorkspaceOperation>(
  operation: K,
  value: unknown,
): CommandResults[K] | null {
  // The same operation selects both the runtime schema and its mapped output type.
  // TypeScript loses this correlation when indexing heterogeneous schema objects.
  return decodeWithSchema(commandResultSchemas[operation], value) as CommandResults[K] | null;
}
export const errorResponseSchema = z.object({ error: z.object({ code: z.string().min(1) }) });
