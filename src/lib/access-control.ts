import type { WorkflowRole } from './types';

export const ACCESS_ROLES = ['admin', 'user', 'executive', 'staff'] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];
export const WORKSPACE_PAGES = [
  { key: 'dashboard', label: 'ภาพรวม', href: '/' },
  { key: 'meetings', label: 'การประชุม', href: '/meetings' },
  { key: 'resolutions', label: 'ทะเบียนมติ', href: '/resolutions' },
  { key: 'tasks', label: 'งานของฉัน', href: '/tasks' },
  { key: 'reviews', label: 'ตรวจผลและรับรอง', href: '/reviews' },
  { key: 'changes', label: 'คำขอเปลี่ยนแปลง', href: '/changes' },
  { key: 'reports', label: 'รายงาน', href: '/reports' },
  { key: 'team', label: 'บุคลากรและสิทธิ์', href: '/team' },
  { key: 'settings', label: 'การตั้งค่า', href: '/settings' },
  { key: 'notifications', label: 'แจ้งเตือน', href: '/notifications' },
] as const;
export type PageKey = (typeof WORKSPACE_PAGES)[number]['key'];
export const STAFF_PAGE_KEYS: readonly PageKey[] = [
  'dashboard',
  'tasks',
  'changes',
  'notifications',
];
export const DEFAULT_ROLE_PAGES: Record<AccessRole, PageKey[]> = {
  admin: WORKSPACE_PAGES.map((page) => page.key),
  // The organization administrator selects these pages explicitly in /team.
  user: [],
  executive: [],
  staff: ['tasks', 'changes', 'notifications'],
};
export const accessRoleLabels: Record<AccessRole, string> = {
  admin: 'Admin',
  user: 'User',
  executive: 'Executive',
  staff: 'Staff',
};
export const accessRoleDescriptions: Record<AccessRole, string> = {
  admin: 'เข้าถึงทุกหน้าและจัดการสิทธิ์สมาชิกในองค์กร',
  user: 'ใช้งานตามหน้าที่ผู้ดูแลกำหนด',
  executive: 'ติดตามและพิจารณางานตามสิทธิ์ที่ได้รับ',
  staff: 'เข้าถึงเฉพาะข้อมูลและงานของตนเอง',
};
export interface AccessControl {
  role: AccessRole;
  pages: PageKey[];
  policies: Record<AccessRole, PageKey[]>;
  policyVersion: number;
  members: Record<string, { role: AccessRole; version: number }>;
}
export function isAccessRole(value: unknown): value is AccessRole {
  return typeof value === 'string' && (ACCESS_ROLES as readonly string[]).includes(value);
}
export function isPageKey(value: unknown): value is PageKey {
  return typeof value === 'string' && WORKSPACE_PAGES.some((page) => page.key === value);
}
export function isPageList(value: unknown): value is PageKey[] {
  return Array.isArray(value) && value.every(isPageKey) && new Set(value).size === value.length;
}
export function isAccessControl(value: unknown): value is AccessControl {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const access = value as Partial<AccessControl>;
  if (
    !isAccessRole(access.role) ||
    !isPageList(access.pages) ||
    !access.policies ||
    !access.members ||
    Array.isArray(access.members) ||
    typeof access.members !== 'object' ||
    !Number.isSafeInteger(access.policyVersion) ||
    Number(access.policyVersion) < 1
  )
    return false;
  if (!ACCESS_ROLES.every((role) => isPageList(access.policies?.[role]))) return false;
  if (access.policies.admin.length !== WORKSPACE_PAGES.length) return false;
  if (access.policies.staff.some((page) => !STAFF_PAGE_KEYS.includes(page))) return false;
  const selected = access.policies[access.role];
  if (
    access.pages.length !== selected.length ||
    access.pages.some((page) => !selected.includes(page))
  )
    return false;
  return Object.values(access.members).every(
    (member) =>
      member &&
      isAccessRole(member.role) &&
      Number.isSafeInteger(member.version) &&
      member.version >= 0,
  );
}
export function canAccessPage(
  access: Pick<AccessControl, 'role' | 'pages'>,
  page: PageKey,
): boolean {
  return access.pages.includes(page) && (access.role !== 'staff' || STAFF_PAGE_KEYS.includes(page));
}
export function pageForPath(path: string): PageKey | null {
  const clean = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if (clean === '/') return 'dashboard';
  return (
    WORKSPACE_PAGES.find(
      (page) => page.href !== '/' && (clean === page.href || clean.startsWith(`${page.href}/`)),
    )?.key ?? null
  );
}
export function landingPath(access: Pick<AccessControl, 'role' | 'pages'>): string {
  return WORKSPACE_PAGES.find((page) => canAccessPage(access, page.key))?.href ?? '/';
}
export function workflowRoleForAccessRole(role: AccessRole): WorkflowRole {
  return role === 'staff' ? 'owner' : role === 'executive' ? 'executive' : 'secretary';
}
export function workflowRolesForAccessRole(role: AccessRole): WorkflowRole[] {
  return role === 'admin'
    ? ['secretary', 'owner', 'reviewer', 'executive']
    : role === 'user'
      ? ['secretary', 'owner']
      : role === 'executive'
        ? ['executive', 'reviewer']
        : ['owner'];
}
const businessPermissions: Record<AccessRole, readonly string[]> = {
  admin: [
    'workspace.read_all',
    'meeting.manage',
    'resolution.draft',
    'task.assign',
    'task.work',
    'change.request',
    'submission.review',
    'execution.authorize',
    'deadline.approve',
    'assignment.approve',
    'scope.approve',
    'resolution.close',
    'report.export',
    'policy.manage',
    'access.manage',
  ],
  user: [
    'workspace.read_all',
    'meeting.manage',
    'resolution.draft',
    'task.assign',
    'task.work',
    'change.request',
  ],
  executive: [
    'workspace.read_all',
    'execution.authorize',
    'deadline.approve',
    'assignment.approve',
    'scope.approve',
    'resolution.close',
    'submission.review',
    'report.export',
  ],
  staff: ['task.work', 'change.request'],
};
const permissionPage: Record<string, PageKey> = {
  'meeting.manage': 'meetings',
  'resolution.draft': 'resolutions',
  'task.assign': 'resolutions',
  'task.work': 'tasks',
  'change.request': 'changes',
  'submission.review': 'reviews',
  'execution.authorize': 'resolutions',
  'deadline.approve': 'changes',
  'assignment.approve': 'changes',
  'scope.approve': 'changes',
  'resolution.close': 'resolutions',
  'report.export': 'reports',
  'policy.manage': 'settings',
  'access.manage': 'team',
};
/** UI affordances only; the SQL command boundary independently checks every action. */
export function permissionsForAccessRole(role: AccessRole, pages: readonly PageKey[]): string[] {
  return businessPermissions[role].filter(
    (permission) => !permissionPage[permission] || pages.includes(permissionPage[permission]),
  );
}
