'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface CourseRow {
  Course_Id: number;
  Course_Name: string | null;
  Course_Code: string | null;
  Introduction: string | null;
  IsActive: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CourseMasterPage() {
  const router = useRouter();
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('course');
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 25, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  /* Filter state */
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  /* Delete modal state */
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (isActiveFilter !== '') params.set('isActive', isActiveFilter);

      const res = await fetch(`/api/masters/course?${params.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (e) {
      console.error('Failed to fetch courses', e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => {
  setPage(1);
  setFetchTrigger(t => t + 1);
};

const handleClear = () => {
  setSearch('');
  setIsActiveFilter('');
  setPage(1);
  setFetchTrigger(t => t + 1);
};

  const handleExport = () => {
    /* Build CSV from current rows */
    const headers = ['Id', 'Course Name', 'Course Code', 'Introduction', 'Status'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.Course_Id,
          `"${(r.Course_Name || '').replace(/"/g, '""')}"`,
          `"${(r.Course_Code || '').replace(/"/g, '""')}"`,
          `"${(r.Introduction || '').replace(/"/g, '""')}"`,
          r.IsActive ? 'Active' : 'Inactive',
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `courses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddCourse = () => {
    router.push('/dashboard/masters/course/add');
  };

  const handleEditCourse = (id: number) => {
    router.push(`/dashboard/masters/course/edit/${id}`);
  };



const handleDelete = async () => {
  if (!deleteId) return;

  const previousRows = rows;

  setRows(rows.filter(r => r.Course_Id !== deleteId)); // optimistic

  try {
    const res = await fetch(`/api/masters/course?id=${deleteId}`, {
      method: 'DELETE',
    });

    if (!res.ok) throw new Error('Delete failed');

  } catch {
    setRows(previousRows); // rollback
    alert('Failed to delete course');
  } finally {
    setDeleteId(null);
  }
};
if (permLoading) return <PermissionLoading />;
if (!canView) return <AccessDenied message="You do not have permission to view courses." />;

return (
  <div className="space-y-4">

    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-[#2E3093]">Course Master</h2>
        <p className="text-sm text-gray-500">
          {pagination.total.toLocaleString()} total courses
        </p>
      </div>

      <div className="flex items-center gap-2">

        {/* Search */}
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search courses..."
            className="w-64 border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/25
                       focus:border-[#2A6BB5] bg-white shadow-sm"
          />
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Add Button */}
        {canCreate && (
        <button
          onClick={handleAddCourse}
          className="bg-[#2E3093] hover:bg-[#23257A] text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition"
        >
          Add Course
        </button>
        )}
      </div>
    </div>

    {/* Table Card */}
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

      <div className="overflow-x-auto">
        <table className="dashboard-table w-full text-sm">

          {/* Header */}
          <thead className="bg-[#F8F9FF] border-b border-gray-200">
            <tr className="text-xs uppercase tracking-wider text-[#2A6BB5]">
              <th className="text-left px-4 py-3 font-semibold w-[70px]">ID</th>
              <th className="text-left px-4 py-3 font-semibold">Course Name</th>
              <th className="text-left px-4 py-3 font-semibold w-[120px]">Code</th>
              <th className="text-left px-4 py-3 font-semibold">Introduction</th>
              <th className="text-center px-4 py-3 font-semibold w-[110px]">Status</th>
              <th className="text-right px-4 py-3 font-semibold w-[110px]">Actions</th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100">

            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#2A6BB5] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">Loading courses...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                  No courses available
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.Course_Id}
                  className="hover:bg-[#FAE452]/20 transition-colors"
                >
                  {/* ID */}
                  <td className="px-4 py-3 text-gray-500 font-mono">
                    {r.Course_Id}
                  </td>

                  {/* Course Name */}
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[260px]">
                    <span className="truncate block">
                      {r.Course_Name || '—'}
                    </span>
                  </td>

                  {/* Code */}
                  <td className="px-4 py-3">
                    {r.Course_Code ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md
                                       bg-[#2A6BB5]/10 text-[#2A6BB5] text-xs font-semibold">
                        {r.Course_Code}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Intro */}
                  <td className="px-4 py-3 text-gray-600 max-w-[360px]">
                    <span className="truncate block text-sm leading-relaxed">
                      {r.Introduction || '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                        r.IsActive
                          ? 'bg-[#2E3093]/10 text-[#2E3093]'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {r.IsActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex justify-end items-center gap-2">

                      {canUpdate && (
                      <button
                        title="Edit"
                        onClick={() => handleEditCourse(r.Course_Id)}
                        className="p-2 rounded-md text-gray-400 hover:text-[#2A6BB5] hover:bg-[#2A6BB5]/10 transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      )}

                      {canDelete && (
                      <button
                        title="Delete"
                        onClick={() => setDeleteId(r.Course_Id)}
                        className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      )}

                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-[#F8F9FF] text-sm">
          <p className="text-gray-600">
            Showing{' '}
            <span className="font-semibold text-[#2E3093]">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>
            {' '}to{' '}
            <span className="font-semibold text-[#2E3093]">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>
            {' '}of{' '}
            <span className="font-semibold text-[#2E3093]">
              {pagination.total}
            </span>
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600
                         hover:bg-white disabled:opacity-40"
            >
              Prev
            </button>

            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600
                         hover:bg-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Delete Modal */}
    {deleteId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />

        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
          <h3 className="text-lg font-semibold text-[#2E3093] mb-2">
            Delete Course?
          </h3>

          <p className="text-sm text-gray-500 mb-6">
            This action cannot be undone.
          </p>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}