'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { PermissionProvider, usePermissions } from '@/lib/permissions-context';

// ── Static data hoisted outside component to avoid re-creation ──────
const MENU_ITEMS = [
  'Dashboard',
  'General Master',
  'Masters',
  'Admission Activity',
  'Daily Activities',
  'Admin/Accounts',
  'Corporate Training',
  'Placement',
  'Reports',
  'Role Right',
  'Utility',
] as const;

const SUB_MENU_ROUTES: Record<string, string> = {
  'Masters > Training': '/dashboard/masters/course',
  'Masters > Annual Batch': '/dashboard/masters/annual-batch',
  'Masters > Batch Category': '/dashboard/masters/batch-category',
  'Masters > Batch': '/dashboard/masters/batch',
  'Masters > Status': '/dashboard/masters/status',
  'Masters > Holiday': '/dashboard/masters/holiday',
  'Masters > Book Code': '/dashboard/masters/book-code',
  'Masters > College': '/dashboard/masters/college',
  'Masters > Employee': '/dashboard/masters/employee',
  'Masters > Library Book': '/dashboard/masters/library-book',
  'Masters > Trainer': '/dashboard/masters/faculty',
  'Admin/Accounts > Employee Profession Tax': '/dashboard/account-master/employee-profession-tax',
  'Admin/Accounts > Account Head': '/dashboard/account-master/account-head',
  'Admin/Accounts > Assets': '/dashboard/account-master/assets',
  'Admin/Accounts > Asset Category': '/dashboard/account-master/asset-category',
  'Admission Activity > Inquiry': '/dashboard/inquiry',
  'Admission Activity > Online Admission': '/dashboard/online-admission',
  'Admission Activity > Student': '/dashboard/student',
  'Corporate Training > Corporate Inquiry': '/dashboard/corporate-inquiry',
  'Corporate Training > Training Execution': '/dashboard/corporate-inquiry/execution',
  'Reports > Inquiry': '/dashboard/reports/inquiry',
  'Reports > Inquiry Report': '/dashboard/reports/inquiry',
  'Reports > Online Students': '/dashboard/reports/online-student',
  'Reports > Full Attendance Report': '/dashboard/reports/attendance',
  'Role Right > Roles & Permissions': '/dashboard/role-right',
  'Role Right > Create User': '/dashboard/role-right?tab=create-user',
  'Role Right > Add Employee': '/dashboard/masters/employee/add',
  'Role Right > Portal Accounts': '/dashboard/portal-accounts',
  'Daily Activities > Allot Roll Number': '/dashboard/daily-activities/allot-roll-number',
  'Daily Activities > Lecture Taken': '/dashboard/daily-activities/lecture-taken',
  'Daily Activities > Assignments Taken': '/dashboard/daily-activities/assignments-taken',
  'Daily Activities > Unit Test Taken': '/dashboard/daily-activities/unit-test-taken',
  'Daily Activities > Viva / MOC Taken': '/dashboard/daily-activities/viva-moc-taken',
  'Daily Activities > Final Exam Taken': '/dashboard/daily-activities/final-exam-taken',
  'Daily Activities > Site Visit': '/dashboard/daily-activities/site-visit',
  'Daily Activities > Generate Final Result': '/dashboard/daily-activities/generate-final-result',
  'Daily Activities > Trainer Working Hours': '/dashboard/daily-activities/faculty-working',
  'Daily Activities > Feedback': '/dashboard/daily-activities/feedback',
  'Placement > Consultancy Master': '/dashboard/masters/consultancy',
  'Placement > CV Shortlisted': '/dashboard/cv-shortlisted',
  'Placement > Consultancy Report': '/dashboard/reports/consultancy',
  'Placement > Job Postings': '/dashboard/placement',
  'Placement > Mock Interviews': '/dashboard/placement/mock-interviews',
  'Placement > Email Company': '/dashboard/placement/email-company',
  'Utility > Festival Photo Upload': '/dashboard/utility/festival-photo-upload',
};

const SUB_MENUS: Record<string, string[]> = {
  'General Master': [
    'Discipline',
    'Qualification',
    'Bank',
    'Fees Notes',
    'Holiday',
    'Location',
    'Extention',
    'Rack',
    'Material Category',
    'Vendor Type Master',
    'Vendor Master',
    'Material Price',
    'TDS',
    'Tax',
    'Salary Master',
    'Project Master',
    'MLWF Master',
    'QMA Master',
  ],
  'Masters': [
    'Training',
    'Annual Batch',
    'Batch Category',
    'Batch',
    'Status',
    'Holiday',
    'Book Code',
    'College',
    'Employee',
    'Library Book',
    'Trainer',
  ],
  'Admission Activity': [
    'Inquiry',
    'Online Admission',
    'Student',
  ],
  'Daily Activities': [
    'Allot Roll Number',
    'Lecture Taken',
    'Assignments Taken',
    'Unit Test Taken',
    'Viva / MOC Taken',
    'Final Exam Taken',
    'Generate Final Result',
    'Trainer Working Hours',
    'Feedback',
    'Site Visit',
  ],
  'Reports': [
    'Inquiry',
    'Online Students',
    'Full Attendance Report',
    'Student Batch Wise',
    'Student Report',
    'Batch Record',
    'Site Visit List',
    'Corporate Inquiry',
    'Corporate Record',
    'College Follow Up',
    'Convocation Guest List',
    'Yearly Mock',
    'Annual Batch Plan',
    'Final Exam',
    'Fees Report',
    'SMS / Email Send Report',
    'Service Tax Report On Fees',
    'Lecture Report',
    'Feedback Analysis Lecture Wise',
    'New FeedBack Analysis',
    'Student Search for Interview',
    'Batch Analysis Report',
    'Payment Collection Report',
    'Trainer Salary Report',
    'Trainer Monthly Statement',
    'Inquiry Report',
  ],
  'Admin/Accounts': [
    'Employee Profession Tax',
    'Account Head',
    'Assets',
    'Asset Category',
    'Fees Details',
    'Purchase Material',
    'Trainer Payment',
    'Cash Voucher',
    'Stock View',
    'Material Consumption',
    'Employee Salary',
    'Employee Attendance',
    'Employee Loan',
    'Batch Left',
    'Batch Moving',
    'Batch Transfer',
    'Batch Cancellation',
    'Employee Training',
  ],
  'Corporate Training': [
    'Corporate Inquiry',
    'Training Execution',
  ],
  'Utility': [
    'Festival Photo Upload',
    'Notice Board',
    'MASS SMS',
    'Mass Email',
    'Upload Event Photo',
    'Upload Testimonial Photo',
    'Upload Banner Image',
    'Export Contacts',
    'QMS Does',
    'Mass WhatsApp',
    'Task Managements',
    'Email Master',
  ],
  'Placement': [
    'Job Postings',
    'Mock Interviews',
    'Email Company',
    'Consultancy Master',
    'CV Shortlisted',
    'Latest CV Updated',
    'Convocation Guest List',
    'Consultancy Report',
    'Student Placement Report',
    'View Student CV Folder',
    'Company Requirment Master',
    'Shortlisted By Company',
  ],
  'Role Right': [
    'Roles & Permissions',
    'Create User',
    'Add Employee',
    'Portal Accounts',
  ],
};

const SUB_MENU_PERMISSIONS: Record<string, string[]> = {
  'Masters > Training': ['course.view'],
  'Masters > Annual Batch': ['annual_batch.view'],
  'Masters > Batch Category': ['batch_category.view'],
  'Masters > Batch': ['batch.view'],
  'Masters > Status': ['status.view'],
  'Masters > Holiday': ['holiday.view'],
  'Masters > Book Code': ['book_code.view'],
  'Masters > College': ['college.view'],
  'Masters > Employee': ['employee.view'],
  'Masters > Library Book': ['library_book.view'],
  'Masters > Trainer': ['faculty.view'],
  'Admin/Accounts > Employee Profession Tax': ['profession_tax.view'],
  'Admin/Accounts > Account Head': ['account_head.view'],
  'Admin/Accounts > Assets': ['assets.view'],
  'Admin/Accounts > Asset Category': ['asset_category.view'],
  'Admission Activity > Inquiry': ['inquiry.view'],
  'Admission Activity > Online Admission': ['online_admission.view'],
  'Admission Activity > Student': ['student.view'],
  'Corporate Training > Corporate Inquiry': ['corporate_inquiry.view'],
  'Corporate Training > Training Execution': ['corporate_inquiry.view'],
  'Reports > Inquiry': ['report_inquiry.view'],
  'Reports > Inquiry Report': ['report_inquiry.view'],
  'Reports > Online Students': ['report_online_students.view'],
  'Reports > Full Attendance Report': ['report_attendance.view'],
  'Role Right > Roles & Permissions': ['role.view'],
  'Role Right > Create User': ['user.create'],
  'Role Right > Add Employee': ['employee.create'],
  'Role Right > Portal Accounts': ['user.create'],
  'Daily Activities > Allot Roll Number': ['roll_number.view'],
  'Daily Activities > Lecture Taken': ['lecture.view'],
  'Daily Activities > Assignments Taken': ['assignment.view'],
  'Daily Activities > Unit Test Taken': ['unit_test.view'],
  'Daily Activities > Viva / MOC Taken': ['viva_moc.view'],
  'Daily Activities > Final Exam Taken': ['final_exam.view'],
  'Daily Activities > Site Visit': ['site_visit.view'],
  'Daily Activities > Generate Final Result': ['final_result.view'],
  'Daily Activities > Trainer Working Hours': ['faculty_working_hours.view'],
  'Daily Activities > Feedback': ['feedback1.view'],
  'Placement > Consultancy Master': ['consultancy.view'],
  'Placement > CV Shortlisted': ['cv_shortlisted.view'],
  'Placement > Consultancy Report': ['consultancy_report.view'],
  'Placement > Job Postings': ['placement.view'],
  'Placement > Mock Interviews': ['mock_interview.view'],
  'Placement > Email Company': ['placement.view'],
  'Utility > Festival Photo Upload': ['festival_photo.view'],
};

const WELCOME_QUOTES: Array<{ text: string; author: string }> = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
  { text: "Hard work beats talent when talent doesn't work hard.", author: 'Tim Notke' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
  { text: 'Success usually comes to those who are too busy to be looking for it.', author: 'Henry David Thoreau' },
  { text: "Opportunities don't happen. You create them.", author: 'Chris Grosser' },
  { text: 'Great things never come from comfort zones.', author: '' },
  { text: 'Dream it. Wish it. Do it.', author: '' },
];

function pickDeterministicQuote(seed: string) {
  if (!seed) return WELCOME_QUOTES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return WELCOME_QUOTES[hash % WELCOME_QUOTES.length];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionProvider>
      <DashboardShell>{children}</DashboardShell>
    </PermissionProvider>
  );
}

function getInitials(firstName?: string, lastName?: string, email?: string) {
  const safe = (s?: string) => (s || '').trim();
  const f = safe(firstName);
  const l = safe(lastName);

  if (f || l) {
    return `${f[0] || ''}${l[0] || ''}`.toUpperCase() || 'U';
  }
  const e = safe(email);
  if (e) return e[0].toUpperCase();
  return 'U';
}

function NavbarUserSkeleton() {
  return (
    <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/10 min-w-[180px] animate-pulse">
      <div className="w-7 h-7 rounded-full bg-white/30" />
      <div className="min-w-0 leading-tight flex-1 space-y-1">
        <div className="h-2.5 w-24 bg-white/30 rounded" />
        <div className="h-2 w-16 bg-white/20 rounded" />
      </div>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, isSuperAdmin, hasAnyPermission } = usePermissions();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('sit-admin-welcome-seen') !== '1';
    } catch {
      return true;
    }
  });
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuScrollRef = useRef<HTMLDivElement | null>(null);

  const getActiveFromPath = (path: string) => {
    if (path === '/dashboard' || path === '/dashboard/') return 'Dashboard';
    if (path.startsWith('/dashboard/masters')) return 'Masters';
    if (path.startsWith('/dashboard/daily-activities')) return 'Daily Activities';
    if (path.startsWith('/dashboard/account-master')) return 'Admin/Accounts';
    if (path.startsWith('/dashboard/reports')) return 'Reports';
    if (path.startsWith('/dashboard/role-right')) return 'Role Right';
    if (path.startsWith('/dashboard/portal-accounts')) return 'Role Right';
    if (path.startsWith('/dashboard/corporate-inquiry')) return 'Corporate Training';
    if (path.startsWith('/dashboard/utility')) return 'Utility';
    if (path.startsWith('/dashboard/inquiry') || path.startsWith('/dashboard/online-admission') || path.startsWith('/dashboard/student')) return 'Admission Activity';
    if (path.startsWith('/dashboard/placement') || path.startsWith('/dashboard/cv-shortlisted')) return 'Placement';
    return 'Dashboard';
  };

  const activeMenu = getActiveFromPath(pathname);

  const canAccessSubMenu = useCallback((menuKey: string, subItem: string) => {
    if (isSuperAdmin) return true;

    const routeKey = `${menuKey} > ${subItem}`;
    const route = SUB_MENU_ROUTES[routeKey];
    if (!route) return false;

    const required = SUB_MENU_PERMISSIONS[routeKey];
    if (!required || required.length === 0) return false;

    return hasAnyPermission(required);
  }, [hasAnyPermission, isSuperAdmin]);

  const visibleMenuItems = MENU_ITEMS.filter((item) => {
    if (item === 'Dashboard') return true;
    const subItems = SUB_MENUS[item] ?? [];
    return subItems.some((subItem) => canAccessSubMenu(item, subItem));
  });

  const handleSignOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    try {
      sessionStorage.removeItem('sit-session-cache');
      sessionStorage.removeItem('sit-dashboard-cache');
      sessionStorage.removeItem('sit-admin-welcome-seen');
    } catch { /* ignore */ }
    router.push('/signin');
  }, [router]);

  const closeDropdown = useCallback(() => {
    setOpenDropdown(null);
    setDropdownPos(null);
  }, []);

  const updateDropdownPos = useCallback((menuKey: string) => {
    const el = menuButtonRefs.current[menuKey];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 256; // Tailwind w-64
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setDropdownPos({ left, top: rect.bottom + 4 });
  }, []);

  useEffect(() => {
    if (!openDropdown) return;
    const onResize = () => updateDropdownPos(openDropdown);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [openDropdown, updateDropdownPos]);

  useEffect(() => {
    if (!session || !showWelcome) return;
    try {
      sessionStorage.setItem('sit-admin-welcome-seen', '1');
    } catch {}
  }, [session, showWelcome]);

  const welcomeQuote = pickDeterministicQuote(
    `${session?.email ?? ''}|${session?.firstName ?? ''}|${session?.lastName ?? ''}|${session?.role ?? ''}`,
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Close dropdown when clicking outside */}
      {openDropdown && (
        <div className="fixed inset-0 z-30" onClick={closeDropdown} />
      )}

      {/* Navbar */}
      <nav className="bg-[#2A6BB5] shrink-0 z-40 overflow-y-visible border-b border-white/15 shadow-[0_6px_24px_rgba(46,48,147,0.18)]">
        <div className="grid grid-cols-[auto_1fr_auto] items-center h-12 px-3 gap-3 relative">
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/20" />
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-[15px] font-bold tracking-[0.14em] leading-none whitespace-nowrap"
              style={{ fontFamily: 'var(--font-libre-franklin), sans-serif', color: '#FAE452' }}
            >
              SIT MANAGER
            </span>
          </div>

          {/* Menu (centered) */}
          <div
            ref={menuScrollRef}
            className="overflow-x-auto overflow-y-visible"
            onScroll={() => {
              if (openDropdown) updateDropdownPos(openDropdown);
            }}
          >
            <div className="flex items-center gap-1.5 h-12 px-1 w-max mx-auto relative">
              {visibleMenuItems.map((item) => (
                <div key={item} className="relative">
                  <button
                    ref={(el) => {
                      menuButtonRefs.current[item] = el;
                    }}
                    onClick={() => {
                      if (item === 'Dashboard') {
                        setOpenDropdown(null);
                        setDropdownPos(null);
                        router.push('/dashboard');
                      } else if (SUB_MENUS[item]) {
                        const next = openDropdown === item ? null : item;
                        setOpenDropdown(next);
                        if (next) updateDropdownPos(next);
                        else setDropdownPos(null);
                      } else {
                        setOpenDropdown(null);
                        setDropdownPos(null);
                      }
                    }}
                    className={`px-3.5 h-9 text-[13px] font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1 rounded-md relative ${
                      activeMenu === item
                        ? "bg-[#FAE452] text-[#2E3093] shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
                        : 'bg-transparent text-white/90 hover:bg-[#FAE452] hover:text-[#2E3093]'
                    }`}
                  >
                    {item}
                    {SUB_MENUS[item] && (
                      <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 min-w-0">
            {/* User chip */}
            {loading ? (
              <NavbarUserSkeleton />
            ) : (
              <div
                className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/10 text-white min-w-0"
                title={session?.email || ''}
              >
                <div className="w-7 h-7 rounded-full bg-[#FAE452] text-[#2E3093] flex items-center justify-center text-[12px] font-extrabold">
                  {getInitials(session?.firstName, session?.lastName, session?.email)}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-[12px] font-semibold truncate max-w-[180px]">
                    {session
                      ? `${session.firstName} ${session.lastName}`.trim() || session.email
                      : 'Guest'}
                  </div>
                  <div className="text-[10px] text-white/75 truncate max-w-[180px]">
                    {session
                      ? isSuperAdmin
                        ? 'Super Admin'
                        : session.department || `Role ${session.role}`
                      : ''}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if ('Notification' in window) {
                  Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                      new Notification('SIT Manager', { body: 'Notifications are enabled!' });
                    }
                  });
                }
              }}
              className="relative p-2 rounded-lg text-white hover:bg-[#FAE452] hover:text-[#2E3093] transition-colors"
              title="Notifications"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-white hover:bg-[#FAE452] hover:text-[#2E3093] transition-colors"
              title="Sign Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs font-semibold">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Dropdown (fixed-position to avoid overflow clipping) */}
        {openDropdown && SUB_MENUS[openDropdown] && dropdownPos && (
          <div
            className="fixed w-64 bg-white rounded-lg shadow-xl border border-[#2E3093]/15 py-1 z-50 max-h-80 overflow-y-auto"
            style={{ left: dropdownPos.left, top: dropdownPos.top }}
          >
            {SUB_MENUS[openDropdown].filter((subItem) => canAccessSubMenu(openDropdown, subItem)).map((subItem) => {
              const routeKey = `${openDropdown} > ${subItem}`;
              const route = SUB_MENU_ROUTES[routeKey];
              const routePath = route ? route.split('?')[0] : null;
              const isActive = !!(routePath && pathname.startsWith(routePath));
              return (
                <button
                  key={subItem}
                  onClick={() => {
                    setOpenDropdown(null);
                    setDropdownPos(null);
                    if (route) router.push(route);
                  }}
                  disabled={!route}
                  title={route ? subItem : 'Not configured'}
                  className={`w-full text-left px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${
                    route
                      ? isActive
                        ? 'bg-[#FAE452]/45 text-[#2E3093]'
                        : 'text-[#2E3093] hover:bg-[#FAE452]/40'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span className="block truncate">{subItem}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>

      {/* Welcome overlay */}
      {showWelcome && session && (() => {
        const initials = getInitials(session.firstName, session.lastName, session.email);
        const displayName = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || session.email || 'User';
        const role = isSuperAdmin ? 'Super Admin' : session.department || `Role ${session.role}`;
        return (
          <div
            className="fixed inset-0 z-50 flex overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0f1240 0%, #1e2170 30%, #2E3093 60%, #2A6BB5 100%)' }}
          >
            {/* ── Animated background layers ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {/* Large slow-spin gradient orb top-left */}
              <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, #FAE452 0%, transparent 70%)', animation: 'slowSpin 18s linear infinite' }} />
              {/* Blue orb bottom-right */}
              <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full opacity-15"
                style={{ background: 'radial-gradient(circle, #60a5fa 0%, transparent 70%)', animation: 'slowSpin 24s linear infinite reverse' }} />
              {/* Center subtle pulse */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 65%)', animation: 'pulse 4s ease-in-out infinite' }} />
              {/* Dot grid */}
              <div className="absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)', backgroundSize: '40px 40px' }} />
              {/* Diagonal shimmer lines */}
              <div className="absolute inset-0 opacity-[0.04]"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 60px)' }} />
            </div>

            {/* ── Left panel — branding ── */}
            <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 relative z-10 px-12 py-14 border-r border-white/10">
              {/* Top — logo area */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sit.png" alt="SIT" className="w-12 h-12 object-contain rounded-xl bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.3)]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#FAE452]/70">Suvidya Institute</p>
                    <p className="text-sm font-bold text-white leading-none mt-0.5"
                      style={{ fontFamily: 'var(--font-libre-franklin), sans-serif' }}>SIT Manager</p>
                  </div>
                </div>
                <div className="w-10 h-0.5 bg-[#FAE452]/40 rounded-full mt-2" />
              </div>

              {/* Middle — large decorative quote mark */}
              <div className="flex flex-col gap-6">
                <svg className="w-16 h-16 text-[#FAE452]/20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="text-xl font-light text-white/70 leading-relaxed italic">
                  &ldquo;{welcomeQuote.text}&rdquo;
                </p>
                {welcomeQuote.author && (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-px bg-[#FAE452]/50" />
                    <p className="text-[#FAE452]/80 text-xs font-semibold uppercase tracking-widest">{welcomeQuote.author}</p>
                  </div>
                )}
              </div>

              {/* Bottom — time stamp */}
              <p className="text-white/25 text-xs font-medium">
                Ready to make progress today.
              </p>
            </div>

            {/* ── Right panel — user greeting ── */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-8 py-14"
              style={{ animation: 'fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both' }}>

              {/* Avatar ring */}
              <div className="relative mb-8">
                {/* Outer pulse ring */}
                <div className="absolute inset-0 rounded-full border-2 border-[#FAE452]/30 scale-125"
                  style={{ animation: 'ringPulse 2.4s ease-in-out infinite' }} />
                {/* Middle ring */}
                <div className="absolute inset-0 rounded-full border border-[#FAE452]/15 scale-[1.5]"
                  style={{ animation: 'ringPulse 2.4s ease-in-out 0.4s infinite' }} />
                {/* Glow */}
                <div className="absolute inset-0 rounded-full bg-[#FAE452] blur-3xl opacity-25 scale-150 pointer-events-none" />
                {/* Avatar */}
                <div className="relative w-36 h-36 rounded-full flex items-center justify-center shadow-[0_32px_80px_rgba(250,228,82,0.3)]"
                  style={{ background: 'linear-gradient(135deg, #FAE452 0%, #f5d800 100%)', border: '4px solid rgba(255,255,255,0.25)' }}>
                  <span className="text-5xl font-black leading-none" style={{ color: '#1e2170' }}>{initials}</span>
                </div>
              </div>

              {/* Label */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-px bg-white/25" />
                <p className="text-white/45 text-[10px] font-bold uppercase tracking-[0.38em]">Welcome back</p>
                <div className="w-6 h-px bg-white/25" />
              </div>

              {/* Name */}
              <h1 className="text-5xl font-bold text-white text-center mb-3 leading-tight" style={{ textShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                {displayName}
              </h1>

              {/* Role badge */}
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-10"
                style={{ background: 'rgba(250,228,82,0.12)', border: '1px solid rgba(250,228,82,0.28)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FAE452]" />
                <span className="text-[#FAE452] text-[11px] font-bold uppercase tracking-[0.26em]">{role}</span>
              </div>

              {/* Quote (mobile only — left panel hidden on small screens) */}
              <div className="flex flex-col items-center gap-4 mb-10 max-w-sm lg:hidden">
                <div className="w-8 h-px bg-white/20" />
                <p className="text-white/60 text-base font-light text-center italic leading-relaxed">
                  &ldquo;{welcomeQuote.text}&rdquo;
                </p>
                {welcomeQuote.author && (
                  <p className="text-[#FAE452]/70 text-xs font-semibold">— {welcomeQuote.author}</p>
                )}
              </div>

              {/* CTA button */}
              <button
                onClick={() => setShowWelcome(false)}
                className="group relative flex items-center gap-3 px-9 py-4 rounded-2xl text-[#1e2170] text-sm font-bold transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FAE452 0%, #f5d800 100%)', boxShadow: '0 16px 40px rgba(250,228,82,0.35), 0 4px 12px rgba(0,0,0,0.2)' }}
              >
                <span>Go to Dashboard</span>
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1e2170]/12 transition-transform group-hover:translate-x-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>

              {/* Loading dots */}
              <div className="flex items-center gap-1.5 mt-8">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/25"
                    style={{ animation: `dotBounce 1.4s ease-in-out ${i * 0.18}s infinite` }} />
                ))}
              </div>
            </div>

            <style>{`
              @keyframes fadeSlideUp {
                from { opacity: 0; transform: translateY(28px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @keyframes slowSpin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
              @keyframes ringPulse {
                0%, 100% { opacity: 0.5; transform: scale(1.25); }
                50%       { opacity: 0;   transform: scale(1.6); }
              }
              @keyframes dotBounce {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
                40%           { transform: scale(1);   opacity: 0.9; }
              }
            `}</style>
          </div>
        );
      })()}
    </div>
  );
}
