'use client';

import { useEffect, useMemo, useState } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';

type Course = {
  Course_Id: number;
  Course_Name: string;
};

type Batch = {
  Batch_Id: number;
  Batch_code: string;
  Category: string | null;
  Timings: string | null;
};

type ContactRow = {
  Student_Id: number;
  Student_Name: string;
  Mobile: string | null;
  Email: string | null;
};

const selectCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]';

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function ExportContactsContent({ canExport }: { canExport: boolean }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.Course_Id) === courseId),
    [courses, courseId]
  );
  const selectedBatch = useMemo(
    () => batches.find((batch) => String(batch.Batch_Id) === batchId),
    [batches, batchId]
  );

  useEffect(() => {
    let active = true;

    fetch('/api/utility/export-contacts?mode=courses')
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

    fetch(`/api/utility/export-contacts?mode=batches&courseId=${encodeURIComponent(courseId)}`, { signal: ctrl.signal })
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

    fetch(`/api/utility/export-contacts?mode=contacts&batchId=${encodeURIComponent(batchId)}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.error || 'Failed to load contacts');
        setRows(Array.isArray(data.rows) ? data.rows : []);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load contacts');
        setRows([]);
      })
      .finally(() => setLoadingRows(false));

    return () => ctrl.abort();
  }, [batchId]);

  const handleCourseChange = (value: string) => {
    setCourseId(value);
    setBatchId('');
    setBatches([]);
    setRows([]);
    setError('');
    setLoadingBatches(Boolean(value));
    setLoadingRows(false);
  };

  const handleBatchChange = (value: string) => {
    setBatchId(value);
    setRows([]);
    setError('');
    setLoadingRows(Boolean(value));
  };

  const handleExport = () => {
    if (!rows.length) return;
    const headers = ['Sr No', 'Name', 'Mobile Number', 'Email'];
    const csv = [
      headers.map(csvCell).join(','),
      ...rows.map((row, index) => [
        index + 1,
        row.Student_Name,
        row.Mobile || '',
        row.Email || '',
      ].map(csvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const batchPart = selectedBatch?.Batch_code ? selectedBatch.Batch_code.replace(/[^a-zA-Z0-9_-]/g, '-') : 'batch';
    link.href = url;
    link.download = `contacts-${batchPart}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <div className="shrink-0 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Export Contacts</h2>
            <p className="text-[11px] text-white/60 mt-0.5">Select a training course and batch to view student contact details</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport || !rows.length}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
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
                  {batch.Batch_code}{batch.Category ? ` - ${batch.Category}` : ''}{batch.Timings ? ` (${batch.Timings})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{error}</div>}
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="shrink-0 px-5 py-3 border-b border-slate-100 bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-700">Student Contacts</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {selectedCourse?.Course_Name || 'No course selected'}{selectedBatch?.Batch_code ? ` - ${selectedBatch.Batch_code}` : ''}
            </p>
          </div>
          <span className="rounded-full bg-[#2E3093]/10 px-3 py-1 text-[11px] font-bold text-[#2E3093]">
            {rows.length} student{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[760px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-20">Sr No</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Name</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Mobile Number</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Email</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">Loading contacts...</td></tr>
              )}
              {!loadingRows && !batchId && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">Select a training course and batch code to view contacts.</td></tr>
              )}
              {!loadingRows && batchId && !rows.length && !error && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">No students found for this batch.</td></tr>
              )}
              {!loadingRows && rows.map((row, index) => (
                <tr key={row.Student_Id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-3 text-xs text-slate-400 border-b border-slate-100 font-mono">{index + 1}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 font-semibold text-slate-700">{row.Student_Name || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono text-slate-600">{row.Mobile || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 text-slate-600">{row.Email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ExportContactsPage() {
  return (
    <PermissionGate resource="export_contacts" action="view" deniedMessage="You do not have permission to export contacts.">
      {({ canExport }) => <ExportContactsContent canExport={canExport} />}
    </PermissionGate>
  );
}
