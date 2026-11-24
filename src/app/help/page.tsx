import Link from 'next/link';
import styles from './help.module.css';
import { ArrowLeft, BookOpenCheck, ExternalLink } from 'lucide-react';
import { Panel } from '@/components/ui';
export const metadata = { title: 'คู่มือและความช่วยเหลือ' };
const sections = [
  ['account', 'เริ่มต้นและบัญชี'],
  ['workflow', 'จากมติถึงการปิดงาน'],
  ['roles', 'บทบาทและสิทธิ์'],
  ['problems', 'แก้ปัญหาที่พบบ่อย'],
] as const;
export default function HelpPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} />
        กลับพื้นที่ทำงาน
      </Link>
      <header className="my-7">
        <h1 className="text-3xl font-semibold">คู่มือและความช่วยเหลือ</h1>
        <p className="muted mt-3 max-w-[70ch]">
          POLUBU Smart meeting — เริ่มต้นใช้งาน ติดตามมติ และรู้ว่าต้องดำเนินการอะไรต่อ
        </p>
      </header>
      <nav aria-label="หัวข้อคู่มือ" className="mb-8 flex flex-wrap gap-x-6 gap-y-3">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-link">
            {label}
          </a>
        ))}
      </nav>
      <div className="stack">
        <section id="account">
          <Panel
            title="เริ่มต้นและบัญชี"
            description="ผู้ดูแลเพิ่มชื่อและอีเมลไว้ก่อน เจ้าตัวจึงสมัครและเข้าสู่ระบบ"
          >
            <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
              <li>ให้ Admin เพิ่มชื่อ–นามสกุล อีเมล หน่วยงาน และบทบาทในหน้าบุคลากรและสิทธิ์</li>
              <li>
                <Link className="text-link" href="/signup">
                  สมัครบัญชี
                </Link>
                ด้วยอีเมลเดียวกัน แล้วเข้าสู่ระบบเพื่อรับสิทธิ์
              </li>
              <li>
                <Link className="text-link" href="/login">
                  เข้าสู่ระบบ
                </Link>{' '}
                ระบบจะผูกบัญชีกับรายชื่อที่ผู้ดูแลเตรียมไว้
              </li>
            </ol>
            <div className="cluster mt-5">
              <Link className="button button-secondary" href="/forgot-password">
                ลืมรหัสผ่าน
              </Link>
              <Link className="button button-secondary" href="/account">
                จัดการรหัสผ่าน
              </Link>
            </div>
          </Panel>
        </section>
        <section id="workflow">
          <Panel
            title="จากมติถึงการปิดงาน"
            description="สถานะรายงานประชุม ความก้าวหน้างาน และการรับรองปิดมติ เป็นคนละขั้นตอน"
          >
            <ol className="list-decimal space-y-4 pl-5 leading-relaxed">
              <li>
                <strong>บันทึกประชุมและวาระ</strong> — เลือกวาระแล้วบันทึกมติใหม่
                หรือเชื่อมมติเดิมมาติดตาม โดยไม่สร้างมติซ้ำ
              </li>
              <li>
                <strong>ระบุมติและเกณฑ์สำเร็จ</strong> — ระบุเจ้าภาพ เกณฑ์ปิด
                และให้ผู้มีสิทธิ์อนุญาตเริ่มก่อนมอบหมายงาน
              </li>
              <li>
                <strong>มอบหมายและรับทราบ</strong> — ระบุผู้รับผิดชอบ ผู้ตรวจ ผลส่งมอบ และกำหนดเวลา
                ผู้รับผิดชอบเปิดงานแล้วกดรับทราบ
              </li>
              <li>
                <strong>ดำเนินงานและส่งตรวจ</strong> — รายงานความก้าวหน้า เพิ่มหลักฐานลิงก์
                แล้วส่งผลงานตรวจ ความก้าวหน้า 100% ยังไม่ถือว่าผ่านตรวจ
              </li>
              <li>
                <strong>ตรวจผล</strong> — ผู้ตรวจอ่านหลักฐาน ยืนยันเกณฑ์และเหตุผล
                แล้วรับรองหรือส่งกลับแก้ไข ผู้ทำงานตรวจรับผลงานตนเองไม่ได้
              </li>
              <li>
                <strong>รับรองปิดมติ</strong> — เมื่อผ่านเงื่อนไข ให้ผู้มีสิทธิ์เปิดมติ
                ตรวจรายการเกณฑ์ระดับมติ แล้วรับรองปิด
                มติต่อเนื่องไม่ปิดอัตโนมัติเมื่องานหนึ่งรอบสำเร็จ
              </li>
            </ol>
            <p className="inline-alert info mt-5">
              หากต้องเปลี่ยนกำหนด ผู้รับผิดชอบ หรือขอบเขต ให้ยื่นคำขอจากหน้างาน
              ค่าจะเปลี่ยนเมื่อผู้มีอำนาจอนุมัติแล้วเท่านั้น
            </p>
          </Panel>
        </section>
        <section id="roles">
          <Panel title="บทบาทและสิทธิ์">
            <div className="table-scroll">
              <table className={`data-table ${styles.roleTable}`}>
                <thead>
                  <tr>
                    <th>บทบาท</th>
                    <th>การใช้งาน</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Admin</td>
                    <td>เข้าทุกหน้า จัดการบุคลากรและกำหนดสิทธิ์รายหน้า</td>
                  </tr>
                  <tr>
                    <td>User</td>
                    <td>ทำงานตามหน้าที่ Admin เปิดให้</td>
                  </tr>
                  <tr>
                    <td>Executive</td>
                    <td>ติดตามและพิจารณาตามสิทธิ์ที่ได้รับ</td>
                  </tr>
                  <tr>
                    <td>Staff</td>
                    <td>เห็นเฉพาะงานและข้อมูลของตนเองในหน้าที่ได้รับอนุญาต</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted mt-4 text-sm">
              การเปิดหน้าได้ไม่ได้หมายความว่าจะกดได้ทุกปุ่ม ระบบยังตรวจหน้าที่ ผู้รับผิดชอบ
              และสถานะงานทุกครั้ง
            </p>
          </Panel>
        </section>
        <section id="problems">
          <Panel title="แก้ปัญหาที่พบบ่อย">
            <div className="divide-y divide-[var(--line)]">
              {[
                [
                  'รอรับสิทธิ์เข้าพื้นที่ทำงาน',
                  'ตรวจว่าใช้อีเมลตรงกับรายชื่อที่ Admin เพิ่มไว้ ออกจากระบบและเข้าใหม่ หากยังไม่ได้ ให้ Admin ตรวจบทบาทและหน้าที่เปิดให้',
                ],
                [
                  'ลิงก์ยืนยันหรือตั้งรหัสผ่านหมดอายุ',
                  'ส่งคำขออีเมลใหม่ แล้วเปิดลิงก์ด้วยเบราว์เซอร์เดียวกับที่ส่งคำขอ ลิงก์เก่าที่ใช้แล้วอาจเปิดซ้ำไม่ได้',
                ],
                [
                  'ไม่เห็นเมนูหรือปุ่มที่ต้องการ',
                  'ให้ Admin ตรวจสิทธิ์รายหน้าใน /team รวมถึงผู้รับผิดชอบ ผู้ตรวจ และสถานะปัจจุบันของรายการ',
                ],
                [
                  'ข้อมูลเปลี่ยนก่อนบันทึก',
                  'โหลดข้อมูลล่าสุดและตรวจสิ่งที่ผู้อื่นเปลี่ยนก่อนส่งคำขออีกครั้ง อย่ากดซ้ำโดยยังไม่ตรวจผล',
                ],
                [
                  'แนบหลักฐานอย่างไร',
                  'รุ่นที่เชื่อมฐานข้อมูลรองรับหลักฐานลิงก์ เพิ่มชื่อและ URL ที่ผู้ตรวจเปิดได้ ไฟล์ภายนอกอยู่ภายใต้สิทธิ์ของแหล่งต้นทาง',
                ],
                [
                  'รายงานกับความก้าวหน้าไม่เท่ากัน',
                  'รายงานแยกงานส่งตรวจ ตรวจรับ และปิดมติออกจากกัน อ่านคำอธิบายใต้รายงานก่อนนำตัวเลขไปอ้างอิง',
                ],
              ].map(([question, answer]) => (
                <details key={question} className="py-4 first:pt-0">
                  <summary className="cursor-pointer font-medium">{question}</summary>
                  <p className="muted mt-3 max-w-[72ch] leading-relaxed">{answer}</p>
                </details>
              ))}
            </div>
          </Panel>
        </section>
        <p className="muted text-sm">
          <BookOpenCheck size={16} className="mr-2 inline" />
          หากต้องติดต่อผู้ดูแล ให้แจ้งหน้าที่ใช้งาน เวลา และข้อความผิดพลาด โดยไม่ส่งรหัสผ่านหรือ API
          key
        </p>
        <Link href="/login" className="text-link w-fit">
          เข้าสู่ระบบ
          <ExternalLink size={15} />
        </Link>
      </div>
    </main>
  );
}
