# Supabase: ชุดเชื่อมต่อเว็บระยะแรก

โฟลเดอร์นี้ใช้ [database.md](../database.md) เป็นแบบเป้าหมาย โดยทำเส้นทางที่หน้าจอปัจจุบันใช้งานจริงก่อน เก็บข้อมูลธุรกิจเป็นตารางสัมพันธ์ ไม่มีการเก็บ DemoState ทั้งก้อนลงฐานข้อมูล และไม่มีการนำข้อมูล demo/localStorage ไปสร้างเป็นข้อมูลจริงโดยอัตโนมัติ

## เตรียม Supabase project เมื่อพร้อมใส่ keys

1. สร้าง Supabase project และเก็บ Project URL กับ publishable key ตาม `.env.example` ที่ root ไม่ต้องนำ secret/service-role key ไปใส่ browser
2. ใน SQL Editor ของ project ใหม่ คัดลอกเนื้อหาทั้งหมดจาก [install.sql](install.sql) แล้วกด Run **ครั้งเดียว** ไฟล์นี้รวม migrations 001–005 ทั้ง 5 ไฟล์ตามลำดับไว้แล้ว จึงไม่ต้องรันไฟล์แยกซ้ำ หากใช้ Supabase CLI ให้เลือกใช้ `migrations/` กับ migration workflow ของ CLI แทน ไม่รันซ้ำสองวิธี
3. สร้างผู้ใช้จริงใน Authentication → Users และตั้งวิธี login/password ตามหน้าเข้าสู่ระบบของเว็บ บัญชี Auth เพียงอย่างเดียวยังเข้า workspace ไม่ได้
4. คัดลอก [bootstrap.example.sql](bootstrap.example.sql) ไปแก้ UUID จริง แล้วรันเฉพาะคำสั่งที่ต้องการผ่าน SQL Editor เพื่อสร้างองค์กร หน่วยงาน และให้บทบาทอย่างชัดเจน ห้ามรัน placeholders โดยไม่แก้
5. ตั้ง Admin ของแอปคนแรกอย่างชัดเจนด้วย [setup-admin.sql](setup-admin.sql): ใส่อีเมล Auth และ UUID องค์กรที่มีอยู่แล้ว บัญชีต้องมี identity/profile และ membership ที่ยังใช้งานได้ จากนั้นให้ Admin เปิด `/team` เพื่อกำหนดบทบาทแอปและหน้าที่แต่ละบทบาทใช้ได้ User และ Executive เริ่มต้นโดยยังไม่มีหน้าที่เปิดให้ใช้ ผู้ทำกับผู้ตรวจงานเดียวกันต้องเป็นคนละคน และผู้ยื่นคำขออนุมัติคำขอตนเองไม่ได้
6. ใส่ environment ตามคู่มือ root แล้วเริ่ม Next.js ใหม่ เข้าสู่ระบบด้วยบัญชีที่ได้รับ membership บัญชีเดียวมีหลายองค์กรได้ แต่ UI ระยะแรกเปิดองค์กรที่มี membership เก่าที่สุดโดยค่าเริ่มต้น; API รับ organization ID สำหรับเลือกขอบเขต
7. ทดสอบครบเส้นทาง: เลขานุการสร้างประชุม/มติ → ผู้มีอำนาจอนุญาตเริ่ม → เลขานุการมอบหมาย → เจ้าของรับทราบ/เริ่ม/รายงาน/เพิ่มลิงก์หลักฐาน/ส่งตรวจ → ผู้ตรวจคืนแก้หรือรับรอง → ผู้มีอำนาจปิดมติ

| Migration | หน้าที่ |
|---|---|
| [202610250001_core.sql](migrations/202610250001_core.sql) | ตารางหลัก, tenant FKs, unique/check constraints, RLS และปิด direct client grants |
| [202610250002_access.sql](migrations/202610250002_access.sql) | Permission templates, current identity/assignment checks, immutable triggers, guard locks และ private provisioning |
| [202610250003_workspace_read.sql](migrations/202610250003_workspace_read.sql) | อ่านข้อมูลที่ผู้ใช้มีสิทธิแล้วแปลงเป็น DTO ของ UI |
| [202610250004_commands.sql](migrations/202610250004_commands.sql) | Transactional commands, row-version conflicts, idempotency, submissions/reviews/changes/closure |
| [202610250005_role_access.sql](migrations/202610250005_role_access.sql) | บทบาทแอป 4 แบบ, page policies, ขอบเขต Staff, คำสั่งจัดการสิทธิ์ และ explicit Admin bootstrap |

Migrations นี้เป็นฐานเริ่มต้นสำหรับ project ใหม่ ถ้า project มีตารางชื่อเดียวกันหรือข้อมูลจริงอยู่แล้ว ต้องตรวจและเขียน migration ผสานก่อน ไม่ใช้ DROP TABLE เพื่อทำให้รันผ่าน

**Project ที่ติดตั้ง 001–004 แล้ว:** รันเฉพาะ [upgrade-role-access.sql](upgrade-role-access.sql) ครั้งเดียว ไฟล์นี้ตรงกับ migration 005 ทุกไบต์และรักษาข้อมูลเดิม ไม่รัน `install.sql` หรือ 001–004 ซ้ำ หากใช้ CLI ให้ apply migration 005 ผ่าน workflow เดิมแทน อย่ารันทั้ง upgrade script และ migration เดียวกันซ้ำ

`install.sql` เก็บ transaction ของแต่ละ migration ไว้แยกกัน หากพบข้อผิดพลาดในช่วงท้าย ส่วนก่อนหน้าอาจติดตั้งสำเร็จแล้ว ให้ตรวจผลและแก้จากจุดที่ล้มเหลว ไม่รันทั้งไฟล์ซ้ำทันที ไฟล์นี้ไม่สร้างบัญชี Auth หรือ membership ให้ ต้องทำข้อ 3–5 ต่อด้วยข้อมูลจริง

หลังติดตั้ง ตรวจใน SQL Editor ว่าฟังก์ชันหลักทั้งสองมีอยู่ โดยผลทั้งสองคอลัมน์ต้องไม่เป็น `null`:

```sql
select
  to_regprocedure('public.get_workspace_state(uuid)') as read_rpc,
  to_regprocedure('public.workspace_command(uuid,text,jsonb,uuid)') as write_rpc;
```

จากนั้นเข้าสู่เว็บด้วยบัญชีที่ตั้ง membership แล้วจึงทดสอบอ่านและบันทึกข้อมูล การตอบกลับจาก Auth health เพียงอย่างเดียวยืนยันได้เฉพาะว่า Project URL และ public key ติดต่อบริการได้ ไม่ได้ยืนยันว่าฐานข้อมูลและสิทธิ์ติดตั้งครบ

## เมื่อเว็บแสดง “รอรับสิทธิ์เข้าพื้นที่ทำงาน”

ข้อความนี้ตรงกับ `NO_MEMBERSHIP`: เว็บตรวจบัญชีผ่าน Auth แล้ว แต่ยังไม่พบ profile ที่เปิดใช้งาน สมาชิกองค์กรที่ยังมีผล หรือบทบาทที่ยังมีผลในองค์กรที่เลือก การสร้างบัญชีใน Authentication อย่างเดียวไม่มอบสิทธิ์เลขานุการให้โดยอัตโนมัติ

สำหรับเลขานุการที่ผู้ดูแลอนุมัติแล้ว ให้เปิด [setup-secretary.sql](setup-secretary.sql) แก้ `target_email` เป็นอีเมลที่ใช้เข้าสู่เว็บ แล้วรันทั้งไฟล์ใน SQL Editor ของ Supabase project เดียวกับเว็บ หลังติดตั้ง migrations ครบแล้ว ไฟล์นี้ใช้สิทธิ์ผู้ดูแลฐานข้อมูล ไม่ใช้ API Key และไม่ทำงานผ่าน browser client ของแอป

ไฟล์ `setup-secretary.sql` เป็นแม่แบบ ส่วน `setup-secretary.local.sql` (ถ้ามี) เป็นฉบับที่ใส่อีเมลไว้แล้วและถูกกันออกจาก Git หากพบ `REPLACE_YOUR_LOGIN_EMAIL` จากฉบับเก่า หรือ `TARGET_EMAIL_REQUIRED` ให้ตรวจบรรทัด `target_email text := '…';` ว่าใส่อีเมลจริง แล้ววางสคริปต์ใหม่ทั้งไฟล์ใน SQL Editor โดยไม่เลือกเฉพาะบางบรรทัด ข้อผิดพลาดนี้เกิดก่อนสร้างองค์กรหรือมอบบทบาท

- ถ้ายังไม่มีองค์กรเลย จะสร้างองค์กรแรกและผูกบัญชีเป็นเลขานุการ
- ถ้ามีองค์กรเดียว จะใช้องค์กรนั้น ถ้ามีหลายองค์กรต้องใส่ UUID ที่ต้องการใน `target_organization_id` ก่อน
- ถ้าเป็นเลขานุการที่ยังมีสิทธิ์อยู่แล้ว จะคงสิทธิ์เดิมไว้ การรันซ้ำไม่สร้างองค์กรหรือสิทธิ์เลขานุการซ้ำ
- ถ้าพบการปิดบัญชี ระงับ/ถอนสมาชิก หรือประวัติสิทธิ์เลขานุการที่ยังไม่เริ่มหรือหมดอายุ จะหยุดให้ผู้ดูแลตรวจ ไม่เปิดสิทธิ์เหล่านั้นกลับเอง
- หลัง migration 005 สิทธิ์เลขานุการเดิมถูกตีความเป็นบทบาทแอป User ไม่ใช่ Admin; ต้องมี page policy ที่ Admin เลือกก่อนจึงใช้หน้าทะเบียน/มอบหมายงานได้ และไม่มีสิทธิ์อนุมัติเริ่มงานหรือปิดมติโดยอัตโนมัติ

บันทึก `organization_id` ที่ SQL ส่งกลับ หากตั้ง `NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID` บน Vercel ไว้ ค่าต้องตรงกับองค์กรนี้ หากแก้ environment บน Vercel ต้อง Redeploy เพื่อให้ค่าที่ฝังในเว็บเปลี่ยนด้วย กรณีใช้เพียงองค์กรเดียวสามารถเว้นตัวแปรนี้ว่างได้ หลังผูกสิทธิ์เสร็จกด “ลองโหลดอีกครั้ง” ในเว็บ ไม่ต้องรัน `install.sql` ซ้ำ

หากบัญชีเป็นสมาชิกหลายองค์กรและไม่ได้ตั้ง organization ID เว็บรุ่นนี้เลือกสมาชิกองค์กรที่เก่าที่สุดก่อนตรวจบทบาท ให้ระบุองค์กรที่ต้องการอย่างชัดเจน หากองค์กรแรกไม่มีบทบาทที่ยังมีผล แม้องค์กรอื่นจะมีสิทธิ์อยู่ก็ตาม

หากโหลด workspace ได้แต่ขึ้นว่ายังไม่มีหน้าที่ได้รับสิทธิ์ แสดงว่ามี membership/บทบาทแล้ว แต่ page policy ของ User หรือ Executive ยังว่าง ให้ Admin กำหนดหน้าที่ `/team` ไม่ต้องรัน setup-secretary หรือ install ซ้ำ

## บทบาทแอปและสิทธิ์รายหน้าในรุ่นปัจจุบัน

หนึ่งสมาชิกมีบทบาทแอปหลักหนึ่งค่าในแต่ละองค์กร บทบาทนี้เป็นขอบเขตสูงสุดของความสามารถ ส่วน page policy ระบุหน้าที่เปิดให้บทบาทนั้น หน้า `/team` ให้เฉพาะ Admin เปลี่ยนบทบาทของสมาชิกที่ยังใช้งานได้และกำหนด page policy; การเปิดหน้า Team ให้บทบาทอื่นไม่ได้ให้สิทธิ์จัดการสิทธิ์

| บทบาทแอป | หน้าที่เปิดโดยค่าเริ่มต้น | ขอบเขต |
|---|---|---|
| Admin | ทุกหน้า ปิดออกไม่ได้ | จัดการสิทธิ์และความสามารถธุรกิจที่ระบบมีอยู่ ยังต้องผ่านกฎ assignment, ห้ามตรวจผลงานตนเอง และห้ามอนุมัติคำขอตนเอง |
| User | ไม่มี (`[]`) จน Admin เลือก | เมื่อเปิดหน้าที่เกี่ยวข้อง สามารถจัดประชุม ร่างมติ มอบหมาย ทำงานที่ตนเป็นเจ้าของ และยื่นคำขอ ตาม capability ที่กำหนด |
| Executive | ไม่มี (`[]`) จน Admin เลือก | เมื่อเปิดหน้าที่เกี่ยวข้อง สามารถอนุญาตเริ่ม พิจารณาคำขอ ตรวจงานที่ได้รับมอบหมาย ปิดมติ และส่งออกรายงาน |
| Staff | งานของฉัน, คำขอเปลี่ยนแปลง, แจ้งเตือน | งานที่ตนเป็นเจ้าของ คำขอที่ตนยื่น แจ้งเตือนของตน และ directory ของตนเอง; Admin เลือกเพิ่มได้เฉพาะภาพรวม หรือปิดหน้าในกลุ่มนี้ |

Page keys คือ `dashboard`, `meetings`, `resolutions`, `tasks`, `reviews`, `changes`, `reports`, `team`, `settings`, `notifications` การเปิดหน้าไม่เพิ่ม capability ที่บทบาทไม่มี และ SQL ตรวจ page policy ซ้ำสำหรับทุก mutation จึงข้ามด้วย direct RPC ไม่ได้

Migration ไม่แต่งตั้ง Admin อัตโนมัติ: ถ้าไม่มี role override จะตีความ legacy `secretary` เป็น User, `executive` เป็น Executive, `owner`/`reviewer` เป็น Staff (ถ้ามีหลาย legacy grants ใช้ secretary ก่อน executive) การให้ reviewer grant แบบเก่าอย่างเดียวจึงไม่ให้สิทธิ์ตรวจในโมเดลใหม่ ต้องให้บทบาทแอปที่มี `submission.review` และเปิดหน้า Reviews ด้วย สมาชิกที่ไม่มี legacy grant จะโหลดไม่ได้จนมี role override ที่ Admin กำหนด

`roles` ใน DTO ยังใช้ชื่อ workflow เดิมเพื่อรองรับหน้าจอ: Admin → secretary/owner/reviewer/executive, User → secretary/owner, Executive → executive/reviewer, Staff → owner รายการนี้ไม่ใช่กลไกมอบสิทธิ์เพิ่มให้บัญชี; authorization ใช้บทบาทแอปและ page policy ปัจจุบัน

**Admin ของแอปต่างจากผู้ดูแลฐานข้อมูลทางเทคนิค** การใช้ SQL Editor หรือถือ service-role key ไม่ได้สร้างบทบาทแอปให้บัญชีเข้าสู่เว็บ ผู้ดูแลฐานข้อมูลต้องรัน `setup-admin.sql` โดยเลือกอีเมลและองค์กรอย่างชัดเจน สคริปต์ต้องพบสมาชิกที่ยังใช้งานได้ ไม่สร้างบัญชี Auth/องค์กร/สมาชิกใหม่ ไม่เปิดคืน identity หรือ membership ที่ถูกปิด และรันซ้ำกับ Admin เดิมโดยไม่เพิ่ม version หน้า `/team` ไม่สร้างบัญชี Auth และไม่เพิ่มสมาชิกใหม่ การสร้าง/ผูกบัญชียังคงผ่านขั้นตอน provisioning ที่ผู้ดูแลรับรอง

หากมี `setup-admin.local.sql` เป็นไฟล์ส่งมอบส่วนตัวที่ระบุอีเมลไว้แล้ว ไฟล์นี้ถูกกันออกจาก Git และเลือกองค์กรได้เมื่อบัญชีนั้นมี active membership เพียงองค์กรเดียว หากพบศูนย์หรือหลายองค์กรจะหยุดให้ใช้แม่แบบ `setup-admin.sql` ที่ระบุ UUID ชัดเจน ไฟล์ส่วนตัวยังเรียก private bootstrap เดิม จึงไม่เปิดคืนสมาชิก/บัญชีที่ถูกปิด และไม่ต้องใส่ API Key

คำสั่งจัดการสิทธิ์มี optimistic version, idempotency, organization lock และป้องกันการลดบทบาท Admin ที่ยังใช้งานได้คนสุดท้าย การเปลี่ยนบทบาทมีผลต่อการอ่าน/เขียนครั้งถัดไปในฐานข้อมูล ไม่ใช้ role หรือ actor ที่ browser ส่งมาเป็นอำนาจ

เมื่อเปิดเฉพาะ Dashboard หรือ Reports จะได้ข้อมูลสรุปงาน/มติ/ประชุมที่ได้รับสิทธิ์สำหรับการนับและรายงาน ไม่มีหลักฐาน รายงานความก้าวหน้าแบบข้อความ เกณฑ์ ถ้อยคำเต็ม หรือวาระประชุม หากเปิด Changes อย่างเดียวจะได้บริบทงานขั้นต่ำพร้อม `rowVersion` เพื่อยื่นคำขอ และมติที่เชื่อมกับงานขั้นต่ำ การมีข้อมูลสรุปไม่เปิดหน้ารายละเอียดหรือคำสั่งของหน้าที่ถูกปิด Staff ยังจำกัดเฉพาะงานตนและไม่รับข้อมูลประชุม Directory นอก Team มีตนเองและบุคคลที่รายการที่เห็นอ้างถึง; ผู้มี `task.assign` ได้ชื่อ/หน่วยงานของผู้รับงานและผู้ตรวจที่มีสิทธิ์สำหรับตัวเลือกมอบหมายด้วย

ผู้มี `resolution.draft` ที่เปิดเฉพาะหน้า Resolutions ได้ตัวเลือกประชุมต้นทางขั้นต่ำ `{id,title,number}` เพื่อบันทึกมติ แม้หน้า Meetings ปิดอยู่ ตัวเลือกนี้ไม่มี agenda หรือรายละเอียดประชุม และไม่เปิดคำสั่งแก้ประชุม

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

`public.get_workspace_state(p_organization_id uuid default null)` คืน `{ organization, users, units, eligibleOwners, roles, permissions, state, access }` ให้ active member ที่มีบทบาทแอปจาก override หรือ legacy grant ที่ยังมีผล `access` มี `{role,pages,policies,policyVersion,members}` โดย `members[profileId]` เป็น `{role,version}` เฉพาะ directory ที่มองเห็น และ `users` เพิ่ม `accessRole` สมาชิกที่ยังไม่มี override มี version 0; policy เริ่ม version 1 รายการที่ไม่มีสิทธิ์เป็น array ว่าง และ settings เป็น `{}`; audit คืนเฉพาะ Admin

`eligibleOwners` เป็นรายชื่อขั้นต่ำ `{id,name,unit}` สำหรับผู้มีสิทธิยื่นคำขอหรือมอบหมายที่ไม่ใช่ Staff และมีเฉพาะผู้รับงานได้จริงในองค์กรเดียวกัน Staff ได้ array ว่าง หน้าที่มีเพียง summary context อาจไม่มี fields ของ DTO รายละเอียด เช่น evidence, criteria, content, agenda จึงต้องไม่ถือว่าข้อมูลสรุปคือข้อมูลฉบับเต็ม

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
| set_member_role | profileId, role: admin/user/executive/staff, expectedVersion ของสมาชิก |
| set_role_pages | role: user/executive/staff, pages: PageKey[], expectedVersion ของ policy ทั้งองค์กร |

ส่ง idempotency key เดิมกับ payload เดิมเมื่อ retry คำสั่งที่ไม่ทราบผล การใช้ key เดิมกับ payload ต่างจะได้ IDEMPOTENCY_CONFLICT เมื่อ expectedVersion ไม่ตรงให้โหลดข้อมูลใหม่และให้ผู้ใช้ทบทวน ไม่ retry เขียนด้วย version ใหม่โดยเงียบ

## ขอบเขตสิทธิและข้อจำกัดระยะนี้

ตาราง public เปิด RLS และถอนสิทธิ SELECT/INSERT/UPDATE/DELETE ของ anon/authenticated ทั้งหมด แทนที่ด้วย read/write RPC ที่ SECURITY DEFINER, search_path ว่าง, tenant checks และ current membership/บทบาทแอป/page policy ไม่มี service-role key ในเส้นทางเว็บ การเรียก Data API ตรงจึงข้าม workflow ไม่ได้ ตาราง private ไม่อยู่ใน exposed schemas และ helper ไม่มี EXECUTE grant ให้ผู้ใช้

หลัง migration 005 ใช้บทบาทแอปตามตารางด้านบนเป็น authority หลัก โดย Staff อ่านงานเฉพาะ owner assignment ของตน แม้มี legacy reviewer grant อยู่ ไม่ได้เห็นงานคนอื่นจากการเป็นผู้ตรวจเดิม ส่วน Admin/User/Executive อยู่ในขอบเขตองค์กรและถูกจำกัดข้อมูลตามหน้าที่เปิด หากต้องจำกัด committee/unit/record เพิ่ม ต้องทำ policy phase ถัดไปก่อนเปิดข้อมูลจำกัดชั้นใน project นี้ โมเดลสิทธิ์แบบเต็มใน PRD/database.md ยังเป็นเป้าหมายแยกจาก implementation นี้

Global identity guard และ organization guard จัดลำดับการถอนสิทธิกับ business transaction; helper ตรวจสิทธิหลังได้ lock การเปลี่ยนบทบาท/page policy ใช้ workspace commands ที่กำหนด ส่วน provisioning/revoke ทางเทคนิคใช้ private helpers ตามตัวอย่าง Auth identity deletion มี trigger จับเส้นทาง cascade ด้วย กฎนี้ไม่ใช่การย้อนลบ transaction ที่ commit ก่อนถอนสิทธิ

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

ทดสอบขั้นตอนตั้งเลขานุการแยกด้วย `node supabase/tests/setup-secretary.mjs` ครอบคลุมการเปิด workspace ผ่าน RPC ด้วยบัญชีที่ผูกแล้ว การรันซ้ำ การใช้องค์กรเดิม และการไม่เปิดสิทธิ์ที่ปิดไว้หรือขยายวันสิ้นสุดสิทธิ์โดยอัตโนมัติ

ทดสอบบทบาทและ page policies ด้วย `node supabase/tests/role-access.mjs` ผลที่รันในเครื่องสำหรับรุ่นนี้: **16 กลุ่ม role/access, 30 workflow integration และ 25 secretary setup ผ่าน** ครอบคลุม default pages ว่าง, ขอบเขต Staff, direct-RPC denial, optimistic/idempotency conflicts, Admin คนสุดท้าย, self-review/self-approval, explicit bootstrap, dashboard/report summaries และ changes-only context ชุด workflow กำหนด page policies ของ fixtures อย่างชัดเจน ไม่ใช้สิทธิ์เหล่านั้นเป็นค่าเริ่มต้น production

PGlite จัดคิว transactions จึงทดสอบผลของการลดสิทธิ์ที่เรียงลำดับได้ แต่ยังไม่ยืนยัน lock contention ระหว่าง PostgreSQL หลาย sessions จริง รอบงานนี้ไม่ได้รัน SQL หรือเปลี่ยนข้อมูลบน Supabase hosted และไม่ได้ยืนยัน hosted Auth/Storage

ตรวจ install bundle เพิ่มโดยเทียบเนื้อหาและ SHA256 ของทั้ง 5 sources กับไฟล์ migration แบบตรงทุกไบต์ แล้วรัน bundle ใน PGlite ใหม่พร้อมทดสอบ personal local handoff โดยแทนอีเมลด้วย fixtures `example.test`: 11 checks ผ่าน รวมการรันซ้ำ องค์กรที่ไม่ชัดเจน การระงับ/ถอนสมาชิก ปิด identity และ banned Auth account โดยไม่มีข้อมูลส่วนตัวใน fixtures

ก่อนใช้ข้อมูลจริง ให้ทดสอบ hosted login/session และวงจรหลักด้วยบัญชีหลายบทบาท, ทดสอบ revoke/mutation ด้วย PostgreSQL สอง sessions จริง, กำหนดนโยบาย retention และทดสอบ backup/restore ฐานข้อมูลรวมไฟล์เมื่อเพิ่ม Storage แยก dev/test/prod และยืนยัน role templates กับผู้มีอำนาจของหน่วยงานก่อนนำร่อง
