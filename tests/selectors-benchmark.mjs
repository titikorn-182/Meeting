import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { initialState } from '../src/demo/fixtures/workspace.ts';
import { legacyReportModel } from './helpers/legacy-report-model.mjs';
import { selectReportModel, buildTaskIndex } from '../src/lib/workspace-selectors.ts';
import { getResolutionProgress } from '../src/lib/workflow.ts';

const resolutions = Array.from({ length: 2000 }, (_, i) => ({
  ...initialState.resolutions[i % initialState.resolutions.length],
  id: `r-${i}`,
}));
const tasks = Array.from({ length: 20000 }, (_, i) => ({
  ...initialState.tasks[i % initialState.tasks.length],
  id: `t-${i}`,
  resolutionId: resolutions[i % resolutions.length].id,
  unit: `Unit ${i % 100}`,
}));
const source = { tasks, resolutions },
  filters = { unit: 'all', meetingId: 'all', today: '2026-10-24' };
function measure(run) {
  run();
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[2];
}
const legacy = legacyReportModel(source, filters),
  actual = selectReportModel(source, filters);
for (const key of Object.keys(legacy)) assert.deepEqual(actual[key], legacy[key]);
const legacyRows = () =>
  resolutions.map((resolution) => ({
    total: tasks.filter((task) => task.resolutionId === resolution.id).length,
    progress: getResolutionProgress(resolution.id, tasks),
  }));
const indexedRows = () => {
  const index = buildTaskIndex(tasks, filters.today);
  return resolutions.map((resolution) => {
    const row = index.byResolution.get(resolution.id);
    return { total: row?.total ?? 0, progress: row?.progress ?? 0 };
  });
};
assert.deepEqual(indexedRows(), legacyRows());
console.log(
  JSON.stringify({
    tasks: tasks.length,
    resolutions: resolutions.length,
    units: 100,
    samples: 5,
    unit: 'ms median',
    legacyReport: measure(() => legacyReportModel(source, filters)),
    indexedReport: measure(() => selectReportModel(source, filters)),
    legacyResolutionRows: measure(legacyRows),
    indexedResolutionRows: measure(indexedRows),
    resultsEqual: true,
  }),
);
