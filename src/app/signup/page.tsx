import type { Metadata } from 'next';
import { BookCheck } from 'lucide-react';
import { getDataConfiguration } from '@/lib/supabase/config';
import { SignUpForm } from './signup-form';
import styles from '../login/login.module.css';

export const metadata: Metadata = { title: 'สมัครบัญชี' };
export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  const configuration = getDataConfiguration();
  const enabled = configuration.mode === 'supabase' && configuration.configured;
  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.introduction} aria-label="POLUBU Smart meeting">
          <div className={styles.brand}>
            <BookCheck size={31} strokeWidth={1.5} />
            <span>
              <strong>
                POLUBU<span className={styles.brandDot}>.</span>
              </strong>
              <small>Smart meeting</small>
            </span>
          </div>
          <div className={styles.introductionText}>
            <h2>
              พร้อมรับงาน
              <br />
              ในพื้นที่ของคุณ
            </h2>
            <p>สมัครด้วยอีเมลที่ผู้ดูแลระบุ ยืนยันตัวตน แล้วเข้าถึงงานตามบทบาทที่ได้รับ</p>
          </div>
          <div className={styles.context}>
            <p>ชื่อและสิทธิ์มาจากผู้ดูแลหน่วยงาน</p>
            <p>การสมัครเพียงอย่างเดียวยังไม่ให้สิทธิ์ในพื้นที่ทำงาน</p>
          </div>
        </section>
        <section className={styles.content} aria-labelledby="signup-heading">
          <div className={styles.contentInner}>
            <h1 id="signup-heading">สมัครบัญชีบุคลากร</h1>
            <p className={styles.description}>
              ตั้งรหัสผ่านของคุณ แล้วเปิดอีเมลยืนยันก่อนเข้าใช้งาน
            </p>
            <SignUpForm enabled={enabled} />
          </div>
        </section>
      </div>
    </main>
  );
}
