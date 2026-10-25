export { isNormalizedWorkspaceSnapshot as isWorkspaceSnapshot } from './workspace-schema';
export type { WorkspaceSnapshot } from './workspace-schema';
export type { WorkspaceCommand, WorkspaceOperation, CommandResult } from './workspace-commands';

export const workspaceOperations = [
  'acknowledge_task',
  'transition_task',
  'update_progress',
  'add_evidence',
  'create_change_request',
  'decide_change',
  'add_resolution',
  'authorize_resolution',
  'add_task',
  'close_resolution',
  'add_meeting',
  'update_settings',
  'mark_notification_read',
  'mark_all_read',
  'set_member_role',
  'set_role_pages',
  'add_personnel',
  'set_pending_personnel_role',
] as const;

/** These are operational counts; the historical KPI engine is a separate phase. */
export function bangkokToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export const workspaceErrors: Record<string, string> = {
  UNAUTHENTICATED: 'กรุณาเข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ',
  FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิ์ดำเนินการ หรือสิทธิ์เพิ่งเปลี่ยน โปรดโหลดข้อมูลใหม่',
  NO_MEMBERSHIP: 'บัญชีนี้ยังไม่ได้รับสิทธิ์ในพื้นที่ทำงาน กรุณาติดต่อผู้ดูแลระบบ',
  NOT_FOUND: 'ไม่พบรายการนี้ หรือบัญชีของคุณไม่มีสิทธิ์เข้าถึง',
  STALE_VERSION: 'ข้อมูลเปลี่ยนหลังจากเปิดหน้านี้ กรุณาตรวจข้อมูลล่าสุดแล้วบันทึกอีกครั้ง',
  INVALID_TRANSITION: 'สถานะงานเปลี่ยนไปแล้ว หรือยังไม่ครบเงื่อนไขของขั้นตอนนี้',
  VALIDATION_FAILED: 'ข้อมูลยังไม่ครบหรือไม่ถูกต้อง กรุณาตรวจช่องที่กรอก',
  MISSING_EVIDENCE: 'กรุณาเพิ่มหลักฐานก่อนส่งผลงานตรวจ',
  SELF_REVIEW_NOT_ALLOWED: 'ผู้ที่เคยรับผิดชอบหรือร่วมทำผลงานรอบนี้ไม่สามารถตรวจรับเองได้',
  AUTHORIZATION_REQUIRED: 'มตินี้ยังไม่ได้รับอนุญาตให้เริ่มดำเนินงาน',
  DEPENDENCY_NOT_READY: 'งานหรือเงื่อนไขก่อนเริ่มยังไม่ครบ',
  IDEMPOTENCY_CONFLICT: 'คำขอนี้ใช้รหัสซ้ำกับข้อมูลอีกชุด กรุณาโหลดหน้าใหม่',
  FEATURE_NOT_AVAILABLE: 'ขั้นตอนนี้ยังไม่เปิดใช้กับฐานข้อมูลจริง',
  CONFIGURATION_REQUIRED: 'ยังตั้งค่าการเชื่อมต่อไม่ครบ กรุณาติดต่อผู้ดูแลระบบ',
  SCHEMA_NOT_READY: 'ฐานข้อมูลยังไม่พร้อม กรุณาให้ผู้ดูแลระบบติดตั้ง migrations ของโครงการ',
  CONNECTION_FAILED: 'เชื่อมต่อพื้นที่ทำงานไม่ได้ กรุณาตรวจเครือข่ายแล้วลองอีกครั้ง',
  INVALID_RESPONSE: 'รูปแบบข้อมูลไม่ตรงกับรุ่นของเว็บ กรุณาให้ผู้ดูแลตรวจ migrations',
  ACKNOWLEDGMENT_REQUIRED: 'กรุณารับทราบการมอบหมายก่อนเริ่มดำเนินงาน',
  MISSING_CRITERIA: 'กรุณาระบุเกณฑ์ให้ครบและยืนยันรายการที่ต้องตรวจ',
  PENDING_SUBMISSION: 'มีชุดผลงานรอตรวจอยู่ ให้ผู้ตรวจส่งกลับก่อนเปลี่ยนเจ้าของหรือขอบเขต',
  CLOSURE_NOT_READY: 'ยังปิดมติไม่ได้ โปรดตรวจงานที่ยังไม่ผ่าน เกณฑ์ปิด และคำขอที่ค้างอยู่',
  INVALID_ASSIGNEE: 'ผู้รับผิดชอบหรือผู้ตรวจไม่มีสิทธิ์ที่จำเป็น หรือเป็นบุคคลเดียวกัน',
  INVALID_REVIEWER: 'ผู้ตรวจที่ได้รับมอบหมายไม่มีสิทธิ์ตรวจแล้ว กรุณาติดต่อผู้ดูแลเพื่อมอบหมายใหม่',
  INVALID_UNIT: 'ไม่พบหน่วยงานที่ยังใช้งานอยู่ในพื้นที่ทำงานนี้',
  INVALID_DEADLINE: 'วันที่ขอขยายต้องอยู่หลังกำหนดปัจจุบัน',
  LAST_ADMIN_REQUIRED: 'ต้องมี Admin ที่ใช้งานได้อย่างน้อยหนึ่งคน กรุณามอบหมาย Admin อีกคนก่อน',
  PAGE_ACCESS_DENIED: 'บทบาทนี้ยังไม่มีสิทธิ์เข้าหน้านี้ กรุณาติดต่อ Admin',
  INACTIVE_MEMBER: 'บัญชีนี้ถูกระงับหรือพ้นสมาชิกแล้ว กรุณาให้ผู้ดูแลตรวจสอบ',
  PERSONNEL_ALREADY_EXISTS: 'มีรายชื่ออีเมลนี้อยู่แล้ว กรุณาค้นหาและจัดการบทบาทจากรายการเดิม',
  MEMBER_ALREADY_EXISTS:
    'บัญชีนี้มีประวัติสมาชิกในพื้นที่ทำงานแล้ว กรุณาจัดการจากรายการเดิมหรือติดต่อผู้ดูแล',
  INVITATION_CLAIMED: 'บุคลากรนี้เข้าใช้งานแล้ว กรุณาโหลดใหม่เพื่อจัดการบทบาทจากรายการสมาชิก',
  EMAIL_VERIFICATION_REQUIRED:
    'กรุณายืนยันอีเมลที่ผู้ดูแลระบุไว้ แล้วเข้าสู่ระบบอีกครั้งเพื่อรับสิทธิ์',
};

export class WorkspaceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 500,
  ) {
    super(workspaceErrors[code] ?? 'ยังดำเนินการไม่ได้ กรุณาลองอีกครั้ง');
  }
}
