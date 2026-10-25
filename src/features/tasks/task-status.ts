import type { TaskStatus } from '@/lib/types';
export const taskStatusLabels: Record<TaskStatus, string> = {
  assigned: 'มอบหมายแล้ว',
  in_progress: 'กำลังดำเนินการ',
  submitted: 'ส่งตรวจแล้ว',
  revision: 'ให้แก้ไข',
  accepted: 'ตรวจรับแล้ว',
  cancelled: 'ยุติงาน',
};
