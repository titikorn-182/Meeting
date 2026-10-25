'use client';
import { useWorkspace } from '@/components/workspace-context';
import { WORKSPACE_PAGES, accessRoleLabels, type AccessRole } from '@/lib/access-control';
import type { User } from '@/lib/types';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { workRoleLabels, type RoleChange } from './personnel-model';

import { buildTaskIndex } from '@/lib/workspace-selectors';

export function useTeam() {
  const {
    state,
    mode,
    users,
    today,
    units,
    access,
    busy,
    ready,
    setMemberRole,
    setPendingPersonnelRole,
    supportsPersonnel,
  } = useWorkspace();
  const [tab, setTab] = useState<'members' | 'permissions'>('members');
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState('all');
  const [roleFilter, setRoleFilter] = useState<AccessRole | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<RoleChange | null>(null);
  const [saving, setSaving] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [addingPersonnel, setAddingPersonnel] = useState(false);
  const isAdmin = access.role === 'admin';
  const getRole = (person: User): AccessRole =>
    access.members[person.id]?.role ?? person.accessRole ?? 'staff';
  const adminCount = users.filter(
    (person) => person.membershipStatus !== 'pending' && getRole(person) === 'admin',
  ).length;
  const pendingCount = users.filter((person) => person.membershipStatus === 'pending').length;
  const searchText = query.trim().toLocaleLowerCase('th');
  const filtered = users.filter(
    (person) =>
      (unit === 'all' || person.unit === unit) &&
      (roleFilter === 'all' || getRole(person) === roleFilter) &&
      `${person.name} ${isAdmin || person.id === state.currentUserId ? (person.email ?? '') : ''} ${person.unit} ${person.membershipStatus === 'pending' ? 'รอเข้าใช้งาน' : workRoleLabels[person.role]} ${accessRoleLabels[getRole(person)]}`
        .toLocaleLowerCase('th')
        .includes(searchText),
  );
  const selected = users.find((person) => person.id === selectedId);
  const taskIndex = useMemo(() => buildTaskIndex(state.tasks, today), [state.tasks, today]);
  const selectedTasks = taskIndex.byParticipant.get(selectedId ?? '') ?? [];
  const nextPages = roleChange
    ? roleChange.to === 'admin'
      ? WORKSPACE_PAGES.map((page) => page.key)
      : access.policies[roleChange.to]
    : [];
  const previousPages = roleChange
    ? roleChange.from === 'admin'
      ? WORKSPACE_PAGES.map((page) => page.key)
      : access.policies[roleChange.from]
    : [];
  const addedPages = WORKSPACE_PAGES.filter(
    (page) => nextPages.includes(page.key) && !previousPages.includes(page.key),
  );
  const removedPages = WORKSPACE_PAGES.filter(
    (page) => previousPages.includes(page.key) && !nextPages.includes(page.key),
  );
  const changeIsStale = roleChange
    ? !users.some(
        (person) =>
          person.id === roleChange.person.id &&
          person.membershipStatus === roleChange.person.membershipStatus,
      ) ||
      (access.members[roleChange.person.id]?.version ?? 0) !== roleChange.version ||
      getRole(roleChange.person) !== roleChange.from
    : false;
  const lastAdminChange =
    !!roleChange &&
    roleChange.person.membershipStatus !== 'pending' &&
    roleChange.from === 'admin' &&
    roleChange.to !== 'admin' &&
    adminCount <= 1;
  function closePersonnelForm() {
    setAddingPersonnel(false);
    requestAnimationFrame(() => document.getElementById('add-personnel-button')?.focus());
  }
  function openRoleChange(person: User, to: AccessRole) {
    if (to === getRole(person) || busy || saving || !isAdmin) return;
    setRoleChange({
      person,
      from: getRole(person),
      to,
      version: access.members[person.id]?.version ?? 0,
    });
    setChangeError(null);
    setFeedback(null);
  }
  async function confirmRoleChange() {
    if (!roleChange || saving || busy || changeIsStale || lastAdminChange || !isAdmin) return;
    setSaving(true);
    setChangeError(null);
    try {
      const ok = await (
        roleChange.person.membershipStatus === 'pending' ? setPendingPersonnelRole : setMemberRole
      )(roleChange.person.id, roleChange.to, roleChange.version);
      if (ok) {
        setFeedback(
          `เปลี่ยนบทบาทของ ${roleChange.person.name} เป็น ${accessRoleLabels[roleChange.to]} แล้ว`,
        );
        setRoleChange(null);
      } else setChangeError('ยังเปลี่ยนบทบาทไม่ได้ ตรวจสอบข้อความแจ้งเตือนและลองอีกครั้ง');
    } catch {
      setChangeError('ไม่สามารถเปลี่ยนบทบาทได้ในขณะนี้ กรุณาลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'members'
        : event.key === 'End'
          ? 'permissions'
          : tab === 'members'
            ? 'permissions'
            : 'members';
    setTab(next);
    document.getElementById(`team-tab-${next}`)?.focus();
  }
  return {
    taskIndex,
    isAdmin,
    access,
    ready,
    supportsPersonnel,
    busy,
    addingPersonnel,
    setTab,
    setAddingPersonnel,
    setFeedback,
    tab,
    handleTabKey,
    users,
    feedback,
    closePersonnelForm,
    setSelectedId,
    setQuery,
    setUnit,
    setRoleFilter,
    filtered,
    pendingCount,
    query,
    unit,
    units,
    roleFilter,
    state,
    today,
    getRole,
    adminCount,
    selectedId,
    mode,
    saving,
    openRoleChange,
    selected,
    selectedTasks,
    roleChange,
    setRoleChange,
    addedPages,
    removedPages,
    nextPages,
    changeIsStale,
    lastAdminChange,
    changeError,
    confirmRoleChange,
  };
}
export type TeamModel = ReturnType<typeof useTeam>;
