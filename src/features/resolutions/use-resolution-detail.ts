'use client';
import { useWorkspace } from '@/components/workspace-context';
import { canAccessPage } from '@/lib/access-control';
import type { Priority } from '@/lib/types';
import { canCloseResolution } from '@/lib/workflow';
import { useState, type FormEvent } from 'react';

import type { Resolution } from '@/lib/types';
export function useResolutionDetail(resolution: Resolution, initialAddTask: boolean) {
  const id = resolution.id;
  const {
    state,
    access,
    addTask,
    closeResolution,
    authorizeResolution,
    mode,
    permissions,
    users,
    busy,
    units,
  } = useWorkspace();
  const [tab, setTab] = useState(initialAddTask ? 'tasks' : 'overview');
  const [addingTask, setAddingTask] = useState(initialAddTask);
  const [closing, setClosing] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const tasks = state.tasks.filter((task) => task.resolutionId === id);
  const meeting = state.meetings.find((item) => item.id === resolution.meetingId);
  const taskDetailsAvailable = canAccessPage(access, 'tasks') || canAccessPage(access, 'reviews');
  const taskSummaryAvailable =
    taskDetailsAvailable ||
    canAccessPage(access, 'dashboard') ||
    canAccessPage(access, 'reports') ||
    canAccessPage(access, 'changes');
  const evidence = tasks.flatMap((task) =>
    (task.evidence ?? []).map((file) => ({ ...file, task })),
  );
  const closureCriteria = resolution.closureCriteria ?? [];
  const closureContextAvailable =
    taskDetailsAvailable &&
    canAccessPage(access, 'changes') &&
    !resolution.partialContext &&
    Array.isArray(resolution.closureCriteria) &&
    tasks.every((task) => typeof task.required === 'boolean');
  const events = state.audit.filter(
    (event) => event.targetId === id || tasks.some((task) => task.id === event.targetId),
  );
  const tasksReady =
    closureContextAvailable &&
    (mode === 'supabase'
      ? tasks.length > 0 && tasks.every((task) => task.status === 'accepted')
      : canCloseResolution(id, state.tasks)) &&
    !state.changes.some(
      (change) => change.status === 'pending' && tasks.some((task) => task.id === change.taskId),
    );
  const activeUsers = users.filter((user) => user.membershipStatus !== 'pending');
  const canManage = permissions.includes('task.assign');
  const canClose =
    permissions.includes('resolution.close') &&
    !['recurring', 'acknowledgment'].includes(resolution.type) &&
    resolution.status !== 'closed';
  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const taskId = await addTask({
      resolutionId: id,
      title: String(data.get('title')).trim(),
      description: String(data.get('description')).trim(),
      ownerId: String(data.get('ownerId')),
      reviewerId: String(data.get('reviewerId')),
      unit: String(data.get('unit')),
      priority: String(data.get('priority')) as Priority,
      originalDueDate: String(data.get('dueDate')),
      dueDate: String(data.get('dueDate')),
      required: data.get('required') === 'on',
      deliverable: String(data.get('deliverable')).trim(),
      criteria: String(data.get('criteria'))
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
    });
    if (taskId) {
      setAddingTask(false);
      setTab('tasks');
    }
  }
  async function confirmClosure() {
    if (await closeResolution(id, checked.length === closureCriteria.length)) setClosing(false);
  }
  async function authorizeExecution() {
    await authorizeResolution(id);
  }
  return {
    authorizeExecution,
    confirmClosure,
    resolution,
    meeting,
    canManage,
    busy,
    setTab,
    setAddingTask,
    taskSummaryAvailable,
    tasks,
    taskDetailsAvailable,
    evidence,
    tab,
    closureCriteria,
    addingTask,
    submitTask,
    activeUsers,
    units,
    users,
    mode,
    events,
    canClose,
    tasksReady,
    closureContextAvailable,
    closing,
    checked,
    setChecked,
    id,
    setClosing,
    permissions,
    state,
  };
}
export type ResolutionDetailModel = ReturnType<typeof useResolutionDetail>;
