'use client';

import { useCallback, useState, useEffect } from 'react';

type BMStatus = 'Pending' | 'Done';

interface BatchMarketing {
  id: number;
  batch_name: string;
  training_name: string;
  batch_start_date: string | null;
  batch_announcement_date: string | null;
  meta_ads_date: string | null;
  flyer_status: BMStatus;
  announcement_status: BMStatus;
  meta_ads_status: BMStatus;
}

interface BatchOption {
  Batch_Id: number;
  Batch_code: string;
  Course_Name: string | null;
  SDate: string | null;
}

type ModalState = { open: false } | { open: true; editing: BatchMarketing | null };

const EMPTY_FORM = {
  batch_name: '',
  training_name: '',
  batch_start_date: '',
  flyer_status: 'Pending' as BMStatus,
  announcement_status: 'Pending' as BMStatus,
  meta_ads_status: 'Pending' as BMStatus,
};

function subtractMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function toDateStr(val: string | null | undefined): string {
  if (!val) return '';
  const s = typeof val === 'string' ? val : new Date(val).toISOString();
  return s.slice(0, 10);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function StatusBadge({ status }: { status: BMStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
      status === 'Done'
        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
        : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
    }`}>
      {status === 'Done' ? '✓' : '○'} {status}
    </span>
  );
}

function StatusSelect({ value, onChange }: { value: BMStatus; onChange: (v: BMStatus) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as BMStatus)}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
    >
      <option value="Pending">Pending</option>
      <option value="Done">Done</option>
    </select>
  );
}

export default function BatchMarketingWidget() {
  const [rows, setRows]                 = useState<BatchMarketing[]>([]);
  const [loading, setLoading]           = useState(true);
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [modal, setModal]               = useState<ModalState>({ open: false });
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);

  /* fetch saved records */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/cbd-batch-marketing', { cache: 'no-store' });
      if (res.ok) setRows((await res.json()).rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  /* fetch batch master options */
  useEffect(() => {
    fetch('/api/inquiry/batches')
      .then(r => r.json())
      .then(data => setBatchOptions(data.batches ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setSelectedBatch('');
    setModal({ open: true, editing: null });
  };

  const openEdit = (r: BatchMarketing) => {
    setSelectedBatch('');
    setForm({
      batch_name: r.batch_name,
      training_name: r.training_name,
      batch_start_date: r.batch_start_date ?? '',
      flyer_status: r.flyer_status,
      announcement_status: r.announcement_status,
      meta_ads_status: r.meta_ads_status,
    });
    setModal({ open: true, editing: r });
  };

  const remove = useCallback(async (id: number) => {
    if (!confirm('Delete this batch marketing record?')) return;
    await fetch(`/api/finance/cbd-batch-marketing/${id}`, { method: 'DELETE' });
    load();
  }, [load]);

  /* when user picks a batch from the dropdown, auto-fill fields */
  const handleBatchSelect = (batchId: string) => {
    setSelectedBatch(batchId);
    if (!batchId) return;
    const batch = batchOptions.find(b => String(b.Batch_Id) === batchId);
    if (!batch) return;
    setForm(f => ({
      ...f,
      batch_name: batch.Batch_code ?? '',
      training_name: batch.Course_Name ?? '',
      batch_start_date: toDateStr(batch.SDate),
    }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const editing = modal.open ? (modal as { open: true; editing: BatchMarketing | null }).editing : null;
      const url    = editing ? `/api/finance/cbd-batch-marketing/${editing.id}` : '/api/finance/cbd-batch-marketing';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_name: form.batch_name.trim(),
          training_name: form.training_name.trim(),
          batch_start_date: form.batch_start_date || null,
          flyer_status: form.flyer_status,
          announcement_status: form.announcement_status,
          meta_ads_status: form.meta_ads_status,
        }),
      });
      if (res.ok) {
        setModal({ open: false });
        load();
      }
    } finally {
      setSaving(false);
    }
  }, [form, modal, load]);

  const announcementDate = form.batch_start_date ? subtractMonths(form.batch_start_date, 3) : null;
  const metaAdsDate      = form.batch_start_date ? subtractMonths(form.batch_start_date, 1) : null;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100" style={{ borderLeft: '3px solid #2A6BB5' }}>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #2A6BB5 10%, transparent)' }}>
            <span style={{ color: '#2A6BB5' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </span>
          </span>
          <span className="font-bold text-gray-800 text-sm flex-1">Batch Marketing Tracker</span>
          {!loading && <span className="text-[11px] font-semibold text-gray-400 tabular-nums">{rows.length}</span>}
          <button
            onClick={openAdd}
            className="ml-2 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2E3093] text-white hover:bg-[#252780] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-left">Training Name</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-left">Batch Name</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Start Date</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Announcement Date</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Announcement</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Meta Ads Date</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Meta Ads</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Flyer</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: j <= 1 ? '70%' : '50%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-400">No batch marketing records yet — click Add to get started</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} className={`border-t border-gray-100 hover:bg-gray-50/50 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-4 py-3.5 text-gray-700">{r.training_name || '—'}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-800">{r.batch_name || '—'}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums text-gray-600">{fmtDate(r.batch_start_date)}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums text-[#2A6BB5] font-medium">{fmtDate(r.batch_announcement_date)}</td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={r.announcement_status} /></td>
                    <td className="px-4 py-3.5 text-center tabular-nums text-gray-500">{fmtDate(r.meta_ads_date)}</td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={r.meta_ads_status} /></td>
                    <td className="px-4 py-3.5 text-center"><StatusBadge status={r.flyer_status} /></td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#2E3093] hover:bg-[#2E3093]/10 transition-colors" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModal({ open: false })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">
                {(modal as { open: true; editing: BatchMarketing | null }).editing ? 'Edit Batch Marketing' : 'Add Batch Marketing'}
              </h3>
              <button onClick={() => setModal({ open: false })} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {/* Batch selector — picks from batch master */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Select Batch (from Batch Master)
                  {batchOptions.length === 0 && <span className="ml-1.5 text-gray-400 font-normal">loading…</span>}
                </label>
                <select
                  value={selectedBatch}
                  onChange={e => handleBatchSelect(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                >
                  <option value="">— pick a batch to auto-fill —</option>
                  {batchOptions.map(b => (
                    <option key={b.Batch_Id} value={String(b.Batch_Id)}>
                      {b.Course_Name ? `${b.Course_Name} · ` : ''}{b.Batch_code}{b.SDate ? ` (${toDateStr(b.SDate)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-dashed border-gray-200 pt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Training Name</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                    value={form.training_name}
                    onChange={e => setForm(f => ({ ...f, training_name: e.target.value }))}
                    placeholder="e.g. Java Programming"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Batch Name / Code</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                    value={form.batch_name}
                    onChange={e => setForm(f => ({ ...f, batch_name: e.target.value }))}
                    placeholder="e.g. BTH-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Batch Start Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                  value={form.batch_start_date}
                  onChange={e => setForm(f => ({ ...f, batch_start_date: e.target.value }))}
                />
                {form.batch_start_date && (
                  <div className="mt-1.5 flex gap-4 text-[11px] bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <span className="text-blue-600">Announcement date: <strong>{fmtDate(announcementDate)}</strong></span>
                    <span className="text-gray-500">Meta Ads date: <strong className="text-gray-700">{fmtDate(metaAdsDate)}</strong></span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Flyer Status</label>
                  <StatusSelect value={form.flyer_status} onChange={v => setForm(f => ({ ...f, flyer_status: v }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Announcement</label>
                  <StatusSelect value={form.announcement_status} onChange={v => setForm(f => ({ ...f, announcement_status: v }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Ads</label>
                  <StatusSelect value={form.meta_ads_status} onChange={v => setForm(f => ({ ...f, meta_ads_status: v }))} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal({ open: false })} className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#2E3093] text-white hover:bg-[#252780] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
