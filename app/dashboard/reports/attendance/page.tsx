'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Course { id: number; name: string }
interface Batch  { id: number; name: string; category: string }

interface LectureRow {
  Take_Id: number;
  Take_Dt: string;
  Lecture_Start: string;
  Lecture_End: string;
  Duration: string;
  Topic: string;
}

interface StudentInfo {
  Student_Id: number;
  Student_Name: string;
}

interface AttendanceEntry { status: string; late: boolean }
type AttendanceMap    = Record<string, Record<string, AttendanceEntry>>;
type StudentSummaryMap = Record<string, { lateCount: number; presentCount: number; effectivePresent: number; percentage: string }>;

interface BatchInfo {
  Batch_Id: number;
  Batch_code: string;
  Category: string;
  No_of_Lectures: string;
  Course_Name: string;
}

interface Summary { totalStudents: number; totalLectures: number }

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function getHalf(lectureStart: string): string {
  return lectureStart.toUpperCase().includes('AM') ? '1st Half' : '2nd Half';
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AttendanceReportPage() {
  const { canView, canExport, loading: permLoading } = useResourcePermissions('report_attendance');
  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the attendance report." />;
  return <AttendanceReportContent canExport={canExport} />;
}

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */
function AttendanceReportContent({ canExport }: { canExport: boolean }) {
  const [courseId, setCourseId] = useState('');
  const [batchId,  setBatchId]  = useState('');
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [lectures,       setLectures]       = useState<LectureRow[]>([]);
  const [students,       setStudents]       = useState<StudentInfo[]>([]);
  const [attendanceMap,  setAttendanceMap]  = useState<AttendanceMap>({});
  const [studentSummary, setStudentSummary] = useState<StudentSummaryMap>({});
  const [batch,          setBatch]          = useState<BatchInfo | null>(null);
  const [summary,        setSummary]        = useState<Summary | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [searched,       setSearched]       = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    fetch('/api/reports/attendance?options=courses')
      .then((r) => r.json())
      .then((data) => setCourses(data.courses || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!courseId) { setBatches([]); setBatchId(''); return; }
    fetch(`/api/reports/attendance?options=batches&courseId=${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        const blist = data.batches || [];
        setBatches(blist);
        if (blist.length > 0) setBatchId(String(blist[0].id));
        else setBatchId('');
      })
      .catch(() => setBatches([]));
  }, [courseId]);

  const autoSearchRef = useRef(false);
  useEffect(() => {
    if (courseId && batchId) {
      if (!autoSearchRef.current) { autoSearchRef.current = true; return; }
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, batchId]);

  const handleSearch = useCallback(async () => {
    if (!courseId || !batchId) return;
    setLoading(true); setSearched(true); setError('');
    try {
      const qs = new URLSearchParams({ courseId, batchId });
      const res  = await fetch(`/api/reports/attendance?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
      setBatch(data.batch || null);
      setLectures(data.lectures || []);
      setStudents(data.students || []);
      setAttendanceMap(data.attendanceMap || {});
      setStudentSummary(data.studentSummary || {});
      setSummary(data.summary || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      setLectures([]); setStudents([]); setAttendanceMap({}); setStudentSummary({});
      setBatch(null); setSummary(null);
    } finally { setLoading(false); }
  }, [courseId, batchId]);

  const handleCancel = useCallback(() => {
    setCourseId(''); setBatchId('');
    setLectures([]); setStudents([]); setAttendanceMap({}); setStudentSummary({});
    setBatch(null); setSummary(null); setSearched(false); setError('');
  }, []);

  const exportCSV = useCallback(() => {
    if (!lectures.length || !students.length) return;
    const esc = (v: string) => v.includes(',') ? `"${v}"` : v;
    const rows: string[] = [];
    rows.push(['Date', 'Half', ...students.map((s) => esc(s.Student_Name))].join(','));
    for (const lec of lectures) {
      const ta = attendanceMap[String(lec.Take_Id)] || {};
      rows.push([
        fmtDate(lec.Take_Dt),
        getHalf(lec.Lecture_Start),
        ...students.map((s) => (ta[String(s.Student_Id)]?.status === 'Present' ? '1' : '-')),
      ].join(','));
    }
    rows.push(['Total Lecture',   '', ...students.map(() => String(summary?.totalLectures ?? 0))].join(','));
    rows.push(['Total Late Mark', '', ...students.map((s) => String(studentSummary[String(s.Student_Id)]?.lateCount ?? 0))].join(','));
    rows.push(['Attend Total',    '', ...students.map((s) => String(studentSummary[String(s.Student_Id)]?.effectivePresent ?? 0))].join(','));
    rows.push(['Percentage (%)',  '', ...students.map((s) => `${studentSummary[String(s.Student_Id)]?.percentage ?? '0.00'}%`)].join(','));
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${batches.find((b) => String(b.id) === batchId)?.name || 'batch'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [lectures, students, attendanceMap, studentSummary, summary, batchId, batches]);

  const exportExcel = useCallback(async () => {
    if (!lectures.length || !students.length) return;
    const courseName = courses.find((c) => String(c.id) === courseId)?.name || '';
    const batchName  = batches.find((b) => String(b.id) === batchId)?.name  || '';
    const totalCols  = 2 + students.length;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIT Manager'; wb.created = new Date();
    const ws = wb.addWorksheet('Attendance', { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] });
    const thin = (argb: string): ExcelJS.Border => ({ style: 'thin', color: { argb } });
    const border = (c: string) => ({ top: thin(c), bottom: thin(c), left: thin(c), right: thin(c) });

    ws.mergeCells(1, 1, 1, totalCols);
    ws.getRow(1).height = 30;
    const titleCell = ws.getCell('A1');
    titleCell.value = `Suvidya Institute of Technology — Attendance Report — ${courseName} — Batch: ${batchName}`;
    titleCell.font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getRow(2).height = 60;
    ['Date', 'Half', ...students.map((s) => s.Student_Name)].forEach((h, i) => {
      const cell = ws.getRow(2).getCell(i + 1);
      cell.value = h;
      cell.font  = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = border('FF1E2080');
    });

    lectures.forEach((lec, i) => {
      const row = ws.getRow(3 + i); row.height = 15;
      const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA';
      const ta = attendanceMap[String(lec.Take_Id)] || {};
      const c1 = row.getCell(1);
      c1.value = fmtDate(lec.Take_Dt); c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c1.font = { size: 9 }; c1.alignment = { horizontal: 'center', vertical: 'middle' }; c1.border = border('FFE5E7EB');
      const c2 = row.getCell(2);
      c2.value = getHalf(lec.Lecture_Start); c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c2.font = { size: 9 }; c2.alignment = { horizontal: 'center', vertical: 'middle' }; c2.border = border('FFE5E7EB');
      students.forEach((s, si) => {
        const entry = ta[String(s.Student_Id)]; const present = entry?.status === 'Present';
        const cell = row.getCell(3 + si);
        cell.value = present ? 1 : '-';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: present ? 'FFD1FAE5' : 'FFFEE2E2' } };
        cell.font = { size: 9, bold: present, color: { argb: present ? 'FF065F46' : 'FFB91C1C' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = border('FFE5E7EB');
      });
    });

    const dStart = 3 + lectures.length;
    [
      { label: 'Total Lecture',   bg: 'FFE0F2FE', fg: 'FF1D4ED8', val: () => summary?.totalLectures ?? 0 },
      { label: 'Total Late Mark', bg: 'FFFEF9C3', fg: 'FFA16207', val: (sid: string) => studentSummary[sid]?.lateCount ?? 0 },
      { label: 'Attend Total',    bg: 'FFDCFCE7', fg: 'FF166534', val: (sid: string) => studentSummary[sid]?.effectivePresent ?? 0 },
      { label: 'Percentage (%)',  bg: 'FFE0F2FE', fg: 'FF1D4ED8', val: (sid: string) => `${studentSummary[sid]?.percentage ?? '0.00'}%` },
    ].forEach((def, si) => {
      const row = ws.getRow(dStart + si); row.height = 18;
      [row.getCell(1), row.getCell(2)].forEach((c, ci) => {
        if (ci === 0) c.value = def.label;
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.bg } };
        c.font = { size: 9, bold: true, color: { argb: def.fg } };
        c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = border('FFE5E7EB');
      });
      students.forEach((s, ssi) => {
        const cell = row.getCell(3 + ssi);
        cell.value = def.val(String(s.Student_Id)) as ExcelJS.CellValue;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.bg } };
        cell.font = { size: 9, bold: true, color: { argb: def.fg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = border('FFE5E7EB');
      });
    });

    ws.getColumn(1).width = 12; ws.getColumn(2).width = 10;
    students.forEach((_s, i) => { ws.getColumn(3 + i).width = 16; });
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Attendance_${batchName || 'batch'}.xlsx`);
  }, [lectures, students, attendanceMap, studentSummary, summary, courseId, batchId, courses, batches]);

  const handlePrint = useCallback(() => window.print(), []);
  const isFormValid = courseId && batchId;
  const hasData     = searched && lectures.length > 0 && students.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#2E3093]">Full Attendance Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">Per-day attendance for each student in a batch</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
            {canExport !== false && (
              <button onClick={exportExcel} className="btn-primary flex items-center gap-1.5 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export to Excel
              </button>
            )}
          </div>
        )}
      </div>

      <div className="form-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1 max-w-[300px]">
            <label className="label">Course<span className="text-red-500 ml-0.5">*</span></label>
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setBatchId(''); }} className="input-sm !max-w-full">
              <option value="">Select Course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="min-w-[200px] flex-1 max-w-[300px]">
            <label className="label">Batch<span className="text-red-500 ml-0.5">*</span></label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="input-sm !max-w-full" disabled={!courseId}>
              <option value="">{courseId ? 'Select Batch' : '—'}</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.category ? ` (${b.category})` : ''}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 self-end">
            <button onClick={handleSearch} disabled={!isFormValid || loading} className="btn-primary h-10 px-6">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Loading…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Show Report
                </span>
              )}
            </button>
            <button onClick={handleCancel} className="btn-secondary h-10 px-4">Reset</button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          <p className="font-medium">{error}</p>
        </div>
      )}

      {hasData && summary && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Course',   value: batch?.Course_Name || '—', cls: 'text-[#2E3093]' },
            { label: 'Batch',    value: batch?.Batch_code  || '—', cls: 'text-[#2E3093]' },
            { label: 'Total Students', value: summary.totalStudents, cls: 'text-blue-700'  },
            { label: 'Total Lectures', value: summary.totalLectures, cls: 'text-indigo-700' },
          ].map((c) => (
            <div key={c.label} className="bg-white border border-gray-100 rounded-xl px-5 py-3 flex flex-col gap-0.5 shadow-sm min-w-[120px]">
              <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-widest">{c.label}</span>
              <span className={`text-xl font-bold leading-tight ${c.cls}`}>{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {hasData && (
        <div className="form-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-sm font-semibold text-[#2E3093]">Attendance Sheet</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">{batch?.Course_Name} &nbsp;&middot;&nbsp; Batch: {batch?.Batch_code}{batch?.Category ? ` (${batch.Category})` : ''}</p>
            </div>
            <span className="text-[10px] text-gray-400">{students.length} students &nbsp;&middot;&nbsp; {lectures.length} lectures</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '72vh' }}>
            <table className="text-xs border-collapse" style={{ minWidth: `${190 + students.length * 72}px` }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 30 }}>
                  {/* Corner: sticky both top AND left */}
                  <th className="bg-[#2E3093] text-white font-semibold px-3 text-left border-r border-b border-[#1E2080] whitespace-nowrap" style={{ position: 'sticky', top: 0, left: 0, zIndex: 40, minWidth: 110, width: 110, padding: '10px 12px' }}>
                    Date
                  </th>
                  <th className="bg-[#2E3093] text-white font-semibold px-2 text-center border-r border-b border-[#1E2080] whitespace-nowrap" style={{ position: 'sticky', top: 0, left: 110, zIndex: 40, minWidth: 80, width: 80, padding: '10px 8px' }}>
                    Half
                  </th>
                  {students.map((s) => (
                    <th key={s.Student_Id} className="bg-[#2E3093] text-white border-r border-b border-[#1E2080]" style={{ position: 'sticky', top: 0, zIndex: 20, minWidth: 72, width: 72, padding: '8px 4px', verticalAlign: 'bottom' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.35, textAlign: 'center', wordBreak: 'break-word' }} title={s.Student_Name}>
                        {s.Student_Name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lectures.map((lec, i) => {
                  const ta     = attendanceMap[String(lec.Take_Id)] || {};
                  const isEven = i % 2 === 0;
                  const rowBg  = isEven ? '#ffffff' : '#f9fafb';
                  return (
                    <tr key={lec.Take_Id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 10, background: rowBg, minWidth: 110, padding: '8px 12px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#374151', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {fmtDate(lec.Take_Dt)}
                      </td>
                      <td style={{ position: 'sticky', left: 110, zIndex: 10, background: rowBg, minWidth: 80, padding: '8px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, color: getHalf(lec.Lecture_Start) === '1st Half' ? '#2563eb' : '#4f46e5' }}>
                        {getHalf(lec.Lecture_Start)}
                      </td>
                      {students.map((s) => {
                        const entry   = ta[String(s.Student_Id)];
                        const present = entry?.status === 'Present';
                        const late    = entry?.late === true;
                        // L = present but late, 1 = present on time, A = absent, - = no record
                        const label   = present ? (late ? 'L' : '1') : (entry ? 'A' : '-');
                        const color   = present
                          ? (late ? '#b45309' : '#15803d')   // amber for late, green for present
                          : (entry ? '#dc2626' : '#d1d5db'); // red for absent, grey for no record
                        return (
                          <td key={s.Student_Id} style={{ minWidth: 72, width: 72, textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '8px 4px', fontSize: 12, fontWeight: 700, color, background: rowBg }}>
                            {label}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {([
                  { label: 'Total Lecture',   bg: '#dbeafe', labelBg: '#1d4ed8', fg: '#1e3a8a', val: () => String(summary?.totalLectures ?? 0) },
                  { label: 'Total Late Mark', bg: '#fef3c7', labelBg: '#d97706', fg: '#78350f', val: (sid: string) => String(studentSummary[sid]?.lateCount ?? 0) },
                  { label: 'Attend Total',    bg: '#dcfce7', labelBg: '#16a34a', fg: '#14532d', val: (sid: string) => String(studentSummary[sid]?.effectivePresent ?? 0) },
                  { label: 'Percentage (%)',  bg: '#e0e7ff', labelBg: '#4338ca', fg: '#1e1b4b', val: (sid: string) => { const p = parseFloat(studentSummary[sid]?.percentage ?? '0'); return `${p.toFixed(2)}%`; }, pct: true },
                ] as { label: string; bg: string; labelBg: string; fg: string; val: (s: string) => string; pct?: boolean }[]).map((row, ri) => (
                  <tr key={ri} style={{ borderTop: ri === 0 ? '2px solid #9ca3af' : undefined }}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 10, background: row.labelBg, minWidth: 110, padding: '10px 12px', borderRight: '1px solid rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(0,0,0,0.1)', color: '#fff', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                      {row.label}
                    </td>
                    <td style={{ position: 'sticky', left: 110, zIndex: 10, background: row.labelBg, minWidth: 80, borderRight: '1px solid rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(0,0,0,0.1)' }} />
                    {students.map((s) => {
                      const sid = String(s.Student_Id);
                      const val = row.val(sid);
                      let cellBg = row.bg;
                      let cellFg = row.fg;
                      if (row.pct) {
                        const p = parseFloat(studentSummary[sid]?.percentage ?? '0');
                        cellBg = p >= 75 ? '#dcfce7' : p >= 50 ? '#fef3c7' : '#fee2e2';
                        cellFg = p >= 75 ? '#14532d' : p >= 50 ? '#78350f' : '#7f1d1d';
                      }
                      return (
                        <td key={s.Student_Id} style={{ minWidth: 72, textAlign: 'center', padding: '10px 4px', fontSize: 11, fontWeight: 700, background: cellBg, color: cellFg, borderRight: '1px solid rgba(0,0,0,0.08)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>Showing {lectures.length} lectures &nbsp;&middot;&nbsp; {students.length} enrolled students</span>
            <span>Generated: {new Date().toLocaleString('en-GB')}</span>
          </div>
        </div>
      )}

      {searched && !loading && !error && (lectures.length === 0 || students.length === 0) && (
        <div className="form-card p-12 text-center">
          <svg className="w-14 h-14 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">No Attendance Records Found</h3>
          <p className="text-xs text-gray-400">No lectures or enrolled students found for this batch.</p>
        </div>
      )}

      {!searched && (
        <div className="form-card p-12 text-center">
          <svg className="w-14 h-14 mx-auto text-[#2A6BB5]/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">Full Attendance Report</h3>
          <p className="text-xs text-gray-400">Select a course and batch, then click Show</p>
        </div>
      )}
    </div>
  );
}
