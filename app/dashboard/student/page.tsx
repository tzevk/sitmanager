'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface StudentRow {
  Student_Id: number;
  Batch_Code: string | null;
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

  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [sex, setSex] = useState('');
  const [page, setPage] = useState(1);

  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

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
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleExport = () => {
    const headers = ['Batch Code', 'Student Name', 'Email', 'Mobile', 'Course', 'City', 'Qualification'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          `"${(r.Batch_Code || '').replace(/"/g, '""')}"`,
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
    <div className="flex flex-col gap-2">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view students." /> : (<>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Student</h2>
            <p className="text-[11px] text-white/60 mt-0.5">{pagination.total.toLocaleString()} total students</p>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 text-white border border-white/20 hover:bg-white/25 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search name, email, mobile, batch…"
              className={`${ctrl} w-full pl-7`}
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={ctrl}>
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
            ))}
          </select>
          <select value={sex} onChange={(e) => setSex(e.target.value)} className={ctrl}>
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2E3093] text-white hover:bg-[#252880] transition-colors"
          >
            Search
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                <th className="text-left py-1.5 px-3 font-bold">Batch Code</th>
                <th className="text-left py-1.5 px-3 font-bold">Student Name</th>
                <th className="text-left py-1.5 px-3 font-bold">Email</th>
                <th className="text-left py-1.5 px-3 font-bold">Mobile</th>
                <th className="text-left py-1.5 px-3 font-bold">Course</th>
                <th className="text-left py-1.5 px-3 font-bold">City</th>
                <th className="text-left py-1.5 px-3 font-bold">Qualification</th>
                <th className="text-center py-1.5 px-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500">Loading students…</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <p className="text-xs text-slate-400">No students found</p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.Student_Id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="py-1.5 px-3 text-slate-500 font-mono text-xs">{r.Batch_Code || '—'}</td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900 text-xs max-w-[180px]">
                      <span className="truncate block">{r.Student_Name || '—'}</span>
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 text-xs max-w-[200px]">
                      <span className="truncate block">{r.Email || '—'}</span>
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 font-mono text-xs whitespace-nowrap">{r.Present_Mobile || '—'}</td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      {r.Course_Name ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-semibold truncate max-w-[140px]">
                          {r.Course_Name}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 text-xs whitespace-nowrap">{r.Present_City || '—'}</td>
                    <td className="py-1.5 px-3 text-slate-600 text-xs whitespace-nowrap">{r.Qualification || '—'}</td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button title="View" className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-[#2A6BB5] transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {canUpdate && (
                          <button
                            title="Edit"
                            onClick={() => router.push(`/dashboard/student/edit/${r.Student_Id}`)}
                            className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(r.Student_Id)}
                            title="Delete"
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] text-slate-500">
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={pagination.page <= 1}
                className="px-1.5 py-1 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold text-slate-700"
              >First</button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                    className={`w-6 h-6 text-[11px] rounded border transition-colors ${
                      p === current ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:bg-white text-slate-700'
                    }`}
                  >{p}</button>
                ));
              })()}
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-1.5 py-1 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold text-slate-700"
              >Last</button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
