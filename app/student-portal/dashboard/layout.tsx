'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  {
    label: 'Overview',
    href: '/student-portal/dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zm10-2a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
      </svg>
    ),
  },
  {
    label: 'Attendance',
    href: '/student-portal/dashboard/attendance',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Assignments',
    href: '/student-portal/dashboard/assignments',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: 'Placement',
    href: '/student-portal/dashboard/jobs',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Applications',
    href: '/student-portal/dashboard/applications',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: 'My CV',
    href: '/student-portal/dashboard/cv',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [studentName, setStudentName] = useState(() =>
    typeof window !== 'undefined' ? (sessionStorage.getItem('sit_student_name') ?? '') : ''
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/student-portal/auth/session');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const data = await res.json();
        if (active) {
          const name = data.user?.name ?? '';
          sessionStorage.setItem('sit_student_name', name);
          setStudentName(name);
        }
      } catch { /* silent */ }
    })();
    return () => { active = false; };
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/student-portal/auth/logout', { method: 'POST' });
    router.push('/student-portal/signin');
  };

  const isActive = (href: string) =>
    href === '/student-portal/dashboard' ? pathname === href : pathname.startsWith(href);

  const currentItem = navItems.find(item => isActive(item.href));
  const firstName = studentName.split(' ')[0] || 'Student';
  const initials = (studentName || 'S').charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-[linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(42,107,181,0.08)_100%)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-[#2E3093]/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-[260px] flex flex-col overflow-hidden border-r border-white/20 transform transition-all duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
        style={{ background: 'linear-gradient(180deg, #2E3093 0%, #2A6BB5 100%)' }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[#FAE452]" />
        <div className="absolute -top-10 right-0 h-36 w-36 rounded-full bg-[#FAE452]/12 blur-3xl pointer-events-none" />
        <div className="absolute bottom-12 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        {/* Logo area */}
        <div className="relative px-4 pb-5 pt-6">
          <div className="rounded-[24px] border border-white/20 bg-white/96 px-4 py-4 shadow-[0_18px_45px_rgba(46,48,147,0.18)] backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-[#FAE452] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#2E3093]">
                Student Portal
              </span>
              <span className="h-2 w-2 rounded-full bg-[#2A6BB5]" />
            </div>
            <div className="flex h-16 items-center justify-center rounded-2xl border border-[#2A6BB5]/12 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sit.png" alt="SIT" className="h-12 w-auto object-contain" />
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-4 py-2">
          <div className="mb-4 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">Navigation</p>
            <p className="mt-1 text-xs text-white/70">Focused access to your academic workspace.</p>
          </div>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`group relative mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium transition-all duration-200
                ${isActive(item.href)
                  ? 'bg-white text-[#2E3093] shadow-[0_16px_35px_rgba(46,48,147,0.18)]'
                  : 'text-white/78 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${isActive(item.href)
                ? 'border-[#FAE452] bg-[#FAE452] text-[#2E3093]'
                : 'border-white/12 bg-white/8 text-white/78 group-hover:border-white/20 group-hover:bg-white/12 group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              <span className={`h-2 w-2 rounded-full transition-all ${isActive(item.href) ? 'bg-[#2A6BB5]' : 'bg-transparent group-hover:bg-[#FAE452]'}`} />
            </Link>
          ))}
        </nav>

        {/* Student info + logout */}
        <div className="relative px-4 pb-4 pt-3">
          <div className="rounded-[24px] border border-white/14 bg-white/10 p-3 backdrop-blur-sm">
            {studentName && (
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FAE452] text-xs font-black text-[#2E3093] shadow-[0_10px_24px_rgba(250,228,82,0.24)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-white">{studentName}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/58">Student</p>
                </div>
              </div>
            )}
            <div className="mb-3 h-px bg-white/12" />
            <p className="mb-3 text-[11px] leading-5 text-white/72">Keep track of attendance, assignments, placements, and applications from one place.</p>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-white/14 bg-white/8 px-3 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/14"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-10 shrink-0 border-b border-[#2A6BB5]/10 bg-white/88 backdrop-blur-xl">
          <div className="h-1 w-full bg-[linear-gradient(90deg,_#FAE452_0%,_#2A6BB5_50%,_#2E3093_100%)]" />
          <div className="flex items-center gap-3 px-4 py-4 sm:px-5 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2A6BB5]/12 bg-white text-[#2E3093] transition-colors hover:bg-[#FAE452]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2A6BB5]">
                <span>Student Portal</span>
                <span className="h-1 w-1 rounded-full bg-[#FAE452]" />
                <span>{currentItem?.label ?? 'Dashboard'}</span>
              </div>
              <h1 className="mt-1 truncate text-lg font-semibold text-[#2E3093]">
                {currentItem?.label ?? 'Dashboard'}
              </h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center rounded-full border border-[#2A6BB5]/12 bg-[#2A6BB5]/[0.06] px-3 py-2 sm:flex">
                <div className="mr-2 h-2 w-2 rounded-full bg-[#FAE452]" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2A6BB5]">Active</p>
                  <p className="text-xs font-medium text-[#2E3093]">{firstName}</p>
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#2E3093_0%,_#2A6BB5_100%)] text-[11px] font-bold text-white shadow-[0_12px_28px_rgba(42,107,181,0.22)]">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
