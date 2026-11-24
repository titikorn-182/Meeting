import type { Meeting, MeetingUpdate, WorkspaceState } from '@/lib/types';
export function meetingAtVersion(
  state: WorkspaceState,
  id: string,
  expectedVersion: number,
): Meeting {
  const meeting = state.meetings.find((item) => item.id === id);
  if (!meeting) throw new Error('ไม่พบการประชุม');
  if ((meeting.rowVersion ?? 1) !== expectedVersion)
    throw new Error('ข้อมูลการประชุมเปลี่ยนแล้ว กรุณาโหลดใหม่ก่อนบันทึก');
  return meeting;
}
export function replaceMeeting(state: WorkspaceState, meeting: Meeting): WorkspaceState {
  return {
    ...state,
    meetings: state.meetings.map((item) =>
      item.id === meeting.id ? { ...meeting, rowVersion: (item.rowVersion ?? 1) + 1 } : item,
    ),
  };
}
export function editMeeting(
  state: WorkspaceState,
  id: string,
  expectedVersion: number,
  input: MeetingUpdate,
): WorkspaceState {
  const meeting = meetingAtVersion(state, id, expectedVersion);
  if (
    !input.title.trim() ||
    !input.location.trim() ||
    !input.reason.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)
  )
    throw new Error('กรอกข้อมูลการประชุมและเหตุผลให้ครบ');
  const { reason: _reason, ...fields } = input;
  void _reason;
  return replaceMeeting(state, { ...meeting, ...fields });
}
