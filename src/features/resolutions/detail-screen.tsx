'use client';
import { AccessLink as Link } from '@/components/app-shell';
import { Avatar, Badge, Button, EmptyState, PageHeader, ProgressBar } from '@/components/ui';
import { useWorkspace } from '@/components/workspace-context';
import { formatThaiDate } from '@/lib/workflow';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Plus } from 'lucide-react';

import type { Resolution } from '@/lib/types';
import { AssignTaskForm } from './assign-task-form';
import { ResolutionClosure } from './resolution-closure';
import { ResolutionEvidence } from './resolution-evidence';
import { ResolutionHistory } from './resolution-history';
import { ResolutionOverview } from './resolution-overview';
import { ResolutionSummary } from './resolution-summary';
import { useResolutionDetail } from './use-resolution-detail';
export function ResolutionDetail({
  id,
  initialAddTask = false,
}: {
  id: string;
  initialAddTask?: boolean;
}) {
  const { state, ready } = useWorkspace();
  const resolution = state.resolutions.find((item) => item.id === id);
  if (!ready && !resolution) return <div className="skeleton h-96" />;
  if (!resolution)
    return (
      <EmptyState
        icon={ClipboardList}
        title="ไม่พบมตินี้"
        description="รายการอาจไม่มีอยู่หรืออยู่นอกสิทธิของคุณ ลองเปิดจากทะเบียนมติอีกครั้ง"
      >
        <Link href="/resolutions" className="button button-primary">
          ไปทะเบียนมติ
        </Link>
      </EmptyState>
    );
  return (
    <ResolutionDetailView
      key={id + ':' + initialAddTask}
      resolution={resolution}
      initialAddTask={initialAddTask}
    />
  );
}
export function ResolutionDetailView({
  resolution,
  initialAddTask,
}: {
  resolution: Resolution;
  initialAddTask: boolean;
}) {
  const model = useResolutionDetail(resolution, initialAddTask);
  const {
    meeting,
    canManage,
    busy,
    setTab,
    setAddingTask,
    taskSummaryAvailable,
    tasks,
    taskDetailsAvailable,
    evidence,
    tab,
    addingTask,
    users,
  } = model;
  return (
    <div className="page-stack">
      <Link href="/resolutions" className="back-link">
        <ArrowLeft size={15} />
        ทะเบียนมติ
      </Link>
      <PageHeader
        title={resolution.title}
        description={`${resolution.code} · วาระ ${resolution.agenda} · ${meeting?.title ?? 'การประชุม'} ครั้งที่ ${meeting?.number ?? '—'}`}
      >
        <Badge status={resolution.status} />
        {canManage && resolution.status !== 'closed' && resolution.type !== 'acknowledgment' && (
          <Button
            disabled={busy}
            onClick={() => {
              setTab('tasks');
              setAddingTask((value) => !value);
            }}
          >
            <Plus size={16} />
            มอบหมายงาน
          </Button>
        )}
      </PageHeader>
      <div className="detail-grid">
        <div className="stack">
          <section className="panel">
            <div className="detail-tabs tabs">
              {[
                { id: 'overview', name: 'รายละเอียดมติ' },
                {
                  id: 'tasks',
                  name: taskSummaryAvailable
                    ? `งานที่เกี่ยวข้อง (${tasks.length})`
                    : 'งานที่เกี่ยวข้อง',
                },
                {
                  id: 'evidence',
                  name: taskDetailsAvailable ? `หลักฐาน (${evidence.length})` : 'หลักฐาน',
                },
                { id: 'history', name: 'ประวัติ' },
              ].map((item) => (
                <button
                  key={item.id}
                  className={clsx('tab', tab === item.id && 'active')}
                  onClick={() => setTab(item.id)}
                  aria-pressed={tab === item.id}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div className="panel-body">
              <ResolutionOverview model={model} />
              {tab === 'tasks' && (
                <div className="stack">
                  {addingTask && canManage && <AssignTaskForm model={model} />}
                  {tasks.length ? (
                    <div className="resolution-task-list">
                      {tasks.map((task) => (
                        <Link href={`/tasks/${task.id}`} key={task.id} className="resolution-task">
                          <span
                            className={clsx(
                              'task-state-icon',
                              task.status === 'accepted' && 'complete',
                            )}
                          >
                            {task.status === 'accepted' ? (
                              <Check size={18} />
                            ) : (
                              <ClipboardList size={18} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="cluster">
                              <span className="text-tiny muted">{task.code}</span>
                              {task.required && <span className="text-tiny muted">งานจำเป็น</span>}
                            </div>
                            <strong>{task.title}</strong>
                            <div className="cluster mt-2">
                              <Avatar userId={task.ownerId} size="sm" />
                              <span className="muted text-tiny">
                                {users.find((user) => user.id === task.ownerId)?.name.split(' ')[0]}
                              </span>
                              <span className="muted text-tiny">
                                ส่ง {formatThaiDate(task.dueDate)}
                              </span>
                            </div>
                          </div>
                          <div className="task-list-end">
                            <Badge status={task.status} />
                            <ProgressBar value={task.progress} />
                          </div>
                          <ArrowRight size={16} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    !addingTask && (
                      <EmptyState
                        icon={ClipboardList}
                        title={
                          !taskSummaryAvailable
                            ? 'ยังไม่มีสิทธิอ่านรายการงาน'
                            : resolution.type === 'acknowledgment'
                              ? 'มติรับทราบ ไม่มีงานติดตาม'
                              : 'ยังไม่มีงานตามมตินี้'
                        }
                        description={
                          taskSummaryAvailable
                            ? 'เมื่อกำหนดงาน เจ้าของ และเกณฑ์ตรวจแล้ว จะติดตามความก้าวหน้าได้จากที่นี่'
                            : 'โปรดให้ Admin เปิดหน้ารายการงานหรือหน้าภาพรวม เพื่อดูงานที่เกี่ยวข้อง'
                        }
                      >
                        {canManage && resolution.type !== 'acknowledgment' && (
                          <Button disabled={busy} onClick={() => setAddingTask(true)}>
                            <Plus size={16} />
                            เพิ่มงานแรก
                          </Button>
                        )}
                      </EmptyState>
                    )
                  )}
                </div>
              )}
              <ResolutionEvidence model={model} />
              <ResolutionHistory model={model} />
            </div>
          </section>
          <ResolutionClosure model={model} />
        </div>
        <ResolutionSummary model={model} />
      </div>
    </div>
  );
}
