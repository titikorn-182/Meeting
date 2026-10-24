/** Screen DTOs shared by the demo and Supabase adapters. Database authorization is authoritative. */
import type { AccessRole } from './access-control';
export type Role = 'secretary' | 'owner' | 'reviewer' | 'executive';
export type TaskStatus = 'assigned' | 'in_progress' | 'submitted' | 'revision' | 'accepted' | 'cancelled';
export type ResolutionStatus = 'open' | 'pending_close' | 'closed' | 'acknowledged';
export type Priority = 'high' | 'normal' | 'low';

export interface User {
  id: string;
  accessRole?: AccessRole;
  roles?: Role[];
  name: string;
  initials: string;
  role: Role;
  unit: string;
  avatarColor: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  membershipStatus?: 'active' | 'pending';
}

export interface PersonnelInput {
  firstName: string;
  lastName: string;
  email: string;
  unit: string;
  role: AccessRole;
}

export interface Evidence {
  id: string;
  name: string;
  size: string;
  kind: 'file' | 'link';
  url?: string;
  uploadedAt: string;
}

export interface ProgressUpdate {
  id: string;
  note: string;
  progress: number;
  createdAt: string;
  authorId: string;
}

export interface Task {
  id: string;
  /** Connected id is task_cycle_id; stableId is the permanent tasks.id. */
  stableId?: string;
  rowVersion?: number;
  code: string;
  resolutionId: string;
  title: string;
  ownerId: string;
  reviewerId: string;
  unit: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  originalDueDate: string;
  dueDate: string;
  required: boolean;
  description: string;
  deliverable: string;
  criteria: string[];
  evidence: Evidence[];
  updates: ProgressUpdate[];
  submittedAt?: string;
  acceptedAt?: string;
  acknowledgedAt?: string;
}

export interface Resolution {
  id: string;
  /** Connected id is resolution_cycle_id; stableId is resolutions.id. */
  stableId?: string;
  rowVersion?: number;
  executionAuthorized?: boolean;
  partialContext?: boolean;
  code: string;
  title: string;
  content: string;
  meetingId: string;
  agenda: string;
  type: 'action' | 'approval' | 'acknowledgment' | 'recurring';
  unit: string;
  coordinatorId: string;
  status: ResolutionStatus;
  createdAt: string;
  dueDate?: string;
  closureCriteria: string[];
}

export interface Meeting {
  id: string;
  title: string;
  number: string;
  date: string;
  time: string;
  location: string;
  status: 'scheduled' | 'completed';
  committee: string;
  agenda: { id: string; number: string; title: string; resolutionIds: string[] }[];
}

export interface ChangeRequest {
  id: string;
  rowVersion?: number;
  code: string;
  taskId: string;
  type: 'deadline' | 'owner' | 'scope';
  status: 'pending' | 'approved' | 'rejected';
  requestedById: string;
  reason: string;
  createdAt: string;
  originalValue: string;
  proposedValue: string;
  decidedAt?: string;
  decidedById?: string;
  decisionReason?: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  type: 'assignment' | 'deadline' | 'review' | 'change' | 'system';
  href: string;
  targetId?: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
  targetId: string;
  targetLabel: string;
  detail: string;
}

export interface DemoSettings {
  reminderDays: number[];
  acknowledgmentDays: number;
  reviewDays: number;
  emailNotifications: boolean;
}

export interface DemoState {
  resolutions: Resolution[];
  tasks: Task[];
  meetings: Meeting[];
  changes: ChangeRequest[];
  notifications: Notification[];
  audit: AuditEvent[];
  settings: DemoSettings;
  activeRole: Role;
  currentUserId: string;
}

export interface Actor { role: Role; userId: string }
export interface TransitionResult { allowed: boolean; reason?: string }

export interface DashboardMetrics {
  totalResolutions: number;
  activeResolutions: number;
  closedResolutions: number;
  totalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  pendingReviewTasks: number;
  completedTasks: number;
  dueSoonTasks: number;
  pendingChanges: number;
  completionRate: number;
}
