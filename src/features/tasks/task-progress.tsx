'use client';
import { Avatar, Button, Field, Panel, ProgressBar } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';

import type { TaskDetailModel } from './use-task-detail';
export function TaskProgress({
  model,
}: {
  model: Pick<
    TaskDetailModel,
    | 'isEditable'
    | 'busy'
    | 'setShowProgressForm'
    | 'showProgressForm'
    | 'task'
    | 'saveProgress'
    | 'progressValue'
    | 'setProgressValue'
    | 'progressNote'
    | 'setProgressNote'
    | 'users'
  >;
}) {
  const {
    isEditable,
    busy,
    setShowProgressForm,
    showProgressForm,
    task,
    saveProgress,
    progressValue,
    setProgressValue,
    progressNote,
    setProgressNote,
    users,
  } = model;
  return (
    <Panel
      title="ความก้าวหน้า"
      action={
        isEditable && (
          <Button
            disabled={busy}
            variant="secondary"
            size="sm"
            onClick={() => setShowProgressForm(!showProgressForm)}
          >
            {showProgressForm ? 'ปิดแบบรายงาน' : 'รายงานความก้าวหน้า'}
          </Button>
        )
      }
    >
      <div className="stack-sm">
        <ProgressBar value={task.progress} />
        <p className="text-xs muted">
          ความก้าวหน้าเป็นข้อมูลรายงาน การตรวจรับต้องพิจารณาผลงานและหลักฐานแยกกัน
        </p>
        {showProgressForm && isEditable && (
          <form onSubmit={saveProgress} className="mt-3 space-y-4 border-t border-[#e0e7e5] pt-5">
            <Field label="ความก้าวหน้า (%)" htmlFor="task-progress">
              <div className="flex items-center gap-4">
                <input
                  className="w-full accent-[#b87120]"
                  id="task-progress"
                  type="range"
                  min="0"
                  max="100"
                  value={progressValue ?? task.progress}
                  onChange={(event) => setProgressValue(Number(event.target.value))}
                />
                <input
                  className="input w-20 text-center"
                  aria-label="ระบุร้อยละความก้าวหน้า"
                  type="number"
                  min="0"
                  max="100"
                  value={progressValue ?? task.progress}
                  onChange={(event) => setProgressValue(Number(event.target.value))}
                />
              </div>
            </Field>
            <Field label="สิ่งที่ดำเนินการแล้วและขั้นตอนถัดไป" htmlFor="progress-note" required>
              <textarea
                id="progress-note"
                className="textarea"
                rows={4}
                required
                value={progressNote}
                onChange={(event) => setProgressNote(event.target.value)}
                placeholder="ระบุผลที่เกิดขึ้น สิ่งที่ต้องทำต่อ และอุปสรรคหรือความช่วยเหลือที่ต้องการ"
              />
            </Field>
            <div className="form-actions">
              <Button
                disabled={busy}
                variant="secondary"
                type="button"
                onClick={() => setShowProgressForm(false)}
              >
                ยกเลิก
              </Button>
              <Button disabled={busy} type="submit">
                บันทึกรายงาน
              </Button>
            </div>
          </form>
        )}
        {task.updates.length > 0 && (
          <div className="mt-4 space-y-4 border-t border-[#e0e7e5] pt-5">
            {[...task.updates].reverse().map((update) => (
              <div key={update.id} className="flex gap-3">
                <Avatar userId={update.authorId} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="font-medium">
                      {users.find((person) => person.id === update.authorId)?.name ?? 'ผู้รายงาน'}
                    </span>
                    <span className="muted">
                      {formatThaiDate(update.createdAt)} · {update.progress}%
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-[#42585e]">
                    {update.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
