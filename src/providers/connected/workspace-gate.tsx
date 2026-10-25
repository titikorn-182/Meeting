'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';
import { SignOutForm } from '@/features/auth/sign-out-form';
import type { WorkspaceError } from '@/lib/workspace';
export function WorkspaceGate({
  loading,
  problem,
  configured,
  refresh,
}: {
  loading: boolean;
  problem: WorkspaceError | null;
  configured: boolean;
  refresh: () => Promise<boolean>;
}) {
  const pathname = usePathname();

  const pending = loading && !problem;
  const title = pending
    ? 'กำลังเปิดพื้นที่ทำงาน'
    : problem?.code === 'NO_MEMBERSHIP'
      ? 'รอรับสิทธิ์เข้าพื้นที่ทำงาน'
      : problem?.code === 'UNAUTHENTICATED'
        ? 'เข้าสู่ระบบเพื่อใช้งานต่อ'
        : 'ยังเปิดพื้นที่ทำงานไม่ได้';
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-6 py-12"
      aria-busy={pending}
    >
      <span className="text-sm font-semibold text-[var(--teal)]">POLUBU Smart meeting</span>
      {pending ? (
        <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <CircleAlert size={30} aria-hidden="true" />
      )}
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p
        className="text-base leading-relaxed text-[var(--muted)]"
        role={problem ? 'alert' : 'status'}
      >
        {pending ? 'กำลังตรวจบัญชีและโหลดข้อมูลที่คุณมีสิทธิ์เข้าถึง' : problem?.message}
      </p>
      {!pending && (
        <div className="flex flex-wrap gap-3">
          {problem?.code === 'UNAUTHENTICATED' ? (
            <Link
              className="button button-primary"
              href={`/login?next=${encodeURIComponent(pathname)}`}
            >
              เข้าสู่ระบบ
            </Link>
          ) : (
            <button type="button" className="button button-primary" onClick={() => void refresh()}>
              <RefreshCw size={16} />
              ลองโหลดอีกครั้ง
            </button>
          )}
          {configured && problem?.code !== 'UNAUTHENTICATED' && (
            <SignOutForm label="เปลี่ยนบัญชี" className="button button-secondary" />
          )}
        </div>
      )}
    </main>
  );
}
