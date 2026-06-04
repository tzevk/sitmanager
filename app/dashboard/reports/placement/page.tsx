'use client';

import { useState, useEffect, useCallback } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/* ──────────────────────────────── Types ─────────────────────────── */
interface Course      { id: number; name: string }
interface Batch       { id: number; name: string }
interface Discipline  { id: number; name: string }

interface PlacementRow {
  Student_Id: number;
  Student_Code: string | null;
  Student_Name: string;
  Present_Mobile: string | null;
  Email: string | null;
  Qualification: string | null;
  Discipline_Name: string | null;
  Course_Name: string | null;
  Batch_code: string | null;
  Batch_Start: string | null;
  Batch_End: string | null;
  SIT_Performance: string | null;
  Placement_Remark: string | null;
  Company: string | null;
  Designation: string | null;
  BussinessNature: string | null;
  Duration: string | null;
}

type PeriodMode = '' | 'range' | 'month' | 'year';

/* ──────────────────────────────── Helpers ───────────────────────── */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return s;
  return `${day}/${m}/${y}`;
}

const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 ' +
  'hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 ' +
  'focus:border-[#2E3093] transition-colors';

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

/* ──────────────────────────────── Page ─────────────────────────── */
export default function PlacementReportPage() {
  const { canView, canExport, loading: permLoading } = useResourcePermissions('report_placement');
  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the placement report." />;
  return <PlacementReportContent canExport={canExport} />;
}

/* ──────────────────────────────── Content ───────────────────────── */
function PlacementReportContent({ canExport }: { canExport: boolean }) {
  /* ── Filter state ── */
  const [courseId,     setCourseId]     = useState('');
  const [batchId,      setBatchId]      = useState('');
  const [year,         setYear]         = useState('');
  const [periodMode,   setPeriodMode]   = useState<PeriodMode>('');
  const [fromDate,     setFromDate]     = useState('');
  const [toDate,       setToDate]       = useState('');
  const [month,        setMonth]        = useState('');
  const [qualification, setQualification] = useState('');
  const [discipline,   setDiscipline]   = useState('');

  /* ── Dropdown data ── */
  const [courses,        setCourses]        = useState<Course[]>([]);
  const [batches,        setBatches]        = useState<Batch[]>([]);
  const [years,          setYears]          = useState<number[]>([]);
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [disciplines,    setDisciplines]    = useState<Discipline[]>([]);

  /* ── Report state ── */
  const [rows,       setRows]       = useState<PlacementRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [notice,     setNotice]     = useState('');
  const [triggered,  setTriggered]  = useState(false);
  const [exporting,  setExporting]  = useState(false);

  /* ── Load static dropdowns on mount ── */
  useEffect(() => {
    (async () => {
      const [cRes, yRes, qRes, dRes] = await Promise.all([
        fetch('/api/reports/placement?options=courses'),
        fetch('/api/reports/placement?options=years'),
        fetch('/api/reports/placement?options=qualifications'),
        fetch('/api/reports/placement?options=disciplines'),
      ]);
      const [cd, yd, qd, dd] = await Promise.all([cRes.json(), yRes.json(), qRes.json(), dRes.json()]);
      setCourses(cd.courses ?? []);
      setYears(yd.years ?? []);
      setQualifications(qd.qualifications ?? []);
      setDisciplines(dd.disciplines ?? []);
    })();
  }, []);

  /* ── Load batches when course changes ── */
  useEffect(() => {
    setBatchId('');
    setBatches([]);
    if (!courseId) return;
    (async () => {
      const res = await fetch(`/api/reports/placement?options=batches&courseId=${courseId}`);
      const data = await res.json();
      setBatches(data.batches ?? []);
    })();
  }, [courseId]);

  /* ── Fetch report data ── */
  const fetchReport = useCallback(async () => {
    if (periodMode === 'range') {
      if (!fromDate || !toDate) {
        setError('Select both From Date and To Date for Date Range.');
        return;
      }
      if (fromDate > toDate) {
        setError('From Date cannot be after To Date.');
        return;
      }
    }
    if (periodMode === 'month' && (!month || !year)) {
      setError('Select both Month and Year for Monthly filter.');
      return;
    }
    if (periodMode === 'year' && !year) {
      setError('Select Year for Annual filter.');
      return;
    }

    setError('');
    setNotice('');
    setLoading(true);
    setTriggered(true);
    try {
      const params = new URLSearchParams();
      if (courseId)     params.set('courseId',     courseId);
      if (batchId)      params.set('batchId',      batchId);
      if (qualification) params.set('qualification', qualification);
      if (discipline)   params.set('discipline',   discipline);
      if (periodMode)   params.set('periodMode',   periodMode);
      if (periodMode === 'range') {
        params.set('fromDate', fromDate);
        params.set('toDate', toDate);
      }
      if (periodMode === 'month') {
        params.set('month', month);
        params.set('year', year);
      }
      if (periodMode === 'year') {
        params.set('year', year);
      }

      const res  = await fetch(`/api/reports/placement?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch report');
      setRows(data.rows ?? []);
      setNotice(data?.truncated && data?.message ? String(data.message) : '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [courseId, batchId, year, qualification, discipline, periodMode, fromDate, toDate, month]);

  /* ── Excel export ── */
  const handleExport = useCallback(async () => {
    if (!rows.length) return;
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Placement Report');

      const headers = [
        'Sr No', 'Student Code', 'Student Name', 'Mobile', 'Email',
        'Qualification', 'Discipline', 'Course', 'Batch',
        'Batch Start', 'Batch End',
        'Company', 'Designation', 'Business Nature', 'Duration',
        'SIT Performance (%)', 'Placement Remark',
      ];

      ws.addRow(headers);

      // Header style
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 18;

      rows.forEach((r, i) => {
        ws.addRow([
          i + 1,
          r.Student_Code ?? '',
          r.Student_Name,
          r.Present_Mobile ?? '',
          r.Email ?? '',
          r.Qualification ?? '',
          r.Discipline_Name ?? '',
          r.Course_Name ?? '',
          r.Batch_code ?? '',
          fmtDate(r.Batch_Start),
          fmtDate(r.Batch_End),
          r.Company ?? '',
          r.Designation ?? '',
          r.BussinessNature ?? '',
          r.Duration ?? '',
          r.SIT_Performance ?? '',
          r.Placement_Remark ?? '',
        ]);
      });

      // Auto-fit columns
      ws.columns.forEach((col) => {
        let maxLen = 10;
        col.eachCell?.({ includeEmpty: true }, (cell) => {
          const len = cell.value ? String(cell.value).length : 0;
          if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(maxLen + 2, 40);
      });

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `placement-report-${Date.now()}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [rows]);

  /* ── Render ── */
  return (
    <div className="p-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#2E3093]">Student Placement Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Filters are optional. You can also apply Date Range, Monthly, or Annual period filters.
          </p>
        </div>
        {canExport && triggered && rows.length > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60
                       text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
          >
            {exporting ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            )}
            {exporting ? 'Exporting…' : 'Download Excel'}
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Training Programme */}
          <div>
            <label className={labelCls}>Training Programme</label>
            <select className={selectCls} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Batch */}
          <div>
            <label className={labelCls}>Batch</label>
            <select className={selectCls} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Annual Year */}
          <div>
            <label className={labelCls}>Year</label>
            <select className={selectCls} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div>
            <label className={labelCls}>Period Filter</label>
            <select className={selectCls} value={periodMode} onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}>
              <option value="">None</option>
              <option value="range">Date Range</option>
              <option value="month">Monthly</option>
              <option value="year">Annual</option>
            </select>
          </div>

          {/* Qualification */}
          <div>
            <label className={labelCls}>Qualification</label>
            <select className={selectCls} value={qualification} onChange={(e) => setQualification(e.target.value)}>
              <option value="">All Qualifications</option>
              {qualifications.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          {/* Discipline */}
          <div>
            <label className={labelCls}>Discipline</label>
            <select className={selectCls} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              <option value="">All Disciplines</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {periodMode === 'range' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className={labelCls}>From Date</label>
              <input type="date" className={selectCls} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>To Date</label>
              <input type="date" className={selectCls} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        )}

        {periodMode === 'month' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className={labelCls}>Month</label>
              <select className={selectCls} value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">Select Month</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Year</label>
              <select className={selectCls} value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Select Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {periodMode === 'year' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className={labelCls}>Year</label>
              <select className={selectCls} value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Select Year</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="bg-[#2E3093] hover:bg-[#2A6BB5] disabled:opacity-60 text-white
                       text-xs font-semibold px-4 py-1.5 rounded-md transition-colors"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {triggered && (
            <button
              onClick={() => {
                setCourseId(''); setBatchId(''); setYear('');
                setPeriodMode(''); setFromDate(''); setToDate(''); setMonth('');
                setQualification(''); setDiscipline('');
                setRows([]); setTriggered(false); setError(''); setNotice('');
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {notice && !error && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md px-3 py-2">
          {notice}
        </div>
      )}

      {/* ── Results ── */}
      {triggered && !loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {/* Table toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2E3093] bg-[#2E3093]/8 rounded-full px-2.5 py-0.5">
                {rows.length} record{rows.length !== 1 ? 's' : ''}
              </span>
              {rows.length > 0 && (
                <>
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-green-700 font-medium">
                    {rows.filter(r => r.Company).length} placed
                  </span>
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-gray-500">
                    {rows.filter(r => !r.Company).length} not placed
                  </span>
                </>
              )}
            </div>
          </div>

          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1100px]">
                <thead>
                  <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-3 px-3 text-center w-10">#</th>
                    <th className="py-3 px-3 text-left w-24">Code</th>
                    <th className="py-3 px-3 text-left">Student Name</th>
                    <th className="py-3 px-3 text-left w-28">Mobile</th>
                    <th className="py-3 px-3 text-left w-28">Qualification</th>
                    <th className="py-3 px-3 text-left w-24">Discipline</th>
                    <th className="py-3 px-3 text-left">Course</th>
                    <th className="py-3 px-3 text-left w-28">Batch</th>
                    <th className="py-3 px-3 text-center w-24">Status</th>
                    <th className="py-3 px-3 text-left">Company</th>
                    <th className="py-3 px-3 text-left w-28">Designation</th>
                    <th className="py-3 px-3 text-left w-24">Duration</th>
                    <th className="py-3 px-3 text-center w-16">SIT %</th>
                    <th className="py-3 px-3 text-left w-32">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r, i) => {
                    const isPlaced = !!r.Company;
                    const sitPct = r.SIT_Performance && r.SIT_Performance !== '0.00' && r.SIT_Performance !== 'NULL'
                      ? parseFloat(r.SIT_Performance)
                      : null;
                    return (
                      <tr key={r.Student_Id} className={`transition-colors hover:bg-blue-50/20 ${isPlaced ? '' : 'bg-gray-50/40'}`}>
                        <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                            {r.Student_Code ?? '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-800">{r.Student_Name}</td>
                        <td className="py-2.5 px-3 text-gray-600">{r.Present_Mobile ?? '—'}</td>
                        <td className="py-2.5 px-3 text-gray-600">{r.Qualification ?? '—'}</td>
                        <td className="py-2.5 px-3">
                          {r.Discipline_Name ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700">
                              {r.Discipline_Name}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-gray-700 text-[11px]">{r.Course_Name ?? '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-[#2E3093] text-[11px]">{r.Batch_code ?? '—'}</span>
                          {r.Batch_Start && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {fmtDate(r.Batch_Start)}{r.Batch_End ? ` – ${fmtDate(r.Batch_End)}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isPlaced
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPlaced ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {isPlaced ? 'Placed' : 'Not Placed'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {r.Company ? (
                            <div>
                              <span className="font-medium text-gray-800">{r.Company}</span>
                              {r.BussinessNature && (
                                <div className="text-[10px] text-gray-400 mt-0.5">{r.BussinessNature}</div>
                              )}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">{r.Designation ?? '—'}</td>
                        <td className="py-2.5 px-3 text-gray-600">{r.Duration ?? '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          {sitPct !== null ? (
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              sitPct >= 75 ? 'bg-green-50 text-green-700'
                              : sitPct >= 50 ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-600'
                            }`}>
                              {r.SIT_Performance}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 max-w-[130px]">
                          <span className="block truncate" title={r.Placement_Remark ?? ''}>
                            {r.Placement_Remark && r.Placement_Remark !== 'NULL'
                              ? r.Placement_Remark
                              : <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No placement records match the selected filters.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
