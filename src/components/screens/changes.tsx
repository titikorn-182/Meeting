'use client';

import { AccessLink as Link } from '@/components/app-shell';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleHelp,
  FilePenLine,
  History,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useWorkspace } from '@/components/workspace-context';
import { Avatar, Badge, Button, EmptyState, Field, PageHeader, Panel } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import type { ChangeRequest, User } from '@/lib/types';

const typeLabels: Record<ChangeRequest['type'], string> = {
  deadline: 'ขยายกำหนดส่ง',
  owner: 'เปลี่ยนผู้รับผิดชอบ',
  scope: 'ปรับขอบเขตงาน',
};
const statusLabels: Record<ChangeRequest['status'], string> = {
  pending: 'รอพิจารณา',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
};

function changeValue(change: ChangeRequest, value: string, users: Pick<User, 'id' | 'name'>[]) {
  if (change.type === 'deadline') return formatThaiDate(value);
  if (change.type === 'owner') return users.find((person) => person.id === value)?.name ?? value;
  return value;
}

export function ChangesScreen({
  initialTaskId,
  initialStatus,
}: {
  initialTaskId?: string;
  initialStatus?: string;
}) {
  const {
    state,
    createChangeRequest,
    decideChange,
    mode,
    permissions,
    users,
    eligibleOwners,
    busy,
  } = useWorkspace();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ChangeRequest['status']>(
    initialStatus === 'pending' || initialStatus === 'approved' || initialStatus === 'rejected'
      ? initialStatus
      : 'all',
  );
  const [selectedId, setSelectedId] = useState('');
  const [showCreate, setShowCreate] = useState(Boolean(initialTaskId));
  const [taskId, setTaskId] = useState(initialTaskId ?? '');
  const [requestTypeDraft, setRequestType] = useState<ChangeRequest['type']>('deadline');
  const [proposedValue, setProposedValue] = useState('');
  const [reason, setReason] = useState('');
  const [decisionDraft, setDecisionDraft] = useState({ id: '', note: '' });
  const filtered = state.changes.filter(
    (change) =>
      (filter === 'all' || change.status === filter) &&
      `${change.code} ${change.reason} ${state.tasks.find((task) => task.id === change.taskId)?.title ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const selected = filtered.find((change) => change.id === selectedId) ?? filtered[0];
  const selectedTask = state.tasks.find((task) => task.id === selected?.taskId);
  const requestedTask = state.tasks.find((task) => task.id === taskId);
  const ownerOptions = eligibleOwners.filter(
    (person) => person.id !== requestedTask?.ownerId && person.id !== requestedTask?.reviewerId,
  );
  const requestType =
    requestTypeDraft === 'owner' && !ownerOptions.length ? 'deadline' : requestTypeDraft;
  const changePeople = [...users, ...eligibleOwners];
  const allowedTasks = state.tasks.filter(
    (task) =>
      !['accepted', 'cancelled'].includes(task.status) &&
      (permissions.includes('workspace.read_all') || task.ownerId === state.currentUserId),
  );
  const mayCreate = permissions.includes('change.request');
  const mayDecide =
    permissions.includes(
      selected?.type === 'deadline'
        ? 'deadline.approve'
        : selected?.type === 'owner'
          ? 'assignment.approve'
          : 'scope.approve',
    ) &&
    selected?.requestedById !== state.currentUserId &&
    selected?.status === 'pending';
  const decisionNote = selected && decisionDraft.id === selected.id ? decisionDraft.note : '';
  const pending = state.changes.filter((item) => item.status === 'pending').length;

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (
      await createChangeRequest({
        taskId,
        type: requestType,
        reason: reason.trim(),
        proposedValue: proposedValue.trim(),
      })
    ) {
      setShowCreate(false);
      setReason('');
      setProposedValue('');
      setFilter('pending');
      setQuery('');
      setSelectedId('');
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="คำขอเปลี่ยนแปลง"
        description="พิจารณาเหตุผลและผลกระทบ โดยเก็บกำหนดเดิมและประวัติการตัดสินใจไว้"
      >
        <Button disabled={busy || !mayCreate} onClick={() => setShowCreate(!showCreate)}>
          <Plus size={17} /> สร้างคำขอ
        </Button>
      </PageHeader>

      {showCreate && (
        <Panel
          title="สร้างคำขอเปลี่ยนแปลง"
          description="เงื่อนไขปัจจุบันยังมีผลจนกว่าคำขอจะได้รับอนุมัติ"
          action={
            <Button
              disabled={busy}
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate(false)}
              aria-label="ปิดแบบคำขอ"
            >
              <X size={17} />
            </Button>
          }
        >
          <form onSubmit={submitRequest} className="space-y-5">
            {!mayCreate && (
              <div className="inline-alert warning text-sm">
                บัญชีนี้ยังไม่มีสิทธิยื่นคำขอสำหรับงานที่เลือก โปรดติดต่อผู้ดูแลสิทธิ
              </div>
            )}
            <div className="form-grid">
              <Field label="งานที่ต้องการเปลี่ยนแปลง" htmlFor="change-task" required>
                <select
                  id="change-task"
                  className="select w-full"
                  value={taskId}
                  required
                  disabled={!mayCreate}
                  onChange={(event) => {
                    setTaskId(event.target.value);
                    setProposedValue('');
                    setRequestType('deadline');
                  }}
                >
                  <option value="">เลือกงาน</option>
                  {allowedTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ประเภทคำขอ" htmlFor="change-type" required>
                <select
                  id="change-type"
                  className="select w-full"
                  value={requestType}
                  disabled={!mayCreate}
                  onChange={(event) => {
                    setRequestType(event.target.value as ChangeRequest['type']);
                    setProposedValue('');
                  }}
                >
                  {Object.entries(typeLabels)
                    .filter(([value]) => value !== 'owner' || ownerOptions.length > 0)
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            {requestedTask && (
              <div className="inline-alert text-sm">
                <CalendarClock size={18} />
                <span>
                  {requestType === 'deadline'
                    ? `กำหนดปัจจุบัน ${formatThaiDate(requestedTask.dueDate)} · กำหนดเดิม ${formatThaiDate(requestedTask.originalDueDate)}`
                    : requestType === 'owner'
                      ? `ผู้รับผิดชอบปัจจุบัน: ${users.find((person) => person.id === requestedTask.ownerId)?.name}`
                      : requestedTask.description
                        ? `ผลส่งมอบปัจจุบัน: ${requestedTask.description}`
                        : 'ขอบเขตปัจจุบันไม่ได้แสดงในมุมมองนี้'}
                </span>
              </div>
            )}
            {requestType === 'deadline' ? (
              <Field label="กำหนดส่งใหม่ที่เสนอ" htmlFor="proposed-date" required>
                <input
                  id="proposed-date"
                  className="input max-w-xs"
                  type="date"
                  required
                  min={requestedTask?.dueDate}
                  value={proposedValue}
                  onChange={(event) => setProposedValue(event.target.value)}
                />
              </Field>
            ) : requestType === 'owner' ? (
              <Field label="ผู้รับผิดชอบใหม่ที่เสนอ" htmlFor="proposed-owner" required>
                <select
                  id="proposed-owner"
                  className="select w-full"
                  required
                  value={proposedValue}
                  onChange={(event) => setProposedValue(event.target.value)}
                >
                  <option value="">เลือกผู้รับผิดชอบ</option>
                  {ownerOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} · {person.unit}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="ขอบเขตหรือผลส่งมอบใหม่ที่เสนอ" htmlFor="proposed-scope" required>
                <textarea
                  id="proposed-scope"
                  className="textarea"
                  rows={3}
                  required
                  value={proposedValue}
                  onChange={(event) => setProposedValue(event.target.value)}
                />
              </Field>
            )}
            {requestType === 'owner' && requestedTask && !ownerOptions.length && (
              <p className="text-xs leading-6 muted">
                ยังไม่มีผู้รับผิดชอบคนอื่นที่เลือกได้
                โปรดติดต่อเลขานุการหรือผู้ดูแลสิทธิเพื่อตรวจรายชื่อผู้รับมอบหมาย
              </p>
            )}
            <Field label="เหตุผลและผลกระทบ" htmlFor="change-reason" required>
              <textarea
                id="change-reason"
                className="textarea"
                rows={3}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="ระบุความจำเป็น สิ่งที่เปลี่ยน และผลต่อการส่งมอบงาน"
              />
            </Field>
            <div className="form-actions">
              <Button
                disabled={busy}
                variant="secondary"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !mayCreate ||
                  !allowedTasks.some((task) => task.id === taskId) ||
                  !proposedValue.trim() ||
                  !reason.trim()
                }
              >
                ยื่นคำขอพิจารณา
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="tabs" aria-label="สถานะคำขอ">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((value) => (
            <button
              key={value}
              className={`tab ${filter === value ? 'active' : ''}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'ทั้งหมด' : statusLabels[value]}
              {value === 'pending' && <span>{pending}</span>}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={17} />
          <input
            className="input"
            aria-label="ค้นหาคำขอเปลี่ยนแปลง"
            placeholder="ค้นหาคำขอหรือชื่องาน"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {filtered.length ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(310px,1fr)]">
          <Panel className="no-pad">
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">
                  รายการคำขอเปลี่ยนแปลง {filtered.length} รายการ
                </caption>
                <thead>
                  <tr>
                    <th scope="col">คำขอ / งานที่เกี่ยวข้อง</th>
                    <th scope="col">ผู้ยื่น</th>
                    <th scope="col">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((change) => {
                    const task = state.tasks.find((item) => item.id === change.taskId);
                    return (
                      <tr
                        key={change.id}
                        className={selected?.id === change.id ? 'bg-[#f0f5f2]' : ''}
                      >
                        <td className="min-w-[235px] max-w-[390px]">
                          <button
                            className="text-left"
                            onClick={() => {
                              setSelectedId(change.id);
                              setDecisionDraft({ id: change.id, note: '' });
                            }}
                            aria-pressed={selected?.id === change.id}
                          >
                            <span className="font-medium hover:underline">
                              {typeLabels[change.type]}
                            </span>
                            <span className="mt-1 block text-sm leading-6 text-[#52686c]">
                              {task?.title ?? 'งานที่เกี่ยวข้อง'}
                            </span>
                            <span className="mt-1.5 block text-xs muted">
                              {change.code} ·{' '}
                              {formatThaiDate(change.createdAt, { year: undefined })}
                            </span>
                          </button>
                        </td>
                        <td>
                          <Avatar userId={change.requestedById} size="sm" />
                        </td>
                        <td className="whitespace-nowrap">
                          <Badge
                            tone={
                              change.status === 'approved'
                                ? 'success'
                                : change.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {statusLabels[change.status]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {selected && (
            <Panel title="รายละเอียดคำขอ" description={selected.code}>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Avatar userId={selected.requestedById} />
                  <div>
                    <p className="text-sm font-medium">
                      {users.find((person) => person.id === selected.requestedById)?.name}
                    </p>
                    <p className="mt-0.5 text-xs muted">
                      ยื่นเมื่อ {formatThaiDate(selected.createdAt)}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/tasks/${selected.taskId}`}
                  className="flex items-start justify-between gap-3 text-sm font-medium leading-7 hover:underline"
                >
                  {selectedTask?.title}
                  <ArrowRight size={17} className="mt-1 shrink-0" />
                </Link>
                <div className="rounded-lg bg-[#f5f7f6] p-4">
                  <p className="mb-3 flex items-center gap-2 text-xs font-medium muted">
                    <FilePenLine size={15} /> {typeLabels[selected.type]}
                  </p>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs muted">เงื่อนไขก่อนเปลี่ยน</dt>
                      <dd className="mt-1 leading-6">
                        {changeValue(selected, selected.originalValue, changePeople)}
                      </dd>
                    </div>
                    <div className="border-t border-[#dce5e1] pt-3">
                      <dt className="text-xs muted">ข้อเสนอใหม่</dt>
                      <dd className="mt-1 font-medium leading-6 text-[#2f6260]">
                        {changeValue(selected, selected.proposedValue, changePeople)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="text-sm font-medium">เหตุผลที่ขอเปลี่ยนแปลง</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 muted">
                    {selected.reason}
                  </p>
                </div>
                {selected.status === 'pending' ? (
                  <>
                    <div className="inline-alert warning">
                      <CircleHelp size={18} className="shrink-0" />
                      <p className="text-xs leading-6">
                        คำขอนี้ยังไม่มีผล เงื่อนไขปัจจุบันยังคงใช้จนกว่าจะได้รับอนุมัติ
                        และกำหนดเดิมจะถูกเก็บไว้เสมอ
                      </p>
                    </div>
                    {mayDecide ? (
                      <div className="space-y-4 border-t border-[#e0e7e5] pt-5">
                        <Field label="เหตุผลการพิจารณา" htmlFor="decision-note" required>
                          <textarea
                            id="decision-note"
                            className="textarea"
                            rows={3}
                            value={decisionNote}
                            onChange={(event) =>
                              setDecisionDraft({ id: selected.id, note: event.target.value })
                            }
                            placeholder="ระบุเหตุผลและเงื่อนไขเพิ่มเติม (ถ้ามี)"
                          />
                        </Field>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="secondary"
                            disabled={busy || !decisionNote.trim()}
                            onClick={async () => {
                              if (await decideChange(selected.id, false, decisionNote.trim()))
                                setDecisionDraft({ id: '', note: '' });
                            }}
                          >
                            <X size={16} /> ไม่อนุมัติ
                          </Button>
                          <Button
                            disabled={busy || !decisionNote.trim()}
                            onClick={async () => {
                              if (await decideChange(selected.id, true, decisionNote.trim()))
                                setDecisionDraft({ id: '', note: '' });
                            }}
                          >
                            <Check size={16} /> อนุมัติคำขอ
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs leading-6 muted">
                        {selected.requestedById === state.currentUserId
                          ? 'ผู้ยื่นไม่สามารถอนุมัติคำขอของตนเองได้ โปรดให้ผู้มีอำนาจคนอื่นพิจารณา'
                          : mode === 'demo'
                            ? 'สลับเป็นเลขานุการหรือผู้บริหารเพื่อทดลองพิจารณา'
                            : 'บัญชีนี้อ่านและติดตามคำขอได้ ผู้มีอำนาจจะเป็นผู้พิจารณา'}
                      </p>
                    )}
                  </>
                ) : (
                  <div
                    className={`inline-alert ${selected.status === 'approved' ? 'success' : ''}`}
                  >
                    <History size={18} className="shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{statusLabels[selected.status]}</p>
                      <p className="mt-1 text-xs leading-6">
                        {selected.decisionReason || 'พิจารณาตามเหตุผลและผลกระทบของคำขอ'}
                      </p>
                      <p className="mt-2 text-xs muted">
                        {users.find((person) => person.id === selected.decidedById)?.name} ·{' '}
                        {formatThaiDate(selected.decidedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={CalendarClock}
            title="ไม่พบคำขอตามเงื่อนไข"
            description="คำขอขยายกำหนด เปลี่ยนเจ้าของ หรือปรับขอบเขตที่ยื่นแล้วจะแสดงที่นี่"
          >
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => {
                setFilter('all');
                setQuery('');
              }}
            >
              ดูคำขอทั้งหมด
            </Button>
          </EmptyState>
        </Panel>
      )}
    </div>
  );
}
