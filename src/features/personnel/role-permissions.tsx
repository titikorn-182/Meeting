'use client';
import { Button, Panel } from '@/components/ui';
import styles from '@/features/personnel/team.module.css';
import {
  ACCESS_ROLES,
  STAFF_PAGE_KEYS,
  WORKSPACE_PAGES,
  accessRoleDescriptions,
  accessRoleLabels,
  type AccessRole,
} from '@/lib/access-control';
import { Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { editableRoles } from './personnel-model';

import { useRolePermissions } from './use-role-permissions';

export function RolePermissions() {
  const model = useRolePermissions();
  const {
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
  } = model;
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
