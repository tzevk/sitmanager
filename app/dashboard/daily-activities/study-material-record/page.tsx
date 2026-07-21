'use client';

import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

export default function StudyMaterialRecordPage() {
  const { canView, canCreate, canUpdate, loading } = useResourcePermissions('study_material_record');

  if (loading) return <PermissionLoading />;
  if (!canView && !canCreate && !canUpdate) {
    return <AccessDenied message="You do not have permission to access Study Material Records." />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-3 shadow-sm">
        <h2 className="text-base font-bold text-white">Study Material Record</h2>
        <p className="text-xs text-white/70 mt-0.5">Manage study materials for batches</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <h3 className="text-base font-semibold text-gray-600 mb-1">Study Material Record</h3>
        <p className="text-sm text-gray-400">
          This section will list and manage study materials distributed to students.
        </p>
        <p className="text-xs text-[#2E3093] mt-3 font-medium">
          Feature coming soon — please contact the administrator to configure this module.
        </p>
      </div>
    </div>
  );
}
