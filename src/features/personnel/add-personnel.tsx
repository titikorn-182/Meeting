'use client';
import { Button, Field, Panel } from '@/components/ui';
import styles from '@/features/personnel/team.module.css';
import {
  ACCESS_ROLES,
  accessRoleDescriptions,
  accessRoleLabels,
  type AccessRole,
} from '@/lib/access-control';
import { Check, LockKeyhole } from 'lucide-react';

import { useAddPersonnel } from './use-add-personnel';

export function AddPersonnel({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (id: string, name: string) => void;
}) {
  const model = useAddPersonnel(onAdded);
  const {
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
  } = model;
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
