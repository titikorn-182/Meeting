import type { DemoState, Meeting, Resolution, Task, User } from './types';

/** All names, records and attachment metadata below are synthetic. No real institutional data is included. */
export const DEMO_TODAY = '2026-10-24';

export const users: User[] = [
  { id: 'u-siriporn', name: 'ศิริพร ใจมั่น', initials: 'ศพ', role: 'secretary', unit: 'สำนักงานเลขานุการ', avatarColor: '#5f7161' },
  { id: 'u-thanaphorn', name: 'ธนพร วัฒนกุล', initials: 'ธพ', role: 'owner', unit: 'งานแผนและประกันคุณภาพ', avatarColor: '#b38350' },
  { id: 'u-somchai', name: 'รศ.ดร.สมชาย รุ่งเรือง', initials: 'สช', role: 'reviewer', unit: 'งานวิชาการ', avatarColor: '#6c7a89' },
  { id: 'u-anan', name: 'รศ.ดร.อนันต์ กิตติคุณ', initials: 'อน', role: 'executive', unit: 'สำนักงานคณบดี', avatarColor: '#865b56' },
  { id: 'u-nattapong', name: 'ณัฐพงษ์ แสงทอง', initials: 'ณพ', role: 'owner', unit: 'งานวิชาการ', avatarColor: '#6a8580' },
  { id: 'u-kannika', name: 'กรรณิการ์ พูนสุข', initials: 'กณ', role: 'owner', unit: 'งานพัฒนานักศึกษา', avatarColor: '#9d7894' },
];

export const meetings: Meeting[] = [
  { id: 'm01', title: 'ประชุมคณะกรรมการประจำคณะรัฐศาสตร์', number: '8/2569', date: '2026-08-26', time: '09:30', location: 'ห้องประชุมคณะรัฐศาสตร์ ชั้น 2', status: 'completed', committee: 'คณะกรรมการประจำคณะรัฐศาสตร์', agenda: [
    { id: 'a01', number: '4.1', title: 'ทบทวนแผนพัฒนาบุคลากร', resolutionIds: ['r01'] },
    { id: 'a02', number: '4.2', title: 'กิจกรรมเตรียมความพร้อมนักศึกษา', resolutionIds: ['r02'] },
    { id: 'a03', number: '5.1', title: 'รายงานผลการตรวจประเมินคุณภาพ', resolutionIds: ['r03'] },
  ] },
  { id: 'm02', title: 'ประชุมคณะกรรมการบริหารคณะรัฐศาสตร์', number: '9/2569', date: '2026-09-23', time: '13:30', location: 'ห้องประชุมคณะรัฐศาสตร์ ชั้น 2', status: 'completed', committee: 'คณะกรรมการบริหารคณะรัฐศาสตร์', agenda: [
    { id: 'a04', number: '4.1', title: 'กรอบงบประมาณประจำปี 2570', resolutionIds: ['r04'] },
    { id: 'a05', number: '4.2', title: 'ความร่วมมือกับชุมชน', resolutionIds: ['r05'] },
    { id: 'a06', number: '4.3', title: 'ปรับปรุงการให้บริการนักศึกษา', resolutionIds: ['r06'] },
    { id: 'a06b', number: '5.1', title: 'รายงานการใช้จ่ายงบประมาณรายเดือน', resolutionIds: ['r10'] },
  ] },
  { id: 'm03', title: 'ประชุมคณะกรรมการประจำคณะรัฐศาสตร์', number: '10/2569', date: '2026-10-15', time: '09:30', location: 'ห้องประชุมคณะรัฐศาสตร์ ชั้น 2 / ออนไลน์', status: 'completed', committee: 'คณะกรรมการประจำคณะรัฐศาสตร์', agenda: [
    { id: 'a07', number: '3.1', title: 'ติดตามการจัดทำแผนพัฒนาบุคลากร', resolutionIds: ['r01'] },
    { id: 'a08', number: '4.1', title: 'ทบทวนหลักสูตรและการเรียนรู้', resolutionIds: ['r07'] },
    { id: 'a09', number: '4.2', title: 'จัดระบบหลักฐานประกันคุณภาพ', resolutionIds: ['r08'] },
    { id: 'a10', number: '4.3', title: 'พัฒนาเว็บไซต์คณะ', resolutionIds: ['r09'] },
    { id: 'a11', number: '5.1', title: 'รายงานการใช้จ่ายงบประมาณรายเดือน', resolutionIds: ['r10'] },
    { id: 'a12', number: '5.2', title: 'แนวทางสื่อสารงานบริการวิชาการ', resolutionIds: ['r11'] },
    { id: 'a13', number: '5.3', title: 'รับทราบปฏิทินกิจกรรมมหาวิทยาลัย', resolutionIds: ['r12'] },
  ] },
  { id: 'm04', title: 'ประชุมคณะกรรมการประจำคณะรัฐศาสตร์', number: '11/2569', date: '2026-11-12', time: '09:30', location: 'ห้องประชุมคณะรัฐศาสตร์ ชั้น 2', status: 'scheduled', committee: 'คณะกรรมการประจำคณะรัฐศาสตร์', agenda: [
    { id: 'a14', number: '3.1', title: 'ติดตามมติที่ยังอยู่ระหว่างดำเนินการ', resolutionIds: ['r01', 'r04', 'r07'] },
    { id: 'a15', number: '4.1', title: 'พิจารณาแผนพัฒนาบุคลากรฉบับสมบูรณ์', resolutionIds: ['r01'] },
  ] },
];

type ResolutionSeed = Pick<Resolution, 'id' | 'title' | 'meetingId' | 'agenda' | 'unit' | 'status'> & Partial<Resolution>;
function resolution(seed: ResolutionSeed): Resolution {
  const meeting = meetings.find((item) => item.id === seed.meetingId)!;
  return {
    code: `มติ 2569/${seed.id.slice(1).padStart(3, '0')}`,
    content: `ที่ประชุมเห็นชอบให้${seed.unit}ดำเนินการ${seed.title} โดยประสานหน่วยงานที่เกี่ยวข้อง รวบรวมหลักฐาน และรายงานผลตามกำหนด`,
    type: 'action', coordinatorId: 'u-siriporn', createdAt: `${meeting.date}T12:00:00+07:00`,
    closureCriteria: ['งานจำเป็นทุกงานได้รับการตรวจรับ', 'บันทึกผลสรุปและหลักฐานสำหรับรายงานต่อที่ประชุม'],
    ...seed,
  };
}

export const resolutions: Resolution[] = [
  resolution({ id: 'r01', title: 'จัดทำแผนพัฒนาบุคลากร ปีงบประมาณ 2570', meetingId: 'm01', agenda: '4.1', unit: 'งานแผนและประกันคุณภาพ', status: 'open', dueDate: '2026-11-05', closureCriteria: ['ผลสำรวจและร่างแผนได้รับการตรวจรับ', 'นำเสนอแผนต่อที่ประชุมคณะกรรมการประจำคณะ'] }),
  resolution({ id: 'r02', title: 'จัดกิจกรรมเตรียมความพร้อมนักศึกษาใหม่', meetingId: 'm01', agenda: '4.2', unit: 'งานพัฒนานักศึกษา', status: 'closed', dueDate: '2026-09-30', type: 'approval' }),
  resolution({ id: 'r03', title: 'จัดทำแผนปรับปรุงจากผลประเมินคุณภาพ', meetingId: 'm01', agenda: '5.1', unit: 'งานแผนและประกันคุณภาพ', status: 'pending_close', dueDate: '2026-10-20' }),
  resolution({ id: 'r04', title: 'ทบทวนกรอบงบประมาณและตัวชี้วัดประจำปี', meetingId: 'm02', agenda: '4.1', unit: 'งานแผนและประกันคุณภาพ', status: 'open', dueDate: '2026-10-23', type: 'approval' }),
  resolution({ id: 'r05', title: 'พัฒนาข้อเสนอความร่วมมือกับชุมชน', meetingId: 'm02', agenda: '4.2', unit: 'งานวิชาการ', status: 'open', dueDate: '2026-10-30' }),
  resolution({ id: 'r06', title: 'ปรับปรุงคู่มือการให้บริการนักศึกษา', meetingId: 'm02', agenda: '4.3', unit: 'งานพัฒนานักศึกษา', status: 'closed', dueDate: '2026-10-18' }),
  resolution({ id: 'r07', title: 'รวบรวมข้อเสนอเพื่อทบทวนหลักสูตร', meetingId: 'm03', agenda: '4.1', unit: 'งานวิชาการ', status: 'open', dueDate: '2026-10-28' }),
  resolution({ id: 'r08', title: 'จัดระบบหลักฐานการประกันคุณภาพ', meetingId: 'm03', agenda: '4.2', unit: 'งานแผนและประกันคุณภาพ', status: 'open', dueDate: '2026-10-30' }),
  resolution({ id: 'r09', title: 'ปรับปรุงข้อมูลและการเข้าถึงเว็บไซต์คณะ', meetingId: 'm03', agenda: '4.3', unit: 'สำนักงานเลขานุการ', status: 'open', dueDate: '2026-11-06' }),
  resolution({ id: 'r10', title: 'รายงานการใช้จ่ายงบประมาณรายเดือน', meetingId: 'm02', agenda: '5.1', unit: 'งานแผนและประกันคุณภาพ', status: 'open', dueDate: '2026-10-25', type: 'recurring', closureCriteria: ['แต่ละรอบมีหลักฐานและผลตรวจแยกกัน', 'มติแม่คงเปิดจนกว่าจะมีคำสั่งยุติ'] }),
  resolution({ id: 'r11', title: 'จัดทำแนวทางสื่อสารงานบริการวิชาการ', meetingId: 'm03', agenda: '5.2', unit: 'งานวิชาการ', status: 'open', dueDate: '2026-11-10' }),
  resolution({ id: 'r12', title: 'รับทราบปฏิทินกิจกรรมมหาวิทยาลัย ภาคเรียนที่ 2', meetingId: 'm03', agenda: '5.3', unit: 'สำนักงานเลขานุการ', status: 'acknowledged', type: 'acknowledgment', content: 'ที่ประชุมรับทราบปฏิทินกิจกรรมมหาวิทยาลัยประจำภาคเรียนที่ 2 โดยไม่มีการมอบหมายงานเพิ่มเติม', closureCriteria: [] }),
];

type TaskSeed = Pick<Task, 'id' | 'resolutionId' | 'title' | 'ownerId' | 'status' | 'progress' | 'dueDate'> & Partial<Task>;
function task(seed: TaskSeed): Task {
  const parent = resolutions.find((item) => item.id === seed.resolutionId)!;
  const owner = users.find((item) => item.id === seed.ownerId)!;
  const submitted = seed.status === 'submitted' || seed.status === 'accepted';
  const evidenceDate = seed.submittedAt ?? '2026-10-22T14:00:00+07:00';
  return {
    code: `งาน-${seed.id.slice(1).padStart(3, '0')}`, reviewerId: 'u-somchai', unit: owner.unit,
    priority: 'normal', originalDueDate: seed.dueDate, required: true,
    description: `ดำเนินการตามมติเรื่อง${parent.title} ประสานผู้เกี่ยวข้อง และจัดเก็บหลักฐานให้ตรวจสอบย้อนหลังได้`,
    deliverable: `เอกสาร${seed.title} พร้อมข้อมูลและหลักฐานประกอบ`,
    criteria: ['เนื้อหาครบตามขอบเขตที่ได้รับมอบหมาย', 'ข้อมูลตรวจสอบแหล่งที่มาได้', 'แนบหลักฐานฉบับที่ใช้ส่งตรวจครบถ้วน'],
    evidence: submitted ? [{ id: `ev-${seed.id}-1`, name: `${seed.title}.pdf`, size: '1.2 MB', kind: 'file', uploadedAt: evidenceDate }] : [],
    updates: seed.progress > 0 ? [{ id: `up-${seed.id}-1`, note: seed.status === 'revision' ? 'ผู้ตรวจขอให้เพิ่มรายละเอียดตัวชี้วัดและแหล่งข้อมูล กำลังปรับปรุงเอกสาร' : submitted ? 'ดำเนินการครบตามขอบเขตและส่งหลักฐานให้ผู้ตรวจแล้ว' : 'รวบรวมข้อมูลจากหน่วยงานที่เกี่ยวข้องแล้ว อยู่ระหว่างจัดทำเอกสารฉบับสมบูรณ์', progress: seed.progress, createdAt: submitted ? evidenceDate : '2026-10-22T10:30:00+07:00', authorId: seed.ownerId }] : [],
    ...(seed.status !== 'assigned' ? { acknowledgedAt: '2026-10-16T09:30:00+07:00' } : {}),
    ...(submitted ? { submittedAt: evidenceDate } : {}),
    ...(seed.status === 'accepted' ? { acceptedAt: '2026-10-23T10:00:00+07:00' } : {}),
    ...seed,
  };
}

export const tasks: Task[] = [
  task({ id: 't01', resolutionId: 'r01', title: 'สรุปผลสำรวจความต้องการพัฒนาบุคลากร', ownerId: 'u-thanaphorn', status: 'accepted', progress: 100, dueDate: '2026-10-20', submittedAt: '2026-10-19T14:00:00+07:00', acceptedAt: '2026-10-20T10:00:00+07:00' }),
  task({ id: 't02', resolutionId: 'r01', title: 'จัดทำร่างแผนพัฒนาบุคลากร', ownerId: 'u-thanaphorn', status: 'in_progress', progress: 65, dueDate: '2026-10-23', priority: 'high' }),
  task({ id: 't03', resolutionId: 'r01', title: 'สรุปกรอบงบประมาณและตัวชี้วัดของแผน', ownerId: 'u-thanaphorn', status: 'revision', progress: 80, dueDate: '2026-10-23', priority: 'high' }),
  task({ id: 't04', resolutionId: 'r02', title: 'จัดกิจกรรมและสรุปผลประเมินนักศึกษาใหม่', ownerId: 'u-kannika', status: 'accepted', progress: 100, dueDate: '2026-09-30', submittedAt: '2026-09-28T14:00:00+07:00', acceptedAt: '2026-09-29T10:00:00+07:00', acknowledgedAt: '2026-08-27T09:00:00+07:00' }),
  task({ id: 't05', resolutionId: 'r03', title: 'จัดทำแผนปรับปรุงตามข้อเสนอผู้ประเมิน', ownerId: 'u-thanaphorn', status: 'accepted', progress: 100, dueDate: '2026-10-20', submittedAt: '2026-10-18T14:00:00+07:00', acceptedAt: '2026-10-20T10:00:00+07:00' }),
  task({ id: 't06', resolutionId: 'r04', title: 'รวบรวมคำของบประมาณจากทุกหน่วยงาน', ownerId: 'u-thanaphorn', status: 'submitted', progress: 100, dueDate: '2026-10-20', submittedAt: '2026-10-19T15:00:00+07:00', priority: 'high' }),
  task({ id: 't07', resolutionId: 'r04', title: 'ทบทวนตัวชี้วัดและผลลัพธ์โครงการ', ownerId: 'u-thanaphorn', status: 'in_progress', progress: 50, dueDate: '2026-10-27' }),
  task({ id: 't08', resolutionId: 'r05', title: 'สำรวจโจทย์พัฒนาจากชุมชนเครือข่าย', ownerId: 'u-nattapong', status: 'submitted', progress: 100, dueDate: '2026-10-25' }),
  task({ id: 't09', resolutionId: 'r05', title: 'จัดทำร่างข้อเสนอความร่วมมือ', ownerId: 'u-nattapong', status: 'in_progress', progress: 35, dueDate: '2026-10-30' }),
  task({ id: 't10', resolutionId: 'r06', title: 'เผยแพร่คู่มือและทดสอบขั้นตอนบริการ', ownerId: 'u-kannika', status: 'accepted', progress: 100, dueDate: '2026-10-18', submittedAt: '2026-10-16T14:00:00+07:00', acceptedAt: '2026-10-17T10:00:00+07:00' }),
  task({ id: 't11', resolutionId: 'r07', title: 'รวบรวมความเห็นผู้ใช้บัณฑิต', ownerId: 'u-nattapong', status: 'in_progress', progress: 45, dueDate: '2026-11-05', originalDueDate: '2026-10-28' }),
  task({ id: 't12', resolutionId: 'r07', title: 'สรุปข้อเสนออาจารย์ประจำหลักสูตร', ownerId: 'u-nattapong', status: 'assigned', progress: 0, dueDate: '2026-10-28', priority: 'high' }),
  task({ id: 't13', resolutionId: 'r08', title: 'จัดหมวดหมู่และตรวจความครบถ้วนของหลักฐาน', ownerId: 'u-thanaphorn', status: 'in_progress', progress: 70, dueDate: '2026-10-24', priority: 'high' }),
  task({ id: 't14', resolutionId: 'r08', title: 'จัดทำดัชนีเอกสารประกันคุณภาพ', ownerId: 'u-thanaphorn', status: 'assigned', progress: 0, dueDate: '2026-10-30' }),
  task({ id: 't15', resolutionId: 'r09', title: 'ตรวจข้อมูลหลักสูตรและช่องทางติดต่อบนเว็บไซต์', ownerId: 'u-nattapong', status: 'in_progress', progress: 40, dueDate: '2026-11-03', priority: 'low' }),
  task({ id: 't16', resolutionId: 'r09', title: 'ปรับแบบฟอร์มติดต่อให้ใช้งานบนมือถือ', ownerId: 'u-nattapong', status: 'assigned', progress: 0, dueDate: '2026-11-06' }),
  task({ id: 't17', resolutionId: 'r10', title: 'รายงานการใช้จ่ายงบประมาณ รอบกันยายน', ownerId: 'u-thanaphorn', status: 'accepted', progress: 100, dueDate: '2026-10-05', submittedAt: '2026-10-02T14:00:00+07:00', acceptedAt: '2026-10-05T10:00:00+07:00', acknowledgedAt: '2026-09-24T09:00:00+07:00' }),
  task({ id: 't18', resolutionId: 'r10', title: 'รายงานการใช้จ่ายงบประมาณ รอบตุลาคม', ownerId: 'u-thanaphorn', status: 'in_progress', progress: 60, dueDate: '2026-10-25' }),
  task({ id: 't19', resolutionId: 'r11', title: 'จัดทำชุดข้อมูลกิจกรรมบริการวิชาการ', ownerId: 'u-nattapong', status: 'assigned', progress: 0, dueDate: '2026-11-10', priority: 'low' }),
  task({ id: 't20', resolutionId: 'r11', title: 'จัดพิมพ์แผ่นพับกิจกรรมบริการวิชาการ', ownerId: 'u-nattapong', status: 'cancelled', progress: 20, dueDate: '2026-10-22', required: false, description: 'ยุติงานจัดพิมพ์ตามการปรับขอบเขต ให้ใช้ชุดข้อมูลดิจิทัลแทน โดยคงประวัติงานเดิมไว้' }),
];

export const initialState: DemoState = {
  resolutions,
  tasks,
  meetings,
  changes: [
    { id: 'c01', code: 'CR-2569-014', taskId: 't03', type: 'deadline', status: 'pending', requestedById: 'u-thanaphorn', reason: 'ต้องรอข้อมูลค่าใช้จ่ายจากหน่วยงานที่เกี่ยวข้องเพิ่มเติม เพื่อให้ประมาณการครบถ้วน', createdAt: '2026-10-23T11:15:00+07:00', originalValue: '2026-10-23', proposedValue: '2026-10-30' },
    { id: 'c02', code: 'CR-2569-013', taskId: 't11', type: 'deadline', status: 'approved', requestedById: 'u-nattapong', reason: 'ขยายช่วงเก็บข้อมูลผู้ใช้บัณฑิตให้ครอบคลุมกลุ่มตัวอย่างตามแผน', createdAt: '2026-10-21T10:00:00+07:00', originalValue: '2026-10-28', proposedValue: '2026-11-05', decidedAt: '2026-10-22T09:20:00+07:00', decidedById: 'u-anan', decisionReason: 'เห็นชอบตามเหตุผล โดยให้รายงานความคืบหน้าในวันที่ 28 ตุลาคม' },
    { id: 'c03', code: 'CR-2569-015', taskId: 't07', type: 'scope', status: 'pending', requestedById: 'u-thanaphorn', reason: 'ขอเพิ่มข้อมูลค่าเป้าหมายย้อนหลังเพื่อให้เปรียบเทียบตัวชี้วัดระหว่างปีได้', createdAt: '2026-10-24T08:45:00+07:00', originalValue: tasks.find((item) => item.id === 't07')!.description, proposedValue: 'ทบทวนตัวชี้วัดปี 2570 พร้อมข้อมูลเปรียบเทียบปี 2569' },
    { id: 'c04', code: 'CR-2569-012', taskId: 't13', type: 'deadline', status: 'rejected', requestedById: 'u-thanaphorn', reason: 'ขอเวลาเพิ่มเติมในการจัดดัชนีหลักฐาน', createdAt: '2026-10-20T15:00:00+07:00', originalValue: '2026-10-24', proposedValue: '2026-10-31', decidedAt: '2026-10-21T10:00:00+07:00', decidedById: 'u-anan', decisionReason: 'คงกำหนดเดิม และมอบหมายผู้ช่วยจัดหมวดหมู่ข้อมูลเพิ่มเติม' },
  ],
  notifications: [
    { id: 'n01', title: 'มีคำขอเปลี่ยนแปลงใหม่', description: 'ธนพรขอปรับขอบเขตงานทบทวนตัวชี้วัด', createdAt: '2026-10-24T08:45:00+07:00', read: false, type: 'change', href: '/changes', targetId: 'c03' },
    { id: 'n02', title: 'งานครบกำหนดวันนี้', description: 'จัดหมวดหมู่และตรวจความครบถ้วนของหลักฐาน', createdAt: '2026-10-24T08:00:00+07:00', read: false, type: 'deadline', href: '/tasks/t13', targetId: 't13' },
    { id: 'n03', title: 'มีงานรอการตรวจรับ', description: 'ผลสำรวจโจทย์พัฒนาจากชุมชนเครือข่ายส่งตรวจแล้ว', createdAt: '2026-10-22T14:00:00+07:00', read: false, type: 'review', href: '/reviews', targetId: 't08' },
    { id: 'n04', title: 'คำขอขยายกำหนดได้รับอนุมัติ', description: 'รวบรวมความเห็นผู้ใช้บัณฑิต: กำหนดใหม่ 5 พฤศจิกายน', createdAt: '2026-10-22T09:20:00+07:00', read: true, type: 'change', href: '/changes', targetId: 'c02' },
    { id: 'n05', title: 'งานใหม่ที่ต้องรับทราบ', description: 'สรุปข้อเสนออาจารย์ประจำหลักสูตร', createdAt: '2026-10-16T09:00:00+07:00', read: false, type: 'assignment', href: '/tasks/t12', targetId: 't12' },
    { id: 'n06', title: 'ประชุมครั้งถัดไป 12 พฤศจิกายน', description: 'เตรียมผลติดตามมติและเอกสารประกอบวาระสืบเนื่อง', createdAt: '2026-10-23T16:00:00+07:00', read: true, type: 'system', href: '/meetings/m04', targetId: 'm04' },
    { id: 'n07', title: 'มติพร้อมรับรองปิด', description: 'แผนปรับปรุงจากผลประเมินคุณภาพตรวจรับครบแล้ว', createdAt: '2026-10-20T10:05:00+07:00', read: true, type: 'review', href: '/resolutions/r03', targetId: 'r03' },
  ],
  audit: [
    { id: 'au01', action: 'ยื่นคำขอปรับขอบเขต', actorId: 'u-thanaphorn', createdAt: '2026-10-24T08:45:00+07:00', targetId: 't07', targetLabel: 'ทบทวนตัวชี้วัดและผลลัพธ์โครงการ', detail: 'เพิ่มข้อมูลเปรียบเทียบปี 2569 — รอพิจารณา' },
    { id: 'au02', action: 'ยื่นคำขอขยายกำหนด', actorId: 'u-thanaphorn', createdAt: '2026-10-23T11:15:00+07:00', targetId: 't03', targetLabel: 'สรุปกรอบงบประมาณและตัวชี้วัดของแผน', detail: 'จาก 23 ต.ค. เป็น 30 ต.ค. 2569 — กำหนดเดิมยังมีผล' },
    { id: 'au03', action: 'ส่งผลงานตรวจรับ', actorId: 'u-nattapong', createdAt: '2026-10-22T14:00:00+07:00', targetId: 't08', targetLabel: 'สำรวจโจทย์พัฒนาจากชุมชนเครือข่าย', detail: 'ส่งผลงานรอบที่ 1 พร้อมหลักฐาน 1 รายการ' },
    { id: 'au04', action: 'อนุมัติขยายกำหนด', actorId: 'u-anan', createdAt: '2026-10-22T09:20:00+07:00', targetId: 't11', targetLabel: 'รวบรวมความเห็นผู้ใช้บัณฑิต', detail: 'กำหนดปัจจุบัน 5 พ.ย.; กำหนดเดิม 28 ต.ค. ยังคงไว้' },
    { id: 'au05', action: 'ตรวจรับผลงาน', actorId: 'u-somchai', createdAt: '2026-10-20T10:00:00+07:00', targetId: 't05', targetLabel: 'จัดทำแผนปรับปรุงตามข้อเสนอผู้ประเมิน', detail: 'ผ่านเกณฑ์ทุกข้อ พร้อมเสนอรับรองปิดมติ' },
    { id: 'au06', action: 'เผยแพร่มอบหมายงาน', actorId: 'u-siriporn', createdAt: '2026-10-16T09:00:00+07:00', targetId: 't12', targetLabel: 'สรุปข้อเสนออาจารย์ประจำหลักสูตร', detail: 'มอบหมายให้ณัฐพงษ์ กำหนดส่ง 28 ต.ค. 2569' },
  ],
  settings: { reminderDays: [7, 3, 0], acknowledgmentDays: 2, reviewDays: 3, emailNotifications: false },
  activeRole: 'secretary',
  currentUserId: 'u-siriporn',
};
