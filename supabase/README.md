# Supabase: ชุดเชื่อมต่อเว็บระยะแรก

โฟลเดอร์นี้ใช้ [database.md](../database.md) เป็นแบบเป้าหมาย โดยทำเส้นทางที่หน้าจอปัจจุบันใช้งานจริงก่อน เก็บข้อมูลธุรกิจเป็นตารางสัมพันธ์ ไม่มีการเก็บ DemoState ทั้งก้อนลงฐานข้อมูล และไม่มีการนำข้อมูล demo/localStorage ไปสร้างเป็นข้อมูลจริงโดยอัตโนมัติ

## เตรียม Supabase project เมื่อพร้อมใส่ keys

1. สร้าง Supabase project และเก็บ Project URL กับ publishable key ตาม `.env.example` ที่ root ไม่ต้องนำ secret/service-role key ไปใส่ browser
2. ใน SQL Editor ของ project ใหม่ คัดลอกเนื้อหาทั้งหมดจาก [install.sql](install.sql) แล้วกด Run **ครั้งเดียว** ไฟล์นี้รวม migrations ทั้ง 4 ไฟล์ตามลำดับไว้แล้ว จึงไม่ต้องรันไฟล์แยกซ้ำ หากใช้ Supabase CLI ให้เลือกใช้ `migrations/` กับ migration workflow ของ CLI แทน ไม่รันซ้ำสองวิธี
3. สร้างผู้ใช้จริงใน Authentication → Users และตั้งวิธี login/password ตามหน้าเข้าสู่ระบบของเว็บ บัญชี Auth เพียงอย่างเดียวยังเข้า workspace ไม่ได้
4. คัดลอก [bootstrap.example.sql](bootstrap.example.sql) ไปแก้ UUID จริง แล้วรันเฉพาะคำสั่งที่ต้องการผ่าน SQL Editor เพื่อสร้างองค์กร หน่วยงาน และให้บทบาทอย่างชัดเจน ห้ามรัน placeholders โดยไม่แก้
5. สร้างอย่างน้อยเลขานุการ ผู้รับผิดชอบ ผู้ตรวจ และผู้มีอำนาจอนุมัติ หรือให้หลายบทบาทแก่บุคคลตามสิทธิที่องค์กรรับรอง ผู้ทำกับผู้ตรวจงานเดียวกันต้องเป็นคนละคน และผู้ยื่นคำขออนุมัติคำขอตนเองไม่ได้
6. ใส่ environment ตามคู่มือ root แล้วเริ่ม Next.js ใหม่ เข้าสู่ระบบด้วยบัญชีที่ได้รับ membership บัญชีเดียวมีหลายองค์กรได้ แต่ UI ระยะแรกเปิดองค์กรที่มี membership เก่าที่สุดโดยค่าเริ่มต้น; API รับ organization ID สำหรับเลือกขอบเขต
7. ทดสอบครบเส้นทาง: เลขานุการสร้างประชุม/มติ → ผู้มีอำนาจอนุญาตเริ่ม → เลขานุการมอบหมาย → เจ้าของรับทราบ/เริ่ม/รายงาน/เพิ่มลิงก์หลักฐาน/ส่งตรวจ → ผู้ตรวจคืนแก้หรือรับรอง → ผู้มีอำนาจปิดมติ

| Migration | หน้าที่ |
|---|---|
| [202610250001_core.sql](migrations/202610250001_core.sql) | ตารางหลัก, tenant FKs, unique/check constraints, RLS และปิด direct client grants |
| [202610250002_access.sql](migrations/202610250002_access.sql) | Permission templates, current identity/assignment checks, immutable triggers, guard locks และ private provisioning |
| [202610250003_workspace_read.sql](migrations/202610250003_workspace_read.sql) | อ่านข้อมูลที่ผู้ใช้มีสิทธิแล้วแปลงเป็น DTO ของ UI |
| [202610250004_commands.sql](migrations/202610250004_commands.sql) | Transactional commands, row-version conflicts, idempotency, submissions/reviews/changes/closure |

Migrations นี้เป็นฐานเริ่มต้นสำหรับ project ใหม่ ถ้า project มีตารางชื่อเดียวกันหรือข้อมูลจริงอยู่แล้ว ต้องตรวจและเขียน migration ผสานก่อน ไม่ใช้ DROP TABLE เพื่อทำให้รันผ่าน

`install.sql` เก็บ transaction ของแต่ละ migration ไว้แยกกัน หากพบข้อผิดพลาดในช่วงท้าย ส่วนก่อนหน้าอาจติดตั้งสำเร็จแล้ว ให้ตรวจผลและแก้จากจุดที่ล้มเหลว ไม่รันทั้งไฟล์ซ้ำทันที ไฟล์นี้ไม่สร้างบัญชี Auth หรือ membership ให้ ต้องทำข้อ 3–5 ต่อด้วยข้อมูลจริง

หลังติดตั้ง ตรวจใน SQL Editor ว่าฟังก์ชันหลักทั้งสองมีอยู่ โดยผลทั้งสองคอลัมน์ต้องไม่เป็น `null`:

```sql
select
  to_regprocedure('public.get_workspace_state(uuid)') as read_rpc,
  to_regprocedure('public.workspace_command(uuid,text,jsonb,uuid)') as write_rpc;
```

จากนั้นเข้าสู่เว็บด้วยบัญชีที่ตั้ง membership แล้วจึงทดสอบอ่านและบันทึกข้อมูล การตอบกลับจาก Auth health เพียงอย่างเดียวยืนยันได้เฉพาะว่า Project URL และ public key ติดต่อบริการได้ ไม่ได้ยืนยันว่าฐานข้อมูลและสิทธิ์ติดตั้งครบ

## ขอบเขตที่เชื่อมแล้ว

- Auth identity แยกจาก profile, membership และ role grants ภายใน organization; ไม่ให้ signup คนแรกเป็น admin อัตโนมัติ
- ทะเบียนประชุม วาระ มติ เวอร์ชันเกณฑ์ และรอบมติ; อนุญาตเริ่มแยกจากการสร้างทะเบียน
- งานถาวรแยกรอบงาน/รุ่นขอบเขต เจ้าของ/ผู้ตรวจ การรับทราบ และกำหนดเดิม/ปัจจุบัน
- ความก้าวหน้าพร้อมรายงานที่แก้ย้อนหลังไม่ได้; 100% ไม่ใช่ accepted
- หลักฐานแบบลิงก์เป็น document version; submission ตรึง spec/evidence ตาม attempt
- ตรวจรับหรือคืนแก้ เก็บผลทุกเกณฑ์ในชุดส่ง; ห้ามผู้เคยเป็นเจ้าของ/ผู้ร่วมทำใน cycle กลับมาตรวจเอง
- คำขอเปลี่ยนกำหนด เจ้าของ และคำอธิบายขอบเขต มีผู้ตัดสินคนละคน; conflict ไม่เขียนทับการอนุมัติใหม่
- ปิดมติผ่านสิทธิแยกและตรวจทุกงานภายใต้ lock; ไม่ปิดมติ recurring ด้วยผลรอบเดียว
- แจ้งเตือนในระบบตามเหตุการณ์และสิทธิผู้รับ, audit ของคำสั่งที่สำเร็จ, ค่าตั้งที่มี version
- อ่านข้อมูลที่ได้รับสิทธิจากฐานข้อมูลจริงและส่งออกข้อมูลปัจจุบัน โดยยังไม่ใช่รายงาน KPI ย้อนหลังที่รับรองแล้ว

## สัญญา API

`public.get_workspace_state(p_organization_id uuid default null)` คืน `{ organization, users, units, eligibleOwners, roles, permissions, state }` ให้เฉพาะ active member ที่ยังมี role grant อย่างน้อยหนึ่งรายการ `eligibleOwners` เป็นรายชื่อขั้นต่ำ `{id,name,unit}` ของผู้ที่รับงานได้ในองค์กรเดียวกัน สำหรับผู้มีสิทธิยื่นคำขอหรือมอบหมาย โดยไม่ขยายขอบเขต users/history ผู้เห็นเพียง parent context ของมติจะไม่ได้ audit รายมติที่มีข้อความอำนาจหรือการปิด; task audit ที่มีสิทธิยังอ่านได้

`Task.id` และ `Resolution.id` ใน DTO/เส้นทางหน้าจอคือ **cycle ID**; `stableId` คือรหัส UUID ของงาน/มติถาวร ส่วน `code` เป็นรหัสอ่านได้ ห้ามใช้ตัวเลขจากจำนวนแถวออก code ใหม่ ฝั่ง SQL จัด sequence ภายใต้ transaction

`public.workspace_command(p_organization_id, p_operation, p_payload, p_idempotency_key)` รับ operation ที่ allowlist เท่านั้น ไม่รับ actor/role ที่ browser เลือกเป็นอำนาจ Actor มาจาก Auth session, permission จาก database ปัจจุบัน และการ mutate ข้อมูลเดิมต้องมี expectedVersion

| operation | payload หลัก |
|---|---|
| add_meeting | title, number, date, time, committee, location, status, agenda |
| add_resolution | title, content, meetingId, agenda, type, unit, coordinatorId, dueDate?, closureCriteria |
| authorize_resolution | id, expectedVersion, reason |
| add_task | resolutionId, title, description, deliverable, ownerId, reviewerId, unit, priority, dueDate, required, criteria |
| acknowledge_task | id, expectedVersion |
| update_progress | id, expectedVersion, progress, note |
| add_evidence | id, expectedVersion, evidence: {name, kind: link, url} |
| transition_task | id, expectedVersion, status: in_progress/submitted/accepted/revision, note?; accepted/revision ต้องส่ง criterionResults: boolean[] ตรงลำดับเกณฑ์ที่ตรึง และ accepted ต้อง true ทุกข้อ |
| create_change_request | taskId, expectedVersion, type: deadline/owner/scope, proposedValue, reason |
| decide_change | id ของ request, expectedVersion ของ request, approved, reason |
| close_resolution | id, expectedVersion, criteriaConfirmed, reason? |
| update_settings | patch: {reminderDays?, acknowledgmentDays?, reviewDays?, emailNotifications?} |
| mark_notification_read / mark_all_read | {id} / {} |

ส่ง idempotency key เดิมกับ payload เดิมเมื่อ retry คำสั่งที่ไม่ทราบผล การใช้ key เดิมกับ payload ต่างจะได้ IDEMPOTENCY_CONFLICT เมื่อ expectedVersion ไม่ตรงให้โหลดข้อมูลใหม่และให้ผู้ใช้ทบทวน ไม่ retry เขียนด้วย version ใหม่โดยเงียบ

## ขอบเขตสิทธิและข้อจำกัดระยะนี้

ตาราง public เปิด RLS และถอนสิทธิ SELECT/INSERT/UPDATE/DELETE ของ anon/authenticated ทั้งหมด แทนที่ด้วย read/write RPC ที่ SECURITY DEFINER, search_path ว่าง, tenant checks และ current membership/grants ไม่มี service-role key ในเส้นทางเว็บ การเรียก Data API ตรงจึงข้าม workflow ไม่ได้ ตาราง private ไม่อยู่ใน exposed schemas และ helper ไม่มี EXECUTE grant ให้ผู้ใช้

Role templates ระยะแรกเป็น organization scope: secretary อ่านทั้งองค์กรและบันทึกข้อมูล; executive อนุญาตเริ่ม/อนุมัติเปลี่ยน/ปิด; owner และ reviewer อ่านเฉพาะงานที่ได้รับมอบหมาย หน้ารายละเอียดมติของผู้เห็นเพียงงานหนึ่งจะได้ parent context ขั้นต่ำ ไม่ได้ถ้อยคำ/เกณฑ์ทั้งมติ หากต้องจำกัด committee/unit/record เพิ่ม ต้องทำ policy phase ถัดไปก่อนเปิดข้อมูลจำกัดชั้นใน project นี้

Global identity guard และ organization guard จัดลำดับการถอนสิทธิกับ business transaction; helper ตรวจสิทธิหลังได้ lock การเปลี่ยนสิทธิด้วยเครื่องมือดูแลต้องใช้ private provisioning/revoke helpers ตามตัวอย่าง Auth identity deletion มี trigger จับเส้นทาง cascade ด้วย กฎนี้ไม่ใช่การย้อนลบ transaction ที่ commit ก่อนถอนสิทธิ

ส่วนที่ยังไม่เปิดใช้จากแบบเต็มใน database.md:

- ไฟล์จริง/Storage/scan/quarantine/download gateway: รับเฉพาะลิงก์ http(s); ไฟล์จะถูกปฏิเสธ ไม่สร้าง metadata ที่แอบอ้างว่าอัปโหลดแล้ว
- วันครบกำหนดแบบ exact instant/no deadline, meeting-relative interpretation, business calendar, scheduled assignment/grants: UI รุ่นนี้รับ due date อย่างเดียว และปรับ owner มีผลทันที
- เกณฑ์หลายชนิดที่ผูกกับ evidence requirements ทีละข้อ, ผู้ร่วมส่งแทน, เปลี่ยนผู้ตรวจ, dependency/blockers, reporting plans และ recurrence: ยังต้องทำ workflow/UI เพิ่ม
- การเปลี่ยนเกณฑ์ที่มี pending submission: รุ่นนี้แก้คำอธิบาย scope เท่านั้นและให้ผู้ตรวจคืนแก้ก่อนอนุมัติ scope/owner; ทางเลือก keep_original ตามแบบเต็มยังไม่เปิด UI
- ยุติ/ทดแทน/reopen และ optional-task disposition: ไม่รับ command เหล่านี้ และปิดมติได้เมื่อทุก linked task ผ่านตรวจ; ไม่มีการถือ cancelled ว่าสำเร็จ
- รายงาน bitemporal/official KPI, immutable report artifact/source manifest, import/legacy promotion, retention/backup runbook: ยังไม่ใช่สิ่งที่ migration นี้รับรอง ให้ใช้ audit/version tables สำหรับตรวจรายการปัจจุบันเท่านั้น
- Notification scheduler/escalation/email ยังไม่ทำงาน; UI setting เก็บ version แต่ไม่เปิด email จริง Event notifications ในระบบเกิดพร้อม transaction
- Audit ที่นี่คงคำสั่งสำเร็จไว้ใน transaction; denied requests ต้องเพิ่ม security log sink ของ server/hosting ก่อนรับรอง audit ทั้งระบบ; database administrator ยังมีอำนาจเหนือ application immutability
- UI read RPC ส่งชุดข้อมูลที่มองเห็นครบสำหรับ workspace เริ่มต้น; server cursor pagination และ load tuning ตาม production envelope ยังต้องทำก่อนข้อมูลปริมาณมาก

## ทดสอบ

จาก root รัน `node supabase/tests/integration.mjs` หรือ `npm run test:db` หลังติดตั้ง dependencies การทดสอบใช้ PGlite ซึ่งรัน PostgreSQL จริงใน WASM และ Auth table/function stubs ภายใน test database ชั่วคราว ไม่ต้องมี API Key และไม่ติดต่อ Supabase project จริง

ชุดทดสอบรัน migrations ทุกไฟล์จริงแล้วทดสอบ actor scopes, RLS/grants, tenant FK, acknowledgment, optimistic conflicts/idempotency, progress, evidence freeze/attempts, historical self-review, closure, deadline/scope/owner changes, policy versions และ revocation ไม่มีการอ้างว่า tests นี้ทดสอบ Supabase Auth session/Storage hosted หรือ race หลาย database sessions ได้ครบ

ก่อนใช้ข้อมูลจริง ให้ทดสอบ hosted login/session และวงจรหลักด้วยบัญชีหลายบทบาท, ทดสอบ revoke/mutation ด้วย PostgreSQL สอง sessions จริง, กำหนดนโยบาย retention และทดสอบ backup/restore ฐานข้อมูลรวมไฟล์เมื่อเพิ่ม Storage แยก dev/test/prod และยืนยัน role templates กับผู้มีอำนาจของหน่วยงานก่อนนำร่อง
