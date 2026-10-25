import { daysUntil, isOverdue } from '../../src/lib/workflow.ts';

// Frozen reference for the pre-refactor report semantics and comparative benchmark.
export function legacyReportModel(source, { unit, meetingId, today }) {
  const tasks = source.tasks.filter((task) => {
    const resolution = source.resolutions.find((item) => item.id === task.resolutionId);
    return (
      (unit === 'all' || task.unit === unit) &&
      (meetingId === 'all' || resolution?.meetingId === meetingId)
    );
  });
  const accepted = tasks.filter((task) => task.status === 'accepted');
  const overdue = tasks.filter((task) => isOverdue(task, today));
  const waiting = tasks.filter((task) => task.status === 'submitted');
  const dueCohort = tasks.filter((task) => (daysUntil(task.originalDueDate, today) ?? 1) < 0);
  const onTime = dueCohort.filter(
    (task) =>
      task.status === 'accepted' &&
      task.acceptedAt &&
      (daysUntil(task.originalDueDate, task.acceptedAt) ?? -1) >= 0,
  );
  const unitRows = [...new Set(tasks.map((task) => task.unit))].map((name) => {
    const group = tasks.filter((task) => task.unit === name);
    return {
      name,
      total: group.length,
      active: group.filter((task) => !['accepted', 'cancelled'].includes(task.status)).length,
      accepted: group.filter((task) => task.status === 'accepted').length,
      overdue: group.filter((task) => isOverdue(task, today)).length,
      waiting: group.filter((task) => task.status === 'submitted').length,
    };
  });
  return { tasks, accepted, overdue, waiting, dueCohort, onTime, unitRows };
}
