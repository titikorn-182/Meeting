'use client';
import { Button, Field, Panel } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import { ExternalLink, FileCheck2, FileUp, Link2, X } from 'lucide-react';

import type { TaskDetailModel } from './use-task-detail';
export function TaskEvidence({
  model,
}: {
  model: Pick<
    TaskDetailModel,
    | 'task'
    | 'isEditable'
    | 'busy'
    | 'setShowLinkForm'
    | 'showLinkForm'
    | 'mode'
    | 'fileInput'
    | 'addFiles'
    | 'setPreviewId'
    | 'previewId'
    | 'preview'
    | 'saveLink'
    | 'linkTitle'
    | 'setLinkTitle'
    | 'linkUrl'
    | 'setLinkUrl'
  >;
}) {
  const {
    task,
    isEditable,
    busy,
    setShowLinkForm,
    showLinkForm,
    mode,
    fileInput,
    addFiles,
    setPreviewId,
    previewId,
    preview,
    saveLink,
    linkTitle,
    setLinkTitle,
    linkUrl,
    setLinkUrl,
  } = model;
  return (
    <Panel
      title="ผลงานและหลักฐาน"
      description={`${task.evidence.length} รายการ · เพิ่มรุ่นใหม่ได้โดยไม่ทับหลักฐานเดิม`}
      action={
        isEditable && (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              variant="ghost"
              size="sm"
              onClick={() => setShowLinkForm(!showLinkForm)}
            >
              <Link2 size={15} /> เพิ่มลิงก์
            </Button>
            <Button
              disabled={busy || mode === 'supabase'}
              variant="secondary"
              size="sm"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp size={16} /> เพิ่มไฟล์
            </Button>
            <input
              ref={fileInput}
              className="hidden"
              type="file"
              disabled={mode === 'supabase' || busy}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt"
              aria-label="เลือกไฟล์หลักฐาน"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
        )
      }
    >
      <div className="stack-sm">
        {mode === 'supabase' && (
          <p className="inline-alert text-sm">
            เพิ่มลิงก์เอกสารได้ในรอบนี้
            การอัปโหลดไฟล์จะเปิดเมื่อระบบตรวจไฟล์และพื้นที่จัดเก็บพร้อมใช้งาน
          </p>
        )}
        {task.evidence.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-[#ccd8d5] px-5 py-7 text-sm muted">
            <FileUp size={24} className="shrink-0" />
            <div>
              <p className="font-medium text-[#42585e]">ยังไม่มีหลักฐานประกอบ</p>
              <p className="mt-1">แนบผลส่งมอบให้ครบก่อนส่งตรวจ</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#e0e7e5]">
            {task.evidence.map((evidence) => (
              <div key={evidence.id} className="flex items-center gap-3 py-3 first:pt-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f3] text-[#50696c]">
                  {evidence.kind === 'link' ? <Link2 size={19} /> : <FileCheck2 size={19} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{evidence.name}</p>
                  <p className="mt-0.5 text-xs muted">
                    {evidence.size} · {formatThaiDate(evidence.uploadedAt)}
                    {!evidence.url &&
                      (mode === 'demo' ? ' · ข้อมูลตัวอย่าง' : ' · ยังเปิดเนื้อหาไม่ได้')}
                  </p>
                </div>
                {evidence.url ? (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button button-ghost"
                    aria-label={`เปิดหลักฐาน ${evidence.name}`}
                  >
                    <ExternalLink size={16} />
                  </a>
                ) : (
                  <Button
                    disabled={busy}
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewId(previewId === evidence.id ? null : evidence.id)}
                  >
                    รายละเอียด
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {preview && (
          <div className="inline-alert flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{preview.name}</p>
              <p className="mt-1 text-xs leading-6">
                รายการนี้มีเฉพาะรายละเอียดหลักฐาน ยังไม่มีเนื้อหาไฟล์ที่พร้อมเปิด
                โปรดติดต่อเจ้าของงานเพื่อตรวจสอบเอกสารต้นทาง
              </p>
            </div>
            <button onClick={() => setPreviewId(null)} aria-label="ปิดรายละเอียดหลักฐาน">
              <X size={16} />
            </button>
          </div>
        )}
        {showLinkForm && isEditable && (
          <form onSubmit={saveLink} className="space-y-4 rounded-lg bg-[#f5f7f6] p-4">
            <Field label="ชื่อหลักฐาน" htmlFor="evidence-title">
              <input
                id="evidence-title"
                className="input"
                value={linkTitle}
                onChange={(event) => setLinkTitle(event.target.value)}
                placeholder="เช่น ร่างแผนพัฒนาบุคลากร รุ่นที่ 2"
              />
            </Field>
            <Field label="ลิงก์หลักฐาน" htmlFor="evidence-url" required>
              <input
                id="evidence-url"
                className="input"
                type="url"
                required
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://..."
              />
            </Field>
            <p className="text-xs muted">
              เนื้อหาปลายทางอาจเปลี่ยนได้ โปรดระบุชื่อรุ่นและวันที่ของเอกสารที่ใช้ส่งตรวจ
            </p>
            <div className="form-actions">
              <Button
                disabled={busy}
                variant="secondary"
                type="button"
                onClick={() => setShowLinkForm(false)}
              >
                ยกเลิก
              </Button>
              <Button disabled={busy} type="submit">
                เพิ่มหลักฐาน
              </Button>
            </div>
          </form>
        )}
        {mode === 'demo' && (
          <p className="text-xs leading-6 muted">
            ไฟล์ที่เลือกใช้ทดลองเฉพาะในเบราว์เซอร์ ขนาดไม่เกิน 20 MB ต่อไฟล์
            ลิงก์ไฟล์ชั่วคราวใช้ได้ในรอบที่เปิดหน้านี้ และไม่มีการอัปโหลดไปยังเซิร์ฟเวอร์
          </p>
        )}
      </div>
    </Panel>
  );
}
