import type { Resolution, Task, TaskStatus } from './types';
import { daysUntil, isOverdue } from './workflow';

export interface TaskCounts {
  readonly total: number;
  readonly active: number;
  readonly accepted: number;
  readonly waiting: number;
  readonly overdue: number;
}
export interface ResolutionTaskGroup extends TaskCounts {
  readonly tasks: readonly Task[];
  readonly progress: number;
}
export interface TaskIndex {
  readonly byResolution: ReadonlyMap<string, ResolutionTaskGroup>;
  readonly byOwner: ReadonlyMap<string, TaskCounts>;
  readonly byParticipant: ReadonlyMap<string, readonly Task[]>;
  readonly statusCounts: Readonly<Record<TaskStatus, number>>;
}
const newCounts = () => ({ total: 0, active: 0, accepted: 0, waiting: 0, overdue: 0 });
export const EMPTY_TASK_COUNTS: TaskCounts = newCounts();
export const EMPTY_RESOLUTION_TASKS: ResolutionTaskGroup = {
  ...newCounts(),
  tasks: [],
  progress: 0,
};
function countTask(counts: ReturnType<typeof newCounts>, task: Task, late: boolean) {
  ++counts.total;
  if (task.status !== 'accepted' && task.status !== 'cancelled') ++counts.active;
  if (task.status === 'accepted') ++counts.accepted;
  if (task.status === 'submitted') ++counts.waiting;
  if (late) ++counts.overdue;
}

/** Derived only from the caller's authorized snapshot. No module cache or fetching. */
export function buildTaskIndex(tasks: readonly Task[], today: string): TaskIndex {
  const byResolution = new Map<
    string,
    ReturnType<typeof newCounts> & {
      tasks: Task[];
      progress: number;
      progressTotal: number;
      progressCount: number;
    }
  >();
  const byOwner = new Map<string, ReturnType<typeof newCounts>>();
  const byParticipant = new Map<string, Task[]>();
  const statusCounts: Record<TaskStatus, number> = {
    assigned: 0,
    in_progress: 0,
    submitted: 0,
    revision: 0,
    accepted: 0,
    cancelled: 0,
  };
  for (const task of tasks) {
    const late = isOverdue(task, today);
    ++statusCounts[task.status];
    let group = byResolution.get(task.resolutionId);
    if (!group) {
      group = { ...newCounts(), tasks: [], progress: 0, progressTotal: 0, progressCount: 0 };
      byResolution.set(task.resolutionId, group);
    }
    group.tasks.push(task);
    countTask(group, task, late);
    if (task.status !== 'cancelled') {
      group.progressTotal +=
        task.status === 'accepted' ? 100 : Math.max(0, Math.min(100, task.progress));
      ++group.progressCount;
    }
    let owner = byOwner.get(task.ownerId);
    if (!owner) {
      owner = newCounts();
      byOwner.set(task.ownerId, owner);
    }
    countTask(owner, task, late);
    for (const id of new Set([task.ownerId, task.reviewerId])) {
      if (!id) continue;
      const related = byParticipant.get(id);
      if (related) related.push(task);
      else byParticipant.set(id, [task]);
    }
  }
  for (const group of byResolution.values())
    group.progress = group.progressCount
      ? Math.round(group.progressTotal / group.progressCount)
      : 0;
  return { byResolution, byOwner, byParticipant, statusCounts };
}

export interface ReportFilters {
  unit: string;
  meetingId: string;
  today: string;
}
export interface UnitReportRow extends TaskCounts {
  readonly name: string;
}
export interface ReportModel {
  readonly tasks: readonly Task[];
  readonly accepted: readonly Task[];
  readonly overdue: readonly Task[];
  readonly waiting: readonly Task[];
  readonly dueCohort: readonly Task[];
  readonly onTime: readonly Task[];
  readonly unitRows: readonly UnitReportRow[];
  readonly resolutionsById: ReadonlyMap<string, Resolution>;
}

/** Shared by the screen and export so filters and report denominators cannot drift. */
export function selectReportModel(
  source: { tasks: readonly Task[]; resolutions: readonly Resolution[] },
  filters: ReportFilters,
): ReportModel {
  const resolutionsById = new Map(
    source.resolutions.map((resolution) => [resolution.id, resolution]),
  );
  const tasks: Task[] = [],
    accepted: Task[] = [],
    overdue: Task[] = [],
    waiting: Task[] = [],
    dueCohort: Task[] = [],
    onTime: Task[] = [];
  const units = new Map<string, ReturnType<typeof newCounts> & { name: string }>();
  for (const task of source.tasks) {
    if (filters.unit !== 'all' && task.unit !== filters.unit) continue;
    if (
      filters.meetingId !== 'all' &&
      resolutionsById.get(task.resolutionId)?.meetingId !== filters.meetingId
    )
      continue;
    tasks.push(task);
    const late = isOverdue(task, filters.today);
    if (task.status === 'accepted') accepted.push(task);
    if (task.status === 'submitted') waiting.push(task);
    if (late) overdue.push(task);
    if ((daysUntil(task.originalDueDate, filters.today) ?? 1) < 0) {
      dueCohort.push(task);
      if (
        task.status === 'accepted' &&
        task.acceptedAt &&
        (daysUntil(task.originalDueDate, task.acceptedAt) ?? -1) >= 0
      )
        onTime.push(task);
    }
    let unit = units.get(task.unit);
    if (!unit) {
      unit = { name: task.unit, ...newCounts() };
      units.set(task.unit, unit);
    }
    countTask(unit, task, late);
  }
  return {
    tasks,
    accepted,
    overdue,
    waiting,
    dueCohort,
    onTime,
    unitRows: [...units.values()],
    resolutionsById,
  };
}
