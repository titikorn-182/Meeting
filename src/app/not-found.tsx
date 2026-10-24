import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return <div className="empty-state not-found"><FileQuestion size={44} strokeWidth={1.5} /><h1>ไม่พบหน้าที่ต้องการ</h1><p>ลิงก์นี้อาจไม่มีในพื้นที่ทดลอง กลับไปที่ภาพรวมเพื่อเปิดรายการอีกครั้ง</p><Link href="/" className="button button-primary">กลับหน้าภาพรวม</Link></div>;
}
