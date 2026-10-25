'use client';
import { Avatar, Badge, Button, Panel, ProgressBar } from '@/components/ui';
import { formatThaiDate, getResolutionProgress } from '@/lib/workflow';
import { ShieldCheck } from 'lucide-react';

import type { ResolutionDetailModel } from './use-resolution-detail';
export function ResolutionSummary({
  model,
}: {
  model: Pick<
    ResolutionDetailModel,
    | 'mode'
    | 'resolution'
    | 'permissions'
    | 'busy'
    | 'id'
    | 'taskSummaryAvailable'
    | 'state'
    | 'tasks'
    | 'users'
    | 'authorizeExecution'
  >;
}) {
  const {
    mode,
    resolution,
    permissions,
    busy,
    id,
    taskSummaryAvailable,
    state,
    tasks,
    users,
    authorizeExecution,
  } = model;
  return (
    <aside className="stack">
      {mode === 'supabase' && resolution.type !== 'acknowledgment' && (
        <Panel title="การอนุญาตเริ่มดำเนินงาน">
          <div className="stack-sm">
            <Badge tone={resolution.executionAuthorized ? 'success' : 'warning'}>
              {resolution.executionAuthorized ? 'อนุญาตเริ่มแล้ว' : 'รอผู้มีอำนาจอนุญาต'}
            </Badge>
            <p className="text-small muted">การบันทึกมติแยกจากการอนุญาตให้เริ่มดำเนินงาน</p>
            {!resolution.executionAuthorized && permissions.includes('execution.authorize') && (
              <Button disabled={busy} onClick={authorizeExecution}>
                <ShieldCheck size={16} />
                อนุญาตเริ่มดำเนินงาน
              </Button>
            )}
          </div>
        </Panel>
      )}
      <Panel title="ภาพรวมของมติ">
        <div className="resolution-progress-number">
          <strong>
            {taskSummaryAvailable ? getResolutionProgress(id, state.tasks) : '—'}
            {taskSummaryAvailable && <small>%</small>}
          </strong>
          <span>ความก้าวหน้าที่รายงาน</span>
        </div>
        {taskSummaryAvailable && <ProgressBar value={getResolutionProgress(id, state.tasks)} />}
        <div className="detail-divider my-5" />
        <dl className="detail-list">
          <div>
            <dt>งานทั้งหมด</dt>
            <dd>{taskSummaryAvailable ? `${tasks.length} งาน` : 'ยังไม่อยู่ในสิทธิที่ได้รับ'}</dd>
          </div>
          <div>
            <dt>ตรวจรับแล้ว</dt>
            <dd>
              {taskSummaryAvailable
                ? `${tasks.filter((task) => task.status === 'accepted').length} งาน`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>ประเภทมติ</dt>
            <dd>
              <Badge status={resolution.type} />
            </dd>
          </div>
          <div>
            <dt>กำหนดติดตาม</dt>
            <dd>{formatThaiDate(resolution.dueDate)}</dd>
          </div>
          <div>
            <dt>บันทึกเมื่อ</dt>
            <dd>{formatThaiDate(resolution.createdAt)}</dd>
          </div>
        </dl>
        <p className="field-hint mt-5">ความก้าวหน้า 100% ไม่เท่ากับผ่านตรวจหรือปิดมติ</p>
      </Panel>
      <Panel title="ผู้ประสานหลัก">
        <div className="cluster flex-nowrap">
          <Avatar userId={resolution.coordinatorId} />
          <div>
            <strong className="text-small">
              {users.find((user) => user.id === resolution.coordinatorId)?.name}
            </strong>
            <p className="text-tiny muted">{resolution.unit}</p>
          </div>
        </div>
      </Panel>
    </aside>
  );
}
