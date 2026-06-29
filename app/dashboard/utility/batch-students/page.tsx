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

export default function BatchStudentsPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('student');
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [hidingAdmissionId, setHidingAdmissionId] = useState<number | null>(null);
  const [unhidingAdmissionId, setUnhidingAdmissionId] = useState<number | null>(null);
  const [savingRollAdmissionId, setSavingRollAdmissionId] = useState<number | null>(null);
  const [autoGeneratingRolls, setAutoGeneratingRolls] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [rollInputs, setRollInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.Course_Id) === courseId),
    [courses, courseId]
  );
  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.Batch_Id) === batchId),
    [batches, batchId]
  );
  const hiddenCount = rows.filter((row) => Number(row.Is_Hidden) === 1).length;
  const blankRollCount = rows.filter((row) => Number(row.Is_Hidden) !== 1 && !String(row.Roll_No || '').trim()).length;

  useEffect(() => {
    let active = true;

    fetch('/api/utility/batch-students?mode=courses')
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
    fetch(`/api/utility/batch-students?mode=batches&courseId=${encodeURIComponent(courseId)}`, { signal: ctrl.signal })
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
    if (showHidden) params.set('includeHidden', '1');
    fetch(`/api/utility/batch-students?${params.toString()}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.error || 'Failed to load students');
        const nextRows = Array.isArray(data.rows) ? data.rows : [];
        setRows(nextRows);
        setRollInputs(Object.fromEntries(nextRows.map((row: StudentRow) => [row.Admission_Id, row.Roll_No || ''])));
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load students');
        setRows([]);
        setRollInputs({});
      })
      .finally(() => setLoadingRows(false));

    return () => ctrl.abort();
  }, [batchId, showHidden]);

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

  const handleHide = async (row: StudentRow) => {
    if (!canUpdate || !batchId || hidingAdmissionId) return;
    const ok = window.confirm(`Hide ${row.Student_Name || `student #${row.Student_Id}`} from ${selectedBatch?.Batch_code || 'this batch'}?`);
    if (!ok) return;

    setError('');
    setMessage('');
    setHidingAdmissionId(row.Admission_Id);
    try {
      const res = await fetch('/api/utility/batch-students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: Number(batchId),
          admissionId: row.Admission_Id,
          studentId: row.Student_Id,
          includeHidden: showHidden,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to hide student from batch');
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setRollInputs(Object.fromEntries(nextRows.map((student: StudentRow) => [student.Admission_Id, student.Roll_No || ''])));
      setMessage('Student hidden from batch.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to hide student from batch');
    } finally {
      setHidingAdmissionId(null);
    }
  };

  const handleUnhide = async (row: StudentRow) => {
    if (!canUpdate || !batchId || unhidingAdmissionId) return;
    const ok = window.confirm(`Unhide ${row.Student_Name || `student #${row.Student_Id}`} in ${selectedBatch?.Batch_code || 'this batch'}?`);
    if (!ok) return;

    setError('');
    setMessage('');
    setUnhidingAdmissionId(row.Admission_Id);
    try {
      const res = await fetch('/api/utility/batch-students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unhide-student',
          batchId: Number(batchId),
          admissionId: row.Admission_Id,
          studentId: row.Student_Id,
          includeHidden: showHidden,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to unhide student in batch');
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setRollInputs(Object.fromEntries(nextRows.map((student: StudentRow) => [student.Admission_Id, student.Roll_No || ''])));
      setMessage('Student unhidden in batch.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unhide student in batch');
    } finally {
      setUnhidingAdmissionId(null);
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
      const res = await fetch('/api/utility/batch-students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-roll-number',
          batchId: Number(batchId),
          admissionId: row.Admission_Id,
          studentId: row.Student_Id,
          rollNo: rollInputs[row.Admission_Id] || '',
          includeHidden: showHidden,
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
      const res = await fetch('/api/utility/batch-students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto-generate-roll-numbers',
          batchId: Number(batchId),
          includeHidden: showHidden,
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

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view students." />;

  return (
    <div className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <div className="shrink-0 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Batch Students</h2>
            <p className="text-[11px] text-white/60 mt-0.5">Select a training course and batch code to manage enrolled students</p>
          </div>
          <span className="rounded-lg bg-white/15 border border-white/20 px-3 py-2 text-xs font-bold text-white">
            {rows.length} student{rows.length === 1 ? '' : 's'}{showHidden && hiddenCount ? `, ${hiddenCount} hidden` : ''}
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
          {canUpdate ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600">
                <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#2E3093]" />
                Show Hidden
              </label>
              <button
                type="button"
                onClick={handleAutoGenerateRollNumbers}
                disabled={!batchId || !blankRollCount || autoGeneratingRolls}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#2E3093] text-white text-[11px] font-bold hover:bg-[#252778] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {autoGeneratingRolls ? 'Generating...' : `Auto Generate${blankRollCount ? ` (${blankRollCount})` : ''}`}
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-amber-600">Update permission required</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-20">Sr No</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Roll Number</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Name</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Mobile Number</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Email</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-24">Status</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Duplicate Check</th>
                <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr><td colSpan={8} className="py-8 text-center text-xs text-slate-400">Loading students...</td></tr>
              )}
              {!loadingRows && !batchId && (
                <tr><td colSpan={8} className="py-8 text-center text-xs text-slate-400">Select a training course and batch code to view students.</td></tr>
              )}
              {!loadingRows && batchId && !rows.length && !error && (
                <tr><td colSpan={8} className="py-8 text-center text-xs text-slate-400">No students found for this batch.</td></tr>
              )}
              {!loadingRows && rows.map((row, index) => {
                const labels = duplicateLabels(row);
                const isHidden = Number(row.Is_Hidden) === 1;
                const hasAllocatedRollNo = Boolean(String(row.Roll_No || '').trim());
                return (
                  <tr key={row.Admission_Id} className={isHidden ? 'bg-slate-100/70 text-slate-400 hover:bg-slate-100 transition-colors' : labels.length ? 'bg-amber-50/40 hover:bg-amber-50/70 transition-colors' : 'hover:bg-slate-50/70 transition-colors'}>
                    <td className="py-2 px-3 text-xs text-slate-400 border-b border-slate-100 font-mono">{index + 1}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={rollInputs[row.Admission_Id] ?? row.Roll_No ?? ''}
                        onChange={(event) => handleRollInputChange(row.Admission_Id, event.target.value)}
                        disabled={!canUpdate || isHidden || hasAllocatedRollNo || savingRollAdmissionId === row.Admission_Id}
                        placeholder="Roll no"
                        className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-semibold text-slate-700">{row.Student_Name || '-'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono text-slate-600">{row.Mobile || '-'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-slate-600">{row.Email || '-'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">
                      {isHidden ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">Hidden</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Visible</span>
                      )}
                    </td>
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
                          disabled={!canUpdate || isHidden || hasAllocatedRollNo || savingRollAdmissionId === row.Admission_Id || (rollInputs[row.Admission_Id] ?? '') === (row.Roll_No || '')}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/15 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {hasAllocatedRollNo ? 'Locked' : 'Save'}
                        </button>
                        {isHidden ? (
                          <button
                            type="button"
                            onClick={() => handleUnhide(row)}
                            disabled={!canUpdate || unhidingAdmissionId === row.Admission_Id}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {unhidingAdmissionId === row.Admission_Id ? 'Unhiding...' : 'Unhide'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleHide(row)}
                            disabled={!canUpdate || hidingAdmissionId === row.Admission_Id}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Hide
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
    </div>
  );
}
