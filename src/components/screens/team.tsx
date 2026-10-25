'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  PageHeader,
  Panel,
} from '@/components/ui';
import {
  ACCESS_ROLES,
  WORKSPACE_PAGES,
  STAFF_PAGE_KEYS,
  accessRoleDescriptions,
  accessRoleLabels,
  canAccessPage,
  type AccessRole,
  type PageKey,
} from '@/lib/access-control';
import { formatThaiDate, isOverdue } from '@/lib/workflow';
import type { Role, User } from '@/lib/types';
import styles from './team.module.css';

const workRoleLabels: Record<Role, string> = {
  secretary: 'เลขานุการ',
  owner: 'ผู้รับผิดชอบ',
  reviewer: 'ผู้ตรวจผล',
  executive: 'ผู้บริหาร',
};
const editableRoles = ACCESS_ROLES.filter((role) => role !== 'admin');
const samePages = (left: readonly PageKey[], right: readonly PageKey[]) =>
  left.length === right.length && left.every((page) => right.includes(page));
type RoleChange = { person: User; from: AccessRole; to: AccessRole; version: number };

function AddPersonnel({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (id: string, name: string) => void;
}) {
  const { access, units, users, busy, addPersonnel, supportsPersonnel } = useDemo();
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

  return (
    <div id="add-personnel-panel">
      <Panel
        title="เพิ่มบุคลากร"
        description="เตรียมรายชื่อและสิทธิ์ไว้ก่อน บุคลากรสมัครบัญชีด้วยอีเมลนี้ภายหลัง"
      >
        <form
          onSubmit={submit}
          aria-label="เพิ่มบุคลากรล่วงหน้า"
          aria-busy={saving}
          className={styles.personnelForm}
        >
          <div className={styles.personnelFields}>
            <Field label="ชื่อ" htmlFor="personnel-first-name" required>
              <input
                ref={firstNameRef}
                id="personnel-first-name"
                name="firstName"
                className="input"
                autoComplete="given-name"
                required
                maxLength={100}
                disabled={disabled}
                value={draft.firstName}
                onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
              />
            </Field>
            <Field label="นามสกุล" htmlFor="personnel-last-name" required>
              <input
                id="personnel-last-name"
                name="lastName"
                className="input"
                autoComplete="family-name"
                required
                maxLength={100}
                disabled={disabled}
                value={draft.lastName}
                onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
              />
            </Field>
            <div className={styles.fullField}>
              <Field label="อีเมลที่ใช้เข้าสู่ระบบ" htmlFor="personnel-email" required>
                <input
                  id="personnel-email"
                  name="email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
                  disabled={disabled}
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  aria-describedby="personnel-email-hint"
                />
                <p id="personnel-email-hint" className="field-hint">
                  ต้องสมัครและยืนยันด้วยอีเมลตรงกันจึงจะได้รับสิทธิ์
                </p>
              </Field>
            </div>
            <Field label="หน่วยงาน" htmlFor="personnel-unit" required>
              <select
                id="personnel-unit"
                name="unit"
                className="select"
                required
                disabled={disabled}
                value={draft.unit}
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
              >
                <option value="" disabled>
                  เลือกหน่วยงาน
                </option>
                {units.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="บทบาทการเข้าถึง" htmlFor="personnel-role" required>
              <select
                id="personnel-role"
                name="role"
                className="select"
                required
                disabled={disabled}
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value as AccessRole })}
              >
                {ACCESS_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {accessRoleLabels[role]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <section
            className={styles.personnelAccess}
            aria-labelledby="personnel-access-heading"
            aria-live="polite"
          >
            <h3 id="personnel-access-heading">
              สิทธิ์ที่จะได้รับ · {accessRoleLabels[draft.role]}
            </h3>
            <p>{accessRoleDescriptions[draft.role]}</p>
            {pages.length ? (
              <ul className={styles.accessPages}>
                {pages.map((page) => (
                  <li key={page.key}>
                    <Check size={14} aria-hidden="true" />
                    {page.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="inline-alert warning">
                ยังไม่ได้กำหนดหน้าให้บทบาทนี้ บุคลากรจะเข้าใช้งานไม่ได้จนกว่า Admin
                จะกำหนดสิทธิ์ในแท็บบทบาทและสิทธิ์
              </p>
            )}
            <p className={styles.scopeNote}>
              <LockKeyhole size={15} aria-hidden="true" />
              {draft.role === 'staff'
                ? 'เห็นเฉพาะข้อมูลตนเอง'
                : draft.role === 'admin'
                  ? 'เข้าทุกหน้าและจัดการสิทธิ์บุคลากรได้'
                  : 'เห็นข้อมูลตามสิทธิ์ของงาน'}
            </p>
          </section>
          <div className={styles.personnelSubmit}>
            <p className={styles.signupNote}>
              ระบบบันทึกรายชื่อโดยไม่ส่งอีเมลเชิญ โปรดแจ้งให้บุคลากรสมัครและยืนยันอีเมลด้วยตนเอง
              หากมีบัญชีอยู่แล้ว ให้เข้าสู่ระบบอีกครั้งเพื่อรับสิทธิ์
            </p>
            {error && (
              <p className="inline-alert error" role="alert">
                {error}
              </p>
            )}
            {!units.length && (
              <p className="inline-alert warning">
                ยังไม่มีหน่วยงานให้เลือก กรุณาเพิ่มหน่วยงานในพื้นที่ทำงานก่อน
              </p>
            )}
            <div className={styles.formActions}>
              <Button variant="secondary" disabled={saving} onClick={onCancel}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={disabled || !supportsPersonnel || !units.length}>
                {saving ? 'กำลังเพิ่มบุคลากร…' : 'เพิ่มบุคลากร'}
              </Button>
            </div>
          </div>
        </form>
      </Panel>
    </div>
  );
}

function RolePermissions() {
  const { access, busy, setRolePages, users } = useDemo();
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
  const savingRef = useRef(false);
  const stale = draft.version !== access.policyVersion;
  const pages = stale ? access.policies[draft.role] : draft.pages;
  const dirty = !stale && !samePages(draft.pages, draft.base);
  const memberCount = users.filter(
    (person) => (access.members[person.id]?.role ?? person.accessRole ?? 'staff') === draft.role,
  ).length;

  useEffect(() => {
    if (draft.version === access.policyVersion) return;
    if (!samePages(draft.pages, draft.base) && !savingRef.current)
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
  }, [access.policyVersion, access.policies, draft]);

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
    savingRef.current = true;
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
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Panel
      title="สิทธิ์การเข้าถึงแต่ละหน้า"
      description="กำหนดหน้าที่แต่ละบทบาทเปิดได้ โดยแยกจากหน้าที่รับผิดชอบในงาน"
    >
      <div className={styles.policyToolbar}>
        <div className={styles.roleEditor}>
          <label htmlFor="permission-role">
            {isAdmin ? 'บทบาทที่ต้องการแก้ไข' : 'บทบาทที่ต้องการดู'}
          </label>
          <select
            id="permission-role"
            className="select"
            value={draft.role}
            disabled={busy || saving || dirty}
            onChange={(event) => selectRole(event.target.value as AccessRole)}
          >
            {(isAdmin ? editableRoles : ACCESS_ROLES).map((role) => (
              <option key={role} value={role}>
                {accessRoleLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.policyHint}>
          {isAdmin
            ? dirty
              ? 'บันทึกหรือยกเลิกก่อนแก้ไขบทบาทอื่น'
              : 'เลือกได้ครั้งละหนึ่งบทบาท แล้วบันทึกการเปลี่ยนแปลง'
            : 'ดูสิทธิ์ได้ ผู้ดูแลระบบเป็นผู้แก้ไข'}
        </p>
      </div>
      <div
        className={styles.matrixScroll}
        tabIndex={0}
        role="region"
        aria-label="ตารางสิทธิ์การเข้าถึงแต่ละหน้า"
      >
        <table className={styles.matrix}>
          <caption className="sr-only">สิทธิ์การเข้าถึงแต่ละหน้าตามบทบาท</caption>
          <thead>
            <tr>
              <th scope="col">หน้าในระบบ</th>
              {ACCESS_ROLES.map((role) => {
                const count =
                  role === 'admin'
                    ? WORKSPACE_PAGES.length
                    : (isAdmin && draft.role === role ? pages : access.policies[role]).length;
                return (
                  <th
                    key={role}
                    scope="col"
                    className={
                      draft.role === role
                        ? `${styles.selectedColumn} ${isAdmin ? styles.activeColumn : ''}`
                        : undefined
                    }
                  >
                    <span className={styles.roleHeading}>
                      {role === 'admin' && <LockKeyhole size={13} aria-hidden="true" />}
                      {accessRoleLabels[role]}
                    </span>
                    <span className={styles.roleDescription}>{accessRoleDescriptions[role]}</span>
                    <span className={styles.pageCount}>
                      {count ? `${count} หน้า` : 'ยังไม่ได้กำหนดหน้า'}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {WORKSPACE_PAGES.map((page) => (
              <tr key={page.key}>
                <th scope="row">{page.label}</th>
                {ACCESS_ROLES.map((role) => {
                  const selected = isAdmin && role === draft.role;
                  const checked =
                    role === 'admin' ||
                    (selected ? pages : access.policies[role]).includes(page.key);
                  const staffRestricted = role === 'staff' && !STAFF_PAGE_KEYS.includes(page.key);
                  return (
                    <td
                      key={role}
                      className={
                        role === draft.role
                          ? `${styles.selectedColumn} ${selected ? styles.activeColumn : ''}`
                          : undefined
                      }
                    >
                      {selected ? (
                        <label className={styles.permissionCell}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy || saving || staffRestricted || stale}
                            onChange={(event) => togglePage(page.key, event.target.checked)}
                            aria-label={`${accessRoleLabels[role]} เข้าถึงหน้า${page.label}${staffRestricted ? ' ไม่สามารถเปิดสิทธิ์นี้ได้' : ''}`}
                          />
                          <span className="sr-only">{page.label}</span>
                          {staffRestricted && (
                            <LockKeyhole
                              size={12}
                              className={styles.restrictedLock}
                              aria-hidden="true"
                            />
                          )}
                        </label>
                      ) : (
                        <span className={checked ? styles.allowed : styles.notAllowed}>
                          {checked ? (
                            <Check size={18} strokeWidth={2} aria-hidden="true" />
                          ) : (
                            <span aria-hidden="true">—</span>
                          )}
                          <span className="sr-only">
                            {checked ? 'เข้าถึงได้' : 'ไม่มีสิทธิ์เข้าถึง'}
                          </span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">ขอบเขตข้อมูล</th>
              {ACCESS_ROLES.map((role) => (
                <td
                  key={role}
                  className={
                    role === draft.role
                      ? `${styles.selectedColumn} ${isAdmin ? styles.activeColumn : ''}`
                      : undefined
                  }
                >
                  {role === 'staff' ? (
                    <span className={styles.ownScope}>
                      <LockKeyhole size={13} aria-hidden="true" />
                      เฉพาะข้อมูลตนเอง
                    </span>
                  ) : role === 'admin' ? (
                    'ทั้งพื้นที่ทำงาน'
                  ) : (
                    'ตามสิทธิ์ของงาน'
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={styles.policyFooter}>
        <div>
          <p className={styles.scopeNote}>
            <ShieldCheck size={16} aria-hidden="true" />
            Staff เห็นเฉพาะข้อมูลตนเองเสมอ
          </p>
          <p className={styles.smallNote}>
            Admin เข้าถึงทุกหน้า · ขอบเขตข้อมูลของ Staff ไม่สามารถขยายได้
          </p>
        </div>
        {isAdmin && (
          <div className={styles.saveActions}>
            <span className={styles.saveContext}>
              {dirty ? `มีการเปลี่ยนแปลง · สมาชิก ${memberCount} คน` : 'ยังไม่มีการเปลี่ยนแปลง'}
            </span>
            <Button
              variant="secondary"
              disabled={!dirty || busy || saving}
              onClick={() => selectRole(draft.role)}
            >
              ยกเลิก
            </Button>
            <Button disabled={!dirty || busy || saving} onClick={save}>
              {saving ? 'กำลังบันทึก…' : `บันทึกสิทธิ์ ${accessRoleLabels[draft.role]}`}
            </Button>
          </div>
        )}
      </div>
      {message && (
        <p
          className={`inline-alert ${message.error ? 'warning' : 'success'} ${styles.feedback}`}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </Panel>
  );
}

export function TeamScreen() {
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
  } = useDemo();
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
  const selectedTasks = state.tasks.filter(
    (task) => task.ownerId === selectedId || task.reviewerId === selectedId,
  );
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

  return (
    <div className={`page-stack ${styles.team}`}>
      <PageHeader
        title="บุคลากรและสิทธิ์การใช้งาน"
        description="จัดการบทบาท การเข้าถึงแต่ละหน้า และติดตามภาระงานของบุคลากร"
      >
        <span className={styles.accessStatus}>
          <ShieldCheck size={17} aria-hidden="true" />
          {isAdmin ? 'ผู้ดูแลระบบ' : `สิทธิ์ของคุณ: ${accessRoleLabels[access.role]}`}
        </span>
        {isAdmin && (
          <Button
            id="add-personnel-button"
            disabled={!ready || !supportsPersonnel || busy || addingPersonnel}
            aria-expanded={addingPersonnel}
            aria-controls="add-personnel-panel"
            aria-describedby={!supportsPersonnel ? 'personnel-unavailable' : undefined}
            onClick={() => {
              setTab('members');
              setAddingPersonnel(true);
              setFeedback(null);
            }}
          >
            <UserPlus size={17} aria-hidden="true" />
            เพิ่มบุคลากร
          </Button>
        )}
      </PageHeader>
      {isAdmin && ready && !supportsPersonnel && (
        <p id="personnel-unavailable" className="inline-alert info">
          การเพิ่มบุคลากรยังไม่พร้อมใช้งาน กรุณาอัปเดตระบบก่อนเพิ่มรายชื่อใหม่
          คุณยังจัดการบทบาทของสมาชิกเดิมได้
        </p>
      )}
      <div className={styles.tabs} role="tablist" aria-label="บุคลากรและสิทธิ์">
        <button
          type="button"
          role="tab"
          id="team-tab-members"
          aria-controls="team-panel-members"
          aria-selected={tab === 'members'}
          tabIndex={tab === 'members' ? 0 : -1}
          onKeyDown={handleTabKey}
          onClick={() => setTab('members')}
        >
          <Users size={17} aria-hidden="true" />
          สมาชิก<span>{users.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="team-tab-permissions"
          aria-controls="team-panel-permissions"
          aria-selected={tab === 'permissions'}
          tabIndex={tab === 'permissions' ? 0 : -1}
          onKeyDown={handleTabKey}
          onClick={() => setTab('permissions')}
        >
          <ShieldCheck size={17} aria-hidden="true" />
          บทบาทและสิทธิ์<span>{ACCESS_ROLES.length}</span>
        </button>
      </div>
      <div
        id="team-panel-members"
        role="tabpanel"
        aria-labelledby="team-tab-members"
        hidden={tab !== 'members'}
        className={styles.tabPanel}
      >
        {feedback && (
          <p className={`inline-alert success ${styles.feedback}`} role="status">
            {feedback}
          </p>
        )}
        {isAdmin && addingPersonnel && supportsPersonnel && (
          <AddPersonnel
            onCancel={closePersonnelForm}
            onAdded={(id, name) => {
              closePersonnelForm();
              setSelectedId(id);
              setQuery('');
              setUnit('all');
              setRoleFilter('all');
              setFeedback(`เพิ่ม ${name} แล้ว · รอเจ้าตัวสมัครและยืนยันอีเมลเพื่อเข้าใช้งาน`);
            }}
          />
        )}
        <Panel
          title="สมาชิกในพื้นที่ทำงาน"
          description={
            isAdmin
              ? 'เลือกบทบาทเพื่อดูผลกระทบและยืนยันการเปลี่ยนแปลง'
              : 'ดูรายชื่อ บทบาทการเข้าถึง และงานที่แต่ละคนรับผิดชอบ'
          }
          action={
            <span className={styles.memberTotal}>
              {filtered.length === users.length
                ? `${users.length} คน`
                : `${filtered.length} จาก ${users.length} คน`}
              {pendingCount > 0 && (
                <span className={styles.personMeta}>รอเข้าใช้งาน {pendingCount} คน</span>
              )}
            </span>
          }
        >
          <div className={styles.filters}>
            <div className={styles.search}>
              <Search size={17} aria-hidden="true" />
              <input
                className="input"
                aria-label="ค้นหาบุคลากร"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  isAdmin ? 'ค้นหาชื่อ อีเมล หน่วยงาน หรือบทบาท' : 'ค้นหาชื่อ หน่วยงาน หรือบทบาท'
                }
              />
            </div>
            <select
              className="select"
              aria-label="กรองหน่วยงานบุคลากร"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              <option value="all">ทุกหน่วยงาน</option>
              {units.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <select
              className="select"
              aria-label="กรองบทบาทการเข้าถึง"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as AccessRole | 'all')}
            >
              <option value="all">ทุกบทบาท</option>
              {ACCESS_ROLES.map((role) => (
                <option key={role} value={role}>
                  {accessRoleLabels[role]}
                </option>
              ))}
            </select>
          </div>
          {!ready ? (
            <div className={styles.loading} role="status" aria-label="กำลังโหลดรายชื่อบุคลากร">
              <span />
              <span />
              <span />
              <p>กำลังโหลดรายชื่อบุคลากร…</p>
            </div>
          ) : filtered.length ? (
            <div className="table-scroll">
              <table className={`data-table ${styles.memberTable}`}>
                <thead>
                  <tr>
                    <th scope="col">บุคลากร</th>
                    <th scope="col">หน่วยงาน / หน้าที่</th>
                    <th scope="col">บทบาทการเข้าถึง</th>
                    <th scope="col" className={styles.numeric}>
                      งานที่รับผิดชอบ
                    </th>
                    <th scope="col" className={styles.numeric}>
                      เกินกำหนด
                    </th>
                    <th scope="col">
                      <span className="sr-only">ดูรายละเอียด</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((person) => {
                    const activeTasks = state.tasks.filter(
                      (task) =>
                        task.ownerId === person.id &&
                        !['accepted', 'cancelled'].includes(task.status),
                    );
                    const overdue = activeTasks.filter((task) => isOverdue(task, today)).length;
                    const memberRole = getRole(person);
                    const pending = person.membershipStatus === 'pending';
                    const lastAdmin = !pending && memberRole === 'admin' && adminCount <= 1;
                    return (
                      <tr
                        key={person.id}
                        className={selectedId === person.id ? styles.selectedRow : undefined}
                      >
                        <td>
                          <button
                            className={styles.person}
                            onClick={() =>
                              setSelectedId(selectedId === person.id ? null : person.id)
                            }
                            type="button"
                            aria-expanded={selectedId === person.id}
                            aria-controls={
                              selectedId === person.id ? 'member-task-details' : undefined
                            }
                          >
                            <Avatar userId={person.id} />
                            <span>
                              <span className={styles.personName}>{person.name}</span>
                              {pending ? (
                                <span className={styles.pendingBadge}>
                                  <Badge tone="warning">รอเข้าใช้งาน</Badge>
                                </span>
                              ) : (
                                <span className={styles.personMeta}>
                                  {person.id === state.currentUserId
                                    ? 'บัญชีของคุณ'
                                    : mode === 'demo'
                                      ? 'บัญชีตัวอย่าง'
                                      : 'สมาชิกพื้นที่ทำงาน'}
                                </span>
                              )}
                              {person.email && (isAdmin || person.id === state.currentUserId) && (
                                <span className={styles.personEmail}>{person.email}</span>
                              )}
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className={styles.unitName}>{person.unit}</span>
                          {!pending && (
                            <span className={styles.personMeta}>{workRoleLabels[person.role]}</span>
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <div className={styles.memberRole}>
                              <select
                                className="select"
                                value={memberRole}
                                disabled={busy || saving || lastAdmin}
                                aria-label={`บทบาทการเข้าถึงของ ${person.name}`}
                                aria-describedby={lastAdmin ? `last-admin-${person.id}` : undefined}
                                onChange={(event) =>
                                  openRoleChange(person, event.target.value as AccessRole)
                                }
                              >
                                {ACCESS_ROLES.map((role) => (
                                  <option key={role} value={role}>
                                    {accessRoleLabels[role]}
                                  </option>
                                ))}
                              </select>
                              {lastAdmin && (
                                <span id={`last-admin-${person.id}`} className={styles.roleNote}>
                                  <LockKeyhole size={11} aria-hidden="true" />
                                  ผู้ดูแลคนสุดท้าย
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge tone={memberRole === 'admin' ? 'info' : 'neutral'}>
                              {accessRoleLabels[memberRole]}
                            </Badge>
                          )}
                        </td>
                        <td className={styles.numeric}>
                          {pending ? (
                            <span className={styles.pendingWork}>ยังไม่เริ่มใช้งาน</span>
                          ) : (
                            <>
                              {activeTasks.length}
                              <span className={styles.countUnit}>งาน</span>
                            </>
                          )}
                        </td>
                        <td
                          className={`${styles.numeric} ${overdue && !pending ? styles.overdue : styles.zeroCount}`}
                        >
                          {pending ? '—' : overdue || '—'}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${pending ? 'ดูข้อมูลของ' : 'ดูงานของ'} ${person.name}`}
                            aria-expanded={selectedId === person.id}
                            onClick={() =>
                              setSelectedId(selectedId === person.id ? null : person.id)
                            }
                          >
                            <ArrowRight size={17} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={users.length ? 'ไม่พบบุคลากรตามเงื่อนไข' : 'ยังไม่มีรายชื่อบุคลากร'}
              description={
                users.length
                  ? 'ลองค้นหาด้วยชื่อ หรือเลือกแสดงทุกหน่วยงานและทุกบทบาท'
                  : 'เมื่อมีสมาชิกในพื้นที่ทำงาน รายชื่อและบทบาทจะแสดงที่นี่'
              }
            >
              {users.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setUnit('all');
                    setRoleFilter('all');
                  }}
                >
                  ล้างตัวกรอง
                </Button>
              )}
            </EmptyState>
          )}
          <div className={styles.memberFootnote}>
            <span>
              <LockKeyhole size={14} aria-hidden="true" />
              Staff เห็นเฉพาะข้อมูลตนเอง
            </span>
            <span>
              {isAdmin
                ? 'บทบาทการเข้าถึงแยกจากหน้าที่ในงาน'
                : 'ผู้ดูแลระบบเป็นผู้จัดการบทบาทและสิทธิ์'}
            </span>
          </div>
        </Panel>
        {selected && (
          <div id="member-task-details">
            <Panel
              title={selected.name}
              description={
                selected.membershipStatus === 'pending'
                  ? selected.unit
                  : `${workRoleLabels[selected.role]} · ${selected.unit}`
              }
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedId(null)}
                  aria-label="ปิดรายละเอียดบุคลากร"
                >
                  <X size={18} />
                </Button>
              }
            >
              {selected.membershipStatus === 'pending' ? (
                <div className={styles.pendingDetails}>
                  <Badge tone="warning">รอเข้าใช้งาน</Badge>
                  <p>ยังไม่มีภาระงาน บุคลากรจะรับงานได้หลังสมัครและยืนยันอีเมลตรงกับที่ระบุไว้</p>
                  {selected.email && (isAdmin || selected.id === state.currentUserId) && (
                    <p className={styles.pendingEmail}>{selected.email}</p>
                  )}
                  <p className={styles.smallNote}>
                    หากมีบัญชีแล้ว ให้เข้าสู่ระบบอีกครั้งเพื่อรับสิทธิ์ · ระบบไม่ได้ส่งอีเมลเชิญ
                  </p>
                </div>
              ) : selectedTasks.length ? (
                <div className={styles.taskList}>
                  {selectedTasks.map((task) => (
                    <div key={task.id} className={styles.taskRow}>
                      <div>
                        {canAccessPage(access, 'tasks') ? (
                          <Link href={`/tasks/${task.id}`} className={styles.taskLink}>
                            {task.title}
                          </Link>
                        ) : (
                          <span className={styles.taskLink}>{task.title}</span>
                        )}
                        <div className={styles.personMeta}>
                          {task.code} ·{' '}
                          {task.ownerId === selected.id ? 'ผู้รับผิดชอบหลัก' : 'ผู้ตรวจผล'} ·
                          ส่งภายใน {formatThaiDate(task.dueDate)}
                        </div>
                      </div>
                      <Badge status={task.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="ไม่มีงานที่มอบหมายโดยตรง"
                  description="บุคลากรอาจทำหน้าที่ประสานงานหรือติดตามภาพรวม โดยไม่มีงานที่เป็นเจ้าของหรือผู้ตรวจผล"
                />
              )}
            </Panel>
          </div>
        )}
      </div>
      <div
        id="team-panel-permissions"
        role="tabpanel"
        aria-labelledby="team-tab-permissions"
        hidden={tab !== 'permissions'}
      >
        <RolePermissions />
      </div>
      {mode === 'demo' && (
        <p className={styles.demoNote}>
          รายชื่อและข้อมูลทั้งหมดเป็นข้อมูลสมมติ
          การเปลี่ยนสิทธิ์ในโหมดสาธิตบันทึกไว้ในเบราว์เซอร์นี้
        </p>
      )}
      <Dialog
        open={!!roleChange}
        onClose={() => setRoleChange(null)}
        title="ยืนยันการเปลี่ยนบทบาท"
        description="ตรวจสอบหน้าที่เข้าถึงได้และขอบเขตข้อมูลก่อนบันทึก"
      >
        {roleChange && (
          <div className={styles.rolePreview}>
            <div className={styles.previewPerson}>
              <Avatar userId={roleChange.person.id} />
              <div>
                <strong>{roleChange.person.name}</strong>
                <span className={styles.personMeta}>{roleChange.person.unit}</span>
              </div>
            </div>
            <div className={styles.roleTransition}>
              <Badge tone="neutral">{accessRoleLabels[roleChange.from]}</Badge>
              <ArrowRight size={18} aria-label="เปลี่ยนเป็น" />
              <Badge tone="info">{accessRoleLabels[roleChange.to]}</Badge>
            </div>
            <p className={styles.previewDescription}>{accessRoleDescriptions[roleChange.to]}</p>
            <dl className={styles.impactList}>
              <div>
                <dt>เข้าถึงได้เพิ่ม</dt>
                <dd>
                  {addedPages.length
                    ? addedPages.map((page) => page.label).join(' · ')
                    : 'ไม่มีหน้าเพิ่ม'}
                </dd>
              </div>
              <div>
                <dt>ยกเลิกการเข้าถึง</dt>
                <dd>
                  {removedPages.length
                    ? removedPages.map((page) => page.label).join(' · ')
                    : 'ไม่มีหน้าที่ถูกยกเลิก'}
                </dd>
              </div>
              <div>
                <dt>ขอบเขตข้อมูลใหม่</dt>
                <dd>
                  {roleChange.to === 'staff'
                    ? 'เฉพาะข้อมูลตนเอง'
                    : roleChange.to === 'admin'
                      ? 'ทั้งพื้นที่ทำงาน และจัดการสิทธิ์สมาชิกได้'
                      : 'ตามสิทธิ์ของงานและหน้าที่รับผิดชอบ'}
                </dd>
              </div>
            </dl>
            {!nextPages.length && (
              <p className="inline-alert warning">
                บทบาทนี้ยังไม่ได้กำหนดหน้า สมาชิกจะไม่สามารถเปิดหน้าในพื้นที่ทำงานได้จนกว่า Admin
                จะกำหนดสิทธิ์
              </p>
            )}
            {roleChange.person.membershipStatus === 'pending' && (
              <p className="inline-alert info">
                สิทธิ์ใหม่นี้จะเริ่มใช้เมื่อบุคลากรสมัคร ยืนยันอีเมล และเข้าใช้งานพื้นที่ทำงาน
              </p>
            )}
            {roleChange.person.id === state.currentUserId && roleChange.to !== 'admin' && (
              <p className="inline-alert warning">
                คุณกำลังเปลี่ยนบทบาทของตนเอง หลังบันทึกจะไม่สามารถจัดการสิทธิ์สมาชิกได้
              </p>
            )}
            {(changeIsStale || lastAdminChange || changeError) && (
              <p className="inline-alert error" role="alert">
                {changeIsStale
                  ? 'บทบาทของสมาชิกนี้มีการเปลี่ยนแปลงแล้ว กรุณาปิดหน้าต่างและเลือกใหม่'
                  : lastAdminChange
                    ? 'ต้องมี Admin อย่างน้อยหนึ่งคน กรุณากำหนด Admin คนอื่นก่อน'
                    : changeError}
              </p>
            )}
            <div className={styles.dialogActions}>
              <Button variant="secondary" disabled={saving} onClick={() => setRoleChange(null)}>
                ยกเลิก
              </Button>
              <Button
                disabled={saving || busy || changeIsStale || lastAdminChange || !isAdmin}
                onClick={confirmRoleChange}
              >
                {saving ? 'กำลังบันทึก…' : 'ยืนยันเปลี่ยนบทบาท'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
