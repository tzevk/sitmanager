'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';

interface BatchCategory {
  id: number;
  batch: string | null;
  batchtype: string | null;
  prefix: string | null;
  description: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function BatchCategoryPage() {
  const { canView, canCreate, canUpdate, canDelete, canExport, loading: permLoading } = useResourcePermissions('batch_category');

  /* ---- Form state ---- */
  const [formData, setFormData] = useState({
    batch: '',
    batchtype: '',
    prefix: '',
    description: '',
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /* ---- List state ---- */
  const [rows, setRows] = useState<BatchCategory[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  /* ---- Batch types for dropdown ---- */
  const [batchTypes, setBatchTypes] = useState<string[]>([]);
  const batchInputRef = useRef<HTMLInputElement | null>(null);

  /* ---- Fetch batch types ---- */
  useEffect(() => {
    const fetchBatchTypes = async () => {
      try {
        const res = await fetch('/api/masters/batch-category/options');
        const data = await res.json();
        setBatchTypes(data.batchTypes || []);
      } catch {
        /* ignore */
      }
    };
    fetchBatchTypes();
  }, []);

  /* ---- Fetch list ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      params.set('mode', 'master');
      if (search) params.set('search', search);

      const res = await fetch(`/api/masters/batch-category?${params.toString()}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(data?.error || `Failed to fetch (${res.status})`);
      }
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch';
      setRows([]);
      setPagination({ page: 1, limit: 25, total: 0, totalPages: 0 });
      setListError(message);
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

  const handleClear = () => {
    setFormData({ batch: '', batchtype: '', prefix: '', description: '' });
    setEditId(null);
  };

  const handleSubmit = async () => {
    if (!formData.batch.trim()) {
      alert('Batch Category is required');
      return;
    }
    if (!formData.description.trim()) {
      alert('Description is required');
      return;
    }

    setSubmitting(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId
        ? { id: editId, ...formData }
        : formData;

      const res = await fetch('/api/masters/batch-category', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      handleClear();
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (row: BatchCategory) => {
    setFormData({
      batch: row.batch || '',
      batchtype: row.batchtype || '',
      prefix: row.prefix || '',
      description: row.description || '',
    });
    setEditId(row.id);

    requestAnimationFrame(() => {
      const main = document.querySelector('main');
      if (main && 'scrollTo' in main) {
        (main as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      batchInputRef.current?.focus();
    });
  };

  const handleDelete = async (row: BatchCategory) => {
    if (!row.id) return;
    const name = row.batch || 'this record';
    const ok = window.confirm(`Delete ${name}?`);
    if (!ok) return;

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/masters/batch-category?id=${encodeURIComponent(String(row.id))}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      if (editId === row.id) handleClear();
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = () => {
    const headers = ['Id', 'Batch Category', 'Batch Type', 'Course Code', 'Description'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [
        r.id,
        `"${(r.batch || '').replace(/"/g, '""')}"`,
        `"${(r.batchtype || '').replace(/"/g, '""')}"`,
        `"${(r.prefix || '').replace(/"/g, '""')}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-categories-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = pagination.totalPages;

  /* ---- shared classes (match Annual Batch styling) ---- */
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';
  const inputCls =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium';
  const selectCls =
    'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] transition-all font-medium';

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p className="text-sm font-semibold">Access Denied</p>
        <p className="text-xs">You do not have permission to view batch categories.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header (match Annual Batch styling) */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-8 py-6 shadow-[0_10px_30px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Batch Category</h2>
            <p className="text-[14px] text-white/80 font-medium mt-1">Masters &gt; Batch Category</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Form (single line) */}
        {(canCreate || canUpdate) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:flex-nowrap lg:items-end">
              <div className="w-full lg:w-[260px]">
                <label className={labelCls}>Batch Category</label>
                <input
                  ref={batchInputRef}
                  type="text"
                  value={formData.batch}
                  onChange={e => handleFormChange('batch', e.target.value)}
                  placeholder="Batch Category"
                  className={inputCls}
                />
              </div>

              <div className="w-full lg:w-[220px]">
                <label className={labelCls}>Batch Type</label>
                <select
                  value={formData.batchtype}
                  onChange={e => handleFormChange('batchtype', e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select Type</option>
                  {batchTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="w-full lg:w-[180px]">
                <label className={labelCls}>Course Code</label>
                <input
                  type="text"
                  value={formData.prefix}
                  onChange={e => handleFormChange('prefix', e.target.value)}
                  placeholder="Course Code"
                  className={inputCls}
                />
              </div>

              <div className="w-full lg:flex-1 lg:min-w-[260px]">
                <label className={labelCls}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => handleFormChange('description', e.target.value)}
                  placeholder="Description"
                  className={inputCls}
                />
              </div>

              <div className="w-full lg:w-auto">
                <div className={labelCls}>Actions</div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full lg:w-[140px] flex items-center justify-center gap-2 bg-[#2E3093] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {editId ? 'Update' : 'Submit'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClear}
                    className="w-full lg:w-[140px] px-5 py-2.5 text-sm font-bold text-[#2E3093] bg-white border border-slate-200 rounded-xl hover:border-[#2E3093]/30 transition-all shadow-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-[#2E3093] bg-[#FAE452]/60 border border-[#FAE452] rounded-full px-3 py-1">
                {pagination.total.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canExport && (
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl text-[#2E3093] bg-white hover:border-[#2E3093]/30 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </button>
              )}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                    setFetchTrigger(t => t + 1);
                  }}
                  placeholder="Search…"
                  className="w-48 pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all"
                />
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {listError && (
            <div className="px-5 py-3 border-b border-slate-100 bg-red-50/60 text-red-700 text-sm font-medium">
              {listError}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="dashboard-table w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Id</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-600">Batch Category</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-600">Action</th>
                </tr>
              </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-slate-500">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm">No batch categories found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-slate-700">{r.id}</td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">{r.batch || '—'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                        <button
                          title="Edit"
                          onClick={() => handleEdit(r)}
                          className="p-2 rounded-lg hover:bg-[#FAE452]/70 text-[#2E3093] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        )}
                        {canDelete && (
                          <button
                            title="Delete"
                            onClick={() => handleDelete(r)}
                            disabled={deletingId === r.id}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingId === r.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14" />
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:border-[#2E3093]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-2 text-sm border rounded-xl transition-colors ${
                        page === p ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:border-[#2E3093]/30'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:border-[#2E3093]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
