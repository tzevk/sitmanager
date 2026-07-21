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
};

type StudentRow = {
  studentId: number;
  studentName: string;
  admissionDate: string | null;
  feesCompleted: boolean;
};

const selectCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]';

function formatDate(raw: string | null) {
  if (!raw) return '-';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    const day = d.getDate();
    const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
    const month = d.toLocaleDateString('en-IN', { month: 'short' });
    return `${day}${suffix} ${month}-${d.getFullYear()}`;
  } catch {
    return String(raw);
  }
}

export default function StudyMaterialRecordPage() {
  const { canView, loading: permLoading } = useResourcePermissions('study_material');
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
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
    fetch('/api/daily-activities/study-material-record?mode=courses')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (!data?.success) throw new Error(data?.error || 'Failed to load courses');
        setCourses(Array.isArray(data.courses) ? data.courses : []);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load courses');
      })
      .finally(() => { if (active) setLoadingCourses(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!courseId) return;
    const ctrl = new AbortController();
    fetch(`/api/daily-activities/study-material-record?mode=batches&courseId=${encodeURIComponent(courseId)}`, { signal: ctrl.signal })
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
    fetch(`/api/daily-activities/study-material-record?mode=students&batchId=${encodeURIComponent(batchId)}`, { signal: ctrl.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.error || 'Failed to load students');
        setRows(Array.isArray(data.students) ? data.students : []);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load students');
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
  };

  const handleBatchChange = (value: string) => {
    setBatchId(value);
    setRows([]);
    setError('');
    setLoadingRows(Boolean(value));
  };

  const handlePrint = () => {
    if (!rows.length) return;
    const w = window.open('', '_blank', 'width=1000,height=1200');
    if (!w) return;

    const courseName = selectedCourse?.Course_Name || '';
    const batchCode = selectedBatch?.Batch_code || '';
    const logoUrl = `${window.location.origin}/sit.png`;
    const escape = (v: unknown) => String(v ?? '').replace(/</g, '&lt;');

    const bodyRows = rows.map((r, i) => `<tr>
      <td>${i + 1}</td>
      <td class="left">${escape(r.studentName)}</td>
      <td>${escape(formatDate(r.admissionDate))}</td>
      <td></td>
      <td></td><td></td><td></td><td></td><td></td>
    </tr>`).join('');

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Study Material Issue Record</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
      body{padding:16px;color:#111}
      .logo{display:flex;align-items:center;gap:8px;margin-bottom:8px}
      .logo img{height:50px}
      .title-box{border:2px solid #2E3093;background:#2E3093;color:#fff;padding:8px;text-align:center;font-size:16px;font-weight:bold;letter-spacing:0.5px;margin-bottom:10px}
      .meta{display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px;font-weight:600}
      table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}
      th,td{border:1px solid #333;padding:7px 8px;text-align:center;overflow:hidden}
      td.left{text-align:left;white-space:normal;word-break:break-word}
      th{background:#eef0fa;font-weight:bold;color:#2E3093}
      tbody tr:nth-child(even){background:#f9fafc}
      tbody td{height:26px}
      @media print{@page{size:A4 landscape;margin:8mm}}
    </style></head><body>
      <div class="logo"><img src="${logoUrl}" alt="SIT" /></div>
      <div class="title-box">STUDY MATERIAL ISSUE RECORD</div>
      <div class="meta">
        <span>Training Programme : &nbsp;&nbsp;${escape(courseName)}</span>
        <span>Batch Code : &nbsp;&nbsp;${escape(batchCode)}</span>
      </div>
      <table>
        <colgroup>
          <col style="width:4%"/>
          <col style="width:16%"/>
          <col style="width:8%"/>
          <col style="width:8%"/>
          <col style="width:12.8%"/><col style="width:12.8%"/><col style="width:12.8%"/><col style="width:12.8%"/><col style="width:12.8%"/>
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2">Sr.<br/>No.</th>
            <th rowspan="2">Name</th>
            <th rowspan="2">Date of<br/>Admission</th>
            <th rowspan="2">Fees<br/>Completed</th>
            <th colspan="5">Study Material — Date of Issue</th>
          </tr>
          <tr><th></th><th></th><th></th><th></th><th></th></tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script>
    </body></html>`);
    w.document.close();
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view study material records." />;

  const hasSelection = Boolean(courseId && batchId);

  return (
    <div className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <div className="shrink-0 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Study Material Record</h2>
            <p className="text-[11px] text-white/60 mt-0.5">Select a training course and batch code to generate the issue record</p>
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
            <h3 className="text-xs font-bold text-slate-700">Students In Batch</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {selectedCourse?.Course_Name || 'No course selected'}{selectedBatch?.Batch_code ? ` - ${selectedBatch.Batch_code}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!rows.length}
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-[#2E3093] text-white text-[11px] font-bold hover:bg-[#252778] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Print / Export
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full min-w-[720px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-20">Sr No</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Name</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-40">Date of Admission</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 w-32">Fees Completed</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">Loading students...</td></tr>
              )}
              {!loadingRows && !hasSelection && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">Select a training course and batch code to view students.</td></tr>
              )}
              {!loadingRows && hasSelection && !rows.length && !error && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-slate-400">No students found for this batch.</td></tr>
              )}
              {!loadingRows && rows.map((row, index) => (
                <tr key={row.studentId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-3 text-xs text-slate-400 border-b border-slate-100 font-mono">{index + 1}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 font-semibold text-slate-700">{row.studentName || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 text-slate-600">{formatDate(row.admissionDate)}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
