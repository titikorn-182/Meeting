'use client';
import { Button, Panel } from '@/components/ui';
import { CheckCheck, Clock3, ShieldCheck } from 'lucide-react';

import type { ResolutionDetailModel } from './use-resolution-detail';
export function ResolutionClosure({
  model,
}: {
  model: Pick<
    ResolutionDetailModel,
    | 'canClose'
    | 'tasksReady'
    | 'closureContextAvailable'
    | 'mode'
    | 'closing'
    | 'closureCriteria'
    | 'checked'
    | 'setChecked'
    | 'busy'
    | 'setClosing'
    | 'confirmClosure'
  >;
}) {
  const {
    canClose,
    tasksReady,
    closureContextAvailable,
    mode,
    closing,
    closureCriteria,
    checked,
    setChecked,
    busy,
    setClosing,
    confirmClosure,
  } = model;
  return (
    <>
      {canClose && (
        <Panel title="รับรองปิดมติ" description="ตรวจงานจำเป็นและเงื่อนไขระดับมติให้ครบก่อนปิด">
          <div className="stack-sm">
            {!tasksReady && (
              <div className="inline-alert warning">
                <Clock3 size={17} />
                <span>
                  {!closureContextAvailable
                    ? 'ยังตรวจเงื่อนไขปิดมติได้ไม่ครบตามสิทธิที่ได้รับ โปรดให้ Admin เปิดหน้ารายการงานหรือตรวจผล และคำขอเปลี่ยนแปลงก่อน'
                    : mode === 'supabase'
                      ? 'ทุกงานต้องผ่านตรวจรับและไม่มีคำขอค้างก่อนปิดมติในรุ่นนี้ การจัดการงานประกอบที่ยังค้างแยกต่างหากยังไม่เปิดใช้'
                      : 'ยังมีงานจำเป็นที่ไม่ผ่านการตรวจรับ หรือยังไม่มีงานตามมติ'}
                </span>
              </div>
            )}
            {tasksReady && !closing && (
              <p className="text-small muted">
                งานจำเป็นผ่านการตรวจรับแล้ว พร้อมตรวจเงื่อนไขระดับมติ
              </p>
            )}
            {closing && tasksReady && (
              <div className="stack-sm">
                {closureCriteria.map((criterion, index) => (
                  <label key={index} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={checked.includes(index)}
                      onChange={(event) =>
                        setChecked((items) =>
                          event.target.checked
                            ? [...items, index]
                            : items.filter((item) => item !== index),
                        )
                      }
                    />
                    {criterion}
                  </label>
                ))}
              </div>
            )}
            <div className="cluster mt-3">
              {closing ? (
                <>
                  <Button
                    disabled={busy || !tasksReady || checked.length !== closureCriteria.length}
                    onClick={confirmClosure}
                  >
                    <ShieldCheck size={16} />
                    ยืนยันรับรองปิดมติ
                  </Button>
                  <Button disabled={busy} variant="ghost" onClick={() => setClosing(false)}>
                    ยกเลิก
                  </Button>
                </>
              ) : (
                <Button disabled={busy || !tasksReady} onClick={() => setClosing(true)}>
                  <CheckCheck size={16} />
                  ตรวจเกณฑ์และรับรองปิด
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
