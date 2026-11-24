import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookCheck } from 'lucide-react';
import styles from '@/app/login/login.module.css';

/** New account flows inherit the existing login layout and typography. */
export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
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
              กลับมาทำงาน
              <br />
              ได้อย่างมั่นใจ
            </h2>
            <p>จัดการบัญชีของคุณ เพื่อเข้าถึงงานและข้อมูลตามสิทธิ์ที่หน่วยงานมอบหมาย</p>
          </div>
          <div className={styles.context}>
            <p>ใช้อีเมลที่ผู้ดูแลเพิ่มไว้ในระบบ</p>
            <p>เข้าสู่ระบบเพื่อรับสิทธิ์ตามที่ผู้ดูแลกำหนด</p>
          </div>
        </section>
        <section className={styles.content} aria-labelledby="account-heading">
          <div className={styles.contentInner}>
            <h1 id="account-heading">{title}</h1>
            <p className={styles.description}>{description}</p>
            {children}
            <p className={styles.help}>
              <Link className="underline underline-offset-4" href="/login">
                กลับหน้าเข้าสู่ระบบ
              </Link>{' '}
              ·{' '}
              <Link className="underline underline-offset-4" href="/help">
                คู่มือและความช่วยเหลือ
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
