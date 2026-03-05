'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Course { id: number; name: string }
interface Batch { id: number; name: string; category: string }

interface LectureInfo {
  Take_Id: number;
  Lecture_Name: string;
  Take_Dt: string;
  Lecture_Start: string;
  Lecture_End: string;
  Duration: string;
  ClassRoom: string;
  Topic: string;
  Faculty_Name: string;
  presentCount: number;
  absentCount: number;
  totalStudents: number;
}

interface StudentAttendance {
  srNo: number;
  Student_Id: number;
  Student_Name: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  percentage: number;
  lectures: Record<number, {
    status: string;
    inTime: string;
    outTime: string;
    late: string;
  }>;
}

interface BatchInfo {
  Batch_Id: number;
  Batch_code: string;
  Category: string;
  No_of_Lectures: string;
  Course_Name: string;
}

interface Summary {
  totalStudents: number;
  totalLectures: number;
  overallPresent: number;
  overallAbsent: number;
  averageAttendance: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekISO(daysBack: number) {
  const d = new Date();
  const diff = (d.getDay() + 7 - daysBack) % 7 || 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
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
  /* --- Filter state --- */
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [takeDate, setTakeDate] = useState(todayISO());

  /* --- Options --- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  /* --- Report data --- */
  const [lectures, setLectures] = useState<LectureInfo[]>([]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  /* --- Print ref --- */
  const printRef = useRef<HTMLDivElement>(null);

  /* ---- Load courses ---- */
  useEffect(() => {
    fetch('/api/reports/attendance?options=courses')
      .then((r) => r.json())
      .then((data) => setCourses(data.courses || []))
      .catch(() => {});
  }, []);

  /* ---- Load batches when course changes ---- */
  useEffect(() => {
    if (!courseId) { setBatches([]); setBatchId(''); return; }
    fetch(`/api/reports/attendance?options=batches&courseId=${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        const blist = data.batches || [];
        setBatches(blist);
        // Auto-select first batch
        if (blist.length > 0) {
          setBatchId(String(blist[0].id));
        } else {
          setBatchId('');
        }
      })
      .catch(() => setBatches([]));
  }, [courseId]);

  /* ---- Auto-search when all filters are filled ---- */
  const autoSearchRef = useRef(false);
  useEffect(() => {
    if (courseId && batchId && takeDate) {
      // Skip auto-search on first mount to avoid unnecessary fetch
      if (!autoSearchRef.current) {
        autoSearchRef.current = true;
        return;
      }
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, batchId, takeDate]);

  /* ---- Search ---- */
  const handleSearch = useCallback(async () => {
    if (!courseId || !batchId || !takeDate) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const qs = new URLSearchParams({ courseId, batchId, takeDate });
      const res = await fetch(`/api/reports/attendance?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `Server error (${res.status})`);
      setBatch(data.batch || null);
      setLectures(data.lectures || []);
      setStudents(data.students || []);
      setSummary(data.summary || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      console.error('Attendance report error:', msg);
      setError(msg);
      setLectures([]);
      setStudents([]);
      setBatch(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [courseId, batchId, takeDate]);

  /* ---- Cancel / Reset ---- */
  const handleCancel = useCallback(() => {
    setCourseId('');
    setBatchId('');
    setTakeDate(todayISO());
    setLectures([]);
    setStudents([]);
    setBatch(null);
    setSummary(null);
    setSearched(false);
    setError('');
  }, []);

  /* ---- Export CSV ---- */
  const exportCSV = useCallback(() => {
    if (!students.length || !lectures.length) return;
    const headers = ['Sr No', 'Student Name', ...lectures.map((_, i) => `Lecture ${i + 1}`), 'Present', 'Absent', 'Late', '%'];
    const csvRows = students.map((s) => [
      s.srNo,
      `"${s.Student_Name}"`,
      ...lectures.map((l) => s.lectures[l.Take_Id]?.status || '-'),
      s.presentCount,
      s.absentCount,
      s.lateCount,
      s.percentage,
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Report_${takeDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [students, lectures, takeDate]);

  /* ---- Export to Excel (.xlsx via ExcelJS — color-coded & styled) ---- */
  const exportExcel = useCallback(async () => {
    if (!students.length || !lectures.length) return;

    const thinBorder = (color: string): ExcelJS.Border => ({ style: 'thin', color: { argb: color } });
    const allBorders = (c: string) => ({ top: thinBorder(c), bottom: thinBorder(c), left: thinBorder(c), right: thinBorder(c) });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIT Manager';
    wb.created = new Date();
    const ws = wb.addWorksheet('Attendance Report', {
      views: [{ state: 'frozen', ySplit: 5 }],
    });

    const courseName = courses.find(c => String(c.id) === courseId)?.name || '';
    const batchName = batches.find(b => String(b.id) === batchId)?.name || '';
    const colCount = 2 + lectures.length + 4; // Sr, Name, ...lectures, Present, Absent, Late, %

    /* ====================== ROW 1: Title ====================== */
    ws.mergeCells(1, 1, 1, colCount);
    const titleRow = ws.getRow(1);
    titleRow.height = 36;
    const titleCell = ws.getCell('A1');
    titleCell.value = `Suvidya Institute of Technology — Full Attendance Report${courseName ? ' — ' + courseName : ''}`;
    titleCell.font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = allBorders('FF2E3093');

    /* ====================== ROW 2: Filter info ====================== */
    ws.mergeCells(2, 1, 2, colCount);
    const subRow = ws.getRow(2);
    subRow.height = 22;
    const subCell = ws.getCell('A2');
    subCell.value = `Date: ${fmtDate(takeDate)}  |  Course: ${courseName}  |  Batch: ${batchName}  |  Students: ${summary?.totalStudents || 0}  |  Lectures: ${lectures.length}  |  Avg Attendance: ${summary?.averageAttendance || 0}%`;
    subCell.font = { size: 9, italic: true, color: { argb: 'FF555555' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8F0' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.border = allBorders('FFCCCCCC');

    /* ====================== ROW 3: Lecture details row ====================== */
    ws.mergeCells(3, 1, 3, 2);
    const lectInfoRow = ws.getRow(3);
    lectInfoRow.height = 20;
    const lectLabelCell = ws.getCell('A3');
    lectLabelCell.value = 'Lecture →';
    lectLabelCell.font = { size: 8, bold: true, italic: true, color: { argb: 'FF6B7280' } };
    lectLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    lectLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
    lectures.forEach((l, i) => {
      const cell = lectInfoRow.getCell(3 + i);
      const label = l.Lecture_Name || l.Topic || `L${i + 1}`;
      const time = [l.Lecture_Start, l.Lecture_End].filter(Boolean).join('-');
      cell.value = `${label}${time ? '\n' + time : ''}`;
      cell.font = { size: 7, color: { argb: 'FF6B7280' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = allBorders('FFE5E7EB');
    });

    /* ====================== ROW 4: Blank spacer ====================== */
    ws.getRow(4).height = 4;

    /* ====================== ROW 5: Column Headers ====================== */
    const headers = [
      'Sr No', 'Student Name',
      ...lectures.map((_, i) => `L${i + 1}`),
      'Present', 'Absent', 'Late', '%',
    ];
    const headerRow = ws.getRow(5);
    headerRow.height = 28;
    headers.forEach((h, ci) => {
      const cell = headerRow.getCell(ci + 1);
      cell.value = h;
      cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A6BB5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = allBorders('FF1A5A9E');
    });

    /* ====================== DATA ROWS ====================== */
    students.forEach((s, i) => {
      const rowIdx = 6 + i;
      const exRow = ws.getRow(rowIdx);
      exRow.height = 20;
      const isEven = i % 2 === 0;
      const stripeBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      /* Sr No */
      const srCell = exRow.getCell(1);
      srCell.value = s.srNo;
      srCell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
      srCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } };
      srCell.alignment = { horizontal: 'center', vertical: 'middle' };
      srCell.border = allBorders('FFE5E7EB');

      /* Name */
      const nameCell = exRow.getCell(2);
      nameCell.value = s.Student_Name;
      nameCell.font = { size: 9, bold: true, color: { argb: 'FF111827' } };
      nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } };
      nameCell.alignment = { vertical: 'middle' };
      nameCell.border = allBorders('FFE5E7EB');

      /* Per-lecture status */
      lectures.forEach((l, li) => {
        const cell = exRow.getCell(3 + li);
        const att = s.lectures[l.Take_Id];
        const status = att?.status || '-';
        cell.value = status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status || '-';
        if (status === 'Present') {
          cell.font = { size: 9, bold: true, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        } else if (status === 'Absent') {
          cell.font = { size: 9, bold: true, color: { argb: 'FFB91C1C' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else {
          cell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } };
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorders('FFE5E7EB');
      });

      const summaryStart = 3 + lectures.length;

      /* Present count */
      const pCell = exRow.getCell(summaryStart);
      pCell.value = s.presentCount;
      pCell.font = { size: 9, bold: true, color: { argb: 'FF166534' } };
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      pCell.alignment = { horizontal: 'center', vertical: 'middle' };
      pCell.border = allBorders('FFE5E7EB');

      /* Absent count */
      const aCell = exRow.getCell(summaryStart + 1);
      aCell.value = s.absentCount;
      aCell.font = { size: 9, bold: true, color: { argb: 'FFB91C1C' } };
      aCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      aCell.alignment = { horizontal: 'center', vertical: 'middle' };
      aCell.border = allBorders('FFE5E7EB');

      /* Late count */
      const lCell = exRow.getCell(summaryStart + 2);
      lCell.value = s.lateCount;
      lCell.font = { size: 9, bold: true, color: { argb: 'FFA16207' } };
      lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      lCell.alignment = { horizontal: 'center', vertical: 'middle' };
      lCell.border = allBorders('FFE5E7EB');

      /* Percentage */
      const percCell = exRow.getCell(summaryStart + 3);
      percCell.value = s.percentage;
      const percColor = s.percentage >= 75 ? 'FF166534' : s.percentage >= 50 ? 'FFA16207' : 'FFB91C1C';
      const percBg = s.percentage >= 75 ? 'FFDCFCE7' : s.percentage >= 50 ? 'FFFEF9C3' : 'FFFEE2E2';
      percCell.font = { size: 9, bold: true, color: { argb: percColor } };
      percCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: percBg } };
      percCell.alignment = { horizontal: 'center', vertical: 'middle' };
      percCell.border = allBorders('FFE5E7EB');
    });

    /* ====================== TOTALS ROW ====================== */
    const totRowIdx = 6 + students.length;
    const totRow = ws.getRow(totRowIdx);
    totRow.height = 24;
    ws.mergeCells(totRowIdx, 1, totRowIdx, 2);
    const totLabelCell = totRow.getCell(1);
    totLabelCell.value = 'TOTAL';
    totLabelCell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    totLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    totLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totLabelCell.border = allBorders('FF1E3A5F');

    lectures.forEach((l, li) => {
      const cell = totRow.getCell(3 + li);
      const present = students.filter(s => s.lectures[l.Take_Id]?.status === 'Present').length;
      cell.value = `${present}/${students.length}`;
      cell.font = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorders('FF1E3A5F');
    });

    const tSummaryStart = 3 + lectures.length;
    [summary?.overallPresent || 0, summary?.overallAbsent || 0, '-', `${summary?.averageAttendance || 0}%`].forEach((v, i) => {
      const cell = totRow.getCell(tSummaryStart + i);
      cell.value = v;
      cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorders('FF1E3A5F');
    });

    /* ====================== Column Widths ====================== */
    ws.columns = [
      { width: 8 },   // Sr No
      { width: 28 },  // Name
      ...lectures.map(() => ({ width: 10 })),
      { width: 10 },  // Present
      { width: 10 },  // Absent
      { width: 8 },   // Late
      { width: 8 },   // %
    ];

    /* ====================== Auto-filter ====================== */
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + students.length, column: colCount } };

    /* ====================== Generate & Download ====================== */
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Attendance_Report_${batchName || 'batch'}_${takeDate}.xlsx`);
  }, [students, lectures, summary, takeDate, courseId, batchId, courses, batches]);

  /* ---- Print ---- */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /* ---- Quick date presets ---- */
  const datePresets = useMemo(() => [
    { label: 'Today', iso: todayISO() },
    { label: 'Yesterday', iso: yesterdayISO() },
    { label: 'Mon', iso: dayOfWeekISO(1) },
    { label: 'Tue', iso: dayOfWeekISO(2) },
    { label: 'Wed', iso: dayOfWeekISO(3) },
    { label: 'Thu', iso: dayOfWeekISO(4) },
    { label: 'Fri', iso: dayOfWeekISO(5) },
    { label: 'Sat', iso: dayOfWeekISO(6) },
  ], []);

  const isFormValid = courseId && batchId && takeDate;

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E3093]">Full Attendance Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">View day-wise student attendance for a batch</p>
        </div>
        {searched && students.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-xs" title="Print">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs" title="CSV">
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

      {/* ─── Compact Filters Bar ─── */}
      <div className="form-card px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Course */}
          <div className="min-w-[180px] flex-1 max-w-[240px]">
            <label className="label text-[10px] mb-0.5">Course<span className="text-red-500">*</span></label>
            <select
              value={courseId}
              onChange={(e) => { setCourseId(e.target.value); setBatchId(''); }}
              className="input-sm !max-w-full !h-9 text-xs"
            >
              <option value="">Select Course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Batch */}
          <div className="min-w-[160px] flex-1 max-w-[220px]">
            <label className="label text-[10px] mb-0.5">Batch<span className="text-red-500">*</span></label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="input-sm !max-w-full !h-9 text-xs"
              disabled={!courseId}
            >
              <option value="">{courseId ? 'Select Batch' : '—'}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.category ? ` (${b.category})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="min-w-[140px]">
            <label className="label text-[10px] mb-0.5">Date<span className="text-red-500">*</span></label>
            <input
              type="date"
              value={takeDate}
              onChange={(e) => setTakeDate(e.target.value)}
              className="input-sm !max-w-full !h-9 text-xs"
            />
          </div>

          {/* Quick date pills */}
          <div className="flex items-center gap-1 flex-wrap pb-0.5">
            {datePresets.map((p) => (
              <button
                key={p.label}
                onClick={() => setTakeDate(p.iso)}
                className={`px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-colors border ${
                  takeDate === p.iso
                    ? 'bg-[#2E3093] text-white border-[#2E3093]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
                title={shortDate(p.iso)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Show / Cancel */}
          <div className="flex items-center gap-2 pb-0.5 ml-auto">
            <button onClick={handleSearch} disabled={!isFormValid || loading} className="btn-primary text-xs h-9 px-5">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Loading…
                </span>
              ) : 'Show'}
            </button>
            <button onClick={handleCancel} className="btn-secondary text-xs h-9 px-4">Reset</button>
          </div>
        </div>
      </div>

      {/* ─── Error ─── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      {searched && summary && students.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Total Students" value={summary.totalStudents} color="blue" />
          <SummaryCard label="Total Lectures" value={summary.totalLectures} color="indigo" />
          <SummaryCard label="Overall Present" value={summary.overallPresent} color="green" />
          <SummaryCard label="Overall Absent" value={summary.overallAbsent} color="red" />
          <SummaryCard label="Avg Attendance" value={`${summary.averageAttendance}%`} color={summary.averageAttendance >= 75 ? 'green' : summary.averageAttendance >= 50 ? 'yellow' : 'red'} />
        </div>
      )}

      {/* ─── Lecture Details ─── */}
      {searched && lectures.length > 0 && (
        <div className="form-card p-4">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#2A6BB5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Lectures on {fmtDate(takeDate)}
            <span className="ml-2 text-xs font-normal text-gray-500">({lectures.length} lecture{lectures.length !== 1 ? 's' : ''})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lectures.map((l, i) => (
              <div key={l.Take_Id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#2E3093]">Lecture {i + 1}</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{l.ClassRoom || '-'}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{l.Lecture_Name || l.Topic || 'Untitled'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{l.Faculty_Name || '-'}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px]">
                  <span className="text-gray-500">{[l.Lecture_Start, l.Lecture_End].filter(Boolean).join(' – ') || '-'}</span>
                  <span className="text-green-700 font-medium">P: {l.presentCount}</span>
                  <span className="text-red-700 font-medium">A: {l.absentCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Printable Attendance Table ─── */}
      <div ref={printRef} id="attendance-report-print" className="report-print-area">
        {/* Print header */}
        <div className="report-header hidden print:block">
          <div className="report-header-inner">
            <div className="report-logo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sit.png" alt="SIT Logo" className="report-logo" />
            </div>
            <div className="report-title-block">
              <h1 className="report-title">Suvidya Institute of Technology</h1>
              <h2 className="report-subtitle">Full Attendance Report{batch ? ` — ${batch.Course_Name}` : ''}</h2>
              <p className="report-period">
                Date: {fmtDate(takeDate)}
                {batch ? ` | Batch: ${batch.Batch_code}${batch.Category ? ` (${batch.Category})` : ''}` : ''}
                {summary ? ` | Students: ${summary.totalStudents} | Lectures: ${summary.totalLectures}` : ''}
              </p>
              <p className="report-meta">
                Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                {summary ? ` | Avg Attendance: ${summary.averageAttendance}%` : ''}
              </p>
            </div>
          </div>
          <div className="report-header-line" />
        </div>

        {/* Data Table */}
        {searched && students.length > 0 && (
          <div className="form-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#2A6BB5] text-white">
                    <th className="px-2 py-2.5 text-center font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Sr</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Student Name</th>
                    {lectures.map((_, i) => (
                      <th key={i} className="px-2 py-2.5 text-center font-semibold border-r border-[#1a5a9e] whitespace-nowrap">L{i + 1}</th>
                    ))}
                    <th className="px-2 py-2.5 text-center font-semibold border-r border-[#1a5a9e] whitespace-nowrap bg-green-700">P</th>
                    <th className="px-2 py-2.5 text-center font-semibold border-r border-[#1a5a9e] whitespace-nowrap bg-red-700">A</th>
                    <th className="px-2 py-2.5 text-center font-semibold border-r border-[#1a5a9e] whitespace-nowrap bg-yellow-600">Late</th>
                    <th className="px-2 py-2.5 text-center font-semibold whitespace-nowrap">%</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.Student_Id} className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-2 py-2 text-center text-gray-400 border-r border-gray-100">{s.srNo}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-100 whitespace-nowrap">{s.Student_Name}</td>
                      {lectures.map((l) => {
                        const att = s.lectures[l.Take_Id];
                        const status = att?.status || '-';
                        const isPresent = status === 'Present';
                        const isAbsent = status === 'Absent';
                        const isLate = att?.late === 'Yes';
                        return (
                          <td key={l.Take_Id} className={`px-2 py-2 text-center border-r border-gray-100 font-semibold ${
                            isPresent ? 'text-green-700 bg-green-50' : isAbsent ? 'text-red-700 bg-red-50' : 'text-gray-400'
                          }`} title={isPresent && isLate ? 'Present (Late)' : status}>
                            {isPresent ? (isLate ? 'P*' : 'P') : isAbsent ? 'A' : '-'}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center font-bold text-green-700 bg-green-50 border-r border-gray-100">{s.presentCount}</td>
                      <td className="px-2 py-2 text-center font-bold text-red-700 bg-red-50 border-r border-gray-100">{s.absentCount}</td>
                      <td className="px-2 py-2 text-center font-bold text-yellow-700 bg-yellow-50 border-r border-gray-100">{s.lateCount}</td>
                      <td className={`px-2 py-2 text-center font-bold ${
                        s.percentage >= 75 ? 'text-green-700 bg-green-50' : s.percentage >= 50 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50'
                      }`}>{s.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
                {/* Table footer totals */}
                <tfoot>
                  <tr className="bg-[#1E3A5F] text-white font-bold text-xs">
                    <td colSpan={2} className="px-3 py-2.5 text-center border-r border-[#1a5a9e]">TOTAL</td>
                    {lectures.map((l) => {
                      const present = students.filter(s => s.lectures[l.Take_Id]?.status === 'Present').length;
                      return (
                        <td key={l.Take_Id} className="px-2 py-2.5 text-center border-r border-[#1a5a9e]">{present}/{students.length}</td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-center border-r border-[#1a5a9e]">{summary?.overallPresent}</td>
                    <td className="px-2 py-2.5 text-center border-r border-[#1a5a9e]">{summary?.overallAbsent}</td>
                    <td className="px-2 py-2.5 text-center border-r border-[#1a5a9e]">-</td>
                    <td className="px-2 py-2.5 text-center">{summary?.averageAttendance}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Legend + meta */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>P = Present &nbsp; A = Absent &nbsp; P* = Present (Late) &nbsp;|&nbsp; {students.length} students, {lectures.length} lectures</span>
              <span>Report: {new Date().toLocaleString('en-GB')}</span>
            </div>
          </div>
        )}

        {/* Print footer */}
        <div className="report-footer hidden print:block">
          <div className="report-footer-line" />
          <div className="report-footer-inner">
            <span>Suvidya Institute of Technology — Confidential</span>
            <span>Page: <span className="report-page-num" /></span>
          </div>
        </div>
      </div>

      {/* ─── Empty state ─── */}
      {searched && !loading && !error && students.length === 0 && (
        <div className="form-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">No Attendance Records Found</h3>
          <p className="text-xs text-gray-400">No lectures were taken for this batch on {fmtDate(takeDate)}</p>
        </div>
      )}

      {/* ─── Initial state ─── */}
      {!searched && (
        <div className="form-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-[#2A6BB5]/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">Full Attendance Report</h3>
          <p className="text-xs text-gray-400">Select a course, batch and date, then click Show</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card                                                       */
/* ------------------------------------------------------------------ */
const CARD_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-500' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-500' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    icon: 'text-red-500' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-500' },
};

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const c = CARD_COLORS[color] || CARD_COLORS.blue;
  return (
    <div className={`${c.bg} border border-opacity-30 rounded-xl p-3.5`}>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${c.text}`}>{value}</p>
    </div>
  );
}
