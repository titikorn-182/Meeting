'use client';
import { Panel } from '@/components/ui';
import { Check } from 'lucide-react';

import type { TaskDetailModel } from './use-task-detail';
export function TaskRequirements({ model }: { model: Pick<TaskDetailModel, 'task'> }) {
  const { task } = model;
  return (
    <Panel title="ผลส่งมอบและเกณฑ์ตรวจรับ" description="ใช้เกณฑ์เดียวกันตั้งแต่มอบหมายจนถึงตรวจรับ">
      <div className="stack-sm">
        <p className="leading-7 text-[#42585e]">{task.description}</p>
        <div className="rounded-lg bg-[#f4f7f6] p-4">
          <p className="mb-1 text-xs font-medium muted">ผลที่ต้องส่งมอบ</p>
          <p className="text-sm leading-7">{task.deliverable}</p>
        </div>
        <ul className="space-y-3 py-2">
          {task.criteria.map((criterion, index) => (
            <li key={criterion} className="flex items-start gap-3 text-sm leading-6">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${task.status === 'accepted' ? 'bg-[#e4f1eb] text-[#35785e]' : 'bg-[#edf1f0] text-[#61777a]'}`}
              >
                {task.status === 'accepted' ? (
                  <Check size={12} />
                ) : (
                  <span className="text-[10px]">{index + 1}</span>
                )}
              </span>
              {criterion}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
