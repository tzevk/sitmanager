'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Dedupe                                                             */
/* ------------------------------------------------------------------ */
function normalizeTextKey(v: string | null) {
  return (v ?? '').trim().toLowerCase();
}

function normalizeDateKey(v: string | null) {
  if (!v) return '';
  // Most DB date strings are ISO-ish; slice to the date part for stability.
  return v.length >= 10 ? v.slice(0, 10) : v;
}

function dedupeLectures(input: Lecture[]) {
  const seenIds = new Set<number>();
  const seenComposite = new Set<string>();
  const output: Lecture[] = [];

  for (const r of input) {
    const id = Number(r.Take_Id);
    if (Number.isFinite(id)) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }

    // Practical duplicate definition for display: same batch + faculty + date + lecture.
    // Prefer Lecture_Id when present; otherwise fall back to Lecture_Name + Topic.
    const lectureKey = r.Lecture_Id != null
      ? `lid:${String(r.Lecture_Id)}`
      : `ln:${normalizeTextKey(r.Lecture_Name)}|tp:${normalizeTextKey(r.Topic)}`;

    const composite = [
      `b:${String(r.Batch_Id ?? '')}`,
      `f:${String(r.Faculty_Id ?? '')}`,
      `d:${normalizeDateKey(r.Take_Dt)}`,
      lectureKey,
    ].join('|');

    if (seenComposite.has(composite)) continue;
    seenComposite.add(composite);

    output.push(r);
  }

  return { rows: output, hidden: Math.max(0, input.length - output.length) };
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Lecture {
  Take_Id: number;
  Lecture_Name: string | null;
  Topic: string | null;
  Take_Dt: string | null;
  Faculty_Start?: string | null;
  Faculty_End?: string | null;
  Subject?: string | null;
  Subject_Name?: string | null;
  Faculty_Id: number | null;
  Faculty_Name: string | null;
  Course_Id: number | null;
  Course_Name: string | null;
  Batch_Id: number | null;
  Batch_code: string | null;
  Lecture_Id: number | null;
  studentCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function LectureTakenPage() {
  return (
    <PermissionGate resource="lecture" deniedMessage="You do not have permission to view lectures.">
      {(perms) => <LectureTakenContent {...perms} />}
    </PermissionGate>
  );
}

function LectureTakenContent({ canCreate, canUpdate, canDelete }: { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; canExport: boolean }) {
  const router = useRouter();

  /* ---- Data ---- */
  const [rows, setRows] = useState<Lecture[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [hiddenDuplicates, setHiddenDuplicates] = useState(0);

  /* ---- Refs ---- */
  const searchRef = useRef<HTMLInputElement>(null);
  const searchValueRef = useRef('');
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const fetchLectures = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (searchValueRef.current) params.set('search', searchValueRef.current);

      const res = await fetch(`/api/daily-activities/lecture-taken?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const deduped = dedupeLectures(data.rows ?? []);
      setRows(deduped.rows);
      setHiddenDuplicates(deduped.hidden);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [page, fetchTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  /* ================================================================ */
  /*  Search handlers                                                  */
  /* ================================================================ */
  const handleSearch = () => {
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleClear = () => {
    setSearch('');
    searchValueRef.current = '';
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  /* ================================================================ */
  /*  Delete handler                                                   */
  /* ================================================================ */
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this lecture record?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/daily-activities/lecture-taken?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setFetchTrigger(t => t + 1);
    } catch {
      alert('Failed to delete lecture record');
    }
    setDeleting(null);
  };

  /* ================================================================ */
  /*  Helpers                                                          */
  /* ================================================================ */
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const formatTime = (t?: string | null) => {
    const s = (t ?? '').trim();
    return s ? s : '—';
  };

  const totalPages = pagination.totalPages;

  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/15">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Lecture Taken</h1>
              <p className="text-xs text-white/70">Daily Activities / Lecture Taken</p>
            </div>
          </div>

          {canCreate && (
            <button
              onClick={() => router.push('/dashboard/daily-activities/lecture-taken/add')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-white text-[#2E3093] hover:bg-white/90 transition-colors shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Lecture Details
            </button>
          )}
        </div>
      </div>

      {/* ──── Main Card ──── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearch(v);
                  searchValueRef.current = v;
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Search…"
                className="w-56 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors"
            >
              Search
            </button>

            {/* Clear button */}
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>

            {/* Total records badge */}
            <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2.5 py-0.5">
              Total Records: {pagination.total}
            </span>

            {/* Hidden duplicates badge */}
            {hiddenDuplicates > 0 && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5 border border-amber-100">
                Duplicates hidden: {hiddenDuplicates}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="dashboard-table w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100/80 z-10">
              <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 border-b border-gray-200 w-16 text-center">Sr No</th>
                <th className="py-3 px-4 border-b border-gray-200 w-28">Date</th>
                <th className="py-3 px-4 border-b border-gray-200">Lecture Taken Name</th>
                <th className="py-3 px-4 border-b border-gray-200">Batch Code</th>
                <th className="py-3 px-4 border-b border-gray-200">Trainer Name</th>
                <th className="py-3 px-4 border-b border-gray-200 w-32">Trainer In Time</th>
                <th className="py-3 px-4 border-b border-gray-200 w-32">Trainer Out Time</th>
                <th className="py-3 px-4 border-b border-gray-200 w-24 text-center">Students</th>
                <th className="py-3 px-4 border-b border-gray-200 w-28 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      Loading lectures...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400">No lecture records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={r.Take_Id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold bg-[#2E3093]/8 text-[#2E3093] rounded-full">
                        {(page - 1) * pagination.limit + idx + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 text-xs font-medium">
                      {formatDate(r.Take_Dt)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 text-sm leading-tight truncate max-w-[420px]" title={(r.Subject_Name || r.Topic || r.Lecture_Name || '').toString()}>
                          {r.Subject_Name || r.Topic || r.Lecture_Name || '—'}
                        </span>
                        <span className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[420px]" title={(r.Subject || '').toString()}>
                          {r.Subject || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                        {r.Batch_code || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">
                      {r.Faculty_Name || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">
                      {formatTime(r.Faculty_Start)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">
                      {formatTime(r.Faculty_End)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold bg-green-50 text-green-700 rounded-full">
                        {r.studentCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Edit */}
                        {canUpdate && (
                        <button
                          onClick={() => router.push(`/dashboard/daily-activities/lecture-taken/add?id=${r.Take_Id}`)}
                          className="p-1.5 rounded-lg text-[#2A6BB5] hover:bg-[#2A6BB5]/10 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        )}
                        {/* Delete */}
                        {canDelete && (
                        <button
                          onClick={() => handleDelete(r.Take_Id)}
                          disabled={deleting === r.Take_Id}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === r.Take_Id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
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

        {/* Footer: Pagination */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            {totalPages > 1 && (
              <>
                <span className="text-xs text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
          <span className="text-xs text-gray-400">
            Showing {rows.length > 0 ? (page - 1) * pagination.limit + 1 : 0}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
        </div>
      </div>
    </div>
  );
}
