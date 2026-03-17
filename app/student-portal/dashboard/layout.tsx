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
  const [studentName, setStudentName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/student-portal/auth/session');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const data = await res.json();
        if (active) setStudentName(data.user?.name ?? '');
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f5]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — dark gradient */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-[260px] flex flex-col transform transition-all duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
        style={{ background: 'linear-gradient(180deg, #1a1d5e 0%, #2E3093 40%, #2A6BB5 100%)' }}
      >
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FAE452]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-0 w-40 h-40 bg-[#2A6BB5]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Logo area */}
        <div className="relative flex items-center justify-center px-4 py-6">
          <div className="w-full h-20 rounded-2xl overflow-hidden bg-white flex items-center justify-center shrink-0 border-2 border-[#FAE452] shadow-lg shadow-[#FAE452]/20 px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sit.png" alt="SIT" className="h-14 w-auto object-contain" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/10" />

        {/* Nav items */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Menu</p>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200
                ${isActive(item.href)
                  ? 'bg-white/15 text-white shadow-lg shadow-black/10 backdrop-blur-sm'
                  : 'text-white/60 hover:bg-white/8 hover:text-white'}`}
            >
              {isActive(item.href) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#FAE452]" />
              )}
              <span className={`transition-colors ${isActive(item.href) ? 'text-[#FAE452]' : 'text-white/40 group-hover:text-white/70'}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Student info + logout */}
        <div className="relative px-4 py-4">
          <div className="mx-1 mb-3 h-px bg-white/10" />
          {studentName && (
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FAE452] to-[#f0c030] flex items-center justify-center text-[#2E3093] text-xs font-black shrink-0 shadow-lg shadow-[#FAE452]/20">
                {studentName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{studentName}</p>
                <p className="text-[10px] text-white/35">Student</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-red-300 hover:bg-white/5 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-5 py-3.5 flex items-center gap-3 shrink-0 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-[15px] font-bold text-gray-900 truncate">
              {navItems.find(n => isActive(n.href))?.label ?? 'Dashboard'}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {studentName && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-gray-500">Welcome,</span>
                <span className="text-xs font-semibold text-gray-800">{studentName.split(' ')[0]}</span>
              </div>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] flex items-center justify-center text-white text-[11px] font-bold lg:hidden">
              {(studentName || 'S').charAt(0).toUpperCase()}
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
