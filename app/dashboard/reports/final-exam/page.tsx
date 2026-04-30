'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ─────────────────────────────── Types ─────────────────────────────── */
interface Course   { id: number; name: string }
interface Batch    { id: number; name: string; category: string }
interface Student  { Student_Id: number; Student_Name: string; Roll_No: string }

interface UTCol    { Take_Id: number; Test_No: number; Max_Marks: number; Test_Dt: string; Test_Name: string }
interface ASCol    { Given_Id: number; Assign_No: number; Max_Marks: number; Assign_Dt: string; Assignment_Name: string }
interface FECol    { Take_Id: number; Test_No: number; Max_Marks: number; Test_Dt: string; Exam_Subject: string }

interface StudentRow {
  srNo: number;
  Student_Id: number;
  Student_Name: string;
  Roll_No: string;
  unitTestMarks: Record<number, number>;
  assignmentMarks: Record<number, number>;
  finalExamMarks: Record<number, number>;
  utObtained: number; utTotalMax: number; utAvg: number;
  asObtained: number; asTotalMax: number; asAvg: number;
  feObtained: number; feTotalMax: number; feAvg: number;
  totalLectures: number; presentCount: number;
  absentDays: number; attendPct: number; absentPct: number;
  disciplineScore: number;
  totalScore: number;
  classObtained: string;
}

interface BatchInfo {
  Batch_Id: number; Batch_code: string; Category: string;
  Course_Name: string; Course_Id: number;
  UnitTestWtg: number; AssignWtg: number; ExamWtg: number; AttendWtg: number;
  No_of_Lectures: number; SDate: string; EDate: string;
}

interface ReportData {
  batch: BatchInfo;
  unitTests: UTCol[];
  assignments: ASCol[];
  finalExams: FECol[];
  students: StudentRow[];
  totalLectures: number;
}

/* ─────────────────────────────── Helpers ─────────────────────────────── */
function fmt2(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0.00';
  return n.toFixed(2);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function classColor(cls: string): string {
  switch (cls) {
    case 'A+':      return 'text-green-700 font-bold';
    case 'A':       return 'text-green-600 font-bold';
    case 'B+':      return 'text-blue-700 font-bold';
    case 'B':       return 'text-blue-600 font-bold';
    case 'C':       return 'text-yellow-700 font-bold';
    case 'NO CERT': return 'text-red-700 font-bold';
    default:        return 'text-gray-500';
  }
}

/* ─────────────────────────────── Page shell ─────────────────────────────── */
export default function FinalExamReportPage() {
  const { canView, loading: permLoading } = useResourcePermissions('report_final_exam');
  if (permLoading) return <PermissionLoading />;
  if (!canView)    return <AccessDenied message="You do not have permission to view the Final Exam Report." />;
  return <FinalExamReportContent />;
}

/* ─────────────────────────────── Main content ─────────────────────────────── */
function FinalExamReportContent() {
  const printRef = useRef<HTMLDivElement>(null);

  /* view mode */
  const [mode, setMode] = useState<'batch' | 'student'>('batch');

  /* dropdowns */
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  /* selections */
  const [courseId,  setCourseId]  = useState('');
  const [batchId,   setBatchId]   = useState('');
  const [studentId, setStudentId] = useState('');

  /* report state */
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [searched, setSearched] = useState(false);
  const [report,   setReport]   = useState<ReportData | null>(null);

  /* load courses once */
  useEffect(() => {
    fetch('/api/reports/final-exam?options=courses')
      .then(r => r.json())
      .then(d => setCourses(d.courses ?? []));
  }, []);

  /* load batches when course changes */
  useEffect(() => {
    setBatches([]); setBatchId(''); setStudents([]); setStudentId(''); setReport(null); setSearched(false);
    if (!courseId) return;
    fetch(`/api/reports/final-exam?options=batches&courseId=${courseId}`)
      .then(r => r.json())
      .then(d => setBatches(d.batches ?? []));
  }, [courseId]);

  /* load students when batch changes (for student mode) */
  useEffect(() => {
    setStudents([]); setStudentId(''); setReport(null); setSearched(false);
    if (!batchId || mode !== 'student') return;
    fetch(`/api/reports/final-exam?options=students&batchId=${batchId}`)
      .then(r => r.json())
      .then(d => setStudents(d.students ?? []));
  }, [batchId, mode]);

  /* reload students list when mode switches to student */
  useEffect(() => {
    if (mode === 'student' && batchId) {
      fetch(`/api/reports/final-exam?options=students&batchId=${batchId}`)
        .then(r => r.json())
        .then(d => setStudents(d.students ?? []));
    }
    setReport(null); setSearched(false);
  }, [mode, batchId]);

  const fetchReport = useCallback(async () => {
    if (!batchId) { setError('Please select a batch.'); return; }
    if (mode === 'student' && !studentId) { setError('Please select a student.'); return; }
    setLoading(true); setError(''); setSearched(false); setReport(null);
    try {
      let url = `/api/reports/final-exam?batchId=${batchId}`;
      if (mode === 'student' && studentId) url += `&studentId=${studentId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load report'); return; }
      setReport(data);
      setSearched(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [batchId, studentId, mode]);

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (!report) return;
    const { batch, unitTests, assignments, finalExams, students } = report;

    const headers = [
      'Sr.No', 'Student Id', 'Name',
      ...unitTests.map((u, i) => `UT${i + 1} (${u.Max_Marks})`),
      'UT Average',
      ...assignments.map((a, i) => `AS${i + 1} (${a.Max_Marks})`),
      'AS Average',
      ...finalExams.map((f, i) => `FE${i + 1} (${f.Max_Marks})`),
      'FE Average',
      'Discipline',
      'Absent(%)', 'Absent Days', 'Attendance(%)',
      'Final Total %', 'Class',
    ];

    const rows = students.map(s => [
      s.srNo, s.Student_Id, s.Student_Name,
      ...unitTests.map(u => s.unitTestMarks[u.Take_Id] ?? 0),
      fmt2(s.utAvg),
      ...assignments.map(a => s.assignmentMarks[a.Given_Id] ?? 0),
      fmt2(s.asAvg),
      ...finalExams.map(f => s.finalExamMarks[f.Take_Id] ?? 0),
      fmt2(s.feAvg),
      s.disciplineScore,
      fmt2(s.absentPct), s.absentDays, fmt2(s.attendPct),
      fmt2(s.totalScore), s.classObtained,
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `final-exam-report-${batch.Batch_code}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 pb-10 print:space-y-2">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-[#2E3093]">Final Exam Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Batch-wise or student-wise performance across unit tests, assignments and final exam
          </p>
        </div>
        {searched && report && (
          <div className="flex gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#2A6BB5] text-[#2A6BB5] bg-blue-50 hover:bg-blue-100 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        )}
      </div>

      {/* ── Mode tabs ── */}
      <div className="form-card p-1 flex gap-1 w-fit print:hidden">
        {(['batch', 'student'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              mode === m ? 'bg-[#2E3093] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {m === 'batch' ? 'Batch Wise' : 'Student Wise'}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="form-card p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* Course */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Course <span className="text-red-500">*</span></label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]">
              <option value="">-- Select Course --</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Batch */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Batch <span className="text-red-500">*</span></label>
            <select value={batchId} onChange={e => setBatchId(e.target.value)} disabled={!courseId}
              className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] disabled:opacity-50">
              <option value="">-- Select Batch --</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.category ? ` (${b.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Student (student mode only) */}
          {mode === 'student' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Student <span className="text-red-500">*</span></label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} disabled={!batchId}
                className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] disabled:opacity-50">
                <option value="">-- Select Student --</option>
                {students.map(s => (
                  <option key={s.Student_Id} value={s.Student_Id}>
                    {s.Roll_No ? `${s.Roll_No} — ` : ''}{s.Student_Name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Show button */}
          <div className={mode === 'batch' ? 'sm:col-span-1 lg:col-span-1' : ''}>
            <button onClick={fetchReport} disabled={loading || !batchId}
              className="w-full px-4 py-2 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#252880] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading
                ? <><span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />Loading...</>
                : <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Show Report
                  </>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm print:hidden">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* ── Printable report area ── */}
      <div ref={printRef} id="final-exam-report-print" className="report-print-area">
        {/* Print header */}
        {searched && report && (
          <div className="report-header hidden print:block">
            <div className="report-header-inner">
              <div className="report-logo-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sit.png" alt="SIT Logo" className="report-logo" />
              </div>
              <div className="report-title-block">
                <h1 className="report-title">Suvidya Institute of Technology Pvt. Ltd.</h1>
                <h2 className="report-subtitle">REPORT OF FINAL EXAMINATION</h2>
                <p className="report-period">
                  Training Programme: {report.batch.Course_Name} &nbsp;|&nbsp; Batch No. {report.batch.Batch_code}
                </p>
                <p className="report-meta">
                  Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="report-header-line" />
          </div>
        )}

        {/* ── Batch info cards (screen) ── */}
        {searched && report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
            <InfoCard label="Course"    value={report.batch.Course_Name} />
            <InfoCard label="Batch"     value={report.batch.Batch_code + (report.batch.Category ? ` (${report.batch.Category})` : '')} />
            <InfoCard label="Students"  value={String(report.students.length)} />
            <InfoCard label="Lectures"  value={String(report.totalLectures)} />
          </div>
        )}

        {/* ── Batch wise table ── */}
        {searched && report && mode === 'batch' && report.students.length > 0 && (
          <BatchTable report={report} />
        )}

        {/* ── Student wise card ── */}
        {searched && report && mode === 'student' && report.students.length > 0 && (
          <StudentCard report={report} />
        )}

        {/* Print footer */}
        {searched && report && (
          <div className="report-footer hidden print:block">
            <div className="report-footer-line" />
            <div className="report-footer-inner">
              <span>Suvidya Institute of Technology — Confidential</span>
              <span>Page: <span className="report-page-num" /></span>
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {searched && report && report.students.length === 0 && (
        <div className="form-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">No Records Found</h3>
          <p className="text-xs text-gray-400">No student records found for the selected batch.</p>
        </div>
      )}

      {/* ── Initial state ── */}
      {!searched && !loading && (
        <div className="form-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-[#2A6BB5]/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">Final Exam Report</h3>
          <p className="text-xs text-gray-400">
            {mode === 'batch'
              ? 'Select a course and batch, then click Show Report'
              : 'Select a course, batch and student, then click Show Report'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Batch Table ─────────────────────────────── */
function BatchTable({ report }: { report: ReportData }) {
  const { batch, unitTests, assignments, finalExams, students } = report;

  const utWtg = Number(batch.UnitTestWtg) || 0;
  const asWtg = Number(batch.AssignWtg)   || 0;
  const feWtg = Number(batch.ExamWtg)     || 0;

  const thBase = 'px-1.5 py-2 text-center font-semibold border border-[#1a5a9e] whitespace-nowrap text-[10px]';
  const tdBase = 'px-1.5 py-1.5 text-center text-[10px] border-r border-gray-100';

  return (
    <div className="form-card overflow-hidden">
      {/* Batch header for print */}
      <div className="px-4 py-3 border-b border-gray-100 print:block hidden">
        <p className="text-xs font-semibold text-gray-700">
          Training Programme: {batch.Course_Name} &nbsp;|&nbsp; Batch No. {batch.Batch_code}
        </p>
      </div>

      {/* Passing criteria */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-[10px] text-blue-800 font-medium flex flex-wrap gap-x-4 gap-y-0.5">
        <span>PASSING CRITERIA:</span>
        <span className="text-green-700">90–100% → A+</span>
        <span className="text-green-600">80–89.99% → A</span>
        <span className="text-blue-700">70–79.99% → B+</span>
        <span className="text-blue-600">60–69.99% → B</span>
        <span className="text-yellow-700">50–59.99% → C</span>
        <span className="text-red-700">0–49.99% → NO CERTIFICATE</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            {/* ── Row 1: group headers ── */}
            <tr className="bg-[#2E3093] text-white">
              <th className={thBase} rowSpan={2}>Sr No</th>
              <th className={thBase} rowSpan={2}>Student Id</th>
              <th className={`${thBase} text-left min-w-[120px]`} rowSpan={2}>Name</th>

              {/* Unit Test group */}
              <th className={thBase} colSpan={unitTests.length + 1}>
                Unit Test Marks {utWtg > 0 ? `(/${utWtg})` : ''}
              </th>

              {/* Assignment group */}
              <th className={thBase} colSpan={assignments.length + 1}>
                Assignment Marks {asWtg > 0 ? `(/${asWtg})` : ''}
              </th>

              {/* Final Exam group */}
              <th className={thBase} colSpan={Math.max(finalExams.length, 1) + 1}>
                Final Exam {feWtg > 0 ? `(/${feWtg})` : ''}
              </th>

              <th className={thBase} rowSpan={2}>Discipline</th>

              {/* Attendance group */}
              <th className={thBase} colSpan={3}>Attendance</th>

              <th className={thBase} rowSpan={2}>Final Total %</th>
              <th className={thBase} rowSpan={2}>Class</th>
            </tr>

            {/* ── Row 2: sub-column headers ── */}
            <tr className="bg-[#2A6BB5] text-white">
              {/* UT sub-cols */}
              {unitTests.map((u, i) => (
                <th key={u.Take_Id} className={thBase} title={u.Test_Name || undefined}>U{i + 1}<br /><span className="font-normal opacity-80">{u.Max_Marks}</span></th>
              ))}
              <th className={thBase}>Avg</th>

              {/* AS sub-cols */}
              {assignments.map((a, i) => (
                <th key={a.Given_Id} className={thBase}>A{i + 1}<br /><span className="font-normal opacity-80">{a.Max_Marks}</span></th>
              ))}
              <th className={thBase}>Avg</th>

              {/* FE sub-cols */}
              {finalExams.length > 0
                ? finalExams.map((f, i) => (
                    <th key={f.Take_Id} className={thBase}>{i + 1}<br /><span className="font-normal opacity-80">{f.Max_Marks}</span></th>
                  ))
                : <th className={thBase}>—</th>
              }
              <th className={thBase}>Avg</th>

              {/* Attendance sub-cols */}
              <th className={thBase}>Absent(%)</th>
              <th className={thBase}>Absent<br />Days</th>
              <th className={thBase}>Full<br />Attend.%</th>
            </tr>
          </thead>

          <tbody>
            {students.map((s, i) => (
              <tr key={s.Student_Id}
                className={`border-b border-gray-100 hover:bg-blue-50/40 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                <td className={`${tdBase} text-gray-400`}>{s.srNo}</td>
                <td className={tdBase}>{s.Student_Id}</td>
                <td className={`${tdBase} text-left font-medium text-gray-900 whitespace-nowrap`}>{s.Student_Name}</td>

                {/* UT marks */}
                {unitTests.map(u => (
                  <td key={u.Take_Id} className={tdBase}>{s.unitTestMarks[u.Take_Id] ?? 0}</td>
                ))}
                <td className={`${tdBase} font-semibold text-indigo-700 bg-indigo-50/60`}>{fmt2(s.utAvg)}</td>

                {/* Assignment marks */}
                {assignments.map(a => (
                  <td key={a.Given_Id} className={tdBase}>{s.assignmentMarks[a.Given_Id] ?? 0}</td>
                ))}
                <td className={`${tdBase} font-semibold text-purple-700 bg-purple-50/60`}>{fmt2(s.asAvg)}</td>

                {/* Final exam marks */}
                {finalExams.length > 0
                  ? finalExams.map(f => (
                      <td key={f.Take_Id} className={tdBase}>{s.finalExamMarks[f.Take_Id] ?? 0}</td>
                    ))
                  : <td className={`${tdBase} text-gray-300`}>—</td>
                }
                <td className={`${tdBase} font-semibold text-teal-700 bg-teal-50/60`}>{fmt2(s.feAvg)}</td>

                {/* Discipline */}
                <td className={tdBase}>{s.disciplineScore}</td>

                {/* Attendance */}
                <td className={`${tdBase} ${s.absentPct > 25 ? 'text-red-600' : 'text-gray-700'}`}>{fmt2(s.absentPct)}</td>
                <td className={`${tdBase} ${s.absentDays > 10 ? 'text-red-600' : 'text-gray-700'}`}>{s.absentDays}</td>
                <td className={`${tdBase} ${s.attendPct >= 75 ? 'text-green-700' : s.attendPct >= 50 ? 'text-yellow-700' : 'text-red-700'} font-semibold`}>
                  {fmt2(s.attendPct)}
                </td>

                {/* Total & class */}
                <td className={`${tdBase} font-bold text-[#2E3093] bg-blue-50/60`}>{fmt2(s.totalScore)}</td>
                <td className={`${tdBase} ${classColor(s.classObtained)}`}>{s.classObtained}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer legend */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">
        <span>
          {students.length} students &nbsp;|&nbsp;
          {unitTests.length} unit test(s) &nbsp;|&nbsp;
          {assignments.length} assignment(s) &nbsp;|&nbsp;
          {finalExams.length} final exam(s)
        </span>
        <span>Report generated: {new Date().toLocaleString('en-GB')}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Student Card ─────────────────────────────── */
function StudentCard({ report }: { report: ReportData }) {
  const { batch, unitTests, assignments, finalExams, students } = report;
  const s = students[0];
  if (!s) return null;

  const utWtg = Number(batch.UnitTestWtg) || 0;
  const asWtg = Number(batch.AssignWtg)   || 0;
  const feWtg = Number(batch.ExamWtg)     || 0;

  return (
    <div className="space-y-4">
      {/* Student header */}
      <div className="form-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-[#2E3093]">{s.Student_Name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              ID: {s.Student_Id} &nbsp;|&nbsp; Roll No: {s.Roll_No || 'N/A'} &nbsp;|&nbsp;
              Batch: {batch.Batch_code} &nbsp;|&nbsp; Course: {batch.Course_Name}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            s.classObtained === 'NA' ? 'bg-gray-100 text-gray-600' :
            s.classObtained === 'A+' ? 'bg-green-100 text-green-700' :
            s.classObtained === 'A'  ? 'bg-green-50 text-green-600' :
            s.classObtained === 'B+' ? 'bg-blue-100 text-blue-700' :
            s.classObtained === 'B'  ? 'bg-blue-50 text-blue-600' :
            s.classObtained === 'C'  ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {s.classObtained}
          </span>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <ScoreCard label={`Unit Tests (/${utWtg})`} obtained={s.utObtained} max={s.utTotalMax} score={s.utAvg} color="indigo" />
          <ScoreCard label={`Assignments (/${asWtg})`} obtained={s.asObtained} max={s.asTotalMax} score={s.asAvg} color="purple" />
          <ScoreCard label={`Final Exam (/${feWtg})`} obtained={s.feObtained} max={s.feTotalMax} score={s.feAvg} color="teal" />
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Final Total</p>
            <p className="text-2xl font-bold text-[#2E3093] mt-0.5">{fmt2(s.totalScore)}%</p>
          </div>
        </div>
      </div>

      {/* Unit Tests detail */}
      {unitTests.length > 0 && (
        <div className="form-card p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Unit Tests</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-indigo-600 text-white">
                  <th className="px-3 py-2 text-left font-semibold">Test</th>
                  <th className="px-3 py-2 text-center font-semibold">Date</th>
                  <th className="px-3 py-2 text-center font-semibold">Max Marks</th>
                  <th className="px-3 py-2 text-center font-semibold">Obtained</th>
                  <th className="px-3 py-2 text-center font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {unitTests.map((u, i) => {
                  const obtained = s.unitTestMarks[u.Take_Id] ?? 0;
                  const pct = u.Max_Marks > 0 ? ((obtained / u.Max_Marks) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={u.Take_Id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium">Unit Test {i + 1}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{fmtDate(u.Test_Dt)}</td>
                      <td className="px-3 py-2 text-center">{u.Max_Marks}</td>
                      <td className="px-3 py-2 text-center font-semibold">{obtained}</td>
                      <td className="px-3 py-2 text-center">{pct}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                  <td className="px-3 py-2" colSpan={2}>Total / Weighted Score</td>
                  <td className="px-3 py-2 text-center">{s.utTotalMax}</td>
                  <td className="px-3 py-2 text-center">{s.utObtained}</td>
                  <td className="px-3 py-2 text-center text-indigo-700">{fmt2(s.utAvg)} / {utWtg}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignments detail */}
      {assignments.length > 0 && (
        <div className="form-card p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Assignments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-purple-600 text-white">
                  <th className="px-3 py-2 text-left font-semibold">Assignment</th>
                  <th className="px-3 py-2 text-center font-semibold">Date</th>
                  <th className="px-3 py-2 text-center font-semibold">Max Marks</th>
                  <th className="px-3 py-2 text-center font-semibold">Obtained</th>
                  <th className="px-3 py-2 text-center font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, i) => {
                  const obtained = s.assignmentMarks[a.Given_Id] ?? 0;
                  const pct = a.Max_Marks > 0 ? ((obtained / a.Max_Marks) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={a.Given_Id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium">{a.Assignment_Name || `Assignment ${i + 1}`}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{fmtDate(a.Assign_Dt)}</td>
                      <td className="px-3 py-2 text-center">{a.Max_Marks}</td>
                      <td className="px-3 py-2 text-center font-semibold">{obtained}</td>
                      <td className="px-3 py-2 text-center">{pct}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-purple-50 font-bold border-t-2 border-purple-200">
                  <td className="px-3 py-2" colSpan={2}>Total / Weighted Score</td>
                  <td className="px-3 py-2 text-center">{s.asTotalMax}</td>
                  <td className="px-3 py-2 text-center">{s.asObtained}</td>
                  <td className="px-3 py-2 text-center text-purple-700">{fmt2(s.asAvg)} / {asWtg}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Final Exams detail */}
      {finalExams.length > 0 && (
        <div className="form-card p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Final Exam</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-teal-600 text-white">
                  <th className="px-3 py-2 text-left font-semibold">Exam</th>
                  <th className="px-3 py-2 text-center font-semibold">Date</th>
                  <th className="px-3 py-2 text-center font-semibold">Max Marks</th>
                  <th className="px-3 py-2 text-center font-semibold">Obtained</th>
                  <th className="px-3 py-2 text-center font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {finalExams.map((f, i) => {
                  const obtained = s.finalExamMarks[f.Take_Id] ?? 0;
                  const pct = f.Max_Marks > 0 ? ((obtained / f.Max_Marks) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={f.Take_Id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium">{f.Exam_Subject || `Exam ${i + 1}`}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{fmtDate(f.Test_Dt)}</td>
                      <td className="px-3 py-2 text-center">{f.Max_Marks}</td>
                      <td className="px-3 py-2 text-center font-semibold">{obtained}</td>
                      <td className="px-3 py-2 text-center">{pct}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-teal-50 font-bold border-t-2 border-teal-200">
                  <td className="px-3 py-2" colSpan={2}>Total / Weighted Score</td>
                  <td className="px-3 py-2 text-center">{s.feTotalMax}</td>
                  <td className="px-3 py-2 text-center">{s.feObtained}</td>
                  <td className="px-3 py-2 text-center text-teal-700">{fmt2(s.feAvg)} / {feWtg}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance */}
      <div className="form-card p-4">
        <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Attendance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoCard label="Total Lectures" value={String(s.totalLectures)} />
          <InfoCard label="Present"        value={String(s.presentCount)} />
          <InfoCard label="Absent Days"    value={String(s.absentDays)} />
          <InfoCard label="Attendance %"   value={fmt2(s.attendPct) + '%'} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Small components ─────────────────────────────── */
function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-gray-800 mt-0.5 truncate">{value}</p>
    </div>
  );
}

function ScoreCard({ label, obtained, max, score, color }: {
  label: string; obtained: number; max: number; score: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    teal:   'bg-teal-50   text-teal-700   border-teal-100',
  };
  const cls = colorMap[color] || colorMap.indigo;
  return (
    <div className={`rounded-xl p-3 border ${cls}`}>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-0.5`}>{fmt2(score)}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{obtained} / {max} marks</p>
    </div>
  );
}
