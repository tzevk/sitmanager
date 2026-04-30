'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  {
    label: 'Home',
    href: '/student-portal/dashboard',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Attendance',
    href: '/student-portal/dashboard/attendance',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Assignments',
    href: '/student-portal/dashboard/assignments',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
];

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [studentName, setStudentName] = useState('');

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

  const initials = (studentName || 'S').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f8]">

      {/* App bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sit.png" alt="SIT" className="h-7 w-auto object-contain" />
          <div className="w-px h-4 bg-gray-200" />
          <p className="text-sm font-bold text-[#2E3093] flex-1 truncate">
            {navItems.find(item => isActive(item.href))?.label ?? 'Dashboard'}
          </p>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5"
            title="Sign out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#2E3093] flex items-center justify-center text-[10px] font-black text-white">
            {initials}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-[68px]">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30 bg-white border-t border-gray-100">
        <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-3 relative transition-colors
                  ${active ? 'text-[#2E3093]' : 'text-gray-400'}`}
              >
                {active && (
                  <span className="absolute top-0 inset-x-0 h-[3px] bg-[#FAE452] rounded-b" />
                )}
                {item.icon}
                <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
