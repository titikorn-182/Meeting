'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, CheckCheck, ClipboardCheck, Clock3, ExternalLink, FileCheck2, MessageSquareText, Search, ShieldCheck, Undo2 } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Avatar, Badge, Button, EmptyState, Field, PageHeader, Panel } from '@/components/ui';
import { daysUntil, formatThaiDate, validateTaskTransition } from '@/lib/workflow';

export function ReviewsScreen({ initialTaskId }: { initialTaskId?: string }) {
  const { state, transitionTask, notify, mode, permissions, users, today, busy } = useDemo();
  const [selectedId, setSelectedId] = useState(initialTaskId ?? '');
  const [query, setQuery] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<{ taskId: string; checked: number[]; note: string }>({ taskId: '', checked: [], note: '' });
  const queue = state.tasks.filter((task) => task.status === 'submitted' && (!mineOnly || task.reviewerId === state.currentUserId) && `${task.title} ${task.code}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = queue.find((task) => task.id === selectedId) ?? queue[0];
  const checked = selected && reviewDraft.taskId === selected.id ? reviewDraft.checked : [];
  const note = selected && reviewDraft.taskId === selected.id ? reviewDraft.note : '';
  const resolution = state.resolutions.find((item) => item.id === selected?.resolutionId);
  const mayReview = mode === 'supabase' && permissions.includes('submission.review') && selected?.reviewerId === state.currentUserId && selected?.ownerId !== state.currentUserId;
  const guard = selected ? mode === 'supabase' ? { allowed: Boolean(mayReview && selected.evidence.length && selected.criteria.length), reason: 'เฉพาะผู้ตรวจที่ได้รับมอบหมายและมีสิทธิในงานนี้' } : validateTaskTransition(selected, 'accepted', { role: state.activeRole, userId: state.currentUserId }) : null;
  const returnGuard = selected ? mode === 'supabase' ? { allowed: Boolean(mayReview), reason: 'เฉพาะผู้ตรวจที่ได้รับมอบหมายและมีสิทธิในงานนี้' } : validateTaskTransition(selected, 'revision', { role: state.activeRole, userId: state.currentUserId }) : null;
  const age = selected?.submittedAt ? Math.max(0, -(daysUntil(selected.submittedAt, today) ?? 0)) : 0;

  function setCheck(index: number, value: boolean) {
    if (!selected) return;
    setReviewDraft({ taskId: selected.id, note, checked: value ? [...checked.filter((item) => item !== index), index] : checked.filter((item) => item !== index) });
  }

  async function decide(accepted: boolean) {
    if (!selected || busy) return;
    if (!note.trim()) { notify(accepted ? 'กรุณาบันทึกข้อสรุปของผู้ตรวจก่อนรับรอง' : 'กรุณาระบุเหตุผลและรายการที่ต้องแก้ไข', 'error'); return; }
    if (accepted && checked.length !== selected.criteria.length) { notify('กรุณายืนยันเกณฑ์ตรวจรับให้ครบทุกข้อ', 'error'); return; }
    if (await transitionTask(selected.id, accepted ? 'accepted' : 'revision', note.trim(), selected.criteria.map((_, index) => checked.includes(index)))) { setReviewDraft({ taskId: '', checked: [], note: '' }); setSelectedId(''); }
  }

  return <div className="page-stack">
    <PageHeader title="ตรวจผลและรับรอง" description="พิจารณาผลงานตามเกณฑ์ พร้อมระบุหลักฐานและเหตุผลของผลตรวจ">
      <Link href="/resolutions?status=pending_close" className="button button-secondary"><ShieldCheck size={17} /> มติรอรับรองปิด</Link>
    </PageHeader>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3"><Badge tone="warning">รอตรวจ {state.tasks.filter((task) => task.status === 'submitted').length} งาน</Badge><span className="text-small muted">เวลาส่งผลงานแยกจากเวลารับรองผล</span></div>
      <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#173b42]" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} /> เฉพาะงานที่ฉันเป็นผู้ตรวจ</label>
    </div>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
      <Panel title="คิวงานรอตรวจ" description="เลือกงานเพื่ออ่านหลักฐานและบันทึกผล" className="no-pad">
        <div className="px-5 pb-4 pt-4"><label className="search-input w-full"><Search size={17} /><input className="input" aria-label="ค้นหางานรอตรวจ" placeholder="ค้นหาชื่องานหรือรหัสงาน" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        {queue.length > 0 ? <div className="divide-y divide-[#e0e7e5]">{queue.map((task) => {
          const waitingDays = task.submittedAt ? Math.max(0, -(daysUntil(task.submittedAt, today) ?? 0)) : 0;
          return <button key={task.id} onClick={() => { setSelectedId(task.id); setReviewDraft({ taskId: '', checked: [], note: '' }); }} aria-pressed={selected?.id === task.id} className={`block w-full px-5 py-5 text-left transition-colors hover:bg-[#f5f7f6] ${selected?.id === task.id ? 'bg-[#edf4f0]' : ''}`}>
            <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs muted">{task.code}</span><span className={`flex items-center gap-1 text-xs ${waitingDays > state.settings.reviewDays ? 'text-[#a83e32]' : 'text-[#6d797c]'}`}><Clock3 size={12} /> รอ {waitingDays} วัน</span></div>
            <p className="text-sm font-medium leading-7">{task.title}</p>
            <div className="mt-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Avatar userId={task.ownerId} size="sm" /><span className="text-xs muted">{users.find((person) => person.id === task.ownerId)?.name.split(' ')[0]}</span></div><span className="text-xs muted">{task.evidence.length} หลักฐาน</span></div>
          </button>;
        })}</div> : <EmptyState icon={CheckCheck} title="ไม่มีงานรอตรวจในมุมมองนี้" description={mineOnly ? 'ลองยกเลิกตัวกรองเฉพาะงานของฉันเพื่อดูคิวที่คุณมีสิทธิเข้าถึง' : 'เมื่อผู้รับผิดชอบส่งผลงาน งานจะเข้าคิวนี้โดยอัตโนมัติ'} />}
      </Panel>

      {selected ? <div className="stack">
        <Panel>
          <div className="stack-sm">
            <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><h2 className="text-xl font-semibold leading-relaxed">{selected.title}</h2><Link href={`/resolutions/${selected.resolutionId}`} className="mt-2 inline-flex items-center gap-1 text-xs muted hover:underline">{resolution?.code} · {resolution?.title}<ArrowRight size={13} /></Link></div><Badge status="submitted">รอตรวจรับ</Badge></div>
            <dl className="mt-6 grid gap-4 border-y border-[#e0e7e5] py-5 sm:grid-cols-3"><div><dt className="text-xs muted">ส่งผลงานเมื่อ</dt><dd className="mt-1.5 text-sm font-medium">{formatThaiDate(selected.submittedAt)}</dd></div><div><dt className="text-xs muted">กำหนดส่งปัจจุบัน</dt><dd className="mt-1.5 text-sm font-medium">{formatThaiDate(selected.dueDate)}</dd></div><div><dt className="text-xs muted">ระยะเวลารอตรวจ</dt><dd className="mt-1.5 text-sm font-medium">{age} วันปฏิทิน</dd></div></dl>
            <div className="mt-5"><h3 className="text-sm font-semibold">ผลส่งมอบที่ต้องได้รับ</h3><p className="mt-2 text-sm leading-7 text-[#42585e]">{selected.deliverable}</p></div>
            <div className="mt-6 flex items-center justify-between"><h3 className="text-sm font-semibold">หลักฐานประกอบ</h3><Link className="inline-flex items-center gap-1 text-xs text-[#426967] hover:underline" href={`/tasks/${selected.id}`}>รายละเอียดงาน <ArrowRight size={13} /></Link></div>
            <div className="mt-2 divide-y divide-[#e0e7e5]">{selected.evidence.map((evidence) => <div key={evidence.id} className="flex items-center gap-3 py-3"><FileCheck2 size={21} className="shrink-0 text-[#627b76]" /><div className="min-w-0 flex-1"><p className="break-words text-sm">{evidence.name}</p><p className="mt-0.5 text-xs muted">{evidence.size} · {mode === 'demo' ? (evidence.url ? 'หลักฐานที่เพิ่มในเบราว์เซอร์' : 'รายการตัวอย่าง ไม่มีไฟล์จริง') : 'หลักฐานในชุดส่งตรวจ'}</p></div>{evidence.url && <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="button button-ghost" aria-label={`เปิดหลักฐาน ${evidence.name}`}><ExternalLink size={15} /></a>}</div>)}</div>
            {!selected.evidence.length && <p className="inline-alert warning mt-3 text-sm">ยังไม่มีหลักฐานประกอบ จึงรับรองผ่านไม่ได้</p>}
          </div>
        </Panel>

        <Panel title="บันทึกผลการตรวจ" description="ผลตรวจใช้กับชุดหลักฐานที่ส่งในรอบนี้">
          <div className="space-y-5">
            {!guard?.allowed && <div className="inline-alert"><ClipboardCheck size={19} /><p className="text-sm leading-6">{guard?.reason} {mode === 'demo' && state.activeRole !== 'reviewer' && 'สลับเป็นบทบาทผู้ตรวจที่แถบด้านบนเพื่อทดลองพิจารณาผลงาน'}</p></div>}
            <fieldset disabled={!returnGuard?.allowed} className="space-y-3 disabled:opacity-60"><legend className="mb-3 text-sm font-medium">ยืนยันเกณฑ์ตรวจรับ <span className="muted">({checked.length}/{selected.criteria.length})</span></legend>{selected.criteria.map((criterion, index) => <label key={`${selected.id}-${index}`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e0e7e5] p-3.5 text-sm leading-6"><input type="checkbox" checked={checked.includes(index)} onChange={(event) => setCheck(index, event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#173b42]" /><span>{criterion}</span></label>)}</fieldset>
            <Field label="ข้อสรุปหรือรายการที่ต้องแก้ไข" htmlFor="review-note" required><textarea id="review-note" className="textarea" rows={4} disabled={!returnGuard?.allowed} value={note} onChange={(event) => setReviewDraft({ taskId: selected.id, checked, note: event.target.value })} placeholder="บันทึกสิ่งที่ตรวจพบ เหตุผล และรายการแก้ไขที่ชัดเจน" /></Field>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e7e5] pt-5"><span className="inline-flex items-center gap-2 text-xs muted"><MessageSquareText size={15} /> ผู้รับผิดชอบจะเห็นเหตุผลนี้</span><div className="flex gap-2"><Button variant="secondary" disabled={busy || (!returnGuard?.allowed || !note.trim())} onClick={() => decide(false)}><Undo2 size={16} /> ส่งกลับแก้ไข</Button><Button disabled={busy || (!guard?.allowed || checked.length !== selected.criteria.length || !note.trim())} onClick={() => decide(true)}><Check size={16} /> รับรองผลงาน</Button></div></div>
            <p className="text-xs leading-6 muted">การรับรองงานไม่ปิดมติโดยอัตโนมัติ มติยังต้องผ่านงานจำเป็นและเกณฑ์ปิดทุกข้อ</p>
          </div>
        </Panel>
      </div> : <Panel><EmptyState icon={ClipboardCheck} title="คิวตรวจพร้อมสำหรับผลงานถัดไป" description="เลือกงานทางซ้ายเพื่ออ่านหลักฐาน ตรวจตามเกณฑ์ และบันทึกผลพิจารณา"><Link className="button button-secondary" href="/tasks">เปิดงานตามมติ</Link></EmptyState></Panel>}
    </div>
  </div>;
}
