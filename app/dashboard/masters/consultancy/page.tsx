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
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Dashboard</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span>Placement</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-[#2E3093] font-medium">Consultancy Master</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">View Consultancy</h1>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/dashboard/masters/consultancy/add')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold rounded-lg shadow hover:shadow-md transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add +
          </button>
        )}
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-white tracking-wide">List Of Consultancy</h3>
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
            <button
              onClick={() => { setShowCourseExport(true); setExportError(''); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
              Export by Course
            </button>
            <div className="flex-1" />
            <div className="relative">
              <input ref={searchRef} type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown}
                className="w-48 pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Company Type</label>
                  <select
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    className="min-w-[140px] px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">All types</option>
                    {filters.companyTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="min-w-[140px] px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">All cities</option>
                    {filters.cities.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="min-w-[160px] px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">All industries</option>
                    {filters.industries.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleApplyFilters}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2E3093] text-white hover:bg-[#252880]"
                >
                  Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-full">
              <table className="dashboard-table w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10">
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Consultancy Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Company Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">CName</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Designation</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Address</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">City</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Telephone</th>
                    <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Email</th>
                    <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />Loading...</div>
                    </td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No records found</td></tr>
                  ) : rows.map(row => (
                    <tr key={row.Const_Id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 text-gray-900 font-medium truncate max-w-[180px]" title={row.Comp_Name || ''}>{row.Comp_Name || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{row.Company_Type || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[130px]">{row.Contact_Person || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[100px]">{row.Designation || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[160px]" title={row.Address || ''}>{row.Address || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{row.City || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{row.Tel || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700 truncate max-w-[150px]" title={row.EMail || ''}>{row.EMail || '-'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleView(row)}
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="View">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" /><circle cx="12" cy="12" r="3" /></svg>
                          </button>
                          {canUpdate && (
                            <button onClick={() => router.push(`/dashboard/masters/consultancy/edit/${row.Const_Id}`)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(row.Const_Id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 flex-shrink-0">
              <span className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Prev</button>
                <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
