export type DashboardDepartment =
  | 'cbd'
  | 'corporate_training'
  | 'placement'
  | 'training_and_development'
  | 'accounts'
  | 'administration'
  | 'unknown';

export type DashboardWidgetKey =
  | 'quickStats'
  | 'annualTargets'
  | 'upcomingBatches'
  | 'todoList'
  | 'noticeBoard'
  | 'enquiryReport'
  | 'companyRequirements'
  | 'placementReport';

export type DashboardWidgetConfig = Record<DashboardWidgetKey, boolean>;

const ALL_WIDGETS_ENABLED: DashboardWidgetConfig = {
  quickStats: true,
  annualTargets: true,
  upcomingBatches: true,
  todoList: true,
  noticeBoard: true,
  enquiryReport: true,
  companyRequirements: true,
  placementReport: true,
};

const DEPARTMENT_WIDGET_CONFIG: Record<DashboardDepartment, DashboardWidgetConfig> = {
  cbd: { ...ALL_WIDGETS_ENABLED },
  corporate_training: { ...ALL_WIDGETS_ENABLED },
  placement: { ...ALL_WIDGETS_ENABLED },
  training_and_development: { ...ALL_WIDGETS_ENABLED },
  accounts: { ...ALL_WIDGETS_ENABLED },
  administration: { ...ALL_WIDGETS_ENABLED },
  unknown: { ...ALL_WIDGETS_ENABLED },
};

function normalizeDepartmentLabel(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function resolveDashboardDepartment(
  department: string | null | undefined,
  role: number | null | undefined,
  dashboardDepartment?: string | null
): DashboardDepartment {
  if (role === 1) return 'administration';

  // Use the dashboard_department assigned to the role if available
  if (dashboardDepartment) {
    const valid: DashboardDepartment[] = ['cbd', 'corporate_training', 'placement', 'training_and_development', 'accounts', 'administration'];
    if (valid.includes(dashboardDepartment as DashboardDepartment)) {
      return dashboardDepartment as DashboardDepartment;
    }
  }

  const normalized = normalizeDepartmentLabel(department);
  if (!normalized) {
    if (role === 19) return 'corporate_training';
    if (role === 14) return 'placement';
    if (role === 12) return 'training_and_development';
    if (role === 13) return 'accounts';
    if (role === 11) return 'cbd';
    return 'unknown';
  }

  if (normalized === 'cbd department' || normalized === 'career building department') {
    return 'cbd';
  }
  if (normalized === 'corporate training') {
    return 'corporate_training';
  }
  if (normalized === 'placement department' || normalized === 'placement') {
    return 'placement';
  }
  if (normalized === 'training and development department' || normalized === 'training and development') {
    return 'training_and_development';
  }
  if (normalized === 'accounts' || normalized === 'accounts department') {
    return 'accounts';
  }
  if (normalized === 'administration' || normalized === 'super admin') {
    return 'administration';
  }

  return 'unknown';
}

export function getDashboardWidgetConfig(
  department: string | null | undefined,
  role: number | null | undefined
): DashboardWidgetConfig {
  const key = resolveDashboardDepartment(department, role);
  return DEPARTMENT_WIDGET_CONFIG[key] || ALL_WIDGETS_ENABLED;
}
