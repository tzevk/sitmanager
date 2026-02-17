'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface LibraryBook {
  Book_Id: number;
  Book_Name: string | null;
  Book_No: string | null;
  Book_Course: string | null;
  Course_Id: number | null;
  Author: string | null;
  Publisher: string | null;
  Purchase_Dt: string | null;
  Amount: number | null;
  Total_Pages: number | null;
  RackNo: string | null;
  Status: string | null;
  Remark: string | null;
  IsActive: number | null;
}

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ---- Reusable styles ---- */
const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
const inputCls = 'w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';

/* ---- SectionCard ---- */
function SectionCard({ title, children, className = '', contentClassName = '' }: { title: string; children: React.ReactNode; className?: string; contentClassName?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0 ${className}`}>
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3 flex-shrink-0">
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
      </div>
      <div className={`p-5 flex-1 overflow-auto min-h-0 ${contentClassName}`}>{children}</div>
    </div>
  );
}

export default function LibraryBookPage() {
  /* ---- Form state ---- */
  const [formData, setFormData] = useState({
    Book_Name: '',
    Book_No: '',
    Book_Code: '',
    Publisher: '',
    Page: '',
    Total_Pages: '',
    Status: '',
    Course_Id: '',
    Author: '',
    Purchase_Dt: '',
    Amount: '',
    RackNo: '',
    Remark: '',
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ---- List state ---- */
  const [rows, setRows] = useState<LibraryBook[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  /* ---- Fetch list ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);

      const res = await fetch(`/api/masters/library-book?${params.toString()}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setCourses(data.courses ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---- Handlers ---- */
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      Book_Name: '',
      Book_No: '',
      Book_Code: '',
      Publisher: '',
      Page: '',
      Total_Pages: '',
      Status: '',
      Course_Id: '',
      Author: '',
      Purchase_Dt: '',
      Amount: '',
      RackNo: '',
      Remark: '',
    });
    setEditId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.Book_Name.trim()) {
      alert('Book Name is required');
      return;
    }
    if (!formData.Book_No.trim()) {
      alert('Book Number is required');
      return;
    }
    if (!formData.Course_Id) {
      alert('Course Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const selectedCourse = courses.find(c => c.Course_Id === Number(formData.Course_Id));
      const method = editId ? 'PUT' : 'POST';
      const body = {
        ...(editId && { Book_Id: editId }),
        Book_Name: formData.Book_Name,
        Book_No: formData.Book_No,
        Book_Code: formData.Book_Code,
        Publisher: formData.Publisher,
        Book_Copies: formData.Page ? Number(formData.Page) : null,
        Total_Pages: formData.Total_Pages ? Number(formData.Total_Pages) : null,
        Status: formData.Status,
        Course_Id: Number(formData.Course_Id),
        Book_Course: selectedCourse?.Course_Name || '',
        Author: formData.Author,
        Purchase_Dt: formData.Purchase_Dt,
        Amount: formData.Amount ? Number(formData.Amount) : null,
        RackNo: formData.RackNo,
        Remark: formData.Remark,
      };

      const res = await fetch('/api/masters/library-book', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } catch {
      alert('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: LibraryBook) => {
    setEditId(row.Book_Id);
    setFormData({
      Book_Name: row.Book_Name || '',
      Book_No: row.Book_No || '',
      Book_Code: '',
      Publisher: row.Publisher || '',
      Page: '',
      Total_Pages: row.Total_Pages?.toString() || '',
      Status: row.Status || '',
      Course_Id: row.Course_Id?.toString() || '',
      Author: row.Author || '',
      Purchase_Dt: row.Purchase_Dt || '',
      Amount: row.Amount?.toString() || '',
      RackNo: row.RackNo || '',
      Remark: row.Remark || '',
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this book?')) return;
    try {
      const res = await fetch(`/api/masters/library-book?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch {
      /* ignore */
    }
  };

  const handleExport = () => {
    const headers = ['Id', 'Book Name', 'Book Number', 'Course Name', 'Purchase Date', 'Rack No.'];
    const csvRows = rows.map(r => [
      r.Book_Id,
      r.Book_Name || '',
      r.Book_No || '',
      r.Book_Course || '',
      r.Purchase_Dt || '',
      r.RackNo || ''
    ]);
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'library_books.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1);
      setFetchTrigger(t => t + 1);
    }
  };

return (
  <div className="space-y-6">
    {/* Page Header */}
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Library Book</h1>
        <p className="text-xs text-gray-400">Manage library books</p>
      </div>
    </div>

    {/* Stacked Layout: Form on top, Table below */}
    <div className="space-y-4">
      {/* Form Section */}
      <SectionCard title={editId ? 'Edit Library Book' : 'Add Library Book'}>

          <form onSubmit={handleSubmit} className="space-y-2">
  {/* Row 1: 7 columns */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', alignItems: 'end' }}>
    <div className="min-w-0">
      <label className={labelCls}>Book Name *</label>
      <input
        type="text"
        value={formData.Book_Name}
        onChange={(e) => handleFormChange('Book_Name', e.target.value)}
        className={inputCls}
        placeholder="Book name"
        required
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Book Number *</label>
      <input
        type="text"
        value={formData.Book_No}
        onChange={(e) => handleFormChange('Book_No', e.target.value)}
        className={inputCls}
        placeholder="Book number"
        required
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Publication</label>
      <input
        type="text"
        value={formData.Book_Code}
        onChange={(e) => handleFormChange('Book_Code', e.target.value)}
        className={inputCls}
        placeholder="Publication"
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Publisher</label>
      <input
        type="text"
        value={formData.Publisher}
        onChange={(e) => handleFormChange('Publisher', e.target.value)}
        className={inputCls}
        placeholder="Publisher"
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Page</label>
      <input
        type="number"
        value={formData.Page}
        onChange={(e) => handleFormChange('Page', e.target.value)}
        className={inputCls}
        placeholder="Pages"
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Total Pages</label>
      <input
        type="number"
        value={formData.Total_Pages}
        onChange={(e) => handleFormChange('Total_Pages', e.target.value)}
        className={inputCls}
        placeholder="Total"
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Status</label>
      <select
        value={formData.Status}
        onChange={(e) => handleFormChange('Status', e.target.value)}
        className={inputCls}
      >
        <option value="">Select</option>
        <option value="Active">Active</option>
        <option value="Inactive">Inactive</option>
        <option value="Lost">Lost</option>
        <option value="Damaged">Damaged</option>
      </select>
    </div>
  </div>

  {/* Row 2: 7 columns */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', alignItems: 'end' }}>
    <div className="min-w-0">
      <label className={labelCls}>Course Name *</label>
      <select
        value={formData.Course_Id}
        onChange={(e) => handleFormChange('Course_Id', e.target.value)}
        className={inputCls}
        required
      >
        <option value="">Select</option>
        {courses.map((course) => (
          <option key={course.Course_Id} value={course.Course_Id}>
            {course.Course_Name}
          </option>
        ))}
      </select>
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Author</label>
      <input
        type="text"
        value={formData.Author}
        onChange={(e) => handleFormChange('Author', e.target.value)}
        className={inputCls}
        placeholder="Author"
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Purchase Date</label>
      <input
        type="date"
        value={formData.Purchase_Dt}
        onChange={(e) => handleFormChange('Purchase_Dt', e.target.value)}
        className={inputCls}
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Price</label>
      <input
        type="number"
        value={formData.Amount}
        onChange={(e) => handleFormChange('Amount', e.target.value)}
        className={inputCls}
        placeholder="Price"
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Rack No.</label>
      <input
        type="text"
        value={formData.RackNo}
        onChange={(e) => handleFormChange('RackNo', e.target.value)}
        className={inputCls}
        placeholder="Rack"
      />
    </div>

    <div className="min-w-0">
      <label className={labelCls}>Comment</label>
      <input
        type="text"
        value={formData.Remark}
        onChange={(e) => handleFormChange('Remark', e.target.value)}
        className={inputCls}
        placeholder="Comment"
      />
    </div>

    <div className="flex items-end gap-1.5 min-w-0">
      <button
        type="submit"
        disabled={submitting}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2E3093] rounded hover:bg-[#252780] disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Saving...' : editId ? 'Update' : 'Save'}
      </button>
      {editId && (
        <button
          type="button"
          onClick={() => { setEditId(null); resetForm(); }}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  </div>
</form>
 
      </SectionCard>

      {/* List Section */}
      <SectionCard title="List of Library Books" contentClassName="overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">{pagination.total.toLocaleString()} total records</p>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-56 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm border ${
                showFilters ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Expandable filters panel */}
        {showFilters && (
          <div className="flex-shrink-0 bg-gray-50 rounded-lg p-4 mb-4 animate-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-gray-500">No additional filters available</p>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-gray-100">
          <table className="dashboard-table w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold whitespace-nowrap">Id</th>
                <th className="text-left py-3 px-4 font-semibold whitespace-nowrap">Book Name</th>
                <th className="text-left py-3 px-4 font-semibold whitespace-nowrap">Book Number</th>
                <th className="text-left py-3 px-4 font-semibold whitespace-nowrap">Course Name</th>
                <th className="text-left py-3 px-4 font-semibold whitespace-nowrap">Purchase Date</th>
                <th className="text-left py-3 px-4 font-semibold whitespace-nowrap">Rack No.</th>
                <th className="text-center py-3 px-4 font-semibold whitespace-nowrap">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm">No records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.Book_Id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">{row.Book_Id}</td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800">{row.Book_Name || '-'}</td>
                    <td className="py-2.5 px-4 text-gray-600">{row.Book_No || '-'}</td>
                    <td className="py-2.5 px-4 text-gray-600">{row.Book_Course || '-'}</td>
                    <td className="py-2.5 px-4 text-gray-600">{row.Purchase_Dt || '-'}</td>
                    <td className="py-2.5 px-4 text-gray-600">{row.RackNo || '-'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(row)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDelete(row.Book_Id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const totalPages = pagination.totalPages;
                const current = pagination.page;
                const p =
                  totalPages <= 5
                    ? i + 1
                    : current <= 3
                      ? i + 1
                      : current >= totalPages - 2
                        ? totalPages - 4 + i
                        : current - 2 + i;

                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                      p === current ? 'bg-[#2E3093] text-white' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  </div>
);
}
