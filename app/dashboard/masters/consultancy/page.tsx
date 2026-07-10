'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Consultancy {
  Const_Id: number;
  Comp_Name: string;
  Company_Type?: string | null;
  Contact_Person: string | null;
  Designation: string | null;
  Address: string | null;
  City: string | null;
  State?: string | null;
  Pin?: string | null;
  Tel: string | null;
  Fax?: string | null;
  Mobile?: string | null;
  EMail: string | null;
  Date_Added?: string | null;
  Industry?: string | null;
  Remark?: string | null;
  Country?: string | null;
  Purpose?: string | null;
  Website?: string | null;
  Company_Status?: string | null;
  Course_Id1?: number | string | null;
  Course_Id2?: number | string | null;
  Course_Id3?: number | string | null;
  Course_Id4?: number | string | null;
  Course_Id5?: number | string | null;
  Course_Id6?: number | string | null;
  IsActive?: number | string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CourseOption {
  Course_Id: number;
  Course_Name: string;
}

interface Filters {
  companyTypes: string[];
  cities: string[];
  industries: string[];
}

export default function ConsultancyPage() {
  const router = useRouter();
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('consultancy');

  const [rows, setRows] = useState<Consultancy[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState('');
  const [filters, setFilters] = useState<Filters>({ companyTypes: [], cities: [], industries: [] });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const [showCourseExport, setShowCourseExport] = useState(false);
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [exportCourseId, setExportCourseId] = useState('');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [viewRow, setViewRow] = useState<Consultancy | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (companyType) params.set('companyType', companyType);
      if (city) params.set('city', city);
      if (industry) params.set('industry', industry);
      const res = await fetch(`/api/masters/consultancy?${params.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
      setFilters(data.filters ?? { companyTypes: [], cities: [], industries: [] });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, companyType, city, industry, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!showCourseExport || courseOptions.length > 0) return;
    let isCancelled = false;

    (async () => {
      try {
        const allCourses: CourseOption[] = [];
        let nextPage = 1;
        let totalPages = 1;

        while (nextPage <= totalPages) {
          const res = await fetch(`/api/masters/course?page=${nextPage}&limit=100`);
          const data = await res.json();
          const rows = Array.isArray(data?.rows) ? data.rows : [];
          allCourses.push(...rows);
          totalPages = Number(data?.pagination?.totalPages) || 1;
          nextPage += 1;
        }

        if (!isCancelled) {
          const unique = new Map<number, CourseOption>();
          allCourses.forEach((c) => {
            if (c?.Course_Id != null && !unique.has(c.Course_Id)) unique.set(c.Course_Id, c);
          });
          setCourseOptions(Array.from(unique.values()));
        }
      } catch {
        if (!isCancelled) setCourseOptions([]);
      }
    })();

    return () => { isCancelled = true; };
  }, [showCourseExport, courseOptions.length]);

  const handleCourseExport = async () => {
    setExportError('');
    if (!exportCourseId) { setExportError('Please select a training course.'); return; }
    if (!exportDateFrom || !exportDateTo) { setExportError('Please select both From and To dates.'); return; }
    if (exportDateFrom > exportDateTo) { setExportError('From date cannot be after To date.'); return; }
    setExportBusy(true);
    try {
      const qs = new URLSearchParams({ courseId: exportCourseId, dateFrom: exportDateFrom, dateTo: exportDateTo });
      const res = await fetch(`/api/masters/consultancy/export-by-course?${qs.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to generate report');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const course = exportCourseId === 'all'
        ? 'All_Training_Programmes'
        : (courseOptions.find(c => String(c.Course_Id) === exportCourseId)?.Course_Name || 'course');
      a.download = `Consultancy_${course.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40)}_${exportDateFrom}_to_${exportDateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setShowCourseExport(false);
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setExportBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this consultancy?')) return;
    try {
      const res = await fetch(`/api/masters/consultancy?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleExport = () => {
    const headers = ['Consultancy Name', 'Company Type', 'CName', 'Designation', 'Address', 'City', 'Telephone', 'Email'];
    const csvRows = rows.map(r => [r.Comp_Name || '', r.Company_Type || '', r.Contact_Person || '', r.Designation || '', r.Address || '', r.City || '', r.Tel || '', r.EMail || '']);
    const csv = [headers.join(','), ...csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'consultancy_list.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB');
  };

  const viewValue = (value: string | number | null | undefined) => {
    if (value == null) return '-';
    const text = String(value).trim();
    return text ? text : '-';
  };

  const courseLabel = (value: string | number | null | undefined) => {
    if (value == null || String(value).trim() === '') return '-';
    const course = courseOptions.find((item) => String(item.Course_Id) === String(value));
    return course ? course.Course_Name : String(value);
  };

  const handleView = async (row: Consultancy) => {
    setViewLoading(true);
    setViewError('');
    setViewRow(row);
    try {
      const res = await fetch(`/api/masters/consultancy/${row.Const_Id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load consultancy details');
      setViewRow(data.row ?? row);
    } catch (error: unknown) {
      setViewError(error instanceof Error ? error.message : 'Failed to load consultancy details');
    } finally {
      setViewLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { setPage(1); setFetchTrigger(t => t + 1); }
  };

  const handleApplyFilters = () => {
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCompanyType('');
    setCity('');
    setIndustry('');
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view consultancies." />;

  return (
    <div className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Consultancy Master</h2>
            <p className="text-[11px] text-white/60 mt-0.5">Search, filter and export placement consultancy partners (A–Z)</p>
          </div>
          {canCreate && (
            <button
              onClick={() => router.push('/dashboard/masters/consultancy/add')}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-1 rounded">{pagination.total} total</span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showFilters ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
            Filters
          </button>
          <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            Export
          </button>
          <button
            onClick={() => { setShowCourseExport(true); setExportError(''); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
            Export by Course
          </button>
          <div className="flex-1" />
          <div className="relative">
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input ref={searchRef} type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown}
              className="w-52 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400" />
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-5 pb-4 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company Type</label>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="min-w-[140px] px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]"
                >
                  <option value="">All types</option>
                  {filters.companyTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="min-w-[140px] px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]"
                >
                  <option value="">All cities</option>
                  {filters.cities.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="min-w-[160px] px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]"
                >
                  <option value="">All industries</option>
                  {filters.industries.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <button
                onClick={handleApplyFilters}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#2E3093] text-white hover:bg-[#252880]"
              >
                Apply
              </button>
              <button
                onClick={handleClearFilters}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="shrink-0 px-5 py-3 border-b border-slate-100 bg-[#f8fafc]">
          <h3 className="text-xs font-bold text-slate-700">List of Consultancies</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Sorted alphabetically by consultancy name</p>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">Consultancy Name</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">Company Type</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">CName</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">Designation</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">Address</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">City</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">Telephone</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap border-r border-slate-200">Email</th>
                <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                  <div className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />Loading…</div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-xs text-slate-400">No records found</td></tr>
              ) : rows.map(row => (
                <tr key={row.Const_Id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100 font-medium text-slate-900 truncate max-w-[180px]" title={row.Comp_Name || ''}>{row.Comp_Name || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100">{row.Company_Type || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100 truncate max-w-[130px]">{row.Contact_Person || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100 truncate max-w-[100px]">{row.Designation || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100 truncate max-w-[160px]" title={row.Address || ''}>{row.Address || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100">{row.City || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100 font-mono">{row.Tel || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-r border-slate-100 truncate max-w-[150px]" title={row.EMail || ''}>{row.EMail || '-'}</td>
                  <td className="py-2 px-3 text-xs border-b border-slate-100 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button onClick={() => handleView(row)}
                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-sky-50 text-sky-600 text-[11px] font-semibold hover:bg-sky-100">
                        View
                      </button>
                      {canUpdate && (
                        <button onClick={() => router.push(`/dashboard/masters/consultancy/edit/${row.Const_Id}`)}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/20">
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(row.Const_Id)}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-[11px] font-semibold hover:bg-red-100">
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {/* Export by Training Programme Modal */}
          {showCourseExport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-t-xl">
                  <h3 className="text-sm font-bold text-white">Export Consultancies by Training Programme</h3>
                  <button
                    onClick={() => setShowCourseExport(false)}
                    className="text-white/80 hover:text-white"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Training Course</label>
                    <select
                      value={exportCourseId}
                      onChange={(e) => setExportCourseId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                    >
                      <option value="">-- Select Training Programme --</option>
                      <option value="all">All Training Programmes</option>
                      {courseOptions.map(c => (
                        <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Date From</label>
                      <input
                        type="date"
                        value={exportDateFrom}
                        onChange={(e) => setExportDateFrom(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Date To</label>
                      <input
                        type="date"
                        value={exportDateTo}
                        onChange={(e) => setExportDateTo(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      />
                    </div>
                  </div>
                  {exportError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{exportError}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    Excel columns: Created Date, Company Name, Contact Person, Designation, Company Address, Contact Number, Email Id.
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
                  <button
                    onClick={() => setShowCourseExport(false)}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100"
                    disabled={exportBusy}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCourseExport}
                    disabled={exportBusy}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {exportBusy ? 'Generating…' : 'Download Excel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {viewRow && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-[#2E3093] to-[#2A6BB5]">
                  <div>
                    <h3 className="text-sm font-bold text-white">Consultancy Details</h3>
                    <p className="text-[11px] text-white/80">Read-only view of the consultancy master record</p>
                  </div>
                  <button
                    onClick={() => { setViewRow(null); setViewError(''); }}
                    className="text-white/80 hover:text-white"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="max-h-[calc(90vh-64px)] overflow-y-auto p-5 space-y-5">
                  {viewLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      Loading consultancy details...
                    </div>
                  )}
                  {viewError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{viewError}</div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b">
                        <h4 className="text-sm font-semibold text-[#2E3093]">Company Information</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Consultancy</span><span className="text-gray-900">{viewValue(viewRow.Comp_Name)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Company Type</span><span className="text-gray-900">{viewValue(viewRow.Company_Type)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Contact Person</span><span className="text-gray-900">{viewValue(viewRow.Contact_Person)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Designation</span><span className="text-gray-900">{viewValue(viewRow.Designation)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Date Added</span><span className="text-gray-900">{formatDate(viewRow.Date_Added)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Industry</span><span className="text-gray-900">{viewValue(viewRow.Industry)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Purpose</span><span className="text-gray-900">{viewValue(viewRow.Purpose)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Status</span><span className="text-gray-900">{viewValue(viewRow.Company_Status)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Country</span><span className="text-gray-900">{viewValue(viewRow.Country)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Active</span><span className="text-gray-900">{String(viewRow.IsActive) === '1' ? 'Yes' : String(viewRow.IsActive) === '0' ? 'No' : viewValue(viewRow.IsActive)}</span></div>
                        <div className="md:col-span-2"><span className="block text-[11px] font-semibold text-gray-500 mb-1">Company Business</span><span className="text-gray-900 whitespace-pre-wrap">{viewValue(viewRow.Remark)}</span></div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b">
                        <h4 className="text-sm font-semibold text-[#2E3093]">Contact Details</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
                        <div className="md:col-span-2"><span className="block text-[11px] font-semibold text-gray-500 mb-1">Address</span><span className="text-gray-900 whitespace-pre-wrap">{viewValue(viewRow.Address)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">City</span><span className="text-gray-900">{viewValue(viewRow.City)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">State</span><span className="text-gray-900">{viewValue(viewRow.State)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Pin Code</span><span className="text-gray-900">{viewValue(viewRow.Pin)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Telephone</span><span className="text-gray-900">{viewValue(viewRow.Tel)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Mobile</span><span className="text-gray-900">{viewValue(viewRow.Mobile)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Fax</span><span className="text-gray-900">{viewValue(viewRow.Fax)}</span></div>
                        <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Email</span><span className="text-gray-900 break-all">{viewValue(viewRow.EMail)}</span></div>
                        <div className="md:col-span-2"><span className="block text-[11px] font-semibold text-gray-500 mb-1">Website</span><span className="text-gray-900 break-all">{viewValue(viewRow.Website)}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b">
                      <h4 className="text-sm font-semibold text-[#2E3093]">Assigned Courses</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3 p-4 text-sm">
                      <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Course 1</span><span className="text-gray-900">{courseLabel(viewRow.Course_Id1)}</span></div>
                      <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Course 2</span><span className="text-gray-900">{courseLabel(viewRow.Course_Id2)}</span></div>
                      <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Course 3</span><span className="text-gray-900">{courseLabel(viewRow.Course_Id3)}</span></div>
                      <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Course 4</span><span className="text-gray-900">{courseLabel(viewRow.Course_Id4)}</span></div>
                      <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Course 5</span><span className="text-gray-900">{courseLabel(viewRow.Course_Id5)}</span></div>
                      <div><span className="block text-[11px] font-semibold text-gray-500 mb-1">Course 6</span><span className="text-gray-900">{courseLabel(viewRow.Course_Id6)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

