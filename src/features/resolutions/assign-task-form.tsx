'use client';
import { Button, Field } from '@/components/ui';
import { Plus, X } from 'lucide-react';

import type { ResolutionDetailModel } from './use-resolution-detail';
export function AssignTaskForm({
  model,
}: {
  model: Pick<
    ResolutionDetailModel,
    'submitTask' | 'setAddingTask' | 'activeUsers' | 'resolution' | 'units' | 'busy'
  >;
}) {
  const { submitTask, setAddingTask, activeUsers, resolution, units, busy } = model;
  return (
    <form onSubmit={submitTask} className="inline-form">
      <div className="cluster justify-between">
        <h2>มอบหมายงานตามมติ</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="ปิดแบบมอบหมายงาน"
          onClick={() => setAddingTask(false)}
        >
          <X size={17} />
        </button>
      </div>
      <p className="muted text-small mt-2 mb-5">
        กำหนดสิ่งที่ต้องส่งและวิธีตรวจรับให้ตรงกันก่อนเริ่มงาน
      </p>
      <div className="form-grid">
        <div className="full-width">
          <Field label="ชื่องาน" htmlFor="task-title" required>
            <input
              id="task-title"
              className="input"
              name="title"
              required
              maxLength={200}
              placeholder="เช่น จัดทำร่างแผนพัฒนาบุคลากร"
            />
          </Field>
        </div>
        <Field label="ผู้รับผิดชอบหลัก" htmlFor="task-owner" required>
          <select id="task-owner" className="select" name="ownerId" required defaultValue="">
            <option value="" disabled>
              เลือกผู้รับผิดชอบ
            </option>
            {activeUsers
              .filter((user) => (user.roles ?? [user.role]).includes('owner'))
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="ผู้ตรวจผล" htmlFor="task-reviewer" required>
          <select
            id="task-reviewer"
            className="select"
            name="reviewerId"
            defaultValue={
              activeUsers.find((user) =>
                (user.roles ?? [user.role]).some((role) =>
                  ['reviewer', 'executive'].includes(role),
                ),
              )?.id
            }
          >
            {activeUsers
              .filter((user) =>
                (user.roles ?? [user.role]).some((role) =>
                  ['reviewer', 'executive'].includes(role),
                ),
              )
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="หน่วยงาน" htmlFor="task-unit">
          <select
            id="task-unit"
            className="select"
            name="unit"
            required
            defaultValue={resolution.unit}
          >
            {units.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </Field>
        <Field label="กำหนดส่ง" htmlFor="task-due" required>
          <input
            id="task-due"
            type="date"
            className="input"
            name="dueDate"
            required
            defaultValue={resolution.dueDate}
          />
        </Field>
        <Field label="ความสำคัญ" htmlFor="task-priority">
          <select id="task-priority" className="select" name="priority">
            <option value="normal">ปกติ</option>
            <option value="high">สำคัญมาก</option>
            <option value="low">ทั่วไป</option>
          </select>
        </Field>
        <div className="field justify-center">
          <label className="checkbox-label">
            <input type="checkbox" name="required" defaultChecked />
            งานจำเป็นต่อการปิดมติ
          </label>
        </div>
        <div className="full-width">
          <Field label="สิ่งที่ต้องดำเนินการ" htmlFor="task-description" required>
            <textarea
              id="task-description"
              name="description"
              className="textarea"
              required
              rows={3}
            />
          </Field>
        </div>
        <div className="full-width">
          <Field label="ผลส่งมอบ" htmlFor="task-deliverable" required>
            <input
              id="task-deliverable"
              name="deliverable"
              className="input"
              required
              placeholder="ชื่อเอกสารหรือผลลัพธ์ที่ต้องส่ง"
            />
          </Field>
        </div>
        <div className="full-width">
          <Field
            label="เกณฑ์ตรวจรับ"
            htmlFor="task-criteria"
            required
            hint="แยกแต่ละเกณฑ์ด้วยการขึ้นบรรทัดใหม่"
          >
            <textarea id="task-criteria" name="criteria" className="textarea" required rows={3} />
          </Field>
        </div>
      </div>
      <div className="form-actions">
        <Button disabled={busy} variant="ghost" onClick={() => setAddingTask(false)}>
          ยกเลิก
        </Button>
        <Button disabled={busy} type="submit">
          <Plus size={15} />
          มอบหมายงาน
        </Button>
      </div>
    </form>
  );
}
