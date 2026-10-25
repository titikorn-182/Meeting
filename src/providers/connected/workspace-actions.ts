import type { WorkspaceContextValue } from '@/components/workspace-context';
import type { WorkspaceSession, WorkspaceNotice } from '@/lib/workspace-session';

export function createWorkspaceActions(
  session: WorkspaceSession,
  notify: WorkspaceNotice,
): Pick<
  WorkspaceContextValue,
  | 'setWorkflowRole'
  | 'setAccessRole'
  | 'addPersonnel'
  | 'setPendingPersonnelRole'
  | 'setMemberRole'
  | 'setRolePages'
  | 'resetDemo'
  | 'acknowledgeTask'
  | 'transitionTask'
  | 'updateProgress'
  | 'addEvidence'
  | 'createChangeRequest'
  | 'decideChange'
  | 'addResolution'
  | 'authorizeResolution'
  | 'addTask'
  | 'closeResolution'
  | 'addMeeting'
  | 'updateSettings'
  | 'markNotificationRead'
  | 'markAllRead'
  | 'refresh'
> {
  const owner = session.getSnapshot().snapshot;
  const generation = session.getGeneration();
  // A detached form's async continuation must not issue commands as the next account.
  const command: WorkspaceSession['command'] = (operation, payload, success) => {
    const latest = session.getSnapshot().snapshot;
    if (
      !owner ||
      generation !== session.getGeneration() ||
      latest?.state.currentUserId !== owner.state.currentUserId ||
      latest.organization.id !== owner.organization.id
    )
      return Promise.resolve(null);
    return session.command(operation, payload, success);
  };
  const taskVersion = (id: string) =>
    session.getSnapshot().snapshot?.state.tasks.find((task) => task.id === id)?.rowVersion ??
    Number.NaN;
  const resolutionVersion = (id: string) =>
    session.getSnapshot().snapshot?.state.resolutions.find((item) => item.id === id)?.rowVersion ??
    Number.NaN;
  return {
    refresh: session.refresh,
    setWorkflowRole() {
      notify('สิทธิ์ของบัญชีนี้กำหนดโดยผู้ดูแลพื้นที่ทำงาน', 'info');
    },
    setAccessRole() {
      notify('สิทธิ์ของบัญชีนี้กำหนดโดย Admin ของพื้นที่ทำงาน', 'info');
    },
    async addPersonnel(input) {
      return (
        (
          await command(
            'add_personnel',
            { ...input },
            'เพิ่มบุคลากรแล้ว รอเจ้าตัวสมัครและยืนยันอีเมลเพื่อเข้าใช้งาน',
          )
        )?.id ?? null
      );
    },
    async setPendingPersonnelRole(invitationId, role, expectedVersion) {
      return !!(await command(
        'set_pending_personnel_role',
        { invitationId, role, expectedVersion },
        'บันทึกบทบาทบุคลากรที่รอเข้าใช้งานแล้ว',
      ));
    },
    async setMemberRole(profileId, role, expectedVersion) {
      return !!(await command(
        'set_member_role',
        { profileId, role, expectedVersion },
        'บันทึกบทบาทสมาชิกแล้ว',
      ));
    },
    async setRolePages(role, pages, expectedVersion) {
      return !!(await command(
        'set_role_pages',
        { role, pages, expectedVersion },
        'บันทึกสิทธิ์เข้าหน้าแล้ว',
      ));
    },
    resetDemo() {
      notify('พื้นที่ทำงานจริงไม่มีการรีเซ็ตข้อมูลตัวอย่าง', 'info');
    },
    async acknowledgeTask(id) {
      return !!(await command(
        'acknowledge_task',
        { id, expectedVersion: taskVersion(id) },
        'รับทราบการมอบหมายแล้ว',
      ));
    },
    async transitionTask(id, status, note = '', criterionResults) {
      return !!(await command(
        'transition_task',
        {
          id,
          status,
          note,
          ...(criterionResults ? { criterionResults } : {}),
          expectedVersion: taskVersion(id),
        },
        'บันทึกผลการดำเนินงานแล้ว',
      ));
    },
    async updateProgress(id, progress, note) {
      return !!(await command(
        'update_progress',
        { id, progress, note, expectedVersion: taskVersion(id) },
        'บันทึกความก้าวหน้าแล้ว',
      ));
    },
    async addEvidence(id, evidence) {
      return !!(await command(
        'add_evidence',
        { id, evidence, expectedVersion: taskVersion(id) },
        'บันทึกลิงก์หลักฐานแล้ว',
      ));
    },
    async createChangeRequest(input) {
      return !!(await command(
        'create_change_request',
        { ...input, expectedVersion: taskVersion(input.taskId) },
        'ยื่นคำขอแล้ว รอผู้มีอำนาจพิจารณา',
      ));
    },
    async decideChange(id, approved, reason) {
      return !!(await command(
        'decide_change',
        {
          id,
          approved,
          reason,
          expectedVersion:
            session.getSnapshot().snapshot?.state.changes.find((change) => change.id === id)
              ?.rowVersion ?? Number.NaN,
        },
        'บันทึกผลพิจารณาแล้ว',
      ));
    },
    async addResolution(input) {
      return (await command('add_resolution', input, 'บันทึกมติแล้ว'))?.id ?? null;
    },
    async authorizeResolution(id) {
      return !!(await command(
        'authorize_resolution',
        {
          id,
          reason: 'อนุญาตให้เริ่มดำเนินงานตามมติผ่านหน้ารายละเอียดมติ',
          expectedVersion: resolutionVersion(id),
        },
        'บันทึกการอนุญาตเริ่มดำเนินงานแล้ว',
      ));
    },
    async addTask(input) {
      return (await command('add_task', input, 'มอบหมายงานแล้ว รอผู้รับผิดชอบรับทราบ'))?.id ?? null;
    },
    async closeResolution(id, criteriaConfirmed) {
      return !!(await command(
        'close_resolution',
        {
          id,
          criteriaConfirmed,
          reason: 'ตรวจเกณฑ์ระดับมติและงานจำเป็นครบแล้ว',
          expectedVersion: resolutionVersion(id),
        },
        'รับรองปิดมติแล้ว',
      ));
    },
    async addMeeting(input) {
      return (await command('add_meeting', input, 'บันทึกการประชุมแล้ว'))?.id ?? null;
    },
    async updateSettings(patch) {
      return !!(await command('update_settings', { patch }, 'บันทึกการตั้งค่าแล้ว'));
    },
    async markNotificationRead(id) {
      await command('mark_notification_read', { id }, 'ทำเครื่องหมายอ่านแล้ว');
    },
    async markAllRead() {
      await command('mark_all_read', {}, 'ทำเครื่องหมายอ่านทั้งหมดแล้ว');
    },
  };
}
