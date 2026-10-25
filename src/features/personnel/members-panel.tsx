'use client';
import { Avatar, Badge, Button, EmptyState, Panel } from '@/components/ui';
import styles from '@/features/personnel/team.module.css';
import { ACCESS_ROLES, accessRoleLabels, type AccessRole } from '@/lib/access-control';
import { EMPTY_TASK_COUNTS } from '@/lib/workspace-selectors';
import { ArrowRight, LockKeyhole, Search, Users } from 'lucide-react';
import { workRoleLabels } from './personnel-model';
import type { TeamModel } from './use-team';
export function MembersPanel({
  model,
}: {
  model: Pick<
    TeamModel,
    | 'isAdmin'
    | 'filtered'
    | 'users'
    | 'pendingCount'
    | 'query'
    | 'setQuery'
    | 'unit'
    | 'setUnit'
    | 'units'
    | 'roleFilter'
    | 'setRoleFilter'
    | 'ready'
    | 'state'
    | 'taskIndex'
    | 'getRole'
    | 'adminCount'
    | 'selectedId'
    | 'setSelectedId'
    | 'mode'
    | 'busy'
    | 'saving'
    | 'openRoleChange'
  >;
}) {
  const {
    isAdmin,
    filtered,
    users,
    pendingCount,
    query,
    setQuery,
    unit,
    setUnit,
    units,
    roleFilter,
    setRoleFilter,
    ready,
    state,
    taskIndex,
    getRole,
    adminCount,
    selectedId,
    setSelectedId,
    mode,
    busy,
    saving,
    openRoleChange,
  } = model;
  return (
    <Panel
      title="สมาชิกในพื้นที่ทำงาน"
      description={
        isAdmin
          ? 'เลือกบทบาทเพื่อดูผลกระทบและยืนยันการเปลี่ยนแปลง'
          : 'ดูรายชื่อ บทบาทการเข้าถึง และงานที่แต่ละคนรับผิดชอบ'
      }
      action={
        <span className={styles.memberTotal}>
          {filtered.length === users.length
            ? `${users.length} คน`
            : `${filtered.length} จาก ${users.length} คน`}
          {pendingCount > 0 && (
            <span className={styles.personMeta}>รอเข้าใช้งาน {pendingCount} คน</span>
          )}
        </span>
      }
    >
      <div className={styles.filters}>
        <div className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input
            className="input"
            aria-label="ค้นหาบุคลากร"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              isAdmin ? 'ค้นหาชื่อ อีเมล หน่วยงาน หรือบทบาท' : 'ค้นหาชื่อ หน่วยงาน หรือบทบาท'
            }
          />
        </div>
        <select
          className="select"
          aria-label="กรองหน่วยงานบุคลากร"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
        >
          <option value="all">ทุกหน่วยงาน</option>
          {units.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select
          className="select"
          aria-label="กรองบทบาทการเข้าถึง"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as AccessRole | 'all')}
        >
          <option value="all">ทุกบทบาท</option>
          {ACCESS_ROLES.map((role) => (
            <option key={role} value={role}>
              {accessRoleLabels[role]}
            </option>
          ))}
        </select>
      </div>
      {!ready ? (
        <div className={styles.loading} role="status" aria-label="กำลังโหลดรายชื่อบุคลากร">
          <span />
          <span />
          <span />
          <p>กำลังโหลดรายชื่อบุคลากร…</p>
        </div>
      ) : filtered.length ? (
        <div className="table-scroll">
          <table className={`data-table ${styles.memberTable}`}>
            <thead>
              <tr>
                <th scope="col">บุคลากร</th>
                <th scope="col">หน่วยงาน / หน้าที่</th>
                <th scope="col">บทบาทการเข้าถึง</th>
                <th scope="col" className={styles.numeric}>
                  งานที่รับผิดชอบ
                </th>
                <th scope="col" className={styles.numeric}>
                  เกินกำหนด
                </th>
                <th scope="col">
                  <span className="sr-only">ดูรายละเอียด</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => {
                const { active, overdue } = taskIndex.byOwner.get(person.id) ?? EMPTY_TASK_COUNTS;
                const memberRole = getRole(person);
                const pending = person.membershipStatus === 'pending';
                const lastAdmin = !pending && memberRole === 'admin' && adminCount <= 1;
                return (
                  <tr
                    key={person.id}
                    className={selectedId === person.id ? styles.selectedRow : undefined}
                  >
                    <td>
                      <button
                        className={styles.person}
                        onClick={() => setSelectedId(selectedId === person.id ? null : person.id)}
                        type="button"
                        aria-expanded={selectedId === person.id}
                        aria-controls={selectedId === person.id ? 'member-task-details' : undefined}
                      >
                        <Avatar userId={person.id} />
                        <span>
                          <span className={styles.personName}>{person.name}</span>
                          {pending ? (
                            <span className={styles.pendingBadge}>
                              <Badge tone="warning">รอเข้าใช้งาน</Badge>
                            </span>
                          ) : (
                            <span className={styles.personMeta}>
                              {person.id === state.currentUserId
                                ? 'บัญชีของคุณ'
                                : mode === 'demo'
                                  ? 'บัญชีตัวอย่าง'
                                  : 'สมาชิกพื้นที่ทำงาน'}
                            </span>
                          )}
                          {person.email && (isAdmin || person.id === state.currentUserId) && (
                            <span className={styles.personEmail}>{person.email}</span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={styles.unitName}>{person.unit}</span>
                      {!pending && (
                        <span className={styles.personMeta}>{workRoleLabels[person.role]}</span>
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <div className={styles.memberRole}>
                          <select
                            className="select"
                            value={memberRole}
                            disabled={busy || saving || lastAdmin}
                            aria-label={`บทบาทการเข้าถึงของ ${person.name}`}
                            aria-describedby={lastAdmin ? `last-admin-${person.id}` : undefined}
                            onChange={(event) =>
                              openRoleChange(person, event.target.value as AccessRole)
                            }
                          >
                            {ACCESS_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {accessRoleLabels[role]}
                              </option>
                            ))}
                          </select>
                          {lastAdmin && (
                            <span id={`last-admin-${person.id}`} className={styles.roleNote}>
                              <LockKeyhole size={11} aria-hidden="true" />
                              ผู้ดูแลคนสุดท้าย
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge tone={memberRole === 'admin' ? 'info' : 'neutral'}>
                          {accessRoleLabels[memberRole]}
                        </Badge>
                      )}
                    </td>
                    <td className={styles.numeric}>
                      {pending ? (
                        <span className={styles.pendingWork}>ยังไม่เริ่มใช้งาน</span>
                      ) : (
                        <>
                          {active}
                          <span className={styles.countUnit}>งาน</span>
                        </>
                      )}
                    </td>
                    <td
                      className={`${styles.numeric} ${overdue && !pending ? styles.overdue : styles.zeroCount}`}
                    >
                      {pending ? '—' : overdue || '—'}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${pending ? 'ดูข้อมูลของ' : 'ดูงานของ'} ${person.name}`}
                        aria-expanded={selectedId === person.id}
                        onClick={() => setSelectedId(selectedId === person.id ? null : person.id)}
                      >
                        <ArrowRight size={17} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={users.length ? 'ไม่พบบุคลากรตามเงื่อนไข' : 'ยังไม่มีรายชื่อบุคลากร'}
          description={
            users.length
              ? 'ลองค้นหาด้วยชื่อ หรือเลือกแสดงทุกหน่วยงานและทุกบทบาท'
              : 'เมื่อมีสมาชิกในพื้นที่ทำงาน รายชื่อและบทบาทจะแสดงที่นี่'
          }
        >
          {users.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setUnit('all');
                setRoleFilter('all');
              }}
            >
              ล้างตัวกรอง
            </Button>
          )}
        </EmptyState>
      )}
      <div className={styles.memberFootnote}>
        <span>
          <LockKeyhole size={14} aria-hidden="true" />
          Staff เห็นเฉพาะข้อมูลตนเอง
        </span>
        <span>
          {isAdmin ? 'บทบาทการเข้าถึงแยกจากหน้าที่ในงาน' : 'ผู้ดูแลระบบเป็นผู้จัดการบทบาทและสิทธิ์'}
        </span>
      </div>
    </Panel>
  );
}
