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
  'Masters > Course': '/dashboard/masters/course',
  'Masters > Annual Batch': '/dashboard/masters/annual-batch',
  'Masters > Batch Category': '/dashboard/masters/batch-category',
  'Masters > Batch': '/dashboard/masters/batch',
  'Masters > Status': '/dashboard/masters/status',
  'Masters > Book Code': '/dashboard/masters/book-code',
  'Masters > College': '/dashboard/masters/college',
  'Masters > Employee': '/dashboard/masters/employee',
  'Masters > Library Book': '/dashboard/masters/library-book',
  'Masters > Faculty': '/dashboard/masters/faculty',
  'Admin/Accounts > Employee Profession Tax': '/dashboard/account-master/employee-profession-tax',
  'Admin/Accounts > Account Head': '/dashboard/account-master/account-head',
  'Admin/Accounts > Assets': '/dashboard/account-master/assets',
  'Admin/Accounts > Asset Category': '/dashboard/account-master/asset-category',
  'Admission Activity > Inquiry': '/dashboard/inquiry',
  'Admission Activity > Online Admission': '/dashboard/online-admission',
  'Admission Activity > Student': '/dashboard/student',
  'Corporate Training > Corporate Inquiry': '/dashboard/corporate-inquiry',
  'Corporate Training > Under Discussion': '/dashboard/corporate-inquiry/convert',
  'Reports > Inquiry': '/dashboard/reports/inquiry',
  'Reports > Inquiry Report': '/dashboard/reports/inquiry',
  'Reports > Online Students': '/dashboard/reports/online-student',
  'Reports > Full Attendance Report': '/dashboard/reports/attendance',
  'Role Right > Roles & Permissions': '/dashboard/role-right',
  'Role Right > Create User': '/dashboard/role-right?tab=create-user',
  'Role Right > Portal Accounts': '/dashboard/portal-accounts',
  'Daily Activities > Allot Roll Number': '/dashboard/daily-activities/allot-roll-number',
  'Daily Activities > Lecture Taken': '/dashboard/daily-activities/lecture-taken',
  'Daily Activities > Assignments Taken': '/dashboard/daily-activities/assignments-taken',
  'Daily Activities > Unit Test Taken': '/dashboard/daily-activities/unit-test-taken',
  'Daily Activities > Viva / MOC Taken': '/dashboard/daily-activities/viva-moc-taken',
  'Daily Activities > Final Exam Taken': '/dashboard/daily-activities/final-exam-taken',
  'Daily Activities > Site Visit': '/dashboard/daily-activities/site-visit',
  'Daily Activities > Generate Final Result': '/dashboard/daily-activities/generate-final-result',
  'Daily Activities > Faculty Working Hours': '/dashboard/daily-activities/faculty-working',
  'Daily Activities > Feedback': '/dashboard/daily-activities/feedback',
  'Placement > Consultancy Master': '/dashboard/masters/consultancy',
  'Placement > CV Shortlisted': '/dashboard/cv-shortlisted',
  'Placement > Consultancy Report': '/dashboard/reports/consultancy',
  'Placement > Job Postings': '/dashboard/placement',
  'Placement > Email Company': '/dashboard/placement/email-company',
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
    'Course',
    'Annual Batch',
    'Batch Category',
    'Batch',
    'Status',
    'Book Code',
    'College',
    'Employee',
    'Library Book',
    'Faculty',
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
    'Faculty Working Hours',
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
    'Faculty Salary Report',
    'Faculty Monthly Statement',
    'Inquiry Report',
  ],
  'Admin/Accounts': [
    'Employee Profession Tax',
    'Account Head',
    'Assets',
    'Asset Category',
    'Fees Details',
    'Purchase Material',
    'Faculty Payment',
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
    'Under Discussion',
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
    'Portal Accounts',
  ],
};

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

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, isSuperAdmin } = usePermissions();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(null);
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
    if (path.startsWith('/dashboard/inquiry') || path.startsWith('/dashboard/online-admission') || path.startsWith('/dashboard/student')) return 'Admission Activity';
    if (path.startsWith('/dashboard/placement') || path.startsWith('/dashboard/cv-shortlisted')) return 'Placement';
    return 'Dashboard';
  };

  const activeMenu = getActiveFromPath(pathname);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[15px] font-extrabold tracking-tight text-[#FAE452]">SIT</span>
            <span className="text-[15px] font-bold tracking-tight text-white">Manager</span>
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
              {MENU_ITEMS.map((item) => (
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
            <div
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/10 text-white min-w-0"
              title={session?.email || ''}
            >
              <div className="w-7 h-7 rounded-full bg-[#FAE452] text-[#2E3093] flex items-center justify-center text-[12px] font-extrabold">
                {loading ? '…' : getInitials(session?.firstName, session?.lastName, session?.email)}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-[12px] font-semibold truncate max-w-[180px]">
                  {loading
                    ? 'Loading…'
                    : session
                      ? `${session.firstName} ${session.lastName}`.trim() || session.email
                      : 'Guest'}
                </div>
                <div className="text-[10px] text-white/75 truncate max-w-[180px]">
                  {loading
                    ? ''
                    : session
                      ? isSuperAdmin
                        ? 'Super Admin'
                        : session.department || `Role ${session.role}`
                      : ''}
                </div>
              </div>
            </div>

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
            {SUB_MENUS[openDropdown].map((subItem) => {
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
    </div>
  );
}
