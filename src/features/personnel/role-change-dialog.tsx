'use client';
import { Avatar, Badge, Button, Dialog } from '@/components/ui';
import styles from '@/features/personnel/team.module.css';
import { accessRoleDescriptions, accessRoleLabels } from '@/lib/access-control';
import { ArrowRight } from 'lucide-react';
import type { TeamModel } from './use-team';
export function RoleChangeDialog({
  model,
}: {
  model: Pick<
    TeamModel,
    | 'roleChange'
    | 'setRoleChange'
    | 'addedPages'
    | 'removedPages'
    | 'nextPages'
    | 'state'
    | 'changeIsStale'
    | 'lastAdminChange'
    | 'changeError'
    | 'saving'
    | 'busy'
    | 'isAdmin'
    | 'confirmRoleChange'
  >;
}) {
  const {
    roleChange,
    setRoleChange,
    addedPages,
    removedPages,
    nextPages,
    state,
    changeIsStale,
    lastAdminChange,
    changeError,
    saving,
    busy,
    isAdmin,
    confirmRoleChange,
  } = model;
  return (
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
  );
}
