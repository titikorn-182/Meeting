'use client';
import { AccessLink as Link } from '@/components/app-shell';
import { Button, Panel } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import { CalendarClock, CheckCheck, ClipboardCheck, Play, Send, ShieldCheck } from 'lucide-react';

import type { TaskDetailModel } from './use-task-detail';
export function TaskActions({
  model,
}: {
  model: Pick<
    TaskDetailModel,
    | 'task'
    | 'busy'
    | 'isOwner'
    | 'startGuard'
    | 'submitGuard'
    | 'setSubmitOpen'
    | 'permissions'
    | 'acknowledge'
    | 'startWork'
  >;
}) {
  const {
    task,
    busy,
    isOwner,
    startGuard,
    submitGuard,
    setSubmitOpen,
    permissions,
    acknowledge,
    startWork,
  } = model;
  return (
    <Panel title="ดำเนินการกับงาน">
      <div className="stack-sm">
        {task.status === 'assigned' && (
          <>
            <p className="text-sm leading-6 muted">
              {task.acknowledgedAt
                ? 'รับทราบแล้ว พร้อมเริ่มเมื่อเงื่อนไขของงานครบ'
                : 'เจ้าของงานรับทราบการมอบหมายก่อนเริ่มดำเนินการ'}
            </p>
            {!task.acknowledgedAt ? (
              <Button disabled={busy || !isOwner} onClick={acknowledge}>
                <CheckCheck size={16} /> รับทราบงาน
              </Button>
            ) : (
              <Button disabled={busy || !startGuard.allowed} onClick={startWork}>
                <Play size={16} /> เริ่มดำเนินการ
              </Button>
            )}
          </>
        )}
        {(task.status === 'in_progress' || task.status === 'revision') && (
          <>
            <p className="text-sm leading-6 muted">
              {task.status === 'revision'
                ? 'แก้ไขตามข้อเสนอและแนบหลักฐานรุ่นใหม่ แล้วส่งตรวจอีกครั้ง'
                : 'ตรวจผลส่งมอบและแนบหลักฐานก่อนส่งให้ผู้ตรวจพิจารณา'}
            </p>
            <Button
              disabled={busy || !submitGuard.allowed}
              title={submitGuard.reason}
              onClick={() => setSubmitOpen(true)}
            >
              <Send size={16} /> ส่งผลงานตรวจรับ
            </Button>
            {!submitGuard.allowed && isOwner && (
              <p className="text-xs text-[#9b651c]">{submitGuard.reason}</p>
            )}
          </>
        )}
        {task.status === 'submitted' && (
          <>
            <div className="inline-alert">
              <p className="text-sm font-medium">อยู่ระหว่างตรวจรับ</p>
              <p className="mt-1 text-xs leading-6">
                ชุดหลักฐานที่ส่งแล้วไม่ควรถูกแก้ไขจนกว่าจะได้รับผลตรวจ
              </p>
            </div>
            <Link href={`/reviews?task=${task.id}`} className="button button-secondary">
              <ClipboardCheck size={16} /> เปิดคิวตรวจรับ
            </Link>
          </>
        )}
        {task.status === 'accepted' && (
          <div className="inline-alert success">
            <ShieldCheck size={21} />
            <div>
              <p className="font-medium">ตรวจรับผลงานแล้ว</p>
              <p className="mt-1 text-xs">{formatThaiDate(task.acceptedAt)}</p>
            </div>
          </div>
        )}
        {task.status === 'cancelled' && (
          <p className="text-sm leading-7 muted">
            งานนี้ยุติแล้ว โดยคงประวัติไว้และไม่นับเป็นผลงานสำเร็จ
          </p>
        )}
        {!isOwner && ['assigned', 'in_progress', 'revision'].includes(task.status) && (
          <p className="text-xs leading-6 muted">
            กิจกรรมนี้ดำเนินการได้โดยเจ้าของงานที่ได้รับมอบหมายและมีสิทธิดำเนินงาน
          </p>
        )}
        {permissions.includes('change.request') &&
          !['accepted', 'cancelled'].includes(task.status) && (
            <Link href={`/changes?task=${task.id}`} className="button button-ghost justify-center">
              <CalendarClock size={16} /> ขอเปลี่ยนแปลงเงื่อนไข
            </Link>
          )}
      </div>
    </Panel>
  );
}
