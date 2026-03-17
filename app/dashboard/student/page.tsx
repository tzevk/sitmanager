'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface StudentRow {
  Student_Id: number;
  Student_Name: string | null;
  FName: string | null;
  LName: string | null;
  MName: string | null;
  Qualification: string | null;
  Course_Id: number | null;
  Course_Name: string | null;
  DOB: string | null;
  Sex: string | null;
  Nationality: string | null;
  Present_Address: string | null;
  Present_City: string | null;
  Present_State: string | null;
  Present_Country: string | null;
  Present_Pin: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  IsActive: number | null;
}

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function StudentPage() {
  const router = useRouter();
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('student');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 25, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  /* Filter state */
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [sex, setSex] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (courseId) params.set('courseId', courseId);
      if (sex) params.set('sex', sex);

      const res = await fetch(`/api/admission-activity/student?${params.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setCourses(data.courses ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (e) {
      console.error('Failed to fetch students', e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => { setPage(1); setFetchTrigger((t) => t + 1); };

  const handleClear = () => {
    setSearch('');
    setCourseId('');
    setSex('');
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      const res = await fetch(`/api/admission-activity/student?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch {
      /* ignore */
    }
  };

  const handleExport = () => {
    const headers = ['Id', 'Student Name', 'Email', 'Mobile', 'Course', 'City', 'Qualification'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.Student_Id,
          `"${(r.Student_Name || '').replace(/"/g, '""')}"`,
          `"${(r.Email || '').replace(/"/g, '""')}"`,
          r.Present_Mobile || '',
          `"${(r.Course_Name || '').replace(/"/g, '""')}"`,
          `"${(r.Present_City || '').replace(/"/g, '""')}"`,
          `"${(r.Qualification || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view students." /> : (<>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Student</h2>
          <p className="text-sm text-gray-400">
            {pagination.total.toLocaleString()} total students
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search name, email, mobile, city..."
              className="w-64 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm border ${
              showFilters
                ? 'bg-[#2E3093] text-white border-[#2E3093]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Expandable filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Course */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                ))}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Gender
              </label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600"
              >
                <option value="">All</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex items-end gap-2 col-span-2">
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 bg-[#2A6BB5] hover:bg-[#2360A0] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Apply
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold">Id</th>
                <th className="text-left py-3 px-4 font-semibold">Student Name</th>
                <th className="text-left py-3 px-4 font-semibold">Email</th>
                <th className="text-left py-3 px-4 font-semibold">Mobile</th>
                <th className="text-left py-3 px-4 font-semibold">Course</th>
                <th className="text-left py-3 px-4 font-semibold">City</th>
                <th className="text-left py-3 px-4 font-semibold">Qualification</th>
                <th className="text-center py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400">Loading students...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p className="text-sm">No students found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.Student_Id}
                    className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">
                      {r.Student_Id}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800 max-w-[200px]">
                      <span className="truncate block">{r.Student_Name || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 max-w-[200px]">
                      <span className="truncate block text-xs">{r.Email || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap font-mono text-xs">
                      {r.Present_Mobile || '—'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {r.Course_Name ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold truncate max-w-[150px]">
                          {r.Course_Name}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap text-xs">
                      {r.Present_City || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap text-xs">
                      {r.Qualification || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="View"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-[#2A6BB5] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {canUpdate && (
                        <button
                          title="Edit"
                          onClick={() => router.push(`/dashboard/student/edit/${r.Student_Id}`)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        )}
                        {canDelete && (
                        <button
                          onClick={() => handleDelete(r.Student_Id)}
                          title="Delete"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-600">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              {' '}-{' '}
              <span className="font-semibold text-gray-600">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-semibold text-gray-600">
                {pagination.total.toLocaleString()}
              </span>
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={pagination.page <= 1}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {(() => {
                const pages: number[] = [];
                const total = pagination.totalPages;
                const current = pagination.page;
                const start = Math.max(1, current - 2);
                const end = Math.min(total, current + 2);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-md border transition-colors ${
                      p === current
                        ? 'bg-[#2E3093] text-white border-[#2E3093]'
                        : 'border-gray-200 hover:bg-white text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
