'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface InquiryRow {
  srNo: number;
  Student_Id: number;
  Student_Name: string;
  Sex: string;
  Present_Mobile: string;
  Present_Mobile2: string;
  Email: string;
  Inquiry_Dt: string;
  Inquiry_Type: string;
  Inquiry_From: string;
  Status: string;
  Status_id: number;
  Qualification: string;
  Discipline: string;
  Percentage: string;
  Course_Name: string;
  Batch_code: string;
  Batch_Category: string;
  Discussion: string;
}

interface Course {
  id: number;
  name: string;
}

interface Batch {
  Batch_Id: number;
  Batch_code: string;
  Category: string | null;
}

/* ------------------------------------------------------------------ */
/*  Status color map                                                   */
/* ------------------------------------------------------------------ */
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'New':            { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  'Contacted':      { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  'Inquiry':        { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  'Follow Up':      { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  'Interested':     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Not Interested': { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  'Admitted':       { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200' },
  'Closed':         { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200' },
  'DNC':            { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  'Converted':      { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  'Pending':        { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  'Callback':       { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  'Visited':        { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  'On Hold':        { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
  'Lost':           { bg: 'bg-red-50',     text: 'text-red-800',     border: 'border-red-300' },
  'Hot Lead':       { bg: 'bg-rose-50',    text: 'text-rose-800',    border: 'border-rose-300' },
  'Warm Lead':      { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-300' },
  'Cold Lead':      { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-300' },
  'Enrolled':       { bg: 'bg-green-50',   text: 'text-green-800',   border: 'border-green-300' },
  'Dropped':        { bg: 'bg-zinc-100',   text: 'text-zinc-600',    border: 'border-zinc-300' },
  'Archived':       { bg: 'bg-stone-100',  text: 'text-stone-600',   border: 'border-stone-300' },
};

const DEFAULT_COLOR = { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

/* ------------------------------------------------------------------ */
/*  Helper: format date                                                */
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
export default function InquiryReportPage() {
  return (
    <PermissionGate resource="inquiry" deniedMessage="You do not have permission to view inquiry reports.">
      {(perms) => <InquiryReportContent {...perms} />}
    </PermissionGate>
  );
}

const DATE_PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: 'This Month', from: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }, to: todayISO },
  { label: 'Last Month', from: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }, to: () => { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10); } },
  { label: 'Last 3 Months', from: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }, to: todayISO },
  { label: 'Last 6 Months', from: () => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); }, to: todayISO },
  { label: 'This Year', from: () => `${new Date().getFullYear()}-01-01`, to: todayISO },
  { label: 'Last Year', from: () => `${new Date().getFullYear() - 1}-01-01`, to: () => `${new Date().getFullYear() - 1}-12-31` },
  { label: 'All Time', from: () => '2001-01-01', to: todayISO },
];

function InquiryReportContent({
  canExport,
}: {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  /* --- Filter state --- */
  const [dateFrom, setDateFrom] = useState(monthAgoISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [courseId, setCourseId] = useState('');
  const [batchType, setBatchType] = useState('');
  const [batchId, setBatchId] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [inquiryFrom, setInquiryFrom] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* --- Options --- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [inquiryTypes, setInquiryTypes] = useState<string[]>([]);
  const [inquiryModes, setInquiryModes] = useState<string[]>([]);

  /* --- Report data --- */
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  /* --- Print ref --- */
  const printRef = useRef<HTMLDivElement>(null);

  /* ---- Active filter count (excluding dates) ---- */
  const activeFilters = [courseId, batchType, batchId, inquiryType, inquiryFrom].filter(Boolean).length;

  /* ---- Load dropdown options ---- */
  useEffect(() => {
    fetch('/api/inquiry/options')
      .then((r) => r.json())
      .then((data) => {
        setCourses(data.courses || []);
        setCategories(data.categories || []);
        setInquiryTypes(data.inquiryTypes || []);
        setInquiryModes(data.inquiryModes || []);
      })
      .catch(() => {});
  }, []);

  /* ---- Load batches when course/category changes ---- */
  useEffect(() => {
    if (!courseId && !batchType) {
      setBatches([]);
      setBatchId('');
      return;
    }
    const qs = new URLSearchParams();
    if (courseId) qs.set('courseId', courseId);
    if (batchType) qs.set('category', batchType);
    fetch(`/api/inquiry/batches?${qs}`)
      .then((r) => r.json())
      .then((data) => setBatches(data.batches || []))
      .catch(() => setBatches([]));
  }, [courseId, batchType]);

  /* ---- Clear all optional filters ---- */
  const clearFilters = useCallback(() => {
    setCourseId('');
    setBatchType('');
    setBatchId('');
    setInquiryType('');
    setInquiryFrom('');
  }, []);

  /* ---- Search ---- */
  const handleSearch = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const qs = new URLSearchParams({ dateFrom, dateTo });
      if (courseId) qs.set('courseId', courseId);
      if (batchType) qs.set('batchType', batchType);
      if (batchId) qs.set('batchId', batchId);
      if (inquiryType) qs.set('inquiryType', inquiryType);
      if (inquiryFrom) qs.set('inquiryFrom', inquiryFrom);
      const res = await fetch(`/api/reports/inquiry?${qs}`);
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
  }, [dateFrom, dateTo, courseId, batchType, batchId, inquiryType, inquiryFrom]);

  /* ---- Export to CSV ---- */
  const exportCSV = useCallback(() => {
    if (!rows.length) return;
    const headers = [
      'Sr No', 'Name', 'Mobile', 'Email', 'Course', 'Batch', 'Batch Category',
      'Inquiry Date', 'Inquiry Type', 'Inquiry From', 'Status', 'Qualification',
      'Discipline', 'Percentage', 'Discussion',
    ];
    const csvRows = rows.map((r) => [
      r.srNo, r.Student_Name, r.Present_Mobile, r.Email, r.Course_Name,
      r.Batch_code, r.Batch_Category, fmtDate(r.Inquiry_Dt), r.Inquiry_Type,
      r.Inquiry_From, r.Status, r.Qualification, r.Discipline, r.Percentage,
      `"${(r.Discussion || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inquiry_Report_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, dateFrom, dateTo]);

  /* ---- Export to Excel (.xlsx via ExcelJS — color-coded & styled) ---- */
  const exportExcel = useCallback(async () => {
    if (!rows.length) return;

    /* --- Status color maps (ARGB hex) --- */
    const statusExcelBg: Record<string, string> = {
      'New': 'FFDBEAFE', 'Contacted': 'FFCFFAFE', 'Inquiry': 'FFE0E7FF',
      'Follow Up': 'FFFEF9C3', 'Interested': 'FFD1FAE5', 'Not Interested': 'FFFEE2E2',
      'Admitted': 'FFBBF7D0', 'Closed': 'FFF3F4F6', 'DNC': 'FFFFE4E6',
      'Converted': 'FFCCFBF1', 'Pending': 'FFFEF3C7', 'Callback': 'FFFFEDD5',
      'Visited': 'FFE0F2FE', 'On Hold': 'FFF1F5F9', 'Lost': 'FFFEE2E2',
      'Hot Lead': 'FFFFE4E6', 'Warm Lead': 'FFFFEDD5', 'Cold Lead': 'FFDBEAFE',
      'Enrolled': 'FFDCFCE7', 'Dropped': 'FFE4E4E7', 'Archived': 'FFF5F5F4',
    };
    const statusExcelFont: Record<string, string> = {
      'New': 'FF1D4ED8', 'Contacted': 'FF0E7490', 'Inquiry': 'FF3730A3',
      'Follow Up': 'FFA16207', 'Interested': 'FF047857', 'Not Interested': 'FFB91C1C',
      'Admitted': 'FF166534', 'Closed': 'FF4B5563', 'DNC': 'FFBE123C',
      'Converted': 'FF0F766E', 'Pending': 'FFB45309', 'Callback': 'FFC2410C',
      'Visited': 'FF0369A1', 'On Hold': 'FF475569', 'Lost': 'FFB91C1C',
      'Hot Lead': 'FFBE123C', 'Warm Lead': 'FFC2410C', 'Cold Lead': 'FF1D4ED8',
      'Enrolled': 'FF15803D', 'Dropped': 'FF52525B', 'Archived': 'FF57534E',
    };

    const thinBorder = (color: string): ExcelJS.Border => ({ style: 'thin', color: { argb: color } });
    const allBorders = (c: string) => ({ top: thinBorder(c), bottom: thinBorder(c), left: thinBorder(c), right: thinBorder(c) });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIT Manager';
    wb.created = new Date();
    const ws = wb.addWorksheet('Inquiry Report', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    const colCount = 15;
    const courseName = courses.find(c => String(c.id) === courseId)?.name || '';
    const filterDesc = [
      `Period: ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`,
      courseId ? `Course: ${courseName}` : '',
      batchType ? `Batch Type: ${batchType}` : '',
      inquiryType ? `Inquiry Type: ${inquiryType}` : '',
      inquiryFrom ? `Inquiry From: ${inquiryFrom}` : '',
      `Total Records: ${total}`,
    ].filter(Boolean).join('  |  ');

    /* ====================== ROW 1: Title ====================== */
    ws.mergeCells(1, 1, 1, colCount);
    const titleRow = ws.getRow(1);
    titleRow.height = 36;
    const titleCell = ws.getCell('A1');
    titleCell.value = `Suvidya Institute of Technology — Inquiry Report${courseName ? ' — ' + courseName : ''}`;
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
      'Sr No', 'Name', 'Mobile', 'Email', 'Course', 'Batch', 'Batch Category',
      'Inquiry Date', 'Inquiry Type', 'Inquiry From', 'Status', 'Qualification',
      'Discipline', 'Percentage', 'Discussion',
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
        r.srNo, r.Student_Name, r.Present_Mobile, r.Email, r.Course_Name,
        r.Batch_code, r.Batch_Category, fmtDate(r.Inquiry_Dt), r.Inquiry_Type,
        r.Inquiry_From, r.Status, r.Qualification, r.Discipline, r.Percentage,
        r.Discussion || '',
      ];

      vals.forEach((v, ci) => {
        const cell = exRow.getCell(ci + 1);
        cell.value = v;
        cell.border = allBorders('FFE5E7EB');

        if (ci === 10) {
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
        } else if (ci === 14) {
          /* Discussion — wrap text */
          cell.font = { size: 9, color: { argb: 'FF4B5563' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stripeBg } };
          cell.alignment = { vertical: 'middle', wrapText: true };
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
      { width: 28 },  // Name
      { width: 16 },  // Mobile
      { width: 30 },  // Email
      { width: 30 },  // Course
      { width: 15 },  // Batch
      { width: 18 },  // Batch Category
      { width: 16 },  // Inquiry Date
      { width: 16 },  // Inquiry Type
      { width: 16 },  // Inquiry From
      { width: 18 },  // Status
      { width: 16 },  // Qualification
      { width: 16 },  // Discipline
      { width: 12 },  // Percentage
      { width: 35 },  // Discussion
    ];

    /* ====================== Auto-filter on header row ====================== */
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: colCount } };

    /* ====================== Generate & Download ====================== */
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Inquiry_Report_${dateFrom}_to_${dateTo}.xlsx`);
  }, [rows, dateFrom, dateTo, courseId, courses, batchType, inquiryType, inquiryFrom, total, statusSummary]);

  /* ---- Print ---- */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E3093]">Inquiry Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">Generate and export inquiry data reports</p>
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
            {(canExport !== false) && (
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
        {/* Quick date presets */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs font-medium text-gray-500 mr-1">Quick Range:</span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setDateFrom(p.from()); setDateTo(p.to()); }}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                dateFrom === p.from() && dateTo === p.to()
                  ? 'bg-[#2E3093] text-white border-[#2E3093]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#2A6BB5] hover:text-[#2A6BB5]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Main filter row — dates + search */}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">From Date<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-sm !max-w-[170px]"
              required
            />
          </div>
          <div>
            <label className="label">To Date<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-sm !max-w-[170px]"
              required
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={!dateFrom || !dateTo || loading}
            className="btn-primary text-xs h-10 px-6"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Searching…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Search
              </span>
            )}
          </button>

          {searched && rows.length > 0 && (
            <button onClick={exportExcel} className="btn-secondary text-xs h-10 px-4 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export to Excel
            </button>
          )}

          {/* Advance filters toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`text-xs h-10 px-4 rounded-lg border transition-all flex items-center gap-1.5 ${
              showAdvanced || activeFilters > 0
                ? 'bg-[#2A6BB5]/10 border-[#2A6BB5]/30 text-[#2A6BB5]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filters
            {activeFilters > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-[#2E3093] text-white text-[10px] flex items-center justify-center">{activeFilters}</span>
            )}
            <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {activeFilters > 0 && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2">
              Clear filters
            </button>
          )}
        </div>

        {/* Advanced filters (collapsible) */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3 animate-in">
            <div>
              <label className="label">Course</label>
              <select
                value={courseId}
                onChange={(e) => { setCourseId(e.target.value); setBatchId(''); }}
                className="input-sm !max-w-full"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Batch Type</label>
              <select
                value={batchType}
                onChange={(e) => { setBatchType(e.target.value); setBatchId(''); }}
                className="input-sm !max-w-full"
              >
                <option value="">All Types</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Batch</label>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="input-sm !max-w-full"
                disabled={!batches.length}
              >
                <option value="">{batches.length ? 'All Batches' : 'Select course first'}</option>
                {batches.map((b) => (
                  <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_code}{b.Category ? ` (${b.Category})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Enquiry Type</label>
              <select
                value={inquiryType}
                onChange={(e) => setInquiryType(e.target.value)}
                className="input-sm !max-w-full"
              >
                <option value="">All Types</option>
                {inquiryTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Inquiry From</label>
              <select
                value={inquiryFrom}
                onChange={(e) => setInquiryFrom(e.target.value)}
                className="input-sm !max-w-full"
              >
                <option value="">All Sources</option>
                {inquiryModes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Active filter tags */}
        {activeFilters > 0 && !showAdvanced && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {courseId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] border border-blue-100">
                Course: {courses.find(c => String(c.id) === courseId)?.name}
                <button onClick={() => setCourseId('')} className="hover:text-blue-900">×</button>
              </span>
            )}
            {batchType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[11px] border border-purple-100">
                Batch Type: {batchType}
                <button onClick={() => setBatchType('')} className="hover:text-purple-900">×</button>
              </span>
            )}
            {batchId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[11px] border border-teal-100">
                Batch: {batches.find(b => String(b.Batch_Id) === batchId)?.Batch_code || batchId}
                <button onClick={() => setBatchId('')} className="hover:text-teal-900">×</button>
              </span>
            )}
            {inquiryType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] border border-amber-100">
                Type: {inquiryType}
                <button onClick={() => setInquiryType('')} className="hover:text-amber-900">×</button>
              </span>
            )}
            {inquiryFrom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-[11px] border border-green-100">
                From: {inquiryFrom}
                <button onClick={() => setInquiryFrom('')} className="hover:text-green-900">×</button>
              </span>
            )}
          </div>
        )}
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
              <p className="text-xs mt-0.5 text-red-500">Try adjusting your date range or filters.</p>
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
      <div ref={printRef} id="inquiry-report-print" className="report-print-area">
        {/* Only shown in print */}
        <div className="report-header hidden print:block">
          <div className="report-header-inner">
            <div className="report-logo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sit.png" alt="SIT Logo" className="report-logo" />
            </div>
            <div className="report-title-block">
              <h1 className="report-title">Suvidya Institute of Technology</h1>
              <h2 className="report-subtitle">Inquiry Report{courseId ? ` — ${courses.find(c => String(c.id) === courseId)?.name || ''}` : ''}</h2>
              <p className="report-period">
                Period: {fmtDate(dateFrom)} to {fmtDate(dateTo)}
                {courseId ? ` | Course: ${courses.find(c => String(c.id) === courseId)?.name || ''}` : ''}
                {batchType ? ` | Batch Type: ${batchType}` : ''}
                {inquiryType ? ` | Enquiry Type: ${inquiryType}` : ''}
                {inquiryFrom ? ` | Inquiry From: ${inquiryFrom}` : ''}
              </p>
              <p className="report-meta">
                Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} | Total Records: {total}
              </p>
            </div>
          </div>
          <div className="report-header-line" />
        </div>

        {/* Data Table (visible on screen + print) */}
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
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Inquiry Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Type</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">From</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-[#1a5a9e] whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Discussion</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const clr = STATUS_COLORS[r.Status] || DEFAULT_COLOR;
                    return (
                      <tr
                        key={r.Student_Id}
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
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">{fmtDate(r.Inquiry_Dt)}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">{r.Inquiry_Type}</td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-100 whitespace-nowrap">{r.Inquiry_From}</td>
                        <td className="px-3 py-2 border-r border-gray-100">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${clr.bg} ${clr.text} ${clr.border}`}>
                            {r.Status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={r.Discussion}>
                          {r.Discussion}
                        </td>
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
          <h3 className="text-sm font-semibold text-gray-500 mb-1">Generate Inquiry Report</h3>
          <p className="text-xs text-gray-400">Select filters above and click Search to generate the report</p>
        </div>
      )}
    </div>
  );
}
