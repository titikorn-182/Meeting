import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from './fixtures/workspace';
import { editMeeting, meetingAtVersion } from './meeting-management';
test('meeting edit keeps agendas, resolutions and identity while rejecting stale versions', () => {
  const original = structuredClone(initialState);
  const meeting = original.meetings[0];
  const result = editMeeting(original, meeting.id, 1, {
    title: 'Updated',
    date: meeting.date,
    time: '10:30',
    location: 'New room',
    status: 'completed',
    reason: 'Confirmed',
  });
  assert.equal(result.meetings[0].rowVersion, 2);
  assert.equal(result.meetings[0].number, meeting.number);
  assert.deepEqual(result.meetings[0].agenda, meeting.agenda);
  assert.deepEqual(result.resolutions, original.resolutions);
  assert.deepEqual(original, initialState);
  assert.throws(() => meetingAtVersion(result, meeting.id, 1), /เปลี่ยนแล้ว/);
});
