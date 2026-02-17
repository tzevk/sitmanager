'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Batch {
  Batch_Id: number;
  Batch_code: string;
  Category: string | null;
  Timings: string | null;
}

interface AllocatedBatch {
  Batch_Id: number;
  Batch_code: string;
  Course_Name: string;
}

interface Student {
  id: number;          // Admission_Id
  studentCode: number; // Student_Id
  studentName: string;
  admissionDate: string | null;
  phase: string | null;
  rollNo: string;
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
export default function AllotRollNumberPage() {

  /* ---- Dropdown data ---- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allocatedBatches, setAllocatedBatches] = useState<AllocatedBatch[]>([]);

  /* ---- Selected filters ---- */
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');

  /* ---- Student list ---- */
  const [rows, setRows] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  /* ---- Roll number editing ---- */
  const [rollEdits, setRollEdits] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasEdits, setHasEdits] = useState(false);

  /* ---- Misc ---- */
  const [initialLoad, setInitialLoad] = useState(true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  /* ================================================================ */
  /*  Fetch courses on mount                                          */
  /* ================================================================ */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/daily-activities/allot-roll-number');
        const data = await res.json();
        setCourses(data.courses || []);
        setAllocatedBatches(data.allocatedBatches || []);
      } catch { /* ignore */ }
      setInitialLoad(false);
    })();
  }, []);

  /* ================================================================ */
  /*  Fetch batches when course changes                               */
  /* ================================================================ */
  useEffect(() => {
    if (!courseId) { setBatches([]); setBatchId(''); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/allot-roll-number?courseId=${courseId}`);
        const data = await res.json();
        setBatches(data.batches || []);
      } catch { /* ignore */ }
    })();
    setBatchId('');
    setRows([]);
    setRollEdits({});
  }, [courseId]);

  /* ================================================================ */
  /*  Fetch students when batch selected                              */
  /* ================================================================ */
  const fetchStudents = useCallback(async () => {
    if (!courseId || !batchId) return;
    setLoading(true);
    setSaveMsg(null);
    try {
      const params = new URLSearchParams();
      params.set('courseId', courseId);
      params.set('batchId', batchId);
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);

      const res = await fetch(`/api/daily-activities/allot-roll-number?${params}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
      setAllocatedBatches(data.allocatedBatches || []);

      // Initialise edit state from existing roll numbers
      const edits: Record<number, string> = {};
      for (const s of (data.rows ?? []) as Student[]) edits[s.id] = s.rollNo || '';
      setRollEdits(edits);
      setHasEdits(false);
    } catch { /* ignore */ }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, batchId, page, fetchTrigger]);

  useEffect(() => { if (courseId && batchId) fetchStudents(); }, [fetchStudents, courseId, batchId]);

  /* ================================================================ */
  /*  Auto-generate roll numbers                                     */
  /* ================================================================ */
  const handleAutoGenerate = () => {
    const newEdits = { ...rollEdits };
    const batchObj = batches.find(b => String(b.Batch_Id) === batchId);
    const prefix = batchObj?.Batch_code?.replace(/\s/g, '') || 'ROLL';

    rows.forEach((s, idx) => {
      newEdits[s.id] = `${prefix}-${String(idx + 1).padStart(3, '0')}`;
    });
    setRollEdits(newEdits);
    setHasEdits(true);
  };

  /* ================================================================ */
  /*  Save roll numbers                                               */
  /* ================================================================ */
  const handleSave = async () => {
    if (!batchId) return;
    setSaving(true);
    setSaveMsg(null);

    const rollNumbers = rows.map(s => ({
      admissionId: s.id,
      rollNo: rollEdits[s.id] || '',
    }));

    try {
      const res = await fetch('/api/daily-activities/allot-roll-number', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: Number(batchId), rollNumbers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaveMsg({ type: 'success', text: `Roll numbers allotted successfully for ${data.updated} students.` });
      setHasEdits(false);
      fetchStudents(); // refresh
    } catch (err: unknown) {
      setSaveMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
    setSaving(false);
  };

  /* ================================================================ */
  /*  Export CSV                                                       */
  /* ================================================================ */
  const handleExport = () => {
    const headers = ['Sr.', 'Student Code', 'Student Name', 'Admission Date', 'Phase', 'Roll No'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r, i) => [
        i + 1,
        r.studentCode,
        `"${(r.studentName || '').replace(/"/g, '""')}"`,
        `"${formatDate(r.admissionDate)}"`,
        `"${(r.phase || '').replace(/"/g, '""')}"`,
        `"${(rollEdits[r.id] || r.rollNo || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roll-numbers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ================================================================ */
  /*  Helpers                                                          */
  /* ================================================================ */
  const formatDate = (d: string | null) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return d; }
  };

  const selectedCourseName = courses.find(c => String(c.Course_Id) === courseId)?.Course_Name || '';
  const selectedBatchCode = batches.find(b => String(b.Batch_Id) === batchId)?.Batch_code || '';
  const totalPages = pagination.totalPages;

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Allot Roll Number</h1>
          <p className="text-xs text-gray-400">Daily Activities / Allot Roll Number</p>
        </div>
      </div>

      {/* ──── Previously Allocated Batches ──── */}
      {allocatedBatches.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-bold text-[#2E3093] uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Roll No. Allocated Batches
          </h3>
          <div className="flex flex-wrap gap-2">
            {allocatedBatches.map(ab => (
              <button
                key={ab.Batch_Id}
                onClick={() => {
                  // Quick-jump: set the course and batch
                  const course = courses.find(c => c.Course_Name === ab.Course_Name);
                  if (course) setCourseId(String(course.Course_Id));
                  // batchId will be set after batches load via effect
                  setTimeout(() => setBatchId(String(ab.Batch_Id)), 300);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {ab.Batch_code}
                <span className="text-green-500">({ab.Course_Name})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ──── Selection Card ──── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          {/* Course */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#2E3093]">Select Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] transition bg-white"
            >
              <option value="">— Choose Course —</option>
              {courses.map(c => (
                <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
              ))}
            </select>
          </div>

          {/* Batch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#2E3093]">Select Batch Code</label>
            <select
              value={batchId}
              onChange={(e) => { setBatchId(e.target.value); setPage(1); }}
              disabled={!courseId}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] transition bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">— Choose Batch —</option>
              {batches.map(b => (
                <option key={b.Batch_Id} value={b.Batch_Id}>
                  {b.Batch_code}{b.Category ? ` (${b.Category})` : ''}{b.Timings ? ` — ${b.Timings}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selection summary */}
        {courseId && batchId && (
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-[#2E3093]/10 text-[#2E3093] font-semibold">
              {selectedCourseName}
            </span>
            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="px-2.5 py-1 rounded-full bg-[#2A6BB5]/10 text-[#2A6BB5] font-semibold">
              {selectedBatchCode}
            </span>
            <span className="ml-auto text-gray-400">
              {pagination.total} student{pagination.total !== 1 ? 's' : ''} found
            </span>
          </div>
        )}
      </div>

      {/* ──── Empty / Prompt state ──── */}
      {!courseId || !batchId ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E3093]/10 to-[#2A6BB5]/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#2E3093]/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-600 mb-1">Select Course & Batch</h3>
            <p className="text-xs text-gray-400 max-w-xs">
              Choose a course and batch code above to view the student list and allot roll numbers.
            </p>
          </div>
        </div>
      ) : (
        /* ──── Student List Card ──── */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2 py-0.5">
                Allot Roll Number List ({pagination.total})
              </span>
              {hasEdits && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 animate-pulse">
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Auto Generate */}
              <button
                onClick={handleAutoGenerate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#2A6BB5] text-[#2A6BB5] hover:bg-[#2A6BB5]/5 transition-colors"
                title="Auto-generate roll numbers using batch code as prefix"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto Generate
              </button>

              {/* Export */}
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>

              {/* Search */}
              <div className="relative">
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setFetchTrigger((t) => t + 1); } }}
                  placeholder="Search…"
                  className="w-44 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
                />
                <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Success / Error banner */}
          {saveMsg && (
            <div className={`mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
              saveMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {saveMsg.type === 'success' ? (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {saveMsg.text}
              <button
                onClick={() => setSaveMsg(null)}
                className="ml-auto text-xs opacity-60 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="dashboard-table w-full text-sm min-w-[800px]">
              <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100/80 z-10">
                <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4 border-b border-gray-200 w-12">Sr.</th>
                  <th className="py-3 px-4 border-b border-gray-200">Student Code</th>
                  <th className="py-3 px-4 border-b border-gray-200">Student Name</th>
                  <th className="py-3 px-4 border-b border-gray-200">Admission Date</th>
                  <th className="py-3 px-4 border-b border-gray-200">Phase</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-48">Roll No.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-gray-400">
                        <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                        Loading students...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                      No students found in this batch
                    </td>
                  </tr>
                ) : (
                  rows.map((s, idx) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">
                        {(page - 1) * pagination.limit + idx + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-[#2E3093]/8 text-[#2E3093] rounded">
                          {s.studentCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-gray-800">{s.studentName}</td>
                      <td className="py-2.5 px-4 text-gray-600 text-xs">{formatDate(s.admissionDate)}</td>
                      <td className="py-2.5 px-4">
                        {s.phase ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                            {s.phase}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={rollEdits[s.id] ?? s.rollNo}
                          onChange={(e) => {
                            setRollEdits(prev => ({ ...prev, [s.id]: e.target.value }));
                            setHasEdits(true);
                          }}
                          placeholder="Enter roll no."
                          className="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 transition"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: Pagination + Save Button */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100">
            {/* Pagination */}
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
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Save */}
            {rows.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving || !hasEdits}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#23257A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Allot Roll Number
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
