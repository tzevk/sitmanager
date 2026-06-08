'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface StudentRow {
  Student_Id: number;
  Student_Code: string | null;
  Student_Name: string | null;
  DOB: string | null;
  Present_City: string | null;
  Email: string | null;
  Present_Mobile: string | null;
  Qualification: string | null;
  Course_Id: number | null;
  Course_Name: string | null;
  Sex: string | null;
  IsActive: number | null;
  Admission_Date: string | null;
  Payment_Type: string | null;
  Amount: number | null;
  Batch_Code: string | null;
  Batch_code_resolved: string | null;
  Batch_SDate: string | null;
  Batch_EDate: string | null;
  _legacy?: boolean;
}

interface Course { Course_Id: number; Course_Name: string }
interface Pagination { page: number; limit: number; total: number; totalPages: number }

export default function StudentPage() {
  const router = useRouter();
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('student');
  const [rows, setRows]             = useState<StudentRow[]>([]);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading]       = useState(true);

  const [search,    setSearch]    = useState('');
  const [courseId,  setCourseId]  = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [sex,       setSex]       = useState('');
  const [page,      setPage]      = useState(1);

  const searchRef      = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '25');
      p.set('admittedOnly', '1');
      if (search)    p.set('search',    search);
      if (courseId)  p.set('courseId',  courseId);
      if (batchCode) p.set('batchCode', batchCode);
      if (sex)       p.set('sex',       sex);

      const res  = await fetch(`/api/admission-activity/student?${p.toString()}`);
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

  const handleSearch = () => { setPage(1); setFetchTrigger(t => t + 1); };
  const handleClear  = () => {
    setSearch(''); setCourseId(''); setBatchCode(''); setSex('');
    setPage(1); setFetchTrigger(t => t + 1);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this student?')) return;
    try {
      const res = await fetch(`/api/admission-activity/student?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleExport = () => {
    const fmt     = (v: string | null | undefined) => `"${(v || '').replace(/"/g, '""')}"`;
    const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('en-IN') : '';
    const headers = [
      'Student Code', 'Student Name', 'DOB', 'Email', 'Mobile',
      'Course', 'Batch', 'Admission Date', 'Payment Type', 'Amount', 'Status',
    ];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        fmt(r.Student_Code),
        fmt(r.Student_Name),
        fmtDate(r.DOB),
        fmt(r.Email),
        r.Present_Mobile || '',
        fmt(r.Course_Name),
        fmt(r.Batch_code_resolved || r.Batch_Code),
        fmtDate(r.Admission_Date),
        fmt(r.Payment_Type),
        r.Amount ?? '',
        r.IsActive ? 'Active' : 'Inactive',
      ].join(',')),
    ].join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const fmtAmount = (v: number | null) =>
    v ? `₹${Number(v).toLocaleString('en-IN')}` : '';

  return (
    <div className="flex flex-col gap-2">
      {permLoading ? <PermissionLoading /> : !canView ? (
        <AccessDenied message="You do not have permission to view students." />
      ) : (<>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Students</h2>
            <p className="text-[11px] text-white/60 mt-0.5">{pagination.total.toLocaleString()} total</p>
          </div>
          <button onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 text-white border border-white/20 hover:bg-white/25 transition-all">
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
            <input ref={searchRef} type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search name, email, mobile, code…"
              className={`${ctrl} w-full pl-7`} />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select value={courseId} onChange={e => setCourseId(e.target.value)} className={ctrl}>
            <option value="">All Courses</option>
            {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
          </select>
          <input type="text" value={batchCode} onChange={e => setBatchCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Batch code…" className={`${ctrl} w-[110px]`} />
          <select value={sex} onChange={e => setSex(e.target.value)} className={ctrl}>
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <button onClick={handleSearch}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2E3093] text-white hover:bg-[#252880] transition-colors">
            Search
          </button>
          <button onClick={handleClear}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-colors">
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
                <th className="text-left py-1.5 px-3 font-bold">#</th>
                <th className="text-left py-1.5 px-3 font-bold whitespace-nowrap">Student Name</th>
                <th className="text-left py-1.5 px-3 font-bold whitespace-nowrap">Course</th>
                <th className="text-left py-1.5 px-3 font-bold whitespace-nowrap">Admission Date</th>
                <th className="text-left py-1.5 px-3 font-bold whitespace-nowrap">Batch</th>
                <th className="text-left py-1.5 px-3 font-bold whitespace-nowrap">Payment</th>
                <th className="text-right py-1.5 px-3 font-bold whitespace-nowrap">Amount</th>
                <th className="text-center py-1.5 px-3 font-bold whitespace-nowrap">Status</th>
                <th className="text-center py-1.5 px-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-500">Loading students…</span>
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-xs text-slate-400">No students found</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.Student_Id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">

                  {/* # */}
                  <td className="py-1.5 px-3 text-xs text-slate-400 whitespace-nowrap">
                    {(pagination.page - 1) * pagination.limit + i + 1}
                  </td>

                  {/* Name + Code + Mobile */}
                  <td className="py-1.5 px-3 max-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <span className="block text-xs font-semibold text-slate-900 truncate">{r.Student_Name || '—'}</span>
                      {r._legacy && (
                        <span className="inline-block px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap flex-shrink-0">Legacy</span>
                      )}
                    </div>
                    {r.Student_Code && (
                      <span className="text-[11px] font-mono text-slate-400">{r.Student_Code}</span>
                    )}
                    {r.Present_Mobile && (
                      <span className="block text-[11px] text-slate-400">{r.Present_Mobile}</span>
                    )}
                  </td>

                  {/* Course */}
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    {r.Course_Name
                      ? <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-semibold max-w-[160px] truncate">{r.Course_Name}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>

                  {/* Admission Date */}
                  <td className="py-1.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                    {fmtDate(r.Admission_Date)}
                  </td>

                  {/* Batch */}
                  <td className="py-1.5 px-3 text-xs font-mono text-slate-700 whitespace-nowrap">
                    {r.Batch_code_resolved || r.Batch_Code || '—'}
                  </td>

                  {/* Payment Type */}
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    {r.Payment_Type
                      ? <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold">{r.Payment_Type}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>

                  {/* Amount */}
                  <td className="py-1.5 px-3 text-xs text-slate-700 text-right whitespace-nowrap font-mono">
                    {fmtAmount(r.Amount)}
                  </td>

                  {/* Status */}
                  <td className="py-1.5 px-3 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      r.IsActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {r.IsActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-1.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button title="View" className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-[#2A6BB5] transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {canUpdate && (
                        <button title="Edit"
                          onClick={() => router.push(`/dashboard/student/edit/${r.Student_Id}`)}
                          className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button title="Delete"
                          onClick={() => handleDelete(r.Student_Id)}
                          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
              <button onClick={() => setPage(1)} disabled={pagination.page <= 1}
                className="px-1.5 py-1 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-slate-700">First</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-slate-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {(() => {
                const cur = pagination.page, tot = pagination.totalPages, pages: number[] = [];
                for (let i = Math.max(1, cur - 2); i <= Math.min(tot, cur + 2); i++) pages.push(i);
                return pages.map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-6 h-6 text-[11px] rounded border transition-colors ${p === cur ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:bg-white text-slate-700'}`}>
                    {p}
                  </button>
                ));
              })()}
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages}
                className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-slate-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => setPage(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages}
                className="px-1.5 py-1 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-slate-700">Last</button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
