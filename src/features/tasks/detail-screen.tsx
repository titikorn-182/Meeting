'use client';
import { AccessLink as Link } from '@/components/app-shell';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { useWorkspace } from '@/components/workspace-context';
import { taskStatusLabels } from '@/features/tasks/task-status';
import { ArrowLeft, ArrowRight, ClipboardCheck, File } from 'lucide-react';

import type { Task } from '@/lib/types';
import { SubmitTaskDialog } from './submit-task-dialog';
import { TaskActions } from './task-actions';
import { TaskAssignment } from './task-assignment';
import { TaskEvidence } from './task-evidence';
import { TaskHistory } from './task-history';
import { TaskProgress } from './task-progress';
import { TaskRequirements } from './task-requirements';
import { useTaskDetail } from './use-task-detail';
export function TaskDetailScreen({ id }: { id: string }) {
  const { state } = useWorkspace();
  const task = state.tasks.find((item) => item.id === id);
  if (!task)
    return (
      <EmptyState
        icon={File}
        title="ไม่พบงานที่ต้องการ"
        description="รายการอาจไม่มีอยู่หรืออยู่นอกสิทธิของคุณ ลองเลือกงานจากทะเบียนอีกครั้ง"
      >
        <Link className="button button-primary" href="/tasks">
          กลับไปงานตามมติ
        </Link>
      </EmptyState>
    );
  return <TaskDetailScreenView key={id} task={task} />;
}
export function TaskDetailScreenView({ task }: { task: Task }) {
  const model = useTaskDetail(task);
  const { resolution } = model;
  return (
    <div className="page-stack">
      <Link
        href="/tasks"
        className="inline-flex w-fit items-center gap-2 text-sm muted hover:underline"
      >
        <ArrowLeft size={16} /> งานตามมติ
      </Link>
      <PageHeader title={task.title} description={`${task.code} · ${task.unit}`}>
        <Badge status={task.status}>{taskStatusLabels[task.status]}</Badge>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e7e5] bg-white px-5 py-4">
        <Link
          href={`/resolutions/${task.resolutionId}`}
          className="flex min-w-0 items-center gap-2 text-sm hover:underline"
        >
          <ClipboardCheck size={17} className="shrink-0 text-[#64757a]" />
          <span>
            {resolution?.code} · {resolution?.title ?? 'มติที่เกี่ยวข้อง'}
          </span>
          <ArrowRight size={15} className="shrink-0" />
        </Link>
        <span className="text-xs muted">
          {task.required ? 'งานจำเป็นต่อการปิดมติ' : 'งานประกอบ ไม่บังคับต่อการปิดมติ'}
        </span>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <TaskRequirements model={model} />

          <TaskProgress model={model} />

          <TaskEvidence model={model} />
        </div>

        <aside className="stack">
          <TaskActions model={model} />

          <TaskAssignment model={model} />

          <TaskHistory model={model} />
        </aside>
      </div>

      <SubmitTaskDialog model={model} />
    </div>
  );
}
