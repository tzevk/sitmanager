'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { PageHeader, GhostBtn } from '@/components/ui/PageHeader';

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
  StudentCount?: number;
}

interface AllocatedBatch {
  Batch_Id: number;
  Batch_code: string;
  Course_Id: number;
  Course_Name: string;
}

interface Student {
  id: number;          // Admission_Id
  studentCode: number; // Student_Code
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
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('roll_number');

  /* ---- Dropdown data ---- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allocatedBatches, setAllocatedBatches] = useState<AllocatedBatch[]>([]);

  /* ---- Selected filters ---- */
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);

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
  const [showAllocated, setShowAllocated] = useState(false);

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

  useEffect(() => {
    if (!pendingBatchId || !batches.length) return;
    const exists = batches.some((b) => String(b.Batch_Id) === pendingBatchId);
    if (exists) {
      setBatchId(pendingBatchId);
      setPage(1);
    }
    setPendingBatchId(null);
  }, [pendingBatchId, batches]);

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
  const deriveYear2 = (batchCode: string | undefined, sampleAdmissionDate: string | null | undefined) => {
    const yearFromDate = (() => {
      if (!sampleAdmissionDate) return null;
      const d = new Date(sampleAdmissionDate);
      const y = d.getFullYear();
      return Number.isFinite(y) ? y : null;
    })();

    const yearFromBatchCode = (() => {
      const code = (batchCode || '').replace(/\s+/g, '');
      const match4 = code.match(/20(\d{2})/);
      if (match4) return 2000 + Number(match4[1]);
      const match2 = code.match(/(?:^|\D)(\d{2})(?:\D|$)/);
      if (match2) return 2000 + Number(match2[1]);
      return null;
    })();

    const y = yearFromDate ?? yearFromBatchCode ?? new Date().getFullYear();
    return String(y % 100).padStart(2, '0');
  };

  const deriveBatchNo = (batchCode: string | undefined, year2: string, fallbackBatchId: string) => {
    const code = (batchCode || '').replace(/\s+/g, '');

    // Pull numeric chunks from batch code.
    let digits = (code.match(/\d+/g) || []).join('');

    // Remove year tokens once (handles both 2025 and 25 patterns).
    if (digits) {
      digits = digits.replace(`20${year2}`, '');
      digits = digits.replace(year2, '');
    }

    const raw = digits || String(fallbackBatchId || '').replace(/\D/g, '') || '0';
    return raw.length === 1 ? raw.padStart(2, '0') : raw;
  };

  const handleAutoGenerate = () => {
    const newEdits = { ...rollEdits };
    const batchObj = batches.find(b => String(b.Batch_Id) === batchId);
    const sampleAdmissionDate = rows.find((r) => r.admissionDate)?.admissionDate;
    const year2 = deriveYear2(batchObj?.Batch_code, sampleAdmissionDate);
    const batchNo = deriveBatchNo(batchObj?.Batch_code, year2, batchId);

        rows.forEach((s, idx) => {
      // Keep sequence global across pagination.
      const seq = String((page - 1) * pagination.limit + idx + 1).padStart(4, '0');
      newEdits[s.id] = `${year2}${batchNo}${seq}`;
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
        `${String(r.studentCode ?? '').replace(/"/g, '""')}`,
        `"${formatStudentName(r.studentName).replace(/"/g, '""')}"`,
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

  const formatStudentName = (name: string | null | undefined) => {
    const normalized = (name ?? '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    const lower = normalized.toLocaleLowerCase();
    return lower
      .split(' ')
      .map((word) => {
        if (!word) return word;
        const first = word[0]?.toLocaleUpperCase() ?? '';
        const rest = word.slice(1);
        return `${first}${rest}`;
      })
      .join(' ');
  };

  const selectedCourseName = courses.find(c => String(c.Course_Id) === courseId)?.Course_Name || '';
  const selectedBatch = batches.find(b => String(b.Batch_Id) === batchId) || null;
  const selectedBatchCode = selectedBatch?.Batch_code || '';
  const selectedBatchStudentCount = Number(selectedBatch?.StudentCount || 0);
  const totalPages = pagination.totalPages;

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view roll number allotment." />;

  const hasSelection = Boolean(courseId && batchId);
  const startIdx = (page - 1) * pagination.limit;

  return (
    <div className="space-y-4">

      {/* ──── Header ──── */}
      <PageHeader
        title="Allot Roll Number"
        breadcrumbs={[{ label: 'Daily Activities' }, { label: 'Allot Roll Number' }]}
        meta={hasSelection ? `${selectedBatchCode} · ${pagination.total} student${pagination.total !== 1 ? 's' : ''}` : undefined}
        action={
          hasSelection && rows.length > 0 ? (
            <>
              <GhostBtn onClick={handleAutoGenerate}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto-Generate
              </GhostBtn>
              <GhostBtn onClick={handleExport}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </GhostBtn>
              {canUpdate && (
                <button
                  onClick={handleSave}
                  disabled={saving || !hasEdits}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#24267A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {hasEdits ? 'Save Roll Numbers' : 'Saved'}
                </button>
              )}
            </>
          ) : undefined
        }
      />

      {/* ──── Selection strip ──── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[220px] flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Training</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] transition"
            >
              <option value="">— Choose Training —</option>
              {courses.map(c => (
                <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[220px] flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Batch Code</label>
            <select
              value={batchId}
              onChange={(e) => { setBatchId(e.target.value); setPage(1); }}
              disabled={!courseId}
              className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">— Choose Batch —</option>
              {batches.map(b => (
                <option key={b.Batch_Id} value={b.Batch_Id}>
                  {b.Batch_code}
                  {b.Category ? ` (${b.Category})` : ''}
                  {b.Timings ? ` — ${b.Timings}` : ''}
                  {` [${Number(b.StudentCount || 0)} students]`}
                </option>
              ))}
            </select>
          </div>

          {/* Search — only meaningful once a batch is chosen */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Search Student</label>
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setFetchTrigger((t) => t + 1); } }}
                disabled={!hasSelection}
                placeholder="Name or code, press Enter"
                className="h-9 w-full pl-8 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Previously allocated batches — collapsible quick-jump */}
        {allocatedBatches.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => setShowAllocated(v => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-[#2E3093] transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showAllocated ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Already allocated ({allocatedBatches.length})
              </span>
            </button>
            {showAllocated && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {allocatedBatches.map(ab => (
                  <button
                    key={ab.Batch_Id}
                    onClick={() => { setPendingBatchId(String(ab.Batch_Id)); setCourseId(String(ab.Course_Id)); }}
                    title={ab.Course_Name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors"
                  >
                    {ab.Batch_code}
                    <span className="text-green-500/70 max-w-[140px] truncate">{ab.Course_Name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ──── Save banner ──── */}
      {saveMsg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
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
          <button onClick={() => setSaveMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* ──── Content ──── */}
      {!hasSelection ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2E3093]/10 to-[#2A6BB5]/10 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#2E3093]/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-600 mb-1">
              {courseId ? 'Choose a batch code' : 'Select a training to begin'}
            </h3>
            <p className="text-xs text-gray-400 max-w-xs">
              Pick a training and batch above to load its students, then auto-generate or edit roll numbers.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Sub-toolbar: count + unsaved indicator */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2.5 py-0.5">
              {pagination.total} student{pagination.total !== 1 ? 's' : ''}
            </span>
            {selectedCourseName && (
              <span className="text-[11px] text-gray-500 font-medium truncate max-w-[280px]" title={selectedCourseName}>
                {selectedCourseName}
              </span>
            )}
            <span className="text-[11px] text-gray-400">
              · Batch strength {selectedBatchStudentCount}
            </span>
            {hasEdits && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="dashboard-table w-full text-sm min-w-[760px]">
              <thead className="bg-gray-50/80">
                <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4 border-b border-gray-200 w-12">Sr.</th>
                  <th className="py-2.5 px-4 border-b border-gray-200 w-32">Student Code</th>
                  <th className="py-2.5 px-4 border-b border-gray-200">Student Name</th>
                  <th className="py-2.5 px-4 border-b border-gray-200 w-36">Admission Date</th>
                  <th className="py-2.5 px-4 border-b border-gray-200 w-28">Phase</th>
                  <th className="py-2.5 px-4 border-b border-gray-200 w-52">Roll No.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex justify-center items-center gap-2 text-gray-400">
                        <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                        Loading students…
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
                    <tr key={s.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-4 text-gray-400 font-mono text-xs">{startIdx + idx + 1}</td>
                      <td className="py-2 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-[#2E3093]/8 text-[#2E3093] rounded">
                          {s.studentCode}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-semibold text-gray-800">{formatStudentName(s.studentName)}</td>
                      <td className="py-2 px-4 text-gray-600 text-xs">{formatDate(s.admissionDate)}</td>
                      <td className="py-2 px-4">
                        {s.phase ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">{s.phase}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={rollEdits[s.id] ?? s.rollNo}
                          onChange={(e) => {
                            setRollEdits(prev => ({ ...prev, [s.id]: e.target.value }));
                            setHasEdits(true);
                          }}
                          disabled={!canUpdate}
                          placeholder="Enter roll no."
                          className="w-full h-8 px-2.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 disabled:bg-gray-50 disabled:text-gray-400 transition"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Showing {startIdx + 1}–{Math.min(startIdx + pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
