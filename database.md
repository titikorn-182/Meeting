# Database Design — POLUBU Smart meeting

เอกสารออกแบบฐานข้อมูลสำหรับระบบติดตามการดำเนินงานตามมติการประชุม

| รายการ | รายละเอียด |
|---|---|
| รุ่นเอกสาร | 1.0 — แบบออกแบบเพื่อใช้ทำ migrations และทบทวนกับเจ้าของกระบวนงาน |
| วันที่ | 25 ตุลาคม 2569 (2026-10-25), Asia/Bangkok |
| ฐานข้อมูลเป้าหมาย | PostgreSQL บน Supabase; Auth และ private Storage |
| ขอบเขต | ครอบคลุม FR-01–FR-22, BR-01–BR-18, KPI-01–KPI-10 ใน PRD รวมส่วนที่ UI จำลองยังไม่มี |
| สถานะการพัฒนา | เอกสารเป้าหมายฉบับเต็ม; เริ่ม implementation ระยะแรกแล้ว ดู [ขอบเขตและ migrations ที่ทำจริง](supabase/README.md) ส่วนที่ยังไม่เปิดใช้ระบุแยก และยังไม่ได้เชื่อม project จริงของผู้ใช้ |
| หลักฐานหลัก | [PRD.md](PRD.md), [README.md](README.md), [PRODUCT.md](PRODUCT.md), [types.ts](src/lib/types.ts), [workflow.ts](src/lib/workflow.ts), [DemoProvider](src/components/demo-provider.tsx) และหน้าจอใน src/components/screens |

ผู้ใช้เลือก Supabase เป็น backend เป้าหมายแล้ว จึงใช้แทนสถานะ “candidate” ของ stack ใน PRD เดิม แต่สิทธิผู้อนุมัติ ปฏิทินวันทำการ สูตร KPI ระยะเก็บข้อมูล และ SLA ยังเป็นข้อเสนอที่ต้องยืนยันตาม Q ใน PRD ไม่ถือว่าอนุมัติเพียงเพราะมีคอลัมน์รองรับ

## สารบัญ

1. [ข้อสรุปและหลักออกแบบ](#design-principles)
2. [ขอบเขตจากเว็บปัจจุบัน](#feature-coverage)
3. [โครงสร้างและ ERD](#architecture)
4. [มาตรฐานข้อมูล](#conventions)
5. [ตัวตน องค์กร และสิทธิ](#identity)
6. [การประชุม มติ และรอบมติ](#resolutions)
7. [งาน การมอบหมาย และการติดตาม](#tasks)
8. [เอกสาร หลักฐาน ส่งตรวจ และตรวจรับ](#evidence)
9. [คำขอเปลี่ยนแปลงและการปิดมติ](#decisions)
10. [กำหนดเวลา งานต่อเนื่อง และปฏิทิน](#time)
11. [แจ้งเตือน งานเบื้องหลัง และการตั้งค่า](#operations)
12. [ประวัติย้อนหลัง รายงาน และ KPI](#reporting)
13. [การนำเข้าและการเก็บรักษา](#imports)
14. [Constraints และ indexes](#constraints)
15. [ธุรกรรมและ API ที่เสนอ](#transactions)
16. [RLS, Auth และ Storage](#security)
17. [การเชื่อม UI และลำดับ migrations](#implementation)
18. [แผนทดสอบฐานข้อมูล](#testing)
19. [การเชื่อมโยงข้อกำหนดและคำถามค้าง](#traceability)
20. [เอกสารเทคนิคอ้างอิง](#references)

<a id="design-principles"></a>
## 1. ข้อสรุปและหลักออกแบบ

ใช้ฐานข้อมูลเชิงสัมพันธ์เป็นหลัก แยกข้อมูลธุรกิจที่มี FK ชัดเจนออกจาก JSON สำหรับ snapshot, payload งานเบื้องหลัง และประวัติรุ่น ไม่ย้ายโครงสร้าง DemoState ทั้งก้อนไปเก็บเป็น JSON แถวเดียว

สิ่งที่ต้องแยกตั้งแต่แรก:

| แนวคิด | หน่วยข้อมูล | เหตุผล |
|---|---|---|
| มติถาวร / ถ้อยคำแต่ละรุ่น / รอบติดตาม | resolutions / resolution_versions / resolution_cycles | เชื่อมมติเดิมหลายประชุมและเปิดใหม่ได้โดยไม่ลบผลเดิม |
| งานถาวร / รอบดำเนินงาน / รอบส่งตรวจ | tasks / task_cycles / submissions | รับรองและวัด KPI ที่รอบงาน; ส่งแก้หลายครั้งไม่เพิ่มจำนวนงาน |
| รายงานประชุม / อนุญาตเริ่มดำเนินงาน | minutes_versions / start_authorization_events | รับรองรายงานไม่ได้แปลว่าอนุญาตทุกมติ และกลับกัน |
| กำหนดเดิม / กำหนดปัจจุบัน / วันที่ขอ | original_deadline_version_id / current_deadline_version_id / deadline_change_proposals | คำขอค้างไม่มีผล และการขยายไม่ล้างฐานเดิม |
| ไฟล์เชิงตรรกะ / เนื้อหาไฟล์แต่ละรุ่น | documents / document_versions | submission ต้องชี้ฉบับแน่นอน ไม่ใช่ “ไฟล์ล่าสุด” |
| ข้อมูลปัจจุบัน / สิ่งที่ทราบในอดีต / รายงานที่ออกแล้ว | current projections / state revisions / report_snapshots | การย้ายเจ้าของหรือแก้ข้อมูลเข้าช้าไม่เปลี่ยนรายงานเดิม |
| บัญชี login / บุคคล / สิทธิธุรกิจ | auth.users / profiles / access_grants | ปิดบัญชีได้โดยยังรักษาประวัติ; admin ไม่มีอำนาจรับรองโดยอัตโนมัติ |

กฎแกนกลางของแบบนี้:

- หนึ่งรอบงานมีเจ้าของหลักที่มีผลเพียงคนเดียว มีผู้ร่วมหลายคนได้ และมีผู้ตรวจหลักหนึ่งคนใน MVP
- ความก้าวหน้า 100% เป็นข้อมูลรายงาน ไม่เปลี่ยนสถานะเป็น accepted หรือ closed
- การเปลี่ยนสถานะสำคัญผ่าน transactional RPC เท่านั้น ไม่เปิดให้ client UPDATE status โดยตรง
- ปิดมติอ้าง task_cycle ที่ตรวจรับจริงและเกณฑ์ระดับมติรุ่นที่ใช้ ไม่ตรวจเพียงค่าเฉลี่ยความก้าวหน้า
- งานต่อเนื่องสร้างงานตาม planned occurrence; การเปิดงานเดิมใหม่สร้าง cycle ใหม่ของ task เดิม ทั้งสองกรณีไม่ใช่สิ่งเดียวกัน
- ทุกการตัดสินใจเก็บผู้กระทำ อำนาจที่ใช้ เหตุผล เวลาบันทึก เวลามีผล และ reference ต้นทาง
- การอ่านประวัติใช้สิทธิปัจจุบัน การเก็บประวัติสิทธิไม่ได้ทำให้สิทธิเก่ากลับมาใช้ได้
- ไม่ลบประวัติธุรกิจด้วย cascade จากการลบบัญชีหรือรายการแม่

<a id="feature-coverage"></a>
## 2. ขอบเขตจากเว็บปัจจุบัน

| ฟีเจอร์ / หน้าจอ | ข้อมูลหลักที่จะใช้ | สิ่งที่ต้องเพิ่มจาก mock |
|---|---|---|
| หน้าแรกเลขานุการ | authorized task/resolution projections, pending requests, meetings | นับภายใต้ scope และแยกรอบงานออกจากรหัสถาวร |
| ทะเบียนและรายละเอียดมติ | resolutions, versions, cycles, criteria, cycle-task links | รุ่นถ้อยคำ การอนุญาตเริ่ม ประวัติการเปิดใหม่และยุติ |
| การประชุม/วาระ | committees, terms, meetings, agenda_items, minutes_versions | เอกสารรับรองหลายรุ่นและวาระติดตามมติเดิม |
| งานของฉัน/รายละเอียดงาน | task_cycles, assignments, progress, blockers, deadlines | ผู้ร่วม dependency รอบรายงาน และการรับช่วง |
| คิวตรวจ | submissions, submission_evidence, reviews, criterion_results | ชุดส่งคงที่ ผลตรวจหลายรอบ และห้ามตรวจผลงานที่ตนเคยร่วมทำ |
| คำขอเปลี่ยนแปลง | change_requests, typed proposals, decisions | ตรวจ conflict, ขอบเขตอำนาจ, ยุติ/ทดแทน/เปิดใหม่ |
| รายงานและ CSV | report_runs, snapshots, cohort members, formula versions | cutoff จริงและ snapshot ไม่ใช่ข้อมูลปัจจุบันที่ติดป้ายวันที่ย้อนหลัง |
| บุคลากรและหน่วยงาน | profiles, memberships, role grants | หลายบทบาท หลาย scope และการเปลี่ยนหน่วยงานตามเวลา |
| แจ้งเตือน/ตั้งค่า | outbox, notifications, deliveries, rules, calendar | ผู้รับแยกรายคน retry และ SLA ตามวันทำการ |
| ยังไม่มีหน้าครบใน UI | recurrence, import, retention, operational jobs | ออกแบบรองรับ PRD ไว้ แม้ยังไม่เปิดใช้หน้าจอ |

โมเดล Role สี่ค่าใน mock ไม่ใช่ permission model ของระบบจริง ส่วนค่าขนาดไฟล์ 20 MB, จำนวน 20 ไฟล์ และกรอบ 2/3/7 วันให้เป็น policy ที่มีรุ่นและยังรอเจ้าของยืนยัน

<a id="architecture"></a>
## 3. โครงสร้างและ ERD

### 3.1 การแบ่ง schema และขอบเขตระบบ

| ส่วน | หน้าที่ |
|---|---|
| auth | Supabase จัดการข้อมูลพิสูจน์ตัวตน ไม่สร้างหรือแก้โครงสร้าง auth.users เอง |
| public | ตารางธุรกิจที่กำหนด SELECT grants และ RLS รายตาราง; public workflow/read RPC ที่อนุญาต |
| private | helper ตรวจสิทธิ, request dedupe, outbox, state revisions, audit, import staging และงานระบบ; ไม่อยู่ใน exposed schemas ของ Data API |
| storage | metadata ที่ Supabase Storage จัดการ; เปลี่ยนไฟล์ผ่าน Storage API ไม่แก้ storage.objects เพื่อจำลองการอัปโหลด/ลบไฟล์ |
| private buckets | เนื้อหาเอกสาร หลักฐาน ไฟล์กักกัน และ export; ไม่ใช้ public URL เป็นสิทธิ |

นี่คือข้อเสนอชื่อ schema สำหรับ migrations ไม่ใช่การตั้งค่าที่ทำไปแล้ว public ไม่ได้หมายถึงเปิดอ่านให้บุคคลทั่วไป: ไม่ให้ anon อ่านข้อมูลธุรกิจ และต้องตรวจ grants พร้อม RLS เสมอ ดู [Supabase: securing your API](https://supabase.com/docs/guides/api/securing-your-api)

### 3.2 ความสัมพันธ์แกนหลัก

~~~mermaid
erDiagram
    organizations ||--o{ organization_units : contains
    organizations ||--o{ organization_memberships : admits
    profiles ||--o{ organization_memberships : joins
    profiles ||--o{ access_grants : receives
    committees ||--o{ committee_terms : has
    committee_terms ||--o{ meetings : convenes
    meetings ||--o{ agenda_items : contains
    meetings ||--o{ minutes_versions : records
    agenda_items ||--o{ agenda_resolution_links : references
    resolutions ||--o{ agenda_resolution_links : appears_in
    resolutions ||--o{ resolution_versions : versions
    resolutions ||--o{ resolution_cycles : tracks
    resolution_cycles ||--o{ start_authorization_events : authorizes
    resolution_cycles ||--o{ resolution_cycle_tasks : requires
    tasks ||--o{ task_cycles : executes
    task_cycles ||--o{ resolution_cycle_tasks : linked_to
    task_cycles ||--o{ owner_assignments : assigned
    task_cycles ||--o{ task_spec_versions : specifies
    task_spec_versions ||--o{ task_criteria : defines
    task_cycles ||--o{ progress_reports : reports
    task_cycles ||--o{ submissions : submits
    submissions ||--o{ submission_evidence : freezes
    document_versions ||--o{ submission_evidence : referenced
    documents ||--o{ document_versions : versions
    submissions ||--o| reviews : decided
    reviews ||--o{ review_criterion_results : evaluates
    task_cycles ||--o{ change_requests : changes
    change_requests ||--o| change_decisions : decided
    resolution_cycles ||--o{ closure_requests : proposes
    closure_requests ||--o| closure_decisions : decided
~~~

### 3.3 ประวัติ งานตามรอบ และรายงาน

~~~mermaid
erDiagram
    resolution_cycles ||--o{ recurrence_plans : plans
    recurrence_plans ||--o{ recurrence_plan_versions : versions
    recurrence_plan_versions ||--o{ recurrence_task_templates : specifies
    recurrence_plans ||--o{ recurrence_occurrences : expects
    recurrence_occurrences ||--o{ recurrence_occurrence_tasks : instantiates
    tasks ||--o| recurrence_occurrence_tasks : created_from
    task_cycles ||--o{ reporting_plans : schedules
    reporting_plans ||--o{ reporting_plan_versions : versions
    reporting_plans ||--o{ reporting_occurrences : expects
    reporting_occurrences ||--o{ reporting_responses : receives
    progress_report_versions ||--o{ reporting_responses : satisfies
    business_calendars ||--o{ business_calendar_versions : versions
    business_calendar_versions ||--o{ business_calendar_days : defines
    report_runs ||--o| report_snapshots : freezes
    report_snapshots ||--o{ report_source_manifest : protects
    metric_definition_versions ||--o{ report_metric_results : defines
    report_snapshots ||--o{ report_metric_results : reports
    report_snapshots ||--o{ report_cohort_members : traces
~~~

ERD แสดงแกนหลัก ไม่แสดงทุก FK เพื่อให้อ่านได้ พจนานุกรมด้านล่างเป็นข้อกำหนดอ้างอิงเมื่อรายละเอียดมากกว่าในภาพ

<a id="conventions"></a>
## 4. มาตรฐานข้อมูล

### 4.1 ชนิดข้อมูลและคอลัมน์ร่วม

| สัญลักษณ์ / มาตรฐาน | ความหมาย |
|---|---|
| id | uuid PK, DEFAULT gen_random_uuid(); ไม่ใช้รหัสแสดงผลเป็น PK |
| organization_id | uuid NOT NULL FK organizations; บังคับทุกแถวที่เป็นข้อมูลขององค์กร รวมตารางเชื่อมและประวัติ |
| created_at / recorded_at | timestamptz NOT NULL จาก server; recorded_at เป็นเวลาระบบรับบันทึก ไม่รับจาก client |
| created_by / actor_id | uuid FK profiles; งานระบบใช้ actor_kind=system และ service identity ไม่ปลอมเป็นบุคลากร |
| row_version | bigint NOT NULL DEFAULT 1, เพิ่มโดย server ในแถวปัจจุบันที่แก้ได้ |
| updated_at | timestamptz จาก server เฉพาะ mutable projections; ไม่ใช้แทนประวัติรุ่น |
| effective_at / valid_from / valid_to | เวลามีผลทางธุรกิจ; ช่วงใช้แบบ [from,to), to ว่างหมายถึงยังไม่มีสิ้นสุด |
| ? | nullable; field ที่ไม่มี ? เป็น NOT NULL เว้นคอลัมน์ร่างที่ระบุข้อยกเว้น |
| FK | อ้าง id ของตารางที่ระบุ; ถ้าเป็น business row ใช้ composite FK รวม organization_id ด้วย |
| UQ | unique constraint/index ตามชุดคอลัมน์; ทุก unique ในองค์กรใส่ organization_id เว้นระบุเป็น global |
| JSONB | ใช้กับ snapshot/payload ที่มี schema_version และ validation เท่านั้น ไม่ใช้แทน FK สำคัญ |
| date / timestamptz | date สำหรับกำหนดเป็นวัน; timestamptz สำหรับเหตุการณ์/กำหนดเวลาชัดเจน; ปีในฐานข้อมูลเป็น ค.ศ. |

ทุก business table มี id, organization_id, created_at/recorded_at และผู้สร้างตามความเหมาะสม แม้ไม่เขียนซ้ำทุกตาราง ตารางเชื่อมที่ใช้ composite PK ระบุไว้ต่างหาก ตารางอ้างอิง global เช่น permissions ไม่มี organization_id

เพิ่ม UNIQUE (organization_id,id) ให้ parent ที่ถูกอ้างด้วย composite FK แล้วให้ลูกอ้าง (organization_id,parent_id) → parent(organization_id,id) การตรวจ UUID เพียงอย่างเดียวไม่ป้องกันการผูกลูกผิดองค์กร

Current pointer เช่น current_cycle_id ต้องใช้ FK รวม parent id ด้วย เช่น resolutions(organization_id,id,current_cycle_id) → resolution_cycles(organization_id,resolution_id,id) เพื่อห้ามชี้ cycle ของมติอื่น เพิ่ม FK หลังสร้างตารางสองฝั่งและใช้ DEFERRABLE เมื่อจำเป็น

### 4.2 นโยบายข้อมูลคงที่

- ข้อมูล master ปิดด้วย is_active/disabled_at ไม่ลบเมื่อมีประวัติอ้างอิง
- แถว draft แก้ได้ภายใต้ row_version; รุ่นที่ confirmed/published แล้วห้ามแก้เนื้อหา
- คอลัมน์จบช่วง เช่น valid_to, revoked_at และ status ของ current projection เปลี่ยนได้ผ่าน RPC ที่เขียน state revision ในธุรกรรมเดียว ไม่ถือว่า mutable projection เป็นหลักฐานอดีต
- ชุดเนื้อหา/spec/evidence/participants ของ submissions, reviews, confirmed versions, closure decision payload, snapshot facts และ deadline versions เป็น immutable application records; submission.status/decided_at/withdrawn_at เป็น current projections จาก events/reviews ไม่ใช่เนื้อหาที่ตรึง
- FK ของข้อมูลธุรกิจหลักใช้ ON DELETE RESTRICT/NO ACTION; cascade ใช้ได้เฉพาะรายละเอียดของ draft ที่ยังไม่มีผู้อ้างและผ่าน RPC ตรวจแล้ว
- ค่าว่างที่ไม่ทราบจากการนำเข้าเก็บเป็น NULL + exception ไม่เติม “0%”, วันที่ปัจจุบัน หรือคนปัจจุบันเป็นประวัติสมมติ

### 4.3 รหัสแสดงผล

ใช้ code แยกจาก UUID และตาราง private.number_sequences สำหรับลำดับภายใต้ (organization_id,namespace,numbering_year,scope_key) ตัวอย่าง namespace=resolution,task,change_request; scope_key มาจากข้อตกลงการนับ เช่น committee หรือทั้งคณะ

ออกเลขด้วย UPDATE ... RETURNING หรือ row lock ใน transaction ห้าม SELECT MAX(code)+1; รหัสที่ออกแล้วไม่ใช้ซ้ำ แม้ยกเลิก ข้อเสนอเริ่มต้นคือมติและคำขอแยกปี ส่วนงานมีเลขวิ่งภายในองค์กร ต้องยืนยัน Q-01/Q-02 ไม่ hard-code 2569 จาก mock

<a id="identity"></a>
## 5. ตัวตน องค์กร และสิทธิ

### 5.1 ตาราง master และสมาชิก

| ตาราง | ฟิลด์เฉพาะที่สำคัญ | Constraints / การใช้งาน |
|---|---|---|
| organizations | code text, name_th text, timezone text DEFAULT 'Asia/Bangkok', is_active boolean | UQ(code); เป็นขอบเขตคณะ/เจ้าของข้อมูล รองรับหลายองค์กรโดยไม่เปิดสิทธิข้ามกัน |
| organization_units | code text, name_th text, parent_unit_id? FK ตัวเอง, is_active boolean | UQ(org,code); parent ต้ององค์กรเดียวกัน; ห้าม self/cycle ของผังหน่วยงานด้วย guarded operation |
| profiles | id uuid, display_name text, contact_email? text, avatar_path? text, disabled_at? timestamptz | บุคคลถาวร ใช้ข้าม membership ได้; ไม่เก็บ role เดี่ยว; contact อ่านผ่าน projection ตามสิทธิ |
| auth_identities | profile_id FK profiles, auth_user_id uuid FK auth.users, linked_at timestamptz, disabled_at? | UQ(auth_user_id); อาจรองรับหลาย identity ต่อบุคคลในอนาคต; ลบ auth identity ไม่ cascade ไป profile/ประวัติ |
| organization_memberships | profile_id FK, valid_from timestamptz, valid_to?, revoked_at?, status active/suspended, invited_by?, reason text | ไม่ให้ช่วง active ของบุคคลเดียวซ้อนในองค์กร; อ่านสิทธิจากสถานะปัจจุบันทุก request |
| unit_memberships | profile_id FK, unit_id FK, is_primary boolean, valid_from, valid_to?, reason | หลายหน่วยได้; primary ไม่ซ้อนเวลา; เก็บ history เมื่อย้าย ไม่แก้ snapshot เก่า |
| committees | code text, name_th text, coordinating_unit_id FK, is_active | UQ(org,code); ตัวตนคณะกรรมการต่อเนื่องข้ามวาระ |
| committee_terms | committee_id FK, term_code text, starts_on date, ends_on? date, appointment_document_version_id? FK document_versions | UQ(org,committee,term_code); ends_on >= starts_on |
| committee_memberships | term_id FK, profile_id FK, position_label text, valid_from, valid_to? | การเป็นสมาชิกไม่ให้อำนาจ approve/review โดยอัตโนมัติ; ต้องมี grant ของกิจกรรมด้วย |

profile เป็นบุคคล global ที่อาจอยู่หลายองค์กร ข้อมูลติดต่อไม่เปิดให้สมาชิกทั้งหมดอ่าน ใช้ projection ชื่อ/รหัสที่จำเป็น ส่วนประวัติรายการเก็บ actor_display_name และ unit_name_at_event แยกเพื่อรักษาข้อมูล ณ วันนั้น

### 5.2 บทบาทและการมอบอำนาจ

| ตาราง | ฟิลด์สำคัญ | Constraints / หลักการ |
|---|---|---|
| permissions | code text PK, description text, category text | catalog global เช่น resolution.read, task.publish, task.submit, task.review, change.decide, resolution.close, report.export, security.manage |
| roles | role_code text, version_no integer, label_th text, category technical/business, published_at? | UQ(role_code,version_no); role ที่ publish แล้ว immutable |
| role_permissions | role_id FK roles, permission_code FK permissions | PK(role_id,permission_code); เปลี่ยน bundle ด้วย role version ใหม่ ไม่เพิ่มอำนาจ grant เก่าเงียบ ๆ |
| access_grants | profile_id FK, role_id FK, scope_kind, committee_id?, unit_id?, resolution_id?, task_id?, valid_from, valid_to?, revoked_at?, granted_by FK, approved_by? FK, reason, authority_document_version_id? FK | scope_kind=organization/committee/unit/resolution/task; CHECK ให้มี target ตรงชนิดเพียงช่องเดียว หรือไม่มี target สำหรับ organization scope |
| record_access_restrictions | resolution_id? FK, task_id? FK, document_id? FK, restriction_kind, minimum_clearance? text, denied_profile_id? FK, effective_from, effective_to?, approved_by FK, reason | target หนึ่งชนิด; เป็นข้อจำกัดเพิ่ม ไม่ใช่ grant ที่ทำให้เข้าถึง parent ที่ไม่มีสิทธิ |
| clearance_grants | profile_id FK, clearance_code text, valid_from, valid_to?, approved_by FK, evidence_version_id? | ใช้เมื่อองค์กรรับรองการแบ่งชั้น; ไม่มีค่า clearance หมายถึงไม่ผ่านชั้นที่ต้องการ ไม่อนุมานจากตำแหน่ง |

บทบาทตั้งต้นที่เสนอ: secretary, task_owner, contributor, unit_head, reviewer, closure_approver, executive, committee_member, technical_admin โดย permissions ในบทบาทยังต้องยืนยัน Q-03/Q-04

grant ของ owner/reviewer ไม่พอถ้าไม่ได้ถูกมอบหมายใน task cycle นั้น และ assignment ไม่พอถ้าบัญชีถูกระงับหรือไม่มีอำนาจใน scope นั้น สำหรับ grant ธุรกิจที่สำคัญต้องมี approved_by ของผู้มีอำนาจมอบหมาย แยกจากผู้ดูแลที่บันทึก grant; ปฏิเสธ self-grant และเก็บหลักฐานอำนาจ/เหตุผล

ผู้ดูแลข้อมูลเริ่มต้นหรือผู้ให้สิทธิคนแรกใช้ขั้นตอน bootstrap ที่องค์กรรับรองและ audit แยก ไม่ทำ “ถ้ายังไม่มี admin ให้สมัครคนแรกเป็นผู้อนุมัติทุกอย่าง”

<a id="resolutions"></a>
## 6. การประชุม มติ และรอบมติ

### 6.1 การประชุมและต้นทาง

| ตาราง | ฟิลด์เฉพาะ | Constraints / ประวัติ |
|---|---|---|
| meetings | term_id FK, numbering_year integer, meeting_no text, title text, scheduled_start_at timestamptz, actual_start_at?, location? text, channel_url? text, status scheduled/completed/cancelled, current_certified_minutes_id? FK | UQ(org,term,numbering_year,meeting_no); หมายเลขเป็น text เผื่อ “พิเศษ”; เลื่อนประชุมไม่เลื่อน deadline งานโดยอัตโนมัติ |
| agenda_items | meeting_id FK, agenda_no text, title text, kind new/followup/information/other, sort_order integer, row_version | UQ(org,meeting,agenda_no); เก็บ 4.1 เป็น text ไม่ใช้ decimal |
| minutes_versions | meeting_id FK, version_no integer, document_version_id? FK, status draft/reviewed/certified, supersedes_version_id?, reviewed_by?, reviewed_at?, certified_by?, certified_at?, effective_at?, change_reason? | UQ(org,meeting,version_no); draft แก้ได้; certified เนื้อหาคงที่; มีฉบับร่างแก้ไขควบคู่ฉบับ certified เดิมได้ |
| minutes_decisions | minutes_version_id FK, decision reviewed/certified/returned, actor_id FK, reason, evidence_version_id?, occurred_at, recorded_at | append-only; ผู้ยืนยันมีอำนาจ; pointer ฉบับมีผลเปลี่ยนพร้อม decision |
| agenda_resolution_links | agenda_item_id FK, resolution_id FK, link_kind origin/followup, note?, presented_snapshot_id? FK report_snapshots | UQ(org,agenda,resolution); partial UQ(org,resolution) WHERE link_kind='origin'; followup ไม่สร้างมติซ้ำ |
| external_references | resolution_id? FK, task_id? FK, meeting_id? FK, source_system text, external_id? text, reference_url? text, label text, last_checked_at? | owner หนึ่งชนิด; URL เป็น reference ไม่ใช่หลักฐาน immutable; ไม่ต้องเชื่อม API ระบบภายนอกใน MVP |

### 6.2 มติถาวรและรุ่นสาระ

| ตาราง | ฟิลด์เฉพาะ | Constraints / ประวัติ |
|---|---|---|
| resolutions | code text, origin_agenda_item_id FK, originating_minutes_version_id? FK, current_version_id? FK, current_cycle_id? FK, classification text, archived_at? | UQ(org,code); ต้นกำเนิดถาวร; เก็บชี้ฉบับรายงานประชุมที่ใช้จริง ไม่เปลี่ยนตามฉบับล่าสุด |
| resolution_versions | resolution_id FK, version_no integer, title text, content text, resolution_type action/approval/acknowledgment/recurring, requires_action boolean, lead_unit_id FK, coordinator_id FK, desired_outcome? text, due_text? text, due_kind none/date/instant, due_on? date, due_at? timestamptz, timezone, confirmed_by?, confirmed_at?, effective_at?, change_reason? | UQ(org,resolution,version_no); ข้อมูลเวลาต้องตรง due_kind; confirmed แล้วแก้ไม่ได้ |
| resolution_criteria | resolution_version_id FK, criterion_key uuid, position integer, description text, is_required boolean DEFAULT true, required_evidence_kind? text | UQ(org,version,criterion_key); criterion_key ใช้เทียบข้าม revision แต่ผลตรวจต้อง FK ไป criterion row รุ่นแน่นอน |
| resolution_cycles | resolution_id FK, cycle_no integer, previous_cycle_id? FK, governing_version_id FK resolution_versions, status draft/acknowledged/open/pending_close/closed/terminated, opened_at?, closed_at?, terminated_at?, termination_kind?, current_authorization_event_id? FK, current_closure_request_id? FK, row_version | UQ(org,resolution,cycle_no); ไม่เกินหนึ่ง active cycle; previous_cycle อยู่ resolution เดียวกันและเป็นรอบก่อน |
| start_authorization_events | resolution_cycle_id FK, sequence_no integer, decision authorize/suspend/withdraw/resume, actor_id FK, reason text, conditions? text, evidence_version_id? FK, effective_at, recorded_at, authority_grant_id FK | UQ(org,cycle,sequence_no); append-only; ตรวจ authority และ policy ณ ตอนตัดสินใจ |
| start_conditions | resolution_cycle_id FK, condition_key uuid, description text, mandatory boolean, satisfied_by?, satisfied_at?, evidence_version_id?, revision_no integer, supersedes_id? FK, effective_at, recorded_at | UQ(org,cycle,condition_key,revision); แต่ละ revision immutable; resolve รุ่นมีผลล่าสุด ไม่ UPDATE ค่าผ่านทับรุ่นเก่า; ต้องผ่านทุก mandatory |
| resolution_relations | from_resolution_id FK, to_resolution_id FK, relation_type supplements/amends/replaces/cancels/related, replacement_scope? full/partial, scope_description text, confirmed_by FK, confirmed_at, decision_request_id? FK | ห้าม self-link; replaces ต้องระบุ full/partial และ dispositions; cancels เชื่อมการตัดสินยุติของมติเก่า; related ไม่เปลี่ยนอำนาจ |
| relation_task_dispositions | relation_id FK, task_cycle_id FK, disposition continue/transfer/terminate, target_resolution_cycle_id? FK, approved_by FK, reason, effective_at | UQ(org,relation,task_cycle); transfer ต้องมี target; terminate ต้องมี lifecycle decision ไม่เปลี่ยนเป็น accepted |

ข้อเสนอการใช้ requires_action:

- acknowledgment + requires_action=false → ไม่มี task cycle ที่เผยแพร่ภายใต้รอบนั้น และไม่เข้าสูตรปิดมติที่ต้องดำเนินการ
- acknowledgment + requires_action=true → มีถ้อยคำรับทราบพร้อมมอบหมาย จึงต้องติดตามงานเช่นมติแบบ action
- recurring ต้อง requires_action=true และไม่มีการปิดแม่อัตโนมัติจากผล child
- ถ้อยคำมติที่ถูกแก้หลังยืนยันสร้าง version ใหม่พร้อมผลกระทบต่อ cycle/task; การทดแทนด้วยมติใหม่ใช้ resolution_relations เพิ่ม ไม่แก้ origin ให้เป็นมติใหม่

<a id="tasks"></a>
## 7. งาน การมอบหมาย และการติดตาม

### 7.1 ตัวงานและรอบดำเนินการ

| ตาราง | ฟิลด์เฉพาะ | Constraints / ประวัติ |
|---|---|---|
| tasks | code text, origin_resolution_id FK, task_kind text, current_cycle_id? FK, archived_at? | UQ(org,code); origin ไม่เปลี่ยนเมื่อโอนอำนาจไปมติอื่น |
| task_cycles | task_id FK, cycle_no integer, previous_cycle_id? FK, status draft/assigned/in_progress/submitted/revision/accepted/cancelled, current_spec_version_id? FK, original_deadline_version_id? FK, original_due_set_at?, current_deadline_version_id? FK, latest_progress numeric(5,2) DEFAULT 0, published_at?, started_at?, accepted_submission_id? FK, accepted_at?, cancelled_at?, cancellation_kind?, row_version | UQ(org,task,cycle_no); CHECK 0≤progress≤100; หนึ่ง active cycle; NULL เวลาไม่ใช้แทนสถานะ |
| task_spec_versions | task_cycle_id FK, version_no integer, title text, description text, deliverable text, priority low/normal/high, lead_unit_id FK, confirmed_by?, confirmed_at?, effective_at?, change_request_id? FK, reason? | รุ่นนี้รวม scope และชุดเกณฑ์ตรวจรับ; submission อ้าง spec รุ่นเดียวกัน; confirmed แล้ว immutable |
| task_criteria | spec_version_id FK, criterion_key uuid, position integer, description text, is_required boolean, evidence_requirement_id? FK | UQ(org,spec,criterion_key); เกณฑ์ตรวจเป็น row ไม่ใช่ string[]; reviewer ตอบแต่ละข้อได้ |
| evidence_requirements | spec_version_id FK, requirement_key uuid, label text, allowed_kind file/link/either, min_count integer DEFAULT 1, mandatory boolean, allowed_mime_types? text[] | CHECK min_count≥0; ต้อง map หลักฐานต่อ requirement ตอนส่งตรวจ; รับ link เฉพาะ policy ที่อนุญาต |
| resolution_cycle_tasks | resolution_cycle_id FK, task_cycle_id FK, relation_kind primary_authority/reference, required_for_closure boolean, valid_from, valid_to?, approved_by FK, reason text | ไม่สร้างสำเนางาน; active primary_authority ของ task_cycle มีหนึ่งรายการ; required link ต้อง primary_authority |
| task_dependencies | task_cycle_id FK ผู้รอ, prerequisite_cycle_id FK, condition accepted, valid_from, valid_to?, approved_by FK, reason | MVP ต้องอยู่ในรอบมติผู้ให้อำนาจเดียวกันและ prerequisite ผ่านตรวจรับ; ห้าม self/cycle; ข้ามมติหรือเงื่อนไข started ต้องยืนยัน Q-10 ก่อนขยาย |
| task_publication_facts | task_cycle_id FK, published_at, spec_version_id FK, owner_assignment_id FK, reviewer_assignment_id FK, authorization_event_id FK, policy_version_id FK, validation_version text, completeness_passed boolean, exceptions? jsonb | UQ(org,task_cycle); snapshot ความครบตอนเผยแพร่สำหรับ KPI-10; ถ้าขาด mandatory facts จากอดีตให้ใช้ legacy_workflow_records ตาม §13 ไม่สร้างแถวนี้เทียม |

การย้าย owner ไม่รีเซ็ต latest_progress, deadline baseline, submission หรือผลตรวจ รอบงานปัจจุบันอาจกลับเป็น assigned เพื่อรอรับทราบของเจ้าของใหม่ แต่ started_at ของรอบเดิมและประวัติเริ่มยังคงอยู่ ต้องแสดงว่า “รับช่วง” ไม่ใช่งานเพิ่งเกิดใหม่

### 7.2 เจ้าของ ผู้ร่วม และผู้ตรวจ

| ตาราง | ฟิลด์เฉพาะ | Constraints / ประวัติ |
|---|---|---|
| owner_assignments | task_cycle_id FK, owner_id FK profiles, assigned_by FK, assigned_at timestamptz, acknowledged_at?, valid_from, valid_to?, superseded_by_id? FK ตัวเอง, change_request_id?, acknowledgment_due_at?, calendar_version_id?, policy_version_id?, reason | exclusion กันช่วง owner ซ้อน; active owner ต้องคนเดียว; acknowledged_at ครั้งแรกคงเดิมเมื่อ retry |
| reviewer_assignments | task_cycle_id FK, reviewer_id FK profiles, assigned_by FK, valid_from, valid_to?, change_request_id?, reason | หนึ่งผู้ตรวจหลักที่มีผลใน MVP; เปลี่ยน reviewer ไม่ลบ acknowledgment ของ owner |
| task_contributors | task_cycle_id FK, profile_id FK, contribution_kind output/administrative_support, valid_from, valid_to?, assigned_by FK, reason | คนที่เป็น output แม้หมดช่วงแล้วอยู่ในฐานห้ามตรวจผลงานตนเอง |
| cycle_participation_events | task_cycle_id FK, profile_id FK, participation_kind owner/output_contributor/admin_support, source_assignment_id?, source_contributor_id?, occurred_at, recorded_at | append-only; ใครเคยรับผิดชอบผลงานใน cycle นั้นไม่หายจากข้อห้ามหลังโอนงาน |
| submission_participants | submission_id FK, profile_id FK, participation_kind text, source_participation_event_id FK | snapshot ผู้ทำ ณ ส่งงาน; ใช้ร่วมกับประวัติทั้ง cycle ไม่ใช้ snapshot อย่างเดียวเพื่อหลบผู้ร่วมที่เคยทำก่อนหน้า |

งานที่ผู้ใช้หมดสิทธิ/ถูกปิดบัญชียังมี owner assignment ทางประวัติ แต่ไม่ถือว่ามี “เจ้าของที่ปฏิบัติงานได้” ให้คิว orphaned_assignments แสดงรายการที่บัญชี/grant ไม่ active; ไม่ตั้ง owner_id เป็น NULL เพื่อล้างร่องรอย และไม่รอโอนงานก่อนเพิกถอนสิทธิ

### 7.3 ความก้าวหน้า รายงานตามรอบ และอุปสรรค

| ตาราง | ฟิลด์เฉพาะ | Constraints / ประวัติ |
|---|---|---|
| progress_reports | task_cycle_id FK, author_id FK, current_version_id? FK, status draft/published, first_published_at? | ร่างไม่เข้า KPI รายงาน; เผยแพร่แล้วไม่ hard delete |
| progress_report_versions | report_id FK, version_no integer, progress_percent numeric(5,2), work_done text, next_steps? text, help_needed? text, published_at?, supersedes_version_id?, correction_reason? | UQ(org,report,version); CHECK 0–100; revision ไม่เปลี่ยน first_published_at |
| reporting_plans | task_cycle_id FK, plan_key text, current_version_id? FK, status draft/active/ended | UQ(org,cycle,plan_key); stable plan ID ไม่เปลี่ยนตามรุ่น; MVP หนึ่ง active plan ต่อ task cycle |
| reporting_plan_versions | plan_id FK, version_no integer, cadence text, starts_on date, ends_on?, required_fields jsonb, policy_version_id FK, effective_at, confirmed_by FK, reason | UQ(org,plan,version); schema_version ของ required_fields; confirmed แล้ว immutable |
| reporting_occurrences | plan_id FK, plan_version_id FK, occurrence_key text, period_start timestamptz, period_end timestamptz, due_kind date/instant, due_on?, due_at?, timezone, status planned/exempted/cancelled, exception_reason?, approved_by? | UQ(org,stable plan,occurrence_key) ข้ามทุก version; period_end>start; เปลี่ยนแผนไม่เพิ่มรอบเดิมซ้ำ/ลบรอบเก่า; ยกเว้นหรือแทนรอบอนาคตต้องมีการอนุมัติและประวัติ |
| reporting_responses | reporting_occurrence_id FK, report_version_id FK, validated_at timestamptz, is_complete boolean, validation_version text, validation_errors? jsonb | UQ(org,occurrence,report_version); first_complete_report_at = MIN(validated_at ของ complete) ไม่ใช่เวลา draft หรือเวลาที่แก้ล่าสุด |
| blockers | task_cycle_id FK, title text, category text, impact text, decision_needed text, helper_unknown_reason? text, severity low/normal/high, opened_by FK, opened_at, resolved_at?, review_due_at, current_status open/resolved | ต้องมี helper/decision owner ใน blocker_participants หรือเหตุผลยังไม่ทราบผู้ช่วยพร้อมวันทบทวน; หลายอุปสรรคต่อ cycle; resolved ไม่แปลว่า accepted |
| blocker_participants | blocker_id FK, profile_id FK, responsibility helper/decision_owner, valid_from, valid_to? | ไม่ได้ grant สิทธิอ่านไฟล์อื่นเพิ่มโดยอัตโนมัติ |
| blocker_updates | blocker_id FK, author_id FK, note text, action update/resolve/reopen, next_review_at?, evidence_version_id?, occurred_at, recorded_at | append-only; current_status เป็น projection จากกิจกรรมที่มีผล |

รอบรายงานไม่มีแผนให้แสดง planning gap ไม่คำนวณ missed report ด้วยการเดาว่างานควรรายงานทุกสัปดาห์

<a id="evidence"></a>
## 8. เอกสาร หลักฐาน ส่งตรวจ และตรวจรับ

### 8.1 เอกสารและการอัปโหลด

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| documents | title text, classification_code text, owning_unit_id FK, created_by FK, current_version_id? FK, retention_policy_version_id? FK, archived_at? | logical document; เปลี่ยน current_version ไม่เปลี่ยนหลักฐานใน submission เดิม |
| document_versions | document_id FK, version_no integer, kind file/link, original_filename?, bucket_id?, object_key?, mime_type?, byte_size? bigint, sha256?, source_url?, captured_at?, uploaded_by FK, finalized_at?, scan_status pending/clean/rejected, availability available/quarantined/purged, supersedes_version_id? FK | UQ(org,document,version), UQ(bucket,object_key); file ต้องมี object metadata, link ต้องมี URL; checksum คำนวณฝั่งที่เชื่อถือได้; finalized แล้วเนื้อหาเปลี่ยนไม่ได้ |
| upload_intents (private) | requested_by FK, document_id FK, reserved_version_no, target_task_cycle_id? FK, bucket_id, object_key, declared_mime, max_bytes, expires_at, status pending/uploaded/finalized/expired/rejected, authorization_epoch bigint | จอง path สุ่มเฉพาะ attempt; object เขียนครั้งเดียวตั้งแต่ upload แรก ห้าม client UPDATE/DELETE/upsert ก่อนหรือหลัง scan/finalize; retry ใช้ key ใหม่; orphan เก็บกวาดตาม policy |
| document_scan_events (private) | document_version_id FK, scanner_version text, result clean/rejected/error, details? jsonb, scanned_at | append-only; scan error ยังไม่ถือว่าปลอดภัยสำหรับส่งตรวจ |
| document_context_links | document_id FK, resolution_id? FK, task_cycle_id? FK, meeting_id? FK, purpose reference/evidence/authority/minutes, linked_by FK, linked_at, detached_at? | CHECK มี parent หนึ่งชนิด; FK จริงทุกช่อง; การ link ไม่สร้างสิทธิอ่านเพิ่มนอก classification และข้อจำกัดของเอกสาร |
| task_evidence_links | task_cycle_id FK, document_version_id FK, title, description?, added_by FK, added_at, withdrawn_at?, withdrawal_reason? | ชุดหลักฐานทำงาน; ถอนจากชุดปัจจุบันได้ตามสิทธิ แต่ห้ามทำให้ submission เก่าหาย |

ไฟล์หลักฐาน รายงานประชุม หนังสือมอบอำนาจ และไฟล์นำเข้าใช้ document_versions เดียวกัน การอ้างหลักฐานในกิจกรรมใด ๆ ต้องใช้ version_id ไม่ใช้ชื่อไฟล์หรือ current_version_id เป็นตัวรับรอง อนุญาตชื่อซ้ำได้ แต่ object_key ใช้ UUID โดยไม่ฝังชื่อบุคคล/หัวข้อมติ

ลิงก์ภายนอกเก็บ URL, ชื่อ, เวลาตรวจหรือ capture และผู้เพิ่ม แต่ URL ไม่รับประกันว่าเนื้อหาจะคงเดิม หากเกณฑ์ต้องตรวจสอบย้อนหลัง ให้เก็บสำเนาไฟล์ที่ได้รับอนุญาตพร้อม checksum หรือบันทึกชัดว่าเป็นหลักฐานภายนอกที่อาจเปลี่ยนแปลง ไม่อ้างว่า checksum ของ URL รับรองเนื้อหาปลายทาง

### 8.2 รอบส่งและผลตรวจ

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| submissions | task_cycle_id FK, attempt_no integer, spec_version_id FK, owner_assignment_id FK, reviewer_assignment_id FK, submitted_by FK, submitted_at, statement text, status pending/accepted/returned/withdrawn, decided_at?, withdrawn_at?, withdrawal_decision_id? FK, policy_version_id FK | UQ(org,cycle,attempt); pending ได้หนึ่งแถวต่อ cycle; spec/assignments ต้องอยู่ใน cycle เดียวกัน; ชุดส่งล็อกหลัง submit |
| submission_evidence | submission_id FK, document_version_id FK, source_evidence_link_id? FK, submitted_title text, submitted_description? text | UQ(org,submission,document_version); snapshot ชื่อและคำอธิบายที่ใช้ส่ง; ไม่ชี้ “ล่าสุด” |
| submission_requirement_evidence | submission_id FK, evidence_requirement_id FK, submission_evidence_id FK | UQ ของสามค่า; requirement ต้องอยู่ใน spec_version ของ submission และ evidence ต้องอยู่ใน submission นั้น |
| submission_events | submission_id FK, event submitted/withdrawn, actor_id FK, reason?, source_decision_id?, occurred_at, recorded_at | บันทึกการเปลี่ยนวงจร; withdrawn ใช้การตัดสินใจที่มีอำนาจ ไม่ใช่ลบ submission |
| reviews | submission_id FK, reviewer_id FK, reviewer_assignment_id FK, decision accepted/returned, reviewed_at, summary text, authority_grant_id FK, policy_version_id FK | UQ(org,submission); assignment นี้มีผลจริงตอนตรวจ อาจต่างจาก frozen assignment ตอนส่งเมื่อมีการเปลี่ยนผู้ตรวจที่อนุมัติ; immutable; reviewer ต้องไม่อยู่ในประวัติ owner/output contributor |
| review_criterion_results | review_id FK, task_criterion_id FK, result passed/failed/not_applicable, finding text, evidence_version_id? FK | UQ(org,review,criterion); ต้องตอบทุกเกณฑ์ใน spec ของ submission; required criterion ใช้ not_applicable ไม่ได้ เว้นแต่เกณฑ์ถูกแก้ผ่านรุ่นที่อนุมัติก่อนส่ง |

การ submit ทำในธุรกรรมเดียว: ตรวจสิทธิและสถานะ → ตรวจการอนุญาตเริ่ม/dependency → ตรวจเกณฑ์และหลักฐานที่ finalize/scan ผ่าน → กำหนด attempt_no → ตรึง spec, participants, assignments และ evidence → เปลี่ยนสถานะเป็น submitted → เพิ่ม audit/outbox โดยใช้เวลาฐานข้อมูล

การ review ล็อก task_cycle และ submission ก่อนตัดสิน ตรวจทั้ง submission_participants ที่ตรึงตอนส่งและ cycle_participation_events ทั้งรอบจนถึงขณะตัดสิน เพื่อป้องกันการย้ายเจ้าของแล้วกลับมาตรวจเอง งานด้านธุรการที่ไม่ร่วมสร้างผลงานไม่ถูกนับเป็น output contribution แต่ต้องมีเหตุผลและชนิดการมีส่วนร่วมชัดเจน

เมื่อ accepted ทุก required criterion ต้องผ่าน ตั้ง accepted_submission_id และ accepted_at จาก review ที่เพิ่งบันทึก เมื่อ returned ต้องมี finding ที่ผู้รับผิดชอบนำไปแก้ได้ และสถานะ task_cycle เป็น revision การส่งแก้สร้าง attempt ใหม่ ไม่แก้ชุดส่งหรือผลตรวจเดิม เจ้าของไม่มีปุ่มถอน pending submission เองใน MVP ตามข้อเสนอ PRD; การยุติที่อนุมัติสามารถถอน pending submission ใน transaction เดียวกันได้

<a id="decisions"></a>
## 9. คำขอเปลี่ยนแปลงและการปิดมติ

### 9.1 คำขอและการตัดสิน

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| change_requests | task_cycle_id? FK, resolution_cycle_id? FK, request_type deadline/owner/reviewer/scope/closure_scope/termination/reopen/dependency, requested_by FK, requested_at?, reason text, expected_row_version bigint, status draft/pending/approved/rejected/withdrawn/stale, decided_at?, authority_evidence_version_id? FK | มี target หนึ่งชนิด; draft ยังแก้ได้ requested_at=NULL จนยื่น; pending ไม่มีผลต่อค่าจริง; ค่าที่เสนอแก้ไม่ได้หลังยื่น ให้ถอนแล้วสร้างใหม่ |
| deadline_change_proposals | request_id PK/FK, previous_deadline_version_id? FK, proposed_due_kind none/date/instant, proposed_due_on?, proposed_due_at?, timezone, no_due_reason?, next_report_on?, proposed_effective_at | แบบ typed; d0 ไม่อยู่ในช่องแก้ไข; ห้ามขอมีผลย้อนหลังผ่านช่องอนุมัติปกติ |
| assignment_change_proposals | request_id PK/FK, assignment_kind owner/reviewer, previous_owner_assignment_id? FK, previous_reviewer_assignment_id? FK, proposed_profile_id FK, proposed_effective_at, handover_note text | CHECK มี previous FK หนึ่งชนิดตรง assignment_kind; เปลี่ยน reviewer ไม่เปลี่ยน assignment ที่ frozen ใน submission |
| scope_change_proposals | request_id PK/FK, previous_spec_version_id FK, proposed_spec_version_id FK, impact_note text, pending_submission_policy keep_original/return_for_new_version, affected_submission_id? FK | proposed version เป็น draft; approval ทำให้ immutable; ระบุผลต่อ pending attempt ชัดเจน |
| closure_scope_change_proposals | request_id PK/FK, cycle_task_link_id FK, expected_link_row_version bigint, previous_required boolean, proposed_required boolean, previous_primary_resolution_cycle_id FK, proposed_primary_resolution_cycle_id FK, impact_note text | รองรับเปลี่ยน required flag/ย้ายอำนาจ; approval ตรวจทั้งต้นทางและปลายทาง ล็อกทั้งสองรอบมติ และเขียน link history; ห้ามใช้แก้ checklist ของรอบที่ปิดแล้ว |
| lifecycle_change_proposals | request_id PK/FK, action terminate/reopen, termination_kind? cancelled/superseded/no_longer_needed/other, replacement_resolution_id? FK, new_governing_version_id? FK, rationale text | เปิดใหม่ต้องอ้างรอบก่อนและกำหนดเกณฑ์/เจ้าของ/กำหนดของรอบใหม่อย่างชัดเจน; ไม่มีการ reset แถวเดิม |
| dependency_change_proposals | request_id PK/FK, prerequisite_task_cycle_id FK, action add/remove, condition accepted, impact_note text | MVP ภายในรอบมติเดียวกัน; ตรวจวงจร dependency และอำนาจ |
| change_decisions | request_id FK, decision approved/rejected/withdrawn/stale, actor_id FK, authority_grant_id? FK, decided_at, effective_at?, reason text, applied_row_version? bigint | UQ(org,request) สำหรับ terminal decision; ผู้ถอนเป็นผู้ร้อง/ผู้มีอำนาจตาม policy; approval กับการ apply ต้องเป็นธุรกรรมเดียวกัน |

ใช้ subtype หนึ่งตารางตรง request_type เท่านั้น และตรวจ target ที่รองรับ เช่น scope ของ task ใช้ task_spec_versions ส่วนแก้ถ้อยคำมติใช้ resolution_versions ผ่าน RPC แยกที่มีผลตรวจรับรองและ audit ไม่แอบใช้ task scope proposal แทน

การเปลี่ยนเกณฑ์ขณะรอตรวจต้องเลือก keep_original ให้ pending submission ตรวจตาม spec เดิมจนจบ หรือ return_for_new_version ให้มีคำตัดสินคืนแก้โดยผู้มีสิทธิ review ก่อนส่งตามเกณฑ์ใหม่ ไม่แก้ spec pointer ของ submission เดิม ผู้อนุมัติ scope ที่ไม่มี review permission ไม่สร้าง review แทนผู้ตรวจ หาก keep_original ผ่าน ให้ผลรับรองผูก spec เดิมอย่างเปิดเผย; ข้อกำหนดใหม่ที่ยังต้องทำต้องแยกงาน/รอบใหม่ ไม่อ้างว่าผลเดิมผ่านเกณฑ์ใหม่แล้ว

expected_row_version ป้องกันอนุมัติคำขอจากฐานข้อมูลเก่า หากคำขอ A และ B ต่างอ้างกำหนดรุ่นเดียวกัน เมื่อ A ผ่านแล้ว B ต้อง stale หรือสร้างคำขอใหม่ ไม่อนุมัติทับโดยอัตโนมัติ ฝั่ง UI แสดงค่าก่อนขอ ค่าปัจจุบัน และค่าที่เสนอให้ผู้อนุมัติเห็นความต่าง

### 9.2 ปิดมติอย่างมีหลักฐาน

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| closure_requests | resolution_cycle_id FK, governing_resolution_version_id FK, requested_by FK, requested_at, expected_row_version bigint, summary text, status pending/approved/returned/withdrawn/stale, decided_at? | หนึ่ง pending ต่อรอบมติ; ยื่นแล้วตรึงชุดอ้างอิง |
| closure_task_snapshots | closure_request_id FK, resolution_cycle_task_link_id FK, task_cycle_id FK, required_for_closure boolean, observed_status, accepted_submission_id? FK, accepted_review_id? FK, disposition_id? FK | UQ(org,request,task_cycle); ครบทุก primary task ที่มีผลขณะยื่น; decision ตรวจรายการจริงอีกครั้ง ไม่เชื่อ snapshot อย่างเดียว |
| closure_criterion_results | closure_request_id FK, resolution_criterion_id FK, result passed/failed, finding text | UQ(org,request,criterion); ต้องครบเกณฑ์ของ governing version |
| closure_evidence | closure_request_id FK, document_version_id FK, criterion_result_id? FK, note? | หลักฐานระดับมติ; เวอร์ชันไฟล์คงที่ |
| closure_task_dispositions | closure_request_id FK, task_cycle_id FK, disposition continue/transfer/terminate, target_resolution_cycle_id? FK, approved_by FK, authority_grant_id FK, reason, effective_at | งาน optional ที่ยังไม่จบต้องมี disposition; transfer ต้องมีปลายทางที่รับผิดชอบและตรวจสิทธิ; terminate ต้องใช้คำตัดสินยุติงานด้วย |
| closure_decisions | closure_request_id FK, decision approved/returned/withdrawn/stale, actor_id FK, authority_grant_id FK, reason, decided_at | UQ(org,request); immutable; approved เปลี่ยน resolution_cycle เป็น closed ใน transaction เดียวกัน |

ก่อนปิดต้องตรวจ start authorization, เกณฑ์ระดับมติ, ชุด primary-required task cycles, ผลตรวจรับ และ disposition ของ optional ที่ไม่จบใหม่ภายใต้ lock ชุดงานที่เปลี่ยนหลังยื่นทำให้คำขอคืนแก้หรือ stale ห้ามผ่านเพียงเพราะ snapshot เดิมดูครบ

required task ที่ cancelled ไม่ถือว่าผ่าน การถอด required/เปลี่ยน scope ต้องมีการอนุมัติและเหตุผลก่อนยื่นปิดใหม่ มติ recurring ไม่ปิดจากการผ่านเพียงรอบเดียว หากต้องเลิกแผน ให้ยุติแผนและจัดการ occurrence ที่ค้างก่อนตัดสิน lifecycle ของมติ

optional task ที่ disposition=continue ใช้ closure_task_dispositions ที่อนุมัติเป็นอำนาจทำต่อเฉพาะ cycle เดิมหลัง parent ปิด โดยยังตรวจ explicit suspension/revocation และสิทธิผู้ใช้ทุกครั้ง สามารถรายงาน/ส่ง/ตรวจต่อได้แต่ไม่เปลี่ยน checklist หรือผลปิดที่ตรึงแล้ว หากไม่มีอำนาจทำต่อ ให้ transfer ไป active authorized resolution cycle ก่อนปิด งาน required ที่เปิดใหม่ต้องผูกกับรอบมติใหม่/รอบที่ยังเปิดและได้รับอำนาจ ห้ามกลับเข้า closed cycle เดิม

### 9.3 สถานะที่อนุญาต

| Aggregate | Transition ปกติ | เงื่อนไขสำคัญ |
|---|---|---|
| task_cycle | draft → assigned → in_progress → submitted → accepted | publish ครบข้อมูล; owner acknowledge แยกเหตุการณ์; start ได้เมื่อ authorization/conditions/dependencies ผ่าน |
| task_cycle | submitted → revision → submitted | returned review ก่อนแก้และส่ง attempt ใหม่ |
| task_cycle | assigned/in_progress/revision/submitted → cancelled | คำขอยุติได้รับอนุมัติ; ถอน pending submission ถ้ามี; ไม่สร้าง accepted fact |
| task_cycle | accepted/cancelled → รอบใหม่สถานะ draft | แถวเดิมคงสถานะเดิม; previous_cycle_id เชื่อม; ไม่ใช่ UPDATE ย้อนกลับ |
| resolution_cycle | draft → acknowledged | มติรับทราบที่ไม่มีงาน; ไม่นับเป็นงานสำเร็จ |
| resolution_cycle | draft → open → pending_close → closed | เปิดด้วยข้อมูลและอำนาจครบ; ปิดด้วย closure decision |
| resolution_cycle | pending_close → open | คืนแก้/ถอนคำขอ; คงหลักฐานคำขอเดิม |
| resolution_cycle | open/pending_close → terminated | จัดการงานที่ผูกอยู่ครบ; ไม่ใช่ closed |
| resolution_cycle | closed/terminated → รอบใหม่สถานะ draft | สร้าง cycle ใหม่และผูก task cycles ชุดใหม่อย่างชัดเจน |

assigned กับ acknowledged เป็นคนละเรื่อง: การรับทราบกรอก acknowledged_at ของ assignment ไม่จำเป็นต้องทำให้งานเริ่มจริง ส่วน overdue, blocked, pending authorization และ no deadline เป็น dimensions ที่คำนวณเพิ่ม ไม่เพิ่มสถานะผสม เช่น in_progress_overdue_blocked

<a id="time"></a>
## 10. กำหนดเวลา งานต่อเนื่อง และปฏิทิน

### 10.1 กำหนดเวลาที่มีรุ่น

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| task_deadline_versions | task_cycle_id FK, version_no integer, due_kind none/date/instant, due_on? date, due_at? timestamptz, timezone text, basis explicit/meeting_relative, reference_meeting_id? FK, basis_text? text, interpretation_note? text, no_due_reason? text, next_report_on? date, approved_by FK, authority_grant_id FK, approved_at, effective_at, recorded_at, change_request_id? FK, supersedes_version_id? FK, reason | UQ(org,cycle,version); meeting_relative ต้องมี meeting FK/ข้อความต้นฉบับ/วันที่ตีความที่อนุมัติ; เปลี่ยนวันประชุมไม่ขยับ deadline เงียบ; none ต้องมีเหตุผล/วันรายงานถัดไป |
| business_calendars | code text, name_th text, timezone text, current_version_id? FK | UQ(org,code); current pointer มีไว้เลือกสำหรับเหตุการณ์ใหม่ |
| business_calendar_versions | calendar_id FK, version_no integer, weekly_workdays smallint[], working_intervals jsonb, effective_from date, published_at, published_by FK, change_reason | UQ(org,calendar,version); published แล้ว immutable; เวลาทำการใช้ schema ที่ตรวจได้ |
| business_calendar_days | calendar_version_id FK, local_date date, is_working_day boolean, label?, working_intervals? jsonb | UQ(org,version,date); override วันหยุด/วันทำงานพิเศษ; ไม่มีแถวใช้ weekly defaults |

คำว่า original deadline (d0) หมายถึงกำหนดแบบ date/instant ที่ได้รับอนุมัติครั้งแรกของ task_cycle ไม่ใช่รุ่น none ก่อนหน้านั้น เมื่ออนุมัติครั้งแรก ให้ตั้ง original_deadline_version_id และ original_due_set_at ใน transaction เดียวและห้ามเปลี่ยนอีก กำหนดปัจจุบัน (dT) คือรุ่นที่อนุมัติ มีผลแล้ว และทราบ ณ cutoff ไม่ใช่รายการที่มี approved_at ล่าสุดโดยไม่ดู effective_at

ถ้าอนุมัติวันนี้แต่ให้มีผลสัปดาห์หน้า รุ่นนั้นเก็บไว้ได้แต่ยังไม่ใช่ current ของวันนี้ current_deadline_version_id เป็น cache/projection; read resolver ต้องพิจารณาเวลามีผล แม้งาน scheduler ยังไม่ทันปรับ cache การขอยกเลิกกำหนดเดิมเป็น none ต้องมีอำนาจ เหตุผล วันรายงานถัดไป และยังเก็บ d0 ไว้เพื่อ KPI เดิม

| รูปแบบ | ค่าในฐานข้อมูล | On time | Overdue / ถึงกำหนดเพื่อ cohort |
|---|---|---|---|
| วันที่อย่างเดียว | due_on=2026-10-31, timezone=Asia/Bangkok | เหตุการณ์ก่อน 2026-11-01 00:00:00 +07 | T ตั้งแต่เที่ยงคืนดังกล่าว; cohort ใช้วันที่ 31 ต.ค. ไม่ใช่เดือน พ.ย. |
| เวลาแน่นอน | due_at เป็น timestamptz | เหตุการณ์ ≤ due_at | overdue เมื่อ T > due_at; due_reached เมื่อ T ≥ due_at |
| ไม่มีวันกำหนด | due_kind=none; due_on/due_at=NULL | ไม่มีผล on-time ที่ตีความได้ | แยกจำนวน no deadline ไม่เอา NULL ไปเทียบเป็นผ่าน |

timestamp เก็บเป็น timestamptz และแสดง Asia/Bangkok ค่า timestamptz ไม่เก็บชื่อเขตเวลาต้นฉบับ จึงเก็บ timezone แยกสำหรับ semantics ของวันกำหนดและแผนรอบ ใช้ปี ค.ศ. ในฐานข้อมูล แปลง พ.ศ. เฉพาะแสดงผลและรหัสตามนโยบาย [PostgreSQL: date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html)

การคำนวณ SLA ต้องบันทึก calendar_version_id, policy_version_id, จุดเริ่ม และ boundary ที่คำนวณแล้ว เช่น ack_due_at ไม่คำนวณ SLA เก่าด้วยปฏิทินฉบับปัจจุบัน คำว่า “2 วันทำการ” ต้องนิยามเวลาเริ่ม การปัดวัน และวันหยุดใน policy ก่อนเปิดใช้จริง

### 10.2 งานต่อเนื่อง

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| recurrence_plans | resolution_cycle_id FK, code, title, current_version_id? FK, status draft/active/paused/ended, ended_at?, end_decision_id? FK | หนึ่งมติมีหลายแผนได้; เปลี่ยนแผนไม่เปลี่ยน occurrence ที่เกิดแล้ว |
| recurrence_plan_versions | plan_id FK, version_no integer, frequency weekly/monthly/quarterly/yearly/custom, interval_count integer, timezone, starts_on date, ends_on?, rule jsonb, calendar_version_id? FK, policy_version_id FK, effective_at, approved_by FK, change_reason | UQ(org,plan,version); rule มี schema_version; ตรวจวันที่ไม่มีในเดือน/เลื่อนวันหยุดก่อน publish |
| recurrence_task_templates | plan_version_id FK, task_slot_key text, title text, template_spec_version_id FK, default_owner_id FK, default_reviewer_id FK, required_for_closure boolean, due_rule jsonb | UQ(org,plan_version,task_slot_key); slot key เป็นชนิดงานถาวรในแผน ข้าม version ใช้ key เดิมเมื่อเป็นงานชนิดเดิม |
| recurrence_occurrences | plan_id FK, plan_version_id FK, occurrence_key text, period_start date, period_end date, planned_due_kind date/instant, planned_due_on?, planned_due_at?, status planned/generated/skipped/cancelled, exception_reason?, exception_approved_by?, generated_at? | UQ(org,plan,occurrence_key) ข้าม version ป้องกันสร้างเดือนเดิมซ้ำหลังแก้แผน; period_end แบบ exclusive |
| recurrence_occurrence_tasks | occurrence_id FK, task_slot_key text, template_id FK, task_id FK, first_task_cycle_id FK, effective_at, recorded_at | UQ(org,occurrence,task_slot_key) และ UQ(org,task); immutable link พร้อมเวลามีผล/เวลาที่ทราบ; slot ต้องอยู่ใน plan version ของ occurrence; หนึ่ง occurrence มีหลายชนิดงานได้ |

template_spec_version_id อ้าง task_spec_versions ของ template task ที่แยกด้วย tasks.task_kind=template และห้าม publish เป็นงานนับ KPI; task_kind=operational ใช้กับงานจริง รายงาน planning gap เทียบทุก task_slot_key ที่คาดหมายใน plan version กับ recurrence_occurrence_tasks ไม่ใช่เช็กเพียงว่ารอบนั้นมีงานอย่างน้อยหนึ่งงาน

MVP ให้ผู้มีสิทธิวาง occurrence ล่วงหน้าและสั่งสร้างงานแต่ละ slot ผ่าน idempotent RPC ที่ล็อก occurrence ส่วน scheduler อัตโนมัติเป็น P1 ใช้ command เดียวกัน ไม่เดาจำนวนรอบที่ควรเกิดจากจำนวนงานที่มีอยู่ skipped/cancelled ต้องมีเหตุผลและอำนาจ และไม่ถือว่าทำสำเร็จ เมื่อสร้างงานต้องตรวจ owner/reviewer ที่ใช้ได้ ถ้าไม่มีให้คง planning gap พร้อมข้อผิดพลาด ไม่เลือกคนใหม่เอง generated หมายถึงสร้างครบทุก slot ของแผนรุ่นนั้น; การสร้างบาง slot ยังแสดงจำนวนที่ขาด

วันครบกำหนดของ occurrence ที่สร้างแล้วถูกบันทึกเป็น task_deadline_version ของงานนั้น การเปลี่ยน plan version มีผลต่อช่วงอนาคตที่ระบุ ห้ามขยับ deadline ของงานที่เผยแพร่แล้วโดยไม่ผ่าน change request

<a id="operations"></a>
## 11. แจ้งเตือน งานเบื้องหลัง และการตั้งค่า

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| policy_versions | policy_key text, version_no integer, scope_committee_id? FK, configuration jsonb, schema_version integer, status draft/published/retired, effective_at, published_by? FK, published_at?, reason | UQ(org,key,scope,version); published config immutable; ใช้ JSON เฉพาะค่าตั้ง ไม่ใช้แทน entities |
| notification_rule_versions | rule_key, version_no, trigger_code, channel in_app/email, recipient_strategy, reminder_offsets jsonb, escalation_steps jsonb, quiet_hours? jsonb, policy_version_id FK, effective_at, published_at, approved_by FK | versioned; ช่องทางนอก in-app เปิดเมื่อ Q-05 ยืนยันและมี integration จริง |
| notification_preferences | profile_id FK, channel, preference_key, enabled boolean, quiet_hours? jsonb | UQ(org,profile,channel,key); ผู้ใช้ปิดข้อความบังคับไม่ได้หาก policy กำหนด; ไม่มีข้อมูล auth secret |
| outbox_events (private) | event_key text, aggregate_type, aggregate_id uuid, event_type, payload jsonb, payload_schema_version, recorded_at, processed_at? | UQ(org,event_key); เขียนพร้อม business transaction; payload ใช้ IDs และข้อมูลจำเป็น ไม่แนบไฟล์หรือความลับ |
| notifications | recipient_id FK, outbox_event_id FK, rule_version_id FK, reminder_round_key text, subject text, safe_preview text, entity_type, entity_id uuid, created_at, read_at?, dismissed_at? | UQ(org,event,recipient,rule,round); round ระบุ deadline/assignment version+threshold+ช่วงเตือน แยกรอบที่ควรส่งจาก retry; ผู้รับอ่านของตนและยังมีสิทธิต่อ entity; preview ไม่เผยข้อมูลลับ |
| notification_deliveries (private) | notification_id FK, channel, destination_reference, status queued/sending/sent/failed/suppressed, provider_message_id?, next_attempt_at?, sent_at? | UQ(org,notification,channel); sent ไม่เท่ากับ read และไม่เท่ากับ acknowledged |
| notification_delivery_attempts (private) | delivery_id FK, attempt_no, attempted_at, outcome, provider_code?, error_summary?, retry_after? | UQ(org,delivery,attempt); จำกัดรายละเอียด error ไม่เก็บ token; retry แบบ backoff มีเพดาน |
| background_jobs (private) | job_type, idempotency_key, requested_by? FK, target_type?, target_id?, input jsonb, status queued/running/succeeded/failed/cancelled, available_at, lease_until?, attempts, finished_at?, error_code? | UQ(org,type,idempotency_key); worker lease หมดอายุจึง reclaim; permission-sensitive job ตรวจสิทธิใหม่ตอนทำ |
| request_deduplications (private) | actor_id FK, operation, idempotency_key, request_hash, response_reference jsonb, created_at, expires_at | UQ(org,actor,operation,key); key เดิม payload ต่างต้อง reject; ไม่บันทึก response ข้ามสิทธิ |
| authorization_guards (private) | organization_id PK/FK, epoch bigint, updated_at | แถว lock กลางสำหรับเปลี่ยนสิทธิ/ธุรกรรมที่ต้องตรวจสิทธิ ดู §15–16 |
| identity_authorization_guard (private, global) | singleton_id smallint PK CHECK=1, epoch bigint, updated_at | shared guard ก่อน org guard ใน user mutation; exclusive สำหรับ disable profile/auth unlink ที่กระทบหลายองค์กรและการเปลี่ยน identity bindings |
| audit_events (private) | actor_id?, actor_kind user/system/import, operation, outcome succeeded/denied/failed, error_code?, entity_type, entity_id?, request_id?, before_state? jsonb, after_state? jsonb, reason?, authority_grant_id?, occurred_at, recorded_at, trace_id, source_job_id? FK | append-only; redact secrets/token; ไม่ใช้ audit JSON เป็นแหล่งเดียวของ KPI |

entity_type/entity_id แบบ generic อนุญาตเฉพาะ routing, jobs และ audit ซึ่งไม่ได้เป็น FK หลักของความถูกต้องทางธุรกิจ โดยมีชนิดที่อนุญาตและ resolver ฝั่ง server ตรวจเสมอ การตัดสินใจและ evidence ใช้ typed FK ตามตารางด้านบน

ค่าเริ่มต้นที่ควรเตรียม policy แต่ยังไม่ยืนยัน: acknowledgment/review SLA, ช่วง due soon, reminder/escalation, อายุ upload intent, ขนาดและชนิดไฟล์, export limit, retention และ pagination ตั้ง schema validator ให้ค่าผิดชนิดหรือ policy ที่ยังไม่ publish ใช้ไม่ได้ ไม่เปิดให้ admin เปลี่ยน config แล้วแก้ snapshot เก่า

Outbox ให้ความทนทานแบบส่งซ้ำได้และ deduplicate ตาม key ไม่รับรอง exactly-once ที่ผู้ให้บริการภายนอก การ retry ต้องไม่ส่งหาเจ้าของเดิมหลังโอนงานหรือผู้ถูกถอนสิทธิ และไม่เปลี่ยน read_at/acknowledged_at ให้เอง งานแจ้งเตือน SLA ใช้ clock ปัจจุบันจาก server แทนวันจำลองคงที่ใน frontend

audit ของธุรกรรมสำเร็จเขียนร่วม transaction; การ denied/failed ที่ rollback ทั้ง transaction ต้องบันทึกผ่าน trusted server/security log sink ใน transaction แยกหลัง rollback มิฉะนั้นแถว audit จะหายไปด้วย ไม่เปิด public RPC ให้ client อ้างตัวตนหรือแต่งผลปฏิเสธเอง เหตุการณ์ unauthenticated ที่ยังระบุองค์กรไม่ได้เก็บใน security log ระดับระบบตาม retention ไม่ฝืนสร้าง organization_id ปลอม

<a id="reporting"></a>
## 12. ประวัติย้อนหลัง รายงาน และ KPI

### 12.1 เวลาธุรกิจกับเวลาที่ระบบทราบ

ต้องตอบได้ทั้ง “ข้อมูลล่าสุดคืออะไร” และ “เมื่อสิ้นเดือนนั้น ระบบทราบว่าอะไร” การใช้แถวปัจจุบันแล้วกรอง created_at ≤ T ไม่เพียงพอ เช่น วันนี้ขยายกำหนด ย้ายหน่วยงาน หรือแก้วันที่ยุติย้อนหลัง จะทำให้รายงานสิ้นเดือนก่อนเปลี่ยนผิดความหมาย

ใช้สองเวลาเฉพาะข้อมูลที่มีผลต่อ workflow และตัวชี้วัด:

| เวลา | ความหมาย | ใครกำหนด |
|---|---|---|
| valid_from / valid_to | ช่วงที่ข้อเท็จจริงมีผลทางธุรกิจ | RPC ที่ได้รับอำนาจ; ปกติเริ่ม ณ server time; ย้อนหลังได้เฉพาะกระบวนการแก้/นำเข้าที่ระบุ |
| known_from / known_to | ช่วงที่ระบบถือว่ารุ่นนี้เป็นข้อมูลที่ทราบ | server เท่านั้น ห้าม backdate |
| occurred_at / effective_at | เวลาเกิด/มีผลของเหตุการณ์ immutable | online ใช้ server; imported source แยก provenance |
| recorded_at | เวลาเขียนข้อเท็จจริงเข้าสู่ระบบจริง | server เท่านั้น ไม่ใช้เวลาจากไฟล์นำเข้าแทน |

ทุกช่วงเป็น [start,end) และ NULL end หมายถึงยังเปิดอยู่ state(T,K) เลือกแถวที่ valid_from ≤ T < valid_to และ known_from ≤ K < known_to ค่าเริ่มต้นรายงานอดีตใช้ K=T ส่วนรายงานปรับปรุงย้อนหลังใช้ T เดิม, K ใหม่ พร้อม snapshot ใหม่และเหตุผล ตัวอย่าง correction ที่มีผล 1 ต.ค. แต่นำเข้าวันที่ 20 ต.ค. จะไม่ปรากฏในรายงาน as-known วันที่ 10 ต.ค. แต่ปรากฏใน restatement ที่ K หลังวันที่ 20

### 12.2 ตารางประวัติแบบ typed

ทุกตารางในกลุ่มนี้อยู่ private มี id, organization_id, aggregate FK, revision_no, valid_from, valid_to?, known_from, known_to?, source_event_id/decision FK ตามชนิด, recorded_by และ reason business payload ของแต่ละแถว immutable อนุญาตเฉพาะ trusted procedure ปิด known_to หนึ่งครั้งแล้วเพิ่ม replacement segments ห้าม client แก้ช่วงเวลา

| ตาราง | business payload ที่ต้องคงประวัติ |
|---|---|
| task_cycle_state_revisions | task_cycle_id, status, spec_version_id, lead_unit_id, owner_assignment_id, reviewer_assignment_id, primary_resolution_cycle_id, original_deadline_version_id?, original_due_set_at?, effective_deadline_version_id?, published_at?, started_at?, accepted_submission_id?, accepted_at?, cancelled_at?, cancellation_kind?, progress_percent |
| resolution_cycle_state_revisions | resolution_cycle_id, governing_version_id, resolution_type, requires_action, status, lead_unit_id, coordinator_id, authorization_event_id?, opened_at?, closed_at?, terminated_at?, closure_decision_id? |
| assignment_state_revisions | owner_assignment_id, owner_id, assigned_at, acknowledged_at?, assignment_valid_from, assignment_valid_to?, ack_due_at?, calendar_version_id?, policy_version_id? |
| resolution_task_link_revisions | resolution_cycle_task_link_id, resolution_cycle_id, task_cycle_id, relation_kind, required_for_closure, link_valid_from, link_valid_to? |
| reporting_occurrence_state_revisions | reporting_occurrence_id, plan_id, period_start/end, due_kind, due_on/due_at, timezone, status, exception_reason?, approval_id? |
| recurrence_occurrence_state_revisions | occurrence_id, plan_version_id, period_start/end, planned_due_kind/on/at, status, expected_slot_keys text[], generated_slot_keys text[], exception_reason?, approval_id? |

historical planning gap ใช้ expected/generated slot keys ของ history รุ่นที่ resolve ณ T,K และ occurrence-slot links ที่มี effective_at≤T/recorded_at≤K เพื่อเชื่อมไป task ที่ถูกต้อง ไม่อ่านจำนวน slot ที่สร้างแล้วในปัจจุบันกลับไปแทนอดีต

ย้ายเจ้าของหรือแก้ end ของ assignment ต้องเขียน assignment_state_revisions ด้วย มิฉะนั้นรายงานเก่าจะเห็นวันสิ้นสุดที่ตอนนั้นยังไม่ทราบ ส่วน owner/unit attribution ใช้ค่าที่ resolve ณ T ไม่อ่านชื่อหน่วยงานปัจจุบันของบุคคลแล้วกระจายย้อนหลัง

การเปลี่ยนงานหนึ่งครั้งเขียน current projection, typed history, immutable business decision, audit และ outbox ใน transaction เดียว การแก้ย้อนหลังต้องปิด known interval ของช่วงที่ได้รับผล แล้วสร้าง valid segments ชุดใหม่ให้ครบทั้งก่อน/ระหว่าง/หลังจุดแก้ ห้ามแก้ payload ของแถวเก่าและห้ามสร้างช่วง valid ที่ซ้อนกันใน knowledge interval เดียว ไม่มีความจำเป็นต้อง temporalize สี avatar หรือข้อความหน้าจอทุกช่อง

immutable payload ของ submission และ review/criteria/evidence/deadline versions ใช้เวลาต้นทางและ recorded_at ของตนเอง ไม่ทำ history ซ้ำทุกตาราง สถานะ submission ณ T,K ต้อง resolve จาก submission_events และ reviews ที่มีผล/ทราบไม่เกิน cutoff ไม่อ่าน submissions.status ปัจจุบัน การแก้คำตัดสินที่มีผลแล้วไม่อนุญาต UPDATE review เดิม ให้เปิด cycle ใหม่หรือใช้กระบวนการ correction ที่มีอำนาจและ provenance ตามนโยบายที่จะยืนยัน

### 12.3 ชุดข้อมูลและ snapshot

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| metric_definition_versions | metric_code text, version_no integer, title_th, counting_unit, definition text, formula_config jsonb, implementation_checksum text, published_at, approved_by FK | UQ(org,code,version); เก็บนิยามและรุ่น implementation ที่ rebuild ได้ ไม่เก็บ executable SQL จากผู้ใช้ |
| report_runs (private) | requested_by FK, report_kind, business_cutoff T, knowledge_cutoff K, period_start/end, filters jsonb, attribution_basis text, status queued/running/completed/failed/cancelled, requested_at, started_at?, finished_at?, error_code?, authorization_epoch | ตรวจ scope ตอนขอ ตอน worker เริ่ม และก่อนเผยแพร่ artifact |
| report_snapshots | report_run_id FK, snapshot_code, generated_at, business_cutoff, knowledge_cutoff, period_start/end, timezone, filters jsonb, attribution_basis, formula_manifest jsonb, policy_calendar_manifest jsonb, source_watermark jsonb, restates_snapshot_id? FK, restatement_reason?, content_sha256, status ready/restricted/purged | UQ(org,run); immutable เนื้อหาและตัวเลข; status availability เปลี่ยนได้ผ่าน audit; restatement มี ID ใหม่ |
| report_metric_results | snapshot_id FK, metric_definition_version_id FK, dimension_key text, dimension_values jsonb, numerator? numeric, denominator? numeric, result_value? numeric, unit, excluded_count integer, breakdown jsonb | UQ(org,snapshot,metric,dimension_key); เก็บตัวตั้ง/ตัวหารจริง; denominator=0 ให้ result NULL และแสดง “ไม่มีรายการ” |
| report_cohort_members (private) | snapshot_id FK, metric_definition_version_id FK, member_kind task_cycle/resolution_cycle/assignment/submission/reporting_occurrence/legacy_record, task_cycle_id?/resolution_cycle_id?/owner_assignment_id?/submission_id?/reporting_occurrence_id?/legacy_workflow_record_id? FK, dimension_key, inclusion_reason, numerator_contribution numeric, denominator_contribution numeric, resolved_values jsonb | CHECK target หนึ่งชนิดตรง member_kind; ไม่มี fan-out จาก join หลักฐานหลายไฟล์; source/version IDs เก็บใน manifest |
| report_source_manifest (private) | snapshot_id FK, source_type, source_id uuid, source_version_id?, source_recorded_at, source_digest?, required_resolution_id? FK, required_task_id? FK, required_document_id? FK | resolver จำกัด source_type; รายการ scope ที่ใช้ตรวจสิทธิเปิดรายงานต้องครบทุกองค์ประกอบ รวมรายการถูกยกเว้นที่มีรายละเอียด |
| report_artifacts (private) | snapshot_id FK, format csv/xlsx/pdf, bucket_id, object_key, sha256, byte_size, renderer_version, created_at, expires_at?, purged_at? | artifact immutable; สร้าง format เฉพาะที่ยืนยัน Q-08; private bucket; ดาวน์โหลดตรวจสิทธิใหม่ |

ตัวเลข chart, drill-down และ export อ่าน snapshot เดียวกัน กราฟบน dashboard ปัจจุบันอาจใช้ query สดได้ แต่ต้องระบุว่าเป็นปัจจุบันและไม่ติดป้ายว่าเป็นรายงานย้อนหลังที่ยืนยันแล้ว ห้ามใช้ตัวนับใน localStorage เป็น KPI ทางการ

การสร้างรายงานใช้ transaction snapshot ที่สอดคล้องกัน เช่น Repeatable Read สำหรับ resolve facts/materialize cohort และคำนวณผล จากนั้น render artifact จาก cohort ที่ตรึงแล้วนอก transaction ระยะยาว ต้องบันทึก cutoff, knowledge cutoff และ read watermark ที่ใช้จริง ห้าม query ตัวตั้งกับตัวหารคนละฐานข้อมูลคนละเวลา [PostgreSQL: transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

known_from/recorded_at เป็นเวลา statement ที่ฐานข้อมูลบันทึก ไม่ใช่ timestamp รับรองการ commit ที่ PostgreSQL ให้โดยอัตโนมัติ จึงกำหนดคำว่า “ทราบ ณ T” ในระบบนี้ว่า fact ที่ผ่านการ commit, มี recorded time ≤ T และอยู่ใน consistent read watermark ของรายงานนั้น snapshot ที่ออกแล้วเป็นหลักฐานชุดข้อมูลที่ใช้จริง หากต้องการ replay ให้ตรง commit order ในระดับธุรกรรมข้ามรายงานทุกครั้ง ต้องเพิ่ม committed-event watermark/ingestion barrier ที่ทดสอบแล้วก่อนรับรองคุณสมบัตินั้น ไม่อ้างว่า timestamp เพียงค่าเดียวแก้ปัญหาธุรกรรมที่เปิดค้างข้าม cutoff ได้

### 12.4 สูตร KPI เป้าหมาย

สัญลักษณ์: T=business cutoff, K=knowledge cutoff, P=[period_start,period_end), F=scope/filters ที่ได้รับสิทธิ W=task cycles ที่เผยแพร่และทราบตาม state(T,K), d0=กำหนดแรก, dT=กำหนดที่มีผล ณ T, a=เวลาตรวจรับ, s*=เวลาส่งของ attempt ที่ตรวจรับจริง C0/CT=งานใน W ที่กำหนด d0/dT อยู่ใน P และถึงกำหนดแล้ว ณ T ใช้วันที่ local สำหรับ due_kind=date งาน draft/template ไม่เข้า W

cohort อื่นภายใต้ F และความรู้ ณ K: CA=assignments ที่ assigned_at อยู่ใน P และ ≤T; CS=submissions ที่ submitted_at อยู่ใน P และ ≤T; CF=cycles ที่ submission ครั้งแรกส่งใน P และ ≤T; CR=reporting occurrences ที่กำหนดอยู่ใน P และ due_reached ณ T; CP=cycles ที่เผยแพร่ใน P และ ≤T; CM=finite actionable resolution cycles ที่เปิดใน P และ ≤T ผลรับทราบ ผลตรวจ และรายงานครบต้องเกิดไม่เกิน T และทราบไม่เกิน K จึงใช้คำนวณได้ คิวรอทั้งหมดแสดงแยกจาก cohort รายเดือนเหล่านี้

ข้อเสนอใน PRD ใช้ฐาน gross: cancelled/terminated ยังอยู่ในฐานเมื่อเข้า cohort แต่ไม่เป็นตัวตั้งความสำเร็จ งาน no deadline แสดงแยก หากจะมีสูตร net ที่ตัดงานยุติออก ต้องสร้าง metric_definition_version คนละสูตรพร้อมเหตุผล ไม่เปลี่ยนรายงานเดิม

| KPI | หน่วยนับและสูตร | แหล่งข้อมูลและข้อควรระวัง |
|---|---|---|
| KPI-01 รับรองตามกำหนดเดิม | จำนวนใน C0 ที่ accepted และ a on-time ต่อ d0 / จำนวน C0 | task history + original deadline + accepted review; งานขยายกำหนดยังคงอยู่ฐานเดิม |
| KPI-02 รับรองตามกำหนดปัจจุบัน | จำนวนใน CT ที่ accepted และ a on-time ต่อ dT / จำนวน CT | resolve deadline ณ T,K; แสดงจำนวนขยายกำหนดและ moved-out จาก C0 ควบคู่ ไม่ทำให้การย้ายเดือนหายไป |
| KPI-03 ส่งผลงานที่ผ่านตามกำหนดเดิม | จำนวนใน C0 ที่ accepted และ s* on-time ต่อ d0 / จำนวน C0 | submission ที่ accepted_submission_id อ้างเท่านั้น; ส่งครั้งแรกเร็วแต่ถูกคืนแล้วส่งผ่านช้า ไม่ถือว่าตรงเวลา; pending review แยก ไม่กล่าวหาว่าผู้ทำงานช้าทุกรายที่ไม่เข้าตัวตั้ง |
| KPI-04 ปิดมติที่มีงานแบบสิ้นสุดได้ | จำนวนใน CM ที่ closed ณ T / จำนวน CM | ไม่รวม acknowledgment-only และ recurring parent; terminated อยู่ฐานแต่ไม่ใช่ closed; ไม่ผูกเดือนด้วยเวลาปิดอย่างเดียว |
| KPI-05 งานค้างเกินกำหนด | จำนวน published task cycles ที่ยังไม่ accepted/cancelled และเกิน dT ณ T | นับ backlog ทุกเดือนเป็น default; แยก owner action กับ submitted awaiting review, ระดับความล่าช้า, no deadline; ไม่จำกัดเฉพาะ CT โดยเงียบ |
| KPI-06 ความเร็วรับทราบ | median/P90(acknowledged_at−assigned_at) ของ CA ที่รับทราบภายใน T; SLA rate = รับทราบทัน boundary / CA ที่ครบ window ณ T และมีผลถึง boundary | ตาม assignment ไม่ใช่ task; superseded ก่อน window ครบแยกออกพร้อมจำนวน; unacknowledged ที่ครบ window อยู่ตัวหาร; ใช้ calendar/policy ที่ตรึง |
| KPI-07 ความเร็วตรวจ | median/P90(reviewed_at−submitted_at) ของ CS ที่มี decision ภายใน T; waiting age ของ pending ใน CS และคิวทั้งหมดแยกกัน | withdrawn ไม่ใช่ review; returned เป็น decision; ระบุเวลาปฏิทิน/business time ตามสูตรรุ่น |
| KPI-08 ผ่านครั้งแรก | จำนวน CF ที่ first submission accepted ณ T / จำนวน CF ที่ first submission มี decision accepted หรือ returned ณ T | attempt_no=1 ต่อ cycle; pending/withdrawn แสดงแยก; งานเปิดใหม่เป็นคนละ cycle |
| KPI-09 รายงานตรงรอบ | จำนวนใน CR ที่มี first complete validated report on-time / จำนวน CR | draft ไม่นับ; first complete ใช้ reporting_responses; exempted/cancelled อยู่ฐาน gross พร้อม breakdown; planning gap แยก |
| KPI-10 ความครบก่อนเผยแพร่ | จำนวน CP ที่ผ่าน completeness validation / จำนวน CP | task_publication_facts และ imported exception fact ที่มีเวลาพอเข้า cohort; ไม่ทราบเวลาเผยแพร่แสดง unknown-period แยก ไม่เติมเวลาปัจจุบัน |

สำหรับ KPI-06/07 การหาค่า median/P90 ใช้ชุดระยะเวลาที่สังเกตผลแล้ว และแสดง pending count/age ควบคู่เพื่อไม่ซ่อนงานที่ยังไม่ตอบ ข้อเสนอ attribution เริ่มต้นคือ owner/unit ณ T; รายงานตามเจ้าของขณะรับผิดชอบหรือขณะตรวจรับต้องเลือก attribution_basis แยกและระบุใน snapshot

### 12.5 Query/read model ที่เสนอ

| Read model / RPC | ผลลัพธ์หลัก | ข้อจำกัด |
|---|---|---|
| list_secretariat_worklist | มติที่รออนุญาต/ปิด คำขอค้าง งานเสี่ยง และเรื่องรอติดตาม | current scope; counts ใช้ filter เดียวกับ list |
| list_my_task_cycles | งานที่เป็น owner/contributor/reviewer พร้อม ack, time, blocker dimensions | cursor pagination; ไม่มี sibling task รั่วจาก parent resolution |
| get_task_cycle_detail | current spec, assignments, deadline, progress, evidence, attempts, timeline | authorizer ตรวจ task และเอกสารแต่ละชิ้น |
| get_resolution_cycle_detail | version, authorization, criteria, permitted task links, closure history | ถ้าเห็นเพียงงานของตน ให้ parent context ขั้นต่ำ ไม่เผยทั้งมติ/ทุกงาน |
| search_authorized_records | code/title/content ที่อนุญาต, snippet ที่ผ่าน scope | RLS ก่อนสร้างผลและ count; ห้าม cache ข้าม user/scope |
| resolve_task_cycles_at(T,K,F) (private) | หนึ่งแถวต่อ cycle พร้อม facts ที่ resolve แล้ว | ใช้ typed histories และ immutable version IDs; worker ห้ามข้ามสิทธิผู้ร้อง |
| get_report_snapshot | ตัวเลขและ drill-down ที่ตรึงไว้ | current scope ต้องครอบคลุม manifest ทั้งชุด มิฉะนั้น deny หรือสร้างรายงานกรองใหม่คนละ ID |

การค้นหาภาษาไทยเริ่มจากรหัส exact/prefix และข้อความด้วย pg_trgm ตามความเหมาะสม ทดสอบกับชื่อและข้อความจริงก่อนเลือกรูปแบบ index อย่าอ้างว่า PostgreSQL simple full-text configuration ตัดคำภาษาไทยได้ครบ หากต้องการ linguistic search ให้ประเมิน tokenizer/search service แยกในระยะถัดไป

<a id="imports"></a>
## 13. การนำเข้าและการเก็บรักษา

### 13.1 Staging ก่อนนำเข้าจริง

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| import_batches (private) | source_document_version_id FK, source_system, source_sha256, mapping_version, requested_by FK, status uploaded/validated/approved/applying/completed/failed/rolled_back, approved_by?, approved_at?, summary jsonb, started_at?, finished_at? | source hash และ batch key ป้องกันกดซ้ำ; preview/approval ก่อน apply |
| import_rows (private) | batch_id FK, row_no integer, source_record_key?, raw_payload jsonb, normalized_payload jsonb, validation_errors jsonb, proposed_action create/update/skip/conflict, status staged/valid/invalid/applied/skipped/failed, applied_entity_id?, applied_version_id?, applied_at? | UQ(org,batch,row); validation ไม่ทำ write ธุรกิจ; raw เป็นข้อมูลส่วนบุคคลได้ ต้องคุม retention |
| source_identifiers | source_system, entity_type resolution/task/meeting/profile, source_key, resolution_id?/task_id?/meeting_id?/profile_id? FK, first_import_batch_id FK, last_verified_at? | UQ(org,source_system,entity_type,source_key); CHECK target ตรงชนิด; กัน duplicate ข้าม batch |
| imported_fact_provenance (private) | import_row_id FK, entity_type, entity_id, field_name, source_occurred_at?, source_effective_at?, source_precision exact/date_only/unknown, actual_recorded_at, confidence verified/unverified, approved_exception_id? FK | ไม่เติมเวลา accepted/published ที่ไม่ทราบ; fact ที่ไม่ยืนยันแสดง unknown และแยกจาก numerator |
| import_exceptions (private) | batch_id FK, row_id? FK, exception_code, explanation, approved_by FK, authority_grant_id FK, approved_at, affected_metric_codes text[] | ข้อยกเว้นมีหลักฐาน ไม่ทำให้ข้อมูลไม่ครบดูเหมือนปกติ |
| import_application_items (private) | import_row_id FK, operation, target_type, target_id, target_version_id?, before_row_version?, after_row_version?, applied_at, rollback_status? | ตรวจ dependency ก่อน rollback; ไม่มี wholesale delete หลังถูกใช้อ้างอิงแล้ว |
| legacy_workflow_records (private) | import_row_id FK, task_id? FK, resolution_id? FK, source_cycle_key?, reported_status text, source_published_at?, source_submitted_at?, source_accepted_at?, source_closed_at?, source_owner_id? FK, source_reviewer_id? FK, source_unit_id? FK, original_due_kind? date/instant, original_due_on?, original_due_at?, evidence_manifest jsonb, completeness_passed? boolean, completeness_provenance jsonb, exception_id FK, approved_by FK, promoted_task_cycle_id? FK, promoted_resolution_cycle_id? FK | ช่องที่ไม่ทราบเป็น NULL; target task หรือ resolution หนึ่งชนิด; completeness true/false ต้องมีหลักฐาน ณ เผยแพร่ ส่วน NULL=พิสูจน์ไม่ได้; UQ(org,import_row) และ source key; ไม่มี accepted submission ปลอม |

ขั้นตอน: upload ใน private quarantine → parse/normalize → ตรวจ FK/รหัส/duplicates/date precision/ผู้รับผิดชอบ → preview errors และ KPI impact → ยืนยัน batch → apply เป็นชุด transaction ที่มี checkpoint → reconcile จำนวนรายการและ checksum

ข้อมูลเก่าที่มี mandatory facts ครบและพิสูจน์ได้เข้าสู่ตาราง workflow ปกติผ่าน import RPC โดยแยก occurred/effective ของต้นทางจาก recorded_at จริง ข้อมูลที่ขาดวันส่ง/วันรับรอง/เกณฑ์/ผู้รับผิดชอบ แม้อนุมัติรับเข้าแล้วให้เก็บใน legacy_workflow_records และ provenance พร้อม stable task/resolution ที่อ้างได้ ไม่สร้าง submissions/reviews/task_publication_facts ที่ผิด NOT NULL หรือแต่งเวลาเพื่อให้ผ่าน

authorized legacy read model แสดงสถานะ “ตามข้อมูลนำเข้า” และช่อง unknown แยกจากสถานะ workflow ที่รับรองโดยระบบ snapshot เปิดเผยจำนวน legacy/exceptions และรายการที่เข้า cohort ไม่ได้ KPI-10 รวมเฉพาะ legacy ชนิด task ที่พิสูจน์เวลาเผยแพร่และ scope ได้ ใช้ completeness ณ เผยแพร่ที่มีหลักฐาน: true เข้าตัวตั้ง, false คือพิสูจน์ว่าขาด, NULL คือไม่ทราบ (อยู่ตัวหารที่ทราบว่าเผยแพร่แล้วแต่ไม่ยืนยันเข้าตัวตั้ง และแสดง unknown แยกจาก failed) การขาดวันตรวจรับไม่ได้แปลว่าข้อมูลก่อนเผยแพร่ไม่ครบ ถ้าไม่ทราบเวลาเผยแพร่ให้แสดง unknown-period ไม่ใส่เดือนสมมติ

KPI ความทันเวลาต้องมี denominator facts ครบก่อนเข้าฐานและมี acceptance provenance ที่ยืนยันได้ก่อนเป็น numerator ไม่ถือ reported_status อย่างเดียวว่า accepted การ promote ไม่เปลี่ยน completeness ตอนเผยแพร่ในอดีตโดยอัตโนมัติ แม้ข้อมูลปัจจุบันจะครบแล้ว

report_cohort_members รองรับ member_kind=legacy_record พร้อม legacy_workflow_record_id FK เป็น target อีกชนิด เมื่อภายหลังข้อมูลครบ ให้ promote ผ่านคำอนุมัติเป็น cycle ปกติพร้อม source mapping และบันทึกเวลาที่ระบบทราบจริง resolver ณ T,K ต้องเลือก legacy หรือ promoted cycle เพียงตัวเดียวตามช่วงความรู้ ไม่เพิ่มยอดงานสองครั้ง snapshot เดิมคง manifest เดิม ข้อมูล legacy ที่ไม่มี owner ปัจจุบันต้องอยู่คิวตรวจสอบ/มอบหมายก่อนเปิดดำเนินงานต่อ

Rollback ทำได้เฉพาะ draft ที่ batch สร้างและยังไม่มีผู้ใช้แก้ อ้างอิง ส่งตรวจ หรือใช้ใน snapshot หากถูกใช้งานแล้ว ให้ compensating correction/termination ที่ตรวจสอบได้ ไม่ลบประวัติหายทั้งชุด Import ไม่ overwrite version ที่ finalized แล้ว

### 13.2 Retention, legal hold และการกู้คืน

| ตาราง | คอลัมน์เฉพาะที่สำคัญ | กฎ |
|---|---|---|
| retention_policy_versions | policy_code, version_no, record_class, retention_months? integer, disposition archive/purge/manual_review, effective_at, approved_by, authority_reference | ไม่มี default purge สำหรับมติ/ผลตรวจที่ยังไม่ยืนยันอายุเก็บ; NULL ระยะเวลาแปลว่ารอทบทวน/เก็บต่อ ไม่ใช่ลบทันที |
| retention_holds | reason, imposed_by FK, imposed_at, released_by?, released_at?, authority_document_version_id? FK | hold ครอบคลุมได้หลายรายการผ่าน hold_targets; worker ต้องตรวจใหม่ก่อนลบ |
| retention_hold_targets | hold_id FK, resolution_id?/task_id?/document_id?/snapshot_id? FK | CHECK หนึ่ง target; dependency ของ held evidence ต้องถูกคุ้มครองด้วย |
| disposition_requests (private) | record_type, record_id, policy_version_id FK, requested_by, reason, status pending/approved/rejected/executed, approved_by?, approved_at?, execute_after? | ตรวจ retention, hold, active references และผู้อนุมัติ; ไม่ใช้ cascade ข้ามประวัติ |
| disposition_events (private) | request_id FK, action archive/purge_bytes/anonymize, executed_by?, actor_kind, executed_at, object_manifest? jsonb, result, verification_digest? | เก็บ metadata/tombstone ของเวอร์ชันที่ลบ bytes แล้ว เพื่ออธิบายว่า evidence เคยเป็นอะไรและเพราะเหตุใดเข้าถึงไม่ได้ |
| backup_restore_exercises (private) | executed_at, database_backup_ref, object_backup_manifest_ref, target_environment, expected_rpo_minutes, actual_rpo_minutes?, actual_rto_minutes?, verification_result jsonb, executed_by, reviewed_by? | บันทึกผลจริง; ไม่เก็บ credentials หรือ secret keys |

การปิดบัญชีถอน auth binding/grants แต่รักษา profile สำหรับ FK ประวัติ การ anonymize บุคคลต้องผ่านนโยบายที่ยืนยัน และไม่ทำลายรหัสอ้างอิงหรือหลักฐานอำนาจที่ต้องเก็บ ห้ามกำหนดระยะเก็บตามการคาดเดากฎหมายในเอกสารนี้

Supabase database backup ไม่รวมไฟล์จริงใน Storage จึงต้องวางแผน backup object bytes, manifest, checksum และทดสอบ restore ให้ FK metadata กับไฟล์ตรงกัน รวมถึงทดสอบ RLS หลัง restore ค่า RPO 24 ชั่วโมง/RTO 8 ชั่วโมงใน PRD เป็นเป้าหมายเสนอ ไม่ใช่คุณสมบัติที่ระบบปัจจุบันมีแล้ว [Supabase: backups](https://supabase.com/docs/guides/platform/backups)

<a id="constraints"></a>
## 14. Constraints และ indexes

### 14.1 สิ่งที่ฐานข้อมูลต้องบังคับ

| กฎ | กลไกที่เหมาะสม |
|---|---|
| UUID ไม่ซ้ำและ parent อยู่ organization เดียวกัน | PK(id), UQ(organization_id,id), composite FK(organization_id,parent_id); tenant_id จาก server ไม่เชื่อค่าจาก form |
| pointer ไม่ข้ามเจ้าของ aggregate | FK ที่รวม organization_id, aggregate_id, version_id เช่น current spec ต้องเป็นของ cycle นั้น |
| รหัสถาวรไม่ซ้ำ | UQ(org,code); allocator ล็อก number_sequences; ยอมมีเลขขาดเมื่อ transaction ยกเลิกตาม policy แต่ไม่ reuse รหัสที่เผยแพร่แล้ว |
| version/attempt/cycle ไม่ซ้ำ | UQ(org,parent_id,ordinal); allocate ภายใต้ aggregate lock; ordinal>0 |
| หนึ่ง active cycle ต่อ task/resolution | partial unique index ตามสถานะที่ยัง active; terminal cycle เก็บไว้ได้หลายรอบ |
| หนึ่ง pending submission/closure | partial unique index; การกดซ้ำตรวจ idempotency key ก่อนเพิ่ม attempt |
| owner มีคนเดียว ณ เวลาใดเวลาหนึ่ง | exclusion constraint บน org,task_cycle และ tstzrange(valid_from,valid_to,'[)'); no gaps ตอน published ต้องตรวจ RPC เพิ่ม |
| ช่วงเวลาไม่กลับด้าน | CHECK end IS NULL OR end>start; known/valid interval ไม่ซ้อนสำหรับประวัติ aggregate เดียวกัน |
| due tuple ถูกชนิด | CHECK date มีเฉพาะ due_on, instant มีเฉพาะ due_at, none ไม่มีทั้งสองและมี reason/next_report |
| ตัวเลขก้าวหน้า/ขนาดไฟล์ | CHECK progress BETWEEN 0 AND 100, byte_size>=0, version_no>0, period_end>period_start |
| typed target หนึ่งชนิด | CHECK num_nonnulls(...) = 1 และ request_type ตรง subtype; FK ทุก target |
| spec/criteria/evidence อยู่ชุดส่งเดียวกัน | composite FK และ deferred constraint trigger/RPC guard สำหรับความสัมพันธ์ข้ามหลายตาราง |
| published/accepted/closed ครบทุก requirement | transactional RPC + constraint triggers ในจุดที่เหมาะสม; CHECK ธรรมดาไม่สามารถตรวจข้ามหลายแถวให้ครบได้ |
| ห้ามลบหลักฐานที่ถูกใช้แล้ว | FK ON DELETE RESTRICT/NO ACTION; purge bytes แยกจาก metadata; version immutability trigger |
| dependency ไม่เป็นวงจร | recursive validation ภายใต้ graph lock ระดับ organization หรือ lock protocol ที่ทุกการแก้ dependency ใช้ร่วมกัน |
| required task ยกเลิกแล้วปิดไม่ได้ | closure guard อ่านสถานะ/เกณฑ์ล่าสุดภายใต้ resolution/task locks |

CHECK ที่ผลเป็น NULL อาจไม่ reject แถว จึงต้องเขียนเงื่อนไข IS NULL / IS NOT NULL ให้ครบ ส่วน unique ที่มี nullable scope ต้องใช้ NULLS NOT DISTINCT หากเวอร์ชันรองรับ หรือ partial unique แยก default scope เพื่อไม่ให้มี policy รุ่น default ซ้ำ ข้อจำกัด cross-row ควรใช้ unique/exclusion/FK หรือ transaction/trigger ไม่แอบเขียน CHECK ที่เรียก query ข้อมูลอื่น [PostgreSQL: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

### 14.2 ตัวอย่าง SQL ของ invariants

SQL ต่อไปนี้เป็นตัวอย่างส่วนประกอบเพื่อให้ผู้นำไปทำ migration เห็นความหมาย ยังไม่ใช่ migration ที่รันได้ทั้งชุด ต้องสร้าง parent keys, grants, extensions, functions และทดสอบบนเวอร์ชัน PostgreSQL ของ Supabase project ก่อน

~~~sql
-- ป้องกันส่งพร้อมกันสอง attempt ที่ยังรอตรวจ
CREATE UNIQUE INDEX submissions_one_pending_per_cycle
ON public.submissions (organization_id, task_cycle_id)
WHERE status = 'pending';

CREATE UNIQUE INDEX task_cycles_one_active_per_task
ON public.task_cycles (organization_id, task_id)
WHERE status IN ('draft', 'assigned', 'in_progress', 'submitted', 'revision');

ALTER TABLE public.task_deadline_versions
ADD CONSTRAINT deadline_value_shape CHECK (
  (due_kind = 'date' AND due_on IS NOT NULL AND due_at IS NULL)
  OR (due_kind = 'instant' AND due_at IS NOT NULL AND due_on IS NULL)
  OR (due_kind = 'none' AND due_on IS NULL AND due_at IS NULL
      AND no_due_reason IS NOT NULL AND length(btrim(no_due_reason)) > 0
      AND next_report_on IS NOT NULL)
);

-- ต้องเปิด btree_gist ใน schema/extensions ที่ project กำหนดก่อน
ALTER TABLE public.owner_assignments
ADD CONSTRAINT owner_assignment_no_overlap
EXCLUDE USING gist (
  organization_id WITH =,
  task_cycle_id WITH =,
  tstzrange(valid_from, valid_to, '[)') WITH &&
);

-- ต้องมี UNIQUE (organization_id, task_cycle_id, id) บน task_spec_versions
ALTER TABLE public.submissions
ADD CONSTRAINT submission_spec_same_cycle
FOREIGN KEY (organization_id, task_cycle_id, spec_version_id)
REFERENCES public.task_spec_versions (organization_id, task_cycle_id, id);
~~~

ต้นแบบ bitemporal exclusion ใช้ org+aggregate equality และ overlap ของทั้ง valid range กับ known range ป้องกันมีสองคำตอบสำหรับ state(T,K) แต่ procedure ยังต้องดูแลการแบ่ง segments และความครบของช่วง ห้ามคิดว่า exclusion อย่างเดียวสร้าง history ให้ถูกต้องเอง

### 14.3 Index ตามรูปแบบการใช้งาน

ทุก FK ฝั่งลูกที่ใช้ join/delete validation ควรมี index ตาม workload; PostgreSQL ไม่สร้าง index ฝั่งอ้าง FK ให้เองทั้งหมด ก่อนเพิ่ม index ให้ตรวจของที่ unique/PK สร้างไว้อยู่แล้ว

| ตาราง/ชุดข้อมูล | Index เริ่มต้นที่เสนอ | รองรับ |
|---|---|---|
| resolutions, tasks | unique(org,code); (org,current_cycle_id) | ค้นรหัสและอ่านรอบปัจจุบัน |
| task_cycles | (org,status,published_at DESC,id); (org,task_id,cycle_no DESC) | ทะเบียน/cursor และ timeline |
| owner_assignments | (org,owner_id,valid_to,task_cycle_id); (org,task_cycle_id,valid_from DESC) | งานของฉัน/ประวัติรับช่วง |
| reviewer_assignments | (org,reviewer_id,valid_to,task_cycle_id) | คิวผู้ตรวจ |
| submissions | (org,status,submitted_at,id); (org,task_cycle_id,attempt_no DESC) | งานรอตรวจและ attempts |
| reviews | unique(org,submission_id); (org,reviewed_at,id) | KPI และตรวจผลของชุดส่ง |
| task_deadline_versions | (org,task_cycle_id,effective_at DESC,recorded_at DESC) | กำหนดที่มีผล; due_on/due_at index เพิ่มเฉพาะ query ที่ใช้จริง |
| resolution_cycle_tasks | (org,resolution_cycle_id,valid_to,required_for_closure); (org,task_cycle_id,valid_to) | closure check และ parent context |
| change_requests, closure_requests | (org,status,requested_at,id) | คิวอนุมัติ |
| progress_reports | (org,task_cycle_id,first_published_at DESC,id) | timeline รายงาน |
| reporting/recurrence occurrences | unique plan/key; (org,status,due_at หรือ planned_due_at,id) และ date variant | scheduler และรอบค้าง |
| access_grants | (org,profile_id,revoked_at,valid_from,valid_to); typed target indexes | permission helper โดยไม่สแกนทั้งองค์กร |
| state revisions | B-tree(org,aggregate_id,known_from DESC); GiST ranges ตาม query ที่วัด | as-of resolve |
| notifications | (org,recipient_id,created_at DESC,id); unread partial index WHERE read_at IS NULL | inbox/cursor |
| jobs/outbox | (status,available_at,id) สำหรับ jobs; unprocessed partial index สำหรับ outbox | worker claim/retry |
| report cohorts/manifest | (org,snapshot_id,metric_definition_version_id,dimension_key); (org,snapshot_id,source_type,source_id) | drill-down และตรวจสิทธิ artifact |
| audit_events | (org,entity_type,entity_id,recorded_at DESC,id); (org,actor_id,recorded_at DESC) | timeline และสืบย้อน |

ใช้ keyset/cursor (timestamp,id) สำหรับหน้ารายการยาว ไม่พึ่ง OFFSET สูง หลีกเลี่ยง SELECT * ใน list ไม่มีเหตุผลต้อง partition ทุกตารางตั้งแต่ MVP; พิจารณา audit/history/report cohorts เมื่อมีสถิติจริง Query plan และต้นทุน RLS ต้องวัดด้วยข้อมูลใกล้เคียงใช้งาน รวมกรณีผู้ใช้เห็นเพียงส่วนน้อยขององค์กร

<a id="transactions"></a>
## 15. ธุรกรรมและ API ที่เสนอ

### 15.1 ขอบเขตการเขียน

Client ใช้ Supabase Auth เพื่อระบุตัวตน แล้วเรียก server/RPC ที่ allowlist สำหรับการเปลี่ยน workflow ไม่ส่ง actor_id, approval authority, accepted_at หรือ audited timestamps ตามใจจาก browser Server ต้อง derive จาก session/database และตรวจองค์กรทุกครั้ง การใช้ server action ใน Next.js ไม่ทำให้ข้ามการตรวจสิทธิฐานข้อมูลได้

| RPC / command | แถวที่ต้องล็อก | ผลสำเร็จใน transaction เดียว |
|---|---|---|
| create_resolution_draft / confirm_resolution_version | number sequence, resolution/cycle | รหัส/เวอร์ชัน/เกณฑ์ และ audit |
| record_start_authorization | resolution_cycle และงานที่ได้รับผลตาม scope | authorization event, current/history projection, แจ้งงานที่ suspend |
| publish_task_cycle | resolution_cycle, task_cycle, assignment/spec/deadline | completeness fact, assigned state, frozen d0 หากมี, history/outbox |
| acknowledge_assignment | task_cycle, owner_assignment | ack เฉพาะเจ้าของปัจจุบัน; เวลา server; repeat กลับผลเดิม |
| start_task_cycle / publish_progress | resolution_cycle, task_cycle | ตรวจ authorization/conditions/dependency, รายงานรุ่นใหม่, progress projection |
| submit_task_cycle | resolution_cycle, task_cycle, pending attempt check | immutable submission/spec/participants/evidence, submitted state |
| review_submission | resolution_cycle, task_cycle, submission | ผลทุก criterion, review, accepted/revision, audit/outbox |
| request_change / decide_change | parent cycles, request, affected assignments/spec/deadline | stale check, decision, apply version และ projection พร้อมกัน |
| terminate_task_cycle | resolution_cycle, task_cycle, pending submission/request | cancelled + withdraw pending review + ปิดคำขอที่ใช้ต่อไม่ได้ พร้อมเหตุผล |
| request_resolution_closure / decide_resolution_closure | resolution_cycle, linked tasks ทั้งชุดเรียง UUID, closure request | ตรึง/ตรวจงานและเกณฑ์ ปิดหรือคืนแก้ ไม่เกิด phantom required task |
| reopen_task_cycle / reopen_resolution_cycle | stable task/resolution และ terminal cycle | cycle ใหม่พร้อม previous pointer; current cycle pointer เปลี่ยน; ผลเดิมคงอยู่ |
| transfer_task_authority | source/destination resolution cycles เรียง UUID, task_cycle | ปิด primary link เดิม เปิดใหม่ ไม่สร้าง task สำเนา |
| generate_recurrence_occurrence | resolution_cycle, plan/occurrence, number sequence | task ใหม่+cycle แรก+occurrence-slot link ต่อชนิดงานที่ร้องขอ; ผู้ใช้สั่งใน MVP และ scheduler เรียกใน P1 |
| finalize_document_upload | upload intent, document/version, related task if needed | ตรวจสิทธิปัจจุบัน ขนาด MIME checksum scan และยืนยัน version |
| revoke_access / suspend_membership | authorization guard แบบ exclusive, target grants | ถอนสิทธิ เพิ่ม epoch บันทึก audit และยกเลิก pending jobs ตาม scope |

### 15.2 Lock order และ race ที่ต้องกัน

ทุก workflow mutation ใช้ลำดับเดียวกัน: identity_authorization_guard (global shared) → authorization_guards ของ organization เรียง UUID → resolution aggregates/cycles เรียง UUID → task aggregates/cycles เรียง UUID → assignment/submission/request/document → sequence/job เฉพาะที่จำเป็น หาก operation ต้องมี graph lock ให้ได้หลัง authorization guard และก่อน aggregate locks ทุกครั้ง ห้ามแต่ละ RPC เลือกลำดับเอง การสร้างหรือเปลี่ยน identity bindings/membership ต้องใช้ guard protocol ด้วยเพื่อไม่ให้ขอบเขตองค์กรเปลี่ยนระหว่างถอนสิทธิ

ทุกการเพิ่ม/ถอด primary required task ต้องล็อก resolution_cycle เดียวกับ closure RPC จึงไม่เกิดการแทรกงานใหม่ระหว่างตรวจว่า “ครบแล้ว” กับ commit การแก้ dependencies พร้อมกันต้องถือ graph lock ร่วม protocol จึงไม่เกิด A→B และ B→A ที่ตรวจแยกแล้วผ่านทั้งคู่

การตรวจ optimistic row_version ช่วยแจ้ง conflict แก่ UI แต่ไม่แทน row locks สำหรับ invariants ข้ามหลายแถว รองรับ retry เฉพาะ deadlock/serialization failure ที่ออกแบบไว้ โดยใช้ idempotency key เดิมและไม่ส่งแจ้งเตือนนอก outbox ก่อน commit PostgreSQL ถือ row locks จนจบ transaction แต่ต้องเลือก lock mode และ isolation ที่เหมาะสม [PostgreSQL: explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)

| เหตุการณ์พร้อมกัน | ผลที่ยอมรับได้ |
|---|---|
| submit กับ submit | มี pending submission เดียว; retry ได้ reference เดิมหรือ conflict ที่ชัดเจน |
| review กับ terminate | ผู้ได้ lock ก่อนตัดสินสถานะ; ฝ่ายหลัง revalidate แล้วทำได้ตามสถานะใหม่หรือ reject; ห้าม accepted และ cancelled ใน cycle เดียว |
| approve deadline A กับ B | คำขอที่ฐานเก่าต้อง stale; d0 ไม่เปลี่ยน |
| close resolution กับ add required task | ลำดับผ่าน resolution lock; ถ้าเพิ่มก่อน ต้องตรวจงานเพิ่ม; ถ้าปิดก่อน ห้ามเพิ่มเข้ารอบปิด |
| transfer owner กับ submit/review | ไม่ทำให้ snapshot ระบุเจ้าของคนละคนกับ assignment; pending review ห้ามเปลี่ยนเจ้าของโดยเงียบ |
| revoke permission กับ mutation | มีลำดับ commit ที่นิยามไว้ใน §16.3; ไม่มี mutation ใหม่ผ่านหลัง revoke สำเร็จ |
| recurrence command/scheduler สอง worker | (occurrence,task_slot_key) เดียวสร้าง task เดียว; slot อื่นใน occurrence เดียวสร้างได้ตามแผน |
| export กับ revoke permission | ไฟล์ที่สร้างเสร็จยังดาวน์โหลดไม่ได้หาก current rights ไม่ครบ |

error contract เสนอ code: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_FAILED, STALE_VERSION, INVALID_TRANSITION, MISSING_EVIDENCE, SELF_REVIEW_NOT_ALLOWED, DEPENDENCY_NOT_READY, AUTHORIZATION_REQUIRED, IDEMPOTENCY_CONFLICT พร้อม field errors ที่ไม่เปิดเผยข้อมูลลับ รายการที่มองไม่เห็นอาจคืน NOT_FOUND ตามนโยบายเดียวกันทั้งระบบเพื่อไม่เผยว่ามีอยู่

<a id="security"></a>
## 16. RLS, Auth และ Storage

### 16.1 ตัวตนและ authorization

auth.uid() ระบุตัวตน แล้ว resolve ผ่าน auth_identities → profiles → active organization membership → access_grants ที่มีผล ณ ปัจจุบัน → role_permissions → target scope/classification/restrictions ไม่ใช้ profile.role จาก frontend และไม่ถือข้อมูล user-editable metadata เป็นอำนาจ JWT claims อาจค้างจน refresh จึงตรวจสิทธิธุรกิจปัจจุบันจากฐานข้อมูลสำหรับการอนุมัติและข้อมูลจำกัดสิทธิ [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

ทุก helper ปฏิเสธ identity ที่หาย/disabled และ profile ที่ disabled_at มีค่า แม้ JWT ยังใช้ระบุตัวตนได้ การ sign out หรือลบบัญชีใน Auth อย่างเดียวไม่ทำให้ JWT ที่ออกไปแล้วหมดอายุทันที จึงถอน business access ในฐานข้อมูลก่อนและใช้ current checks ต่อเนื่อง [Supabase: managing user data](https://supabase.com/docs/guides/auth/managing-user-data)

permissions ที่ควรมีอย่างน้อย:

| กลุ่ม | permission codes ตัวอย่าง |
|---|---|
| อ่าน | resolution.read, task.read, document.read, audit.read, report.read |
| เลขานุการ | meeting.manage, minutes.record, resolution.draft, task.assign, closure.request |
| ผู้ทำงาน | task.acknowledge, task.start, progress.publish, evidence.attach, task.submit, change.request |
| ผู้ตรวจ | submission.review |
| ผู้มีอำนาจ | minutes.certify, resolution.confirm, execution.authorize, deadline.approve, assignment.approve, scope.approve, task.terminate, task.reopen, resolution.close, resolution.terminate, resolution.reopen |
| รายงาน/นำเข้า | report.generate, report.export, import.stage, import.approve, import.apply |
| ดูแลระบบ | identity.manage, access.manage, policy.manage, calendar.manage, retention.propose, retention.approve, operations.monitor |

code เป็น vocabulary ของแบบออกแบบ ไม่ใช่อนุมัติว่าบทบาทใดได้ครบ ต้องจัด role templates กับเจ้าของกระบวนงานตาม Q-01/Q-03/Q-04 แล้ว publish เป็น role version เจ้าของงานได้รับ action เฉพาะงานที่ assigned จริง ไม่ได้สิทธิ review หรือ approve เพราะสามารถอ่านได้

### 16.2 ตารางสรุปสิทธิและ RLS

| ข้อมูล | SELECT | INSERT/UPDATE/DELETE ของ authenticated |
|---|---|---|
| profile | ตนเอง/ข้อมูลบุคลากรขั้นต่ำภายใน scope; email แยกจาก directory ทั่วไป | แก้ตนเองผ่าน RPC เฉพาะ fields ที่อนุญาต; เปลี่ยน role ไม่ได้ |
| meetings/resolutions | อ่านตาม committee/unit/record grant และ restriction | ไม่มี direct writes; ใช้ workflow RPC |
| task cycles/assignments | owner/contributor/reviewer ที่มี scope หรือผู้มีสิทธิอ่านเหนือขึ้นไป | ไม่มี direct writes; RPC ตรวจ action+current assignment |
| submissions/reviews | ตาม task scope และระดับเอกสาร | immutable หลังยืนยัน; review เฉพาะ reviewer ที่ไม่เคยทำผลงานใน cycle |
| documents/versions | context scope AND classification/restrictions AND available state | upload/finalize ผ่าน intent/RPC; ห้ามลบ metadata ตรง |
| notifications | recipient คนเดียวและยังอ่าน entity ต้นทางได้ | mark read/dismiss ของตนผ่าน narrow RPC |
| grants/memberships | ตนเองขั้นต่ำหรือ access.manage ภายใน scope | grant/revoke RPC พร้อม authority check; ห้าม grant สูงกว่าสิทธิที่มอบได้ |
| audit/history/import/outbox/jobs | private; read RPC เฉพาะผู้ได้รับอำนาจ | ไม่มี Data API direct grants |
| report snapshots/artifacts | ผู้มีสิทธิรายงานและ current rights ครบ manifest | generate/download RPC; ไม่ UPDATE metrics เดิม |

เปิด ENABLE ROW LEVEL SECURITY บนทุก business table ใน exposed schema พร้อมระบุ SQL GRANT ให้ชัด RLS ไม่ใช่สิ่งแทน privileges ฟังก์ชันและ views ต้องตรวจอีกชั้น ตัวอย่างแบบจำลอง policy (helper ต้อง implement และ audit ก่อนใช้):

~~~sql
ALTER TABLE public.task_cycles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_cycles FROM anon, authenticated;
GRANT SELECT ON public.task_cycles TO authenticated;

CREATE POLICY task_cycles_authorized_read
ON public.task_cycles FOR SELECT TO authenticated
USING (
  private.can_read_task_cycle(organization_id, id, (SELECT auth.uid()))
);
~~~

private.can_read_task_cycle ต้องตรวจ active membership, grants, row context และ explicit restrictions ในคำตัดสินเดียว อย่าสร้าง permissive allow policy อีกอันที่ OR แล้วข้าม deny/classification; RLS หลาย permissive policies รวมแบบ OR จึงต้องทดสอบ negative cases ด้วย [PostgreSQL: row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

ใช้ SECURITY INVOKER เป็นค่าเริ่มต้น หาก write RPC ต้อง SECURITY DEFINER เพราะผู้ใช้ไม่มี table DML ให้ใช้ owner ที่จำกัดอำนาจ, SET search_path ให้แน่นอน/ว่าง, ระบุ schema ทุก object, derive caller จาก auth.uid(), ตรวจ permission ภายใน และไม่รับ dynamic SQL จาก client Revoke EXECUTE ทั้ง PUBLIC และ direct grants ของ anon/authenticated แล้ว grant เฉพาะ function signature ที่เปิดใช้ ตั้ง ALTER DEFAULT PRIVILEGES ของ migration owner ทุกคนให้ function ใหม่ไม่เปิด EXECUTE โดยปริยาย; การถอน default ของ PUBLIC ต้องทำระดับ global ของ owner ไม่พึ่ง IN SCHEMA อย่างเดียว Views ใช้ security_invoker เมื่อ project รองรับ หรือ read RPC ที่ตรวจสิทธิชัดเจน [Supabase: database functions](https://supabase.com/docs/guides/database/functions)

helper ใน private ที่ policy ต้องเรียกอาจต้องมี EXECUTE grant เฉพาะ signature ให้ role ที่ใช้ policy พร้อม schema privileges ที่จำเป็น แต่ private ต้องไม่เป็น exposed schema และ helper คืนเพียงคำตัดสินที่จำกัด ไม่เปิด generic lookup/SQL ถ้า helper รับ caller_id ต้องบังคับให้ตรง auth.uid() สำหรับ user call ไม่ยอมให้เลือก UUID ผู้มีสิทธิอื่น ฟังก์ชันต้องไม่อ่านตารางที่เกิด RLS recursion วนกลับโดยไม่มีกลไกที่ออกแบบไว้

service_role/secret key ใช้ใน trusted server เท่านั้นและสามารถข้าม RLS ได้ จึงไม่ใส่ NEXT_PUBLIC_ หรือ bundle ฝั่ง browser Worker ที่ใช้ key นี้ต้องตรวจสิทธิผู้ร้องและ scope ซ้ำตาม contract ห้ามถือว่า queued job ที่เคยยื่นผ่านมีอำนาจตลอดไป Supabase publishable key ไม่ใช่สิทธิธุรกิจและใช้แทน RLS ไม่ได้

### 16.3 ถอนสิทธิระหว่างธุรกรรม (BR-18)

ข้อเสนอ MVP: workflow mutation ทุกตัว lock global identity_authorization_guard แบบ FOR SHARE แล้ว lock authorization_guards ขององค์กรแบบ FOR SHARE โดยถือจน commit ส่วน revoke/suspend/change access/classification ที่ลดสิทธิ lock org guard แบบ FOR UPDATE แล้วเพิ่ม epoch พร้อมการเปลี่ยนสิทธิ การ disable profile/auth unlink ระดับหลายองค์กรใช้ global guard แบบ FOR UPDATE ก่อนเปลี่ยนข้อมูล จึงไม่หลุดการกระทำใน membership อีกองค์กรหนึ่ง

ใช้ READ COMMITTED: statement แรกได้ guard lock แล้ว statement ถัดไปอ่านสิทธิใหม่ ห้ามรวม lock ที่รออยู่กับ permission lookup ใน SELECT/CTE เดียว เพราะ snapshot อาจเริ่มก่อนการรอ ใช้ stored procedure/function ที่ทดสอบการได้ snapshot ใหม่ตาม protocol หรือ isolation ที่ retry serialization conflict ได้อย่างถูกต้อง ห้ามนำผล permission check ก่อน lock มาใช้ต่อ

- ถ้า revoke ได้ lock และ commit ก่อน mutation ฝ่าย mutation เห็นสิทธิใหม่และถูกปฏิเสธ
- ถ้า mutation ได้ shared lock ก่อน การถอนสิทธิรอให้ transaction นั้นจบ แล้วจึง commit; การกระทำดังกล่าวถือว่าเกิดก่อน revoke สำเร็จ
- ทุก action หลัง revoke commit ต้องถูกปฏิเสธ รวมการเปิดแท็บค้าง การ finalize upload และ worker ที่ยังไม่ทำงาน ห้ามใช้ epoch ที่ cache ไว้เป็นอำนาจโดยไม่ revalidate

นี่เป็นการจัดลำดับธุรกรรมที่ตรวจสอบได้ ไม่ได้ย้อนลบ action ที่ commit ไปแล้ว ก่อน production ต้องทดสอบ race ด้วยสอง database sessions จริง และให้ทุกเส้นทางเปลี่ยนสิทธิใช้ protocol เดียวกัน การใส่ SELECT ตรวจสิทธิก่อน COMMIT โดยไม่ล็อกยังมีช่องว่างระหว่าง check กับ commit

### 16.4 Storage และการเข้าถึงรายงาน

ใช้ private buckets แยก purpose เช่น evidence-private, quarantine-private และ reports-private โดย storage.objects policies ตรวจ bucket+object path+document/version/intent ที่ได้รับสิทธิ ชื่อ path เป็นตำแหน่งไฟล์ ไม่ใช่หลักฐานว่าเจ้าของ path ได้สิทธิทั้งองค์กร [Supabase: Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

เส้นทางดาวน์โหลดที่ต้องรองรับ BR-18 อย่างเข้มงวดคือ authenticated gateway หรือ Storage request ที่ตรวจ user JWT/RLS กับ current grant ทุก request สำหรับ signed URL ผู้ครอบครอง URL ใช้ได้จนหมดอายุ จึงใช้ short TTL เพื่อลดช่วงเปิดเผยได้ แต่ไม่ถือว่าเพิกถอนทันทีเมื่อเปลี่ยนสิทธิ หากนโยบายต้องถอนทันทีห้ามใช้ signed URL เป็นเส้นทางหลักของเอกสารจำกัดสิทธิ [Supabase: createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)

สิ่งที่ดาวน์โหลดออกไปแล้วเรียกคืนไม่ได้ และ request ที่ส่ง bytes ไปแล้วอาจไม่หยุดทันทีเมื่อ revoke ขอบเขตที่รับรองคือการตรวจสิทธิ ณ จุดอนุมัติ request ใหม่และการไม่ออกสิทธิดาวน์โหลดใหม่หลังถอน สำเนา export ต้องมี classification/ผู้สร้าง/cutoff และจัดการตามนโยบายองค์กร

ก่อนเปิด snapshot ต้องตรวจ current rights ครบทั้ง source manifest หากสิทธิหายบางส่วนให้ปฏิเสธไฟล์เดิมหรือสร้าง snapshot ใหม่ที่กรองแล้วพร้อม ID/label ใหม่ ห้ามตัดบางแถวออกจากไฟล์เดิมแล้วใช้ชื่อ ตัวเลข และ checksum ของรายงานเดิม

### 16.5 ขอบเขตคำรับรองด้าน audit

append-only triggers/privileges ป้องกันผู้ใช้แอปแก้ประวัติ แต่ไม่ทำให้ฐานข้อมูลต้านผู้ดูแลฐานข้อมูลระดับสูงได้โดยสมบูรณ์ หากองค์กรต้องการหลักฐานที่แก้ย้อนหลังไม่ได้โดย operator ต้องเพิ่ม external append-only log/การลงนามหรือการเก็บ digest นอกฐานข้อมูลตามนโยบาย ไม่อ้างว่า audit table ธรรมดาให้คุณสมบัตินั้นแล้ว

<a id="implementation"></a>
## 17. การเชื่อม UI และลำดับ migrations

### 17.1 เปลี่ยนจาก mock อย่างไร

| สิ่งที่มีในเว็บปัจจุบัน | โมเดลปลายทาง | ข้อควรทำเมื่อเริ่ม backend |
|---|---|---|
| DemoState ใน localStorage | relational entities + authorized read DTO | คง UI demo mode แยกจาก connected mode; ไม่นำ state ของ browser มาเป็นข้อมูลจริงโดยอัตโนมัติ |
| Resolution object เดียว | resolutions + resolution_versions + resolution_cycles | แสดงรหัสถาวร แต่ route/action ส่ง cycle_id และ row_version ด้วย |
| Task object เดียว | tasks + task_cycles + spec/assignments/deadlines | แยกสถานะ, เวลา, blocker, authorization; ไม่ทำ object replacement ทั้งแถว |
| ownerId/reviewerId | assignment rows + profile summaries | ผู้โอนมีผลวันใดและเจ้าของรับทราบรอบใดต้องแสดงได้ |
| dueDate และค่าคำนวณบนเครื่อง | deadline versions + due_kind + server resolver | ส่งวันอย่างเดียวเป็น YYYY-MM-DD ห้าม JavaScript แปลงเป็น UTC midnight โดยไม่มี semantics |
| evidence metadata ใน demo | upload intent + document_versions + private bytes | mock filename ไม่ใช่ไฟล์ที่อัปโหลดแล้ว; แสดง upload/scan/finalize states จริง |
| submission/review ล่าสุด | attempts + frozen snapshot + criterion results | แสดงทั้งประวัติและชุดปัจจุบัน; ไม่ทับผลคืนแก้เดิม |
| สลับ role เพื่อสาธิต | Auth session + multiple scoped grants | role switch demo ไม่ให้สิทธิใน connected mode |
| Dashboard counts และ CSV | current worklist / report snapshot | KPI ทางการใช้สูตรรุ่นและ cohort เดียวกับ drill-down/export |
| วันที่จำลองและชุด seed | server time + test fixtures | seed เฉพาะ dev/test พร้อม organization แยก ห้ามนำชื่อ/เหตุการณ์สมมติเป็นข้อมูล production |

แนวทางชั้นข้อมูล: Next.js App Router ทำ server-side read orchestration, UI รับ DTO ที่มีเฉพาะข้อมูลได้รับสิทธิ, domain commands เรียก transactional RPC, Storage ใช้ upload/download flow ที่ตรวจสิทธิ การ map snake_case ↔ TypeScript camelCase อยู่ใน data adapter ไม่กระจายเงื่อนไขธุรกิจไปแต่ละ component

สร้าง TypeScript types จาก schema ที่ migrate จริงเมื่อเริ่ม backend แล้วค่อยปรับ types.ts ให้มี DTO แยก ไม่แก้ type ให้ตรงเอกสารอย่างเดียวโดยไม่มีฐานข้อมูลรองรับ ข้อจำกัด frontend ที่ workflow.ts ใช้เพื่อ demo ไม่ใช่ validation แหล่งสุดท้าย

### 17.2 ลำดับ migrations ที่เสนอ

| ขั้น | ผลส่งมอบ | ต้องผ่านก่อนขั้นถัดไป |
|---|---|---|
| M01 Foundation | schemas, extensions ที่จำเป็น, organizations/profiles/auth bindings, audit, authorization guard, common types | ไม่มี default public grants ที่เปิดกว้าง; tenant FK conventions พร้อม |
| M02 Identity/permissions | units, committees/terms/memberships, roles/permissions/grants/restrictions | RLS matrix และ least privilege ทดสอบทั้ง allow/deny |
| M03 Core records | meetings/agendas/minutes, documents, resolutions/versions/cycles | reference ownership, version immutability, origin/follow-up ไม่เพิ่มมติซ้ำ |
| M04 Task execution | tasks/cycles/spec/criteria/assignments/deadlines/dependencies/progress/reporting | publish/start/ack/transfer และ time invariants |
| M05 Review/closure/changes | submissions/evidence/reviews, requests/proposals/decisions, closure | self-review, frozen version, closure races และ reopen |
| M06 Temporal/reporting | typed history, metric versions, reports/cohorts/manifest | as-of/restatement และ KPI golden dataset |
| M07 Supporting MVP | recurrence manual plans/occurrences, notifications/outbox, import preview/apply | dedupe, planning gaps, retry, row-level import errors |
| M08 Operations | retention/holds, object backup, job monitoring, optional automated recurrence | restore exercise, authorization recheck, approved settings |

มี circular references เช่น task_cycles.current_spec_version_id ↔ task_spec_versions.task_cycle_id จึงสร้างตารางที่ pointer nullable ก่อน เพิ่ม FK หลังตารางทั้งสองมีแล้ว และใช้ transaction/deferred constraint ในการตั้งชุดแรก ไม่ปิด constraints ทั้งระบบเพื่อ import ความสมบูรณ์บังคับที่ publish แทนการทำให้ draft สร้างไม่ได้

แต่ละ migration มี forward path และวิธีกู้คืนที่ไม่ลบประวัติ ใช้ expand → backfill แบบตรวจสอบได้ → validate → switch reads → retire old fields เมื่อจำเป็น การ migrate schema ไม่เท่ากับอนุมัติ policy; fixture policy ต้องติดป้ายสำหรับทดสอบ

### 17.3 ปริมาณและ performance budget

ใช้ envelope จาก PRD เป็นสมมติฐานทดสอบเริ่มต้น: ผู้ใช้ลงทะเบียน 300 คน พร้อมกัน 50 คน, มติ 2,000 รายการ, task cycles 10,000, progress records 50,000, ไฟล์ไม่เกิน 20 MB/20 ไฟล์ต่อชุดตาม policy ที่เสนอ และ export 5,000 แถว ต้องยืนยัน Q-06/Q-09 ก่อนใช้คำนวณค่าใช้จ่ายจริง

วัด list P95 ≤2 วินาที, detail P95 ≤3 วินาที, export ≤60 วินาทีตามเป้าหมายเสนอใน PRD โดยรวม RLS/permission helper และจำนวน evidence/history ที่สมจริง ใช้ asynchronous export เมื่อจำเป็น อย่าอนุมานว่า index ตามเอกสารนี้ทำให้ผ่าน SLA โดยยังไม่ได้ EXPLAIN ANALYZE และ load test

<a id="testing"></a>
## 18. แผนทดสอบฐานข้อมูล

รายการนี้เป็น acceptance plan สำหรับขั้น implement ไม่ใช่ผลทดสอบฐานข้อมูลที่รันแล้ว ใช้ integration tests บน Supabase local/test project พร้อม SQL roles จริง, storage fixtures และ concurrency อย่างน้อยสอง sessions ไม่ทดสอบสิทธิด้วย service_role เพียง role เดียว

| รหัส | สถานการณ์ | ผลที่ต้องได้ |
|---|---|---|
| DB-01 | ผู้ใช้ไม่มี membership/หมดอายุ/ถูก suspend | อ่านและ mutate ไม่ได้ รวม direct Data API/RPC |
| DB-02 | ประกอบ child จาก organization A กับ parent B | composite FK ปฏิเสธ แม้ใช้ privileged worker ผิดพลาด |
| DB-03 | owner อ่านงานตนและขอ sibling/ไฟล์ลับของมติ | อ่านเฉพาะ authorized task/context; ไม่มีข้อมูลรั่วผ่าน count/search/snippet |
| DB-04 | technical admin ไม่มี business grant ตรวจรับ/ปิดมติ | ปฏิเสธ; role ชื่อ admin ไม่เพียงพอ |
| DB-05 | owner เก่าหรือ output contributor ย้ายไป reviewer | SELF_REVIEW_NOT_ALLOWED; administrative support ที่แยกชัดไม่ถูกเหมารวม |
| DB-06 | publish ขาด owner/reviewer/spec/criteria/evidence requirement/กำหนดหรือแผนรายงาน | reject ราย field; draft ยังบันทึกได้; ไม่มี publication fact ปลอม |
| DB-07 | minutes certified แต่ execution ยังไม่อนุญาต/ถูก suspend | start/submit/review ถูกปฏิเสธตาม authority state |
| DB-08 | dependency ยังไม่ accepted, ยุติ หรือพยายามสร้างวงจรพร้อมกัน | เริ่มไม่ได้; graph mutation ไม่สร้าง cycle |
| DB-09 | progress 100 แล้วขอปิดโดยไม่มี review | ยังไม่ accepted และปิดไม่ได้ |
| DB-10 | submit พร้อมกัน/กดซ้ำหลัง timeout | pending attempt เดียว; idempotency key เดิมได้ผลเดิม |
| DB-11 | ส่งชุดเดิมแล้วเพิ่มไฟล์/เปลี่ยน criteria | ชุดส่งเดิมเปิดไฟล์/เกณฑ์รุ่นเดิม; policy การเปลี่ยนเกณฑ์ระบุชัด |
| DB-12 | review พร้อมกันหรือ review แข่ง terminate | เกิด decision ที่สอดคล้องหนึ่งลำดับ ไม่มี accepted+cancelled |
| DB-13 | ครั้งแรกส่งทันแต่คืนแก้ ครั้งสองส่งช้าแล้วผ่าน | KPI-03 ใช้เวลาครั้งสอง |
| DB-14 | required 2/3 ผ่าน หรือหนึ่งงาน cancelled | ปิดมติไม่ได้จน scope ที่ถูกต้อง/งานและเกณฑ์ครบ |
| DB-15 | close แข่งเพิ่ม required task หรือย้าย primary authority | checklist ไม่พลาดแถวที่แทรก; snapshot เก่าไม่ใช้ผ่านโดยเงียบ |
| DB-16 | optional task ยังทำต่อหลังปิด | มี authority/disposition ชัด; งานค้างยังถูกติดตาม ไม่กำพร้า |
| DB-17 | deadline request pending/rejected และ approve สองคำขอฐานเดียวกัน | pending ไม่เปลี่ยน dT; conflict เป็น stale; d0 คงเดิม |
| DB-18 | อนุมัติขยายหลัง T หรือ future-effective | รายงานก่อน T คงเดิม; ก่อนวันมีผลยังใช้กำหนดเดิม |
| DB-19 | initially no deadline แล้วตั้งครั้งแรก | d0 เกิดเมื่อมีการตั้งจริง; ไม่เพิ่มเข้า deadline cohort ก่อนหน้านั้น |
| DB-20 | due date วันสุดท้ายเดือน/instant เท่ากำหนด | วันอยู่ cohort เดือนถูกต้อง; equality ของ instant ถือว่าทัน |
| DB-21 | โอน owner ที่ยังไม่ ack แล้วปิดบัญชีเดิม | assignment เดิมหยุดอายุเมื่อถูกแทน; คนใหม่มี ack window ใหม่; due/progress/history ไม่รีเซ็ต |
| DB-22 | accepted task เปิดใหม่หรือ closed resolution เปิดใหม่ | ID ถาวรเดิม cycle ใหม่; ผลเก่าคงอยู่; รอบใหม่ไม่ accepted อัตโนมัติ |
| DB-23 | recurrence เปลี่ยน version/สร้างรอบเดิมซ้ำ | unique occurrence/slot กันงานซ้ำ; รอบขาดแสดง planning gap; parent ไม่ปิดเอง |
| DB-24 | report draft/รายงานไม่ครบ/รายงานครบช้า | KPI-09 ใช้ first validated complete; ไม่มีแผนไม่เดาตัวหาร |
| DB-25 | เปลี่ยนปฏิทิน policy และสูตรหลัง snapshot | snapshot และ pinned SLA เก่าคงเดิม; รุ่นใหม่ใช้กับเหตุการณ์ใหม่ |
| DB-26 | import ข้อมูลเก่าย้อน T หรือ correction owner/unit/status | as-known report ไม่เห็นข้อมูลก่อนทราบ; restatement ID ใหม่มี reason |
| DB-27 | chart/drill-down/export และ denominator=0 | ชุดข้อมูล/ตัวเลขตรงกัน; ไม่มีรายการไม่แสดง 0% หรือ 100% เทียม |
| DB-28 | revoke สิทธิแข่ง mutation/download/finalize upload | ลำดับ commit ตาม guard protocol; request ใหม่หลังถอนเข้าไม่ได้ |
| DB-29 | เปิด report เก่าหลังเสีย scope บางรายการ | deny ทั้ง original artifact หรือสร้าง filtered snapshot ใหม่ ไม่เปลี่ยนตัวเลขเก่า |
| DB-30 | notification retry/worker crash/owner เปลี่ยน | business event ไม่หาย; ไม่ส่งผิดคน; delivery ไม่ทำให้ ack เอง |
| DB-31 | import batch/row เดิมซ้ำและ rollback หลังใช้อ้างอิง | ไม่เกิดข้อมูลซ้ำ; rollback destructive ถูกปฏิเสธ; ใช้ correction |
| DB-32 | ไฟล์เกินขนาด MIME ไม่ตรง scan error หรือ object overwrite | ไม่ finalize/submit; metadata และ checksum ไม่อ้างไฟล์ที่ยังไม่ตรวจ |
| DB-33 | CSV/XLSX มีข้อความขึ้นต้น = + - @ หรือ control chars | export renderer neutralize สูตรตามชนิด cell; ข้อมูลต้นฉบับยังคงค่าเดิม |
| DB-34 | purge ไฟล์ติด hold/ถูกอ้าง/ยังไม่พ้น policy | reject; เมื่อ purge ได้มี tombstone+audit; ไม่ลบ FK ประวัติ |
| DB-35 | restore database+Storage ใน test environment | counts/version/checksum/สิทธิตรง backup; บันทึก RPO/RTO จริง |
| DB-36 | load ภายใต้ envelope และ RLS scopes ต่างกัน | วัด P95/export/lock contention; ไม่สูญธุรกรรมหรือเปิดข้อมูลข้ามผู้ใช้ |

ชุดข้อมูล KPI อ้างตัวอย่าง UAT-24: กำหนดเดิม 20 cycles รับรองทัน 14 แม้บางงานย้ายไปเดือนหน้า KPI-01 ยังเป็น 14/20 และรายงานแสดง moved-out แยก เพิ่ม fixtures ที่แยก acceptance time จาก submission time, cancelled denominator, pending first review, superseded assignment และ reporting plan version เพื่อทดสอบสูตรจริง ไม่เขียน tests ที่เพียงทำซ้ำโค้ดคำนวณเดียวกัน

<a id="traceability"></a>
## 19. การเชื่อมโยงข้อกำหนดและคำถามค้าง

### 19.1 Functional requirements

| PRD | กลุ่มตาราง/กระบวนการ | ส่วนเอกสาร |
|---|---|---|
| FR-01 ผู้ใช้/สิทธิ | profiles, memberships, roles, grants, restrictions, authorization_guards | §5, §16 |
| FR-02 ประชุม/รายงาน | committees, terms, meetings, agenda_items, minutes_versions/decisions | §6 |
| FR-03 ทะเบียนมติ | resolutions, versions, criteria, cycles | §6 |
| FR-04 อนุญาตเริ่ม | start_authorization_events, start_conditions | §6, §15 |
| FR-05 งาน/มอบหมาย | tasks/cycles/specs, assignments, cycle links, dependencies | §7 |
| FR-06 รับทราบ/งานฉัน | owner_assignments, assignment history, authorized read models | §7, §12 |
| FR-07 ความก้าวหน้า/อุปสรรค | progress reports/versions, reporting plans/occurrences, blockers | §7 |
| FR-08 หลักฐาน | documents/versions, upload/scan, evidence links | §8, §16 |
| FR-09 ส่งผลงาน | submissions, participants, evidence, requirement links | §8 |
| FR-10 ตรวจรับ | reviews, criterion results, no-self-review guards | §8, §15 |
| FR-11 ปิดมติ | closure requests/snapshots/results/dispositions/decisions | §9 |
| FR-12 เปลี่ยนแปลง | change requests, typed proposals, decisions, deadline/spec/assignment versions | §9–10 |
| FR-13 ยุติ/ทดแทน/เปิดใหม่ | resolution relations, dispositions, previous cycle links, lifecycle proposals | §6, §9 |
| FR-14 งานต่อเนื่อง | recurrence plans/versions/occurrences/task links | §10 |
| FR-15 สืบเนื่อง/อ้างอิง | agenda_resolution_links, external_references, source identifiers | §6, §13 |
| FR-16 แจ้งเตือน | rules/preferences, outbox, notifications/deliveries/attempts | §11 |
| FR-17 ค้นหา | authorized search, indexes, scope filters | §12, §14, §16 |
| FR-18 Dashboard/KPI | state revisions, metric versions, cohort resolver | §12 |
| FR-19 รายงาน/export | report runs/snapshots/results/cohorts/manifest/artifacts | §12, §16 |
| FR-20 Audit | audit_events, immutable decisions/version provenance | §11–12, §16 |
| FR-21 นำเข้า | batches/rows/source identifiers/provenance/exceptions/application items | §13 |
| FR-22 ตั้งค่า/ปฏิบัติการ | policy/calendar versions, jobs, retention/hold, backup exercises | §10–11, §13 |

### 19.2 Business rules

| BR | จุดบังคับ |
|---|---|
| BR-01 | unique resolution code และ follow-up link ไม่สร้างมติซ้ำ |
| BR-02 | owner range exclusion และ publish guard ให้มีหนึ่งคน |
| BR-03 | publication validation + immutable task_publication_facts |
| BR-04 | progress projection แยก accepted review/closure |
| BR-05 | minutes กับ start authorization แยกตาราง/สิทธิ |
| BR-06 | d0/dT/proposed แยก references และ temporal resolver |
| BR-07 | frozen spec/evidence/participants ใน submission |
| BR-08 | closure lock+required cycle checklist+resolution criteria |
| BR-09 | cancelled required ไม่ผ่าน; scope change มีคำตัดสิน |
| BR-10 | acknowledgment-only ไม่เข้าฐาน actionable task/resolution |
| BR-11 | termination ไม่เป็น success และเก็บ gross cohort |
| BR-12 | transfer สร้าง assignment ใหม่ ไม่ reset deadlines/history |
| BR-13 | reopen เป็น cycle ใหม่ พร้อม previous pointer |
| BR-14 | technical admin ไม่มี business authority; historical participation กันตรวจตนเอง |
| BR-15 | snapshot มี T/K/filters/unit/formula/calendar/provenance |
| BR-16 | assigned, delivery, read, acknowledged เป็นคนละ fact |
| BR-17 | recurring parent ไม่ปิดเมื่อ occurrence ผ่านหนึ่งรอบ |
| BR-18 | current permissions, transaction guard, private request-based file/report access |

### 19.3 Non-functional requirements

NFR-01–NFR-14 ของ PRD ต้องประเมินร่วมทั้งฐานข้อมูลและ application แบบนี้รองรับ integrity ด้วย constraints/RPC, confidentiality ด้วย RLS/private files, audit/history/versioning, backup/restore, performance indexes/pagination และ observability ของ jobs ส่วน accessibility, responsive UI, ความเข้าใจข้อความ และการใช้คีย์บอร์ดเป็นความรับผิดชอบ UI ที่ schema เพียงอย่างเดียวทำให้ผ่านไม่ได้ ต้องทดสอบ UAT-31 และ NFR ที่เกี่ยวข้องต่อไป

| NFR | สิ่งที่แบบนี้รองรับ / งานที่ต้องทำร่วม |
|---|---|
| NFR-01 สิทธิ | §16 และ DB-01–05/28–29; negative tests รวม API, search, count, files และ exports |
| NFR-02 ธุรกรรม | §14–15; unique/exclusion, row locks, idempotency, transactional history/audit/outbox |
| NFR-03 ประสิทธิภาพ | §14.3/17.3; index/RLS query plans และ load test ก่อนรับรอง P95 |
| NFR-04 งานเบื้องหลัง | jobs, leases, retry, report_runs/artifacts; export 5,000 แถวตามเป้าหมายเสนอ |
| NFR-05 Accessibility | DTO/error codes ชัดเจนช่วย UI แสดง field errors; WCAG 2.2 AA ต้องทดสอบฝั่ง UI แยก |
| NFR-06 มือถือ/ภาษาไทย | Unicode, date/time semantics, keyset pagination และ safe exports; responsive 360/768/1280 เป็น UI test |
| NFR-07 Availability | ต้องตั้ง monitoring/maintenance window และวัด uptime ตามช่วงบริการที่ตกลง; 99.5% เป็นเป้าหมายเสนอ ไม่ได้รับรองจาก schema |
| NFR-08 Backup/restore | §13.2; สำรอง DB และ object bytes พร้อม manifest และ restore exercise จริง |
| NFR-09 บัญชี/การส่งข้อมูล | Auth/current grants, secrets ฝั่ง server, redacted logs; deployment ต้องบังคับ TLS และตั้ง session/rate limit ตามนโยบาย |
| NFR-10 ไฟล์ | single-write object, content/MIME/size validation, scan quarantine, authenticated download; renderer ป้องกัน spreadsheet formula injection |
| NFR-11 เฝ้าระวัง | trace_id เชื่อม audit/jobs/deliveries/reports, outcome/error codes, alert ผู้ดูแล; ไม่มีเนื้อหาลับใน telemetry |
| NFR-12 Retention | policy versions/holds/disposition approvals; ยืนยันอายุเก็บทุก record class รวม audit และ backup ก่อนเปิด purge |
| NFR-13 ประวัติ | §12; valid/known histories, formula versions, manifests, immutable snapshots และ late-data/restatement tests |
| NFR-14 ส่งมอบ | data dictionary/permission matrix/migration order ในเอกสารนี้; ขั้น implement ต้องเพิ่มคู่มือผู้ใช้ตามบทบาทและ runbook deploy/rollback/restore |

### 19.4 เรื่องที่ยังต้องยืนยันก่อนใช้จริง

| Q | การตัดสินใจที่ต้องได้ | ส่วนของแบบที่จะได้รับผล |
|---|---|---|
| Q-01 | ใครเป็นเจ้าของผลิตภัณฑ์/ผู้มีอำนาจแต่ละกิจกรรม | role versions, approval permissions, authority evidence |
| Q-02 | การยืนยันถ้อยคำมติและเวลา/เงื่อนไขเริ่มที่ยอมรับ | resolution versions, start authorization, meeting-relative due |
| Q-03 | ผู้ตรวจหนึ่งหรือหลายคน การแทนผู้ตรวจ และ separation of duties | reviewer assignments, review decisions, no-self-review rules |
| Q-04 | login/SSO และการให้สิทธิข้ามหน่วยงาน/คณะกรรมการ | auth bindings, memberships, grants; SSO ภายหลังไม่เปลี่ยน profile ID |
| Q-05 | ช่องทางเตือน SLA escalation quiet hours | policy/rule versions, delivery adapters; MVP in-app |
| Q-06 | ชนิด/ขนาดไฟล์ classification scan retention และ backup | document policy, storage gates, holds/disposition |
| Q-07 | cohort, cancelled gross/net, owner attribution, ปฏิทิน | metric definitions, snapshots, calendar pinning |
| Q-08 | รูปแบบและตัวอย่างรายงาน CSV/XLSX/PDF/Word | artifact format/renderer; ถ้าต้อง Word เพิ่ม docx ไม่เปลี่ยน facts |
| Q-09 | ปริมาณใช้งาน/ช่วงบริการ/latency จริง | indexes, resource sizing, queue/partition choices |
| Q-10 | ถอนชุดส่ง ส่งแทน งาน optional ค้าง dependency ข้ามมติ และ reopen | workflow permissions/guards; ไม่เปิดข้อยกเว้นเพียงเพราะ schema รองรับ |
| Q-11 | Supabase region/plan/ทีมดูแล/งบ/RPO/RTO | deployment/backup/operations; stack เลือกแล้วแต่ข้ออื่นยังค้าง |
| Q-12 | ข้อมูลเดิม/ผู้รับรอง/cutover | import mappings/exceptions/provenance และการเลิกข้อมูลคู่ขนาน |
| Q-13 | รอบ recurring/งานในแต่ละรอบ/เว้นรอบ/เลิกแผน | recurrence version/slots/occurrences; automation ระยะถัดไป |
| Q-14 | SSO/e-Doc/Hub/AI ที่ต้องเชื่อมจริง | external identifiers/adapters; ไม่ให้ AI สร้างคำอนุมัติแทนผู้มีอำนาจ |
| Q-15 | baseline และวิธีวัดผล R2R | metrics/baseline collection; ไม่อ้างผลลดเวลาจากข้อมูล demo |

บันทึกผลยืนยันเป็น decision record ที่ระบุ Q, ผู้รับรอง, วันที่, เหตุผล, PRD/schema/metric version ที่ได้รับผล ไม่เก็บเพียงข้อความใน chat เมื่อเปลี่ยนนโยบายหลังมีข้อมูล ให้เพิ่มรุ่นและกำหนดวันมีผล ไม่แก้ประวัติเดิมให้ดูเหมือนใช้นโยบายใหม่นั้นมาตลอด

<a id="references"></a>
## 20. เอกสารเทคนิคอ้างอิง

เอกสารภายในที่ใช้วิเคราะห์คือ PRD และโค้ด UI ใน workspace ณ วันที่จัดทำ แหล่งเทคนิคด้านล่างใช้ตรวจข้อจำกัดของแพลตฟอร์ม ไม่ได้แปลว่าตั้งค่าในโครงการนี้แล้ว:

- [PRD — requirements, business rules, KPI และ UAT](PRD.md)
- [README — ขอบเขต UI และวิธีรัน](README.md)
- [UI types](src/lib/types.ts) และ [workflow จำลอง](src/lib/workflow.ts)
- [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Managing user data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase: Database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase: Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: Signed URL API](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
- [Supabase: Backups](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL: Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL: Row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL: Date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [PostgreSQL: Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL: Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

เอกสารนี้เป็นแบบฐานข้อมูลเป้าหมาย ส่วน implementation และผลทดสอบระยะแรกติดตามใน [supabase/README.md](supabase/README.md) การผ่าน tests ของบางโมดูลไม่ได้ถือเป็นการผ่านแผนทดสอบทั้งหมดใน §18

