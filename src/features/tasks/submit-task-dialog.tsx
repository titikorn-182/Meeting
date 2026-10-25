'use client';
import { Button, Dialog, Field } from '@/components/ui';
import { Send } from 'lucide-react';

import type { TaskDetailModel } from './use-task-detail';
export function SubmitTaskDialog({
  model,
}: {
  model: Pick<
    TaskDetailModel,
    | 'submitOpen'
    | 'setSubmitOpen'
    | 'task'
    | 'submissionNote'
    | 'setSubmissionNote'
    | 'busy'
    | 'submitWork'
  >;
}) {
  const { submitOpen, setSubmitOpen, task, submissionNote, setSubmissionNote, busy, submitWork } =
    model;
  return (
    <Dialog
      open={submitOpen}
      onClose={() => setSubmitOpen(false)}
      title="ส่งผลงานให้ตรวจรับ"
      description="ตรวจชุดหลักฐานให้ครบก่อนส่ง ผู้ตรวจจะพิจารณาตามเกณฑ์ของงานนี้"
    >
      <div className="space-y-5">
        <div className="rounded-lg bg-[#f5f7f6] p-4">
          <p className="font-medium">{task.title}</p>
          <p className="mt-2 text-sm muted">
            {task.evidence.length} หลักฐาน · {task.criteria.length} เกณฑ์ตรวจรับ
          </p>
        </div>
        <Field label="สรุปผลส่งมอบ" htmlFor="submission-note">
          <textarea
            id="submission-note"
            className="textarea"
            rows={3}
            value={submissionNote}
            onChange={(event) => setSubmissionNote(event.target.value)}
            placeholder="ระบุสิ่งที่ส่งมอบหรือหมายเหตุถึงผู้ตรวจ"
          />
        </Field>
        <div className="form-actions">
          <Button disabled={busy} variant="secondary" onClick={() => setSubmitOpen(false)}>
            กลับไปตรวจข้อมูล
          </Button>
          <Button disabled={busy} onClick={submitWork}>
            <Send size={16} /> ยืนยันส่งตรวจ
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
