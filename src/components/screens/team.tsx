'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Users, X } from 'lucide-react';
import { useDemo } from '@/components/demo-provider';
import { Avatar, Badge, Button, EmptyState, PageHeader, Panel } from '@/components/ui';
import { formatThaiDate, isOverdue } from '@/lib/workflow';
import type { Role } from '@/lib/types';

const roles: Record<Role, string> = { secretary: 'เลขานุการ', owner: 'ผู้รับผิดชอบ', reviewer: 'ผู้ตรวจผล', executive: 'ผู้บริหาร' };

export function TeamScreen() {
  const { state, mode, permissions, users, today, units } = useDemo();
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = users.filter((person) => (unit === 'all' || person.unit === unit) && `${person.name} ${person.unit} ${roles[person.role]}`.includes(query));
  const selected = users.find((person) => person.id === selectedId);
  const selectedTasks = state.tasks.filter((task) => task.ownerId === selectedId || task.reviewerId === selectedId);

  return <div className="page-stack">
    <PageHeader title="บุคลากรและหน่วยงาน" description="ผู้ประสานงาน ผู้รับผิดชอบ และภาระงานในระบบติดตามมติ"><Badge tone="neutral">{users.length} {mode === 'demo' ? 'บัญชีตัวอย่าง' : 'บุคลากรในขอบเขต'}</Badge></PageHeader>
    <Panel title="รายชื่อบุคลากร" description="เลือกชื่อเพื่อดูงานที่รับผิดชอบและคิวตรวจผล">
      <div className="toolbar mb-5"><div className="search-input min-w-0 flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-[#849397]" /><input className="input pl-10" aria-label="ค้นหาบุคลากร" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ หน่วยงาน หรือบทบาท" /></div><select className="select sm:max-w-64" aria-label="กรองหน่วยงานบุคลากร" value={unit} onChange={(event) => setUnit(event.target.value)}><option value="all">ทุกหน่วยงาน</option>{units.map((name) => <option key={name}>{name}</option>)}</select></div>
      {filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>บุคลากร</th><th>หน่วยงาน</th><th>บทบาทหลัก</th><th className="text-right">งานที่รับผิดชอบ</th><th className="text-right">เกินกำหนด</th><th><span className="sr-only">ดูรายละเอียด</span></th></tr></thead><tbody>{filtered.map((person) => {
        const activeTasks = state.tasks.filter((task) => task.ownerId === person.id && !['accepted', 'cancelled'].includes(task.status));
        const overdue = activeTasks.filter((task) => isOverdue(task, today)).length;
        return <tr key={person.id}><td><button className="flex items-center gap-3 text-left" onClick={() => setSelectedId(person.id)} type="button"><Avatar userId={person.id} /><span><span className="block font-medium hover:text-[#b87120]">{person.name}</span><span className="muted text-small">{person.id === state.currentUserId ? 'บัญชีของคุณ' : mode === 'demo' ? 'ผู้ใช้งานตัวอย่าง' : 'สมาชิกพื้นที่ทำงาน'}</span></span></button></td><td>{person.unit}</td><td><Badge tone="neutral">{roles[person.role]}</Badge></td><td className="text-right tabular-nums">{activeTasks.length}<span className="muted ml-1">งาน</span></td><td className={`text-right tabular-nums ${overdue ? 'font-medium text-[#a14c3f]' : 'muted'}`}>{overdue || '—'}</td><td><Button variant="ghost" size="sm" aria-label={`ดูงานของ${person.name}`} onClick={() => setSelectedId(person.id)}><ArrowRight size={17} /></Button></td></tr>;
      })}</tbody></table></div> : <EmptyState icon={Users} title="ไม่พบบุคลากรตามเงื่อนไข" description="ลองค้นหาด้วยชื่อหรือเลือกแสดงทุกหน่วยงาน"><Button variant="secondary" onClick={() => { setQuery(''); setUnit('all'); }}>ล้างตัวกรอง</Button></EmptyState>}
    </Panel>
    {selected && <Panel title={selected.name} description={`${roles[selected.role]} · ${selected.unit}`} action={<Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} aria-label="ปิดรายละเอียดบุคลากร"><X size={18} /></Button>}>
      {selectedTasks.length ? <div className="divide-y divide-[#e6ecea]">{selectedTasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="min-w-0"><Link href={`/tasks/${task.id}`} className="text-sm font-medium hover:text-[#b87120]">{task.title}</Link><div className="muted text-small mt-1">{task.code} · {task.ownerId === selected.id ? 'ผู้รับผิดชอบหลัก' : 'ผู้ตรวจผล'} · ส่งภายใน {formatThaiDate(task.dueDate)}</div></div><Badge status={task.status} /></div>)}</div> : <EmptyState icon={Users} title="ไม่มีงานที่มอบหมายโดยตรง" description="บทบาทนี้อาจทำหน้าที่ประสานงานหรือติดตามภาพรวมแทนการเป็นเจ้าของงาน" />}
    </Panel>}
    <div className="inline-alert text-sm">{mode === 'demo' ? 'รายชื่อและหน่วยงานทั้งหมดเป็นข้อมูลสมมติสำหรับทดลองหน้าจอ' : 'แสดงบุคลากรตามสิทธิของคุณ การเพิ่มสมาชิกหรือปรับสิทธิต้องดำเนินการโดยผู้ดูแลพื้นที่ทำงาน'}</div>
  </div>;
}
