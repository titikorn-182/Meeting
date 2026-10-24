'use client';

import { useMemo, useState } from 'react';
import { AccessLink as Link } from "@/components/app-shell";
import { ArrowDownToLine, ArrowRight, ChartNoAxesCombined, FileSpreadsheet, Printer } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Badge, Button, EmptyState, PageHeader, Panel } from '@/components/ui';
import { daysUntil, formatThaiDate, isOverdue } from '@/lib/workflow';
import { isWorkspaceSnapshot } from '@/lib/workspace';
import type { TaskStatus } from '@/lib/types';

const statusLabels: Record<TaskStatus, string> = { assigned: 'มอบหมายแล้ว', in_progress: 'กำลังดำเนินการ', submitted: 'ส่งตรวจ', revision: 'ให้แก้ไข', accepted: 'ตรวจรับแล้ว', cancelled: 'ยกเลิก' };

function csvCell(value: string | number) {
  const text = String(value);
  const protectedText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}

export function ReportsScreen() {
  const { state, notify, mode, permissions, users, today, units, refresh, busy } = useDemo();
  const [exporting, setExporting] = useState(false);
  const [unit, setUnit] = useState('all');
  const [meetingId, setMeetingId] = useState('all');
  const [view, setView] = useState<'units' | 'tasks' | 'overdue'>('units');
  const filtered = useMemo(() => state.tasks.filter((task) => {
    const resolution = state.resolutions.find((item) => item.id === task.resolutionId);
    return (unit === 'all' || task.unit === unit) && (meetingId === 'all' || resolution?.meetingId === meetingId);
  }), [state.tasks, state.resolutions, unit, meetingId]);
  const shown = view === 'overdue' ? filtered.filter((task) => isOverdue(task, today)) : filtered;
  const accepted = filtered.filter((task) => task.status === 'accepted');
  const overdue = filtered.filter((task) => isOverdue(task, today));
  const waiting = filtered.filter((task) => task.status === 'submitted');
  const dueCohort = filtered.filter((task) => (daysUntil(task.originalDueDate, today) ?? 1) < 0);
  const onTime = dueCohort.filter((task) => task.status === 'accepted' && task.acceptedAt && (daysUntil(task.originalDueDate, task.acceptedAt) ?? -1) >= 0);
  const unitRows = Array.from(new Set(filtered.map((task) => task.unit))).map((name) => {
    const tasks = filtered.filter((task) => task.unit === name);
    return { name, total: tasks.length, active: tasks.filter((task) => !['accepted', 'cancelled'].includes(task.status)).length, accepted: tasks.filter((task) => task.status === 'accepted').length, overdue: tasks.filter((task) => isOverdue(task, today)).length, waiting: tasks.filter((task) => task.status === 'submitted').length };
  });

  async function exportSource() {
    if (!permissions.includes('report.export')) throw new Error('บัญชีนี้ยังไม่มีสิทธิส่งออกรายงาน');
    if (mode === 'demo') return { state, users };
    const response = await fetch('/api/workspace', { credentials: 'same-origin', cache: 'no-store' });
    const snapshot: unknown = await response.json();
    if (!response.ok || !isWorkspaceSnapshot(snapshot)) {
      await refresh();
      throw new Error('ไม่สามารถโหลดข้อมูลล่าสุดเพื่อตรวจสิทธิส่งออก กรุณาลองอีกครั้ง');
    }
    if (!snapshot.permissions.includes('report.export')) throw new Error('บัญชีนี้ยังไม่มีสิทธิส่งออกรายงาน');
    return { state: snapshot.state, users: snapshot.users };
  }

  async function printReport() {
    if (exporting || busy) return;
    setExporting(true);
    try {
      await exportSource();
      if (mode === 'supabase' && !(await refresh())) return;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } catch (error) { notify(error instanceof Error ? error.message : 'ยังพิมพ์รายงานไม่ได้', 'error'); }
    finally { setExporting(false); }
  }

  async function downloadReport() {
    if (exporting || busy) return;
    setExporting(true);
    try {
      const source = await exportSource();
      const current = source.state;
      const tasks = current.tasks.filter((task) => {
        const resolution = current.resolutions.find((item) => item.id === task.resolutionId);
        return (unit === 'all' || task.unit === unit) && (meetingId === 'all' || resolution?.meetingId === meetingId);
      });
      const selected = view === 'overdue' ? tasks.filter((task) => isOverdue(task, today)) : tasks;
      const grouped = [...new Set(tasks.map((task) => task.unit))].map((name) => {
        const group = tasks.filter((task) => task.unit === name);
        return [name, group.length, group.filter((task) => !['accepted', 'cancelled'].includes(task.status)).length, group.filter((task) => task.status === 'submitted').length, group.filter((task) => isOverdue(task, today)).length, group.filter((task) => task.status === 'accepted').length];
      });
      const rows: (string | number)[][] = view === 'units'
        ? [['หน่วยงาน', 'งานทั้งหมด', 'ระหว่างดำเนินการ', 'รอตรวจ', 'เกินกำหนด', 'ตรวจรับแล้ว'], ...grouped]
        : [['รหัสงาน', 'รหัสมติ', 'ชื่องาน', 'หน่วยงาน', 'ผู้รับผิดชอบ', 'กำหนดเดิม', 'กำหนดปัจจุบัน', 'สถานะ', 'เวลาส่งผลงาน', 'เวลาตรวจรับ'], ...selected.map((task) => [task.code, current.resolutions.find((item) => item.id === task.resolutionId)?.code ?? '', task.title, task.unit, source.users.find((person) => person.id === task.ownerId)?.name ?? '', task.originalDueDate, task.dueDate, statusLabels[task.status], task.submittedAt ?? '', task.acceptedAt ?? ''])];
      const metadata = [['รายงาน', view === 'units' ? 'สรุปรายหน่วยงาน' : view === 'overdue' ? 'งานค้างเกินกำหนด' : 'ติดตามงานตามมติ'], ['วันที่อ้างอิง', today], ['ลักษณะข้อมูล', mode === 'demo' ? 'ข้อมูลตัวอย่างตามสถานะปัจจุบัน' : 'ข้อมูลปัจจุบันตามสิทธิ ณ เวลาส่งออก ไม่ใช่ KPI ย้อนหลังที่รับรองแล้ว'], ['ส่งออกเมื่อ', new Date().toISOString()], ['หน่วยงาน', unit === 'all' ? 'ทุกหน่วยงาน' : unit], ['การประชุมต้นทาง', meetingId === 'all' ? 'ทุกการประชุม' : current.meetings.find((meeting) => meeting.id === meetingId)?.number ?? meetingId], []];
      const csv = '\uFEFF' + [...metadata, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'POLUBU-' + view + '-' + today + '.csv';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('ดาวน์โหลดรายงาน CSV ตามตัวกรองแล้ว', 'success');
    } catch (error) { notify(error instanceof Error ? error.message : 'ยังส่งออกรายงานไม่ได้ กรุณาลองอีกครั้ง', 'error'); }
    finally { setExporting(false); }
  }

  return <div className="page-stack">
    <PageHeader title="รายงานและผลดำเนินงาน" description="ติดตามภาพรวมจากมติถึงงาน พร้อมข้อมูลต้นทางที่ตรวจสอบได้"><Button disabled={exporting || busy || !permissions.includes('report.export')} variant="secondary" onClick={printReport}><Printer size={16} />พิมพ์รายงาน</Button><Button disabled={exporting || busy || !permissions.includes('report.export')} onClick={downloadReport}><ArrowDownToLine size={17} />ส่งออก CSV</Button></PageHeader>
    <div className="panel p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ChartNoAxesCombined size={19} className="text-[#53756b]" /><span className="font-medium">ภาพรวม ณ {formatThaiDate(today)}</span></div><Badge tone="neutral">{mode === 'demo' ? 'สถานะปัจจุบันของข้อมูลตัวอย่าง' : 'ข้อมูลปัจจุบันตามสิทธิของคุณ'}</Badge></div><p className="muted text-small mt-2">{mode === 'demo' ? 'ผลรวมเปลี่ยนตามการดำเนินการในระบบทดลอง และใช้วันอ้างอิงเดียวกับหน้าติดตามงาน' : 'สรุปการติดตามงานปัจจุบัน รายงานนี้ยังไม่ใช่ KPI ย้อนหลังหรือ snapshot ที่รับรองแล้ว'}</p><div className="mt-6 grid grid-cols-2 gap-5 border-t border-[#e0e7e5] pt-5 sm:grid-cols-4">{[{ label: 'งานในขอบเขต', count: filtered.length, color: '#253b40' }, { label: 'ตรวจรับแล้ว', count: accepted.length, color: '#3c7860' }, { label: 'ส่งตรวจ', count: waiting.length, color: '#4b7088' }, { label: 'เกินกำหนด', count: overdue.length, color: '#a14c3f' }].map((metric) => <div key={metric.label}><div className="text-sm text-[#64757a]">{metric.label}</div><div className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: metric.color }}>{metric.count}<span className="ml-2 text-sm font-normal text-[#64757a]">งาน</span></div></div>)}</div></div>
    <Panel title="รายละเอียดรายงาน" action={<span className="muted text-small">หน่วยนับ: งาน</span>}>
      <div className="toolbar mb-5"><select className="select" aria-label="หน่วยงานในรายงาน" value={unit} onChange={(event) => setUnit(event.target.value)}><option value="all">ทุกหน่วยงาน</option>{units.map((name) => <option key={name}>{name}</option>)}</select><select className="select" aria-label="การประชุมต้นทางในรายงาน" value={meetingId} onChange={(event) => setMeetingId(event.target.value)}><option value="all">ทุกการประชุมต้นทาง</option>{state.meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.committee} ครั้งที่ {meeting.number}</option>)}</select>{(unit !== 'all' || meetingId !== 'all') && <Button variant="ghost" onClick={() => { setUnit('all'); setMeetingId('all'); }}>ล้างตัวกรอง</Button>}</div>
      <div className="tabs mb-5" role="tablist" aria-label="รูปแบบรายงาน">{([{ key: 'units', label: 'สรุปรายหน่วยงาน' }, { key: 'tasks', label: 'งานตามมติทั้งหมด' }, { key: 'overdue', label: `งานเกินกำหนด (${overdue.length})` }] as const).map((item) => <button key={item.key} type="button" className={`tab ${view === item.key ? 'active' : ''}`} role="tab" aria-selected={view === item.key} onClick={() => setView(item.key)}>{item.label}</button>)}</div>
      {view === 'units' && unitRows.length > 0 ? <div className="table-scroll"><table className="data-table"><thead><tr><th>หน่วยงาน</th><th className="text-right">งานทั้งหมด</th><th className="text-right">กำลังติดตาม</th><th className="text-right">ส่งตรวจ</th><th className="text-right">เกินกำหนด</th><th className="text-right">ตรวจรับแล้ว</th><th><span className="sr-only">ดูงาน</span></th></tr></thead><tbody>{unitRows.map((row) => <tr key={row.name}><td className="font-medium">{row.name}</td><td className="text-right tabular-nums">{row.total}</td><td className="text-right tabular-nums">{row.active}</td><td className="text-right tabular-nums">{row.waiting || '—'}</td><td className="text-right tabular-nums"><span className={row.overdue ? 'font-medium text-[#a14c3f]' : 'muted'}>{row.overdue || '—'}</span></td><td className="text-right font-medium tabular-nums text-[#3c7860]">{row.accepted}</td><td><button type="button" className="rounded-md p-2 text-[#64757a] hover:bg-[#edf3f2]" onClick={() => { setUnit(row.name); setView('tasks'); }} aria-label={`ดูงานของ${row.name}`}><ArrowRight size={17} /></button></td></tr>)}</tbody></table><p className="muted text-small mt-4">“ส่งตรวจ” และ “เกินกำหนด” เป็นกลุ่มย่อยของงานที่กำลังติดตาม จึงอาจนับงานเดียวกันได้</p></div> : view !== 'units' && shown.length > 0 ? <div className="table-scroll"><table className="data-table"><thead><tr><th>งาน / มติอ้างอิง</th><th>ผู้รับผิดชอบ</th><th>กำหนดเดิม</th><th>กำหนดปัจจุบัน</th><th>สถานะ</th></tr></thead><tbody>{shown.map((task) => <tr key={task.id}><td className="min-w-64"><Link href={`/tasks/${task.id}`} className="font-medium hover:text-[#b87120]">{task.title}</Link><div className="muted text-small mt-1">{task.code} · {state.resolutions.find((resolution) => resolution.id === task.resolutionId)?.code}</div></td><td className="whitespace-nowrap">{users.find((person) => person.id === task.ownerId)?.name}</td><td className="whitespace-nowrap text-sm text-[#64757a]">{formatThaiDate(task.originalDueDate)}</td><td className={`whitespace-nowrap text-sm ${isOverdue(task, today) ? 'text-[#a14c3f]' : ''}`}>{formatThaiDate(task.dueDate)}</td><td><Badge status={task.status} /></td></tr>)}</tbody></table></div> : <EmptyState icon={FileSpreadsheet} title={view === 'overdue' ? 'ไม่มีงานเกินกำหนดในขอบเขตนี้' : 'ไม่พบข้อมูลรายงาน'} description="ปรับหน่วยงานหรือการประชุมต้นทางเพื่อดูรายการอื่น" />}
    </Panel>
    <div className="grid gap-5 lg:grid-cols-2"><Panel title="การตรวจรับทันกำหนดเดิม" description="ข้อมูลปัจจุบันเบื้องต้น ไม่ใช่สูตร KPI ที่รับรองตามช่วงรายงาน"><div className="flex items-end justify-between gap-4"><div><span className="text-3xl font-semibold tabular-nums">{dueCohort.length ? `${Math.round(onTime.length / dueCohort.length * 100)}%` : '—'}</span><p className="muted text-small mt-2">{dueCohort.length ? `${onTime.length} / ${dueCohort.length} งานที่กำหนดเดิมผ่านแล้ว` : 'ยังไม่มีงานที่กำหนดเดิมผ่านแล้ว'}</p></div><span className="text-small text-[#64757a]">สิ้นสุดวันก่อนวันอ้างอิง</span></div><p className="muted text-small mt-4">นับงานที่ตรวจรับไม่เกินกำหนดเดิม งานที่รอตรวจหรือยกเลิกไม่ถูกนับเป็นสำเร็จ และยังอยู่ในฐานงานเดิม</p></Panel><Panel title="อ่านตัวเลขให้ตรงกับงาน"><ul className="space-y-3 text-sm leading-relaxed text-[#64757a]"><li>การส่งทันกำหนดและการตรวจรับทันกำหนดเป็นคนละเหตุการณ์</li><li>งานที่ส่งตรวจแล้วยังอยู่ในรายการติดตามจนมีผลตรวจรับ</li><li>รายงานนี้สรุปข้อมูลปัจจุบัน ไม่ได้สร้างสถานะย้อนหลังตามวันในอดีต</li></ul><Link href="/reviews" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#53756b]">ไปยังคิวตรวจรับ<ArrowRight size={15} /></Link></Panel></div>
  </div>;
}
