'use client';

import { useMemo, useState } from 'react';
import { BellRing, CircleHelp, History, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-context';
import { Badge, Button, Dialog, EmptyState, PageHeader, Panel } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import { TrackingSettingsForm } from '@/features/settings/tracking-settings-form';

export function SettingsScreen() {
  const { state, resetDemo, mode, users, busy } = useWorkspace();
  const [tab, setTab] = useState<'preferences' | 'audit'>('preferences');
  const [resetVersion, setResetVersion] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [auditQuery, setAuditQuery] = useState('');
  const usersById = useMemo(() => new Map(users.map((person) => [person.id, person])), [users]);
  const auditEvents = state.audit.filter((event) =>
    `${event.action} ${event.targetLabel} ${event.detail} ${usersById.get(event.actorId)?.name ?? ''}`.includes(
      auditQuery,
    ),
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="ตั้งค่าและประวัติระบบ"
        description="กำหนดรอบการติดตาม และตรวจสอบกิจกรรมที่เกิดขึ้นในพื้นที่ทำงาน"
      />
      <div className="tabs" role="tablist" aria-label="ส่วนการตั้งค่า">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preferences'}
          className={`tab ${tab === 'preferences' ? 'active' : ''}`}
          onClick={() => setTab('preferences')}
        >
          <BellRing size={16} />
          การติดตามและแจ้งเตือน
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'audit'}
          className={`tab ${tab === 'audit' ? 'active' : ''}`}
          onClick={() => setTab('audit')}
        >
          <History size={16} />
          ประวัติกิจกรรม
        </button>
      </div>
      <div hidden={tab !== 'preferences'}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <div className="stack">
            <TrackingSettingsForm
              key={JSON.stringify([
                resetVersion,
                state.settings.reminderDays,
                state.settings.acknowledgmentDays,
                state.settings.reviewDays,
                state.settings.emailNotifications,
              ])}
              settings={state.settings}
            />
            {mode === 'demo' && (
              <Panel
                title="เริ่มการทดลองใหม่"
                description="คืนมติ งาน การประชุม และการตั้งค่าทั้งหมดเป็นข้อมูลตัวอย่างเริ่มต้น"
              >
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <p className="max-w-[60ch] text-sm leading-relaxed text-[#64757a]">
                    รายการที่เพิ่มและการเปลี่ยนแปลงระหว่างทดลองในเบราว์เซอร์นี้จะถูกแทนที่
                  </p>
                  <Button
                    disabled={busy}
                    variant="danger"
                    className="shrink-0"
                    onClick={() => setResetOpen(true)}
                  >
                    <RotateCcw size={16} />
                    เริ่มใหม่
                  </Button>
                </div>
              </Panel>
            )}
          </div>
          <div className="stack">
            <Panel title={mode === 'demo' ? 'การใช้งานในรุ่นทดลอง' : 'พื้นที่ทำงานที่เชื่อมต่อ'}>
              <div className="flex items-start gap-3">
                <ShieldCheck size={21} className="mt-0.5 shrink-0 text-[#53756b]" />
                <div className="text-sm leading-relaxed text-[#64757a]">
                  {mode === 'demo'
                    ? 'การเปลี่ยนบทบาทใช้ทดลองมุมมองการทำงาน ยังไม่ใช่การเข้าสู่ระบบด้วยบัญชีบุคลากรจริง'
                    : 'ข้อมูลที่มองเห็นและกิจกรรมที่ทำได้ขึ้นกับสิทธิของบัญชีที่เข้าสู่ระบบ'}
                </div>
              </div>
              <dl className="mt-5 divide-y divide-[#e6ecea] text-sm">
                <div className="flex justify-between gap-3 py-3">
                  <dt className="muted">เขตเวลา</dt>
                  <dd>Asia/Bangkok</dd>
                </div>
                <div className="flex justify-between gap-3 py-3">
                  <dt className="muted">ภาษา</dt>
                  <dd>ไทย</dd>
                </div>
                <div className="flex justify-between gap-3 py-3">
                  <dt className="muted">การแจ้งเตือน</dt>
                  <dd>
                    <Badge tone="info">{mode === 'demo' ? 'ในระบบทดลอง' : 'ในพื้นที่ทำงาน'}</Badge>
                  </dd>
                </div>
              </dl>
            </Panel>
            <div className="flex gap-3 px-1 text-sm leading-relaxed text-[#64757a]">
              <CircleHelp size={19} className="mt-0.5 shrink-0" />
              <p>
                ค่าระยะเวลาเป็นนโยบายสำหรับติดตามงาน
                ยังไม่เปิดการเตือนตามเวลาและการคำนวณปฏิทินวันหยุดอัตโนมัติ
              </p>
            </div>
          </div>
        </div>
      </div>
      {tab === 'audit' && (
        <Panel
          title="ประวัติกิจกรรม"
          description="แสดงผู้กระทำ รายการที่เกี่ยวข้อง และรายละเอียดการเปลี่ยนแปลง"
          action={<Badge tone="neutral">{auditEvents.length} เหตุการณ์</Badge>}
        >
          <div className="search-input mb-5">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-3 text-[#849397]"
            />
            <input
              className="input pl-10"
              aria-label="ค้นหาประวัติกิจกรรม"
              placeholder="ค้นหากิจกรรม ผู้กระทำ หรือชื่องาน"
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
            />
          </div>
          {auditEvents.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>วัน / เวลา</th>
                    <th>กิจกรรมและรายการ</th>
                    <th>ผู้กระทำ</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap text-sm">
                        {formatThaiDate(event.createdAt)}
                        <div className="muted text-small mt-1">
                          {new Intl.DateTimeFormat('th-TH', {
                            timeZone: 'Asia/Bangkok',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(event.createdAt))}{' '}
                          น.
                        </div>
                      </td>
                      <td className="min-w-52">
                        <div className="font-medium">{event.action}</div>
                        <div className="muted text-small mt-1">{event.targetLabel}</div>
                      </td>
                      <td className="whitespace-nowrap text-sm">
                        {usersById.get(event.actorId)?.name ?? 'ระบบ'}
                      </td>
                      <td className="min-w-64 text-sm text-[#64757a]">{event.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="ไม่พบกิจกรรมตามคำค้น"
              description="ลองเปลี่ยนคำค้นเพื่อดูประวัติรายการอื่น"
            >
              <Button disabled={busy} variant="secondary" onClick={() => setAuditQuery('')}>
                ล้างคำค้น
              </Button>
            </EmptyState>
          )}
        </Panel>
      )}
      <Dialog
        open={mode === 'demo' && resetOpen}
        onClose={() => setResetOpen(false)}
        title="เริ่มการทดลองใหม่?"
        description="การเปลี่ยนแปลงทั้งหมดในเบราว์เซอร์นี้จะถูกแทนที่ด้วยข้อมูลเริ่มต้น"
      >
        <div className="stack">
          <p className="text-sm leading-relaxed text-[#64757a]">
            รวมถึงมติและการประชุมที่เพิ่ม ความก้าวหน้า ผลตรวจ คำขอ และการตั้งค่า
            หากต้องการเก็บผลปัจจุบัน โปรดส่งออกรายงานก่อนเริ่มใหม่
          </p>
          <div className="form-actions">
            <Button disabled={busy} variant="secondary" onClick={() => setResetOpen(false)}>
              ทดลองต่อ
            </Button>
            <Button
              disabled={busy}
              variant="danger"
              onClick={() => {
                resetDemo();
                setResetOpen(false);
                setResetVersion((version) => version + 1);
              }}
            >
              ยืนยันเริ่มใหม่
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
