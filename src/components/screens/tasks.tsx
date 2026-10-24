'use client';

import { AccessLink as Link } from "@/components/app-shell";
import { useMemo, useState } from 'react';
import { ArrowRight, CheckCheck, ClipboardList, FileDown, Search } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Avatar, Badge, EmptyState, PageHeader, Panel, ProgressBar } from '@/components/ui';
import { daysUntil, formatThaiDate, isOverdue } from '@/lib/workflow';
import type { TaskStatus } from '@/lib/types';

export const taskStatusLabels: Record<TaskStatus, string> = {
  assigned: 'มอบหมายแล้ว', in_progress: 'กำลังดำเนินการ', submitted: 'ส่งตรวจแล้ว',
  revision: 'ให้แก้ไข', accepted: 'ตรวจรับแล้ว', cancelled: 'ยุติงาน',
};

export function TasksScreen({ initialStatus, initialScope }: { initialStatus?: string; initialScope?: string }) {
  const { state, access, mode, permissions, users, today, units } = useDemo();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(initialStatus ?? 'all');
  const [scope, setScope] = useState(initialScope ?? (initialStatus ? 'all' : 'mine'));
  const [unit, setUnit] = useState('all');
  const filtered = useMemo(() => state.tasks.filter((task) => {
    const resolution = state.resolutions.find((item) => item.id === task.resolutionId);
    const needle = query.trim().toLowerCase();
    if (needle && !`${task.title} ${task.code} ${task.unit} ${resolution?.code ?? ''}`.toLowerCase().includes(needle)) return false;
    if (scope === 'mine' && task.ownerId !== state.currentUserId) return false;
    if (unit !== 'all' && task.unit !== unit) return false;
    if (status === 'overdue') return isOverdue(task, today);
    if (status === 'due_soon') {
      const days = daysUntil(task.dueDate, today);
      return task.status !== 'accepted' && task.status !== 'cancelled' && days !== null && days >= 0 && days <= 7;
    }
    return status === 'all' || task.status === status;
  }), [query, scope, unit, status, state, today]);
  const overdueCount = state.tasks.filter((task) => isOverdue(task, today)).length;
  const mineCount = state.tasks.filter((task) => task.ownerId === state.currentUserId).length;

  return <div className="page-stack">
    <PageHeader title="งานตามมติ" description="ติดตามงาน รับทราบการมอบหมาย และรายงานผลให้ครบตามเกณฑ์">
      <Link href="/reports" className="button button-secondary"><FileDown size={17} /> ดูรายงานงาน</Link>
    </PageHeader>

    <div className="flex flex-wrap items-center justify-between gap-3">
      {access.role === 'staff' ? <p className="text-sm font-medium">งานของฉันทั้งหมด <span className="tabular-nums">{mineCount}</span> งาน</p> : <div className="tabs" aria-label="ขอบเขตงาน">
        <button className={`tab ${scope === 'all' ? 'active' : ''}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>งานทั้งหมด <span>{state.tasks.length}</span></button>
        <button className={`tab ${scope === 'mine' ? 'active' : ''}`} aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>งานของฉัน <span>{mineCount}</span></button>
      </div>}
      <p className="text-small muted">{mode === 'demo' ? 'ข้อมูลตัวอย่าง' : 'ข้อมูลตามสิทธิของคุณ'} ณ {formatThaiDate(today)}</p>
    </div>

    <Panel className="no-pad">
      <div className="toolbar flex-wrap px-5 py-5">
        <label className="search-input min-w-0 flex-1">
          <Search size={18} aria-hidden="true" />
          <input className="input" aria-label="ค้นหางาน" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่องาน รหัสงาน หรือรหัสมติ" />
        </label>
        <select className="select" aria-label="กรองสถานะงาน" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">ทุกสถานะ</option><option value="overdue">เกินกำหนด ({overdueCount})</option><option value="due_soon">ครบกำหนดใน 7 วัน</option>
          {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="select" aria-label="กรองหน่วยงาน" value={unit} onChange={(event) => setUnit(event.target.value)}>
          <option value="all">ทุกหน่วยงาน</option>{units.map((name) => <option key={name}>{name}</option>)}
        </select>
      </div>
      {filtered.length ? <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">งานตามมติ {filtered.length} รายการตามตัวกรองที่เลือก</caption>
          <thead><tr><th scope="col">งาน / มติที่เกี่ยวข้อง</th><th scope="col">ผู้รับผิดชอบ</th><th scope="col">กำหนดส่ง</th><th scope="col">สถานะ</th><th scope="col">ความก้าวหน้า</th><th scope="col"><span className="sr-only">เปิดงาน</span></th></tr></thead>
          <tbody>{filtered.map((task) => {
            const owner = users.find((item) => item.id === task.ownerId);
            const resolution = state.resolutions.find((item) => item.id === task.resolutionId);
            const overdue = isOverdue(task, today);
            const days = daysUntil(task.dueDate, today);
            return <tr key={task.id}>
              <td className="min-w-[260px] max-w-[390px]">
                <Link href={`/tasks/${task.id}`} className="font-medium leading-relaxed hover:underline">{task.title}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs muted"><span>{task.code}</span><span aria-hidden="true">·</span><Link href={`/resolutions/${task.resolutionId}`} className="hover:underline">{resolution?.code ?? 'ดูมติ'}</Link>{task.priority === 'high' && <span className="font-medium text-[#9b5620]">สำคัญ</span>}</div>
              </td>
              <td><div className="flex items-center gap-2.5"><Avatar userId={task.ownerId} size="sm" /><div><div className="whitespace-nowrap text-sm">{owner?.name.split(' ')[0] ?? 'ไม่ระบุ'}</div><div className="mt-0.5 text-xs muted max-w-[150px]">{task.unit}</div></div></div></td>
              <td className="whitespace-nowrap"><div className={overdue ? 'font-medium text-[#a83e32]' : ''}>{formatThaiDate(task.dueDate, { year: undefined })}</div>{overdue ? <div className="mt-1 text-xs text-[#a83e32]">เกิน {Math.abs(days ?? 0)} วัน</div> : days === 0 && task.status !== 'accepted' && task.status !== 'cancelled' ? <div className="mt-1 text-xs text-[#9b651c]">ครบกำหนดวันนี้</div> : task.originalDueDate !== task.dueDate ? <div className="mt-1 text-xs muted">ขยายกำหนดแล้ว</div> : null}</td>
              <td><Badge status={task.status}>{taskStatusLabels[task.status]}</Badge>{task.status === 'assigned' && !task.acknowledgedAt && <div className="mt-1 text-xs muted">ยังไม่รับทราบ</div>}</td>
              <td className="min-w-[120px]"><ProgressBar value={task.progress} label={`${task.progress}%`} /></td>
              <td><Link href={`/tasks/${task.id}`} className="button button-ghost p-2" aria-label={`เปิดงาน ${task.title}`}><ArrowRight size={18} /></Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <EmptyState icon={scope === 'mine' ? CheckCheck : ClipboardList} title={scope === 'mine' && !query && status === 'all' ? 'ไม่มีงานที่มอบหมายให้บทบาทนี้' : 'ไม่พบงานตามเงื่อนไข'} description={scope === 'mine' ? (mode === 'demo' ? 'ลองดูงานทั้งหมด หรือสลับเป็นบทบาทผู้ปฏิบัติงานเพื่อทดลองรายงานผล' : 'ดูงานทั้งหมดที่ได้รับสิทธิ หรือรอการมอบหมายงานจากผู้ประสาน') : 'ลองค้นหาด้วยคำที่สั้นลง หรือเลือกทุกสถานะและทุกหน่วยงาน'}>
        <button className="button button-secondary" onClick={() => { setQuery(''); setStatus('all'); setUnit('all'); setScope('all'); }}>แสดงงานทั้งหมด</button>
      </EmptyState>}
      <div className="flex items-center justify-between border-t border-[#e0e7e5] px-5 py-4 text-xs muted"><span>แสดง {filtered.length} จาก {state.tasks.length} งาน</span><span>ความก้าวหน้าไม่ใช่ผลตรวจรับ</span></div>
    </Panel>
  </div>;
}
