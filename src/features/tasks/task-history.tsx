'use client';
import { Panel } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import { History } from 'lucide-react';

import type { TaskDetailModel } from './use-task-detail';
export function TaskHistory({ model }: { model: Pick<TaskDetailModel, 'audit' | 'users'> }) {
  const { audit, users } = model;
  return (
    <Panel title="ประวัติการดำเนินการ" action={<History size={17} className="text-[#64757a]" />}>
      <div className="stack-sm">
        {audit.length ? (
          <ol className="space-y-5">
            {audit.slice(0, 8).map((event) => (
              <li key={event.id}>
                <p className="text-sm font-medium">{event.action}</p>
                <p className="mt-1 text-xs leading-6 muted">{event.detail}</p>
                <p className="mt-1 text-[11px] muted">
                  {formatThaiDate(event.createdAt)} ·{' '}
                  {users.find((person) => person.id === event.actorId)?.name.split(' ')[0] ??
                    'ระบบ'}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm muted">การรับทราบ รายงาน และผลตรวจครั้งถัดไปจะแสดงในส่วนนี้</p>
        )}
      </div>
    </Panel>
  );
}
