import { z } from 'zod';
import { isAccessControl } from './access-control';
import type { AccessControl } from './access-control';
import type { DemoState, User } from './types';

const text = z.string();
const identifier = text.min(1);
const strings = z.array(text);
const version = z.number().int().positive();
const role = z.enum(['secretary', 'owner', 'reviewer', 'executive']);
const accessRole = z.enum(['admin', 'user', 'executive', 'staff']);
const progress = z.number().min(0).max(100);
const taskStatus = z.enum([
  'assigned',
  'in_progress',
  'submitted',
  'revision',
  'accepted',
  'cancelled',
]);
const resolutionStatus = z.enum(['open', 'pending_close', 'closed', 'acknowledged']);
const resolutionType = z.enum(['action', 'approval', 'acknowledgment', 'recurring']);
const userSchema = z.object({
  id: identifier,
  name: text,
  initials: text,
  role,
  unit: text,
  avatarColor: text,
  accessRole: accessRole.optional(),
  roles: z.array(role).optional(),
  firstName: text.optional(),
  lastName: text.optional(),
  email: text.optional(),
  membershipStatus: z.enum(['active', 'pending']).optional(),
}) satisfies z.ZodType<User>;
const taskSummary = z.object({
  id: identifier,
  code: text,
  title: text,
  resolutionId: identifier,
  ownerId: identifier,
  unit: text,
  status: taskStatus,
  progress,
  originalDueDate: text,
  dueDate: text,
  acceptedAt: text.optional(),
  submittedAt: text.optional(),
  rowVersion: version.optional(),
});
const taskSchema = taskSummary.extend({
  stableId: identifier.optional(),
  reviewerId: identifier,
  priority: z.enum(['high', 'normal', 'low']),
  required: z.boolean(),
  description: text,
  deliverable: text,
  criteria: strings,
  evidence: z.array(
    z.object({
      id: identifier,
      name: text,
      size: text,
      kind: z.enum(['file', 'link']),
      url: text.optional(),
      uploadedAt: text,
    }),
  ),
  updates: z.array(
    z.object({ id: identifier, note: text, progress, createdAt: text, authorId: identifier }),
  ),
  acknowledgedAt: text.optional(),
});
const resolutionContext = z.object({
  id: identifier,
  code: text,
  title: text,
  status: resolutionStatus,
  executionAuthorized: z.boolean(),
  partialContext: z.literal(true),
});
const resolutionSummary = resolutionContext.extend({
  type: resolutionType,
  coordinatorId: identifier,
  createdAt: text,
  meetingId: identifier,
  dueDate: text.optional(),
});
const resolutionSchema = resolutionSummary.extend({
  stableId: identifier.optional(),
  rowVersion: version.optional(),
  content: text,
  agenda: text,
  unit: text,
  closureCriteria: strings,
  partialContext: z.boolean().optional(),
  executionAuthorized: z.boolean().optional(),
});
const meetingSelector = z.object({ id: identifier, title: text, number: text });
const meetingSummary = meetingSelector.extend({
  date: text,
  time: text,
  location: text,
  status: z.enum(['scheduled', 'completed']),
  committee: text,
});
const meetingSchema = meetingSummary.extend({
  agenda: z.array(z.object({ id: identifier, number: text, title: text, resolutionIds: strings })),
});
const settingsSchema = z.object({
  reminderDays: z.array(z.number().int().min(0).max(365)),
  acknowledgmentDays: z.number().int().min(1).max(365),
  reviewDays: z.number().int().min(1).max(365),
  emailNotifications: z.boolean(),
});
const sharedState = z.object({
  activeRole: role,
  currentUserId: identifier,
  changes: z.array(
    z.object({
      id: identifier,
      rowVersion: version.optional(),
      code: text,
      taskId: identifier,
      type: z.enum(['deadline', 'owner', 'scope']),
      status: z.enum(['pending', 'approved', 'rejected']),
      requestedById: identifier,
      reason: text,
      createdAt: text,
      originalValue: text,
      proposedValue: text,
      decidedAt: text.optional(),
      decidedById: text.optional(),
      decisionReason: text.optional(),
    }),
  ),
  notifications: z.array(
    z.object({
      id: identifier,
      title: text,
      description: text,
      createdAt: text,
      read: z.boolean(),
      type: z.enum(['assignment', 'deadline', 'review', 'change', 'system']),
      href: text,
      targetId: identifier.optional(),
    }),
  ),
  audit: z.array(
    z.object({
      id: identifier,
      action: text,
      actorId: identifier,
      createdAt: text,
      targetId: text,
      targetLabel: text,
      detail: text,
    }),
  ),
});
const stateSchema = sharedState.extend({
  tasks: z.array(taskSchema),
  resolutions: z.array(resolutionSchema),
  meetings: z.array(meetingSchema),
  settings: settingsSchema,
}) satisfies z.ZodType<DemoState>;
const headerSchema = z.object({
  users: z.array(userSchema),
  eligibleOwners: z.array(z.object({ id: identifier, name: text, unit: text })),
  units: strings,
  organization: z.object({ id: identifier, name: text }),
  permissions: strings,
  roles: z.array(role),
  access: z.custom<AccessControl>(isAccessControl),
  features: z.object({ personnelManagement: z.boolean() }).optional(),
});
export const workspaceSnapshotSchema = headerSchema
  .extend({ state: stateSchema })
  .refine(
    (row) =>
      row.users.some((user) => user.id === row.state.currentUserId) &&
      row.access.members[row.state.currentUserId]?.role === row.access.role,
  );
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;

/** SQL deliberately omits protected fields. Validate that projection before adapting
 * it to the existing screen model. Empty presentation values never grant access.
 * Full-detail pages must pass the full schema; malformed detail cannot fall back.
 */
export function decodeWorkspaceSnapshot(value: unknown): WorkspaceSnapshot | null {
  const header = headerSchema.safeParse(value);
  if (!header.success) return null;
  const { access } = header.data;
  const pages = access.pages;
  const summary = pages.some((page) => ['dashboard', 'reports'].includes(page));
  const fullTasks = pages.includes('tasks') || pages.includes('reviews');
  const fullResolutions = access.role !== 'staff' && pages.includes('resolutions');
  const fullMeetings = access.role !== 'staff' && pages.includes('meetings');
  const wireSchema = headerSchema.extend({
    state: sharedState.extend({
      tasks: z.array(fullTasks ? taskSchema : taskSummary),
      resolutions: z.array(
        fullResolutions
          ? resolutionSchema
          : access.role !== 'staff' && summary
            ? resolutionSummary
            : resolutionContext,
      ),
      meetings: z.array(fullMeetings ? meetingSchema : summary ? meetingSummary : meetingSelector),
      settings:
        access.role !== 'staff' && pages.includes('settings')
          ? settingsSchema
          : z.object({}).strict(),
    }),
  });
  const wire = wireSchema.safeParse(value);
  if (!wire.success) return null;
  const row = wire.data;
  const normalized = {
    ...row,
    state: {
      ...row.state,
      tasks: row.state.tasks.map((task) =>
        fullTasks
          ? task
          : {
              reviewerId: '',
              priority: 'normal',
              required: false,
              description: '',
              deliverable: '',
              criteria: [],
              evidence: [],
              updates: [],
              ...task,
            },
      ),
      resolutions: row.state.resolutions.map((resolution) =>
        fullResolutions
          ? resolution
          : {
              content: '',
              agenda: '',
              unit: '',
              closureCriteria: [],
              type: 'action',
              coordinatorId: '',
              createdAt: '',
              meetingId: '',
              ...resolution,
            },
      ),
      meetings: row.state.meetings.map((meeting) =>
        fullMeetings
          ? meeting
          : {
              date: '',
              time: '',
              location: '',
              status: 'scheduled',
              committee: '',
              agenda: [],
              ...meeting,
            },
      ),
      settings:
        access.role !== 'staff' && pages.includes('settings')
          ? row.state.settings
          : { reminderDays: [], acknowledgmentDays: 2, reviewDays: 3, emailNotifications: false },
    },
  };
  // Empty IDs only occur in the adapter's explicitly redacted presentation fields.
  const result = normalizedSnapshotSchema.safeParse(normalized);
  return result.success ? result.data : null;
}
const normalizedSnapshotSchema = headerSchema
  .extend({
    state: sharedState.extend({
      tasks: z.array(taskSchema.extend({ reviewerId: text })),
      resolutions: z.array(resolutionSchema.extend({ coordinatorId: text, meetingId: text })),
      meetings: z.array(meetingSchema),
      settings: settingsSchema,
    }),
  })
  .refine(
    (row) =>
      row.users.some((user) => user.id === row.state.currentUserId) &&
      row.access.members[row.state.currentUserId]?.role === row.access.role,
  );

export function isNormalizedWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  return normalizedSnapshotSchema.safeParse(value).success;
}
