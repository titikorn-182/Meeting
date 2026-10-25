'use client';
import { useWorkspace } from '@/components/workspace-context';
import { accessRoleLabels, type AccessRole, type PageKey } from '@/lib/access-control';
import { useState } from 'react';
import { samePages } from './personnel-model';

export function useRolePermissions() {
  const { access, busy, setRolePages, users } = useWorkspace();
  const isAdmin = access.role === 'admin';
  const [draft, setDraft] = useState<{
    role: AccessRole;
    pages: PageKey[];
    base: PageKey[];
    version: number;
  }>({
    role: 'user',
    pages: [...access.policies.user],
    base: [...access.policies.user],
    version: access.policyVersion,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const stale = draft.version !== access.policyVersion;
  const pages = stale ? access.policies[draft.role] : draft.pages;
  const dirty = !stale && !samePages(draft.pages, draft.base);
  const memberCount = users.filter(
    (person) => (access.members[person.id]?.role ?? person.accessRole ?? 'staff') === draft.role,
  ).length;
  // Reconcile before rendering controls so a stale draft cannot be submitted.
  // The version guard resets only when the authoritative policy changes.
  if (draft.version !== access.policyVersion) {
    if (!samePages(draft.pages, draft.base) && !saving)
      setMessage({
        text: 'สิทธิ์มีการเปลี่ยนแปลงจากที่อื่น จึงโหลดค่าล่าสุดแล้ว กรุณาตรวจสอบและเลือกสิทธิ์อีกครั้ง',
        error: true,
      });
    setDraft({
      role: draft.role,
      pages: [...access.policies[draft.role]],
      base: [...access.policies[draft.role]],
      version: access.policyVersion,
    });
  }
  function selectRole(role: AccessRole) {
    setDraft({
      role,
      pages: [...access.policies[role]],
      base: [...access.policies[role]],
      version: access.policyVersion,
    });
    setMessage(null);
  }
  function togglePage(page: PageKey, checked: boolean) {
    setDraft((current) => ({
      ...current,
      pages: checked ? [...current.pages, page] : current.pages.filter((key) => key !== page),
    }));
    setMessage(null);
  }
  async function save() {
    if (saving || busy || !dirty || !isAdmin) return;
    setSaving(true);

    setMessage(null);
    try {
      const ok = await setRolePages(draft.role, draft.pages, draft.version);
      if (ok) {
        setDraft((current) => ({ ...current, base: [...current.pages] }));
        setMessage({ text: `บันทึกสิทธิ์ของ ${accessRoleLabels[draft.role]} แล้ว` });
      } else
        setMessage({
          text: 'ยังบันทึกสิทธิ์ไม่ได้ ตรวจสอบข้อความแจ้งเตือนและลองอีกครั้ง',
          error: true,
        });
    } catch {
      setMessage({ text: 'ไม่สามารถบันทึกสิทธิ์ได้ในขณะนี้ กรุณาลองอีกครั้ง', error: true });
    } finally {
      setSaving(false);
    }
  }
  return {
    isAdmin,
    draft,
    busy,
    saving,
    dirty,
    selectRole,
    pages,
    access,
    stale,
    togglePage,
    memberCount,
    save,
    message,
  };
}
export type RolePermissionsModel = ReturnType<typeof useRolePermissions>;
