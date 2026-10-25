import type { WorkspaceState, Task, Resolution, Meeting } from '@/lib/types';
import {
  canAccessPage,
  pageForPath,
  permissionsForAccessRole,
  type AccessControl,
  type PageKey,
} from '@/lib/access-control';

/** Safe presentation values for a parent whose protected details are not visible. */
function resolutionContext(resolution: Resolution): Resolution {
  return {
    id: resolution.id,
    code: resolution.code,
    title: resolution.title,
    status: resolution.status,
    executionAuthorized: resolution.executionAuthorized ?? true,
    partialContext: true,
    content: '',
    agenda: '',
    unit: '',
    closureCriteria: [],
    type: 'action',
    coordinatorId: '',
    createdAt: '',
    meetingId: '',
  };
}
function meetingSelector(meeting: Meeting): Meeting {
  return {
    id: meeting.id,
    title: meeting.title,
    number: meeting.number,
    date: '',
    time: '',
    location: '',
    committee: '',
    status: 'scheduled',
    agenda: [],
  };
}
function taskSummary(task: Task, includeVersion: boolean): Task {
  return {
    id: task.id,
    code: task.code,
    title: task.title,
    resolutionId: task.resolutionId,
    ownerId: task.ownerId,
    unit: task.unit,
    status: task.status,
    progress: task.progress,
    dueDate: task.dueDate,
    originalDueDate: task.originalDueDate,
    acceptedAt: task.acceptedAt,
    submittedAt: task.submittedAt,
    ...(includeVersion ? { rowVersion: task.rowVersion } : {}),
    reviewerId: '',
    priority: 'normal',
    required: false,
    description: '',
    deliverable: '',
    criteria: [],
    evidence: [],
    updates: [],
  };
}

/** Demo-only read projection. Empty fields mirror the connected display adapter;
 * protected records and pending personnel never become actionable by projection.
 */
export function scopedDemoState(raw: WorkspaceState, access: AccessControl): WorkspaceState {
  const staff = access.role === 'staff';
  const allowed = (page: PageKey) => canAccessPage(access, page);
  const summary = allowed('dashboard') || allowed('reports');
  const scopedTasks = staff
    ? raw.tasks.filter((task) => task.ownerId === raw.currentUserId)
    : raw.tasks;
  const tasks =
    allowed('tasks') || allowed('reviews')
      ? scopedTasks
      : summary || allowed('changes')
        ? scopedTasks.map((task) => taskSummary(task, allowed('changes')))
        : [];
  const ownedTaskIds = new Set(scopedTasks.map((task) => task.id));
  const taskIds = new Set(tasks.map((task) => task.id));
  const changes = !allowed('changes')
    ? []
    : staff
      ? raw.changes.filter(
          (change) => change.requestedById === raw.currentUserId && ownedTaskIds.has(change.taskId),
        )
      : raw.changes;
  const changeIds = new Set(changes.map((change) => change.id));
  const notifications = !allowed('notifications')
    ? []
    : raw.notifications.filter((item) => {
        const page = pageForPath(item.href);
        return (
          !!page &&
          allowed(page) &&
          (!staff ||
            Boolean(
              item.targetId && (taskIds.has(item.targetId) || changeIds.has(item.targetId)),
            ) ||
            tasks.some((task) => item.href === `/tasks/${task.id}`))
        );
      });
  const related = new Set(tasks.map((task) => task.resolutionId));
  const resolutions = staff
    ? raw.resolutions.filter((resolution) => related.has(resolution.id)).map(resolutionContext)
    : allowed('resolutions')
      ? raw.resolutions
      : summary
        ? raw.resolutions.map((resolution) => ({
            ...resolutionContext(resolution),
            type: resolution.type,
            coordinatorId: resolution.coordinatorId,
            dueDate: resolution.dueDate,
            createdAt: resolution.createdAt,
            meetingId: resolution.meetingId,
          }))
        : raw.resolutions.filter((resolution) => related.has(resolution.id)).map(resolutionContext);
  const meetings = staff
    ? []
    : allowed('meetings')
      ? raw.meetings
      : summary
        ? raw.meetings.map((meeting) => ({
            ...meetingSelector(meeting),
            date: meeting.date,
            time: meeting.time,
            location: meeting.location,
            committee: meeting.committee,
            status: meeting.status,
          }))
        : permissionsForAccessRole(access.role, access.pages).includes('resolution.draft')
          ? raw.meetings.map(meetingSelector)
          : [];
  return {
    ...raw,
    tasks,
    resolutions,
    meetings,
    changes,
    notifications,
    audit: access.role === 'admin' ? raw.audit : [],
    settings: allowed('settings')
      ? raw.settings
      : { reminderDays: [], acknowledgmentDays: 2, reviewDays: 3, emailNotifications: false },
  };
}
