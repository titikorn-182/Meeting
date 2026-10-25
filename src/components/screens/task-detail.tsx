'use client';

import { AccessLink as Link } from '@/components/app-shell';
import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCheck,
  ClipboardCheck,
  ExternalLink,
  File,
  FileCheck2,
  FileUp,
  History,
  Link2,
  Play,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  ProgressBar,
} from '@/components/ui';
import {
  createId,
  daysUntil,
  formatThaiDate,
  isOverdue,
  validateTaskTransition,
} from '@/lib/workflow';
import type { Evidence } from '@/lib/types';
import { taskStatusLabels } from './tasks';

export function TaskDetailScreen({ id }: { id: string }) {
  const {
    state,
    acknowledgeTask,
    transitionTask,
    updateProgress,
    addEvidence,
    notify,
    mode,
    permissions,
    users,
    today,
    busy,
  } = useDemo();
  const task = state.tasks.find((item) => item.id === id);
  const [progressValue, setProgressValue] = useState<number | null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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

  const resolution = state.resolutions.find((item) => item.id === task.resolutionId);
  const owner = users.find((item) => item.id === task.ownerId);
  const reviewer = users.find((item) => item.id === task.reviewerId);
  const isOwner = permissions.includes('task.work') && state.currentUserId === task.ownerId;
  const isEditable = isOwner && (task.status === 'in_progress' || task.status === 'revision');
  const overdue = isOverdue(task, today);
  const submitGuard =
    mode === 'supabase'
      ? {
          allowed:
            isOwner &&
            ['in_progress', 'revision'].includes(task.status) &&
            task.evidence.length > 0 &&
            resolution?.executionAuthorized === true,
          reason: 'ตรวจการรับทราบ การอนุญาตเริ่ม และหลักฐานให้ครบก่อนดำเนินการ',
        }
      : isOwner
        ? validateTaskTransition(task, 'submitted', { role: 'owner', userId: state.currentUserId })
        : { allowed: false, reason: 'เฉพาะเจ้าของงานที่มีสิทธิดำเนินงานเท่านั้น' };
  const startGuard =
    mode === 'supabase'
      ? {
          allowed:
            isOwner && Boolean(task.acknowledgedAt) && resolution?.executionAuthorized === true,
          reason: 'ตรวจการรับทราบ การอนุญาตเริ่ม และหลักฐานให้ครบก่อนดำเนินการ',
        }
      : isOwner
        ? validateTaskTransition(task, 'in_progress', {
            role: 'owner',
            userId: state.currentUserId,
          })
        : { allowed: false, reason: 'เฉพาะเจ้าของงานที่มีสิทธิดำเนินงานเท่านั้น' };
  const audit = state.audit.filter((event) => event.targetId === task.id);
  const preview = task.evidence.find((item) => item.id === previewId);

  async function addFiles(files: FileList | null) {
    if (!task || !files || busy || mode === 'supabase') return;
    if (task.evidence.length + files.length > 20) {
      notify('เพิ่มหลักฐานได้ไม่เกิน 20 รายการต่อชุด กรุณาเลือกไฟล์ให้น้อยลง', 'error');
      return;
    }
    for (const file of Array.from(files)) {
      if (!/\.(pdf|docx?|xlsx?|csv|png|jpe?g|txt)$/i.test(file.name)) {
        notify(`ยังไม่รองรับชนิดไฟล์ ${file.name}`, 'error');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        notify(`ไฟล์ ${file.name} มีขนาดเกิน 20 MB กรุณาเลือกไฟล์ที่เล็กลง`, 'error');
        return;
      }
      const url = URL.createObjectURL(file);
      const evidence: Evidence = {
        id: createId('evidence'),
        name: file.name,
        size:
          file.size < 1024 * 1024
            ? `${Math.max(1, Math.round(file.size / 1024))} KB`
            : `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        kind: 'file',
        url,
        uploadedAt: new Date().toISOString(),
      };
      if (!(await addEvidence(task.id, evidence))) URL.revokeObjectURL(url);
      else notify(`เพิ่ม ${file.name} ในชุดหลักฐานแล้ว`);
    }
  }

  async function saveLink(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!task) return;
    try {
      const url = new URL(linkUrl);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('invalid');
      if (
        await addEvidence(task.id, {
          id: createId('evidence'),
          name: linkTitle.trim() || url.hostname,
          size: 'ลิงก์ภายนอก',
          kind: 'link',
          url: url.href,
          uploadedAt: new Date().toISOString(),
        })
      ) {
        setLinkTitle('');
        setLinkUrl('');
        setShowLinkForm(false);
        notify('เพิ่มลิงก์หลักฐานแล้ว');
      }
    } catch {
      notify('ลิงก์ไม่ถูกต้อง กรุณาใช้ URL ที่ขึ้นต้นด้วย https:// หรือ http://', 'error');
    }
  }

  async function saveProgress(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!task) return;
    if (await updateProgress(task.id, progressValue ?? task.progress, progressNote.trim())) {
      setProgressNote('');
      setProgressValue(null);
      setShowProgressForm(false);
    }
  }

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
          <Panel
            title="ผลส่งมอบและเกณฑ์ตรวจรับ"
            description="ใช้เกณฑ์เดียวกันตั้งแต่มอบหมายจนถึงตรวจรับ"
          >
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
                <form
                  onSubmit={saveProgress}
                  className="mt-3 space-y-4 border-t border-[#e0e7e5] pt-5"
                >
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
                  <Field
                    label="สิ่งที่ดำเนินการแล้วและขั้นตอนถัดไป"
                    htmlFor="progress-note"
                    required
                  >
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
                            {users.find((person) => person.id === update.authorId)?.name ??
                              'ผู้รายงาน'}
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
                          onClick={() =>
                            setPreviewId(previewId === evidence.id ? null : evidence.id)
                          }
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
        </div>

        <aside className="stack">
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
                    <Button
                      disabled={busy || !isOwner}
                      onClick={async () => {
                        await acknowledgeTask(task.id);
                      }}
                    >
                      <CheckCheck size={16} /> รับทราบงาน
                    </Button>
                  ) : (
                    <Button
                      disabled={busy || !startGuard.allowed}
                      onClick={async () => {
                        await transitionTask(task.id, 'in_progress');
                      }}
                    >
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
                  <Link
                    href={`/changes?task=${task.id}`}
                    className="button button-ghost justify-center"
                  >
                    <CalendarClock size={16} /> ขอเปลี่ยนแปลงเงื่อนไข
                  </Link>
                )}
            </div>
          </Panel>

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
                {mode === 'demo' ? 'วันอ้างอิงข้อมูลจำลอง' : 'วันที่ปัจจุบัน'}:{' '}
                {formatThaiDate(today)}
              </p>
            </div>
          </Panel>

          <Panel
            title="ประวัติการดำเนินการ"
            action={<History size={17} className="text-[#64757a]" />}
          >
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
                <p className="text-sm muted">
                  การรับทราบ รายงาน และผลตรวจครั้งถัดไปจะแสดงในส่วนนี้
                </p>
              )}
            </div>
          </Panel>
        </aside>
      </div>

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
            <Button
              disabled={busy}
              onClick={async () => {
                if (
                  await transitionTask(
                    task.id,
                    'submitted',
                    submissionNote.trim() || 'ส่งผลงานและหลักฐานให้ตรวจรับ',
                  )
                ) {
                  setSubmitOpen(false);
                  setSubmissionNote('');
                }
              }}
            >
              <Send size={16} /> ยืนยันส่งตรวจ
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
