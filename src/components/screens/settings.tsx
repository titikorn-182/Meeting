'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { BellRing, CircleHelp, History, RotateCcw, Save, Search, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Badge, Button, Dialog, EmptyState, Field, PageHeader, Panel } from '@/components/ui';
import { initialState } from '@/lib/mock-data';
import { formatThaiDate } from '@/lib/workflow';
import type { DemoSettings } from '@/lib/types';

export function SettingsScreen() {
  const { state, notify, updateSettings, resetDemo, mode, permissions, users, busy } = useDemo();
  const [tab, setTab] = useState<'preferences' | 'audit'>('preferences');
  const [reminders, setReminders] = useState(state.settings.reminderDays.join(', '));
  const [acknowledgmentDays, setAcknowledgmentDays] = useState(state.settings.acknowledgmentDays);
  const [reviewDays, setReviewDays] = useState(state.settings.reviewDays);
  const [emailNotifications, setEmailNotifications] = useState(state.settings.emailNotifications);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [auditQuery, setAuditQuery] = useState('');
  const canEdit = mode === 'supabase' ? permissions.includes('policy.manage') : state.activeRole === 'secretary';
  useEffect(() => {
    setReminders(state.settings.reminderDays.join(', '));
    setAcknowledgmentDays(state.settings.acknowledgmentDays);
    setReviewDays(state.settings.reviewDays);
    setEmailNotifications(state.settings.emailNotifications);
  }, [state.settings]);
  const dirty = reminders !== state.settings.reminderDays.join(', ') || acknowledgmentDays !== state.settings.acknowledgmentDays || reviewDays !== state.settings.reviewDays || emailNotifications !== state.settings.emailNotifications;
  const auditEvents = state.audit.filter((event) => `${event.action} ${event.targetLabel} ${event.detail} ${users.find((person) => person.id === event.actorId)?.name ?? ''}`.includes(auditQuery));

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = reminders.split(/[,\s]+/).filter(Boolean);
    if (!values.length || values.some((value) => !/^\d+$/.test(value) || Number(value) > 365)) {
      setError('ระบุจำนวนวันเป็นจำนวนเต็ม 0–365 คั่นด้วยจุลภาค เช่น 7, 3, 0');
      return;
    }
    if (!Number.isInteger(acknowledgmentDays) || !Number.isInteger(reviewDays) || acknowledgmentDays < 1 || acknowledgmentDays > 30 || reviewDays < 1 || reviewDays > 30) {
      setError('ระยะเวลารับทราบและตรวจผลต้องเป็นจำนวนเต็ม 1–30 วันทำการ');
      return;
    }
    const settings: DemoSettings = { reminderDays: [...new Set(values.map(Number))].sort((a, b) => b - a), acknowledgmentDays, reviewDays, emailNotifications };
    if (await updateSettings(settings)) { setError(''); }
  }

  function restoreSettings() {
    setReminders(initialState.settings.reminderDays.join(', '));
    setAcknowledgmentDays(initialState.settings.acknowledgmentDays);
    setReviewDays(initialState.settings.reviewDays);
    setEmailNotifications(initialState.settings.emailNotifications);
    setError('');
    notify('คืนค่าตั้งต้นในแบบฟอร์มแล้ว กดบันทึกเพื่อใช้ค่าเหล่านี้', 'info');
  }

  return <div className="page-stack">
    <PageHeader title="ตั้งค่าและประวัติระบบ" description="กำหนดรอบการติดตาม และตรวจสอบกิจกรรมที่เกิดขึ้นในพื้นที่ทำงาน" />
    <div className="tabs" role="tablist" aria-label="ส่วนการตั้งค่า"><button type="button" role="tab" aria-selected={tab === 'preferences'} className={`tab ${tab === 'preferences' ? 'active' : ''}`} onClick={() => setTab('preferences')}><BellRing size={16} />การติดตามและแจ้งเตือน</button><button type="button" role="tab" aria-selected={tab === 'audit'} className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}><History size={16} />ประวัติกิจกรรม</button></div>
    {tab === 'preferences' ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]"><div className="stack">
      <Panel title="รอบการแจ้งเตือน" description="ค่าตั้งต้นสำหรับการติดตามงานและตรวจรับผลงาน">
        {!canEdit && <div className="inline-alert warning mb-5">บัญชีนี้ดูการตั้งค่าได้ การเปลี่ยนแปลงต้องดำเนินการโดยผู้มีสิทธิจัดการนโยบาย</div>}
        <form className="stack" onSubmit={handleSave}>
          <Field label="แจ้งเตือนก่อนวันครบกำหนด" htmlFor="reminder-days" required hint="แยกจำนวนวันด้วยจุลภาค โดย 0 คือแจ้งในวันครบกำหนด"><input id="reminder-days" className="input" value={reminders} onChange={(event) => setReminders(event.target.value)} disabled={!canEdit} placeholder="7, 3, 0" required aria-describedby={error ? 'settings-error' : undefined} /></Field>
          <div className="form-grid"><Field label="รับทราบงานภายใน" htmlFor="ack-days" hint="วันทำการหลังมอบหมาย"><div className="flex items-center gap-3"><input id="ack-days" className="input" type="number" min={1} max={30} step={1} value={acknowledgmentDays} disabled={!canEdit} onChange={(event) => setAcknowledgmentDays(Number(event.target.value))} required /><span className="muted shrink-0 text-sm">วันทำการ</span></div></Field><Field label="ตรวจผลภายใน" htmlFor="review-days" hint="วันทำการหลังส่งตรวจ"><div className="flex items-center gap-3"><input id="review-days" className="input" type="number" min={1} max={30} step={1} value={reviewDays} disabled={!canEdit} onChange={(event) => setReviewDays(Number(event.target.value))} required /><span className="muted shrink-0 text-sm">วันทำการ</span></div></Field></div>
          <div className="border-t border-[#e0e7e5] pt-5"><label className="flex items-start gap-3" htmlFor="email-preference"><input id="email-preference" className="mt-1 h-4 w-4 accent-[#53756b]" type="checkbox" checked={emailNotifications} disabled={!canEdit} onChange={(event) => setEmailNotifications(event.target.checked)} /><span><span className="block text-sm font-medium">ต้องการรับการแจ้งเตือนทางอีเมล</span><span className="muted text-small mt-1 block">บันทึกความต้องการไว้เท่านั้น ยังไม่เปิดบริการส่งอีเมล</span></span></label></div>
          {error && <p id="settings-error" role="alert" className="inline-alert error">{error}</p>}
          <div className="form-actions">{mode === 'demo' && <Button variant="secondary" type="button" onClick={restoreSettings} disabled={busy || (!canEdit)}><RotateCcw size={15} />คืนค่าตั้งต้น</Button>}<Button type="submit" disabled={busy || (!canEdit || !dirty)} title={!dirty ? 'ค่าตรงกับที่บันทึกไว้แล้ว' : undefined}><Save size={16} />บันทึกการตั้งค่า</Button></div>
        </form>
      </Panel>
      {mode === 'demo' && <Panel title="เริ่มการทดลองใหม่" description="คืนมติ งาน การประชุม และการตั้งค่าทั้งหมดเป็นข้อมูลตัวอย่างเริ่มต้น"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><p className="max-w-[60ch] text-sm leading-relaxed text-[#64757a]">รายการที่เพิ่มและการเปลี่ยนแปลงระหว่างทดลองในเบราว์เซอร์นี้จะถูกแทนที่</p><Button disabled={busy} variant="danger" className="shrink-0" onClick={() => setResetOpen(true)}><RotateCcw size={16} />เริ่มใหม่</Button></div></Panel>}
    </div><div className="stack"><Panel title={mode === 'demo' ? "การใช้งานในรุ่นทดลอง" : "พื้นที่ทำงานที่เชื่อมต่อ"}><div className="flex items-start gap-3"><ShieldCheck size={21} className="mt-0.5 shrink-0 text-[#53756b]" /><div className="text-sm leading-relaxed text-[#64757a]">{mode === 'demo' ? 'การเปลี่ยนบทบาทใช้ทดลองมุมมองการทำงาน ยังไม่ใช่การเข้าสู่ระบบด้วยบัญชีบุคลากรจริง' : 'ข้อมูลที่มองเห็นและกิจกรรมที่ทำได้ขึ้นกับสิทธิของบัญชีที่เข้าสู่ระบบ'}</div></div><dl className="mt-5 divide-y divide-[#e6ecea] text-sm"><div className="flex justify-between gap-3 py-3"><dt className="muted">เขตเวลา</dt><dd>Asia/Bangkok</dd></div><div className="flex justify-between gap-3 py-3"><dt className="muted">ภาษา</dt><dd>ไทย</dd></div><div className="flex justify-between gap-3 py-3"><dt className="muted">การแจ้งเตือน</dt><dd><Badge tone="info">{mode === 'demo' ? "ในระบบทดลอง" : "ในพื้นที่ทำงาน"}</Badge></dd></div></dl></Panel><div className="flex gap-3 px-1 text-sm leading-relaxed text-[#64757a]"><CircleHelp size={19} className="mt-0.5 shrink-0" /><p>ค่าระยะเวลาเป็นนโยบายสำหรับติดตามงาน ยังไม่เปิดการเตือนตามเวลาและการคำนวณปฏิทินวันหยุดอัตโนมัติ</p></div></div></div> : <Panel title="ประวัติกิจกรรม" description="แสดงผู้กระทำ รายการที่เกี่ยวข้อง และรายละเอียดการเปลี่ยนแปลง" action={<Badge tone="neutral">{auditEvents.length} เหตุการณ์</Badge>}>
      <div className="search-input mb-5"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-[#849397]" /><input className="input pl-10" aria-label="ค้นหาประวัติกิจกรรม" placeholder="ค้นหากิจกรรม ผู้กระทำ หรือชื่องาน" value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} /></div>
      {auditEvents.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>วัน / เวลา</th><th>กิจกรรมและรายการ</th><th>ผู้กระทำ</th><th>รายละเอียด</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.id}><td className="whitespace-nowrap text-sm">{formatThaiDate(event.createdAt)}<div className="muted text-small mt-1">{new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(new Date(event.createdAt))} น.</div></td><td className="min-w-52"><div className="font-medium">{event.action}</div><div className="muted text-small mt-1">{event.targetLabel}</div></td><td className="whitespace-nowrap text-sm">{users.find((person) => person.id === event.actorId)?.name ?? 'ระบบ'}</td><td className="min-w-64 text-sm text-[#64757a]">{event.detail}</td></tr>)}</tbody></table></div> : <EmptyState icon={History} title="ไม่พบกิจกรรมตามคำค้น" description="ลองเปลี่ยนคำค้นเพื่อดูประวัติรายการอื่น"><Button disabled={busy} variant="secondary" onClick={() => setAuditQuery('')}>ล้างคำค้น</Button></EmptyState>}
    </Panel>}
    <Dialog open={mode === 'demo' && resetOpen} onClose={() => setResetOpen(false)} title="เริ่มการทดลองใหม่?" description="การเปลี่ยนแปลงทั้งหมดในเบราว์เซอร์นี้จะถูกแทนที่ด้วยข้อมูลเริ่มต้น"><div className="stack"><p className="text-sm leading-relaxed text-[#64757a]">รวมถึงมติและการประชุมที่เพิ่ม ความก้าวหน้า ผลตรวจ คำขอ และการตั้งค่า หากต้องการเก็บผลปัจจุบัน โปรดส่งออกรายงานก่อนเริ่มใหม่</p><div className="form-actions"><Button disabled={busy} variant="secondary" onClick={() => setResetOpen(false)}>ทดลองต่อ</Button><Button disabled={busy} variant="danger" onClick={() => { resetDemo(); setResetOpen(false); setError(''); }}>ยืนยันเริ่มใหม่</Button></div></div></Dialog>
  </div>;
}
