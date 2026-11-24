'use client';
import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Search, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-context';
import { AccessLink as Link } from '@/components/app-shell';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui';
import { canAccessPage } from '@/lib/access-control';
import { buildTaskIndex, EMPTY_RESOLUTION_TASKS } from '@/lib/workspace-selectors';
export function ClosureQueue() {
  const { state, access, today, permissions } = useWorkspace();
  const [query, setQuery] = useState('');
  const index = useMemo(() => buildTaskIndex(state.tasks, today), [state.tasks, today]);
  const contextAvailable =
    (canAccessPage(access, 'tasks') || canAccessPage(access, 'reviews')) &&
    canAccessPage(access, 'changes');
  const items = state.resolutions.filter(
    (item) =>
      item.status === 'pending_close' &&
      `${item.code} ${item.title} ${item.unit}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="page-stack">
      <Link href="/resolutions" className="back-link">
        <ArrowLeft size={16} />
        ทะเบียนมติ
      </Link>
      <PageHeader
        title="มติรอรับรองปิด"
        description="ตรวจงานที่ผ่านรับรองแล้ว ก่อนพิจารณาเกณฑ์สำเร็จระดับมติ"
      />
      {!contextAvailable && (
        <p className="inline-alert warning">
          เห็นรายการมติได้ แต่ยังตรวจเงื่อนไขปิดได้ไม่ครบ ให้ Admin เปิดสิทธิ์งานหรือตรวจผล
          และคำขอเปลี่ยนแปลงก่อนรับรองปิด
        </p>
      )}
      {!permissions.includes('resolution.close') && (
        <p className="inline-alert info">
          บัญชีนี้ติดตามคิวได้ การรับรองปิดต้องดำเนินการโดยผู้มีสิทธิ์
        </p>
      )}
      <Panel title="คิวรับรองปิดมติ" description={`${items.length} มติตามเงื่อนไข`}>
        <div className="search-input mb-5">
          <Search size={17} />
          <input
            className="input"
            aria-label="ค้นหามติรอปิด"
            placeholder="ค้นหารหัส เรื่อง หรือหน่วยงาน"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>มติ</th>
                  <th>งานตรวจรับ</th>
                  <th>คำขอค้าง</th>
                  <th>เกณฑ์ปิด</th>
                  <th>
                    <span className="sr-only">เปิดพิจารณา</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const group = index.byResolution.get(item.id) ?? EMPTY_RESOLUTION_TASKS;
                  const taskIds = new Set(group.tasks.map((task) => task.id));
                  const pending = state.changes.filter(
                    (change) => change.status === 'pending' && taskIds.has(change.taskId),
                  ).length;
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link className="table-title" href={`/resolutions/${item.id}`}>
                          {item.title}
                        </Link>
                        <span className="table-subtitle">
                          {item.code} · {item.unit}
                        </span>
                      </td>
                      <td>
                        {contextAvailable
                          ? `${group.accepted} / ${group.total}`
                          : 'ข้อมูลไม่ครบตามสิทธิ์'}
                      </td>
                      <td>
                        {contextAvailable ? (
                          <Badge tone={pending ? 'warning' : 'neutral'}>{pending} คำขอ</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {item.closureCriteria.length
                          ? `${item.closureCriteria.length} ข้อ`
                          : 'ยังไม่ระบุ'}
                      </td>
                      <td>
                        <Link
                          className="button button-secondary"
                          href={`/resolutions/${item.id}#resolution-closure`}
                        >
                          ตรวจเกณฑ์
                          <ArrowRight size={15} />
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
            icon={ShieldCheck}
            title={query ? 'ไม่พบมติตามคำค้น' : 'ไม่มีมติรอรับรองปิด'}
            description={
              query
                ? 'ลองค้นด้วยรหัสหรือคำอื่น'
                : 'มติที่งานผ่านตรวจและพร้อมพิจารณาปิดจะแสดงในคิวนี้'
            }
          />
        )}
      </Panel>
    </div>
  );
}
