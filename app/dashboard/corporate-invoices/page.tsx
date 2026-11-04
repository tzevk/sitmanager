'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSearch, FaPlus, FaTimes } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { inr, STATUS_STYLE } from './shared';

interface InvoiceRow {
  Id: number;
  Invoice_No: string;
  Invoice_Date: string;
  Due_Date: string | null;
  Bill_To_Name: string;
  CompanyName: string | null;
  Total_Amount: number;
  Paid_Amount: number;
  Balance: number;
  Status: string;
}

interface Summary { invoiced: number; received: number; outstanding: number; overdue: number; overdueCount: number }

interface InquiryOption { Id: number; CompanyName: string | null; FullName: string | null }

const d = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '-');
const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white';

function NewInvoiceModal({ initialInquiryId, onClose, onCreated }: {
  initialInquiryId: number | null; onClose: () => void; onCreated: (id: number) => void;
}) {
  const [inquiryId, setInquiryId] = useState<number | null>(initialInquiryId);
  const [inqSearch, setInqSearch] = useState('');
  const [inqOptions, setInqOptions] = useState<InquiryOption[]>([]);
  const [prefillInfo, setPrefillInfo] = useState<{ quoted: number; billed: number; company: string } | null>(null);
  const [form, setForm] = useState({
    Invoice_Date: todayStr(), Due_Date: plusDays(30), Bill_To_Name: '', Bill_To_Address: '', Bill_To_GSTIN: '',
    Place_Of_Supply: 'Maharashtra', Description: '', Taxable_Amount: '', GST_Percent: '18', Interstate: false, Notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (inquiryId) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams({ page: '1', limit: '20', search: inqSearch });
      fetch(`/api/admission-activity/corporate-inquiry?${p}`)
        .then((r) => r.json())
        .then((data) => setInqOptions(data.rows ?? []))
        .catch(() => setInqOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [inqSearch, inquiryId]);

  useEffect(() => {
    if (!inquiryId) { setPrefillInfo(null); return; }
    let cancelled = false;
    fetch(`/api/corporate-invoices?prefillInquiryId=${inquiryId}`)
      .then((r) => r.json())
      .then(({ prefill }) => {
        if (cancelled || !prefill) return;
        setPrefillInfo({ quoted: prefill.Quoted_Taxable, billed: prefill.Already_Billed, company: prefill.CompanyName });
        setForm((f) => ({
          ...f,
          Bill_To_Name: prefill.Bill_To_Name || '',
          Bill_To_Address: prefill.Bill_To_Address || '',
          Description: prefill.Description || '',
          Taxable_Amount: prefill.Taxable_Amount ? String(prefill.Taxable_Amount) : '',
          GST_Percent: String(prefill.GST_Percent ?? 18),
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [inquiryId]);

  const taxable = Number(form.Taxable_Amount) || 0;
  const gst = Math.round(taxable * (Number(form.GST_Percent) || 0)) / 100;

  const save = async () => {
    if (!inquiryId) { setError('Select the corporate inquiry'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/corporate-invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, Inquiry_Id: inquiryId, Taxable_Amount: taxable, GST_Percent: Number(form.GST_Percent) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');
      onCreated(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">New Corporate Invoice</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Corporate Inquiry *</label>
            {inquiryId ? (
              <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50">
                <span>#{inquiryId} {prefillInfo?.company ? `— ${prefillInfo.company}` : ''}</span>
                <button onClick={() => setInquiryId(null)} className="text-xs text-[#2E3093] font-semibold">Change</button>
              </div>
            ) : (
              <>
                <input className={inputCls} placeholder="Search company…" value={inqSearch} onChange={(e) => setInqSearch(e.target.value)} />
                <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg mt-1">
                  {inqOptions.map((o) => (
                    <button key={o.Id} onClick={() => setInquiryId(o.Id)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
                      #{o.Id} — {o.CompanyName || '-'} <span className="text-gray-400">{o.FullName || ''}</span>
                    </button>
                  ))}
                  {inqOptions.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No matches</p>}
                </div>
              </>
            )}
            {prefillInfo && prefillInfo.quoted > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Quoted (before GST): {inr(prefillInfo.quoted)} · Already invoiced: {inr(prefillInfo.billed)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500">Invoice Date *</label>
              <input type="date" className={inputCls} value={form.Invoice_Date} onChange={(e) => set('Invoice_Date', e.target.value)} /></div>
            <div><label className="text-xs font-semibold text-gray-500">Due Date</label>
              <input type="date" className={inputCls} value={form.Due_Date} onChange={(e) => set('Due_Date', e.target.value)} /></div>
          </div>
          <div><label className="text-xs font-semibold text-gray-500">Bill To *</label>
            <input className={inputCls} value={form.Bill_To_Name} onChange={(e) => set('Bill_To_Name', e.target.value)} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Address</label>
            <textarea rows={2} className={inputCls} value={form.Bill_To_Address} onChange={(e) => set('Bill_To_Address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500">Client GSTIN</label>
              <input className={inputCls} value={form.Bill_To_GSTIN} onChange={(e) => set('Bill_To_GSTIN', e.target.value)} /></div>
            <div><label className="text-xs font-semibold text-gray-500">Place of Supply</label>
              <input className={inputCls} value={form.Place_Of_Supply} onChange={(e) => set('Place_Of_Supply', e.target.value)} /></div>
          </div>
          <div><label className="text-xs font-semibold text-gray-500">Description *</label>
            <textarea rows={2} className={inputCls} value={form.Description} onChange={(e) => set('Description', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div><label className="text-xs font-semibold text-gray-500">Amount before GST (₹) *</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.Taxable_Amount} onChange={(e) => set('Taxable_Amount', e.target.value)} /></div>
            <div><label className="text-xs font-semibold text-gray-500">GST %</label>
              <input type="number" min="0" max="28" className={inputCls} value={form.GST_Percent} onChange={(e) => set('GST_Percent', e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
              <input type="checkbox" checked={form.Interstate} onChange={(e) => set('Interstate', e.target.checked)} />
              Interstate (IGST)
            </label>
          </div>
          <div className="text-sm bg-gray-50 rounded-lg p-3 flex justify-between">
            <span>GST: <b>{inr(gst)}</b></span>
            <span>Invoice total: <b className="text-[#2E3093]">{inr(taxable + gst)}</b></span>
          </div>
          <div><label className="text-xs font-semibold text-gray-500">Notes / Terms</label>
            <textarea rows={2} className={inputCls} value={form.Notes} onChange={(e) => set('Notes', e.target.value)} /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#262a7d] text-white text-sm font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CorporateInvoicesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const presetInquiry = Number(searchParams.get('newForInquiry')) || null;

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showNew, setShowNew] = useState(Boolean(presetInquiry));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ search, status });
      const res = await fetch(`/api/corporate-invoices?${p}`);
      const data = await res.json();
      setRows(data.invoices ?? []);
      setSummary(data.summary ?? null);
    } catch { setRows([]); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => { if (canView) load(); }, [load, canView]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied />;

  const cards: [string, number, string][] = summary ? [
    ['Invoiced', summary.invoiced, 'text-gray-800'],
    ['Received', summary.received, 'text-green-700'],
    ['Outstanding', summary.outstanding, 'text-amber-700'],
    [`Overdue (${summary.overdueCount})`, summary.overdue, 'text-red-700'],
  ] : [];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Corporate Invoices &amp; Payments</h2>
            <p className="text-sm text-gray-400">{rows.length.toLocaleString()} invoices</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[240px]">
              <FaSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                placeholder="Search invoice no, company…"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white shadow-sm"
              />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">All statuses</option>
              {['Unpaid', 'Partly Paid', 'Overdue', 'Paid', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <button onClick={load} className="px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#262a7d] text-white text-sm font-semibold">Search</button>
            {canUpdate && (
              <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-lg border border-[#2E3093] text-[#2E3093] text-sm font-semibold flex items-center gap-2 hover:bg-[#2E3093]/5">
                <FaPlus className="w-3 h-3" /> New Invoice
              </button>
            )}
          </div>
        </div>
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {cards.map(([label, value, cls]) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-lg font-bold ${cls}`}>{inr(value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left p-3">Invoice No</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Company</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Received</th>
                <th className="text-right p-3">Balance</th>
                <th className="text-left p-3">Due</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">No invoices found</td></tr>
              ) : rows.map((r) => (
                <tr key={r.Id} onClick={() => router.push(`/dashboard/corporate-invoices/${r.Id}`)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="p-3 font-semibold text-[#2E3093]">{r.Invoice_No}</td>
                  <td className="p-3 text-gray-700">{d(r.Invoice_Date)}</td>
                  <td className="p-3 text-gray-700">{r.Bill_To_Name || r.CompanyName || '-'}</td>
                  <td className="p-3 text-right text-gray-700">{inr(r.Total_Amount)}</td>
                  <td className="p-3 text-right text-green-700">{inr(r.Paid_Amount)}</td>
                  <td className="p-3 text-right font-semibold text-gray-800">{inr(r.Balance)}</td>
                  <td className="p-3 text-gray-700">{d(r.Due_Date)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLE[r.Status] || ''}`}>{r.Status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewInvoiceModal
          initialInquiryId={presetInquiry}
          onClose={() => setShowNew(false)}
          onCreated={(id) => router.push(`/dashboard/corporate-invoices/${id}`)}
        />
      )}
    </div>
  );
}

export default function CorporateInvoicesPage() {
  return (
    <Suspense fallback={<PermissionLoading />}>
      <CorporateInvoicesInner />
    </Suspense>
  );
}
