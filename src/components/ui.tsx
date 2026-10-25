'use client';

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Inbox, X, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useWorkspace } from '@/components/workspace-context';

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type={type}
      className={clsx('button', `button-${variant}`, size === 'sm' && 'button-sm', className)}
      {...props}
    >
      {children}
    </button>
  );
}
const statusMap: Record<string, { label: string; tone: string }> = {
  assigned: { label: 'รอรับทราบ', tone: 'neutral' },
  in_progress: { label: 'กำลังดำเนินการ', tone: 'info' },
  submitted: { label: 'ส่งตรวจแล้ว', tone: 'warning' },
  revision: { label: 'ให้แก้ไข', tone: 'danger' },
  accepted: { label: 'ตรวจรับแล้ว', tone: 'success' },
  cancelled: { label: 'ยกเลิก', tone: 'neutral' },
  open: { label: 'เปิดติดตาม', tone: 'info' },
  pending_close: { label: 'รอรับรองปิด', tone: 'warning' },
  closed: { label: 'ปิดมติแล้ว', tone: 'success' },
  acknowledged: { label: 'รับทราบ', tone: 'neutral' },
  pending: { label: 'รอพิจารณา', tone: 'warning' },
  approved: { label: 'อนุมัติแล้ว', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'danger' },
  scheduled: { label: 'นัดหมายแล้ว', tone: 'info' },
  completed: { label: 'ประชุมแล้ว', tone: 'success' },
  high: { label: 'สำคัญมาก', tone: 'danger' },
  normal: { label: 'ปกติ', tone: 'neutral' },
  low: { label: 'ทั่วไป', tone: 'neutral' },
  overdue: { label: 'เกินกำหนด', tone: 'danger' },
  action: { label: 'มอบหมาย', tone: 'info' },
  approval: { label: 'เห็นชอบ', tone: 'success' },
  acknowledgment: { label: 'รับทราบ', tone: 'neutral' },
  recurring: { label: 'ต่อเนื่อง', tone: 'warning' },
};
export function Badge({
  status,
  tone,
  children,
}: {
  status?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children?: ReactNode;
}) {
  const mapped = status ? statusMap[status] : undefined;
  return (
    <span className={clsx('badge', `badge-${tone ?? mapped?.tone ?? 'neutral'}`)}>
      <span className="badge-dot" />
      {children ?? mapped?.label ?? status}
    </span>
  );
}
export function Avatar({ userId, size = 'md' }: { userId?: string; size?: 'sm' | 'md' }) {
  const { users } = useWorkspace();
  const user = users.find((item) => item.id === userId);
  return (
    <span
      className={clsx('avatar', size === 'sm' && 'avatar-sm')}
      title={user?.name}
      aria-label={user?.name}
      style={{ backgroundColor: user?.avatarColor ?? '#e6eeeb' }}
    >
      {user?.initials ?? '—'}
    </span>
  );
}
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon size={36} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('panel', className)}>
      {(title || action) && (
        <div className="panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="required-mark"> *</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    else if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={clsx('dialog', wide && 'dialog-wide')}
      onCancel={onClose}
      onClose={onClose}
      aria-label={title}
      onClick={(event) => {
        if (event.target === ref.current) {
          const bounds = ref.current.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button type="button" className="icon-button" aria-label="ปิดหน้าต่าง" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div className="progress-wrap">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'ความก้าวหน้า'}
      >
        <span style={{ width: `${safe}%` }} />
      </div>
      <span className="progress-label">{safe}%</span>
    </div>
  );
}
