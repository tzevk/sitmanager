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
  'Admin/Accounts > Finance Dashboard': '/dashboard/finance',
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
  'Reports > Final Exam': '/dashboard/reports/final-exam',
  'Role Right > Roles & Permissions': '/dashboard/role-right',
  'Role Right > Create User': '/dashboard/role-right?tab=create-user',
  'Role Right > Add Employee': '/dashboard/masters/employee/add',
  'Role Right > Portal Accounts': '/dashboard/portal-accounts',
  'Daily Activities > Attendance': '/dashboard/daily-activities/attendance',
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
  'Placement > Student Placement Report': '/dashboard/reports/placement',
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
    'Attendance',
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
    'Finance Dashboard',
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
  'Admin/Accounts > Finance Dashboard': ['finance.view'],
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
  'Reports > Final Exam': ['report_final_exam.view'],
  'Role Right > Roles & Permissions': ['role.view'],
  'Role Right > Create User': ['user.create'],
  'Role Right > Add Employee': ['employee.create'],
  'Role Right > Portal Accounts': ['user.create'],
  'Daily Activities > Attendance': ['attendance.view'],
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
  'Placement > Latest CV Updated': ['cv_latest.view'],
  'Placement > Convocation Guest List': ['placement_convocation.view'],
  'Placement > View Student CV Folder': ['student_cv_folder.view'],
  'Placement > Company Requirment Master': ['company_requirement.view'],
  'Placement > Shortlisted By Company': ['shortlisted_company.view'],
  'Placement > Consultancy Report': ['consultancy_report.view'],
  'Placement > Student Placement Report': ['report_placement.view'],
  'Placement > Job Postings': ['placement.view'],
  'Placement > Mock Interviews': ['mock_interview.view'],
  'Placement > Email Company': ['placement.view'],
  'Utility > Festival Photo Upload': ['festival_photo.view'],
};

const NAV_ICONS: Record<string, React.ReactNode> = {
  'Dashboard': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  'General Master': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  'Masters': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  'Admission Activity': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  'Daily Activities': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  'Admin/Accounts': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  'Corporate Training': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  'Placement': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  'Reports': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  'Role Right': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  'Utility': (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
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


function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, isSuperAdmin, hasAnyPermission } = usePermissions();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileOpenSection, setMobileOpenSection] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuScrollRef = useRef<HTMLDivElement | null>(null);

  const getActiveFromPath = (path: string) => {
    if (path === '/dashboard' || path === '/dashboard/') return 'Dashboard';
    if (path.startsWith('/dashboard/masters')) return 'Masters';
    if (path.startsWith('/dashboard/daily-activities')) return 'Daily Activities';
    if (path.startsWith('/dashboard/account-master')) return 'Admin/Accounts';
    if (path.startsWith('/dashboard/finance')) return 'Admin/Accounts';
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

  // ── Reset Password Modal state ────────────────────────────────────
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const openResetModal = () => {
    setResetStep('request');
    setResetEmail('');
    setResetOtp('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetError('');
    setResetSuccess('');
    setResetMaskedEmail('');
    setShowResetModal(true);
  };

  const handleResetRequest = async () => {
    setResetLoading(true);
    setResetError('');
    try {
      const res = await fetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setResetMaskedEmail(data.maskedEmail || '');
        setResetStep('confirm');
      } else {
        setResetError(data.error || 'Failed to send code.');
      }
    } catch {
      setResetError('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetConfirm = async () => {
    if (resetNewPassword !== resetConfirmPassword) { setResetError('Passwords do not match.'); return; }
    if (resetNewPassword.length < 4) { setResetError('Password must be at least 4 characters.'); return; }
    setResetLoading(true);
    setResetError('');
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: resetOtp, newPassword: resetNewPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setResetSuccess('Password updated successfully!');
        setTimeout(() => setShowResetModal(false), 1500);
      } else {
        setResetError(data.error || 'Failed to reset password.');
      }
    } catch {
      setResetError('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (mobileMenuOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const welcomeQuote = pickDeterministicQuote(
    `${session?.email ?? ''}|${session?.firstName ?? ''}|${session?.lastName ?? ''}|${session?.role ?? ''}`,
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F1F5F9] overflow-hidden">
      {/* Close dropdown when clicking outside */}
      {openDropdown && (
        <div className="fixed inset-0 z-30" onClick={closeDropdown} />
      )}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close mobile menu overlay"
          className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Navbar */}
      <nav className="bg-[#2A6BB5] shrink-0 z-40 overflow-y-visible shadow-[0_4px_20px_rgba(46,48,147,0.22)]">

        {/* ── Mobile bar ── */}
        <div className="md:hidden h-12 px-3 flex items-center justify-between bg-[#2E3093]">
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <span className="text-[14px] font-bold tracking-[0.12em] leading-none whitespace-nowrap"
            style={{ fontFamily: 'var(--font-libre-franklin), sans-serif', color: '#FAE452' }}>
            SIT MANAGER
          </span>
          <div className="flex items-center gap-1">
            <button onClick={openResetModal} className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors" aria-label="Reset Password">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
            <button onClick={handleSignOut} className="p-2 rounded-lg text-white hover:bg-white/15 transition-colors" aria-label="Sign Out">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Desktop: Row 1 — Brand + User ── */}
        <div className="hidden md:flex items-center justify-between h-10 px-4 bg-[#2E3093] border-b border-white/10">
          {/* Brand */}
          <span className="text-[14px] font-black tracking-[0.16em] leading-none whitespace-nowrap select-none"
            style={{ fontFamily: 'var(--font-libre-franklin), sans-serif', color: '#FAE452' }}>
            SIT MANAGER
          </span>

          {/* User + Actions */}
          <div className="flex items-center gap-1.5">
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-white/15 bg-white/10 min-w-[160px] animate-pulse">
                <div className="w-6 h-6 rounded-full bg-white/30 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-2 w-20 bg-white/30 rounded" />
                  <div className="h-1.5 w-12 bg-white/20 rounded" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/15 bg-white/10 text-white" title={session?.email || ''}>
                <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                  {getInitials(session?.firstName, session?.lastName, session?.email)}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-[11px] font-semibold truncate max-w-[150px]">
                    {session ? `${session.firstName} ${session.lastName}`.trim() || session.email : 'Guest'}
                  </div>
                  <div className="text-[9px] text-white/65 truncate max-w-[150px]">
                    {session ? (isSuperAdmin ? 'Super Admin' : session.department || `Role ${session.role}`) : ''}
                  </div>
                </div>
              </div>
            )}

            <div className="w-px h-4 bg-white/15 mx-0.5" />

            <a
              href="/dashboard/manual"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors text-[11px] font-semibold"
              title="User Manual"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Help
            </a>

            <div className="w-px h-4 bg-white/15 mx-0.5" />

            <button
              onClick={() => {
                if ('Notification' in window) {
                  Notification.requestPermission().then(p => {
                    if (p === 'granted') new Notification('SIT Manager', { body: 'Notifications enabled!' });
                  });
                }
              }}
              className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors"
              title="Notifications"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            <button
              onClick={openResetModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors text-[11px] font-semibold"
              title="Reset Password"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Reset Password
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors text-[11px] font-semibold"
              title="Sign Out"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Desktop: Row 2 — Navigation ── */}
        <div
          ref={menuScrollRef}
          className="hidden md:block overflow-x-auto overflow-y-visible relative"
          onScroll={() => { if (openDropdown) updateDropdownPos(openDropdown); }}
        >
          {/* Yellow accent line at the very bottom */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]/60 pointer-events-none" />

          <div className="flex items-center h-9 px-2 w-max mx-auto">
            {visibleMenuItems.map((item) => (
              <button
                key={item}
                ref={(el) => { menuButtonRefs.current[item] = el; }}
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
                className={`flex items-center gap-1.5 px-2.5 h-8 text-[11.5px] font-semibold whitespace-nowrap transition-all duration-150 rounded-md mx-0.5 ${
                  activeMenu === item
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/85 hover:bg-white/15 hover:text-white'
                }`}
              >
                {NAV_ICONS[item]}
                <span>{item}</span>
                {SUB_MENUS[item] && (
                  <svg className={`w-2.5 h-2.5 opacity-70 transition-transform duration-150 ${openDropdown === item ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        <aside
          className={`fixed top-12 bottom-0 left-0 z-50 w-[86vw] max-w-[340px] md:hidden bg-white border-r border-slate-200 shadow-[0_16px_40px_rgba(15,23,42,0.25)] transform transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          aria-hidden={!mobileMenuOpen}
        >
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white">
              <p className="text-xs uppercase tracking-widest text-white/75">Navigation</p>
              <p className="text-sm font-semibold mt-1 truncate">
                {session
                  ? `${session.firstName} ${session.lastName}`.trim() || session.email
                  : 'Guest'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {visibleMenuItems.map((item) => {
                const hasSubMenu = Boolean(SUB_MENUS[item]);
                const isExpanded = mobileOpenSection === item;
                return (
                  <div key={item} className="px-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (item === 'Dashboard') {
                          router.push('/dashboard');
                          setMobileMenuOpen(false);
                          return;
                        }
                        if (!hasSubMenu) {
                          setMobileMenuOpen(false);
                          return;
                        }
                        setMobileOpenSection((prev) => (prev === item ? null : item));
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                        activeMenu === item
                          ? 'bg-[#2E3093]/8 text-[#2E3093]'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate text-left">{item}</span>
                      {hasSubMenu && (
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {hasSubMenu && (
                      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="pl-2 pr-1 py-1 space-y-0.5">
                            {SUB_MENUS[item]
                              .filter((subItem) => canAccessSubMenu(item, subItem))
                              .map((subItem) => {
                                const routeKey = `${item} > ${subItem}`;
                                const route = SUB_MENU_ROUTES[routeKey];
                                const routePath = route ? route.split('?')[0] : null;
                                const isActive = !!(routePath && pathname.startsWith(routePath));
                                return (
                                  <button
                                    key={subItem}
                                    type="button"
                                    onClick={() => {
                                      if (!route) return;
                                      router.push(route);
                                      setMobileMenuOpen(false);
                                    }}
                                    disabled={!route}
                                    className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors ${
                                      !route
                                        ? 'text-slate-400 cursor-not-allowed'
                                        : isActive
                                          ? 'bg-[#2E3093]/10 text-[#2E3093] font-semibold'
                                          : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span className="block truncate">{subItem}</span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { openResetModal(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#2E3093] border border-[#2E3093]/30 hover:bg-[#2E3093]/5 transition-colors mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Reset Password
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#24267A] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </aside>

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
                        ? 'bg-[#2E3093]/8 text-[#2E3093]'
                        : 'text-[#2E3093] hover:bg-[#2E3093]/5'
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

      {/* ── Reset Password Modal ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !resetLoading && setShowResetModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2E3093]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#2E3093]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800">Reset Password</h3>
                  <p className="text-xs text-gray-400">
                    {resetStep === 'request' ? 'Enter your email to receive a verification code' : `Enter the code sent to ${resetMaskedEmail}`}
                  </p>
                </div>
              </div>
              <button onClick={() => !resetLoading && setShowResetModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {resetSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {resetSuccess}
                </div>
              )}
              {resetError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{resetError}</div>
              )}

              {resetStep === 'request' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Your Email Address <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="Enter your account email"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">A 6-digit code will be sent to this email.</p>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setShowResetModal(false)} disabled={resetLoading}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleResetRequest} disabled={resetLoading || !resetEmail.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold transition-colors disabled:opacity-60">
                      {resetLoading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                      ) : 'Send Code'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">6-Digit Code <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={resetOtp}
                      onChange={e => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">New Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type={resetShowPassword ? 'text' : 'password'}
                        value={resetNewPassword}
                        onChange={e => setResetNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
                      />
                      <button type="button" onClick={() => setResetShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {resetShowPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                    <input
                      type={resetShowPassword ? 'text' : 'password'}
                      value={resetConfirmPassword}
                      onChange={e => setResetConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setResetStep('request'); setResetError(''); }} disabled={resetLoading}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors">
                      Back
                    </button>
                    <button onClick={handleResetConfirm} disabled={resetLoading || resetOtp.length !== 6 || !resetNewPassword}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold transition-colors disabled:opacity-60">
                      {resetLoading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                      ) : 'Update Password'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
