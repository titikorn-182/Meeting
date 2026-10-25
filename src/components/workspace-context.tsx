'use client';

import { createContext, useContext } from 'react';
import type { AccessControl, AccessRole, PageKey } from '@/lib/access-control';
import type {
  ChangeRequest,
  DemoSettings,
  DemoState,
  Evidence,
  Meeting,
  PersonnelInput,
  Resolution,
  Role,
  Task,
  TaskStatus,
  User,
} from '@/lib/types';

export type ToastTone = 'success' | 'error' | 'info';
export interface WorkspaceContextValue {
  state: DemoState;
  user: User;
  users: User[];
  units: string[];
  eligibleOwners: Array<Pick<User, 'id' | 'name' | 'unit'>>;
  ready: boolean;
  busy: boolean;
  mode: 'demo' | 'supabase';
  permissions: string[];
  today: string;
  organization?: { id: string; name: string };
  access: AccessControl;
  supportsPersonnel: boolean;
  addPersonnel: (input: PersonnelInput) => Promise<string | null>;
  setPendingPersonnelRole: (
    invitationId: string,
    role: AccessRole,
    expectedVersion: number,
  ) => Promise<boolean>;
  setAccessRole: (role: AccessRole) => void;
  setMemberRole: (profileId: string, role: AccessRole, expectedVersion: number) => Promise<boolean>;
  setRolePages: (role: AccessRole, pages: PageKey[], expectedVersion: number) => Promise<boolean>;
  setRole: (role: Role) => void;
  notify: (message: string, type?: ToastTone) => void;
  acknowledgeTask: (id: string) => Promise<boolean>;
  transitionTask: (
    id: string,
    status: TaskStatus,
    note?: string,
    criterionResults?: boolean[],
  ) => Promise<boolean>;
  updateProgress: (id: string, progress: number, note: string) => Promise<boolean>;
  addEvidence: (id: string, evidence: Evidence) => Promise<boolean>;
  createChangeRequest: (
    input: Pick<ChangeRequest, 'taskId' | 'type' | 'reason' | 'proposedValue'>,
  ) => Promise<boolean>;
  decideChange: (id: string, approved: boolean, reason: string) => Promise<boolean>;
  addResolution: (input: Omit<Resolution, 'id' | 'code' | 'createdAt'>) => Promise<string | null>;
  authorizeResolution: (id: string) => Promise<boolean>;
  addTask: (
    input: Omit<Task, 'id' | 'code' | 'updates' | 'evidence' | 'progress' | 'status'>,
  ) => Promise<string | null>;
  closeResolution: (id: string, criteriaConfirmed: boolean) => Promise<boolean>;
  addMeeting: (input: Omit<Meeting, 'id'>) => Promise<string | null>;
  updateSettings: (patch: Partial<DemoSettings>) => Promise<boolean>;
  resetDemo: () => void;
  refresh: () => Promise<boolean>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace provider is required');
  return context;
}
