import { users } from './fixtures/workspace';
import {
  ACCESS_ROLES,
  DEFAULT_ROLE_PAGES,
  STAFF_PAGE_KEYS,
  WORKSPACE_PAGES,
  permissionsForAccessRole,
  type AccessRole,
  type AccessControl,
  type PageKey,
} from '@/lib/access-control';
export const ACCESS_STORAGE_KEY = 'polubu-ui-demo-access-v1';
interface PendingPersonnel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  unit: string;
}
export interface DemoAccessMetadata {
  currentUserId: string;
  policies: Record<AccessRole, PageKey[]>;
  policyVersion: number;
  members: Record<string, { role: AccessRole; version: number }>;
  /** Optional so existing role policies survive upgrading a saved demo. */
  pendingPersonnel?: Record<string, PendingPersonnel>;
}
export const personaIds: Record<AccessRole, string> = {
  admin: 'u-siriporn',
  user: 'u-nattapong',
  executive: 'u-somchai',
  staff: 'u-thanaphorn',
};
export function initialAccess(): DemoAccessMetadata {
  return {
    currentUserId: personaIds.admin,
    policies: structuredClone(DEFAULT_ROLE_PAGES),
    policyVersion: 1,
    members: Object.fromEntries(
      users.map((user) => [
        user.id,
        {
          role:
            user.id === personaIds.admin
              ? 'admin'
              : user.id === personaIds.user
                ? 'user'
                : ['executive', 'reviewer'].includes(user.role)
                  ? 'executive'
                  : 'staff',
          version: 1,
        },
      ]),
    ),
  };
}
export function accessFrom(metadata: DemoAccessMetadata): AccessControl {
  const role = metadata.members[metadata.currentUserId]?.role ?? 'staff';
  return {
    role,
    pages: role === 'admin' ? WORKSPACE_PAGES.map((page) => page.key) : metadata.policies[role],
    policies: metadata.policies,
    policyVersion: metadata.policyVersion,
    members: metadata.members,
  };
}
export function validAccess(value: unknown): value is DemoAccessMetadata {
  if (!value || typeof value !== 'object') return false;
  const data = value as DemoAccessMetadata;
  return (
    users.some((user) => user.id === data.currentUserId) &&
    Number.isInteger(data.policyVersion) &&
    data.policyVersion > 0 &&
    users.every(
      (user) =>
        data.members?.[user.id] &&
        ACCESS_ROLES.includes(data.members[user.id].role) &&
        Number.isInteger(data.members[user.id].version) &&
        data.members[user.id].version > 0,
    ) &&
    users.some((user) => data.members[user.id].role === 'admin') &&
    validPendingPersonnel(data) &&
    ACCESS_ROLES.every(
      (role) =>
        Array.isArray(data.policies?.[role]) &&
        new Set(data.policies[role]).size === data.policies[role].length &&
        data.policies[role].every(
          (page) =>
            WORKSPACE_PAGES.some((item) => item.key === page) &&
            (role !== 'staff' || STAFF_PAGE_KEYS.includes(page)),
        ),
    ) &&
    data.policies.admin.length === WORKSPACE_PAGES.length
  );
}
export function validPersonnelText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= maximum &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}
export function validPersonnelEmail(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}
function validPendingPersonnel(data: DemoAccessMetadata) {
  if (data.pendingPersonnel === undefined) return true;
  if (
    !data.pendingPersonnel ||
    typeof data.pendingPersonnel !== 'object' ||
    Array.isArray(data.pendingPersonnel)
  )
    return false;
  const entries = Object.entries(data.pendingPersonnel);
  const emails = new Set<string>();
  return entries.every(([id, person]) => {
    const member = data.members[id];
    if (
      !person ||
      person.id !== id ||
      users.some((user) => user.id === id) ||
      !member ||
      !ACCESS_ROLES.includes(member.role) ||
      !Number.isInteger(member.version) ||
      member.version < 1 ||
      !validPersonnelText(person.firstName, 100) ||
      !validPersonnelText(person.lastName, 100) ||
      !validPersonnelText(person.unit, 300) ||
      !users.some((user) => user.unit === person.unit) ||
      !validPersonnelEmail(person.email) ||
      person.email !== person.email.trim().toLowerCase() ||
      emails.has(person.email)
    )
      return false;
    emails.add(person.email);
    return true;
  });
}
// Web Locks serialize access edits across demo tabs; each edit also reads storage afresh.
export async function withAccessLock<T>(action: () => T): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(ACCESS_STORAGE_KEY, action)
    : action();
}

export function demoMemberCan(
  metadata: DemoAccessMetadata,
  profileId: string,
  permission: string,
): boolean {
  const member = metadata.members[profileId];
  return Boolean(
    users.some((user) => user.id === profileId) &&
    member &&
    permissionsForAccessRole(member.role, metadata.policies[member.role]).includes(permission),
  );
}
