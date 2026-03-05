'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface StudentRow {
  srNo: number;
  Admission_Id: number;
  Student_Id: number;
  Student_Name: string;
  Sex: string;
  Email: string;
  Present_Mobile: string;
  Present_Mobile2: string;
  Course_Name: string;
  Batch_code: string;
  Batch_Category: string;
  Admission_Date: string;
  Status: string;
  Status_id: number;
  Qualification: string;
  Discipline: string;
  Percentage: string;
  Cancel: string;
  IsActive: number;
}

interface Course {
  id: number;
  name: string;
}

interface StatusOption {
  id: number;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Status color map                                                   */
/* ------------------------------------------------------------------ */
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'New Inquiry':        { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  'Follow Up':          { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  'Interested':         { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Confirmed':          { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  'Not Interested':     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  'Batch Started':      { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  'Batch Completed':    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  'Cancelled':          { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  'Admitted':           { bg: 'bg-green-50',   text: 'text-green-800',   border: 'border-green-300' },
  'Left':               { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200' },
  'On Hold':            { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
  'Prospective':        { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  'Walk In':            { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  'Re-inquiry':         { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  'Demo Attended':      { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  'Demo Scheduled':     { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  'Online Inquiry':     { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-300' },
  'Document Pending':   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  'Fees Pending':       { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-300' },
  'Transfer':           { bg: 'bg-indigo-50',  text: 'text-indigo-800',  border: 'border-indigo-300' },
  'Need Based Training': { bg: 'bg-lime-50',   text: 'text-lime-700',    border: 'border-lime-200' },
  'Duplicate':          { bg: 'bg-zinc-100',   text: 'text-zinc-600',    border: 'border-zinc-300' },
  'Corporate':          { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
  'Assessment Done':    { bg: 'bg-teal-50',    text: 'text-teal-800',    border: 'border-teal-300' },
  'Refund':             { bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-300' },
  'Counselling Done':   { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
};

const DEFAULT_COLOR = { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

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

function monthAgoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function OnlineStudentReportPage() {
  const { canView, canExport, loading: permLoading } = useResourcePermissions('online_admission');

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view online student reports." />;

  return <OnlineStudentReportContent canExport={canExport} />;
}

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */
function OnlineStudentReportContent({ canExport }: { canExport: boolean }) {
  /* --- Filter state --- */
  const [courseId, setCourseId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [dateFrom, setDateFrom] = useState(monthAgoISO());
  const [dateTo, setDateTo] = useState(todayISO());

  /* --- Options --- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);

  /* --- Report data --- */
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  /* --- Print ref --- */
  const printRef = useRef<HTMLDivElement>(null);

  /* ---- Load dropdown options ---- */
  useEffect(() => {
    fetch('/api/inquiry/options')
      .then((r) => r.json())
      .then((data) => {
        setCourses(data.courses || []);
      })
      .catch(() => {});

    // Status options from online-admission style map
    const admissionStatuses: StatusOption[] = [
      { id: 0, label: 'New Inquiry' },
      { id: 1, label: 'Follow Up' },
      { id: 2, label: 'Interested' },
      { id: 3, label: 'Confirmed' },
      { id: 4, label: 'Not Interested' },
      { id: 5, label: 'Batch Started' },
      { id: 6, label: 'Batch Completed' },
      { id: 7, label: 'Cancelled' },
      { id: 8, label: 'Admitted' },
      { id: 9, label: 'Left' },
      { id: 10, label: 'On Hold' },
      { id: 12, label: 'Prospective' },
      { id: 13, label: 'Walk In' },
      { id: 15, label: 'Re-inquiry' },
      { id: 16, label: 'Demo Attended' },
      { id: 17, label: 'Demo Scheduled' },
      { id: 19, label: 'Online Inquiry' },
      { id: 23, label: 'Document Pending' },
      { id: 24, label: 'Fees Pending' },
      { id: 25, label: 'Transfer' },
      { id: 26, label: 'Need Based Training' },
      { id: 27, label: 'Duplicate' },
      { id: 29, label: 'Corporate' },
      { id: 34, label: 'Assessment Done' },
      { id: 35, label: 'Refund' },
      { id: 40, label: 'Counselling Done' },
    ];
    setStatusOptions(admissionStatuses);
  }, []);

  /* ---- Search ---- */
  const handleSearch = useCallback(async () => {
    if (!courseId || !statusId || !dateFrom || !dateTo) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const qs = new URLSearchParams({ courseId, statusId, dateFrom, dateTo });
      const res = await fetch(`/api/reports/online-student?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `Server error (${res.status})`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setStatusSummary(data.statusSummary || {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      console.error('Report error:', msg);
      setError(msg);
      setRows([]);
      setTotal(0);
      setStatusSummary({});
    } finally {
      setLoading(false);
    }
  }, [courseId, statusId, dateFrom, dateTo]);

  /* ---- Cancel / Reset ---- */
  const handleCancel = useCallback(() => {
    setCourseId('');
    setStatusId('');
    setDateFrom(monthAgoISO());
    setDateTo(todayISO());
    setRows([]);
    setTotal(0);
    setStatusSummary({});
    setSearched(false);
    setError('');
  }, []);

  /* ---- Export CSV ---- */
  const exportCSV = useCallback(() => {
    if (!rows.length) return;
    const headers = [
      'Sr No', 'Name', 'Sex', 'Mobile', 'Email', 'Course', 'Batch',
      'Batch Category', 'Admission Date', 'Status', 'Qualification',
      'Discipline', 'Percentage',
    ];
    const csvRows = rows.map((r) => [
      r.srNo, `"${r.Student_Name}"`, r.Sex, r.Present_Mobile,
      `"${r.Email}"`, `"${r.Course_Name}"`, r.Batch_code,
      r.Batch_Category, fmtDate(r.Admission_Date), r.Status,
      r.Qualification, r.Discipline, r.Percentage,
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Online_Student_Report_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, dateFrom, dateTo]);

  /* ---- Export to Excel (.xlsx via ExcelJS — color-coded & styled) ---- */
  const exportExcel = useCallback(async () => {
    if (!rows.length) return;

    /* --- Status color maps (ARGB hex without #) --- */
    const statusExcelBg: Record<string, string> = {
      'New Inquiry': 'FFDBEAFE', 'Follow Up': 'FFFEF9C3', 'Interested': 'FFD1FAE5',
      'Confirmed': 'FFDCFCE7', 'Not Interested': 'FFFEE2E2', 'Batch Started': 'FFE0E7FF',
      'Batch Completed': 'FFCCFBF1', 'Cancelled': 'FFFFE4E6', 'Admitted': 'FFBBF7D0',
      'Left': 'FFF3F4F6', 'On Hold': 'FFF1F5F9', 'Prospective': 'FFCFFAFE',
      'Walk In': 'FFE0F2FE', 'Re-inquiry': 'FFFFEDD5', 'Demo Attended': 'FFEDE9FE',
      'Demo Scheduled': 'FFF3E8FF', 'Online Inquiry': 'FFBFDBFE', 'Document Pending': 'FFFEF3C7',
      'Fees Pending': 'FFFED7AA', 'Transfer': 'FFC7D2FE', 'Need Based Training': 'FFECFCCB',
      'Duplicate': 'FFE4E4E7', 'Corporate': 'FFFAE8FF', 'Assessment Done': 'FFA7F3D0',
      'Refund': 'FFFECACA', 'Counselling Done': 'FFA7F3D0',
    };
    const statusExcelFont: Record<string, string> = {
      'New Inquiry': 'FF1D4ED8', 'Follow Up': 'FFA16207', 'Interested': 'FF047857',
      'Confirmed': 'FF15803D', 'Not Interested': 'FFB91C1C', 'Batch Started': 'FF3730A3',
      'Batch Completed': 'FF0F766E', 'Cancelled': 'FFBE123C', 'Admitted': 'FF166534',
      'Left': 'FF4B5563', 'On Hold': 'FF475569', 'Prospective': 'FF0E7490',
      'Walk In': 'FF0369A1', 'Re-inquiry': 'FFC2410C', 'Demo Attended': 'FF5B21B6',
      'Demo Scheduled': 'FF7C3AED', 'Online Inquiry': 'FF1E40AF', 'Document Pending': 'FFB45309',
      'Fees Pending': 'FFC2410C', 'Transfer': 'FF3730A3', 'Need Based Training': 'FF4D7C0F',
      'Duplicate': 'FF52525B', 'Corporate': 'FFA21CAF', 'Assessment Done': 'FF065F46',
      'Refund': 'FF991B1B', 'Counselling Done': 'FF065F46',
    };

    const thinBorder = (color: string): ExcelJS.Border => ({ style: 'thin', color: { argb: color } });
    const allBorders = (c: string) => ({ top: thinBorder(c), bottom: thinBorder(c), left: thinBorder(c), right: thinBorder(c) });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIT Manager';
    wb.created = new Date();
    const ws = wb.addWorksheet('Online Student Report', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    const colCount = 13;
    const courseName = courses.find(c => String(c.id) === courseId)?.name || '';
    const statusLabel = statusOptions.find(s => String(s.id) === statusId)?.label || '';
    const filterDesc = `Period: ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}  |  Course: ${courseName}  |  Status: ${statusLabel}  |  Total Records: ${total}`;

    /* ====================== ROW 1: Title ====================== */
    ws.mergeCells(1, 1, 1, colCount);
    const titleRow = ws.getRow(1);
    titleRow.height = 36;
    const titleCell = ws.getCell('A1');
    titleCell.value = `Suvidya Institute of Technology — Online Student Report${courseName ? ' — ' + courseName : ''}`;
    titleCell.font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = allBorders('FF2E3093');

    /* ====================== ROW 2: Filter info ====================== */
    ws.mergeCells(2, 1, 2, colCount);
    const subRow = ws.getRow(2);
    subRow.height = 22;
    const subCell = ws.getCell('A2');
    subCell.value = filterDesc;
    subCell.font = { size: 9, italic: true, color: { argb: 'FF555555' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8F0' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.border = allBorders('FFCCCCCC');

    /* ====================== ROW 3: Blank spacer ====================== */
    ws.getRow(3).height = 6;

    /* ====================== ROW 4: Column Headers ====================== */
    const headers = [
      'Sr No', 'Name', 'Sex', 'Mobile', 'Email', 'Course', 'Batch',
      'Batch Category', 'Admission Date', 'Status', 'Qualification',
      'Discipline', 'Percentage',
    ];
    const headerRow = ws.getRow(4);
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
    rows.forEach((r, i) => {
      const rowIdx = 5 + i;
      const exRow = ws.getRow(rowIdx);
      exRow.height = 20;
      const isEven = i % 2 === 0;
      const stripeBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
      const statusBg = statusExcelBg[r.Status] || 'FFF3F4F6';
      const statusFn = statusExcelFont[r.Status] || 'FF333333';

      const vals: (string | number)[] = [
        r.srNo, r.Student_Name, r.Sex, r.Present_Mobile, r.Email,
        r.Course_Name, r.Batch_code, r.Batch_Category,
        fmtDate(r.Admission_Date), r.Status, r.Qualification,
        r.Discipline, r.Percentage,
      ];

      vals.forEach((v, ci) => {
        const cell = exRow.getCell(ci + 1);
        cell.value = v;
        cell.border = allBorders('FFE5E7EB');

        if (ci === 9) {
          /* Status column — color-coded */
          cell.font = { size: 9, bold: true, color: { argb: statusFn } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (ci === 0) {
          /* Sr No — centered */
          cell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (ci === 1) {
          /* Name — bold */
          cell.font = { size: 9, bold: true, color: { argb: 'FF111827' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } };
          cell.alignment = { vertical: 'middle' };
        } else {
          cell.font = { size: 9, color: { argb: 'FF4B5563' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } };
          cell.alignment = { vertical: 'middle' };
        }
      });
    });

    /* ====================== STATUS SUMMARY SECTION ====================== */
    const summaryEntries = Object.entries(statusSummary).sort(([, a], [, b]) => b - a);
    const gapRow = 5 + rows.length;
    ws.getRow(gapRow).height = 10;

    /* Summary title */
    const smTitleRowIdx = gapRow + 1;
    ws.mergeCells(smTitleRowIdx, 1, smTitleRowIdx, 2);
    const smTitleCell = ws.getCell(smTitleRowIdx, 1);
    smTitleCell.value = 'Status Summary';
    smTitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    smTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
    smTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    smTitleCell.border = allBorders('FF2E3093');
    ws.getRow(smTitleRowIdx).height = 26;

    /* Sub-headers */
    const smSubRowIdx = smTitleRowIdx + 1;
    ['Status', 'Count'].forEach((h, ci) => {
      const cell = ws.getCell(smSubRowIdx, ci + 1);
      cell.value = h;
      cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5EAA' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorders('FF3B4D8A');
    });
    ws.getRow(smSubRowIdx).height = 22;

    /* Summary data rows */
    summaryEntries.forEach(([statusName, count], i) => {
      const rowIdx = smSubRowIdx + 1 + i;
      const sBg = statusExcelBg[statusName] || 'FFF9FAFB';
      const sFnt = statusExcelFont[statusName] || 'FF333333';
      const exRow = ws.getRow(rowIdx);
      exRow.height = 20;

      const statusCell = exRow.getCell(1);
      statusCell.value = statusName;
      statusCell.font = { size: 9, color: { argb: sFnt } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sBg } };
      statusCell.alignment = { vertical: 'middle' };
      statusCell.border = allBorders('FFD1D5DB');

      const countCell = exRow.getCell(2);
      countCell.value = count;
      countCell.font = { size: 9, bold: true, color: { argb: sFnt } };
      countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sBg } };
      countCell.alignment = { horizontal: 'center', vertical: 'middle' };
      countCell.border = allBorders('FFD1D5DB');
    });

    /* TOTAL row */
    const totalRowIdx = smSubRowIdx + 1 + summaryEntries.length;
    const totalExRow = ws.getRow(totalRowIdx);
    totalExRow.height = 24;
    const totalLabelCell = totalExRow.getCell(1);
    totalLabelCell.value = 'TOTAL';
    totalLabelCell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalLabelCell.border = allBorders('FF1E3A5F');

    const totalValCell = totalExRow.getCell(2);
    totalValCell.value = total;
    totalValCell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    totalValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    totalValCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalValCell.border = allBorders('FF1E3A5F');

    /* ====================== Column Widths ====================== */
    ws.columns = [
      { width: 8 },   // Sr No
      { width: 30 },  // Name
      { width: 8 },   // Sex
      { width: 16 },  // Mobile
      { width: 30 },  // Email
      { width: 30 },  // Course
      { width: 15 },  // Batch
      { width: 18 },  // Batch Category
      { width: 16 },  // Admission Date
      { width: 22 },  // Status
      { width: 18 },  // Qualification
      { width: 18 },  // Discipline
      { width: 13 },  // Percentage
    ];

    /* ====================== Auto-filter on header row ====================== */
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: colCount } };

    /* ====================== Generate & Download ====================== */
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Online_Student_Report_${dateFrom}_to_${dateTo}.xlsx`);
  }, [rows, dateFrom, dateTo, courseId, statusId, courses, statusOptions, total, statusSummary]);

  /* ---- Print ---- */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const isFormValid = courseId && statusId && dateFrom && dateTo;

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E3093]">Online Student Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">Generate and export online student admission reports</p>
        </div>
        {searched && rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 text-xs" title="Print Preview">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs" title="Export CSV">
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

      {/* ─── Filters Card ─── */}
      <div className="form-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
          {/* Course */}
          <div>
            <label className="label">Select Course<span className="text-red-500 ml-0.5">*</span></label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="input-sm !max-w-full"
              required
            >
              <option value="">Select Course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Admission Status */}
          <div>
            <label className="label">Admission Status<span className="text-red-500 ml-0.5">*</span></label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="input-sm !max-w-full"
              required
            >
              <option value="">Select</option>
              {statusOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="label">From Date<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-sm !max-w-full"
              required
            />
          </div>

          {/* To Date */}
          <div>
            <label className="label">To Date<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-sm !max-w-full"
              required
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSearch}
            disabled={!isFormValid || loading}
            className="btn-primary text-xs h-10 px-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Searching…
              </span>
            ) : (
              'Show'
            )}
          </button>
          <button
            onClick={handleCancel}
            className="btn-secondary text-xs h-10 px-6"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ─── Error Message ─── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          <div>
            <p className="font-medium">{error}</p>
            {error.includes('nauthorized') || error.includes('login') ? (
              <p className="text-xs mt-0.5 text-red-500">Please sign in again and retry.</p>
            ) : (
              <p className="text-xs mt-0.5 text-red-500">Try adjusting your filters or date range.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Status Summary ─── */}
      {searched && rows.length > 0 && (
        <div className="form-card p-4">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#2A6BB5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Status Summary
            <span className="ml-2 text-xs font-normal text-gray-500">({total} total records)</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusSummary)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const clr = STATUS_COLORS[status] || DEFAULT_COLOR;
                return (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${clr.bg} ${clr.text} ${clr.border}`}
                  >
                    {status}
                    <span className="font-bold">{count}</span>
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {/* ─── Printable Report Preview ─── */}
      <div ref={printRef} id="online-student-report-print" className="report-print-area">
        {/* Print header */}
        <div className="report-header hidden print:block">
          <div className="report-header-inner">
            <div className="report-logo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sit.png" alt="SIT Logo" className="report-logo" />
            </div>
            <div className="report-title-block">
              <h1 className="report-title">Suvidya Institute of Technology</h1>
              <h2 className="report-subtitle">Online Student Report{courseId ? ` — ${courses.find(c => String(c.id) === courseId)?.name || ''}` : ''}</h2>
              <p className="report-period">
                Period: {fmtDate(dateFrom)} to {fmtDate(dateTo)}
                {courseId ? ` | Course: ${courses.find(c => String(c.id) === courseId)?.name || ''}` : ''}
                {statusId ? ` | Status: ${statusOptions.find(s => String(s.id) === statusId)?.label || ''}` : ''}
              </p>
              <p className="report-meta">
                Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} | Total Records: {total}
              </p>
            </div>
          </div>
          <div className="report-header-line" />
        </div>

        {/* Data Table */}
        {searched && rows.length > 0 && (
          <div className="form-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#2A6BB5] text-white">
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Sr</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Name</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Mobile</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Email</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Course</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Batch</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Admission Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Qualification</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const clr = STATUS_COLORS[r.Status] || DEFAULT_COLOR;
                    return (
                      <tr
                        key={r.Admission_Id}
                        className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="px-3 py-2 text-center text-gray-400 border-r border-gray-100">{r.srNo}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-100 whitespace-nowrap">{r.Student_Name}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">{r.Present_Mobile}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 max-w-[180px] truncate">{r.Email}</td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-100 whitespace-nowrap">{r.Course_Name}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">
                          {r.Batch_code}
                          {r.Batch_Category && <span className="ml-1 text-[10px] text-gray-400">({r.Batch_Category})</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">{fmtDate(r.Admission_Date)}</td>
                        <td className="px-3 py-2 border-r border-gray-100">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${clr.bg} ${clr.text} ${clr.border}`}>
                            {r.Status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">{r.Qualification}</td>
                        <td className="px-3 py-2 text-gray-600 text-center">{r.Percentage}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>Showing {rows.length} of {total} records</span>
              <span>Report generated: {new Date().toLocaleString('en-GB')}</span>
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
      {searched && !loading && !error && rows.length === 0 && (
        <div className="form-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">No Records Found</h3>
          <p className="text-xs text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}

      {/* ─── Initial state ─── */}
      {!searched && (
        <div className="form-card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-[#2A6BB5]/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-500 mb-1">Generate Online Student Report</h3>
          <p className="text-xs text-gray-400">Select all required filters above and click Show to generate the report</p>
        </div>
      )}
    </div>
  );
}
