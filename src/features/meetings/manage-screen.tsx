'use client';
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Save, Link2, Plus } from 'lucide-react';
import { AccessLink as Link } from '@/components/app-shell';
import { useWorkspace } from '@/components/workspace-context';
import { Button, EmptyState, Field, PageHeader, Panel } from '@/components/ui';
import type { Meeting, MeetingUpdate } from '@/lib/types';

export function MeetingManageScreen({ id }: { id: string }) {
  const { state, permissions, supportsMeetingManagement } = useWorkspace();
  const meeting = state.meetings.find((item) => item.id === id);
  if (!meeting || !permissions.includes('meeting.manage'))
    return (
      <EmptyState
        icon={CalendarDays}
        title="ไม่พบการประชุมที่จัดการได้"
        description="รายการอาจอยู่นอกสิทธิ์ หรือบัญชีนี้ไม่มีสิทธิ์แก้ไขการประชุม"
      >
        <Link href="/meetings" className="button button-secondary">
          กลับทะเบียนประชุม
        </Link>
      </EmptyState>
    );
  if (!supportsMeetingManagement)
    return (
      <EmptyState
        icon={CalendarDays}
        title="การจัดการประชุมยังไม่พร้อม"
        description="ให้ผู้ดูแลอัปเดตระบบก่อนเพิ่มวาระหรือแก้ข้อมูลประชุม ข้อมูลประชุมเดิมยังเปิดอ่านได้"
      >
        <Link href={`/meetings/${id}`} className="button button-secondary">
          กลับรายละเอียดประชุม
        </Link>
      </EmptyState>
    );
  return <MeetingManager key={id} meeting={meeting} />;
}
function MeetingManager({ meeting }: { meeting: Meeting }) {
  const { state, permissions, busy, updateMeeting, addAgenda, linkResolution } = useWorkspace();
  const router = useRouter();
  const [baseline] = useState(meeting);
  const [tab, setTab] = useState<'details' | 'agenda' | 'followup'>('details');
  const [agendaId, setAgendaId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  function allowLeave() {
    return !dirty || window.confirm('ยังมีข้อมูลที่ไม่ได้บันทึก ต้องการออกจากแบบฟอร์มหรือไม่?');
  }
  function leaveLink(event: MouseEvent<HTMLAnchorElement>) {
    if (!allowLeave()) event.preventDefault();
  }
  const stale = (baseline.rowVersion ?? 1) !== (meeting.rowVersion ?? 1);
  const disabled = busy || saving || stale;
  const mayLink = permissions.includes('resolution.draft');
  const agenda = meeting.agenda.find((item) => item.id === agendaId);
  const eligible = state.resolutions.filter((item) => !agenda?.resolutionIds.includes(item.id));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const data = new FormData(event.currentTarget);
    const field = (key: string) => String(data.get(key) ?? '').trim();
    setError('');
    setSaving(true);
    try {
      const expected = baseline.rowVersion ?? 1;
      let ok = false;
      if (tab === 'details') {
        const input: MeetingUpdate = {
          title: field('title'),
          date: field('date'),
          time: field('time'),
          location: field('location'),
          status: field('status') === 'completed' ? 'completed' : 'scheduled',
          reason: field('reason'),
        };
        ok = await updateMeeting(meeting.id, expected, input);
      } else if (tab === 'agenda') {
        if (meeting.agenda.some((item) => item.number === field('number'))) {
          setError('เลขวาระนี้มีอยู่แล้ว กรุณาใช้เลขวาระอื่น');
          return;
        }
        ok = await addAgenda(meeting.id, expected, {
          number: field('number'),
          title: field('title'),
        });
      } else if (mayLink && agenda) {
        ok = await linkResolution(meeting.id, expected, {
          agendaId,
          resolutionId: field('resolutionId'),
          note: field('note'),
        });
      }
      if (ok) {
        setDirty(false);
        router.push(`/meetings/${meeting.id}`);
      } else
        setError(
          'ยังบันทึกไม่ได้ ตรวจข้อความแจ้งเตือน หากข้อมูลเปลี่ยนให้เปิดรายละเอียดล่าสุดก่อนลองใหม่',
        );
    } catch {
      setError('เชื่อมต่อไม่ได้ ค่าที่กรอกยังอยู่ กรุณาลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack">
      <Link href={`/meetings/${meeting.id}`} onClick={leaveLink} className="back-link">
        <ArrowLeft size={16} />
        รายละเอียดการประชุม
      </Link>
      <PageHeader title={`จัดการประชุมครั้งที่ ${meeting.number}`} description={meeting.title} />
      {stale && (
        <div role="alert" className="inline-alert warning">
          ข้อมูลประชุมเปลี่ยนระหว่างแก้ไข
          กรุณาเก็บข้อความที่กรอกและกลับไปเปิดรายละเอียดล่าสุดก่อนบันทึก
          เพื่อไม่เขียนทับงานของผู้อื่น
        </div>
      )}
      <div className="tabs" role="group" aria-label="จัดการการประชุม">
        {(
          [
            ['details', 'ข้อมูลประชุม'],
            ['agenda', 'เพิ่มวาระ'],
            ...(mayLink ? [['followup', 'เชื่อมมติเดิม'] as const] : []),
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            aria-pressed={tab === key}
            onClick={() => {
              if (key !== tab && allowLeave()) {
                setTab(key);
                setDirty(false);
                setError('');
              }
            }}
            disabled={saving}
          >
            {label}
          </button>
        ))}
      </div>
      <Panel
        title={
          tab === 'details'
            ? 'แก้ไขข้อมูลประชุม'
            : tab === 'agenda'
              ? 'เพิ่มวาระการประชุม'
              : 'ติดตามมติเดิมในวาระนี้'
        }
        description={
          tab === 'followup'
            ? 'ใช้รหัสมติเดิม พร้อมบันทึกหมายเหตุและสถานะขณะเชื่อม ไม่สร้างมติหรือผลงานซ้ำ'
            : undefined
        }
      >
        <form
          onSubmit={submit}
          onChange={() => setDirty(true)}
          className="stack"
          aria-busy={saving}
          key={tab}
        >
          {tab === 'details' ? (
            <>
              <div className="form-grid">
                <div className="full-width">
                  <Field label="ชื่อการประชุม" htmlFor="edit-title" required>
                    <input
                      id="edit-title"
                      name="title"
                      className="input"
                      required
                      maxLength={500}
                      defaultValue={baseline.title}
                      disabled={disabled}
                    />
                  </Field>
                </div>
                <Field label="วันที่ประชุม" htmlFor="edit-date" required>
                  <input
                    id="edit-date"
                    name="date"
                    className="input"
                    type="date"
                    required
                    defaultValue={baseline.date}
                    disabled={disabled}
                  />
                </Field>
                <Field label="เวลาประชุม" htmlFor="edit-time" required>
                  <input
                    id="edit-time"
                    name="time"
                    className="input"
                    type="time"
                    required
                    defaultValue={baseline.time}
                    disabled={disabled}
                  />
                </Field>
                <Field label="สถานที่ / ช่องทางประชุม" htmlFor="edit-location" required>
                  <input
                    id="edit-location"
                    name="location"
                    className="input"
                    required
                    maxLength={1000}
                    defaultValue={baseline.location}
                    disabled={disabled}
                  />
                </Field>
                <Field label="สถานะการประชุม" htmlFor="edit-status">
                  <select
                    id="edit-status"
                    name="status"
                    className="select"
                    defaultValue={baseline.status}
                    disabled={disabled}
                  >
                    <option value="scheduled">กำหนดการประชุม</option>
                    <option value="completed">ประชุมแล้ว</option>
                  </select>
                </Field>
              </div>
              <Field label="เหตุผลที่แก้ไข" htmlFor="edit-reason" required>
                <textarea
                  id="edit-reason"
                  name="reason"
                  className="textarea"
                  required
                  maxLength={2000}
                  disabled={disabled}
                />
              </Field>
              <p className="muted text-sm">
                การเปลี่ยนสถานะประชุมไม่อนุญาตเริ่มงานหรือรับรองปิดมติโดยอัตโนมัติ
              </p>
            </>
          ) : tab === 'agenda' ? (
            <div className="form-grid">
              <Field label="เลขวาระ" htmlFor="new-agenda-number" required>
                <input
                  id="new-agenda-number"
                  name="number"
                  className="input"
                  required
                  maxLength={50}
                  placeholder="เช่น 3.1"
                  disabled={disabled}
                />
              </Field>
              <Field label="ชื่อวาระ" htmlFor="new-agenda-title" required>
                <input
                  id="new-agenda-title"
                  name="title"
                  className="input"
                  required
                  maxLength={1000}
                  disabled={disabled}
                />
              </Field>
            </div>
          ) : (
            <>
              {!meeting.agenda.length && (
                <p className="inline-alert info">เพิ่มวาระก่อนเชื่อมมติเดิม</p>
              )}
              <Field label="วาระที่ใช้ติดตาม" htmlFor="followup-agenda" required>
                <select
                  id="followup-agenda"
                  className="select"
                  required
                  value={agendaId}
                  onChange={(event) => setAgendaId(event.target.value)}
                  disabled={disabled}
                >
                  <option value="" disabled>
                    เลือกวาระ
                  </option>
                  {meeting.agenda.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.number} · {item.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="มติเดิม" htmlFor="followup-resolution" required>
                <select
                  key={agendaId}
                  id="followup-resolution"
                  name="resolutionId"
                  className="select"
                  required
                  defaultValue=""
                  disabled={disabled || !agendaId}
                >
                  <option value="" disabled>
                    เลือกมติที่ต้องการติดตาม
                  </option>
                  {eligible.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.title}
                    </option>
                  ))}
                </select>
              </Field>
              {agendaId && !eligible.length && (
                <p className="inline-alert info">ไม่มีมติอื่นที่เชื่อมเพิ่มได้ในขอบเขตสิทธิ์นี้</p>
              )}
              <Field label="หมายเหตุติดตาม" htmlFor="followup-note" required>
                <textarea
                  id="followup-note"
                  name="note"
                  className="textarea"
                  required
                  maxLength={2000}
                  disabled={disabled}
                  placeholder="เรื่องที่ต้องนำกลับมาติดตามในการประชุมครั้งนี้"
                />
              </Field>
            </>
          )}
          {error && (
            <p role="alert" className="inline-alert error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Link
              className="button button-secondary"
              onClick={leaveLink}
              href={`/meetings/${meeting.id}`}
            >
              ยกเลิก
            </Link>
            <Button
              type="submit"
              disabled={disabled || (tab === 'followup' && (!agendaId || !eligible.length))}
            >
              {tab === 'details' ? (
                <Save size={16} />
              ) : tab === 'agenda' ? (
                <Plus size={16} />
              ) : (
                <Link2 size={16} />
              )}{' '}
              {saving
                ? 'กำลังบันทึก…'
                : tab === 'details'
                  ? 'บันทึกการแก้ไข'
                  : tab === 'agenda'
                    ? 'บันทึกวาระ'
                    : 'เชื่อมมติเดิม'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
