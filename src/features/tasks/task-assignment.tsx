'use client';
import { Avatar, Panel } from '@/components/ui';
import { daysUntil, formatThaiDate } from '@/lib/workflow';

import type { TaskDetailModel } from './use-task-detail';
export function TaskAssignment({
  model,
}: {
  model: Pick<TaskDetailModel, 'task' | 'owner' | 'reviewer' | 'overdue' | 'today' | 'mode'>;
}) {
  const { task, owner, reviewer, overdue, today, mode } = model;
  return (
    <Panel title="ข้อมูลการมอบหมาย">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs muted">ผู้รับผิดชอบหลัก</p>
          <div className="flex items-center gap-3">
            <Avatar userId={task.ownerId} />
            <div>
              <p className="text-sm font-medium">{owner?.name}</p>
              <p className="mt-0.5 text-xs muted">{task.unit}</p>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs muted">ผู้ตรวจรับ</p>
          <div className="flex items-center gap-3">
            <Avatar userId={task.reviewerId} />
            <p className="text-sm">{reviewer?.name ?? 'ผู้ตรวจที่ได้รับมอบหมาย'}</p>
          </div>
        </div>
        <dl className="space-y-4 border-t border-[#e0e7e5] pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="muted">กำหนดปัจจุบัน</dt>
            <dd className={`text-right font-medium ${overdue ? 'text-[#a83e32]' : ''}`}>
              {formatThaiDate(task.dueDate)}
              {overdue && (
                <span className="mt-1 block text-xs">
                  เกิน {Math.abs(daysUntil(task.dueDate, today) ?? 0)} วัน
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="muted">กำหนดเดิม</dt>
            <dd className="text-right">{formatThaiDate(task.originalDueDate)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="muted">รับทราบเมื่อ</dt>
            <dd className="text-right">
              {task.acknowledgedAt ? formatThaiDate(task.acknowledgedAt) : 'ยังไม่รับทราบ'}
            </dd>
          </div>
          {task.submittedAt && (
            <div className="flex justify-between gap-4">
              <dt className="muted">ส่งตรวจเมื่อ</dt>
              <dd className="text-right">{formatThaiDate(task.submittedAt)}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs muted">
          {mode === 'demo' ? 'วันอ้างอิงข้อมูลจำลอง' : 'วันที่ปัจจุบัน'}: {formatThaiDate(today)}
        </p>
      </div>
    </Panel>
  );
}
