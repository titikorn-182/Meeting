'use client';

import { useState } from 'react';
import { AccessLink as Link } from "@/components/app-shell";
import { ArrowRight, Bell, CalendarClock, Check, CheckCheck, ClipboardCheck, FilePenLine, Inbox, UserRoundCheck } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Badge, Button, EmptyState, PageHeader, Panel } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import type { Notification } from '@/lib/types';

const typeLabels: Record<Notification['type'], string> = { assignment: 'มอบหมายงาน', deadline: 'กำหนดส่ง', review: 'ตรวจรับผลงาน', change: 'คำขอเปลี่ยนแปลง', system: 'ระบบ' };
const typeIcons = { assignment: UserRoundCheck, deadline: CalendarClock, review: ClipboardCheck, change: FilePenLine, system: Bell };

export function NotificationsScreen() {
  const { state, markNotificationRead, markAllRead, mode, permissions, busy } = useDemo();
  const [view, setView] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState('all');
  const unread = state.notifications.filter((notification) => !notification.read).length;
  const filtered = state.notifications.filter((notification) => (view === 'all' || !notification.read) && (type === 'all' || notification.type === type)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="page-stack">
    <PageHeader title="การแจ้งเตือน" description="เรื่องที่ต้องดำเนินการ กำหนดส่ง และความคืบหน้าที่เกี่ยวข้อง"><Button variant="secondary" onClick={markAllRead} disabled={busy || (unread === 0)} title={unread === 0 ? 'อ่านการแจ้งเตือนทั้งหมดแล้ว' : undefined}><CheckCheck size={17} />ทำเครื่องหมายอ่านทั้งหมด</Button></PageHeader>
    <Panel title="กล่องแจ้งเตือน" action={<Badge tone={unread ? 'warning' : 'neutral'}>{unread} ยังไม่อ่าน</Badge>}>
      <div className="toolbar mb-4"><div className="tabs flex-1" role="tablist" aria-label="สถานะการอ่าน"><button type="button" className={`tab ${view === 'all' ? 'active' : ''}`} role="tab" aria-selected={view === 'all'} onClick={() => setView('all')}>ทั้งหมด <span className="ml-1 tabular-nums text-[#81918f]">{state.notifications.length}</span></button><button type="button" className={`tab ${view === 'unread' ? 'active' : ''}`} role="tab" aria-selected={view === 'unread'} onClick={() => setView('unread')}>ยังไม่อ่าน <span className="ml-1 tabular-nums text-[#81918f]">{unread}</span></button></div><select className="select sm:max-w-52" aria-label="ประเภทการแจ้งเตือน" value={type} onChange={(event) => setType(event.target.value)}><option value="all">ทุกประเภท</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {filtered.length ? <div className="divide-y divide-[#e6ecea]">{filtered.map((notification) => {
        const Icon = typeIcons[notification.type];
        return <div key={notification.id} className={`flex items-start gap-3 rounded-lg px-2 py-5 sm:gap-4 sm:px-3 ${notification.read ? '' : 'bg-[#f5f8f7]'}`}><div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${notification.type === 'deadline' ? 'bg-[#f6ece0] text-[#a77435]' : 'bg-[#e8f0ec] text-[#53756b]'}`}><Icon size={19} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link href={notification.href} onClick={() => markNotificationRead(notification.id)} className={`text-sm hover:text-[#b87120] ${notification.read ? 'font-medium' : 'font-semibold'}`}>{notification.title}</Link>{!notification.read && <span className="h-1.5 w-1.5 rounded-full bg-[#b87120]" aria-label="ยังไม่อ่าน" />}</div><p className="mt-1.5 max-w-[75ch] text-sm leading-relaxed text-[#64757a]">{notification.description}</p><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#81918f]"><span>{typeLabels[notification.type]}</span><time dateTime={notification.createdAt}>{formatThaiDate(notification.createdAt, { hour: '2-digit', minute: '2-digit' })}</time><Link href={notification.href} onClick={() => markNotificationRead(notification.id)} className="inline-flex items-center gap-1 font-medium text-[#53756b]">เปิดรายการ<ArrowRight size={13} /></Link></div></div>{!notification.read && <Button disabled={busy} variant="ghost" size="sm" onClick={() => markNotificationRead(notification.id)} aria-label={`ทำเครื่องหมายอ่าน ${notification.title}`} title="ทำเครื่องหมายว่าอ่านแล้ว"><Check size={17} /></Button>}</div>;
      })}</div> : <EmptyState icon={view === 'unread' ? CheckCheck : Inbox} title={view === 'unread' ? 'อ่านครบแล้ว' : 'ไม่มีการแจ้งเตือนประเภทนี้'} description={view === 'unread' ? 'ไม่มีเรื่องที่ยังไม่อ่านตามตัวกรองนี้ คุณกลับไปดูรายการทั้งหมดได้' : 'เลือกประเภทอื่นหรือดูการแจ้งเตือนทั้งหมด'}><Button disabled={busy} variant="secondary" onClick={() => { setView('all'); setType('all'); }}>ดูการแจ้งเตือนทั้งหมด</Button></EmptyState>}
    </Panel>
  </div>;
}
