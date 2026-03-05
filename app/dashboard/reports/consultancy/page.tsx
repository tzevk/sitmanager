'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface ReportRow {
  Const_Id: number;
  Date_Added: string;
  Comp_Name: string;
  Contact_Person: string;
  Address: string;
  Country: string;
  Tel: string;
  EMail: string;
  Courses: string;
  City: string;
  Purpose: string;
}

interface Course { Course_Id: number; Course_Name: string; }

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ---- shared classes ---- */
const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';

export default function ConsultancyReportPage() {
  const { canView, loading: permLoading } = useResourcePermissions('consultancy_report');

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [courseId, setCourseId] = useState('');
  const [city, setCity] = useState('');
  const [purpose, setPurpose] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Dropdown options
  const [courses, setCourses] = useState<Course[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);

  // Extra filter state
  const [country, setCountry] = useState('');
  const [companyStatus, setCompanyStatus] = useState('');
  const [industry, setIndustry] = useState('');

  // Whether initial Go has been pressed
  const [triggered, setTriggered] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    if (!triggered) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (courseId) params.set('courseId', courseId);
      if (city) params.set('city', city);
      if (purpose) params.set('purpose', purpose);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (country) params.set('country', country);
      if (companyStatus) params.set('companyStatus', companyStatus);
      if (industry) params.set('industry', industry);

      const res = await fetch(`/api/reports/consultancy?${params.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
      if (data.courses) setCourses(data.courses);
      if (data.purposes) setPurposes(data.purposes);
      if (data.countries) setCountries(data.countries);
      if (data.statuses) setStatuses(data.statuses);
      if (data.industries) setIndustries(data.industries);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger, triggered]);

  // Fetch dropdown options on mount (lightweight)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/reports/consultancy?page=1&limit=1');
        const data = await res.json();
        if (data.courses) setCourses(data.courses);
        if (data.purposes) setPurposes(data.purposes);
        if (data.countries) setCountries(data.countries);
        if (data.statuses) setStatuses(data.statuses);
        if (data.industries) setIndustries(data.industries);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGo = () => {
    setTriggered(true);
    setPage(1);
    setFetchTrigger(t => t + 1);
  };

  const handleClear = () => {
    setCourseId('');
    setCity('');
    setPurpose('');
    setFromDate('');
    setToDate('');
    setCountry('');
    setCompanyStatus('');
    setIndustry('');
    setSearch('');
    setTriggered(false);
    setRows([]);
    setPagination({ page: 1, limit: 25, total: 0, totalPages: 0 });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { setPage(1); setTriggered(true); setFetchTrigger(t => t + 1); }
  };

  const handleExport = () => {
    const headers = ['Id', 'Created Date', 'Company Name', 'Contact Person Name', 'Address', 'Country', 'Contact No', 'Email', 'Courses'];
    const csvRows = rows.map(r => [
      r.Const_Id, r.Date_Added || '', r.Comp_Name || '', r.Contact_Person || '',
      r.Address || '', r.Country || '', r.Tel || '', r.EMail || '', r.Courses || '',
    ]);
    const csv = [headers.join(','), ...csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'consultancy_report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('report-table');
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Consultancy Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #2E3093; color: #fff; font-weight: 600; }
        tr:nth-child(even) { background: #f9f9f9; }
        h2 { color: #2E3093; margin-bottom: 10px; }
      </style></head><body>
      <h2>Consultancy Report</h2>
      ${printContent.outerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
  };

  // Pagination display
  const startRow = rows.length === 0 ? 0 : (page - 1) * pagination.limit + 1;
  const endRow = rows.length === 0 ? 0 : startRow + rows.length - 1;

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the Consultancy Report." />;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex flex-col">
      {/* Header */}
      <div className="mb-4 flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Dashboard</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span>Placement</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-[#2E3093] font-medium">Consultancy Report</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Consultancy Report</h1>
        </div>
      </div>

      {/* Filter Bar — single horizontal row */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-4 flex-shrink-0">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-[160px]">
            <label className={labelCls}>Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className={selectCls}>
              <option value="">Select Course</option>
              {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className={labelCls}>City</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" className={inputCls} />
          </div>
          <div className="min-w-[140px]">
            <label className={labelCls}>Purpose</label>
            <select value={purpose} onChange={e => setPurpose(e.target.value)} className={selectCls}>
              <option value="">Select Purpose</option>
              {purposes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className={labelCls}>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="dd/mm/yyyy" className={inputCls} />
          </div>
          <div className="min-w-[140px]">
            <label className={labelCls}>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="dd/mm/yyyy" className={inputCls} />
          </div>
          <button onClick={handleGo}
            className="px-5 py-1.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded-md shadow hover:shadow-md transition-all whitespace-nowrap">
            Go
          </button>
          <button onClick={handleClear}
            className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-md hover:bg-gray-50 transition-all whitespace-nowrap">
            Clear
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-white tracking-wide">Details</h3>
        </div>
        <div className="p-5 flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{pagination.total}</span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showFilters ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
              Filters
            </button>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              Export
            </button>
            <div className="flex-1" />
            <div className="relative">
              <input ref={searchRef} type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown}
                className="w-48 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            </div>
          </div>

          {/* Additional filters panel */}
          {showFilters && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[140px]">
                  <label className={labelCls}>Country</label>
                  <select value={country} onChange={e => setCountry(e.target.value)} className={selectCls}>
                    <option value="">All Countries</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="min-w-[130px]">
                  <label className={labelCls}>Company Status</label>
                  <select value={companyStatus} onChange={e => setCompanyStatus(e.target.value)} className={selectCls}>
                    <option value="">All Statuses</option>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="min-w-[160px]">
                  <label className={labelCls}>Industry</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)} className={selectCls}>
                    <option value="">All Industries</option>
                    {industries.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <button onClick={() => { setCountry(''); setCompanyStatus(''); setIndustry(''); setSearch(''); setPage(1); if (triggered) setFetchTrigger(t => t + 1); }}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100">Clear Extra Filters</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-full">
              <table id="report-table" className="dashboard-table w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10">
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Id</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Created Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Company Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Contact Person Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Address</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Country</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Contact_No</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Email</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Courses</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />Loading...</div>
                    </td></tr>
                  ) : !triggered ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Use the filters above and click <strong>Go</strong> to generate the report</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No rows</td></tr>
                  ) : rows.map(row => (
                    <tr key={row.Const_Id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 text-gray-700">{row.Const_Id}</td>
                      <td className="px-3 py-2.5 text-gray-700">{formatDate(row.Date_Added)}</td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium truncate max-w-[180px]" title={row.Comp_Name || ''}>{row.Comp_Name || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[160px]" title={row.Contact_Person || ''}>{row.Contact_Person || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[200px]" title={row.Address || ''}>{row.Address || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{row.Country || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[140px]" title={row.Tel || ''}>{row.Tel || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[160px]" title={row.EMail || ''}>{row.EMail || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[200px]" title={row.Courses || ''}>{row.Courses || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer: Pagination + Print / Close */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 flex-shrink-0">
            <span className="text-xs text-gray-500">{startRow}–{endRow} of {pagination.total}</span>
            <div className="flex items-center gap-3">
              {pagination.totalPages > 1 && (
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Prev</button>
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                    className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Next</button>
                </div>
              )}
              <button onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg shadow hover:shadow-md transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
                Print
              </button>
              <button onClick={() => window.history.back()}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
