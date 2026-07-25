'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';

interface StandardLecturePlanRow {
  courseName: string;
  courseCode: string | null;
  courseId: number | null;
  lectureCount: number;
}

export default function StandardLecturePlanPage() {
  const router = useRouter();
  const { canView, loading: permLoading } = useResourcePermissions('standard_lecture_plan');

  const [rows, setRows] = useState<StandardLecturePlanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);

      const res = await fetch(`/api/masters/standard-lecture-plan/lectures/courses?${params.toString()}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(data?.error || `Failed to fetch (${res.status})`);
      }
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch';
      setRows([]);
      setTotal(0);
      setListError(message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p className="text-sm font-semibold">Access Denied</p>
        <p className="text-xs">You do not have permission to view standard lecture plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-8 py-6 shadow-[0_10px_30px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Standard Lecture Plan</h2>
            <p className="text-[14px] text-white/80 font-medium mt-1">Masters &gt; Standard Lecture Plan</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-[#2E3093] bg-[#FAE452]/60 border border-[#FAE452] rounded-full px-3 py-1">
                {total.toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by training programme…"
                className="w-64 pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all"
              />
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {listError && (
            <div className="px-5 py-3 border-b border-slate-100 bg-red-50/60 text-red-700 text-sm font-medium">
              {listError}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="dashboard-table w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Training Programme</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Course Code</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-600">Lecture Count</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-slate-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-sm">No training programmes found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map(r => (
                    <tr key={r.courseName} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-slate-900 font-semibold">{r.courseName || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{r.courseCode || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 text-center">{r.lectureCount}</td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          title="Edit"
                          onClick={() => router.push(`/dashboard/masters/standard-lecture-plan/edit/${encodeURIComponent(r.courseName)}`)}
                          className="p-2 rounded-lg hover:bg-[#FAE452]/70 text-[#2E3093] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:border-[#2E3093]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-2 text-sm border rounded-xl transition-colors ${
                        page === p ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:border-[#2E3093]/30'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:border-[#2E3093]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
