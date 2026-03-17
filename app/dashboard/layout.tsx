'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { PermissionProvider } from '@/lib/permissions-context';
import Image from 'next/image';

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
  'Admission Activity > Corporate Inquiry': '/dashboard/corporate-inquiry',
  'Reports > Inquiry': '/dashboard/reports/inquiry',
  'Reports > Inquiry Report': '/dashboard/reports/inquiry',
  'Reports > Online Students': '/dashboard/reports/online-student',
  'Reports > Full Attendance Report': '/dashboard/reports/attendance',
  'Role Right > Roles & Permissions': '/dashboard/role-right',
  'Role Right > Create User': '/dashboard/role-right?tab=create-user',
  'Daily Activities > Allot Roll Number': '/dashboard/daily-activities/allot-roll-number',
  'Daily Activities > Lecture Taken': '/dashboard/daily-activities/lecture-taken',
  'Daily Activities > Assignments Taken': '/dashboard/daily-activities/assignments-taken',
  'Daily Activities > Unit Test Taken': '/dashboard/daily-activities/unit-test-taken',
  'Daily Activities > Viva / MOC Taken': '/dashboard/daily-activities/viva-moc-taken',
  'Daily Activities > Final Exam Taken': '/dashboard/daily-activities/final-exam-taken',
  'Daily Activities > Site Visit': '/dashboard/daily-activities/site-visit',
  'Daily Activities > Generate Final Result': '/dashboard/daily-activities/generate-final-result',
  'Daily Activities > Faculty Working Hours': '/dashboard/daily-activities/faculty-working',
  'Placement > Consultancy Master': '/dashboard/masters/consultancy',
  'Placement > CV Shortlisted': '/dashboard/cv-shortlisted',
  'Placement > Shortlisted By SIT': '/dashboard/shortlisted-by-sit',
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
    'Corporate Inquiry',
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
    'FeedBack1',
    'FeedBack2',
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
    'Corporate Clients',
    'Corporate Batches',
    'Corporate Reports',
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
    'Shortlisted By SIT',
    'Shortlisted By Company',
  ],
  'Role Right': [
    'Roles & Permissions',
    'Create User',
  ],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/signin');
  }, [router]);

  const closeDropdown = useCallback(() => setOpenDropdown(null), []);

  return (
    <PermissionProvider>
      <div className="fixed inset-0 flex flex-col bg-gray-50 overflow-hidden">
        {/* Close dropdown when clicking outside */}
        {openDropdown && (
          <div className="fixed inset-0 z-30" onClick={closeDropdown} />
        )}

        {/* Top bar */}
        <header className="h-10 bg-[#2E3093] flex items-center justify-between px-4 shrink-0 z-40">
          <div className="flex items-center gap-2">
            <Image src="/sit.png" alt="SIT Logo" width={28} height={28} className="h-7 w-auto object-contain" />
            <span className="text-base font-bold text-[#FAE452]">SIT</span>
            <span className="text-base font-bold text-white">Manager</span>
          </div>

          <div className="flex items-center gap-3">
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
              className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Notifications"
            >
              <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              title="Sign Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs font-medium">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Navbar */}
        <nav className="bg-[#2A6BB5] shrink-0 z-40 overflow-visible">
          <div className="flex items-center h-9 px-2 min-w-max relative">
            {MENU_ITEMS.map((item) => (
              <div key={item} className="relative">
                <button
                  onClick={() => {
                    setActiveMenu(item);
                    if (item === 'Dashboard') {
                      setOpenDropdown(null);
                      router.push('/dashboard');
                    } else if (SUB_MENUS[item]) {
                      setOpenDropdown(openDropdown === item ? null : item);
                    } else {
                      setOpenDropdown(null);
                    }
                  }}
                  className={`px-4 h-9 text-[13px] font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1 ${
                    activeMenu === item
                      ? 'bg-white/20 text-[#FAE452]'
                      : 'text-white hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item}
                  {SUB_MENUS[item] && (
                    <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {/* Dropdown */}
                {SUB_MENUS[item] && openDropdown === item && (
                  <div className="absolute top-full left-0 mt-0 w-52 bg-white rounded-b-lg shadow-xl border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto">
                    {SUB_MENUS[item].map((subItem) => {
                      const routeKey = `${item} > ${subItem}`;
                      const route = SUB_MENU_ROUTES[routeKey];
                      return (
                        <button
                          key={subItem}
                          onClick={() => {
                            setOpenDropdown(null);
                            if (route) router.push(route);
                          }}
                          className="w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-[#2A6BB5]/10 hover:text-[#2E3093] transition-colors"
                        >
                          {subItem}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </PermissionProvider>
  );
}
