'use client';
import { Button, PageHeader } from '@/components/ui';
import styles from '@/features/personnel/team.module.css';
import { ACCESS_ROLES, accessRoleLabels } from '@/lib/access-control';
import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { AddPersonnel } from './add-personnel';
import { RolePermissions } from './role-permissions';

import { MemberWorkload } from './member-workload';
import { MembersPanel } from './members-panel';
import { RoleChangeDialog } from './role-change-dialog';
import { useTeam } from './use-team';

export function TeamScreen() {
  const model = useTeam();
  const {
    isAdmin,
    access,
    ready,
    supportsPersonnel,
    busy,
    addingPersonnel,
    setTab,
    setAddingPersonnel,
    setFeedback,
    tab,
    handleTabKey,
    users,
    feedback,
    closePersonnelForm,
    setSelectedId,
    setQuery,
    setUnit,
    setRoleFilter,
    mode,
  } = model;
  return (
    <div className={`page-stack ${styles.team}`}>
      <PageHeader
        title="บุคลากรและสิทธิ์การใช้งาน"
        description="จัดการบทบาท การเข้าถึงแต่ละหน้า และติดตามภาระงานของบุคลากร"
      >
        <span className={styles.accessStatus}>
          <ShieldCheck size={17} aria-hidden="true" />
          {isAdmin ? 'ผู้ดูแลระบบ' : `สิทธิ์ของคุณ: ${accessRoleLabels[access.role]}`}
        </span>
        {isAdmin && (
          <Button
            id="add-personnel-button"
            disabled={!ready || !supportsPersonnel || busy || addingPersonnel}
            aria-expanded={addingPersonnel}
            aria-controls="add-personnel-panel"
            aria-describedby={!supportsPersonnel ? 'personnel-unavailable' : undefined}
            onClick={() => {
              setTab('members');
              setAddingPersonnel(true);
              setFeedback(null);
            }}
          >
            <UserPlus size={17} aria-hidden="true" />
            เพิ่มบุคลากร
          </Button>
        )}
      </PageHeader>
      {isAdmin && ready && !supportsPersonnel && (
        <p id="personnel-unavailable" className="inline-alert info">
          การเพิ่มบุคลากรยังไม่พร้อมใช้งาน กรุณาอัปเดตระบบก่อนเพิ่มรายชื่อใหม่
          คุณยังจัดการบทบาทของสมาชิกเดิมได้
        </p>
      )}
      <div className={styles.tabs} role="tablist" aria-label="บุคลากรและสิทธิ์">
        <button
          type="button"
          role="tab"
          id="team-tab-members"
          aria-controls="team-panel-members"
          aria-selected={tab === 'members'}
          tabIndex={tab === 'members' ? 0 : -1}
          onKeyDown={handleTabKey}
          onClick={() => setTab('members')}
        >
          <Users size={17} aria-hidden="true" />
          สมาชิก<span>{users.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="team-tab-permissions"
          aria-controls="team-panel-permissions"
          aria-selected={tab === 'permissions'}
          tabIndex={tab === 'permissions' ? 0 : -1}
          onKeyDown={handleTabKey}
          onClick={() => setTab('permissions')}
        >
          <ShieldCheck size={17} aria-hidden="true" />
          บทบาทและสิทธิ์<span>{ACCESS_ROLES.length}</span>
        </button>
      </div>
      <div
        id="team-panel-members"
        role="tabpanel"
        aria-labelledby="team-tab-members"
        hidden={tab !== 'members'}
        className={styles.tabPanel}
      >
        {feedback && (
          <p className={`inline-alert success ${styles.feedback}`} role="status">
            {feedback}
          </p>
        )}
        {isAdmin && addingPersonnel && supportsPersonnel && (
          <AddPersonnel
            onCancel={closePersonnelForm}
            onAdded={(id, name) => {
              closePersonnelForm();
              setSelectedId(id);
              setQuery('');
              setUnit('all');
              setRoleFilter('all');
              setFeedback(`เพิ่ม ${name} แล้ว · รอเจ้าตัวสมัครและยืนยันอีเมลเพื่อเข้าใช้งาน`);
            }}
          />
        )}
        <MembersPanel model={model} />
        <MemberWorkload model={model} />
      </div>
      <div
        id="team-panel-permissions"
        role="tabpanel"
        aria-labelledby="team-tab-permissions"
        hidden={tab !== 'permissions'}
      >
        <RolePermissions />
      </div>
      {mode === 'demo' && (
        <p className={styles.demoNote}>
          รายชื่อและข้อมูลทั้งหมดเป็นข้อมูลสมมติ
          การเปลี่ยนสิทธิ์ในโหมดสาธิตบันทึกไว้ในเบราว์เซอร์นี้
        </p>
      )}
      <RoleChangeDialog model={model} />
    </div>
  );
}
