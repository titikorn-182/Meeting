'use client';
import { useWorkspace } from '@/components/workspace-context';
import type { Evidence } from '@/lib/types';
import { createId, isOverdue, validateTaskTransition } from '@/lib/workflow';
import { useRef, useState } from 'react';

import type { Task } from '@/lib/types';
export function useTaskDetail(task: Task) {
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
  } = useWorkspace();
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
  async function acknowledge() {
    await acknowledgeTask(task.id);
  }
  async function startWork() {
    await transitionTask(task.id, 'in_progress');
  }
  async function submitWork() {
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
  }
  return {
    submitWork,
    acknowledge,
    startWork,
    task,
    resolution,
    isEditable,
    busy,
    setShowProgressForm,
    showProgressForm,
    saveProgress,
    progressValue,
    setProgressValue,
    progressNote,
    setProgressNote,
    users,
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
    isOwner,
    startGuard,
    submitGuard,
    setSubmitOpen,
    permissions,
    owner,
    reviewer,
    overdue,
    today,
    audit,
    submitOpen,
    submissionNote,
    setSubmissionNote,
  };
}
export type TaskDetailModel = ReturnType<typeof useTaskDetail>;
