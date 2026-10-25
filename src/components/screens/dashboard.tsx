'use client';

import { AccessLink as Link } from '@/components/app-shell';
import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  ListChecks,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import clsx from 'clsx';
import { useDemo } from '@/components/demo-provider';
import { Avatar, Badge, EmptyState, PageHeader, ProgressBar } from '@/components/ui';
import {
  formatThaiDate,
  getDashboardMetrics,
  getResolutionProgress,
  isOverdue,
} from '@/lib/workflow';

export function Dashboard() {
  const { state, user, permissions, users, today } = useDemo();
  const [tab, setTab] = useState('active');
  const metrics = useMemo(() => getDashboardMetrics(state, today), [state, today]);
  const nextMeeting = state.meetings
    .filter((meeting) => meeting.status === 'scheduled' && meeting.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const lateIds = new Set(
    state.tasks.filter((task) => isOverdue(task, today)).map((task) => task.resolutionId),
  );
  const displayed = state.resolutions
    .filter((resolution) =>
      tab === 'overdue'
        ? lateIds.has(resolution.id)
        : tab === 'pending'
          ? resolution.status === 'pending_close'
          : ['open', 'pending_close'].includes(resolution.status),
    )
    .slice(0, 5);
  const stages = [
    { status: 'assigned', label: 'รอเริ่มงาน', color: '#b5c3ba' },
    { status: 'in_progress', label: 'กำลังดำเนินการ', color: '#557e87' },
    { status: 'submitted', label: 'รอตรวจ', color: '#deb471' },
    { status: 'revision', label: 'ให้แก้ไข', color: '#c77e69' },
    { status: 'accepted', label: 'ตรวจรับแล้ว', color: '#7ea68b' },
    { status: 'cancelled', label: 'ยกเลิก', color: '#d1d9d4' },
  ].map((stage) => ({
    ...stage,
    count: state.tasks.filter((task) => task.status === stage.status).length,
  }));
  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        title="ภาพรวมการติดตามมติ"
        description={`สวัสดีคุณ${user.name.replace(/^(นางสาว|นาง|นาย|ผศ\.|รศ\.|ดร\.)\s*/g, '').split(' ')[0]} วันนี้มีเรื่องที่รอการติดตาม ดูความคืบหน้าได้จากที่นี่`}
      >
        <Link href="/reports" className="button button-secondary">
          <ArrowDownToLine size={15} />
          ออกรายงาน
        </Link>
        {permissions.includes('resolution.draft') && (
          <Link href="/resolutions/new" className="button button-primary">
            <Plus size={17} />
            บันทึกมติใหม่
          </Link>
        )}
      </PageHeader>
      <div className="overview-metrics" aria-label="สรุปข้อมูลมติและงาน">
        <Link href="/resolutions" className="overview-metric">
          <span>
            มติทั้งหมด <FileText size={17} />
          </span>
          <div>
            <strong>{metrics.totalResolutions}</strong>
            <small>เรื่อง</small>
          </div>
          <p>
            จากการประชุม {state.meetings.filter((meeting) => meeting.status === 'completed').length}{' '}
            ครั้ง
          </p>
        </Link>
        <Link href="/resolutions?status=active" className="overview-metric">
          <span>
            เปิดติดตาม <ListChecks size={18} />
          </span>
          <div>
            <strong>{metrics.activeResolutions}</strong>
            <small>เรื่อง</small>
          </div>
          <p>ดำเนินการและรอรับรองปิด</p>
        </Link>
        <Link href="/tasks?filter=overdue" className="overview-metric metric-danger">
          <span>
            งานเกินกำหนด <TriangleAlert size={17} />
          </span>
          <div>
            <strong>{metrics.overdueTasks}</strong>
            <small>งาน</small>
          </div>
          <p>
            <span className="tiny-dot" />
            ต้องติดตามผู้รับผิดชอบ
          </p>
        </Link>
        <Link href="/reviews" className="overview-metric metric-warning">
          <span>
            รอตรวจรับ <Clock3 size={17} />
          </span>
          <div>
            <strong>{metrics.pendingReviewTasks}</strong>
            <small>งาน</small>
          </div>
          <p>ส่งผลงานแล้ว รอการพิจารณา</p>
        </Link>
      </div>
      <section className="workflow-overview">
        <div className="workflow-heading">
          <div>
            <h2>ทุกงานกำลังเดินหน้าไปถึงไหน</h2>
            <p>
              {metrics.completedTasks} จาก {metrics.totalTasks} งานผ่านการตรวจรับแล้ว{' '}
              <span>· ไม่รวมงานยกเลิกเป็นผลงานสำเร็จ</span>
            </p>
          </div>
          <Link href="/tasks?scope=all" className="text-link">
            ดูงานทั้งหมด <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="workflow-track" aria-label="สัดส่วนสถานะงาน">
          {stages
            .filter((stage) => stage.count > 0)
            .map((stage) => (
              <Link
                key={stage.status}
                href={`/tasks?status=${stage.status}`}
                style={{ flex: stage.count, backgroundColor: stage.color }}
                aria-label={`${stage.label} ${stage.count} งาน`}
                title={`${stage.label} ${stage.count} งาน`}
              />
            ))}
        </div>
        <div className="workflow-legend">
          {stages.map((stage) => (
            <Link key={stage.status} href={`/tasks?status=${stage.status}`}>
              <i style={{ background: stage.color }} />
              {stage.label}
              <b>{stage.count}</b>
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-columns">
        <section className="panel dashboard-register">
          <div className="panel-header">
            <div className="cluster">
              <h2>มติที่ต้องติดตาม</h2>
              <span className="count-label">{metrics.activeResolutions} เรื่อง</span>
            </div>
            <Link href="/resolutions" className="text-link">
              ทะเบียนมติ <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="dashboard-tabs">
            <button
              className={clsx('tab', tab === 'active' && 'active')}
              aria-pressed={tab === 'active'}
              onClick={() => setTab('active')}
            >
              กำลังติดตาม
            </button>
            <button
              className={clsx('tab', tab === 'overdue' && 'active')}
              aria-pressed={tab === 'overdue'}
              onClick={() => setTab('overdue')}
            >
              มีงานเกินกำหนด <span>{lateIds.size}</span>
            </button>
            <button
              className={clsx('tab', tab === 'pending' && 'active')}
              aria-pressed={tab === 'pending'}
              onClick={() => setTab('pending')}
            >
              รอรับรองปิด
            </button>
          </div>
          {displayed.length ? (
            <div className="table-scroll">
              <table className="data-table dashboard-table">
                <thead>
                  <tr>
                    <th>มติ / ผู้ประสาน</th>
                    <th>ความก้าวหน้า</th>
                    <th>กำหนดส่ง</th>
                    <th aria-label="เปิดรายละเอียด" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((resolution) => {
                    const tasks = state.tasks.filter((task) => task.resolutionId === resolution.id);
                    const accepted = tasks.filter((task) => task.status === 'accepted').length;
                    const coordinator = users.find(
                      (person) => person.id === resolution.coordinatorId,
                    );
                    return (
                      <tr key={resolution.id}>
                        <td>
                          <Link href={`/resolutions/${resolution.id}`} className="table-title">
                            {resolution.title}
                          </Link>
                          <div className="table-person">
                            <span>{resolution.code}</span>
                            <span className="table-person-divider" />
                            <Avatar userId={resolution.coordinatorId} size="sm" />
                            <span>{coordinator?.name.split(' ')[0]}</span>
                          </div>
                        </td>
                        <td>
                          <ProgressBar value={getResolutionProgress(resolution.id, state.tasks)} />
                          <span className="table-subtitle">
                            ตรวจรับ {accepted}/{tasks.length} งาน
                          </span>
                        </td>
                        <td>
                          <span className="due-cell">{formatThaiDate(resolution.dueDate)}</span>
                          <span className="table-subtitle">
                            {lateIds.has(resolution.id) ? (
                              <span className="text-danger">มีงานเกินกำหนด</span>
                            ) : (
                              <Badge status={resolution.status} />
                            )}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/resolutions/${resolution.id}`}
                            className="icon-button"
                            aria-label={`เปิด ${resolution.title}`}
                          >
                            <ChevronRight size={17} />
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
              icon={Check}
              title="ไม่มีเรื่องค้างในกลุ่มนี้"
              description="เมื่อมีมติเข้าเงื่อนไข ระบบจะแสดงรายการให้ติดตามที่นี่"
            />
          )}
          <div className="table-footer">
            <span>แสดง {displayed.length} เรื่องที่เกี่ยวข้อง</span>
            <Link href="/resolutions" className="text-link">
              ดูทะเบียนมติทั้งหมด <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <aside className="dashboard-side">
          <section className="upcoming-meeting">
            <div className="cluster justify-between">
              <h2>การประชุมถัดไป</h2>
              <CalendarDays size={18} />
            </div>
            {nextMeeting ? (
              <>
                <div className="meeting-date">
                  <strong>
                    {formatThaiDate(nextMeeting.date, {
                      day: 'numeric',
                      month: undefined,
                      year: undefined,
                    })}
                  </strong>
                  <span>
                    {formatThaiDate(nextMeeting.date, {
                      day: undefined,
                      month: 'long',
                      year: 'numeric',
                    })}
                    <small>{nextMeeting.time} น.</small>
                  </span>
                </div>
                <h3>{nextMeeting.title}</h3>
                <p>ครั้งที่ {nextMeeting.number}</p>
                <div className="meeting-location">{nextMeeting.location}</div>
                <Link href={`/meetings/${nextMeeting.id}`} className="meeting-link">
                  เตรียมวาระการประชุม <ArrowRight size={15} />
                </Link>
              </>
            ) : (
              <p className="muted mt-4">ยังไม่มีการนัดหมายครั้งถัดไป</p>
            )}
          </section>
          <section className="followup-queue">
            <h2>รายการรอดำเนินการ</h2>
            <Link href="/changes?status=pending">
              <span className="queue-icon">
                <ArrowRightLeftIcon />
              </span>
              <span>
                <strong>คำขอรอพิจารณา</strong>
                <small>ขยายกำหนดและเปลี่ยนแปลงงาน</small>
              </span>
              <b>{metrics.pendingChanges}</b>
            </Link>
            <Link href="/tasks?status=assigned">
              <span className="queue-icon">
                <Clock3 size={18} />
              </span>
              <span>
                <strong>งานรอเริ่มดำเนินการ</strong>
                <small>ติดตามการรับทราบและเริ่มงาน</small>
              </span>
              <b>{stages[0].count}</b>
            </Link>
            <Link href="/resolutions?status=pending_close">
              <span className="queue-icon">
                <Check size={18} />
              </span>
              <span>
                <strong>มติรอรับรองปิด</strong>
                <small>ตรวจเกณฑ์สำเร็จระดับมติ</small>
              </span>
              <b>
                {
                  state.resolutions.filter((resolution) => resolution.status === 'pending_close')
                    .length
                }
              </b>
            </Link>
          </section>
        </aside>
      </div>
      <section className="recent-activity">
        <div className="cluster justify-between">
          <h2>ความเคลื่อนไหวล่าสุด</h2>
          <Link href="/settings?tab=history" className="text-link">
            ดูประวัติทั้งหมด <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="activity-row">
          {state.audit.slice(0, 3).map((event) => (
            <div key={event.id} className="activity-item">
              <Avatar userId={event.actorId} size="sm" />
              <div>
                <p>
                  <strong>
                    {users.find((person) => person.id === event.actorId)?.name.split(' ')[0] ??
                      'ผู้ใช้งาน'}
                  </strong>{' '}
                  {event.action}
                </p>
                <span>{event.targetLabel}</span>
                <small>{formatThaiDate(event.createdAt)}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function ArrowRightLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />
    </svg>
  );
}
