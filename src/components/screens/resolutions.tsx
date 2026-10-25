'use client';

import { AccessLink as Link } from '@/components/app-shell';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useWorkspace } from '@/components/workspace-context';
import { Avatar, Badge, EmptyState, PageHeader, ProgressBar } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';

import { buildTaskIndex, EMPTY_RESOLUTION_TASKS } from '@/lib/workspace-selectors';

const PAGE_SIZE = 8;

export function ResolutionsScreen({ initialStatus = 'all' }: { initialStatus?: string }) {
  const { state, permissions, users, today } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const taskIndex = useMemo(() => buildTaskIndex(state.tasks, today), [state.tasks, today]);
  const usersById = useMemo(() => new Map(users.map((person) => [person.id, person])), [users]);
  const filtered = state.resolutions.filter(
    (resolution) =>
      `${resolution.title} ${resolution.code} ${resolution.content}`.includes(query) &&
      (status === 'all' ||
        (status === 'active'
          ? ['open', 'pending_close'].includes(resolution.status)
          : resolution.status === status)) &&
      (type === 'all' || resolution.type === type),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const items = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  function resetFilters() {
    setQuery('');
    setStatus('all');
    setType('all');
    setPage(1);
  }
  return (
    <div className="page-stack">
      <PageHeader
        title="ทะเบียนมติ"
        description="เชื่อมทุกมติกับงาน ผู้รับผิดชอบ และหลักฐานในที่เดียว"
      >
        {permissions.includes('resolution.draft') && (
          <Link href="/resolutions/new" className="button button-primary">
            <Plus size={17} />
            บันทึกมติใหม่
          </Link>
        )}
      </PageHeader>
      <div className="register-summary">
        <span>
          <strong>{state.resolutions.length}</strong> มติทั้งหมด
        </span>
        <span>
          <i className="summary-dot info" />
          เปิดติดตาม {state.resolutions.filter((item) => item.status === 'open').length}
        </span>
        <span>
          <i className="summary-dot warning" />
          รอรับรองปิด {state.resolutions.filter((item) => item.status === 'pending_close').length}
        </span>
        <span>
          <i className="summary-dot success" />
          ปิดมติแล้ว {state.resolutions.filter((item) => item.status === 'closed').length}
        </span>
      </div>
      <section className="panel">
        <div className="register-toolbar">
          <div className="toolbar">
            <div className="search-input">
              <Search size={17} />
              <input
                className="input"
                aria-label="ค้นหามติ"
                placeholder="ค้นหาด้วยเรื่องหรือรหัสมติ..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="select"
              aria-label="สถานะมติ"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">เปิดติดตามทั้งหมด</option>
              <option value="open">เปิดติดตาม</option>
              <option value="pending_close">รอรับรองปิด</option>
              <option value="closed">ปิดมติแล้ว</option>
              <option value="acknowledged">รับทราบ</option>
            </select>
            <select
              className="select"
              aria-label="ประเภทมติ"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">ทุกประเภท</option>
              <option value="action">มอบหมายดำเนินการ</option>
              <option value="approval">เห็นชอบ / อนุมัติ</option>
              <option value="acknowledgment">รับทราบ</option>
              <option value="recurring">ดำเนินการต่อเนื่อง</option>
            </select>
            {(query || status !== 'all' || type !== 'all') && (
              <button className="button button-ghost button-sm" onClick={resetFilters}>
                ล้างตัวกรอง
              </button>
            )}
            <span className="filter-total">
              <SlidersHorizontal size={14} />
              {filtered.length} เรื่อง
            </span>
          </div>
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table className="data-table resolution-table">
              <thead>
                <tr>
                  <th>รหัส / เรื่องมติ</th>
                  <th>ผู้ประสานหลัก</th>
                  <th>สถานะ</th>
                  <th>ความก้าวหน้า</th>
                  <th>กำหนดส่ง</th>
                  <th aria-label="เปิดมติ" />
                </tr>
              </thead>
              <tbody>
                {items.map((resolution) => {
                  const group = taskIndex.byResolution.get(resolution.id) ?? EMPTY_RESOLUTION_TASKS;
                  const tasks = group.tasks;
                  const person = usersById.get(resolution.coordinatorId);
                  const late = group.overdue > 0;
                  return (
                    <tr key={resolution.id}>
                      <td>
                        <span className="resolution-code">{resolution.code}</span>
                        <Link className="table-title" href={`/resolutions/${resolution.id}`}>
                          {resolution.title}
                        </Link>
                        <span className="table-subtitle">{resolution.unit}</span>
                      </td>
                      <td>
                        <div className="cluster flex-nowrap">
                          <Avatar userId={person?.id} size="sm" />
                          <span className="text-small">{person?.name.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td>
                        <Badge status={resolution.status} />
                      </td>
                      <td>
                        {tasks.length ? (
                          <>
                            <ProgressBar value={group.progress} />
                            <span className="table-subtitle">{tasks.length} งานที่เกี่ยวข้อง</span>
                          </>
                        ) : (
                          <span className="muted text-small">ไม่มีงานติดตาม</span>
                        )}
                      </td>
                      <td>
                        <span className="due-cell">{formatThaiDate(resolution.dueDate)}</span>
                        {late && <span className="table-subtitle text-danger">มีงานเกินกำหนด</span>}
                      </td>
                      <td>
                        <Link
                          className="icon-button"
                          href={`/resolutions/${resolution.id}`}
                          aria-label={`ดูรายละเอียด ${resolution.title}`}
                        >
                          <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="ไม่พบมติที่ตรงกับตัวกรอง"
            description="ลองเปลี่ยนคำค้นหรือแสดงทุกสถานะ เพื่อค้นหามติที่ต้องการ"
          >
            <button className="button button-secondary" onClick={resetFilters}>
              แสดงมติทั้งหมด
            </button>
          </EmptyState>
        )}
        <div className="table-footer">
          <span>
            แสดง {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} จาก {filtered.length} เรื่อง
          </span>
          <div className="cluster">
            <button
              className="icon-button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="หน้าก่อน"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              หน้า {safePage} / {pageCount}
            </span>
            <button
              className="icon-button"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
              aria-label="หน้าถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
