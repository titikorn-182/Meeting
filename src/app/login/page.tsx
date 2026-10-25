import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookCheck, CircleHelp } from 'lucide-react';
import { getDataConfiguration } from '@/lib/supabase/config';
import { safeRedirectPath } from '@/lib/supabase/redirect';
import { LoginForm } from './login-form';
import styles from './login.module.css';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const config = getDataConfiguration();
  const isConnected = config.mode === 'supabase' && config.configured;
  const configurationIssues = config.mode === 'supabase' && !config.configured ? config.issues : [];
  const initialError =
    params.error === 'callback'
      ? 'ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'
      : params.error === 'signout'
        ? 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ'
        : undefined;
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
              ทุกมติ
              <br />
              มีงานที่ติดตามได้
            </h2>
            <p>พื้นที่ทำงานร่วมกันสำหรับมติการประชุม ผู้รับผิดชอบ และผลการดำเนินงาน</p>
          </div>
          <div className={styles.context}>
            <p>ระบบติดตามมติที่ประชุม</p>
            <p>เข้าถึงงานและข้อมูลตามสิทธิ์ที่หน่วยงานมอบหมาย</p>
          </div>
        </section>
        <section className={styles.content} aria-labelledby="login-heading">
          <div className={styles.contentInner}>
            <h1 id="login-heading">
              {isConnected
                ? 'เข้าสู่พื้นที่ทำงาน'
                : config.mode === 'demo'
                  ? 'ขณะนี้อยู่ในโหมดทดลอง'
                  : 'รอตั้งค่าการเชื่อมต่อ'}
            </h1>
            {isConnected ? (
              <>
                <p className={styles.description}>
                  ใช้อีเมลและรหัสผ่านของบัญชีที่ได้รับสิทธิ์เข้าใช้งาน
                </p>
                <LoginForm next={safeRedirectPath(params.next)} initialError={initialError} />
              </>
            ) : config.mode === 'demo' ? (
              <>
                <p className={styles.description}>
                  เปิดดูหน้าจอและทดลองกระบวนงานได้ด้วยข้อมูลตัวอย่าง
                  การเข้าสู่ระบบจะพร้อมเมื่อผู้ดูแลตั้งค่า Supabase
                </p>
                <Link href="/" className={`button button-primary ${styles.returnLink}`}>
                  <ArrowLeft size={17} />
                  กลับไปทดลองใช้งาน
                </Link>
              </>
            ) : (
              <>
                <p className={styles.description}>
                  ผู้ดูแลต้องเพิ่มค่าการเชื่อมต่อในไฟล์ <code>.env.local</code>{' '}
                  แล้วเริ่มเว็บใหม่ก่อนเข้าสู่ระบบ
                </p>
                <div className={styles.setupNotice}>
                  <CircleHelp size={19} />
                  <div>
                    <h2>ตรวจค่าต่อไปนี้</h2>
                    <ul>
                      {configurationIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className={styles.help}>
                  ดูขั้นตอนใน README ของโครงการ ใช้เฉพาะ Publishable key หรือ anon key
                  ในค่าที่ขึ้นต้นด้วย NEXT_PUBLIC_
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
