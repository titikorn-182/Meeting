'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CheckSquare2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Command,
  Layers3,
  Menu,
  Search,
  Settings2,
  Users,
  X,
  ArrowRightLeft,
} from 'lucide-react';
import clsx from 'clsx';
import { useDemo } from '@/components/demo-provider';
import { Avatar, Dialog, EmptyState } from '@/components/ui';
import { signOut } from '@/app/auth/actions';
import { formatThaiDate } from '@/lib/workflow';
import {
  accessRoleLabels,
  canAccessPage,
  landingPath,
  pageForPath,
  type AccessRole,
} from '@/lib/access-control';

const links = [
  { href: '/', label: 'ภาพรวม', icon: BarChart3 },
  { href: '/meetings', label: 'การประชุม', icon: CalendarDays },
  { href: '/resolutions', label: 'ทะเบียนมติ', icon: ClipboardList },
  { href: '/tasks', label: 'งานของฉัน', icon: CheckSquare2 },
  { href: '/reviews', label: 'ตรวจผลและรับรอง', icon: ClipboardCheck },
  { href: '/changes', label: 'คำขอเปลี่ยนแปลง', icon: ArrowRightLeft },
  { href: '/reports', label: 'รายงาน', icon: BookOpenCheck },
  { href: '/team', label: 'บุคลากรและสิทธิ์', icon: Users },
];

/** Keep contextual labels readable without linking to a page the account cannot open. */
export function AccessLink({ children, ...props }: ComponentProps<typeof Link>) {
  const { access, ready } = useDemo();
  const pathname = typeof props.href === 'string' ? props.href : (props.href.pathname ?? '');
  const page = pageForPath(pathname);
  if (!ready || !page || !canAccessPage(access, page)) {
    if (/(^|\s)(button|icon-button|text-link|nav-link)(\s|$)/.test(props.className ?? ''))
      return null;
    return (
      <span className={props.className} style={props.style}>
        {children}
      </span>
    );
  }
  return <Link {...props}>{children}</Link>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, user, setAccessRole, access, ready, mode, busy, today, organization } = useDemo();
  const home = landingPath(access);
  const page = pageForPath(pathname);
  const hasPages = access.pages.some((key) => canAccessPage(access, key));
  const allowed = page !== null && canAccessPage(access, page);
  const visibleLinks = ready
    ? links.filter((link) => {
        const key = pageForPath(link.href);
        return key !== null && canAccessPage(access, key);
      })
    : [];
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobile = useRef<HTMLDialogElement>(null);
  const unread = state.notifications.filter((item) => !item.read).length;
  const reviewCount = state.tasks.filter((task) => task.status === 'submitted').length;
  const changeCount = state.changes.filter((change) => change.status === 'pending').length;
  const currentLabel =
    links.find((link) => (link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)))
      ?.label ?? (pathname.startsWith('/settings') ? 'การตั้งค่า' : 'การแจ้งเตือน');
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    if (mobileOpen) mobile.current?.showModal();
    else mobile.current?.close();
  }, [mobileOpen]);
  useEffect(() => {
    if (ready && pathname === '/' && !allowed && home !== '/') router.replace(home);
  }, [ready, pathname, allowed, home, router]);

  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? [
        ...state.resolutions
          .filter((item) => `${item.code} ${item.title}`.toLowerCase().includes(normalized))
          .map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.code,
            href: `/resolutions/${item.id}`,
          })),
        ...state.tasks
          .filter((item) => `${item.code} ${item.title}`.toLowerCase().includes(normalized))
          .map((item) => ({
            id: item.id,
            title: item.title,
            meta: item.code,
            href: `/tasks/${item.id}`,
          })),
        ...state.meetings
          .filter((item) => `${item.title} ${item.number}`.toLowerCase().includes(normalized))
          .map((item) => ({
            id: item.id,
            title: item.title,
            meta: `การประชุม ${item.number}`,
            href: `/meetings/${item.id}`,
          })),
      ]
        .filter((result) => {
          const key = pageForPath(result.href);
          return key !== null && canAccessPage(access, key);
        })
        .slice(0, 10)
    : [];
  const navigation = (
    <>
      <AccessLink
        href={home}
        className="brand"
        onClick={() => setMobileOpen(false)}
        aria-label="POLUBU Smart meeting หน้าหลัก"
      >
        <span className="brand-mark">
          <Layers3 size={25} strokeWidth={1.7} />
        </span>
        <span>
          <strong>
            POLUBU<span className="brand-dot">.</span>
          </strong>
          <small>Smart meeting</small>
        </span>
      </AccessLink>
      <div className="workspace-label">
        <span className="workspace-dot" />
        {mode === 'demo' ? 'คณะรัฐศาสตร์' : (organization?.name ?? 'พื้นที่ทำงาน')}
        <small>{mode === 'demo' ? 'มหาวิทยาลัยอุบลราชธานี' : 'ระบบติดตามมติการประชุม'}</small>
      </div>
      <nav aria-label="เมนูหลัก" className="sidebar-nav">
        {visibleLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={clsx(
              'nav-link',
              (href === '/' ? pathname === '/' : pathname.startsWith(href)) && 'active',
            )}
            aria-current={
              (href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined
            }
          >
            <Icon size={19} strokeWidth={1.65} />
            <span>{label}</span>
            {href === '/reviews' && reviewCount > 0 && (
              <span className="nav-count">{reviewCount}</span>
            )}
            {href === '/changes' && changeCount > 0 && (
              <span className="nav-count">{changeCount}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="workspace-note">
          <span className="demo-indicator" />
          {mode === 'demo' ? 'พื้นที่ทดลองใช้งาน' : 'พื้นที่ทำงานที่เชื่อมต่อ'}
          <p>ติดตามทุกมติ ให้เห็นทุกความคืบหน้า</p>
        </div>
        <AccessLink
          href="/settings"
          className={clsx('nav-link', pathname === '/settings' && 'active')}
          onClick={() => setMobileOpen(false)}
        >
          <Settings2 size={19} strokeWidth={1.65} />
          <span>การตั้งค่า</span>
        </AccessLink>
        <div className="sidebar-user">
          <Avatar userId={user.id} />
          <div>
            <strong>{user.name}</strong>
            <small>{accessRoleLabels[access.role]}</small>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <a className="skip-link" href="#main-content">
        ข้ามไปเนื้อหาหลัก
      </a>
      <aside className="sidebar">{navigation}</aside>
      <dialog
        ref={mobile}
        className="mobile-drawer"
        onCancel={() => setMobileOpen(false)}
        onClose={() => setMobileOpen(false)}
        aria-label="เมนูหลัก"
      >
        <button className="drawer-close" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)}>
          <X size={22} />
        </button>
        {navigation}
      </dialog>
      <div className="app-frame">
        <header className="topbar">
          <div className="cluster">
            <button
              className="icon-button mobile-menu-button"
              aria-label="เปิดเมนู"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb">
              <span>พื้นที่ทำงาน</span>
              <ChevronRight size={13} />
              <strong>{currentLabel}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => setSearchOpen(true)}
              aria-label="ค้นหามติ งาน หรือการประชุม"
            >
              <Search size={17} />
              <span>ค้นหามติหรืองาน...</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            {mode === 'demo' && (
              <label className="role-picker">
                <span className="sr-only">มุมมองบทบาททดลอง</span>
                <select
                  value={access.role}
                  onChange={(event) => setAccessRole(event.target.value as AccessRole)}
                >
                  {Object.entries(accessRoleLabels).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mode === 'supabase' && (
              <form action={signOut}>
                <button className="button button-ghost button-sm" type="submit" disabled={busy}>
                  ออกจากระบบ
                </button>
              </form>
            )}
            <AccessLink
              className="icon-button notification-button"
              href="/notifications"
              aria-label={`การแจ้งเตือน ${unread} รายการยังไม่อ่าน`}
            >
              <Bell size={20} />
              {unread > 0 && <span className="notification-dot" />}
            </AccessLink>
            <span
              className="topbar-avatar"
              title={`${user.name} · ${accessRoleLabels[access.role]}`}
            >
              <Avatar userId={user.id} size="sm" />
            </span>
          </div>
        </header>
        <div className="demo-strip">
          <span>
            <span className="demo-dot" />
            {mode === 'demo'
              ? 'ข้อมูลตัวอย่างสำหรับทดลองกระบวนงาน'
              : 'ข้อมูลตามสิทธิของบัญชีที่เข้าสู่ระบบ'}
          </span>
          {mode === 'demo' ? (
            <AccessLink href="/settings" className="text-link">
              จัดการข้อมูลทดลอง <ArrowUpRight size={12} />
            </AccessLink>
          ) : (
            <span aria-live="polite">{busy ? 'กำลังบันทึก…' : 'เชื่อมต่อพื้นที่ทำงานแล้ว'}</span>
          )}
        </div>
        <main id="main-content" className="main-content">
          {!ready ? (
            <p className="muted" role="status">
              กำลังตรวจสอบสิทธิการเข้าถึง…
            </p>
          ) : allowed ? (
            children
          ) : (
            <EmptyState
              icon={Users}
              title={
                hasPages ? 'คุณไม่มีสิทธิเข้าถึงหน้านี้' : 'ยังไม่ได้กำหนดหน้าใช้งานสำหรับบทบาทนี้'
              }
              description={
                hasPages
                  ? 'หน้าที่เปิดยังไม่อยู่ในสิทธิของบทบาทคุณ โปรดติดต่อผู้ดูแลระบบหากจำเป็นต้องใช้งาน'
                  : 'โปรดติดต่อ Admin เพื่อกำหนดหน้าที่คุณใช้งานได้'
              }
            >
              {hasPages && (
                <Link href={home} className="button button-primary">
                  กลับหน้าที่คุณใช้งานได้ <ArrowRight size={16} />
                </Link>
              )}
            </EmptyState>
          )}
        </main>
        <footer className="app-footer">
          <span>POLUBU Smart meeting</span>
          <span>
            {mode === 'demo' ? 'ชุดข้อมูลจำลอง' : 'วันที่ปัจจุบัน'} · {formatThaiDate(today)}
          </span>
        </footer>
      </div>
      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="ค้นหาในพื้นที่ทำงาน"
        description="ค้นหาด้วยชื่อเรื่อง รหัสมติ งาน หรือครั้งประชุม"
      >
        <div className="search-input">
          <Search size={19} />
          <input
            className="input"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="เช่น แผนพัฒนาบุคลากร"
            aria-label="คำค้นหา"
          />
        </div>
        {!normalized ? (
          <div className="search-suggestions">
            <p className="muted text-small">ทางลัดที่ใช้บ่อย</p>
            {['แผน', 'หลักสูตร', 'รายงาน'].map((word) => (
              <button
                className="button button-secondary button-sm"
                key={word}
                onClick={() => setQuery(word)}
              >
                {word}
              </button>
            ))}
          </div>
        ) : results.length ? (
          <div className="global-results">
            {results.map((result) => (
              <Link
                key={result.id}
                href={result.href}
                onClick={() => {
                  setSearchOpen(false);
                  setQuery('');
                }}
              >
                <span>
                  <small>{result.meta}</small>
                  <strong>{result.title}</strong>
                </span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="ยังไม่พบรายการนี้"
            description="ลองใช้คำค้นที่สั้นลง หรือค้นหาด้วยรหัสมติ"
          />
        )}
      </Dialog>
    </>
  );
}
