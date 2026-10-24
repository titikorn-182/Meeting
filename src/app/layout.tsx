import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans-thai/400.css";
import "@fontsource/ibm-plex-sans-thai/500.css";
import "@fontsource/ibm-plex-sans-thai/600.css";
import "@fontsource/ibm-plex-sans-thai/700.css";
import "./globals.css";
import { Application } from "@/components/application";

export const metadata: Metadata = {
  title: { default: "POLUBU Smart meeting — ติดตามมติการประชุม", template: "%s | POLUBU Smart meeting" },
  description: "พื้นที่ทำงานสำหรับติดตามมติ มอบหมายงาน รายงานความก้าวหน้า และตรวจรับผลดำเนินงาน คณะรัฐศาสตร์ มหาวิทยาลัยอุบลราชธานี",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body><Application>{children}</Application></body></html>;
}
