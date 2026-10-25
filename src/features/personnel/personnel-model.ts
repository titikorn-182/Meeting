import { ACCESS_ROLES, type AccessRole, type PageKey } from '@/lib/access-control';
import type { User, WorkflowRole } from '@/lib/types';
export const workRoleLabels: Record<WorkflowRole, string> = {
  secretary: 'เลขานุการ',
  owner: 'ผู้รับผิดชอบ',
  reviewer: 'ผู้ตรวจผล',
  executive: 'ผู้บริหาร',
};
export const editableRoles = ACCESS_ROLES.filter((role) => role !== 'admin');
export const samePages = (left: readonly PageKey[], right: readonly PageKey[]) =>
  left.length === right.length && left.every((page) => right.includes(page));
export type RoleChange = { person: User; from: AccessRole; to: AccessRole; version: number };
