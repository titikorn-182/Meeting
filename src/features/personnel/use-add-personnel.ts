'use client';
import { useWorkspace } from '@/components/workspace-context';
import { WORKSPACE_PAGES, type AccessRole } from '@/lib/access-control';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export function useAddPersonnel(onAdded: (id: string, name: string) => void) {
  const { access, units, users, busy, addPersonnel, supportsPersonnel } = useWorkspace();
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    unit: '',
    role: 'staff' as AccessRole,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const pages = WORKSPACE_PAGES.filter(
    (page) => draft.role === 'admin' || access.policies[draft.role].includes(page.key),
  );
  const disabled = busy || saving;
  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || busy || !supportsPersonnel || access.role !== 'admin') return;
    const input = {
      ...draft,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim().toLowerCase(),
    };
    if (!input.firstName || !input.lastName) {
      setError('กรุณาระบุชื่อและนามสกุลให้ครบ');
      return;
    }
    if (!units.includes(input.unit)) {
      setError('กรุณาเลือกหน่วยงานจากรายการ');
      return;
    }
    if (users.some((person) => person.email?.trim().toLowerCase() === input.email)) {
      setError('มีบุคลากรที่ใช้อีเมลนี้ในพื้นที่ทำงานแล้ว กรุณาตรวจรายชื่อหรือใช้อีเมลอื่น');
      document.getElementById('personnel-email')?.focus();
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const id = await addPersonnel(input);
      if (id) onAdded(id, `${input.firstName} ${input.lastName}`);
      else setError('ยังเพิ่มบุคลากรไม่ได้ ตรวจสอบข้อความแจ้งเตือนและแก้ไขข้อมูลก่อนลองอีกครั้ง');
    } catch {
      setError('ไม่สามารถเพิ่มบุคลากรได้ในขณะนี้ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง');
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }
  return {
    submit,
    saving,
    firstNameRef,
    disabled,
    draft,
    setDraft,
    units,
    pages,
    error,
    supportsPersonnel,
  };
}
export type AddPersonnelModel = ReturnType<typeof useAddPersonnel>;
