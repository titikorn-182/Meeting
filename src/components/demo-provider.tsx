"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { initialState, users, DEMO_TODAY } from "@/lib/mock-data";
import { approveDeadlineChange, canCloseResolution, createId, daysUntil, getRoleUserId, nextDisplayCode, reconcileResolutionStatus, validateTaskTransition } from "@/lib/workflow";
import type { ChangeRequest, DemoSettings, DemoState, Evidence, Meeting, Resolution, Role, Task, TaskStatus, User } from "@/lib/types";

import { WorkspaceContext as DemoContext, useWorkspace, type WorkspaceContextValue, type ToastTone } from './workspace-context';
import { getDataConfiguration } from '@/lib/supabase/config';
import { SupabaseWorkspaceProvider } from './supabase-workspace-provider';
const STORAGE_KEY = "polubu-ui-demo-v1";
const units = [...new Set(users.map(user => user.unit))];
const copyInitial = () => structuredClone(initialState);

function audit(state: DemoState, action: string, targetId: string, targetLabel: string, detail: string): DemoState {
  return { ...state, audit: [{ id: createId("audit"), action, actorId: state.currentUserId, createdAt: new Date().toISOString(), targetId, targetLabel, detail }, ...state.audit] };
}

/** Select the adapter explicitly. A connected failure never mounts the demo adapter. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const configuration = getDataConfiguration();
  return configuration.mode === 'supabase'
    ? <SupabaseWorkspaceProvider>{children}</SupabaseWorkspaceProvider>
    : <LocalDemoProvider>{children}</LocalDemoProvider>;
}

function LocalDemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(copyInitial);
  const current = useRef(state);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastTone }[]>([]);
  const storageWarning = useRef(false);
  const notify = useCallback((message: string, type: ToastTone = "success") => {
    const id = createId("toast");
    setToasts((items) => [...items.slice(-2), { id, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { version?: number; state?: DemoState };
        if (parsed.version === 1 && parsed.state && ["resolutions", "tasks", "meetings", "changes", "notifications", "audit"].every((key) => Array.isArray(parsed.state?.[key as keyof DemoState])) && users.some((user) => user.id === parsed.state?.currentUserId) && parsed.state.settings) {
          current.current = parsed.state;
          setState(parsed.state);
        }
      }
    } catch { storageWarning.current = true; }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      // Object URLs belong to this tab only. Keep their metadata, not an unusable URL, across reloads.
      const persisted = { ...state, tasks: state.tasks.map((task) => ({ ...task, evidence: task.evidence.map((evidence) => ({ ...evidence, url: evidence.url?.startsWith("blob:") ? undefined : evidence.url })) })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state: persisted }));
    } catch {
      if (!storageWarning.current) notify("พื้นที่บันทึกในเบราว์เซอร์ไม่พร้อมใช้งาน ข้อมูลรอบนี้จะอยู่จนกว่าจะปิดหน้า", "info");
      storageWarning.current = true;
    }
  }, [state, ready, notify]);

  function commit(update: (previous: DemoState) => DemoState): boolean {
    try { const next = update(current.current); current.current = next; setState(next); return true; }
    catch (error) { notify(error instanceof Error ? error.message : "ยังบันทึกไม่ได้ กรุณาลองอีกครั้ง", "error"); return false; }
  }
  function taskOwned(previous: DemoState, id: string): Task {
    const task = previous.tasks.find((item) => item.id === id);
    if (!task) throw new Error("ไม่พบงานที่ต้องการ");
    if (previous.activeRole !== "owner" || task.ownerId !== previous.currentUserId) throw new Error("กิจกรรมนี้ต้องดำเนินการโดยเจ้าของงาน ลองสลับมุมมองเป็นผู้ปฏิบัติงาน");
    if (["submitted", "accepted", "cancelled"].includes(task.status)) throw new Error("งานอยู่ระหว่างตรวจหรือสิ้นสุดแล้ว จึงแก้ชุดผลงานรอบนี้ไม่ได้");
    return task;
  }
  const value: WorkspaceContextValue = {
    state, ready, user: users.find((item) => item.id === state.currentUserId) ?? users[0], users, units, notify,
    mode: 'demo', busy: false, today: DEMO_TODAY, permissions: [],
    eligibleOwners: users.filter(user => user.role === 'owner').map(({ id, name, unit }) => ({ id, name, unit })),
    async refresh() { return true; },
    async authorizeResolution() { notify('โหมดสาธิตใช้ขั้นตอนการอนุญาตที่เตรียมไว้แล้ว', 'info'); return false; },
    setRole(role) { commit((previous) => ({ ...previous, activeRole: role, currentUserId: getRoleUserId(role) })); },
    async acknowledgeTask(id) {
      const ok = commit((previous) => {
        const task = taskOwned(previous, id);
        if (task.acknowledgedAt) throw new Error("รับทราบการมอบหมายนี้แล้ว");
        return audit({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? { ...item, acknowledgedAt: new Date().toISOString() } : item) }, "รับทราบงาน", id, task.title, "ยืนยันรับทราบโดยยังไม่เปลี่ยนเป็นเริ่มดำเนินการ");
      });
      if (ok) notify("รับทราบงานแล้ว เริ่มดำเนินการได้เมื่อพร้อม");
      return ok;
    },
    async transitionTask(id, status, note = "") {
      const ok = commit((previous) => {
        const task = previous.tasks.find((item) => item.id === id);
        if (!task) throw new Error("ไม่พบงาน");
        const result = validateTaskTransition(task, status, { role: previous.activeRole, userId: previous.currentUserId });
        if (!result.allowed) throw new Error(result.reason);
        if (status === "revision" && !note.trim()) throw new Error("กรุณาระบุสิ่งที่ต้องแก้ไข");
        const now = new Date().toISOString();
        const changed: Task = { ...task, status, ...(status === "submitted" ? { submittedAt: now } : {}), ...(status === "accepted" ? { acceptedAt: now, progress: 100 } : {}), updates: note ? [...task.updates, { id: createId("update"), note, progress: task.progress, createdAt: now, authorId: previous.currentUserId }] : task.updates };
        const next = reconcileResolutionStatus({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? changed : item) }, task.resolutionId);
        next.notifications = [{ id: createId("notification"), title: status === "submitted" ? "มีผลงานส่งตรวจใหม่" : status === "accepted" ? "ผลงานผ่านการตรวจรับ" : status === "revision" ? "มีงานส่งกลับแก้ไข" : status === "cancelled" ? "ยุติงานตามการอนุมัติแล้ว" : "เริ่มดำเนินงานแล้ว", description: task.title, createdAt: now, read: false, type: "review", href: `/tasks/${id}`, targetId: id }, ...previous.notifications];
        const parent = next.resolutions.find((item) => item.id === task.resolutionId);
        if (parent?.status === "pending_close" && previous.resolutions.find((item) => item.id === parent.id)?.status !== "pending_close") {
          next.notifications = [{ id: createId("notification"), title: "มติพร้อมเสนอรับรองปิด", description: parent.title, createdAt: now, read: false, type: "review", href: `/resolutions/${parent.id}`, targetId: parent.id }, ...next.notifications];
        }
        return audit(next, status === "submitted" ? "ส่งผลงานตรวจ" : status === "accepted" ? "ตรวจรับผลงาน" : status === "revision" ? "ส่งกลับแก้ไข" : status === "cancelled" ? "ยุติงาน" : "เริ่มดำเนินงาน", id, task.title, note || `เปลี่ยนสถานะเป็น ${status}`);
      });
      if (ok) notify(status === "submitted" ? "ส่งผลงานให้ผู้ตรวจแล้ว" : status === "accepted" ? "รับรองผลงานแล้ว มติยังต้องรับรองปิดแยก" : status === "revision" ? "ส่งกลับพร้อมรายการแก้ไขแล้ว" : "บันทึกสถานะแล้ว");
      return ok;
    },
    async updateProgress(id, progress, note) {
      const ok = commit((previous) => {
        const task = taskOwned(previous, id);
        if (task.status === "assigned") throw new Error("กรุณารับทราบและเริ่มงานก่อนรายงานความก้าวหน้า");
        if (!note.trim() || !Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error("ระบุผลดำเนินงานและความก้าวหน้าระหว่าง 0–100");
        return audit({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? { ...item, progress, updates: [...item.updates, { id: createId("progress"), note: note.trim(), progress, createdAt: new Date().toISOString(), authorId: previous.currentUserId }] } : item) }, "รายงานความก้าวหน้า", id, task.title, note);
      });
      if (ok) notify("บันทึกความก้าวหน้าแล้ว"); return ok;
    },
    async addEvidence(id, evidence) {
      return commit((previous) => {
        const task = taskOwned(previous, id);
        if (evidence.url && !/^(https?:\/\/|blob:)/i.test(evidence.url)) throw new Error("ใช้ลิงก์ http หรือ https สำหรับหลักฐานเท่านั้น");
        return audit({ ...previous, tasks: previous.tasks.map((item) => item.id === id ? { ...item, evidence: [...item.evidence, evidence] } : item) }, "เพิ่มหลักฐาน", id, task.title, evidence.name);
      });
    },
    async createChangeRequest(input) {
      const ok = commit((previous) => {
        const task = previous.tasks.find((item) => item.id === input.taskId);
        if (!task) throw new Error("ไม่พบงาน");
        if (!(previous.activeRole === "secretary" || (previous.activeRole === "owner" && task.ownerId === previous.currentUserId))) throw new Error("บทบาทนี้ไม่มีสิทธิยื่นคำขอสำหรับงานนี้");
        if (["accepted", "cancelled"].includes(task.status)) throw new Error("งานสิ้นสุดแล้ว ไม่สามารถขอเปลี่ยนกำหนดรอบนี้ได้");
        if (!input.reason.trim() || !input.proposedValue.trim()) throw new Error("ระบุค่าที่เสนอและเหตุผลให้ครบ");
        if (previous.changes.some((change) => change.taskId === task.id && change.type === input.type && change.status === "pending")) throw new Error("มีคำขอประเภทนี้รอพิจารณาอยู่แล้ว");
        if (input.type === "deadline" && (!/^\d{4}-\d{2}-\d{2}$/.test(input.proposedValue) || daysUntil(input.proposedValue, task.dueDate) === null || (daysUntil(input.proposedValue, task.dueDate) ?? 0) <= 0)) throw new Error("กำหนดที่ขอขยายต้องเป็นวันที่ถูกต้องและอยู่หลังวันครบกำหนดปัจจุบัน");
        const change: ChangeRequest = { ...input, id: createId("change"), code: nextDisplayCode("change", previous.changes.map((item) => item.code)), status: "pending", requestedById: previous.currentUserId, createdAt: new Date().toISOString(), originalValue: input.type === "deadline" ? task.dueDate : input.type === "owner" ? task.ownerId : task.description };
        return audit(reconcileResolutionStatus({ ...previous, changes: [change, ...previous.changes] }, task.resolutionId), "ยื่นคำขอเปลี่ยนแปลง", task.id, task.title, input.reason);
      });
      if (ok) notify("ยื่นคำขอแล้ว กำหนดปัจจุบันยังไม่เปลี่ยนจนกว่าจะอนุมัติ"); return ok;
    },
    async decideChange(id, approved, reason) {
      const ok = commit((previous) => {
        const change = previous.changes.find((item) => item.id === id);
        if (!change || change.status !== "pending") throw new Error("คำขอนี้ไม่ได้อยู่ระหว่างรอพิจารณา");
        if (!["secretary", "executive"].includes(previous.activeRole) || change.requestedById === previous.currentUserId) throw new Error("ต้องเป็นผู้มีอำนาจพิจารณาและไม่ใช่ผู้ยื่นคำขอ");
        if (!reason.trim()) throw new Error("กรุณาระบุเหตุผลประกอบการพิจารณา");
        if (approved && change.type === "deadline") {
          const next = approveDeadlineChange(previous, id, { role: previous.activeRole, userId: previous.currentUserId }, new Date().toISOString());
          const resolutionId = next.tasks.find((item) => item.id === change.taskId)!.resolutionId;
          return reconcileResolutionStatus({ ...next, changes: next.changes.map((item) => item.id === id ? { ...item, decisionReason: reason.trim() } : item) }, resolutionId);
        }
        const task = previous.tasks.find((item) => item.id === change.taskId);
        if (!task) throw new Error("ไม่พบงานที่เกี่ยวข้อง");
        const now = new Date().toISOString();
        let tasks = previous.tasks;
        if (approved) {
          if (["accepted", "cancelled"].includes(task.status)) throw new Error("งานสิ้นสุดแล้ว ไม่สามารถเปลี่ยนเงื่อนไขรอบนี้ได้");
          if (task.status === "submitted") throw new Error("มีผลงานรอตรวจอยู่ ให้ผู้ตรวจส่งกลับก่อนเปลี่ยนเจ้าของหรือขอบเขต เพื่อคงชุดผลงานที่ส่งไว้");
          const currentValue = change.type === "owner" ? task.ownerId : task.description;
          if (currentValue !== change.originalValue) throw new Error("ข้อมูลเปลี่ยนไปหลังยื่นคำขอ กรุณาทบทวนและยื่นคำขอใหม่");
          if (change.type === "owner" && !users.some((item) => item.id === change.proposedValue && item.role === "owner" && item.id !== task.reviewerId)) throw new Error("ต้องเลือกผู้ปฏิบัติงานที่ไม่ใช่ผู้ตรวจของงานนี้");
          tasks = tasks.map((item) => item.id === task.id ? { ...item, ...(change.type === "owner" ? { ownerId: change.proposedValue, acknowledgedAt: undefined, status: "assigned" as const } : { description: change.proposedValue }) } : item);
        }
        return audit(reconcileResolutionStatus({ ...previous, tasks, changes: previous.changes.map((item) => item.id === id ? { ...item, status: approved ? "approved" : "rejected", decisionReason: reason, decidedAt: now, decidedById: previous.currentUserId } : item) }, task.resolutionId), approved ? "อนุมัติคำขอ" : "ไม่อนุมัติคำขอ", id, change.code, reason);
      });
      if (ok) notify(approved ? "อนุมัติและปรับข้อมูลตามคำขอแล้ว" : "บันทึกผลไม่อนุมัติแล้ว"); return ok;
    },
    async addResolution(input) {
      const id = createId("resolution");
      const ok = commit((previous) => {
        if (previous.activeRole !== "secretary") throw new Error("บันทึกมติได้ในมุมมองเลขานุการ");
        if (!input.title.trim() || !input.content.trim() || !input.meetingId) throw new Error("กรอกหัวเรื่อง ถ้อยคำมติ และการประชุมให้ครบ");
        if (!previous.meetings.some((meeting) => meeting.id === input.meetingId)) throw new Error("ไม่พบการประชุมต้นทาง");
        const resolution: Resolution = { ...input, status: input.type === "acknowledgment" ? "acknowledged" : "open", id, code: nextDisplayCode("resolution", previous.resolutions.map((item) => item.code)), createdAt: new Date().toISOString() };
        const meetings = previous.meetings.map((meeting) => meeting.id !== input.meetingId ? meeting : { ...meeting, agenda: meeting.agenda.some((agenda) => agenda.number === input.agenda) ? meeting.agenda.map((agenda) => agenda.number === input.agenda ? { ...agenda, resolutionIds: [...agenda.resolutionIds, id] } : agenda) : [...meeting.agenda, { id: createId("agenda"), number: input.agenda, title: input.title, resolutionIds: [id] }] });
        return audit({ ...previous, meetings, resolutions: [resolution, ...previous.resolutions] }, "บันทึกมติใหม่", id, input.title, "สร้างทะเบียนมติและกำหนดเกณฑ์ปิด");
      });
      if (ok) notify("บันทึกมติแล้ว เพิ่มงานที่ต้องดำเนินการได้เลย"); return ok ? id : null;
    },
    async addTask(input) {
      const id = createId("task");
      const ok = commit((previous) => {
        if (previous.activeRole !== "secretary") throw new Error("มอบหมายงานได้ในมุมมองเลขานุการ");
        const parent = previous.resolutions.find((resolution) => resolution.id === input.resolutionId);
        if (!parent || ["closed", "acknowledged"].includes(parent.status) || parent.type === "acknowledgment") throw new Error("ต้องเลือกมติที่เปิดติดตามและมีงานดำเนินการ");
        if (!input.title.trim() || !input.ownerId || !input.reviewerId || !input.dueDate || !input.deliverable.trim() || !input.criteria.length) throw new Error("ระบุเจ้าของ ผลส่งมอบ เกณฑ์ ผู้ตรวจ และกำหนดให้ครบ");
        if (daysUntil(input.dueDate) === null) throw new Error("ระบุวันครบกำหนดที่ถูกต้อง");
        if (!users.some((item) => item.id === input.ownerId && item.role === "owner") || !users.some((item) => item.id === input.reviewerId && ["reviewer", "executive"].includes(item.role))) throw new Error("เลือกผู้รับผิดชอบและผู้ตรวจที่มีบทบาทตรงกับงาน");
        if (input.ownerId === input.reviewerId) throw new Error("ผู้ทำและผู้ตรวจต้องเป็นคนละคน");
        return audit({ ...previous, resolutions: previous.resolutions.map((item) => item.id === parent.id && item.status === "pending_close" ? { ...item, status: "open" } : item), tasks: [...previous.tasks, { ...input, originalDueDate: input.dueDate, id, code: nextDisplayCode("task", previous.tasks.map((item) => item.code)), updates: [], evidence: [], progress: 0, status: "assigned" }] }, "มอบหมายงานใหม่", id, input.title, `${input.deliverable}${parent.status === "pending_close" ? "; เพิ่มงานและเปิดติดตามมติอีกครั้ง" : ""}`);
      });
      if (ok) notify("มอบหมายงานแล้ว รอเจ้าของงานรับทราบ"); return ok ? id : null;
    },
    async closeResolution(id, criteriaConfirmed) {
      const ok = commit((previous) => {
        const resolution = previous.resolutions.find((item) => item.id === id);
        if (!resolution) throw new Error("ไม่พบมติ");
        if (!["secretary", "executive"].includes(previous.activeRole)) throw new Error("บทบาทนี้ไม่มีอำนาจรับรองปิดมติ");
        if (["recurring", "acknowledgment"].includes(resolution.type)) throw new Error("มติต่อเนื่องและมติรับทราบไม่ปิดด้วยกระบวนงานนี้");
        if (resolution.status === "closed") throw new Error("มตินี้ปิดแล้ว");
        if (!canCloseResolution(id, previous.tasks, criteriaConfirmed)) throw new Error("ต้องตรวจรับทุกงานจำเป็นและยืนยันเกณฑ์ปิดมติให้ครบก่อน");
        if (previous.changes.some((change) => change.status === "pending" && previous.tasks.some((task) => task.id === change.taskId && task.resolutionId === id))) throw new Error("ยังมีคำขอเปลี่ยนแปลงค้าง กรุณาพิจารณาให้ครบก่อน");
        return audit({ ...previous, resolutions: previous.resolutions.map((item) => item.id === id ? { ...item, status: "closed" } : item) }, "รับรองปิดมติ", id, resolution.title, "งานจำเป็นผ่านตรวจและผู้รับรองยืนยันเกณฑ์ระดับมติครบแล้ว");
      });
      if (ok) notify("รับรองปิดมติและบันทึกประวัติแล้ว"); return ok;
    },
    async addMeeting(input) {
      const id = createId("meeting");
      const ok = commit((previous) => {
        if (previous.activeRole !== "secretary") throw new Error("เพิ่มการประชุมได้ในมุมมองเลขานุการ");
        if (!input.title.trim() || !input.number.trim() || !input.date) throw new Error("กรอกชื่อ ครั้งที่ และวันที่ประชุม");
        return audit({ ...previous, meetings: [...previous.meetings, { ...input, id }] }, "เพิ่มการประชุม", id, input.title, input.date);
      });
      if (ok) notify("บันทึกการประชุมแล้ว"); return ok ? id : null;
    },
    async updateSettings(patch) {
      const ok = commit((previous) => {
        if (previous.activeRole !== "secretary") throw new Error("การตั้งค่านี้ใช้มุมมองเลขานุการในชุดสาธิต");
        return audit({ ...previous, settings: { ...previous.settings, ...patch } }, "ปรับการตั้งค่า", "settings", "การติดตามและแจ้งเตือน", "บันทึกเฉพาะในเบราว์เซอร์ ไม่มีการส่งอีเมลจริง");
      });
      if (ok) notify("บันทึกการตั้งค่าชุดสาธิตแล้ว"); return ok;
    },
    resetDemo() { const next = copyInitial(); current.current = next; setState(next); notify("คืนข้อมูลตัวอย่างเริ่มต้นแล้ว"); },
    async markNotificationRead(id) { commit((previous) => ({ ...previous, notifications: previous.notifications.map((item) => item.id === id ? { ...item, read: true } : item) })); },
    async markAllRead() { commit((previous) => ({ ...previous, notifications: previous.notifications.map((item) => ({ ...item, read: true })) })); },
  };

  return <DemoContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite" aria-atomic="false">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>{toast.type === "success" ? <CheckCircle2 size={19} /> : toast.type === "error" ? <CircleAlert size={19} /> : <Info size={19} />}<span>{toast.message}</span><button aria-label="ปิดข้อความ" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X size={16} /></button></div>)}</div></DemoContext.Provider>;
}

export const useDemo = useWorkspace;
