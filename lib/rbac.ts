/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * Permissions are organized by department/module for easy management.
 * Each resource has standard CRUD permissions: view, create, update, delete
 */

// ============================================================================
// PERMISSION TYPES
// ============================================================================

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'export' | 'manage';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: PermissionAction;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  permissions: Permission[];
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[]; // Array of permission IDs
  isSystemRole?: boolean; // Can't be deleted
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// PERMISSION DEFINITIONS - Grouped by Department/Module
// ============================================================================

const createPermissions = (
  resource: string,
  resourceName: string,
  actions: PermissionAction[] = ['view', 'create', 'update', 'delete']
): Permission[] => {
  return actions.map(action => ({
    id: `${resource}.${action}`,
    name: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resourceName}`,
    description: `Can ${action} ${resourceName.toLowerCase()}`,
    resource,
    action,
  }));
};

// ============================================================================
// PERMISSION GROUPS
// ============================================================================

export const PERMISSION_GROUPS: PermissionGroup[] = [
  // -------------------------------------------------------------------------
  // GENERAL MASTER
  // -------------------------------------------------------------------------
  {
    id: 'general_master',
    name: 'General Master',
    description: 'Basic configuration and lookup tables',
    icon: 'settings',
    permissions: [
      ...createPermissions('discipline', 'Discipline'),
      ...createPermissions('qualification', 'Qualification'),
      ...createPermissions('bank', 'Bank'),
      ...createPermissions('fees_notes', 'Fees Notes'),
      ...createPermissions('holiday', 'Holiday'),
      ...createPermissions('location', 'Location'),
      ...createPermissions('extension', 'Extension'),
      ...createPermissions('rack', 'Rack'),
      ...createPermissions('material_category', 'Material Category'),
      ...createPermissions('vendor_type', 'Vendor Type'),
      ...createPermissions('vendor', 'Vendor'),
      ...createPermissions('material_price', 'Material Price'),
      ...createPermissions('tds', 'TDS'),
      ...createPermissions('tax', 'Tax'),
      ...createPermissions('salary_master', 'Salary Master'),
      ...createPermissions('project_master', 'Project Master'),
      ...createPermissions('mlwf_master', 'MLWF Master'),
      ...createPermissions('qma_master', 'QMA Master'),
    ],
  },

  // -------------------------------------------------------------------------
  // MASTERS
  // -------------------------------------------------------------------------
  {
    id: 'masters',
    name: 'Masters',
    description: 'Core master data management',
    icon: 'database',
    permissions: [
      ...createPermissions('course', 'Course'),
      ...createPermissions('annual_batch', 'Annual Batch'),
      ...createPermissions('batch_category', 'Batch Category'),
      ...createPermissions('batch', 'Batch'),
      ...createPermissions('status', 'Status'),
      ...createPermissions('book_code', 'Book Code'),
      ...createPermissions('college', 'College'),
      ...createPermissions('employee', 'Employee'),
      ...createPermissions('library_book', 'Library Book'),
      ...createPermissions('faculty', 'Faculty'),
    ],
  },

  // -------------------------------------------------------------------------
  // ADMISSION ACTIVITY
  // -------------------------------------------------------------------------
  {
    id: 'admission_activity',
    name: 'Admission Activity',
    description: 'Student admission and inquiry management',
    icon: 'graduation',
    permissions: [
      ...createPermissions('inquiry', 'Inquiry'),
      ...createPermissions('online_admission', 'Online Admission'),
      ...createPermissions('student', 'Student'),
      ...createPermissions('corporate_inquiry', 'Corporate Inquiry'),
    ],
  },

  // -------------------------------------------------------------------------
  // DAILY ACTIVITIES
  // -------------------------------------------------------------------------
  {
    id: 'daily_activities',
    name: 'Daily Activities',
    description: 'Day-to-day academic operations',
    icon: 'calendar',
    permissions: [
      ...createPermissions('roll_number', 'Roll Number Allotment'),
      ...createPermissions('lecture', 'Lecture'),
      ...createPermissions('assignment', 'Assignment'),
      ...createPermissions('unit_test', 'Unit Test'),
      ...createPermissions('viva_moc', 'Viva/MOC'),
      ...createPermissions('final_exam', 'Final Exam'),
      ...createPermissions('final_result', 'Final Result', ['view', 'create']),
      ...createPermissions('faculty_working_hours', 'Faculty Working Hours'),
      ...createPermissions('feedback1', 'Feedback 1'),
      ...createPermissions('feedback2', 'Feedback 2'),
      ...createPermissions('site_visit', 'Site Visit'),
    ],
  },

  // -------------------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------------------
  {
    id: 'reports',
    name: 'Reports',
    description: 'View and export various reports',
    icon: 'chart',
    permissions: [
      ...createPermissions('report_inquiry', 'Inquiry Report', ['view', 'export']),
      ...createPermissions('report_online_students', 'Online Students Report', ['view', 'export']),
      ...createPermissions('report_attendance', 'Attendance Report', ['view', 'export']),
      ...createPermissions('report_student_batch', 'Student Batch Report', ['view', 'export']),
      ...createPermissions('report_student', 'Student Report', ['view', 'export']),
      ...createPermissions('report_batch_record', 'Batch Record Report', ['view', 'export']),
      ...createPermissions('report_site_visit', 'Site Visit Report', ['view', 'export']),
      ...createPermissions('report_corporate_inquiry', 'Corporate Inquiry Report', ['view', 'export']),
      ...createPermissions('report_corporate_record', 'Corporate Record Report', ['view', 'export']),
      ...createPermissions('report_college_followup', 'College Follow Up Report', ['view', 'export']),
      ...createPermissions('report_convocation', 'Convocation Guest Report', ['view', 'export']),
      ...createPermissions('report_yearly_mock', 'Yearly Mock Report', ['view', 'export']),
      ...createPermissions('report_annual_batch_plan', 'Annual Batch Plan Report', ['view', 'export']),
      ...createPermissions('report_final_exam', 'Final Exam Report', ['view', 'export']),
      ...createPermissions('report_fees', 'Fees Report', ['view', 'export']),
      ...createPermissions('report_sms_email', 'SMS/Email Report', ['view', 'export']),
      ...createPermissions('report_service_tax', 'Service Tax Report', ['view', 'export']),
      ...createPermissions('report_lecture', 'Lecture Report', ['view', 'export']),
      ...createPermissions('report_feedback_analysis', 'Feedback Analysis Report', ['view', 'export']),
      ...createPermissions('report_student_interview', 'Student Interview Report', ['view', 'export']),
      ...createPermissions('report_batch_analysis', 'Batch Analysis Report', ['view', 'export']),
      ...createPermissions('report_payment_collection', 'Payment Collection Report', ['view', 'export']),
      ...createPermissions('report_faculty_salary', 'Faculty Salary Report', ['view', 'export']),
      ...createPermissions('report_faculty_statement', 'Faculty Statement Report', ['view', 'export']),
    ],
  },

  // -------------------------------------------------------------------------
  // LIBRARY MANAGEMENT
  // -------------------------------------------------------------------------
  {
    id: 'library_management',
    name: 'Library Management',
    description: 'Library operations and book management',
    icon: 'book',
    permissions: [
      ...createPermissions('library_issue', 'Book Issue'),
      ...createPermissions('library_return', 'Book Return'),
      ...createPermissions('library_fine', 'Library Fine'),
      ...createPermissions('library_card', 'Library Card'),
      ...createPermissions('library_inventory', 'Library Inventory', ['view', 'export']),
    ],
  },

  // -------------------------------------------------------------------------
  // ROLE MANAGEMENT
  // -------------------------------------------------------------------------
  {
    id: 'role_management',
    name: 'Role & Access',
    description: 'User roles and permission management',
    icon: 'shield',
    permissions: [
      ...createPermissions('role', 'Role', ['view', 'create', 'update', 'delete']),
      ...createPermissions('user', 'User', ['view', 'create', 'update', 'delete']),
      ...createPermissions('permission', 'Permission', ['view', 'manage']),
      ...createPermissions('audit_log', 'Audit Log', ['view']),
    ],
  },

  // -------------------------------------------------------------------------
  // EMPLOYEE & TRAINING
  // -------------------------------------------------------------------------
  {
    id: 'employee_training',
    name: 'Employee & Training',
    description: 'Employee training and development',
    icon: 'users',
    permissions: [
      ...createPermissions('training_program', 'Training Program'),
      ...createPermissions('training_attendance', 'Training Attendance'),
      ...createPermissions('training_assessment', 'Training Assessment'),
      ...createPermissions('training_certificate', 'Training Certificate', ['view', 'create']),
      ...createPermissions('employee_performance', 'Employee Performance'),
    ],
  },

  // -------------------------------------------------------------------------
  // ACCOUNT MASTER
  // -------------------------------------------------------------------------
  {
    id: 'account_master',
    name: 'Account & Finance',
    description: 'Financial and accounting operations',
    icon: 'wallet',
    permissions: [
      ...createPermissions('profession_tax', 'Employee Profession Tax'),
      ...createPermissions('account_head', 'Account Head'),
      ...createPermissions('assets', 'Assets'),
      ...createPermissions('asset_category', 'Asset Category'),
      ...createPermissions('fees_details', 'Fees Details'),
      ...createPermissions('purchase_material', 'Purchase Material'),
      ...createPermissions('faculty_payment', 'Faculty Payment'),
      ...createPermissions('cash_voucher', 'Cash Voucher'),
      ...createPermissions('stock_view', 'Stock View', ['view']),
      ...createPermissions('material_consumption', 'Material Consumption'),
      ...createPermissions('employee_salary', 'Employee Salary'),
      ...createPermissions('employee_attendance', 'Employee Attendance'),
      ...createPermissions('employee_loan', 'Employee Loan'),
      ...createPermissions('batch_left', 'Batch Left'),
      ...createPermissions('batch_moving', 'Batch Moving'),
      ...createPermissions('batch_transfer', 'Batch Transfer'),
      ...createPermissions('batch_cancellation', 'Batch Cancellation'),
    ],
  },

  // -------------------------------------------------------------------------
  // UTILITY
  // -------------------------------------------------------------------------
  {
    id: 'utility',
    name: 'Utility',
    description: 'System utilities and communication',
    icon: 'wrench',
    permissions: [
      ...createPermissions('festival_photo', 'Festival Photo'),
      ...createPermissions('notice_board', 'Notice Board'),
      ...createPermissions('mass_sms', 'Mass SMS', ['view', 'create']),
      ...createPermissions('mass_email', 'Mass Email', ['view', 'create']),
      ...createPermissions('event_photo', 'Event Photo'),
      ...createPermissions('testimonial_photo', 'Testimonial Photo'),
      ...createPermissions('banner_image', 'Banner Image'),
      ...createPermissions('export_contacts', 'Export Contacts', ['view', 'export']),
      ...createPermissions('qms_docs', 'QMS Documents'),
      ...createPermissions('mass_whatsapp', 'Mass WhatsApp', ['view', 'create']),
      ...createPermissions('task_management', 'Task Management'),
      ...createPermissions('email_master', 'Email Master'),
    ],
  },

  // -------------------------------------------------------------------------
  // PLACEMENT
  // -------------------------------------------------------------------------
  {
    id: 'placement',
    name: 'Placement',
    description: 'Student placement and recruitment',
    icon: 'briefcase',
    permissions: [
      ...createPermissions('consultancy', 'Consultancy'),
      ...createPermissions('cv_shortlisted', 'CV Shortlisted'),
      ...createPermissions('cv_latest', 'Latest CV'),
      ...createPermissions('placement_convocation', 'Convocation Guest List'),
      ...createPermissions('consultancy_report', 'Consultancy Report', ['view', 'export']),
      ...createPermissions('student_placement', 'Student Placement'),
      ...createPermissions('student_cv_folder', 'Student CV Folder', ['view']),
      ...createPermissions('company_requirement', 'Company Requirement'),
      ...createPermissions('shortlisted_sit', 'Shortlisted by SIT'),
      ...createPermissions('shortlisted_company', 'Shortlisted by Company'),
    ],
  },
];

// ============================================================================
// FLATTEN ALL PERMISSIONS
// ============================================================================

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap(
  group => group.permissions
);

export const PERMISSION_MAP: Map<string, Permission> = new Map(
  ALL_PERMISSIONS.map(p => [p.id, p])
);

// ============================================================================
// DEFAULT ROLES
// ============================================================================

export const DEFAULT_ROLES: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Super Admin',
    description: 'Full access to all system features',
    permissions: ALL_PERMISSIONS.map(p => p.id),
    isSystemRole: true,
  },
  {
    name: 'Admin',
    description: 'Administrative access with some restrictions',
    permissions: ALL_PERMISSIONS
      .filter(p => !['role', 'permission', 'audit_log'].some(r => p.resource === r))
      .map(p => p.id),
    isSystemRole: true,
  },
  {
    name: 'Accounts Manager',
    description: 'Full access to accounting and finance modules',
    permissions: [
      ...PERMISSION_GROUPS.find(g => g.id === 'account_master')!.permissions.map(p => p.id),
      ...PERMISSION_GROUPS.find(g => g.id === 'reports')!.permissions
        .filter(p => ['report_fees', 'report_payment_collection', 'report_faculty_salary', 'report_service_tax'].includes(p.resource))
        .map(p => p.id),
    ],
    isSystemRole: false,
  },
  {
    name: 'Admission Coordinator',
    description: 'Manages student admissions and inquiries',
    permissions: [
      ...PERMISSION_GROUPS.find(g => g.id === 'admission_activity')!.permissions.map(p => p.id),
      ...PERMISSION_GROUPS.find(g => g.id === 'reports')!.permissions
        .filter(p => ['report_inquiry', 'report_online_students', 'report_student'].includes(p.resource))
        .map(p => p.id),
    ],
    isSystemRole: false,
  },
  {
    name: 'Faculty',
    description: 'Teaching staff with daily activity access',
    permissions: [
      ...PERMISSION_GROUPS.find(g => g.id === 'daily_activities')!.permissions
        .filter(p => p.action !== 'delete')
        .map(p => p.id),
      'batch.view',
      'student.view',
      'course.view',
    ],
    isSystemRole: false,
  },
  {
    name: 'Placement Officer',
    description: 'Manages student placements and corporate relations',
    permissions: [
      ...PERMISSION_GROUPS.find(g => g.id === 'placement')!.permissions.map(p => p.id),
      'student.view',
      'corporate_inquiry.view',
      'corporate_inquiry.create',
      'corporate_inquiry.update',
    ],
    isSystemRole: false,
  },
  {
    name: 'Librarian',
    description: 'Manages library operations',
    permissions: [
      ...PERMISSION_GROUPS.find(g => g.id === 'library_management')!.permissions.map(p => p.id),
      'book_code.view',
      'book_code.create',
      'book_code.update',
      'library_book.view',
      'library_book.create',
      'library_book.update',
      'student.view',
    ],
    isSystemRole: false,
  },
  {
    name: 'Viewer',
    description: 'Read-only access to view data',
    permissions: ALL_PERMISSIONS
      .filter(p => p.action === 'view')
      .map(p => p.id),
    isSystemRole: false,
  },
];

// ============================================================================
// PERMISSION CHECKING UTILITIES
// ============================================================================

export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some(p => userPermissions.includes(p));
}

export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every(p => userPermissions.includes(p));
}

export function canAccessResource(
  userPermissions: string[],
  resource: string,
  action: PermissionAction
): boolean {
  return hasPermission(userPermissions, `${resource}.${action}`);
}

export function getResourcePermissions(resource: string): Permission[] {
  return ALL_PERMISSIONS.filter(p => p.resource === resource);
}

export function getGroupPermissions(groupId: string): Permission[] {
  const group = PERMISSION_GROUPS.find(g => g.id === groupId);
  return group?.permissions || [];
}

// ============================================================================
// ROUTE PROTECTION MAPPING
// ============================================================================

export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Masters
  '/dashboard/masters/course': ['course.view'],
  '/dashboard/masters/course/add': ['course.create'],
  '/dashboard/masters/course/edit': ['course.update'],
  '/dashboard/masters/annual-batch': ['annual_batch.view'],
  '/dashboard/masters/annual-batch/add': ['annual_batch.create'],
  '/dashboard/masters/annual-batch/edit': ['annual_batch.update'],
  '/dashboard/masters/batch-category': ['batch_category.view'],
  '/dashboard/masters/batch-category/edit': ['batch_category.update'],
  '/dashboard/masters/batch': ['batch.view'],
  '/dashboard/masters/batch/edit': ['batch.update'],
  '/dashboard/masters/status': ['status.view'],
  '/dashboard/masters/book-code': ['book_code.view'],
  '/dashboard/masters/college': ['college.view'],
  '/dashboard/masters/college/add': ['college.create'],
  '/dashboard/masters/college/edit': ['college.update'],
  '/dashboard/masters/employee': ['employee.view'],
  '/dashboard/masters/employee/add': ['employee.create'],
  '/dashboard/masters/employee/edit': ['employee.update'],
  '/dashboard/masters/library-book': ['library_book.view'],
  '/dashboard/masters/faculty': ['faculty.view'],
  '/dashboard/masters/faculty/add': ['faculty.create'],
  '/dashboard/masters/faculty/edit': ['faculty.update'],

  // Admission Activity
  '/dashboard/inquiry': ['inquiry.view'],
  '/dashboard/inquiry/add': ['inquiry.create'],
  '/dashboard/online-admission': ['online_admission.view'],
  '/dashboard/student': ['student.view'],
  '/dashboard/corporate-inquiry': ['corporate_inquiry.view'],
  '/dashboard/corporate-inquiry/add': ['corporate_inquiry.create'],
  '/dashboard/corporate-inquiry/edit': ['corporate_inquiry.update'],

  // Role Management
  '/dashboard/role-right': ['role.view'],
  '/dashboard/role-right/add': ['role.create'],
  '/dashboard/role-right/edit': ['role.update'],
  '/dashboard/role-right/users': ['user.view'],
};

// ============================================================================
// API ROUTE PERMISSIONS
// ============================================================================

export const API_PERMISSIONS: Record<string, Record<string, string[]>> = {
  '/api/masters/course': {
    GET: ['course.view'],
    POST: ['course.create'],
  },
  '/api/masters/course/:id': {
    GET: ['course.view'],
    PUT: ['course.update'],
    DELETE: ['course.delete'],
  },
  '/api/masters/batch': {
    GET: ['batch.view'],
    POST: ['batch.create'],
  },
  '/api/masters/batch/:id': {
    GET: ['batch.view'],
    PUT: ['batch.update'],
    DELETE: ['batch.delete'],
  },
  '/api/admission-activity/corporate-inquiry': {
    GET: ['corporate_inquiry.view'],
    POST: ['corporate_inquiry.create'],
  },
  '/api/admission-activity/corporate-inquiry/:id': {
    GET: ['corporate_inquiry.view'],
    PUT: ['corporate_inquiry.update'],
    DELETE: ['corporate_inquiry.delete'],
  },
  '/api/roles': {
    GET: ['role.view'],
    POST: ['role.create'],
  },
  '/api/roles/:id': {
    GET: ['role.view'],
    PUT: ['role.update'],
    DELETE: ['role.delete'],
  },
};

// ============================================================================
// STATISTICS HELPERS (for dashboard)
// ============================================================================

export function getPermissionStats() {
  return {
    totalPermissions: ALL_PERMISSIONS.length,
    totalGroups: PERMISSION_GROUPS.length,
    byAction: {
      view: ALL_PERMISSIONS.filter(p => p.action === 'view').length,
      create: ALL_PERMISSIONS.filter(p => p.action === 'create').length,
      update: ALL_PERMISSIONS.filter(p => p.action === 'update').length,
      delete: ALL_PERMISSIONS.filter(p => p.action === 'delete').length,
      export: ALL_PERMISSIONS.filter(p => p.action === 'export').length,
      manage: ALL_PERMISSIONS.filter(p => p.action === 'manage').length,
    },
  };
}
