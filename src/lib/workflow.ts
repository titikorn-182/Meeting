import { DEMO_TODAY, users } from './mock-data';
import type {
  Actor,
  DashboardMetrics,
  DemoState,
  ResolutionStatus,
  Role,
  Task,
  TaskStatus,
  TransitionResult,
} from './types';

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function calendarDate(value: string): string | null {
  if (DATE_ONLY.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
      ? value
      : null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Civil-day comparison avoids host timezone/DST and keeps a date-only deadline open for its whole Thai day. */
export function daysUntil(date?: string, today = DEMO_TODAY): number | null {
  if (!date) return null;
  const target = calendarDate(date);
  const base = calendarDate(today);
  if (!target || !base) return null;
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / DAY_MS);
}

export function formatThaiDate(date?: string, options: Intl.DateTimeFormatOptions = {}): string {
  if (!date || !calendarDate(date)) return '—';
  const parsed = new Date(DATE_ONLY.test(date) ? `${date}T12:00:00+07:00` : date);
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(parsed);
}

export function isOverdue(task: Task, today = DEMO_TODAY): boolean {
  if (task.status === 'accepted' || task.status === 'cancelled') return false;
  const remaining = daysUntil(task.dueDate, today);
  return remaining !== null && remaining < 0;
}

/** Self-reported progress is presentation only; it never certifies acceptance or closes a resolution. */
export function getResolutionProgress(resolutionId: string, tasks: Task[]): number {
  const included = tasks.filter(
    (task) => task.resolutionId === resolutionId && task.status !== 'cancelled',
  );
  if (!included.length) return 0;
  return Math.round(
    included.reduce(
      (sum, task) =>
        sum + (task.status === 'accepted' ? 100 : Math.max(0, Math.min(100, task.progress))),
      0,
    ) / included.length,
  );
}

/** Task/checklist readiness only. Caller must separately check authority and prohibit closing a recurring parent. */
export function canCloseResolution(
  resolutionId: string,
  tasks: Task[],
  criteriaConfirmed = true,
): boolean {
  const required = tasks.filter((task) => task.resolutionId === resolutionId && task.required);
  return (
    criteriaConfirmed && required.length > 0 && required.every((task) => task.status === 'accepted')
  );
}

/** Ready for a separate closure review; never certifies the resolution-level checklist or closes the parent. */
export function reconcileResolutionStatus(state: DemoState, resolutionId: string): DemoState {
  const resolution = state.resolutions.find((item) => item.id === resolutionId);
  if (
    !resolution ||
    !['action', 'approval'].includes(resolution.type) ||
    !['open', 'pending_close'].includes(resolution.status)
  )
    return state;
  const taskIds = new Set(
    state.tasks.filter((task) => task.resolutionId === resolutionId).map((task) => task.id),
  );
  const pendingChange = state.changes.some(
    (change) => change.status === 'pending' && taskIds.has(change.taskId),
  );
  const status: ResolutionStatus =
    canCloseResolution(resolutionId, state.tasks) && !pendingChange ? 'pending_close' : 'open';
  if (status === resolution.status) return state;
  return {
    ...state,
    resolutions: state.resolutions.map((item) =>
      item.id === resolutionId ? { ...item, status } : item,
    ),
  };
}

/** Local display sequence, including legacy demo formats. Real multi-user numbering belongs on the server. */
export function nextDisplayCode(
  kind: 'resolution' | 'task' | 'change',
  existingCodes: string[],
  year = '2569',
): string {
  const patterns =
    kind === 'resolution'
      ? [new RegExp(`^มติ ${year}/(\\d+)$`), new RegExp(`^มติ (\\d+)/${year}$`)]
      : kind === 'task'
        ? [/^งาน-(\d+)$/, /^T-(\d+)$/]
        : [new RegExp(`^CR-${year}-(\\d+)$`), new RegExp(`^CR-(\\d+)/${year}$`)];
  const max = existingCodes.reduce((largest, code) => {
    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) return Math.max(largest, Number(match[1]));
    }
    return largest;
  }, 0);
  const serial = String(max + 1).padStart(3, '0');
  return kind === 'resolution'
    ? `มติ ${year}/${serial}`
    : kind === 'task'
      ? `งาน-${serial}`
      : `CR-${year}-${serial}`;
}

/** Operational demo counts, not the PRD's full historical KPI engine or business-day SLA implementation. */
export function getDashboardMetrics(state: DemoState, today = DEMO_TODAY): DashboardMetrics {
  const completedTasks = state.tasks.filter((task) => task.status === 'accepted').length;
  return {
    totalResolutions: state.resolutions.length,
    activeResolutions: state.resolutions.filter(
      (resolution) => resolution.status === 'open' || resolution.status === 'pending_close',
    ).length,
    closedResolutions: state.resolutions.filter((resolution) => resolution.status === 'closed')
      .length,
    totalTasks: state.tasks.length,
    activeTasks: state.tasks.filter(
      (task) => task.status !== 'accepted' && task.status !== 'cancelled',
    ).length,
    overdueTasks: state.tasks.filter((task) => isOverdue(task, today)).length,
    pendingReviewTasks: state.tasks.filter((task) => task.status === 'submitted').length,
    completedTasks,
    dueSoonTasks: state.tasks.filter((task) => {
      const days = daysUntil(task.dueDate, today);
      return (
        task.status !== 'accepted' &&
        task.status !== 'cancelled' &&
        days !== null &&
        days >= 0 &&
        days <= 7
      );
    }).length,
    pendingChanges: state.changes.filter((change) => change.status === 'pending').length,
    // Cancelled tasks stay in this gross base and never become successes.
    completionRate: state.tasks.length
      ? Math.round((completedTasks / state.tasks.length) * 100)
      : 0,
  };
}

export function createId(prefix = 'item'): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function getRoleUserId(role: Role): string {
  const user = users.find((item) => item.role === role);
  if (!user) throw new Error('ไม่พบผู้ใช้ตัวอย่างสำหรับบทบาทนี้');
  return user.id;
}

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['submitted', 'cancelled'],
  submitted: ['accepted', 'revision', 'cancelled'],
  revision: ['submitted', 'cancelled'],
  accepted: [],
  cancelled: [],
};

export function validateTaskTransition(
  task: Task,
  desiredStatus: TaskStatus,
  actor: Actor,
): TransitionResult {
  const deny = (reason: string): TransitionResult => ({ allowed: false, reason });
  if (!allowedTransitions[task.status].includes(desiredStatus)) {
    return deny(
      task.status === 'accepted' || task.status === 'cancelled'
        ? 'งานรอบนี้สิ้นสุดแล้ว การเปิดใหม่ต้องสร้างรอบดำเนินการใหม่'
        : 'ไม่สามารถข้ามขั้นตอนจากสถานะปัจจุบันได้',
    );
  }
  if (desiredStatus === 'cancelled') {
    return actor.role === 'secretary' || actor.role === 'executive'
      ? { allowed: true }
      : deny('การยุติงานต้องผ่านผู้มีอำนาจพิจารณาคำขอ');
  }
  if (desiredStatus === 'accepted' || desiredStatus === 'revision') {
    if (actor.userId === task.ownerId) return deny('ไม่สามารถตรวจรับหรือส่งกลับผลงานของตนเองได้');
    if (!['reviewer', 'executive'].includes(actor.role) || actor.userId !== task.reviewerId)
      return deny('เฉพาะผู้ตรวจที่ได้รับมอบหมายจึงพิจารณาผลงานนี้ได้');
    if (desiredStatus === 'accepted' && task.evidence.length === 0)
      return deny('ต้องมีหลักฐานประกอบก่อนตรวจรับผลงาน');
    return { allowed: true };
  }
  if (actor.role !== 'owner' || actor.userId !== task.ownerId)
    return deny('เฉพาะผู้รับผิดชอบหลักจึงดำเนินการขั้นตอนนี้ได้');
  if (!task.acknowledgedAt) return deny('โปรดรับทราบการมอบหมายก่อนเริ่มดำเนินการ');
  if (desiredStatus === 'submitted') {
    if (!task.deliverable.trim() || task.criteria.length === 0)
      return deny('ต้องกำหนดผลส่งมอบและเกณฑ์ตรวจรับให้ครบ');
    if (task.evidence.length === 0) return deny('กรุณาแนบหลักฐานก่อนส่งตรวจ');
  }
  return { allowed: true };
}

/** Immutable approval. It deliberately never overwrites the original due-date baseline. */
export function approveDeadlineChange(
  state: DemoState,
  changeId: string,
  actor: Actor,
  now = `${DEMO_TODAY}T10:00:00+07:00`,
): DemoState {
  if (actor.role !== 'executive' && actor.role !== 'secretary')
    throw new Error('บทบาทนี้ไม่มีสิทธิอนุมัติการเปลี่ยนกำหนด');
  const change = state.changes.find((item) => item.id === changeId);
  if (!change || change.type !== 'deadline' || change.status !== 'pending')
    throw new Error('คำขอขยายกำหนดไม่อยู่ระหว่างรอพิจารณา');
  if (change.requestedById === actor.userId) throw new Error('ไม่สามารถอนุมัติคำขอของตนเองได้');
  const task = state.tasks.find((item) => item.id === change.taskId);
  if (!task || task.status === 'accepted' || task.status === 'cancelled')
    throw new Error('ไม่สามารถเปลี่ยนกำหนดของงานที่สิ้นสุดแล้ว');
  if (task.dueDate !== change.originalValue)
    throw new Error('กำหนดปัจจุบันเปลี่ยนไปแล้ว โปรดทบทวนคำขออีกครั้ง');
  const extension = daysUntil(change.proposedValue, task.dueDate);
  if (!DATE_ONLY.test(change.proposedValue) || extension === null || extension <= 0)
    throw new Error('กำหนดใหม่ต้องเป็นวันที่ถูกต้องและอยู่หลังกำหนดปัจจุบัน');
  if (!Number.isFinite(new Date(now).getTime())) throw new Error('เวลาพิจารณาไม่ถูกต้อง');
  return {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === task.id ? { ...item, dueDate: change.proposedValue } : item,
    ),
    changes: state.changes.map((item) =>
      item.id === change.id
        ? { ...item, status: 'approved' as const, decidedById: actor.userId, decidedAt: now }
        : item,
    ),
    audit: [
      {
        id: `audit-${change.id}-approved`,
        action: 'อนุมัติขยายกำหนด',
        actorId: actor.userId,
        createdAt: now,
        targetId: task.id,
        targetLabel: task.title,
        detail: `กำหนดปัจจุบัน ${change.originalValue} → ${change.proposedValue}; คงกำหนดเดิม ${task.originalDueDate}`,
      },
      ...state.audit,
    ],
    notifications: [
      {
        id: `notification-${change.id}-approved`,
        title: 'คำขอขยายกำหนดได้รับอนุมัติ',
        description: `${task.title}: กำหนดใหม่ ${formatThaiDate(change.proposedValue)}`,
        createdAt: now,
        read: false,
        type: 'change' as const,
        href: '/changes',
        targetId: change.id,
      },
      ...state.notifications,
    ],
  };
}
