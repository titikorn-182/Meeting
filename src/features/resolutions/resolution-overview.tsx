'use client';
import { AccessLink as Link } from '@/components/app-shell';
import { ArrowRight, CalendarDays, FileText, Info } from 'lucide-react';

import type { ResolutionDetailModel } from './use-resolution-detail';
export function ResolutionOverview({
  model,
}: {
  model: Pick<ResolutionDetailModel, 'tab' | 'resolution' | 'closureCriteria' | 'meeting'>;
}) {
  const { tab, resolution, closureCriteria, meeting } = model;
  return (
    <>
      {tab === 'overview' && (
        <div className="stack">
          <div>
            <h2>ถ้อยคำมติ</h2>
            <p className="resolution-content">{resolution.content}</p>
          </div>
          <div className="detail-divider" />
          <div>
            <h2>เกณฑ์การรับรองปิดมติ</h2>
            <p className="muted text-small mt-2">
              ตรวจรับงานย่อยแล้ว ยังต้องยืนยันเงื่อนไขระดับมติต่อไปนี้
            </p>
            <ul className="criteria-list">
              {closureCriteria.map((criterion, index) => (
                <li key={index}>
                  <span className="criterion-number">{index + 1}</span>
                  {criterion}
                </li>
              ))}
            </ul>
            {resolution.type === 'acknowledgment' && (
              <div className="inline-alert">
                <Info size={17} />
                <span>มติรับทราบอย่างเดียว เก็บในทะเบียนโดยไม่มีงานติดตาม</span>
              </div>
            )}
            {resolution.type === 'recurring' && (
              <div className="inline-alert">
                <CalendarDays size={17} />
                <span>มตินี้ดำเนินการต่อเนื่อง การตรวจรับงานรอบหนึ่งไม่ปิดมติแม่</span>
              </div>
            )}
          </div>
          <Link href={meeting ? `/meetings/${meeting.id}` : '/meetings'} className="source-link">
            <FileText size={20} />
            <span>
              <strong>การประชุมต้นทาง</strong>
              <small>
                {meeting?.title} · ครั้งที่ {meeting?.number}
              </small>
            </span>
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </>
  );
}
