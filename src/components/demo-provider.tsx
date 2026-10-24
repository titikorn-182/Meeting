"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { initialState, users, DEMO_TODAY } from "@/lib/mock-data";
import { approveDeadlineChange, canCloseResolution, createId, daysUntil, nextDisplayCode, reconcileResolutionStatus, validateTaskTransition } from "@/lib/workflow";
import type { ChangeRequest, DemoState, Meeting, Resolution, Task, User } from "@/lib/types";
import { ACCESS_ROLES, DEFAULT_ROLE_PAGES, STAFF_PAGE_KEYS, WORKSPACE_PAGES, canAccessPage, legacyRoleForAccessRole, legacyRolesForAccessRole, pageForPath, permissionsForAccessRole, type AccessControl, type AccessRole, type PageKey } from "@/lib/access-control";

import { WorkspaceContext as DemoContext, useWorkspace, type WorkspaceContextValue, type ToastTone } from './workspace-context';
import { getDataConfiguration } from '@/lib/supabase/config';
import { SupabaseWorkspaceProvider } from './supabase-workspace-provider';
const STORAGE_KEY = "polubu-ui-demo-v1";
const ACCESS_STORAGE_KEY = "polubu-ui-demo-access-v1";
const copyInitial = () => structuredClone(initialState);
interface PendingPersonnel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  unit: string;
}
interface DemoAccessMetadata {
  currentUserId: string;
  policies: Record<AccessRole, PageKey[]>;
  policyVersion: number;
  members: Record<string, { role: AccessRole; version: number }>;
  /** Optional so existing role policies survive upgrading a saved demo. */
  pendingPersonnel?: Record<string, PendingPersonnel>;
}
const personaIds: Record<AccessRole, string> = { admin: "u-siriporn", user: "u-nattapong", executive: "u-somchai", staff: "u-thanaphorn" };
function initialAccess(): DemoAccessMetadata {
  return { currentUserId: personaIds.admin, policies: structuredClone(DEFAULT_ROLE_PAGES), policyVersion: 1,
    members: Object.fromEntries(users.map((user) => [user.id, { role: user.id === personaIds.admin ? "admin" : user.id === personaIds.user ? "user" : ["executive", "reviewer"].includes(user.role) ? "executive" : "staff", version: 1 }])) };
}
function accessFrom(metadata: DemoAccessMetadata): AccessControl {
  const role = metadata.members[metadata.currentUserId]?.role ?? "staff";
  return { role, pages: role === "admin" ? WORKSPACE_PAGES.map((page) => page.key) : metadata.policies[role], policies: metadata.policies, policyVersion: metadata.policyVersion, members: metadata.members };
}
function validAccess(value: unknown): value is DemoAccessMetadata {
  if (!value || typeof value !== "object") return false;
  const data = value as DemoAccessMetadata;
  return users.some((user) => user.id === data.currentUserId) && Number.isInteger(data.policyVersion) && data.policyVersion > 0 &&
    users.every((user) => data.members?.[user.id] && ACCESS_ROLES.includes(data.members[user.id].role) && Number.isInteger(data.members[user.id].version) && data.members[user.id].version > 0) &&
    users.some((user) => data.members[user.id].role === "admin") && validPendingPersonnel(data) && ACCESS_ROLES.every((role) => Array.isArray(data.policies?.[role]) && new Set(data.policies[role]).size === data.policies[role].length && data.policies[role].every((page) => WORKSPACE_PAGES.some((item) => item.key === page) && (role !== "staff" || STAFF_PAGE_KEYS.includes(page)))) && data.policies.admin.length === WORKSPACE_PAGES.length;
}
function validPersonnelText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
}
function validPersonnelEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function validPendingPersonnel(data: DemoAccessMetadata) {
  if (data.pendingPersonnel === undefined) return true;
  if (!data.pendingPersonnel || typeof data.pendingPersonnel !== "object" || Array.isArray(data.pendingPersonnel)) return false;
  const entries = Object.entries(data.pendingPersonnel);
  const emails = new Set<string>();
  return entries.every(([id, person]) => {
    const member = data.members[id];
    if (!person || person.id !== id || users.some((user) => user.id === id) || !member || !ACCESS_ROLES.includes(member.role) || !Number.isInteger(member.version) || member.version < 1 ||
      !validPersonnelText(person.firstName, 100) || !validPersonnelText(person.lastName, 100) || !validPersonnelText(person.unit, 300) || !users.some((user) => user.unit === person.unit) ||
      !validPersonnelEmail(person.email) || person.email !== person.email.trim().toLowerCase() || emails.has(person.email)) return false;
    emails.add(person.email);
    return true;
  });
}
// Web Locks serialize access edits across demo tabs; each edit also reads storage afresh.
async function withAccessLock<T>(action: () => T): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(ACCESS_STORAGE_KEY, action) : action();
}
function scopedDemoState(raw: DemoState, access: AccessControl): DemoState {
  const staff = access.role === "staff";
  const allowed = (page: PageKey) => canAccessPage(access, page);
  const summary = allowed("dashboard") || allowed("reports");
  const scopedTasks = staff ? raw.tasks.filter((task) => task.ownerId === raw.currentUserId) : raw.tasks;
  // Summary-only DTOs match the connected adapter; route gates keep detail screens off these projections.
  const tasks = allowed("tasks") || allowed("reviews") ? scopedTasks : summary || allowed("changes") ? scopedTasks.map(({ id, code, title, resolutionId, ownerId, unit, status, progress, dueDate, originalDueDate, acceptedAt, submittedAt, rowVersion }) => ({ id, code, title, resolutionId, ownerId, unit, status, progress, dueDate, originalDueDate, acceptedAt, submittedAt, ...(allowed("changes") ? { rowVersion } : {}) } as Task)) : [];
  const ownedTaskIds = new Set(scopedTasks.map((task) => task.id));
  const taskIds = new Set(tasks.map((task) => task.id));
  const changes = !allowed("changes") ? [] : staff ? raw.changes.filter((change) => change.requestedById === raw.currentUserId && ownedTaskIds.has(change.taskId)) : raw.changes;
  const changeIds = new Set(changes.map((change) => change.id));
  const notifications = !allowed("notifications") ? [] : raw.notifications.filter((item) => {
    const page = pageForPath(item.href);
    if (!page || !allowed(page)) return false;
    return !staff || Boolean(item.targetId && (taskIds.has(item.targetId) || changeIds.has(item.targetId))) || tasks.some((task) => item.href === `/tasks/${task.id}`);
  });
  const related = new Set(tasks.map((task) => task.resolutionId));
  const resolutions = staff ? raw.resolutions.filter((resolution) => related.has(resolution.id)).map(({ id, code, title, status, executionAuthorized }) => ({ id, code, title, status, executionAuthorized: executionAuthorized ?? true, partialContext: true } as Resolution))
    : allowed("resolutions") ? raw.resolutions
    : summary ? raw.resolutions.map(({ id, code, title, status, type, coordinatorId, dueDate, createdAt, meetingId, executionAuthorized }) => ({ id, code, title, status, type, coordinatorId, dueDate, createdAt, meetingId, executionAuthorized: executionAuthorized ?? true, partialContext: true } as Resolution))
    : raw.resolutions.filter((resolution) => related.has(resolution.id)).map(({ id, code, title, status, executionAuthorized }) => ({ id, code, title, status, executionAuthorized: executionAuthorized ?? true, partialContext: true } as Resolution));
  const meetings = staff ? [] : allowed("meetings") ? raw.meetings
    : summary ? raw.meetings.map(({ id, title, number, date, time, location, committee, status }) => ({ id, title, number, date, time, location, committee, status } as Meeting))
    : permissionsForAccessRole(access.role, access.pages).includes("resolution.draft") ? raw.meetings.map(({ id, title, number }) => ({ id, title, number } as Meeting)) : [];
  return { ...raw, tasks, resolutions, meetings, changes, notifications, audit: access.role === "admin" ? raw.audit : [], settings: allowed("settings") ? raw.settings : {} as DemoState["settings"] };
}

function audit(state: DemoState, action: string, targetId: string, targetLabel: string, detail: string): DemoState {
  return { ...state, audit: [{ id: createId("audit"), action, actorId: state.currentUserId, createdAt: new Date().toISOString(), targetId, targetLabel, detail }, ...state.audit] };
}

/** Select the adapter explicitly. A connected failure never mounts the demo adapter. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const configuration = getDataConfiguration();
  return configuration.mode === 'supabase'
    ? <SupabaseWorkspaceProvider>{children}</SupabaseWorkspaceProvider>
    : <LocalDemoProvider>{children}</LocalDemoProvider>;
}

function LocalDemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(copyInitial);
  const current = useRef(state);
  const [metadata, setMetadata] = useState<DemoAccessMetadata>(initialAccess);
  const accessCurrent = useRef(metadata);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastTone }[]>([]);
  const storageWarning = useRef(false);
  const notify = useCallback((message: string, type: ToastTone = "success") => {
    const id = createId("toast");
    setToasts((items) => [...items.slice(-2), { id, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { version?: number; state?: DemoState };
        if (parsed.version === 1 && parsed.state && ["resolutions", "tasks", "meetings", "changes", "notifications", "audit"].every((key) => Array.isArray(parsed.state?.[key as keyof DemoState])) && users.some((user) => user.id === parsed.state?.currentUserId) && parsed.state.settings) {
          current.current = parsed.state;
          setState(parsed.state);
        }
      }
      const storedAccess = localStorage.getItem(ACCESS_STORAGE_KEY);
      const parsedAccess: unknown = storedAccess ? JSON.parse(storedAccess) : initialAccess();
      if (validAccess(parsedAccess)) { accessCurrent.current = parsedAccess; setMetadata(parsedAccess); }
      const restoredAccess = accessFrom(accessCurrent.current);
      const restored = { ...current.current, currentUserId: accessCurrent.current.currentUserId, activeRole: legacyRoleForAccessRole(restoredAccess.role) };
      current.current = restored; setState(restored);
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(accessCurrent.current));
    } catch { storageWarning.current = true; }
    setReady(true);
  }, []);

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key !== ACCESS_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        if (!validAccess(parsed)) return;
        const next = { ...parsed, currentUserId: accessCurrent.current.currentUserId };
        accessCurrent.current = next; setMetadata(next);
        const synchronized = { ...current.current, activeRole: legacyRoleForAccessRole(accessFrom(next).role) };
        current.current = synchronized; setState(synchronized);
      } catch { /* Ignore incomplete writes from another tab. */ }
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      // Object URLs belong to this tab only. Keep their metadata, not an unusable URL, across reloads.
      const persisted = { ...state, tasks: state.tasks.map((task) => ({ ...task, evidence: task.evidence.map((evidence) => ({ ...evidence, url: evidence.url?.startsWith("blob:") ? undefined : evidence.url })) })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: persisted }));
    } catch {
      if (!storageWarning.current) notify("พื้นที่บันทึกในเบราว์เซอร์ไม่พร้อมใช้งาน ข้อมูลรอบนี้จะอยู่จนกว่าจะปิดหน้า", "info");
      storageWarning.current = true;
    }
  }, [state, ready, notify]);

  function applyAccess(next: DemoAccessMetadata) {
    accessCurrent.current = next; setMetadata(next);
    const synchronized = { ...current.current, currentUserId: next.currentUserId, activeRole: legacyRoleForAccessRole(accessFrom(next).role) };
    current.current = synchronized; setState(synchronized);
  }
  function commitAccess(next: DemoAccessMetadata, requirePersistence = false) {
    try { localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(next)); } catch {
      storageWarning.current = true;
      if (requirePersistence) throw new Error("ยังบันทึกบุคลากรไม่ได้ พื้นที่จัดเก็บในเบราว์เซอร์ไม่พร้อมใช้งาน");
    }
    applyAccess(next);
  }
  function requirePermission(permission: string) {
    const latest = accessFrom(latestAccess());
    if (!permissionsForAccessRole(latest.role, latest.pages).includes(permission)) throw new Error("บทบาทของคุณไม่มีสิทธิดำเนินการนี้ หรือผู้ดูแลปิดการเข้าถึงหน้านี้แล้ว");
  }
  function memberCan(profileId: string, permission: string) {
    const member = accessCurrent.current.members[profileId];
    return Boolean(users.some((user) => user.id === profileId) && member && permissionsForAccessRole(member.role, accessCurrent.current.policies[member.role]).includes(permission));
  }
  function switchPersona(role: AccessRole) {
    if (!ACCESS_ROLES.includes(role)) return;
    void withAccessLock(() => {
      const latest = latestAccess();
      const selectedId = latest.members[personaIds[role]]?.role === role ? personaIds[role] : users.find((user) => latest.members[user.id]?.role === role)?.id;
      if (!selectedId) { notify("ยังไม่มีสมาชิกตัวอย่างในบทบาทนี้ ให้ Admin กำหนดบทบาทสมาชิกก่อน", "info"); return; }
      commitAccess({ ...latest, currentUserId: selectedId });
    });
  }
  function latestAccess() {
    try {
      const stored = localStorage.getItem(ACCESS_STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : accessCurrent.current;
      if (validAccess(parsed) && (parsed.policyVersion > accessCurrent.current.policyVersion || Object.entries(parsed.members).some(([id, member]) => member.version > (accessCurrent.current.members[id]?.version ?? 0)))) {
        applyAccess({ ...parsed, currentUserId: accessCurrent.current.currentUserId });
      }
    } catch { storageWarning.current = true; }
    return accessCurrent.current;
  }

  function commit(update: (previous: DemoState) => DemoState): boolean {
    try { const next = update(current.current); current.current = next; setState(next); return true; }
    catch (error) { notify(error instanceof Error ? error.message : "ยังบันทึกไม่ได้ กรุณาลองอีกครั้ง", "error"); return false; }
  }
  function taskOwned(previous: DemoState, id: string): Task {
    const task = previous.tasks.find((item) => item.id === id);
    if (!task) throw new Error("ไม่พบงานที่ต้องการ");
    requirePermission("task.work");
    if (task.ownerId !== previous.currentUserId) throw new Error("กิจกรรมนี้ต้องดำเนินการโดยเจ้าของงานเท่านั้น");
    if (["submitted", "accepted", "cancelled"].includes(task.status)) throw new Error("งานอยู่ระหว่างตรวจหรือสิ้นสุดแล้ว จึงแก้ชุดผลงานรอบนี้ไม่ได้");
    return task;
  }
  const access = accessFrom(metadata);
  const permissions = permissionsForAccessRole(access.role, access.pages);
  const members: User[] = users.map((user) => { const role = metadata.members[user.id].role; return { ...user, membershipStatus: "active", accessRole: role, role: legacyRoleForAccessRole(role), roles: legacyRolesForAccessRole(role) }; });
  const pendingMembers: User[] = access.role === "admin" && canAccessPage(access, "team") ? Object.values(metadata.pendingPersonnel ?? {}).map((person) => {
    const role = metadata.members[person.id].role;
    return { ...person, name: `${person.firstName} ${person.lastName}`, initials: `${Array.from(person.firstName)[0] ?? ""}${Array.from(person.lastName)[0] ?? ""}`, membershipStatus: "pending", accessRole: role, role: legacyRoleForAccessRole(role), roles: legacyRolesForAccessRole(role), avatarColor: "#5f7161" };
  }) : [];
  const visibleState = scopedDemoState(state, access);
  const referencedUsers = new Set([state.currentUserId,
    ...visibleState.tasks.flatMap((task) => [task.ownerId, task.reviewerId]),
    ...visibleState.resolutions.map((resolution) => resolution.coordinatorId),
  ]);
  const visibleUsers = [...members.filter((user) => access.role === "staff" ? user.id === state.currentUserId : canAccessPage(access, "team") || referencedUsers.has(user.id) || (permissions.includes("task.assign") && (memberCan(user.id, "task.work") || memberCan(user.id, "submission.review")))), ...pendingMembers];
  const visibleMembers = Object.fromEntries(visibleUsers.map((user) => [user.id, metadata.members[user.id]]));
  const value: WorkspaceContextValue = {
    state: visibleState, access: { ...access, members: visibleMembers }, ready,
    user: members.find((item) => item.id === state.currentUserId) ?? members[0], users: visibleUsers, units: [...new Set(visibleUsers.map((user) => user.unit))], notify,
    mode: 'demo', busy: false, today: DEMO_TODAY, permissions, supportsPersonnel: true,
    eligibleOwners: access.role === "staff" || !(permissions.includes("task.assign") || permissions.includes("change.request")) ? [] : members.filter(user => memberCan(user.id, "task.work")).map(({ id, name, unit }) => ({ id, name, unit })),
    async refresh() { latestAccess(); return true; },
    async authorizeResolution(id) {
      return commit((previous) => {
        requirePermission("execution.authorize");
        const resolution = previous.resolutions.find((item) => item.id === id);
        if (!resolution || ["closed", "acknowledged"].includes(resolution.status)) throw new Error("ไม่พบมติที่เปิดให้อนุญาตดำเนินงาน");
        return audit({ ...previous, resolutions: previous.resolutions.map((item) => item.id === id ? { ...item, executionAuthorized: true } : item) }, "อนุญาตเริ่มดำเนินงาน", id, resolution.title, "ผู้มีอำนาจอนุญาตให้เริ่มดำเนินงานตามมติ");
      });
    },
    setAccessRole: switchPersona,
    setRole(role) { switchPersona(role === "secretary" ? "admin" : role === "owner" ? "staff" : "executive"); },
    async addPersonnel(input) {
      return withAccessLock(() => {
        try {
          const currentAccess = latestAccess(); requirePermission("access.manage");
          if (!canAccessPage(accessFrom(currentAccess), "team")) throw new Error("คุณไม่มีสิทธิจัดการบุคลากร");
          if (!validPersonnelText(input.firstName, 100) || !validPersonnelText(input.lastName, 100) || !validPersonnelText(input.unit, 300) || typeof input.email !== "string" || !ACCESS_ROLES.includes(input.role)) throw new Error("กรอกชื่อ นามสกุล อีเมล หน่วยงาน และบทบาทให้ครบถ้วน");
          const person = { id: crypto.randomUUID(), firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim().toLowerCase(), unit: input.unit.trim() };
          if (!validPersonnelEmail(person.email)) throw new Error("กรุณาระบุอีเมลให้ถูกต้องและไม่เกิน 254 ตัวอักษร");
          if (!users.some((user) => user.unit === person.unit)) throw new Error("กรุณาเลือกหน่วยงานที่มีอยู่ในพื้นที่ทำงาน");
          if ([...users, ...Object.values(currentAccess.pendingPersonnel ?? {})].some((user) => user.email?.trim().toLowerCase() === person.email)) throw new Error("มีบุคลากรที่ใช้อีเมลนี้ในพื้นที่ทำงานแล้ว");
          const next = { ...currentAccess, pendingPersonnel: { ...currentAccess.pendingPersonnel, [person.id]: person }, members: { ...currentAccess.members, [person.id]: { role: input.role, version: 1 } } };
          commitAccess(next, true);
          commit((previous) => audit(previous, "เพิ่มบุคลากรล่วงหน้า", person.id, `${person.firstName} ${person.lastName}`, `รอเข้าใช้งาน · ${input.role}`));
          notify("เพิ่มบุคลากรแล้ว สถานะรอเข้าใช้งาน ข้อมูลสาธิตยังไม่ผูกกับบัญชีจริง");
          return person.id;
        } catch (error) { notify(error instanceof Error ? error.message : "เพิ่มบุคลากรไม่ได้", "error"); return null; }
      });
    },
    async setPendingPersonnelRole(invitationId, role, expectedVersion) {
      return withAccessLock(() => {
        try {
          const currentAccess = latestAccess(); requirePermission("access.manage");
          if (!canAccessPage(accessFrom(currentAccess), "team")) throw new Error("คุณไม่มีสิทธิจัดการบุคลากร");
          const person = currentAccess.pendingPersonnel?.[invitationId];
          const member = currentAccess.members[invitationId];
          if (!person || !member || !ACCESS_ROLES.includes(role)) throw new Error("ไม่พบบุคลากรที่รอเข้าใช้งานหรือบทบาทที่เลือก");
          if (member.version !== expectedVersion) throw new Error("สิทธิบุคลากรเปลี่ยนไปแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนบันทึกอีกครั้ง");
          const next = { ...currentAccess, members: { ...currentAccess.members, [invitationId]: { role, version: member.version + 1 } } };
          commitAccess(next, true);
          commit((previous) => audit(previous, "เปลี่ยนบทบาทบุคลากรที่รอเข้าใช้งาน", invitationId, `${person.firstName} ${person.lastName}`, `${member.role} → ${role}`));
          notify("บันทึกบทบาทบุคลากรที่รอเข้าใช้งานแล้ว"); return true;
        } catch (error) { notify(error instanceof Error ? error.message : "บันทึกบทบาทบุคลากรไม่ได้", "error"); return false; }
      });
    },
    async setMemberRole(profileId, role, expectedVersion) {
      return withAccessLock(() => { try {
        const currentAccess = latestAccess(); requirePermission("access.manage");
        const member = currentAccess.members[profileId];
        if (!users.some((user) => user.id === profileId) || !member || !ACCESS_ROLES.includes(role)) throw new Error("ไม่พบสมาชิกหรือบทบาทที่เลือก");
        if (member.version !== expectedVersion) throw new Error("สิทธิสมาชิกเปลี่ยนไปแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนบันทึกอีกครั้ง");
        if (member.role === "admin" && role !== "admin" && users.filter((user) => currentAccess.members[user.id]?.role === "admin").length === 1) throw new Error("ต้องมี Admin อย่างน้อยหนึ่งคน กรุณากำหนด Admin คนอื่นก่อน");
        const next = { ...currentAccess, members: { ...currentAccess.members, [profileId]: { role, version: member.version + 1 } } };
        commit((previous) => audit(previous, "เปลี่ยนบทบาทสมาชิก", profileId, users.find((user) => user.id === profileId)?.name ?? profileId, `${member.role} → ${role}`));
        commitAccess(next); notify("บันทึกบทบาทสมาชิกแล้ว"); return true;
      } catch (error) { notify(error instanceof Error ? error.message : "บันทึกสิทธิสมาชิกไม่ได้", "error"); return false; } });
    },
    async setRolePages(role, pages, expectedVersion) {
      return withAccessLock(() => { try {
        const currentAccess = latestAccess(); requirePermission("access.manage");
        if (!ACCESS_ROLES.includes(role) || role === "admin") throw new Error("Admin ต้องเข้าถึงทุกหน้าเพื่อดูแลระบบ");
        if (currentAccess.policyVersion !== expectedVersion) throw new Error("สิทธิแต่ละหน้าเปลี่ยนไปแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนบันทึกอีกครั้ง");
        if (new Set(pages).size !== pages.length || pages.some((page) => !WORKSPACE_PAGES.some((item) => item.key === page) || (role === "staff" && !STAFF_PAGE_KEYS.includes(page)))) throw new Error("เลือกเฉพาะหน้าที่บทบาทนี้ใช้งานได้ และไม่เลือกหน้าซ้ำ");
        const next = { ...currentAccess, policies: { ...currentAccess.policies, [role]: [...pages] }, policyVersion: currentAccess.policyVersion + 1 };
        commit((previous) => audit(previous, "เปลี่ยนสิทธิการเข้าถึงหน้า", role, role, pages.join(", ")));
        commitAccess(next); notify("บันทึกหน้าที่บทบาทนี้เข้าถึงได้แล้ว"); return true;
      } catch (error) { notify(error instanceof Error ? error.message : "บันทึกสิทธิการเข้าถึงไม่ได้", "error"); return false; } });
    },
    async acknowledgeTask(id) {
      const ok = commit((previous) => {
        const task = taskOwned(previous, id);
        if (task.acknowledgedAt) throw new Error("รับทราบการมอบหมายนี้แล้ว");
        return audit({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? { ...item, acknowledgedAt: new Date().toISOString() } : item) }, "รับทราบงาน", id, task.title, "ยืนยันรับทราบโดยยังไม่เปลี่ยนเป็นเริ่มดำเนินการ");
      });
      if (ok) notify("รับทราบงานแล้ว เริ่มดำเนินการได้เมื่อพร้อม");
      return ok;
    },
    async transitionTask(id, status, note = "", criterionResults) {
      const ok = commit((previous) => {
        const task = previous.tasks.find((item) => item.id === id);
        if (!task) throw new Error("ไม่พบงาน");
        const review = status === "accepted" || status === "revision";
        requirePermission(review ? "submission.review" : status === "cancelled" ? "resolution.close" : "task.work");
        const result = validateTaskTransition(task, status, { role: review ? "reviewer" : status === "cancelled" ? "executive" : "owner", userId: previous.currentUserId });
        if (!result.allowed) throw new Error(result.reason);
        if (status === "accepted" && (!criterionResults || criterionResults.length !== task.criteria.length || !criterionResults.every(Boolean))) throw new Error("กรุณายืนยันเกณฑ์ตรวจรับให้ครบทุกข้อ");
        if (status === "revision" && !note.trim()) throw new Error("กรุณาระบุสิ่งที่ต้องแก้ไข");
        const now = new Date().toISOString();
        const changed: Task = { ...task, status, ...(status === "submitted" ? { submittedAt: now } : {}), ...(status === "accepted" ? { acceptedAt: now, progress: 100 } : {}), updates: note ? [...task.updates, { id: createId("update"), note, progress: task.progress, createdAt: now, authorId: previous.currentUserId }] : task.updates };
        const next = reconcileResolutionStatus({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? changed : item) }, task.resolutionId);
        next.notifications = [{ id: createId("notification"), title: status === "submitted" ? "มีผลงานส่งตรวจใหม่" : status === "accepted" ? "ผลงานผ่านการตรวจรับ" : status === "revision" ? "มีงานส่งกลับแก้ไข" : status === "cancelled" ? "ยุติงานตามการอนุมัติแล้ว" : "เริ่มดำเนินงานแล้ว", description: task.title, createdAt: now, read: false, type: "review", href: `/tasks/${id}`, targetId: id }, ...previous.notifications];
        const parent = next.resolutions.find((item) => item.id === task.resolutionId);
        if (parent?.status === "pending_close" && previous.resolutions.find((item) => item.id === parent.id)?.status !== "pending_close") {
          next.notifications = [{ id: createId("notification"), title: "มติพร้อมเสนอรับรองปิด", description: parent.title, createdAt: now, read: false, type: "review", href: `/resolutions/${parent.id}`, targetId: parent.id }, ...next.notifications];
        }
        return audit(next, status === "submitted" ? "ส่งผลงานตรวจ" : status === "accepted" ? "ตรวจรับผลงาน" : status === "revision" ? "ส่งกลับแก้ไข" : status === "cancelled" ? "ยุติงาน" : "เริ่มดำเนินงาน", id, task.title, note || `เปลี่ยนสถานะเป็น ${status}`);
      });
      if (ok) notify(status === "submitted" ? "ส่งผลงานให้ผู้ตรวจแล้ว" : status === "accepted" ? "รับรองผลงานแล้ว มติยังต้องรับรองปิดแยก" : status === "revision" ? "ส่งกลับพร้อมรายการแก้ไขแล้ว" : "บันทึกสถานะแล้ว");
      return ok;
    },
    async updateProgress(id, progress, note) {
      const ok = commit((previous) => {
        const task = taskOwned(previous, id);
        if (task.status === "assigned") throw new Error("กรุณารับทราบและเริ่มงานก่อนรายงานความก้าวหน้า");
        if (!note.trim() || !Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error("ระบุผลดำเนินงานและความก้าวหน้าระหว่าง 0–100");
        return audit({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? { ...item, progress, updates: [...item.updates, { id: createId("progress"), note: note.trim(), progress, createdAt: new Date().toISOString(), authorId: previous.currentUserId }] } : item) }, "รายงานความก้าวหน้า", id, task.title, note);
      });
      if (ok) notify("บันทึกความก้าวหน้าแล้ว"); return ok;
    },
    async addEvidence(id, evidence) {
      return commit((previous) => {
        const task = taskOwned(previous, id);
        if (evidence.url && !/^(https?:\/\/|blob:)/i.test(evidence.url)) throw new Error("ใช้ลิงก์ http หรือ https สำหรับหลักฐานเท่านั้น");
        return audit({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? { ...item, evidence: [...item.evidence, evidence] } : item) }, "เพิ่มหลักฐาน", id, task.title, evidence.name);
      });
    },
    async createChangeRequest(input) {
      const ok = commit((previous) => {
        const task = previous.tasks.find((item) => item.id === input.taskId);
        if (!task) throw new Error("ไม่พบงาน");
        requirePermission("change.request");
        if (accessFrom(accessCurrent.current).role === "staff" && task.ownerId !== previous.currentUserId) throw new Error("ยื่นคำขอได้เฉพาะงานของตนเอง");
        if (["accepted", "cancelled"].includes(task.status)) throw new Error("งานสิ้นสุดแล้ว ไม่สามารถขอเปลี่ยนกำหนดรอบนี้ได้");
        if (!input.reason.trim() || !input.proposedValue.trim()) throw new Error("ระบุค่าที่เสนอและเหตุผลให้ครบ");
        if (input.type === "owner" && !memberCan(input.proposedValue, "task.work")) throw new Error("เลือกผู้รับผิดชอบที่เข้าใช้งานแล้วและมีสิทธิดำเนินงาน");
        if (previous.changes.some((change) => change.taskId === task.id && change.type === input.type && change.status === "pending")) throw new Error("มีคำขอประเภทนี้รอพิจารณาอยู่แล้ว");
        if (input.type === "deadline" && (!/^\d{4}-\d{2}-\d{2}$/.test(input.proposedValue) || daysUntil(input.proposedValue, task.dueDate) === null || (daysUntil(input.proposedValue, task.dueDate) ?? 0) <= 0)) throw new Error("กำหนดที่ขอขยายต้องเป็นวันที่ถูกต้องและอยู่หลังวันครบกำหนดปัจจุบัน");
        const change: ChangeRequest = { ...input, id: createId("change"), code: nextDisplayCode("change", previous.changes.map((item) => item.code)), status: "pending", requestedById: previous.currentUserId, createdAt: new Date().toISOString(), originalValue: input.type === "deadline" ? task.dueDate : input.type === "owner" ? task.ownerId : task.description };
        return audit(reconcileResolutionStatus({ ...previous, changes: [change, ...previous.changes] }, task.resolutionId), "ยื่นคำขอเปลี่ยนแปลง", task.id, task.title, input.reason);
      });
      if (ok) notify("ยื่นคำขอแล้ว กำหนดปัจจุบันยังไม่เปลี่ยนจนกว่าจะอนุมัติ"); return ok;
    },
    async decideChange(id, approved, reason) {
      const ok = commit((previous) => {
        const change = previous.changes.find((item) => item.id === id);
        if (!change || change.status !== "pending") throw new Error("คำขอนี้ไม่ได้อยู่ระหว่างรอพิจารณา");
        requirePermission(change.type === "deadline" ? "deadline.approve" : change.type === "owner" ? "assignment.approve" : "scope.approve");
        if (change.requestedById === previous.currentUserId) throw new Error("ผู้พิจารณาต้องไม่ใช่ผู้ยื่นคำขอ");
        if (!reason.trim()) throw new Error("กรุณาระบุเหตุผลประกอบการพิจารณา");
        if (approved && change.type === "deadline") {
          const next = approveDeadlineChange(previous, id, { role: previous.activeRole, userId: previous.currentUserId }, new Date().toISOString());
          const resolutionId = next.tasks.find((item) => item.id === change.taskId)!.resolutionId;
          return reconcileResolutionStatus({ ...next, changes: next.changes.map((item) => item.id === id ? { ...item, decisionReason: reason.trim() } : item) }, resolutionId);
        }
        const task = previous.tasks.find((item) => item.id === change.taskId);
        if (!task) throw new Error("ไม่พบงานที่เกี่ยวข้อง");
        const now = new Date().toISOString();
        let tasks = previous.tasks;
        if (approved) {
          if (["accepted", "cancelled"].includes(task.status)) throw new Error("งานสิ้นสุดแล้ว ไม่สามารถเปลี่ยนเงื่อนไขรอบนี้ได้");
          if (task.status === "submitted") throw new Error("มีผลงานรอตรวจอยู่ ให้ผู้ตรวจส่งกลับก่อนเปลี่ยนเจ้าของหรือขอบเขต เพื่อคงชุดผลงานที่ส่งไว้");
          const currentValue = change.type === "owner" ? task.ownerId : task.description;
          if (currentValue !== change.originalValue) throw new Error("ข้อมูลเปลี่ยนไปหลังยื่นคำขอ กรุณาทบทวนและยื่นคำขอใหม่");
          if (change.type === "owner" && (!memberCan(change.proposedValue, "task.work") || change.proposedValue === task.reviewerId)) throw new Error("ต้องเลือกผู้ปฏิบัติงานที่มีสิทธิดำเนินงานและไม่ใช่ผู้ตรวจของงานนี้");
          tasks = tasks.map((item) => item.id === task.id ? { ...item, ...(change.type === "owner" ? { ownerId: change.proposedValue, acknowledgedAt: undefined, status: "assigned" as const } : { description: change.proposedValue }) } : item);
        }
        return audit(reconcileResolutionStatus({ ...previous, tasks, changes: previous.changes.map((item) => item.id === id ? { ...item, status: approved ? "approved" : "rejected", decisionReason: reason, decidedAt: now, decidedById: previous.currentUserId } : item) }, task.resolutionId), approved ? "อนุมัติคำขอ" : "ไม่อนุมัติคำขอ", id, change.code, reason);
      });
      if (ok) notify(approved ? "อนุมัติและปรับข้อมูลตามคำขอแล้ว" : "บันทึกผลไม่อนุมัติแล้ว"); return ok;
    },
    async addResolution(input) {
      const id = createId("resolution");
      const ok = commit((previous) => {
        requirePermission("resolution.draft");
        if (!input.title.trim() || !input.content.trim() || !input.meetingId) throw new Error("กรอกหัวเรื่อง ถ้อยคำมติ และการประชุมให้ครบ");
        if (!previous.meetings.some((meeting) => meeting.id === input.meetingId)) throw new Error("ไม่พบการประชุมต้นทาง");
        if (!users.some((user) => user.id === input.coordinatorId)) throw new Error("เลือกผู้ประสานงานที่เข้าใช้งานพื้นที่ทำงานแล้ว");
        const resolution: Resolution = { ...input, status: input.type === "acknowledgment" ? "acknowledged" : "open", id, code: nextDisplayCode("resolution", previous.resolutions.map((item) => item.code)), createdAt: new Date().toISOString() };
        const meetings = previous.meetings.map((meeting) => meeting.id !== input.meetingId ? meeting : { ...meeting, agenda: meeting.agenda.some((agenda) => agenda.number === input.agenda) ? meeting.agenda.map((agenda) => agenda.number === input.agenda ? { ...agenda, resolutionIds: [...agenda.resolutionIds, id] } : agenda) : [...meeting.agenda, { id: createId("agenda"), number: input.agenda, title: input.title, resolutionIds: [id] }] });
        return audit({ ...previous, meetings, resolutions: [resolution, ...previous.resolutions] }, "บันทึกมติใหม่", id, input.title, "สร้างทะเบียนมติและกำหนดเกณฑ์ปิด");
      });
      if (ok) notify("บันทึกมติแล้ว เพิ่มงานที่ต้องดำเนินการได้เลย"); return ok ? id : null;
    },
    async addTask(input) {
      const id = createId("task");
      const ok = commit((previous) => {
        requirePermission("task.assign");
        const parent = previous.resolutions.find((resolution) => resolution.id === input.resolutionId);
        if (!parent || ["closed", "acknowledged"].includes(parent.status) || parent.type === "acknowledgment") throw new Error("ต้องเลือกมติที่เปิดติดตามและมีงานดำเนินการ");
        if (!input.title.trim() || !input.ownerId || !input.reviewerId || !input.dueDate || !input.deliverable.trim() || !input.criteria.length) throw new Error("ระบุเจ้าของ ผลส่งมอบ เกณฑ์ ผู้ตรวจ และกำหนดให้ครบ");
        if (daysUntil(input.dueDate) === null) throw new Error("ระบุวันครบกำหนดที่ถูกต้อง");
        if (!memberCan(input.ownerId, "task.work") || !memberCan(input.reviewerId, "submission.review")) throw new Error("เลือกผู้รับผิดชอบและผู้ตรวจที่มีสิทธิดำเนินงานตรงกับหน้าที่");
        if (input.ownerId === input.reviewerId) throw new Error("ผู้ทำและผู้ตรวจต้องเป็นคนละคน");
        return audit({ ...previous, resolutions: previous.resolutions.map((item) => item.id === parent.id && item.status === "pending_close" ? { ...item, status: "open" } : item), tasks: [...previous.tasks, { ...input, originalDueDate: input.dueDate, id, code: nextDisplayCode("task", previous.tasks.map((item) => item.code)), updates: [], evidence: [], progress: 0, status: "assigned" }] }, "มอบหมายงานใหม่", id, input.title, `${input.deliverable}${parent.status === "pending_close" ? "; เพิ่มงานและเปิดติดตามมติอีกครั้ง" : ""}`);
      });
      if (ok) notify("มอบหมายงานแล้ว รอเจ้าของงานรับทราบ"); return ok ? id : null;
    },
    async closeResolution(id, criteriaConfirmed) {
      const ok = commit((previous) => {
        const resolution = previous.resolutions.find((item) => item.id === id);
        if (!resolution) throw new Error("ไม่พบมติ");
        requirePermission("resolution.close");
        if (["recurring", "acknowledgment"].includes(resolution.type)) throw new Error("มติต่อเนื่องและมติรับทราบไม่ปิดด้วยกระบวนงานนี้");
        if (resolution.status === "closed") throw new Error("มตินี้ปิดแล้ว");
        if (!canCloseResolution(id, previous.tasks, criteriaConfirmed)) throw new Error("ต้องตรวจรับทุกงานจำเป็นและยืนยันเกณฑ์ปิดมติให้ครบก่อน");
        if (previous.changes.some((change) => change.status === "pending" && previous.tasks.some((task) => task.id === change.taskId && task.resolutionId === id))) throw new Error("ยังมีคำขอเปลี่ยนแปลงค้าง กรุณาพิจารณาให้ครบก่อน");
        return audit({ ...previous, resolutions: previous.resolutions.map((item) => item.id === id ? { ...item, status: "closed" } : item) }, "รับรองปิดมติ", id, resolution.title, "งานจำเป็นผ่านตรวจและผู้รับรองยืนยันเกณฑ์ระดับมติครบแล้ว");
      });
      if (ok) notify("รับรองปิดมติและบันทึกประวัติแล้ว"); return ok;
    },
    async addMeeting(input) {
      const id = createId("meeting");
      const ok = commit((previous) => {
        requirePermission("meeting.manage");
        if (!input.title.trim() || !input.number.trim() || !input.date) throw new Error("กรอกชื่อ ครั้งที่ และวันที่ประชุม");
        return audit({ ...previous, meetings: [...previous.meetings, { ...input, id }] }, "เพิ่มการประชุม", id, input.title, input.date);
      });
      if (ok) notify("บันทึกการประชุมแล้ว"); return ok ? id : null;
    },
    async updateSettings(patch) {
      const ok = commit((previous) => {
        requirePermission("policy.manage");
        return audit({ ...previous, settings: { ...previous.settings, ...patch } }, "ปรับการตั้งค่า", "settings", "การติดตามและแจ้งเตือน", "บันทึกเฉพาะในเบราว์เซอร์ ไม่มีการส่งอีเมลจริง");
      });
      if (ok) notify("บันทึกการตั้งค่าชุดสาธิตแล้ว"); return ok;
    },
    resetDemo() {
      try { requirePermission("policy.manage"); } catch { notify("เฉพาะ Admin ที่เข้าถึงการตั้งค่าจึงคืนข้อมูลตัวอย่างได้", "error"); return; }
      const next = copyInitial(); current.current = next; setState(next); commitAccess(initialAccess()); notify("คืนข้อมูลตัวอย่างเริ่มต้นแล้ว");
    },
    async markNotificationRead(id) { commit((previous) => {
      const latest = accessFrom(latestAccess());
      if (!canAccessPage(latest, "notifications") || !scopedDemoState(previous, latest).notifications.some((item) => item.id === id)) throw new Error("ไม่พบการแจ้งเตือนที่คุณมีสิทธิเข้าถึง");
      return { ...previous, notifications: previous.notifications.map((item) => item.id === id ? { ...item, read: true } : item) };
    }); },
    async markAllRead() { commit((previous) => {
      const latest = accessFrom(latestAccess());
      if (!canAccessPage(latest, "notifications")) throw new Error("คุณยังไม่มีสิทธิเข้าถึงการแจ้งเตือน");
      const visibleIds = new Set(scopedDemoState(previous, latest).notifications.map((item) => item.id));
      return { ...previous, notifications: previous.notifications.map((item) => visibleIds.has(item.id) ? { ...item, read: true } : item) };
    }); },
  };

  return <DemoContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite" aria-atomic="false">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>{toast.type === "success" ? <CheckCircle2 size={19} /> : toast.type === "error" ? <CircleAlert size={19} /> : <Info size={19} />}<span>{toast.message}</span><button aria-label="ปิดข้อความ" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X size={16} /></button></div>)}</div></DemoContext.Provider>;
}

export const useDemo = useWorkspace;
