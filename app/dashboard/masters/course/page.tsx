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
            className="w-64 bg-gray-50/50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-700
                       placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10
                       focus:border-[#2A6BB5] shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all font-medium"
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
          className="bg-gradient-to-br from-[#2E3093] to-[#4547B2] hover:to-[#23257A] text-white px-5 py-2 rounded-xl text-sm font-bold shadow-[0_4px_14px_rgba(46,48,147,0.3)] hover:shadow-[0_6px_20px_rgba(46,48,147,0.4)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Add Course
        </button>
        )}
      </div>
    </div>

    {/* Table Card */}
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden">

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">

          {/* Header */}
          <thead className="bg-slate-50/80 backdrop-blur-xl border-b-2 border-[#2A6BB5]/30 shadow-sm sticky top-0 z-10 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-r before:from-[#2E3093]/[0.02] before:to-[#2A6BB5]/[0.02] before:z-[-1]">
            <tr className="text-[11px] font-black uppercase tracking-widest text-[#2E3093] divide-x divide-[#2A6BB5]/30">
              <th className="text-left px-6 py-4 w-[70px]">ID</th>
              <th className="text-left px-6 py-4 w-[320px]">Course Name</th>
              <th className="text-left px-6 py-4 w-[90px]">Code</th>
              <th className="text-left px-6 py-4">Introduction</th>
              <th className="text-center px-6 py-4 w-[110px]">Status</th>
              <th className="text-right px-6 py-4 w-[110px]">Actions</th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-[#2A6BB5]/30">

            {loading ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin shadow-sm" />
                    <span className="text-sm font-medium text-slate-500 tracking-wide">Loading courses...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400 text-sm font-medium">
                  No courses available matching your criteria
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.Course_Id}
                  className="group hover:bg-gradient-to-r hover:from-[#2A6BB5]/[0.05] hover:to-transparent transition-all duration-300 border-b border-[#2A6BB5]/30 last:border-none divide-x divide-[#2A6BB5]/25"
                >
                  {/* ID */}
                  <td className="px-6 py-4.5 text-slate-500 font-mono text-[13px] relative font-semibold">
                    <span className="absolute inset-y-0 left-0 w-1 bg-[#2A6BB5] opacity-0 group-hover:opacity-100 transition-opacity rounded-r-full"></span>
                    <span className="pl-1 drop-shadow-sm">{r.Course_Id}</span>
                  </td>

                  {/* Course Name */}
                  <td className="px-6 py-4.5 font-bold text-slate-800 max-w-[320px]">
                    <span className="truncate block group-hover:text-[#2E3093] transition-colors drop-shadow-sm text-[14px]">
                      {r.Course_Name || '—'}
                    </span>
                  </td>

                  {/* Code */}
                  <td className="px-6 py-4.5">
                    {r.Course_Code ? (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg
                                       bg-[#2A6BB5]/10 text-[#2A6BB5] text-[11px] font-black border border-[#2A6BB5]/20 shadow-sm uppercase tracking-wider">
                        {r.Course_Code}
                      </span>
                    ) : (
                      <span className="text-slate-300 font-medium">—</span>
                    )}
                  </td>

                  {/* Intro */}
                  <td className="px-6 py-4.5 text-slate-600 max-w-sm lg:max-w-lg xl:max-w-2xl">
                    <span className="truncate block text-[13px] leading-relaxed font-medium">
                      {r.Introduction || '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4.5 text-center">
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-black shadow-sm border ${
                        r.IsActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : 'bg-slate-50 text-slate-500 border-slate-200/60'
                      }`}
                    >
                      {r.IsActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4.5">
                    <div className="flex justify-end items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">

                      {canUpdate && (
                      <button
                        title="Edit"
                        onClick={() => handleEditCourse(r.Course_Id)}
                        className="p-2 rounded-lg text-[#2A6BB5] hover:bg-[#2A6BB5]/10 hover:shadow-sm border border-transparent hover:border-[#2A6BB5]/20 transition-all bg-white shadow-sm ring-1 ring-slate-200/50"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      )}

                      {canDelete && (
                      <button
                        title="Delete"
                        onClick={() => setDeleteId(r.Course_Id)}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 hover:shadow-sm border border-transparent hover:border-rose-200 transition-all bg-white shadow-sm ring-1 ring-slate-200/50"
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 bg-gray-50/50 text-sm rounded-b-xl">
          <p className="text-gray-500 font-medium">
            Showing{' '}
            <span className="font-bold text-[#2E3093]">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>
            {' '}to{' '}
            <span className="font-bold text-[#2E3093]">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>
            {' '}of{' '}
            <span className="font-bold text-[#2E3093]">
              {pagination.total}
            </span>
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-4 py-1.5 border border-gray-300 rounded-lg text-gray-600 font-semibold shadow-sm hover:border-[#2A6BB5] hover:text-[#2A6BB5] hover:bg-blue-50/50 disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-600 disabled:hover:bg-transparent transition-all"
            >
              Prev
            </button>

            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-1.5 border border-gray-300 rounded-lg text-gray-600 font-semibold shadow-sm hover:border-[#2A6BB5] hover:text-[#2A6BB5] hover:bg-blue-50/50 disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-600 disabled:hover:bg-transparent transition-all"
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