'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaPrint, FaTrash } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { inr, STATUS_STYLE, amountInWords } from '../shared';

interface Payment {
  Id: number; Payment_Date: string; Amount: number; TDS_Amount: number;
  Mode: string | null; Reference_No: string | null; Remarks: string | null;
}

interface Invoice {
  Id: number; Inquiry_Id: number; Invoice_No: string; Invoice_Date: string; Due_Date: string | null;
  Bill_To_Name: string; Bill_To_Address: string | null; Bill_To_GSTIN: string | null; Place_Of_Supply: string | null;
  Description: string; Taxable_Amount: number; GST_Percent: number; Interstate: number; GST_Amount: number;
  Total_Amount: number; Paid_Amount: number; Balance: number; Status: string; Notes: string | null; Cancelled: number;
  CompanyName: string | null; ContactName: string | null; ContactEmail: string | null; ContactMobile: string | null;
  payments: Payment[];
}

const SIT_GSTIN = process.env.NEXT_PUBLIC_SIT_GSTIN || '';
const d = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '-');
const dmy = (v: string | null | undefined) => {
  const s = d(v);
  return s === '-' ? s : s.split('-').reverse().join('-');
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white';

function printInvoice(inv: Invoice) {
  const half = inv.GST_Amount / 2;
  const taxRows = inv.Interstate
    ? `<tr><td>IGST @ ${inv.GST_Percent}%</td><td class="r">${inr(inv.GST_Amount)}</td></tr>`
    : `<tr><td>CGST @ ${inv.GST_Percent / 2}%</td><td class="r">${inr(half)}</td></tr>
       <tr><td>SGST @ ${inv.GST_Percent / 2}%</td><td class="r">${inr(inv.GST_Amount - half)}</td></tr>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(inv.Invoice_No)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
  th { background: #f2f2f2; text-align: left; }
  .r { text-align: right; } .c { text-align: center; }
  .hdr td { border: none; }
  .title { text-align: center; font-size: 18px; font-weight: bold; letter-spacing: 1px; margin: 10px 0; }
  .muted { color: #555; }
  .tot td { font-weight: bold; background: #ffff99; }
</style></head><body>
<table class="hdr"><tr>
  <td style="width:90px"><img src="${location.origin}/sit.png" style="height:56px"/></td>
  <td>
    <div style="font-size:16px;font-weight:bold">Suvidya Institute of Technology Pvt. Ltd.</div>
    <div class="muted">18/140, Anand Nagar, Near Vakola Police Station, Santacruz (East), Mumbai-400055, Maharashtra, India</div>
    <div class="muted">P: 022-26682290 · M: 9167219403 · www.suvidya.ac.in</div>
    ${SIT_GSTIN ? `<div><b>GSTIN:</b> ${esc(SIT_GSTIN)}</div>` : ''}
  </td>
</tr></table>
<div class="title">TAX INVOICE${inv.Cancelled ? ' (CANCELLED)' : ''}</div>
<table>
  <tr>
    <td style="width:55%"><b>Bill To:</b><br/>${esc(inv.Bill_To_Name)}<br/>
      <span class="muted">${esc(inv.Bill_To_Address || '').replace(/\n/g, '<br/>')}</span>
      ${inv.Bill_To_GSTIN ? `<br/><b>GSTIN:</b> ${esc(inv.Bill_To_GSTIN)}` : ''}</td>
    <td><b>Invoice No:</b> ${esc(inv.Invoice_No)}<br/><b>Invoice Date:</b> ${dmy(inv.Invoice_Date)}<br/>
      ${inv.Due_Date ? `<b>Due Date:</b> ${dmy(inv.Due_Date)}<br/>` : ''}
      ${inv.Place_Of_Supply ? `<b>Place of Supply:</b> ${esc(inv.Place_Of_Supply)}<br/>` : ''}
      <b>SAC:</b> 999293 (Commercial training &amp; coaching)</td>
  </tr>
</table>
<br/>
<table>
  <thead><tr><th class="c" style="width:40px">Sr.</th><th>Description</th><th class="r" style="width:150px">Amount (₹)</th></tr></thead>
  <tbody>
    <tr><td class="c">1</td><td>${esc(inv.Description).replace(/\n/g, '<br/>')}</td><td class="r">${inr(inv.Taxable_Amount)}</td></tr>
  </tbody>
</table>
<table style="margin-top:-1px">
  <tr><td>Taxable Value</td><td class="r" style="width:150px">${inr(inv.Taxable_Amount)}</td></tr>
  ${taxRows}
  <tr class="tot"><td>Invoice Total</td><td class="r">${inr(inv.Total_Amount)}</td></tr>
</table>
<p><b>Amount in words:</b> ${amountInWords(inv.Total_Amount)}</p>
${inv.Notes ? `<p><b>Terms / Notes:</b><br/>${esc(inv.Notes).replace(/\n/g, '<br/>')}</p>` : ''}
<table class="hdr" style="margin-top:40px"><tr><td></td>
  <td style="width:45%;text-align:center"><div style="height:50px;border-bottom:1px solid #999"></div>
  <b>Authorised Signatory</b><br/><span class="muted">For Suvidya Institute of Technology Pvt. Ltd.</span></td></tr></table>
<script>window.onload = function () { window.print(); };</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups to print the invoice'); return; }
  w.document.write(html);
  w.document.close();
}

export default function CorporateInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pay, setPay] = useState({ Payment_Date: todayStr(), Amount: '', TDS_Amount: '', Mode: 'NEFT', Reference_No: '', Remarks: '' });
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/corporate-invoices/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load invoice');
      setInv(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (canView) load(); }, [load, canView]);

  const addPayment = async () => {
    setPaying(true); setError('');
    try {
      const res = await fetch(`/api/corporate-invoices/${id}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pay, Amount: Number(pay.Amount) || 0, TDS_Amount: Number(pay.TDS_Amount) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');
      setPay((p) => ({ ...p, Amount: '', TDS_Amount: '', Reference_No: '', Remarks: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally { setPaying(false); }
  };

  const removePayment = async (paymentId: number) => {
    if (!confirm('Delete this payment entry?')) return;
    const res = await fetch(`/api/corporate-invoices/${id}/payments?paymentId=${paymentId}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Failed to delete'); return; }
    await load();
  };

  const toggleCancel = async () => {
    if (!inv) return;
    const cancel = !inv.Cancelled;
    if (!confirm(cancel ? 'Cancel this invoice? The number will not be reused.' : 'Restore this invoice?')) return;
    const res = await fetch(`/api/corporate-invoices/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cancelled: cancel }),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Failed'); return; }
    await load();
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied />;
  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!inv) return <div className="p-6 text-red-600">{error || 'Invoice not found'}</div>;

  const totalTds = inv.payments.reduce((s, p) => s + p.TDS_Amount, 0);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/corporate-invoices')} className="text-gray-500 hover:text-gray-700"><FaArrowLeft /></button>
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {inv.Invoice_No}
              <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLE[inv.Status] || ''}`}>{inv.Status}</span>
            </h2>
            <p className="text-sm text-gray-400">
              {inv.Bill_To_Name} · Inquiry{' '}
              <button onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inv.Inquiry_Id}`)} className="text-[#2E3093] font-semibold">#{inv.Inquiry_Id}</button>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => printInvoice(inv)} className="px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#262a7d] text-white text-sm font-semibold flex items-center gap-2">
            <FaPrint className="w-3.5 h-3.5" /> Print Invoice
          </button>
          {canUpdate && (
            <button onClick={toggleCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              {inv.Cancelled ? 'Restore' : 'Cancel Invoice'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div className="grid md:grid-cols-4 gap-3">
        {([
          ['Invoice Total', inv.Total_Amount, 'text-gray-800'],
          ['Received', inv.Paid_Amount - totalTds, 'text-green-700'],
          ['TDS Deducted', totalTds, 'text-gray-600'],
          ['Balance', inv.Balance, inv.Status === 'Overdue' ? 'text-red-700' : 'text-amber-700'],
        ] as [string, number, string][]).map(([label, v, cls]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-xl font-bold ${cls}`}>{inr(v)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 grid md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <p><span className="text-gray-500">Invoice date:</span> {dmy(inv.Invoice_Date)}</p>
          <p><span className="text-gray-500">Due date:</span> {dmy(inv.Due_Date)}</p>
          <p><span className="text-gray-500">Client GSTIN:</span> {inv.Bill_To_GSTIN || '-'}</p>
          <p><span className="text-gray-500">Place of supply:</span> {inv.Place_Of_Supply || '-'}</p>
          <p><span className="text-gray-500">Contact:</span> {[inv.ContactName, inv.ContactMobile, inv.ContactEmail].filter(Boolean).join(' · ') || '-'}</p>
        </div>
        <div className="space-y-1">
          <p className="whitespace-pre-wrap"><span className="text-gray-500">Description:</span> {inv.Description}</p>
          <p><span className="text-gray-500">Before GST:</span> {inr(inv.Taxable_Amount)}</p>
          <p><span className="text-gray-500">{inv.Interstate ? 'IGST' : 'CGST + SGST'} @ {inv.GST_Percent}%:</span> {inr(inv.GST_Amount)}</p>
          {inv.Notes && <p className="whitespace-pre-wrap"><span className="text-gray-500">Notes:</span> {inv.Notes}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-800">Payments</h3></div>
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">TDS</th>
                <th className="text-left p-3">Mode</th>
                <th className="text-left p-3">Reference</th>
                <th className="text-left p-3">Remarks</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {inv.payments.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-gray-400">No payments recorded yet</td></tr>
              )}
              {inv.payments.map((p) => (
                <tr key={p.Id} className="border-t border-gray-100">
                  <td className="p-3">{dmy(p.Payment_Date)}</td>
                  <td className="p-3 text-right">{inr(p.Amount)}</td>
                  <td className="p-3 text-right">{p.TDS_Amount ? inr(p.TDS_Amount) : '-'}</td>
                  <td className="p-3">{p.Mode || '-'}</td>
                  <td className="p-3">{p.Reference_No || '-'}</td>
                  <td className="p-3">{p.Remarks || '-'}</td>
                  <td className="p-3 text-right">
                    {canUpdate && (
                      <button onClick={() => removePayment(p.Id)} className="text-red-500 hover:text-red-700" title="Delete payment"><FaTrash className="w-3.5 h-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canUpdate && !inv.Cancelled && inv.Balance > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
            <div><label className="text-xs font-semibold text-gray-500">Date</label>
              <input type="date" className={inputCls} value={pay.Payment_Date} onChange={(e) => setPay({ ...pay, Payment_Date: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500">Amount received (₹)</label>
              <input type="number" min="0" className={inputCls} value={pay.Amount} placeholder={String(inv.Balance)} onChange={(e) => setPay({ ...pay, Amount: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500">TDS (₹)</label>
              <input type="number" min="0" className={inputCls} value={pay.TDS_Amount} onChange={(e) => setPay({ ...pay, TDS_Amount: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500">Mode</label>
              <select className={inputCls} value={pay.Mode} onChange={(e) => setPay({ ...pay, Mode: e.target.value })}>
                {['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Other'].map((m) => <option key={m}>{m}</option>)}
              </select></div>
            <div><label className="text-xs font-semibold text-gray-500">UTR / Cheque no</label>
              <input className={inputCls} value={pay.Reference_No} onChange={(e) => setPay({ ...pay, Reference_No: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500">Remarks</label>
              <input className={inputCls} value={pay.Remarks} onChange={(e) => setPay({ ...pay, Remarks: e.target.value })} /></div>
            <button onClick={addPayment} disabled={paying} className="px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#262a7d] text-white text-sm font-semibold disabled:opacity-60">
              {paying ? 'Saving…' : 'Add Payment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
