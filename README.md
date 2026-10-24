# POLUBU Smart meeting

เว็บติดตามมติการประชุมสำหรับเลขานุการ ผู้รับผิดชอบ ผู้ตรวจ และผู้มีอำนาจอนุมัติ ใช้ [PRD.md](PRD.md) และ [database.md](database.md) เป็นฐานออกแบบ โดยเริ่มเชื่อม Supabase สำหรับฟังก์ชันหลักที่มีหน้าจอแล้ว

## เริ่มใช้งาน

ใช้ Node.js **22 ขึ้นไป** ตาม Supabase SDK รุ่นที่ติดตั้ง พร้อม npm, Next.js 16 App Router, TypeScript และ Tailwind 4

~~~bash
npm install
npm run dev
~~~

เปิด [http://127.0.0.1:3000](http://127.0.0.1:3000) บน PowerShell ที่ปิด execution policy ใช้ npm.cmd แทน npm ได้

เมื่อยังไม่ตั้ง environment จะเปิดโหมด demo ซึ่งใช้ข้อมูลตัวอย่างใน localStorage โหมด Supabase ใช้ข้อมูลจากบัญชีที่เข้าสู่ระบบ ไม่อ่านหรือย้ายข้อมูล demo ไปฐานข้อมูลจริง และไม่กลับไปใช้ข้อมูลตัวอย่างเมื่อเชื่อมต่อผิดพลาด

## เชื่อม Supabase เมื่อพร้อมใส่ API Key

1. สร้าง project และทำตาม [คู่มือติดตั้งฐานข้อมูล](supabase/README.md): รัน [install.sql](supabase/install.sql) ครั้งเดียวใน SQL Editor ของ project ใหม่ ไฟล์นี้รวม migrations 001–005 ทั้ง 5 ไฟล์แล้ว ไม่ต้องรันไฟล์แยกซ้ำ หากติดตั้ง 001–004 อยู่แล้ว ให้รันเฉพาะ [upgrade-role-access.sql](supabase/upgrade-role-access.sql) ครั้งเดียวแทน
2. สร้างบัญชีใน Supabase Authentication แล้วใช้ [bootstrap.example.sql](supabase/bootstrap.example.sql) ที่แก้ UUID จริงแล้ว เพื่อสร้างองค์กรและมอบบทบาทให้แต่ละบัญชี บัญชี Auth อย่างเดียวยังไม่มีสิทธิ์อ่านงานหรืออนุมัติ

   เมื่อบัญชีมี identity/profile และ membership ที่ยังใช้งานได้แล้ว ให้ผู้ดูแลฐานข้อมูลแก้อีเมลและ UUID องค์กรใน [setup-admin.sql](supabase/setup-admin.sql) เพื่อแต่งตั้ง Admin ของแอปคนแรกอย่างชัดเจน จากนั้น Admin กำหนดบทบาทและหน้าใช้งานที่ `/team` สคริปต์นี้ไม่สร้าง Auth user หรือองค์กร และไม่เปิดคืน membership ที่ถูกปิด เลขานุการเดิมไม่ถูกยกระดับเป็น Admin อัตโนมัติ

3. คัดลอก [.env.example](.env.example) เป็น .env.local แล้วกรอก:

~~~dotenv
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
# เลือกได้: UUID องค์กรจาก bootstrap
NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID=
~~~

4. เริ่ม dev server ใหม่ แล้วเปิด [/login](http://127.0.0.1:3000/login) สำหรับ production ต้อง build ใหม่หลังเปลี่ยน NEXT_PUBLIC_* เพราะค่าเหล่านี้ถูกฝังใน browser bundle
5. ทดลองด้วยบัญชีที่ได้รับสิทธิ์: สร้างประชุม/มติ → อนุญาตเริ่ม → มอบหมาย → รับทราบ/เริ่ม → รายงาน/เพิ่มลิงก์หลักฐาน → ส่งตรวจ/ส่งแก้/ตรวจรับ → ปิดมติ

รองรับ legacy anon key ผ่าน NEXT_PUBLIC_SUPABASE_ANON_KEY แทน publishable key ได้ เว็บนี้ **ไม่ต้องใช้ service-role key, secret key หรือ database password** ห้ามใส่คีย์เหล่านั้นใน NEXT_PUBLIC_* ไฟล์ .env.local ถูก ignore แล้ว

ยังไม่ได้รัน migrations บน Supabase project ของผู้ใช้ การกรอก Key อย่างเดียวไม่สร้างตารางหรือ membership ให้เอง ต้องทำข้อ 1–2 ก่อนใช้ข้อมูลจริง

| สถานะ | พฤติกรรม |
|---|---|
| ไม่มี environment / mode=demo | ทดลองด้วย localStorage; สลับบทบาทและรีเซ็ตข้อมูลตัวอย่างได้ |
| mode=supabase แต่ URL/Key ไม่ครบ | หน้ารอการตั้งค่า; ไม่แสดงข้อมูลจำลอง |
| ตั้งค่าครบแต่ยังไม่ login | แสดงทางไปเข้าสู่ระบบ |
| login แล้วแต่ไม่มี membership/grant | แจ้งให้รับสิทธิ์จากผู้ดูแล; เปลี่ยนบัญชีได้ |
| มีบทบาท User/Executive แต่ยังไม่มีหน้าที่เปิด | แจ้งว่ารอ Admin กำหนดหน้าที่ `/team`; ไม่ต้องติดตั้งฐานข้อมูลซ้ำ |
| ตารางยังไม่ติดตั้ง / เครือข่ายขาด | แจ้งเหตุและให้โหลดใหม่; ไม่แสดงการบันทึกสำเร็จเทียม |
| เชื่อมครบ | อ่านตามสิทธิ์ ทุกการเขียนผ่าน transactional RPC |

## ฟังก์ชันที่เชื่อมในระยะแรก

| หน้า | การเชื่อมต่อ |
|---|---|
| ภาพรวม / ทะเบียน / ค้นหา | ข้อมูลปัจจุบันตามสิทธิ์ของบัญชีและองค์กร |
| การประชุม | บันทึกประชุมและวาระ เชื่อมมติกับวาระ |
| มติ | รหัสถาวร รุ่นถ้อยคำ รอบมติ และการอนุญาตเริ่มแยกกัน |
| งาน | รอบงาน เกณฑ์ เจ้าของ ผู้ตรวจ กำหนดเดิม/ปัจจุบัน รับทราบและความก้าวหน้า |
| หลักฐาน | ลิงก์ http(s) เป็นรุ่นเอกสาร ชุดส่งตรึงรุ่นที่อ้าง |
| ตรวจผล | หลาย attempts ผลตรวจรายเกณฑ์ ส่งกลับ/ตรวจรับ ห้ามผู้เคยทำผลงานตรวจเอง |
| คำขอเปลี่ยน | ขอ/พิจารณากำหนด เจ้าของ และคำอธิบายขอบเขต คำขอค้างไม่มีผลจริง |
| ปิดมติ | ตรวจสิทธิ์และ checklist ใน transaction; ระยะนี้ทุก linked task ต้องผ่าน |
| รายงาน | ผลรวมปัจจุบันและ CSV จากการอ่านข้อมูลใหม่ ไม่ใช่ KPI ย้อนหลังที่รับรอง |
| บุคลากร / แจ้งเตือน / ตั้งค่า | Admin จัดการบทบาทและสิทธิ์รายหน้า, directory ตาม scope, in-app events, mark read และ policy versions |

หนึ่งสมาชิกมีบทบาทแอปหลักหนึ่งค่าในแต่ละองค์กร: **Admin** เข้าได้ทุกหน้าและจัดการสิทธิ์, **User** และ **Executive** เริ่มต้นโดยยังไม่มีหน้าที่เปิดจน Admin เลือก, **Staff** เริ่มที่งานของฉัน/คำขอเปลี่ยนแปลง/แจ้งเตือนและเห็นเฉพาะข้อมูลตนเอง Admin เพิ่มหน้า Staff ได้เฉพาะภาพรวม หรือปิดหน้าในกลุ่มนี้ การเปิดหน้าไม่เพิ่มความสามารถธุรกิจที่บทบาทไม่มี และทุกบทบาทยังต้องผ่านกฎห้ามตรวจผลงานตนเองหรืออนุมัติคำขอตนเอง

ชื่อ workflow เดิม secretary/owner/reviewer/executive ยังอยู่ใน DTO เพื่อรองรับหน้าจอ แต่ SQL ใช้บทบาทแอปและ page policy ปัจจุบันเป็น authority หากยังไม่มี override จะตีความ secretary → User, executive → Executive, owner/reviewer → Staff โดยไม่แต่งตั้ง Admin เอง Admin ของแอปเป็นคนละแนวคิดกับผู้ดูแลฐานข้อมูลทางเทคนิค และหน้า `/team` ไม่สร้างบัญชี Auth หรือ membership ใหม่ ดูขั้นตอนตั้งเลขานุการเดิมและตั้ง Admin ใน [คู่มือ Supabase](supabase/README.md)

Dashboard/Reports ที่เปิดโดยไม่มีหน้ารายละเอียดจะรับข้อมูลสรุปที่ได้รับสิทธิ์; Changes อย่างเดียวรับบริบทงานขั้นต่ำพร้อม version เพื่อยื่นคำขอ ไม่มีหลักฐาน/ข้อความงาน/เกณฑ์เต็มจากหน้าที่ถูกปิด Staff ไม่ได้รับงานคนอื่น directory คนอื่น หรือ audit/settings ขององค์กร หน้าจอโหมดจริงไม่สลับบุคคล ทุกการเขียนตรวจสิทธิ์และหน้าที่เปิดในฐานข้อมูลอีกครั้ง ตาราง public เปิด RLS และปิด direct client access ใช้ read/write RPC ที่ตรวจ tenant, session และ assignment แทนการแก้ status จาก browser

เมื่อเปิดเฉพาะทะเบียนมติ ผู้มีสิทธิ์ร่างมติยังเลือกประชุมต้นทางจากชื่อ/เลขครั้งขั้นต่ำได้ โดยไม่ได้เปิดรายละเอียดหรือคำสั่งของหน้าประชุม

ยังต้องพัฒนาต่อ: ไฟล์จริงพร้อม scan/Storage gateway, สิทธิ์ละเอียด committee/record classification, dependencies/blockers/recurrence, ยุติ/เปิดใหม่/ทดแทน, วันกำหนดหลายรูปแบบ/ปฏิทินวันทำการ, temporal KPI/snapshots, import/retention, email/scheduler และ backup/restore ดูขอบเขตใน [supabase/README.md](supabase/README.md) ปุ่มอัปโหลดไฟล์จริงถูกปิดไว้ ไม่แสดงผลสำเร็จเทียม

## โครงสร้าง

| ตำแหน่ง | หน้าที่ |
|---|---|
| src/components/application.tsx | แยกหน้าบัญชีออกจากพื้นที่ทำงาน |
| src/components/demo-provider.tsx | เลือก adapter; demo เก็บใน browser เท่านั้น |
| src/components/supabase-workspace-provider.tsx | โหลดจริง รอ mutation, retry key, reload และ errors |
| src/components/workspace-context.tsx | Async interface ร่วมของหน้าจอ |
| src/lib/supabase/ | Config, clients และ typed RPC contract |
| src/proxy.ts / src/app/auth/ / src/app/login/ | Cookie refresh, login/logout และ safe callback |
| src/app/api/workspace/route.ts | ตรวจ session, same-origin, validation, no-store |
| src/lib/workspace-validation.ts | Allowlist คำสั่ง/fields และ safe error mapping; SQL ตรวจซ้ำ |
| src/lib/access-control.ts | สัญญาบทบาทแอป/page keys และสิทธิ์สำหรับ UI; ฐานข้อมูลตรวจซ้ำ |
| supabase/migrations/ | ตารางสัมพันธ์, grants/RLS, helpers และ RPC |
| supabase/tests/integration.mjs | รัน SQL จริงด้วย PostgreSQL/PGlite โดยไม่ใช้ API Key |
| supabase/tests/role-access.mjs | บทบาท/Page policies, Staff scope, Admin bootstrap และ negative RPC cases |

database.types.ts เป็น typed RPC contract ของ migrations ที่ commit ไม่ใช่ generated table types จาก remote project เมื่อ deploy ให้เทียบ/regenerate จาก schema จริง

## ตรวจสอบ

~~~bash
npm run typecheck
npm test
npm run test:db
node supabase/tests/role-access.mjs
node supabase/tests/setup-secretary.mjs
npm run build
npm run start
~~~

- Unit tests: demo workflow, config ที่ผิด/ขาด, secret-key guard, safe redirect, command validation, dates, same-origin และ safe errors
- DB tests: migrations จริงใน PostgreSQL/WASM พร้อม Auth stubs, FK/grants, scope, idempotency, versions, frozen submissions, ผลตรวจรายเกณฑ์, closure, changes และ revocation
- Role/access tests: 16 กลุ่มผ่าน; workflow integration 30 checks และ secretary setup 25 checks ผ่านในเครื่อง ครอบคลุมบทบาททั้ง 4, ไม่มี auto-admin, page defaults ว่าง, summary/context ของแต่ละหน้า, Staff scope, direct-RPC denial และการคง Admin คนสุดท้าย
- Login visual checks: เปิด dev server แล้วรัน npm run test:auth-ui ใช้ Chrome ที่ติดตั้งอยู่; กำหนด AUTH_VISUAL_BASE_URL และ AUTH_VISUAL_MODE=demo/configured/missing เพื่อเลือกสภาพแวดล้อม ไม่ส่งรหัสผ่านไปบริการจริง
- Workspace smoke: npm run test:workspace-ui ทดสอบสร้างประชุมพร้อมวาระ โหลดใหม่ และตรวจรับงานใน browser context ของ demo ที่แยกจากผู้ใช้
- NEXT_DIST_DIR=.next-ชื่อทดสอบ ใช้แยก preview build ระหว่างทดสอบ ไม่ต้องตั้งในการใช้งานปกติ

ก่อนนำร่องต้องทดสอบ hosted Auth/session ด้วยบัญชีหลายบทบาท, revoke แข่ง mutation ใน PostgreSQL หลาย sessions และนโยบาย/backup จริง การผ่าน PGlite ไม่ใช่การรับรอง hosted services หรือ production SLA

รอบนี้ไม่ได้รัน migrations หรือเปลี่ยนบัญชีบน Supabase hosted การทดสอบ competing role changes ใน PGlite เป็น transactions ที่จัดคิวต่อกัน ยังไม่ใช่การทดสอบ lock contention หลาย database sessions จริง [database.md](database.md) และ PRD อธิบายโมเดลเป้าหมายที่กว้างกว่าฟีเจอร์ที่เชื่อมแล้วในรุ่นนี้

อ้างอิง [Supabase SSR สำหรับ Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) และ [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations)
