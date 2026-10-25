'use client';
import { CircleAlert } from 'lucide-react';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty-state">
      <CircleAlert size={38} />
      <h1>เปิดหน้านี้ไม่สำเร็จ</h1>
      <p>ข้อมูลทดลองยังอยู่ในเบราว์เซอร์ ลองโหลดหน้านี้อีกครั้ง</p>
      <button className="button button-primary" onClick={reset}>
        ลองอีกครั้ง
      </button>
    </div>
  );
}
