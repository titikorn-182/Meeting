'use client';
import { AccessLink as Link } from '@/components/app-shell';
import { EmptyState } from '@/components/ui';
import { formatThaiDate } from '@/lib/workflow';
import { ArrowRight, FileText, Info } from 'lucide-react';

import type { ResolutionDetailModel } from './use-resolution-detail';
export function ResolutionEvidence({
  model,
}: {
  model: Pick<ResolutionDetailModel, 'tab' | 'evidence' | 'mode' | 'taskDetailsAvailable'>;
}) {
  const { tab, evidence, mode, taskDetailsAvailable } = model;
  return (
    <>
      {tab === 'evidence' &&
        (evidence.length ? (
          <div className="stack-sm">
            <div className="inline-alert">
              <Info size={17} />
              <span>
                {mode === 'demo'
                  ? 'หลักฐานในชุดเริ่มต้นเป็นตัวอย่างชื่อเอกสาร เปิดงานเพื่อดูรายละเอียด'
                  : 'หลักฐานที่ได้รับสิทธิเข้าถึง เปิดงานเพื่อดูชุดผลงานและลิงก์อ้างอิง'}
              </span>
            </div>
            {evidence.map((file) => (
              <Link
                className="evidence-row"
                key={`${file.task.id}-${file.id}`}
                href={`/tasks/${file.task.id}`}
              >
                <FileText size={22} />
                <span>
                  <strong>{file.name}</strong>
                  <small>
                    {file.task.code} · {file.size} · {formatThaiDate(file.uploadedAt)}
                  </small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title={taskDetailsAvailable ? 'ยังไม่มีหลักฐาน' : 'ยังไม่มีสิทธิอ่านหลักฐานของงาน'}
            description={
              taskDetailsAvailable
                ? 'เมื่อเจ้าของงานเพิ่มหลักฐาน เอกสารจะรวบรวมในมตินี้โดยอัตโนมัติ'
                : 'โปรดให้ Admin เปิดหน้ารายการงานหรือตรวจผล เพื่ออ่านหลักฐานที่เกี่ยวข้อง'
            }
          />
        ))}
    </>
  );
}
