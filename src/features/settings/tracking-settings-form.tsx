'use client';
import { useState, type FormEvent } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-context';
import { Button, Field, Panel } from '@/components/ui';
import type { WorkspaceSettings } from '@/lib/types';

export function TrackingSettingsForm({ settings }: { settings: WorkspaceSettings }) {
  const { defaultSettings, notify, updateSettings, mode, permissions, busy } = useWorkspace();
  const canEdit = permissions.includes('policy.manage');
  const [reminders, setReminders] = useState(settings.reminderDays.join(', '));
  const [acknowledgmentDays, setAcknowledgmentDays] = useState(settings.acknowledgmentDays);
  const [reviewDays, setReviewDays] = useState(settings.reviewDays);
  const [emailNotifications, setEmailNotifications] = useState(settings.emailNotifications);
  const [error, setError] = useState('');
  const dirty =
    reminders !== settings.reminderDays.join(', ') ||
    acknowledgmentDays !== settings.acknowledgmentDays ||
    reviewDays !== settings.reviewDays ||
    emailNotifications !== settings.emailNotifications;
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = reminders.split(/[,\s]+/).filter(Boolean);
    if (!values.length || values.some((value) => !/^\d+$/.test(value) || Number(value) > 365)) {
      setError('ระบุจำนวนวันเป็นจำนวนเต็ม 0–365 คั่นด้วยจุลภาค เช่น 7, 3, 0');
      return;
    }
    if (
      !Number.isInteger(acknowledgmentDays) ||
      !Number.isInteger(reviewDays) ||
      acknowledgmentDays < 1 ||
      acknowledgmentDays > 30 ||
      reviewDays < 1 ||
      reviewDays > 30
    ) {
      setError('ระยะเวลารับทราบและตรวจผลต้องเป็นจำนวนเต็ม 1–30 วันทำการ');
      return;
    }
    const settings: WorkspaceSettings = {
      reminderDays: [...new Set(values.map(Number))].sort((a, b) => b - a),
      acknowledgmentDays,
      reviewDays,
      emailNotifications,
    };
    if (await updateSettings(settings)) {
      setError('');
    }
  }

  function restoreSettings() {
    setReminders(defaultSettings.reminderDays.join(', '));
    setAcknowledgmentDays(defaultSettings.acknowledgmentDays);
    setReviewDays(defaultSettings.reviewDays);
    setEmailNotifications(defaultSettings.emailNotifications);
    setError('');
    notify('คืนค่าตั้งต้นในแบบฟอร์มแล้ว กดบันทึกเพื่อใช้ค่าเหล่านี้', 'info');
  }

  return (
    <Panel title="รอบการแจ้งเตือน" description="ค่าตั้งต้นสำหรับการติดตามงานและตรวจรับผลงาน">
      {!canEdit && (
        <div className="inline-alert warning mb-5">
          บัญชีนี้ดูการตั้งค่าได้ การเปลี่ยนแปลงต้องดำเนินการโดยผู้มีสิทธิจัดการนโยบาย
        </div>
      )}
      <form className="stack" onSubmit={handleSave}>
        <Field
          label="แจ้งเตือนก่อนวันครบกำหนด"
          htmlFor="reminder-days"
          required
          hint="แยกจำนวนวันด้วยจุลภาค โดย 0 คือแจ้งในวันครบกำหนด"
        >
          <input
            id="reminder-days"
            className="input"
            value={reminders}
            onChange={(event) => setReminders(event.target.value)}
            disabled={!canEdit}
            placeholder="7, 3, 0"
            required
            aria-describedby={error ? 'settings-error' : undefined}
          />
        </Field>
        <div className="form-grid">
          <Field label="รับทราบงานภายใน" htmlFor="ack-days" hint="วันทำการหลังมอบหมาย">
            <div className="flex items-center gap-3">
              <input
                id="ack-days"
                className="input"
                type="number"
                min={1}
                max={30}
                step={1}
                value={acknowledgmentDays}
                disabled={!canEdit}
                onChange={(event) => setAcknowledgmentDays(Number(event.target.value))}
                required
              />
              <span className="muted shrink-0 text-sm">วันทำการ</span>
            </div>
          </Field>
          <Field label="ตรวจผลภายใน" htmlFor="review-days" hint="วันทำการหลังส่งตรวจ">
            <div className="flex items-center gap-3">
              <input
                id="review-days"
                className="input"
                type="number"
                min={1}
                max={30}
                step={1}
                value={reviewDays}
                disabled={!canEdit}
                onChange={(event) => setReviewDays(Number(event.target.value))}
                required
              />
              <span className="muted shrink-0 text-sm">วันทำการ</span>
            </div>
          </Field>
        </div>
        <div className="border-t border-[#e0e7e5] pt-5">
          <label className="flex items-start gap-3" htmlFor="email-preference">
            <input
              id="email-preference"
              className="mt-1 h-4 w-4 accent-[#53756b]"
              type="checkbox"
              checked={emailNotifications}
              disabled={!canEdit}
              onChange={(event) => setEmailNotifications(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">ต้องการรับการแจ้งเตือนทางอีเมล</span>
              <span className="muted text-small mt-1 block">
                บันทึกความต้องการไว้เท่านั้น ยังไม่เปิดบริการส่งอีเมล
              </span>
            </span>
          </label>
        </div>
        {error && (
          <p id="settings-error" role="alert" className="inline-alert error">
            {error}
          </p>
        )}
        <div className="form-actions">
          {mode === 'demo' && (
            <Button
              variant="secondary"
              type="button"
              onClick={restoreSettings}
              disabled={busy || !canEdit}
            >
              <RotateCcw size={15} />
              คืนค่าตั้งต้น
            </Button>
          )}
          <Button
            type="submit"
            disabled={busy || !canEdit || !dirty}
            title={!dirty ? 'ค่าตรงกับที่บันทึกไว้แล้ว' : undefined}
          >
            <Save size={16} />
            บันทึกการตั้งค่า
          </Button>
        </div>
      </form>
    </Panel>
  );
}
