'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import ForceChangePasswordModal from './_components/ForceChangePasswordModal';

/*
 * Student Portal shell.
 *  - Desktop (≥1024px): fixed left sidebar.
 *  - Tablet (768–1023px): top bar + slide-in navigation drawer.
 *  - Mobile (<768px): top bar + bottom navigation (Home, Schedule, Tasks, More);
 *    "More" opens a sheet with the remaining pages.
 * The dashboard uses the full content width; the other portal pages were built
 * for a phone-width column, so they stay in a centered narrow column until they
 * are redesigned.
 */

type NavItem = { label: string; href: string; icon: React.ReactNode };

const icon = (d: string) => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const HOME = { label: 'Home', href: '/student-portal/dashboard', icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6') };
const SCHEDULE = { label: 'Schedule', href: '/student-portal/dashboard/lecture-plan', icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z') };
const ATTENDANCE = { label: 'Attendance', href: '/student-portal/dashboard/attendance', icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4') };
const ASSIGNMENTS = { label: 'Assignments', href: '/student-portal/dashboard/assignments', icon: icon('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z') };
const NOTICES = { label: 'Notices', href: '/student-portal/dashboard/notices', icon: icon('M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9') };

const SIDEBAR_ITEMS: NavItem[] = [HOME, SCHEDULE, ATTENDANCE, ASSIGNMENTS, NOTICES];
const MORE_ITEMS: NavItem[] = [ATTENDANCE, NOTICES];

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [studentName, setStudentName] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/student-portal/auth/session');
        const data = await res.json().catch(() => null);
        if (!active) return;
        // The session check answers 200 with authenticated:false when signed out.
        if (!res.ok || !data?.authenticated) { router.push('/student-portal/signin'); return; }
        const name = data.user?.name ?? '';
        try { sessionStorage.setItem('sit_student_name', name); } catch { /* storage blocked */ }
        setStudentName(name);
        setMustChangePassword(Boolean(data.user?.mustChangePassword));
        setSessionChecked(true);
      } catch { /* network blip — pages show their own error state */ }
    })();
    return () => { active = false; };
  }, [router]);

  // Overlays close when a link in them is followed (closeOverlays) or on Escape.
  const closeOverlays = useCallback(() => { setDrawerOpen(false); setMoreOpen(false); }, []);
  useEffect(() => {
    if (!drawerOpen && !moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDrawerOpen(false); setMoreOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, moreOpen]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/student-portal/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/student-portal/signin');
  }, [router]);

  const isActive = (href: string) =>
    href === '/student-portal/dashboard' ? pathname === href : pathname.startsWith(href);
  const isDashboard = pathname === '/student-portal/dashboard';
  const pageTitle = SIDEBAR_ITEMS.find((i) => isActive(i.href))?.label ?? 'Student Portal';
  const initials = (studentName || 'S').split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  if (sessionChecked && mustChangePassword) {
    return <ForceChangePasswordModal onDone={() => setMustChangePassword(false)} />;
  }

  const navLink = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={closeOverlays}
        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active ? 'bg-[#2E3093] text-white' : 'text-[#52525B] hover:bg-[#2E3093]/[0.06] hover:text-[#2E3093]'
        }`}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#FAE452]" aria-hidden />}
        {item.icon}
        {item.label}
      </Link>
    );
  };

  const sidebarBody = (
    <>
      <div className="flex items-center gap-2.5 px-5 h-16 bg-[#2E3093]">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sit.png" alt="SIT" className="h-6 w-auto object-contain" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Student Portal</p>
          <p className="text-[11px] text-[#FAE452]">Suvidya Institute of Technology</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-label="Student portal">
        {SIDEBAR_ITEMS.map(navLink)}
      </nav>
      <div className="border-t border-[#E4E4E7] p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-[#FAE452] text-[#2E3093] text-[11px] font-bold flex items-center justify-center shrink-0">{initials}</div>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#18181B]">{studentName || 'Student'}</p>
        </div>
        <button onClick={handleLogout}
          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B]">
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-60 flex-col bg-white border-r border-[#E4E4E7]">
        {sidebarBody}
      </aside>

      {/* Tablet drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/30" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[85vw] flex flex-col bg-white shadow-xl">
            {sidebarBody}
          </aside>
        </div>
      )}

      <div className="lg:pl-60 min-w-0">
        {/* Top bar (tablet + mobile) */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#2E3093] text-white">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              onClick={() => setDrawerOpen(true)}
              className="hidden md:inline-flex -ml-1 p-2 rounded-lg text-white/90 hover:bg-white/10"
              aria-label="Open navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sit.png" alt="SIT" className="h-5 w-auto object-contain" />
            </span>
            <p className="flex-1 truncate text-sm font-semibold text-white">{pageTitle}</p>
            <div className="w-8 h-8 rounded-full bg-[#FAE452] text-[#2E3093] text-[11px] font-bold flex items-center justify-center" aria-hidden>
              {initials}
            </div>
          </div>
        </header>

        <main className={`pb-[76px] md:pb-0 ${isDashboard ? '' : 'max-w-2xl mx-auto'}`}>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E4E4E7]" aria-label="Student portal">
        <div className="grid grid-cols-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {[
            { ...HOME },
            { ...SCHEDULE },
            { ...ASSIGNMENTS, label: 'Tasks' },
          ].map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 h-14 text-[11px] font-medium ${active ? 'text-[#2E3093] font-semibold' : 'text-[#71717A]'}`}>
                {active && <span className="absolute top-0 inset-x-5 h-[3px] rounded-b bg-[#FAE452]" aria-hidden />}
                {item.icon}
                {item.label}
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-1 h-14 text-[11px] font-medium ${MORE_ITEMS.some((i) => isActive(i.href)) ? 'text-[#2E3093]' : 'text-[#71717A]'}`}>
            {icon('M4 6h16M4 12h16M4 18h16')}
            More
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="More">
          <button className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-3 pb-6 shadow-xl" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#E4E4E7]" />
            <div className="space-y-0.5">{MORE_ITEMS.map(navLink)}</div>
            <div className="mt-2 border-t border-[#E4E4E7] pt-2">
              <button onClick={handleLogout} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#71717A] hover:bg-[#F4F4F5]">
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
