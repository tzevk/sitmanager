'use client';

import { useEffect, useMemo, useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type Course = {
  Course_Id: number;
  Course_Name: string;
};

type Batch = {
  Batch_Id: number;
  Batch_code: string;
  Category: string | null;
  Timings: string | null;
  IsDelete?: number | null;
  Cancel?: number | null;
};

type StudentRow = {
  Admission_Id: number;
  Student_Id: number;
  Roll_No: string | null;
  Is_Hidden: number;
  Student_Name: string;
  Mobile: string | null;
  Email: string | null;
  Roll_No_Duplicate_Count: number;
  Mobile_Duplicate_Count: number;
  Email_Duplicate_Count: number;
};

const selectCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]';

function duplicateLabels(row: StudentRow) {
  const labels: string[] = [];
  if (Number(row.Roll_No_Duplicate_Count) > 1) labels.push(`Same roll number x${row.Roll_No_Duplicate_Count}`);
  if (Number(row.Mobile_Duplicate_Count) > 1) labels.push(`Same mobile x${row.Mobile_Duplicate_Count}`);
  if (Number(row.Email_Duplicate_Count) > 1) labels.push(`Same email x${row.Email_Duplicate_Count}`);
  return labels;
}

// For each duplicate group (by roll number, mobile, or email), keep the earliest
// entry (lowest Admission_Id, i.e. the original) and flag the rest for deletion.
function findDuplicateRowsToDelete(rows: StudentRow[]): StudentRow[] {
  const toDeleteIds = new Set<number>();

  function markGroup(keyOf: (row: StudentRow) => string | null, countOf: (row: StudentRow) => number) {
    const groups = new Map<string, StudentRow[]>();
    for (const row of rows) {
      if (countOf(row) <= 1) continue;
      const key = keyOf(row);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    for (const group of groups.values()) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort((a, b) => a.Admission_Id - b.Admission_Id);
      for (const row of sorted.slice(1)) toDeleteIds.add(row.Admission_Id);
    }
  }

  markGroup((r) => String(r.Roll_No || '').trim() || null, (r) => Number(r.Roll_No_Duplicate_Count));
  markGroup((r) => String(r.Mobile || '').trim() || null, (r) => Number(r.Mobile_Duplicate_Count));
  markGroup((r) => String(r.Email || '').trim().toLowerCase() || null, (r) => Number(r.Email_Duplicate_Count));

  return rows.filter((row) => toDeleteIds.has(row.Admission_Id));
}

export default function AllotRollNumberPage() {
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('roll_number');
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [savingRollAdmissionId, setSavingRollAdmissionId] = useState<number | null>(null);
  const [autoGeneratingRolls, setAutoGeneratingRolls] = useState(false);
  const [reorderingRolls, setReorderingRolls] = useState(false);
  const [rollInputs, setRollInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  /* ---- Hard delete ---- */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<StudentRow[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.Course_Id) === courseId),
    [courses, courseId]
  );
  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.Batch_Id) === batchId),
    [batches, batchId]
  );
  const blankRollCount = rows.filter((row) => !String(row.Roll_No || '').trim()).length;
  const duplicateRowsToDelete = useMemo(() => findDuplicateRowsToDelete(rows), [rows]);

  useEffect(() => {
    let active = true;

    fetch('/api/daily-activities/allot-roll-number?mode=courses')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (!data?.success) throw new Error(data?.error || 'Failed to load courses');
        setCourses(Array.isArray(data.courses) ? data.courses : []);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load courses');
        setCourses([]);
      })
      .finally(() => {
        if (active) setLoadingCourses(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!courseId) return;

    const ctrl = new AbortController();
    fetch(`/api/daily-activities/allot-roll-number?mode=batches&courseId=${encodeURIComponent(courseId)}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.error || 'Failed to load batches');
        setBatches(Array.isArray(data.batches) ? data.batches : []);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load batches');
        setBatches([]);
      })
      .finally(() => setLoadingBatches(false));

    return () => ctrl.abort();
  }, [courseId]);

  useEffect(() => {
    if (!batchId) return;

    const ctrl = new AbortController();
    const params = new URLSearchParams({ mode: 'students', batchId });
    fetch(`/api/daily-activities/allot-roll-number?${params.toString()}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.error || 'Failed to load students');
        const nextRows = Array.isArray(data.rows) ? data.rows : [];
        setRows(nextRows);
        setRollInputs(Object.fromEntries(nextRows.map((row: StudentRow) => [row.Admission_Id, row.Roll_No || ''])));
        setSelectedIds(new Set());
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load students');
        setRows([]);
        setRollInputs({});
      })
      .finally(() => setLoadingRows(false));

    return () => ctrl.abort();
  }, [batchId]);

  const handleCourseChange = (value: string) => {
    setCourseId(value);
    setBatchId('');
    setBatches([]);
    setRows([]);
    setRollInputs({});
    setError('');
    setMessage('');
    setLoadingBatches(Boolean(value));
    setLoadingRows(false);
  };

  const handleBatchChange = (value: string) => {
    setBatchId(value);
    setRows([]);
    setRollInputs({});
    setError('');
    setMessage('');
    setLoadingRows(Boolean(value));
  };

  const toggleSelect = (admissionId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(admissionId)) next.delete(admissionId);
      else next.add(admissionId);
      return next;
    });
  };

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.Admission_Id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((row) => next.delete(row.Admission_Id));
      else rows.forEach((row) => next.add(row.Admission_Id));
      return next;
    });
  };

  const selectedRows = rows.filter((row) => selectedIds.has(row.Admission_Id));

  const handleDelete = async () => {
    if (!canDelete || !batchId || !deleteTargets || deleteTargets.length === 0) return;

    setError('');
    setMessage('');
    setDeleting(true);
    const admissionIds = [...new Set(deleteTargets.map((t) => t.Admission_Id))];
    try {
      const params = new URLSearchParams({ batchId, admissionIds: admissionIds.join(',') });
      const res = await fetch(`/api/daily-activities/allot-roll-number?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to delete student entry');
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setRollInputs(Object.fromEntries(nextRows.map((student: StudentRow) => [student.Admission_Id, student.Roll_No || ''])));
      setSelectedIds(new Set());
      const who = deleteTargets.length === 1
        ? (deleteTargets[0].Student_Name || `student #${deleteTargets[0].Student_Id}`)
        : `${admissionIds.length} entries`;
      setMessage(`Permanently deleted ${who} (${data.deleted} record${data.deleted !== 1 ? 's' : ''} removed).`);
      setDeleteTargets(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete student entry');
      setDeleteTargets(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleRollInputChange = (admissionId: number, value: string) => {
    setRollInputs((current) => ({ ...current, [admissionId]: value }));
  };

  const handleSaveRollNumber = async (row: StudentRow) => {
    if (!canUpdate || !batchId || savingRollAdmissionId) return;

    setError('');
    setMessage('');
    setSavingRollAdmissionId(row.Admission_Id);
    try {
      const res = await fetch('/api/daily-activities/allot-roll-number', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-roll-number',
          batchId: Number(batchId),
          admissionId: row.Admission_Id,
          studentId: row.Student_Id,
          rollNo: rollInputs[row.Admission_Id] || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to save roll number');
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setRollInputs(Object.fromEntries(nextRows.map((student: StudentRow) => [student.Admission_Id, student.Roll_No || ''])));
      setMessage('Roll number saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save roll number');
    } finally {
      setSavingRollAdmissionId(null);
    }
  };

  const handleAutoGenerateRollNumbers = async () => {
    if (!canUpdate || !batchId || autoGeneratingRolls || !blankRollCount) return;

    const ok = window.confirm(`Auto-generate roll numbers for ${blankRollCount} student${blankRollCount === 1 ? '' : 's'} without roll numbers? Existing roll numbers will not be changed.`);
    if (!ok) return;

    setError('');
    setMessage('');
    setAutoGeneratingRolls(true);
    try {
      const res = await fetch('/api/daily-activities/allot-roll-number', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto-generate-roll-numbers',
          batchId: Number(batchId),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to auto-generate roll numbers');
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setRollInputs(Object.fromEntries(nextRows.map((student: StudentRow) => [student.Admission_Id, student.Roll_No || ''])));
      setMessage(`Auto-generated ${Number(data.updated || 0)} roll number${Number(data.updated || 0) === 1 ? '' : 's'}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to auto-generate roll numbers');
    } finally {
      setAutoGeneratingRolls(false);
    }
  };

  const handleReorderRollNumbers = async () => {
    if (!canUpdate || !batchId || reorderingRolls) return;
    const batchCode = selectedBatch?.Batch_code || batchId;
    const ok = window.confirm(`Re-allocate all roll numbers for batch ${batchCode} in alphabetical order? This will overwrite all existing roll numbers.`);
    if (!ok) return;

    setError('');
    setMessage('');
    setReorderingRolls(true);
    try {
      const res = await fetch('/api/daily-activities/allot-roll-number', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder-roll-numbers', batchId: Number(batchId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to reorder roll numbers');
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setRollInputs(Object.fromEntries(nextRows.map((student: StudentRow) => [student.Admission_Id, student.Roll_No || ''])));
      setMessage(`Re-allocated ${Number(data.updated || 0)} roll numbers in alphabetical order.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reorder roll numbers');
    } finally {
      setReorderingRolls(false);
    }
  };

  const handleExportExcel = () => {
    if (!rows.length) return;
    const courseName = selectedCourse?.Course_Name || 'Course';
    const batchCode = selectedBatch?.Batch_code || 'Batch';
    import('xlsx').then((XLSX) => {
      const data = rows.map((r, i) => ({
        'Sr No': i + 1,
        'Student Name': r.Student_Name || '',
        'Roll Number': r.Roll_No || '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Roll Numbers');
      XLSX.writeFile(wb, `${courseName}_${batchCode}_RollNumbers.xlsx`);
    });
  };

  const handleExportFacescan = () => {
    if (!rows.length) return;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;

    const courseName = selectedCourse?.Course_Name || '';
    const batchCode = selectedBatch?.Batch_code || '';
    const logoUrl = `${window.location.origin}/sit.png`;
    const escape = (v: unknown) => String(v ?? '').replace(/</g, '&lt;');

    const bodyRows = rows.map((r, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td class="num">${escape(r.Student_Id)}</td>
      <td class="left">${escape(r.Student_Name)}</td>
    </tr>`).join('');

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Student Facescan</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
      body{padding:20px;color:#111}
      .logo{display:flex;align-items:center;gap:8px;margin-bottom:8px}
      .logo img{height:44px}
      .title-box{border:2px solid #2E3093;background:#2E3093;color:#fff;padding:8px;text-align:center;font-size:15px;font-weight:bold;letter-spacing:0.5px;margin-bottom:10px}
      .meta{display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px;font-weight:600}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #333;padding:7px 10px}
      th{background:#eef0fa;color:#2E3093;font-weight:bold;text-align:left}
      .num{text-align:center;font-variant-numeric:tabular-nums}
      td.left{text-align:left}
      tbody tr:nth-child(even){background:#f9fafc}
      @media print{@page{size:A4;margin:12mm}}
    </style></head><body>
      <div class="logo"><img src="${logoUrl}" alt="SIT" /></div>
      <div class="title-box">STUDENT FACESCAN</div>
      <div class="meta">
        <span>Training Programme : &nbsp;&nbsp;${escape(courseName)}</span>
        <span>Batch No. : &nbsp;&nbsp;${escape(batchCode)}</span>
      </div>
      <table>
        <colgroup><col style="width:8%"/><col style="width:22%"/><col style="width:70%"/></colgroup>
        <thead><tr><th class="num">Sr No</th><th class="num">Student ID No.</th><th>Student Name</th></tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script>
    </body></html>`);
    w.document.close();
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view roll number allotment." />;

  return (
    <div className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <div className="shrink-0 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Allot Roll Number</h2>
            <p className="text-[11px] text-white/60 mt-0.5">Select a training course and batch code to allot roll numbers</p>
          </div>
          <span className="rounded-lg bg-white/15 border border-white/20 px-3 py-2 text-xs font-bold text-white">
            {rows.length} student{rows.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Training Course</label>
            <select
              value={courseId}
              onChange={(event) => handleCourseChange(event.target.value)}
              className={selectCls}
              disabled={loadingCourses}
            >
              <option value="">{loadingCourses ? 'Loading courses...' : 'Select training course'}</option>
              {courses.map((course) => (
                <option key={course.Course_Id} value={course.Course_Id}>{course.Course_Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Batch Code</label>
            <select
              value={batchId}
              onChange={(event) => handleBatchChange(event.target.value)}
              className={selectCls}
              disabled={!courseId || loadingBatches}
            >
              <option value="">{loadingBatches ? 'Loading batches...' : 'Select batch code'}</option>
              {batches.map((batch) => (
                <option key={batch.Batch_Id} value={batch.Batch_Id}>
                  {batch.Batch_code}{batch.Category ? ` - ${batch.Category}` : ''}{batch.Timings ? ` (${batch.Timings})` : ''}{Number(batch.Cancel) === 1 ? ' [Cancelled]' : ''}{Number(batch.IsDelete) === 1 ? ' [Deleted]' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {message && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</div>}
        {error && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{error}</div>}
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="shrink-0 px-5 py-3 border-b border-slate-100 bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-700">Students In Batch</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {selectedCourse?.Course_Name || 'No course selected'}{selectedBatch?.Batch_code ? ` - ${selectedBatch.Batch_code}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canDelete && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setDeleteTargets(selectedRows)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-[11px] font-bold hover:bg-red-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected ({selectedIds.size})
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteTargets(duplicateRowsToDelete)}
                disabled={!duplicateRowsToDelete.length}
                title="Keeps the earliest entry in each duplicate group (by roll number, mobile, or email) and stages the rest for deletion"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Duplicates{duplicateRowsToDelete.length ? ` (${duplicateRowsToDelete.length})` : ''}
              </button>
            )}
            <button
              type="button"
              onClick={handleExportFacescan}
              disabled={!rows.length}
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 text-[11px] font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export Facescan
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!rows.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Export Excel
            </button>
            {canUpdate && (
              <button
                type="button"
                onClick={handleReorderRollNumbers}
                disabled={!batchId || !rows.length || reorderingRolls}
                title="Sort all students A–Z and re-allocate roll numbers sequentially"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-violet-700 text-[11px] font-bold hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reorderingRolls ? 'Reordering...' : 'Reorder A–Z'}
              </button>
            )}
            {canUpdate ? (
              <button
                type="button"
                onClick={handleAutoGenerateRollNumbers}
                disabled={!batchId || !blankRollCount || autoGeneratingRolls}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#2E3093] text-white text-[11px] font-bold hover:bg-[#252778] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {autoGeneratingRolls ? 'Generating...' : `Auto Generate${blankRollCount ? ` (${blankRollCount})` : ''}`}
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-amber-600">Update permission required</span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                {canDelete && (
                  <th className="py-2 px-3 bg-slate-50 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      title="Select all"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500/30 cursor-pointer"
                    />
                  </th>
                )}
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-20">Sr No</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-24">Student ID</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Roll Number</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Name</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Mobile Number</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Email</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Duplicate Check</th>
                <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr><td colSpan={canDelete ? 9 : 8} className="py-8 text-center text-xs text-slate-400">Loading students...</td></tr>
              )}
              {!loadingRows && !batchId && (
                <tr><td colSpan={canDelete ? 9 : 8} className="py-8 text-center text-xs text-slate-400">Select a training course and batch code to view students.</td></tr>
              )}
              {!loadingRows && batchId && !rows.length && !error && (
                <tr><td colSpan={canDelete ? 9 : 8} className="py-8 text-center text-xs text-slate-400">No students found for this batch.</td></tr>
              )}
              {!loadingRows && rows.map((row, index) => {
                const labels = duplicateLabels(row);
                const hasAllocatedRollNo = Boolean(String(row.Roll_No || '').trim());
                const isSelected = selectedIds.has(row.Admission_Id);
                return (
                  <tr key={row.Admission_Id} className={isSelected ? 'bg-red-50/60 transition-colors' : labels.length ? 'bg-amber-50/40 hover:bg-amber-50/70 transition-colors' : 'hover:bg-slate-50/70 transition-colors'}>
                    {canDelete && (
                      <td className="py-2 px-3 border-b border-slate-100 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row.Admission_Id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500/30 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="py-2 px-3 text-xs text-slate-400 border-b border-slate-100 font-mono">{index + 1}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono text-slate-600">{row.Student_Id}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={rollInputs[row.Admission_Id] ?? row.Roll_No ?? ''}
                        onChange={(event) => handleRollInputChange(row.Admission_Id, event.target.value)}
                        disabled={!canUpdate || hasAllocatedRollNo || savingRollAdmissionId === row.Admission_Id}
                        placeholder="Roll no"
                        className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-semibold text-slate-700">{row.Student_Name || '-'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono text-slate-600">{row.Mobile || '-'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-slate-600">{row.Email || '-'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">
                      {labels.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {labels.map((label) => (
                            <span key={label} className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Unique</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveRollNumber(row)}
                          disabled={!canUpdate || hasAllocatedRollNo || savingRollAdmissionId === row.Admission_Id || (rollInputs[row.Admission_Id] ?? '') === (row.Roll_No || '')}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/15 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {hasAllocatedRollNo ? 'Locked' : 'Save'}
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTargets([row])}
                            title="Permanently delete this entry"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-[11px] font-semibold hover:bg-red-100"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hard-delete confirmation */}
      {deleteTargets && deleteTargets.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4" onClick={() => !deleting && setDeleteTargets(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.35)] overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
              <div className="shrink-0 w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {deleteTargets.length === 1 ? 'Delete this entry permanently?' : `Delete ${deleteTargets.length} entries permanently?`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <div className="px-5 py-4 text-sm text-slate-600">
              {deleteTargets.length === 1 ? (
                <p>
                  <span className="font-semibold text-slate-800">{deleteTargets[0].Student_Name || `Student #${deleteTargets[0].Student_Id}`}</span>{' '}
                  <span className="font-mono text-xs text-slate-400">#{deleteTargets[0].Student_Id}</span> — only this batch entry
                  {selectedBatch?.Batch_code ? <> in <span className="font-semibold">{selectedBatch.Batch_code}</span></> : null} is
                  hard-deleted. Other duplicate entries and other batches are not touched.
                </p>
              ) : (
                <>
                  <p className="mb-2">
                    These <span className="font-semibold text-slate-800">{deleteTargets.length}</span> batch entries will be
                    hard-deleted. Only the selected entries are removed — no other duplicates or batches.
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                    {deleteTargets.map((t) => (
                      <div key={t.Admission_Id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        <span className="font-mono text-slate-400">#{t.Student_Id}</span>
                        <span className="text-slate-700 truncate">{t.Student_Name || `Student #${t.Student_Id}`}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-2 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setDeleteTargets(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleteTargets.length === 1 ? 'Delete Permanently' : `Delete ${deleteTargets.length} Permanently`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
