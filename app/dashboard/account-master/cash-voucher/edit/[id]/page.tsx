'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { CASH_VOUCHER_COMPANIES } from '@/lib/cash-voucher';

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors w-full';
const lbl = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5';

interface AccountHead { id: number; title: string }
interface LineItem {
  date: string;
  accountHead: string;
  amount: string;
  description: string;
  billNo: string;
}

const emptyItem = (): LineItem => ({ date: '', accountHead: '', amount: '', description: '', billNo: '' });

interface FetchedItem {
  date: string | null;
  account_head: string | null;
  amount: number | null;
  description: string | null;
  bill_no: string | null;
}

export default function EditCashVoucherPage() {
  const router = useRouter();
  const params = useParams();
  const voucherId = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('finance');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [accountHeads, setAccountHeads] = useState<AccountHead[]>([]);
  const [voucherno, setVoucherno] = useState('');

  const [company, setCompany] = useState<string>(CASH_VOUCHER_COMPANIES[0]);
  const [date, setDate] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [voucherRes, headsRes] = await Promise.all([
        fetch(`/api/account-master/cash-voucher/${voucherId}`),
        fetch('/api/account-master/cash-voucher/account-heads'),
      ]);
      const voucherData = await voucherRes.json();
      if (!voucherRes.ok) throw new Error(voucherData.error || 'Failed to load voucher');
      const headsData = await headsRes.json();
      setAccountHeads(headsData.accountHeads ?? []);

      const v = voucherData.voucher;
      setVoucherno(v.voucherno || '');
      setCompany(v.company || CASH_VOUCHER_COMPANIES[0]);
      setDate(v.date ? String(v.date).slice(0, 10) : '');
      setPaidTo(v.paidto || '');
      setOpeningBalance(v.opening_balance != null ? String(v.opening_balance) : '');
      setPaidBy(v.paidby || '');
      setPreparedBy(v.prepaired_by || '');

      const loadedItems: LineItem[] = (voucherData.items ?? []).map((it: FetchedItem) => ({
        date: it.date ? String(it.date).slice(0, 10) : '',
        accountHead: it.account_head || '',
        amount: it.amount != null ? String(it.amount) : '',
        description: it.description || '',
        billNo: it.bill_no || '',
      }));
      setItems(loadedItems.length ? loadedItems : [emptyItem()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load voucher');
    } finally {
      setLoading(false);
    }
  }, [voucherId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItemRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItemRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const totalAmount = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const closingBalance = (Number(openingBalance) || 0) - totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!date) { setError('Date is required'); return; }
    if (!paidTo.trim()) { setError('Paid To is required'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/account-master/cash-voucher/${voucherId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          date,
          paidTo,
          openingBalance: openingBalance === '' ? null : Number(openingBalance),
          paidBy,
          preparedBy,
          items: items
            .filter((it) => Number(it.amount) > 0)
            .map((it) => ({
              date: it.date || date,
              accountHead: it.accountHead,
              amount: Number(it.amount),
              description: it.description,
              billNo: it.billNo,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      router.push('/dashboard/account-master/cash-voucher');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit cash vouchers." />;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">
              Edit Cash Voucher {voucherno ? `— ${voucherno}` : ''}
            </h2>
            <p className="text-[11px] text-white/60 mt-0.5">Update voucher details and its expense line items.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/account-master/cash-voucher')}
            className="h-9 px-4 rounded-lg border border-white/40 bg-white/10 text-white text-xs font-bold hover:bg-white/20"
          >
            Back
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">{error}</div>}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <h3 className="text-xs font-bold text-slate-700 mb-3">Voucher Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className={lbl}>Company</label>
                <select value={company} onChange={(e) => setCompany(e.target.value)} className={ctrl}>
                  {CASH_VOUCHER_COMPANIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Sr. No.</label>
                <input type="text" value={voucherno} disabled className={`${ctrl} bg-slate-50 text-slate-400`} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Date *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={ctrl} required />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Paid To *</label>
                <input type="text" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} className={ctrl} placeholder="Paid to" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Opening Balance</label>
                <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={ctrl} placeholder="0.00" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Paid By</label>
                <input type="text" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={ctrl} placeholder="e.g. Cash" />
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl}>Prepared By</label>
                <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className={ctrl} placeholder="Prepared by" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700">Expense Line Items</h3>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E3093] hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
                    <th className="py-1.5 pr-2">Date</th>
                    <th className="py-1.5 pr-2">Account Head</th>
                    <th className="py-1.5 pr-2 text-right">Amount</th>
                    <th className="py-1.5 pr-2">Description</th>
                    <th className="py-1.5 pr-2">Bill No.</th>
                    <th className="py-1.5 pr-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2">
                        <input type="date" value={it.date} onChange={(e) => updateItem(i, { date: e.target.value })} className={`${ctrl} w-36`} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <select value={it.accountHead} onChange={(e) => updateItem(i, { accountHead: e.target.value })} className={`${ctrl} min-w-[180px]`}>
                          <option value="">Select…</option>
                          {accountHeads.map((h) => (
                            <option key={h.id} value={h.title}>{h.title}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="number" value={it.amount} onChange={(e) => updateItem(i, { amount: e.target.value })} className={`${ctrl} w-24 text-right`} placeholder="0.00" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="text" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} className={`${ctrl} min-w-[180px]`} placeholder="Being cash paid for…" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="text" value={it.billNo} onChange={(e) => updateItem(i, { billNo: e.target.value })} className={`${ctrl} w-24`} />
                      </td>
                      <td className="py-1.5 pr-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(i)}
                          disabled={items.length === 1}
                          className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 flex justify-end gap-6 text-xs font-semibold">
                <span className="text-slate-500">Total Expenses: <span className="text-slate-900">{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                <span className="text-slate-500">Closing Balance: <span className="text-slate-900">{closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252780] disabled:opacity-50"
            >
              {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/account-master/cash-voucher')}
              className="h-9 px-5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
