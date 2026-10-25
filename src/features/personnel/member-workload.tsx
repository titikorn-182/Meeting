'use client';
import { Badge, Button, EmptyState, Panel } from '@/components/ui';
import styles from '@/features/personnel/team.module.css';
import { canAccessPage } from '@/lib/access-control';
import { formatThaiDate } from '@/lib/workflow';
import { Users, X } from 'lucide-react';
import Link from 'next/link';
import { workRoleLabels } from './personnel-model';
import type { TeamModel } from './use-team';
export function MemberWorkload({
  model,
}: {
  model: Pick<
    TeamModel,
    'selected' | 'setSelectedId' | 'isAdmin' | 'state' | 'selectedTasks' | 'access'
  >;
}) {
  const { selected, setSelectedId, isAdmin, state, selectedTasks, access } = model;
  return (
    <>
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
                        {task.ownerId === selected.id ? 'ผู้รับผิดชอบหลัก' : 'ผู้ตรวจผล'} · ส่งภายใน{' '}
                        {formatThaiDate(task.dueDate)}
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
    </>
  );
}
