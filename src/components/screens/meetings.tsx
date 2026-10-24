'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { AccessLink as Link } from "@/components/app-shell";
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, FileText, MapPin, Plus, Printer, Search, X } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Badge, Button, EmptyState, Field, PageHeader, Panel, ProgressBar } from '@/components/ui';
import { createId, formatThaiDate, getResolutionProgress } from '@/lib/workflow';
import type { Meeting } from '@/lib/types';

export function MeetingsScreen() {
  const { state, addMeeting, notify, mode, permissions, today, busy } = useDemo();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);
  const canCreate = permissions.includes('meeting.manage');
  const meetings = useMemo(() => state.meetings.filter((meeting) =>
    (status === 'all' || meeting.status === status) &&
    `${meeting.title} ${meeting.number} ${meeting.committee}`.toLocaleLowerCase('th').includes(query.toLocaleLowerCase('th')),
  ).sort((a, b) => b.date.localeCompare(a.date)), [state.meetings, query, status]);
  const nextMeeting = [...state.meetings].filter((meeting) => meeting.status === 'scheduled' && meeting.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const committee = String(data.get('committee') ?? '').trim();
    const number = String(data.get('number') ?? '').trim();
    if (state.meetings.some((meeting) => meeting.committee === committee && meeting.number === number)) {
      notify('คณะกรรมการนี้มีเลขครั้งประชุมดังกล่าวแล้ว กรุณาตรวจสอบเลขครั้ง', 'error');
      return;
    }
    const agendaTitles = String(data.get('agenda') ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
    const input: Omit<Meeting, 'id'> = {
      title: String(data.get('title') ?? '').trim(), committee, number,
      date: String(data.get('date')), time: String(data.get('time')),
      location: String(data.get('location') ?? '').trim(),
      status: data.get('status') === 'completed' ? 'completed' : 'scheduled',
      agenda: agendaTitles.map((title, index) => ({ id: createId('agenda'), number: String(index + 1), title, resolutionIds: [] })),
    };
    if (!input.title || !committee || !number || !input.location) {
      notify('กรุณากรอกชื่อการประชุม คณะกรรมการ เลขครั้ง และสถานที่ให้ครบ', 'error');
      return;
    }
    const id = await addMeeting(input);
    if (id) { setCreating(false); router.push(`/meetings/${id}`); }
  }

  return <div className="page-stack">
    <PageHeader title="การประชุมและวาระ" description="เอกสารต้นทางของทุกมติ เชื่อมการติดตามจากครั้งก่อนถึงครั้งถัดไป">
      {canCreate ? <Button disabled={busy} onClick={() => setCreating(!creating)}><Plus size={17} />สร้างการประชุม</Button> : <span className="muted text-small">เลขานุการเป็นผู้สร้างการประชุม</span>}
    </PageHeader>

    {creating && <Panel title="เพิ่มการประชุม" description="บันทึกข้อมูลและร่างวาระสำหรับการประชุมครั้งใหม่" action={<Button disabled={busy} variant="ghost" size="sm" onClick={() => setCreating(false)} aria-label="ปิดแบบสร้างการประชุม"><X size={18} /></Button>}>
      <form onSubmit={handleCreate} className="form-grid">
        <Field label="ชื่อการประชุม" htmlFor="meeting-title" required><input id="meeting-title" name="title" className="input" required maxLength={160} placeholder="เช่น ประชุมคณะกรรมการประจำคณะรัฐศาสตร์" /></Field>
        <Field label="คณะกรรมการ" htmlFor="meeting-committee" required><input id="meeting-committee" name="committee" className="input" required list="committee-options" placeholder="ชื่อคณะกรรมการ" /><datalist id="committee-options">{Array.from(new Set(state.meetings.map((meeting) => meeting.committee))).map((committee) => <option key={committee} value={committee} />)}</datalist></Field>
        <Field label="ครั้งที่ / ปี" htmlFor="meeting-number" required><input id="meeting-number" name="number" className="input" required maxLength={30} placeholder="เช่น 12/2569" /></Field>
        <Field label="วันที่ประชุม" htmlFor="meeting-date" required><input id="meeting-date" name="date" className="input" type="date" defaultValue={today} required /></Field>
        <Field label="เวลาเริ่ม" htmlFor="meeting-time" required><input id="meeting-time" name="time" className="input" type="time" defaultValue="09:30" required /></Field>
        <Field label="สถานะการประชุม" htmlFor="meeting-status"><select id="meeting-status" name="status" className="select"><option value="scheduled">กำหนดการประชุม</option><option value="completed">ประชุมแล้ว</option></select></Field>
        <div className="full-width"><Field label="สถานที่ / ช่องทางประชุม" htmlFor="meeting-location" required><input id="meeting-location" name="location" className="input" required maxLength={200} placeholder="ห้องประชุมหรือช่องทางออนไลน์" /></Field></div>
        <div className="full-width"><Field label="วาระเบื้องต้น" htmlFor="meeting-agenda" hint="พิมพ์หนึ่งวาระต่อบรรทัด หรือเว้นไว้เพื่อบันทึกเฉพาะข้อมูลประชุม"><textarea id="meeting-agenda" name="agenda" className="textarea" rows={4} placeholder={'เรื่องแจ้งเพื่อทราบ\nติดตามมติจากการประชุมครั้งก่อน\nเรื่องเสนอเพื่อพิจารณา'} /></Field></div>
        <div className="form-actions full-width"><Button disabled={busy} variant="secondary" type="button" onClick={() => setCreating(false)}>ยกเลิก</Button><Button disabled={busy} type="submit">บันทึกการประชุม</Button></div>
      </form>
    </Panel>}

    {nextMeeting && <div className="panel p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#edf3f2] text-[#28545b]"><CalendarDays size={24} /></div><div><div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone="info">การประชุมครั้งถัดไป</Badge><span className="muted text-small">ครั้งที่ {nextMeeting.number}</span></div><h2 className="text-base font-semibold">{nextMeeting.title}</h2><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#64757a]"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{formatThaiDate(nextMeeting.date)}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{nextMeeting.time} น.</span></div></div></div><Link className="button button-secondary shrink-0" href={`/meetings/${nextMeeting.id}`}>ดูวาระประชุม<ArrowRight size={16} /></Link></div></div>}

    <Panel title="ทะเบียนการประชุม" description={`${meetings.length} การประชุมตามเงื่อนไขที่เลือก`}>
      <div className="toolbar mb-5"><div className="search-input min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 text-[#849397]" size={17} /><input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="ค้นหาการประชุม" placeholder="ค้นหาชื่อ คณะกรรมการ หรือครั้งประชุม" /></div><select className="select sm:max-w-52" aria-label="สถานะการประชุม" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">ทุกสถานะ</option><option value="scheduled">กำหนดการประชุม</option><option value="completed">ประชุมแล้ว</option></select></div>
      {meetings.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>การประชุม</th><th>วันที่ / เวลา</th><th>วาระ / มติ</th><th>สถานะ</th><th><span className="sr-only">เปิดรายละเอียด</span></th></tr></thead><tbody>{meetings.map((meeting) => {
        const resolutionCount = new Set(meeting.agenda.flatMap((agenda) => agenda.resolutionIds)).size;
        return <tr key={meeting.id}><td><Link href={`/meetings/${meeting.id}`} className="font-medium hover:text-[#b87120]">{meeting.title}</Link><div className="muted text-small mt-1">ครั้งที่ {meeting.number}</div></td><td className="whitespace-nowrap">{formatThaiDate(meeting.date)}<div className="muted text-small mt-1">{meeting.time} น.</div></td><td className="whitespace-nowrap">{meeting.agenda.length} วาระ<span className="muted"> · {resolutionCount} มติ</span></td><td><Badge tone={meeting.status === 'scheduled' ? 'info' : 'neutral'}>{meeting.status === 'scheduled' ? 'กำหนดการประชุม' : 'ประชุมแล้ว'}</Badge></td><td><Link href={`/meetings/${meeting.id}`} className="inline-flex rounded-md p-2 text-[#64757a] hover:bg-[#edf3f2]" aria-label={`ดูการประชุมครั้งที่ ${meeting.number}`}><ArrowRight size={17} /></Link></td></tr>;
      })}</tbody></table></div> : <EmptyState icon={CalendarDays} title="ไม่พบการประชุมตามเงื่อนไข" description="ลองเปลี่ยนคำค้นหรือเลือกแสดงทุกสถานะ"><Button disabled={busy} variant="secondary" onClick={() => { setQuery(''); setStatus('all'); }}>ล้างตัวกรอง</Button></EmptyState>}
    </Panel>
  </div>;
}

export function MeetingDetailScreen({ id }: { id: string }) {
  const { state, mode, permissions, today, busy } = useDemo();
  const meeting = state.meetings.find((item) => item.id === id);
  if (!meeting) return <div className="page-stack"><PageHeader title="ไม่พบการประชุม" /><EmptyState icon={CalendarDays} title="ไม่มีการประชุมรายการนี้" description="รายการอาจไม่มีอยู่หรืออยู่นอกสิทธิของคุณ"><Link href="/meetings" className="button button-secondary">กลับทะเบียนประชุม</Link></EmptyState></div>;
  const resolutionIds = new Set(meeting.agenda.flatMap((agenda) => agenda.resolutionIds));
  const linkedResolutions = state.resolutions.filter((resolution) => resolutionIds.has(resolution.id));
  const tasks = state.tasks.filter((task) => resolutionIds.has(task.resolutionId));
  return <div className="page-stack">
    <Link href="/meetings" className="inline-flex w-fit items-center gap-2 text-sm text-[#64757a] hover:text-[#253b40]"><ArrowLeft size={16} />ทะเบียนการประชุม</Link>
    <PageHeader title={`การประชุมครั้งที่ ${meeting.number}`} description={meeting.title}><Button disabled={busy} variant="secondary" onClick={() => window.print()}><Printer size={16} />พิมพ์วาระ</Button></PageHeader>
    <div className="panel p-5 sm:p-6"><div className="flex flex-wrap gap-x-8 gap-y-4"><div className="inline-flex items-center gap-2 text-sm"><CalendarDays size={18} className="text-[#64757a]" />{formatThaiDate(meeting.date, { month: 'long' })}</div><div className="inline-flex items-center gap-2 text-sm"><Clock3 size={18} className="text-[#64757a]" />{meeting.time} น.</div><div className="inline-flex items-center gap-2 text-sm"><MapPin size={18} className="text-[#64757a]" />{meeting.location}</div><Badge tone={meeting.status === 'scheduled' ? 'info' : 'neutral'}>{meeting.status === 'scheduled' ? 'กำหนดการประชุม' : 'ประชุมแล้ว'}</Badge></div></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
      <Panel title="ระเบียบวาระการประชุม" description={`${meeting.agenda.length} วาระ · มติเดิมที่ติดตามซ้ำใช้รหัสเดิม`}>
        {meeting.agenda.length ? <div className="divide-y divide-[#e6ecea]">{meeting.agenda.map((agenda) => <div key={agenda.id} className="py-5 first:pt-0 last:pb-0"><div className="flex gap-4"><span className="mt-0.5 min-w-10 text-sm font-semibold tabular-nums text-[#64757a]">{agenda.number}</span><div className="min-w-0 flex-1"><h3 className="text-[15px] font-semibold">{agenda.title}</h3>{agenda.resolutionIds.length ? <div className="mt-3 space-y-2">{agenda.resolutionIds.map((resolutionId) => { const resolution = state.resolutions.find((item) => item.id === resolutionId); return resolution ? <Link key={resolutionId} href={`/resolutions/${resolutionId}`} className="flex items-start justify-between gap-3 rounded-lg bg-[#f5f8f7] px-3 py-2.5 text-sm transition-colors hover:bg-[#eaf1ef]"><div><span className="mr-2 font-medium text-[#53756b]">{resolution.code}</span>{resolution.title}</div><ArrowRight size={15} className="mt-1 shrink-0 text-[#64757a]" /></Link> : null; })}</div> : <p className="muted text-small mt-2">ยังไม่มีมติที่เชื่อมกับวาระนี้</p>}</div></div></div>)}</div> : <EmptyState icon={FileText} title="ยังไม่มีวาระ" description="การประชุมนี้บันทึกไว้เฉพาะข้อมูลวัน เวลา และสถานที่" />}
      </Panel>
      <div className="stack"><Panel title="ภาพรวมมติที่เกี่ยวข้อง"><dl className="divide-y divide-[#e6ecea]"><div className="flex justify-between py-3 first:pt-0"><dt className="muted">มติที่ติดตาม</dt><dd className="font-semibold tabular-nums">{linkedResolutions.length} มติ</dd></div><div className="flex justify-between py-3"><dt className="muted">งานตามมติ</dt><dd className="font-semibold tabular-nums">{tasks.length} งาน</dd></div><div className="flex justify-between py-3 last:pb-0"><dt className="muted">ตรวจรับแล้ว</dt><dd className="font-semibold tabular-nums text-[#3c7860]">{tasks.filter((task) => task.status === 'accepted').length} งาน</dd></div></dl></Panel>
      {linkedResolutions.length > 0 && <Panel title="ความก้าวหน้ารายมติ"><div className="space-y-5">{linkedResolutions.map((resolution) => <div key={resolution.id}><Link href={`/resolutions/${resolution.id}`} className="mb-2 block text-sm font-medium hover:text-[#b87120]">{resolution.title}</Link><ProgressBar value={getResolutionProgress(resolution.id, state.tasks)} /></div>)}</div><p className="muted text-small mt-5">ความก้าวหน้าที่รายงานแยกจากการตรวจรับและการรับรองปิดมติ</p></Panel>}</div>
    </div>
  </div>;
}
