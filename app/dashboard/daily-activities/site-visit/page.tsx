'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SiteVisit {
  Visit_Id: number;
  Course_Name: string | null;
  Batch_ID: number | null;
  Batch_Code: number | null;
  Region: string | null;
  Location: string | null;
  Total_Student: number | null;
  Visit_Fees: number | null;
  Visit_Date: string | null;
  Visit_Time: string | null;
  Bus_No: number | null;
  Head_Name: string | null;
  Confirm_Date: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Batch {
  Batch_Id: number;
  Batch_code: string;
  Category: string | null;
  Timings: string | null;
}

interface FormData {
  Course_Id: string;
  Batch_Id: string;
  Region: string;
  Location: string;
  Total_Student: string;
  Visit_Fees: string;
  Visit_Date: string;
  Visit_Time: string;
  Bus_No: string;
  Head_Name: string;
  Confirm_Date: string;
}

const emptyForm: FormData = {
  Course_Id: '',
  Batch_Id: '',
  Region: '',
  Location: '',
  Total_Student: '',
  Visit_Fees: '',
  Visit_Date: '',
  Visit_Time: '',
  Bus_No: '',
  Head_Name: '',
  Confirm_Date: '',
};

/* ------------------------------------------------------------------ */
/*  Page (Permission wrapper)                                          */
/* ------------------------------------------------------------------ */
export default function SiteVisitPage() {
  return (
    <PermissionGate resource="site_visit" deniedMessage="You do not have permission to view site visits.">
      {(perms) => <SiteVisitContent {...perms} />}
    </PermissionGate>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Content                                                       */
/* ------------------------------------------------------------------ */
function SiteVisitContent({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  /* ---- Table state ---- */
  const [rows, setRows] = useState<SiteVisit[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---- Filter state ---- */
  const [showFilters, setShowFilters] = useState(false);
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCourses, setFilterCourses] = useState<Course[]>([]);
  const [filterBatches, setFilterBatches] = useState<Batch[]>([]);

  /* ---- Form state ---- */
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formCourses, setFormCourses] = useState<Course[]>([]);
  const [formBatches, setFormBatches] = useState<Batch[]>([]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const isEdit = editId !== null;

  /* ================================================================ */
  /*  Load dropdown courses for form & filters                         */
  /* ================================================================ */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/daily-activities/site-visit?options=courses');
        const data = await res.json();
        setFormCourses(data.courses || []);
        setFilterCourses(data.courses || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* ---- Load form batches when course changes ---- */
  useEffect(() => {
    if (!form.Course_Id) { setFormBatches([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/site-visit?options=batches&courseId=${form.Course_Id}`);
        const data = await res.json();
        setFormBatches(data.batches || []);
      } catch {
        setFormBatches([]);
      }
    })();
  }, [form.Course_Id]);

  /* ---- Load filter batches when filter course changes ---- */
  useEffect(() => {
    if (!filterCourseId) { setFilterBatches([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/site-visit?options=batches&courseId=${filterCourseId}`);
        const data = await res.json();
        setFilterBatches(data.batches || []);
      } catch {
        setFilterBatches([]);
      }
    })();
  }, [filterCourseId]);

  /* ================================================================ */
  /*  Fetch table data                                                 */
  /* ================================================================ */
  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (filterCourseId) params.set('courseId', filterCourseId);
      if (filterBatchId) params.set('batchId', filterBatchId);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const res = await fetch(`/api/daily-activities/site-visit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [page, search, filterCourseId, filterBatchId, filterDateFrom, filterDateTo, fetchTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  /* ================================================================ */
  /*  Search / filter handlers                                         */
  /* ================================================================ */
  const handleSearch = () => {
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  const handleClear = () => {
    setSearch('');
    setFilterCourseId('');
    setFilterBatchId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  /* ================================================================ */
  /*  Delete handler                                                   */
  /* ================================================================ */
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this site visit record?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/daily-activities/site-visit?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setFetchTrigger((t) => t + 1);
    } catch {
      alert('Failed to delete site visit record');
    }
    setDeleting(null);
  };

  /* ================================================================ */
  /*  Form handlers                                                    */
  /* ================================================================ */
  const handleFormChange = (field: keyof FormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // reset batch when course changes
      if (field === 'Course_Id') next.Batch_Id = '';
      return next;
    });
  };

  const handleEdit = async (id: number) => {
    setEditId(id);
    setShowForm(true);
    setFormError('');
    setFormSuccess('');
    try {
      const res = await fetch(`/api/daily-activities/site-visit?id=${id}`);
      const data = await res.json();
      if (data.visit) {
        const v = data.visit;
        setForm({
          Course_Id: '',
          Batch_Id: String(v.Batch_ID || ''),
          Region: v.Region || '',
          Location: v.Location || '',
          Total_Student: String(v.Total_Student || ''),
          Visit_Fees: String(v.Visit_Fees || ''),
          Visit_Date: v.Visit_Date || '',
          Visit_Time: v.Visit_Time || '',
          Bus_No: String(v.Bus_No || ''),
          Head_Name: v.Head_Name || '',
          Confirm_Date: v.ConfirmDAte || v.Confirm_Date || '',
        });
      }
    } catch {
      setFormError('Failed to load visit data');
    }
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.Region || !form.Visit_Time) {
      setFormError('Region and Time are required.');
      return;
    }

    setSaving(true);
    try {
      // Look up Course_Name and Batch_code from dropdowns
      const selectedCourse = formCourses.find(c => String(c.Course_Id) === form.Course_Id);
      const selectedBatch = formBatches.find(b => String(b.Batch_Id) === form.Batch_Id);

      const payload: Record<string, unknown> = {
        Course_Name: selectedCourse?.Course_Name || null,
        Batch_ID: form.Batch_Id ? parseInt(form.Batch_Id) : null,
        Batch_Code: selectedBatch ? parseInt(String(selectedBatch.Batch_code)) || null : null,
        Region: form.Region,
        Location: form.Location,
        Total_Student: form.Total_Student ? parseInt(form.Total_Student) : null,
        Visit_Fees: form.Visit_Fees ? parseInt(form.Visit_Fees) : null,
        Visit_Date: form.Visit_Date || null,
        Visit_Time: form.Visit_Time,
        Bus_No: form.Bus_No ? parseInt(form.Bus_No) : null,
        Head_Name: form.Head_Name || null,
        Confirm_Date: form.Confirm_Date || null,
      };

      if (isEdit) payload.Visit_Id = editId;

      const res = await fetch('/api/daily-activities/site-visit', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setFormSuccess(isEdit ? 'Site visit updated successfully!' : 'Site visit created successfully!');
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
      setFetchTrigger((t) => t + 1);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save site visit');
    }
    setSaving(false);
  };

  /* ================================================================ */
  /*  Export handler                                                    */
  /* ================================================================ */
  const handleExport = () => {
    if (rows.length === 0) return;
    const headers = ['Visit_Id', 'Course', 'Batch', 'Region', 'Location', 'Total Students', 'Date', 'Time', 'Confirm Date'];
    const csvRows = rows.map((r) => [
      r.Visit_Id,
      r.Course_Name || '',
      r.Batch_Code || '',
      r.Region || '',
      r.Location || '',
      r.Total_Student || '',
      formatDate(r.Visit_Date),
      r.Visit_Time || '',
      formatDate(r.Confirm_Date),
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-visits-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ================================================================ */
  /*  Helpers                                                          */
  /* ================================================================ */
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const totalPages = pagination.totalPages;

  /* ---- Shared input classes ---- */
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';
  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400';
  const selectCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white';

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Site Visit</h1>
          <p className="text-xs text-gray-400">Daily Activities / Site Visit</p>
        </div>
      </div>

      {/* ──── Add / Edit Form ──── */}
      {(showForm || canCreate) && showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-sm font-bold text-gray-700">
              {isEdit ? 'Edit Site Visit Details' : 'Add Site Visit Details'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {formError && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>
            )}
            {formSuccess && (
              <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">{formSuccess}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Course */}
              <div>
                <label className={labelCls}>
                  Course <span className="text-red-500">*</span>
                </label>
                <select value={form.Course_Id} onChange={(e) => handleFormChange('Course_Id', e.target.value)} className={selectCls}>
                  <option value="">Select</option>
                  {formCourses.map((c) => (
                    <option key={c.Course_Id} value={c.Course_Id}>
                      {c.Course_Name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch */}
              <div>
                <label className={labelCls}>
                  Batch <span className="text-red-500">*</span>
                </label>
                <select value={form.Batch_Id} onChange={(e) => handleFormChange('Batch_Id', e.target.value)} className={selectCls}>
                  <option value="">Select</option>
                  {formBatches.map((b) => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>
                      {b.Batch_code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label className={labelCls}>
                  Region <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.Region}
                  onChange={(e) => handleFormChange('Region', e.target.value)}
                  className={inputCls}
                  placeholder="Region"
                />
              </div>

              {/* Location */}
              <div>
                <label className={labelCls}>Location</label>
                <input
                  type="text"
                  value={form.Location}
                  onChange={(e) => handleFormChange('Location', e.target.value)}
                  className={inputCls}
                  placeholder="Location"
                />
              </div>

              {/* Students / Bus */}
              <div>
                <label className={labelCls}>Total Students</label>
                <input
                  type="number"
                  value={form.Total_Student}
                  onChange={(e) => handleFormChange('Total_Student', e.target.value)}
                  className={inputCls}
                  placeholder="Total Students"
                />
              </div>

              {/* Date */}
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={form.Visit_Date}
                  onChange={(e) => handleFormChange('Visit_Date', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Time */}
              <div>
                <label className={labelCls}>
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={form.Visit_Time}
                  onChange={(e) => handleFormChange('Visit_Time', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Confirm Date */}
              <div>
                <label className={labelCls}>Confirm Date</label>
                <input
                  type="date"
                  value={form.Confirm_Date}
                  onChange={(e) => handleFormChange('Confirm_Date', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Bus No */}
              <div>
                <label className={labelCls}>Bus No</label>
                <input
                  type="number"
                  value={form.Bus_No}
                  onChange={(e) => handleFormChange('Bus_No', e.target.value)}
                  className={inputCls}
                  placeholder="Bus No"
                />
              </div>

              {/* Head Name */}
              <div>
                <label className={labelCls}>Head Name</label>
                <input
                  type="text"
                  value={form.Head_Name}
                  onChange={(e) => handleFormChange('Head_Name', e.target.value)}
                  className={inputCls}
                  placeholder="Head Name"
                />
              </div>

              {/* Visit Fees */}
              <div>
                <label className={labelCls}>Visit Fees</label>
                <input
                  type="number"
                  value={form.Visit_Fees}
                  onChange={(e) => handleFormChange('Visit_Fees', e.target.value)}
                  className={inputCls}
                  placeholder="Visit Fees"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Submit'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center px-5 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ──── View Site Visit — Main Table Card ──── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Card Header */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-700">View Site Visit</h2>
            <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2.5 py-0.5">
              {pagination.total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showFilters ? 'bg-[#2E3093]/10 border-[#2E3093]/30 text-[#2E3093]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select
                value={filterCourseId}
                onChange={(e) => {
                  setFilterCourseId(e.target.value);
                  setFilterBatchId('');
                }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
              >
                <option value="">All Courses</option>
                {filterCourses.map((c) => (
                  <option key={c.Course_Id} value={c.Course_Id}>
                    {c.Course_Name}
                  </option>
                ))}
              </select>

              <select
                value={filterBatchId}
                onChange={(e) => setFilterBatchId(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
              >
                <option value="">All Batches</option>
                {filterBatches.map((b) => (
                  <option key={b.Batch_Id} value={b.Batch_Id}>
                    {b.Batch_code}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                placeholder="From Date"
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />

              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                placeholder="To Date"
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleSearch}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="Search…"
                className="w-56 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
              />
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors"
            >
              Search
            </button>

            {/* Clear button */}
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Add Site Visit */}
            {canCreate && (
              <button
                onClick={() => {
                  setForm(emptyForm);
                  setEditId(null);
                  setFormError('');
                  setFormSuccess('');
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Site Visit Details
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="dashboard-table w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100/80 z-10">
              <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 border-b border-gray-200 w-20">Visit_Id</th>
                <th className="py-3 px-4 border-b border-gray-200">Course</th>
                <th className="py-3 px-4 border-b border-gray-200">Batch</th>
                <th className="py-3 px-4 border-b border-gray-200">Region</th>
                <th className="py-3 px-4 border-b border-gray-200">Location</th>
                <th className="py-3 px-4 border-b border-gray-200 w-24">Student</th>
                <th className="py-3 px-4 border-b border-gray-200 w-28">Date</th>
                <th className="py-3 px-4 border-b border-gray-200 w-24">Time</th>
                <th className="py-3 px-4 border-b border-gray-200 w-28">Confirm Date</th>
                <th className="py-3 px-4 border-b border-gray-200 w-28 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      Loading site visits...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-400">No site visit records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.Visit_Id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-[#2E3093]/8 text-[#2E3093] rounded">
                        {r.Visit_Id}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">{r.Course_Name || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                        {r.Batch_Code || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">{r.Region || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">{r.Location || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-700 text-sm">{r.Total_Student || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-600 text-xs font-medium">{formatDate(r.Visit_Date)}</td>
                    <td className="py-2.5 px-4 text-gray-600 text-xs font-medium">{r.Visit_Time || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-600 text-xs font-medium">{formatDate(r.Confirm_Date)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Edit */}
                        {canUpdate && (
                          <button
                            onClick={() => handleEdit(r.Visit_Id)}
                            className="p-1.5 rounded-lg text-[#2A6BB5] hover:bg-[#2A6BB5]/10 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        )}
                        {/* Delete */}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(r.Visit_Id)}
                            disabled={deleting === r.Visit_Id}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deleting === r.Visit_Id ? (
                              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: Pagination */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            {totalPages > 1 && (
              <>
                <span className="text-xs text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
          <span className="text-xs text-gray-400">
            Showing {rows.length > 0 ? (page - 1) * pagination.limit + 1 : 0}–
            {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
        </div>
      </div>
    </div>
  );
}
