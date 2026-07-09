'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface VoucherRow {
  id: number;
  company: string | null;
  voucherno: string | null;
  date: string | null;
  paidto: string | null;
  paidby: string | null;
  prepaired_by: string | null;
  opening_balance: number | null;
  total_amount: number;
}

interface VoucherItem {
  id: number;
  bill_no: string | null;
  date: string | null;
  account_head: string | null;
  amount: number;
  description: string | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number }

const fmtMoney = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDateDMY = (d: string | null | undefined) => {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
};

// Converts a rupee amount into words (Indian numbering: lakh/crore), matching the
// "Two hundred Ten" style seen on the real cash voucher printout.
function amountToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;
  };
  const threeDigits = (n: number): string => {
    if (n < 100) return twoDigits(n);
    return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ' ' + twoDigits(n % 100) : ''}`;
  };

  const rupees = Math.floor(Math.abs(amount));
  if (rupees === 0) return 'Zero';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  return parts.join(' ').trim();
}

export default function CashVoucherPage() {
  const router = useRouter();
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('finance');
  const [printingId, setPrintingId] = useState<number | null>(null);

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (search) params.set('search', search);

      const res = await fetch(`/api/account-master/cash-voucher?${params.toString()}`);
      const data = await res.json();
      setRows(data.vouchers ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPage(1);
      setFetchTrigger((t) => t + 1);
    }
  };

  const handleDelete = async (row: VoucherRow) => {
    if (!window.confirm(`Delete cash voucher ${row.voucherno}? This cannot be undone from the UI.`)) return;
    try {
      const res = await fetch(`/api/account-master/cash-voucher/${row.id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch {
      /* ignore */
    }
  };

  const handlePrint = async (row: VoucherRow) => {
    setPrintingId(row.id);
    try {
      const res = await fetch(`/api/account-master/cash-voucher/${row.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load voucher');

      const items: VoucherItem[] = data.items ?? [];
      const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

      const w = window.open('', '_blank', 'width=900,height=1150');
      if (!w) return;
      const logo = `${window.location.origin}/sit.png`;

      // Fixed 8-row table, same as the real printed voucher — pad with blank rows,
      // and if there happen to be more than 8 items just keep going past 8.
      const rowCount = Math.max(8, items.length);
      const bodyRows = Array.from({ length: rowCount }, (_, i) => {
        const it = items[i];
        return `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${it?.date ? fmtDateDMY(it.date) : ''}</td>
          <td>${it?.bill_no || ''}</td>
          <td>${it?.account_head || ''}</td>
          <td class="amt">${it?.amount ? fmtMoney(it.amount).replace(/\.00$/, '') : ''}</td>
          <td>${it?.description || ''}</td>
        </tr>`;
      }).join('');

      w.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Cash Voucher ${row.voucherno}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 12px; }
  .sheet { width: 860px; margin: 0 auto; padding: 28px; }
  .logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: -1px; }
  .logo-row img { width: 70px; height: auto; }
  .frame { border: 2px solid #000; border-radius: 10px; overflow: hidden; }
  .top { display: flex; }
  .top .company { flex: 1.6; padding: 8px 10px; border-right: 1px solid #000; }
  .top .company .name { font-weight: 700; font-size: 12.5px; }
  .top .company .addr { font-size: 11px; margin-top: 2px; }
  .top .title { flex: 0.8; padding: 8px 10px; border-right: 1px solid #000; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 700; font-size: 14px; }
  .top .meta { flex: 1.6; display: flex; flex-direction: column; }
  .top .meta .row { display: flex; border-bottom: 1px solid #000; }
  .top .meta .row:last-child { border-bottom: none; }
  .top .meta .row > div { padding: 6px 10px; }
  .top .meta .row > div:first-child { border-right: 1px solid #000; }
  table.items { width: 100%; border-collapse: collapse; border-top: 1px solid #000; }
  table.items th, table.items td { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 8px; text-align: left; vertical-align: top; }
  table.items th:last-child, table.items td:last-child { border-right: none; }
  table.items th { background: #f2f2f2; font-size: 11px; }
  .num { text-align: center; width: 30px; }
  .amt { text-align: right; white-space: nowrap; }
  .footer-row { display: flex; border-bottom: 1px solid #000; }
  .footer-row > div { padding: 6px 10px; border-right: 1px solid #000; }
  .footer-row > div:last-child { border-right: none; flex: 1; }
  .sign-row { display: flex; }
  .sign-row > div { flex: 1; padding: 18px 10px 6px; border-right: 1px solid #000; text-align: center; font-weight: 700; font-size: 11px; }
  .sign-row > div:last-child { border-right: none; }
  .sign-row .name { font-weight: 400; display: block; margin-bottom: 2px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head>
<body>
  <div class="sheet">
    <div class="logo-row"><img src="${logo}" alt="SIT" /></div>
    <div class="frame">
      <div class="top">
        <div class="company">
          <div class="name">SUVIDYA INSTITUTE OF TECHNOLOGY PVT. LTD.</div>
          <div class="addr">18/140, ANAND NAGAR, NEHRU ROAD, VAKOLA,<br/>SANTACRUZ(E), MUMBAI - 400 055.</div>
        </div>
        <div class="title">CASH<br/>VOUCHER</div>
        <div class="meta">
          <div class="row">
            <div>Sr. No. : <strong>${row.voucherno || ''}</strong></div>
            <div>Date : <strong>${fmtDateDMY(row.date)}</strong></div>
          </div>
          <div class="row">
            <div style="flex:1; border-right:none;">Paid To : <strong>${row.paidto || ''}</strong></div>
          </div>
        </div>
      </div>
      <table class="items">
        <thead>
          <tr>
            <th class="num">Sr.<br/>No.</th>
            <th>Bill Date</th>
            <th>Bill No</th>
            <th>Account Head</th>
            <th class="amt">Amount</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="footer-row">
        <div>Paid By : ${row.paidby || ''}</div>
        <div>Total : ${fmtMoney(total)}</div>
        <div>${amountToWords(total)}</div>
      </div>
      <div class="sign-row">
        <div><span class="name">${row.prepaired_by || ''}</span>PREPARED BY</div>
        <div>CHECKED BY</div>
        <div>APPROVED BY</div>
        <div>RECEIVERS SIGNATURE</div>
      </div>
    </div>
  </div>
  <script>window.onload = () => window.print();</script>
</body></html>`);
      w.document.close();
    } catch {
      /* ignore */
    } finally {
      setPrintingId(null);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view cash vouchers." />;

  return (
    <div className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <div className="shrink-0 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Cash Voucher</h2>
            <p className="text-[11px] text-white/60 mt-0.5">All cash vouchers recorded in the system</p>
          </div>
          {canCreate && (
            <Link
              href="/dashboard/account-master/cash-voucher/add"
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Cash Voucher
            </Link>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
          {pagination.total.toLocaleString()} total
        </span>
        <div className="flex-1" />
        <div className="relative">
          <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search voucher no, paid to, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-64 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto border-b border-slate-100">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">#</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">Voucher No</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">Date</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">Company</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">Paid To</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">Prepared By</th>
                <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">Opening Balance</th>
                <th className="text-right py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-r border-slate-200">Total Amount</th>
                <th className="text-center py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-6 text-center text-xs text-slate-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center text-xs text-slate-400">No cash vouchers found</td></tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-xs text-slate-400 border-b border-r border-slate-100">{(pagination.page - 1) * pagination.limit + i + 1}</td>
                    <td className="py-2 px-3 text-xs border-b border-r border-slate-100 font-mono font-semibold text-[#2E3093]">{row.voucherno || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-r border-slate-100">{fmtDateDMY(row.date) || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-r border-slate-100">{row.company || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-r border-slate-100 font-medium truncate max-w-[180px]" title={row.paidto || ''}>{row.paidto || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-r border-slate-100">{row.prepaired_by || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-r border-slate-100 text-right font-mono">{row.opening_balance != null ? fmtMoney(row.opening_balance) : '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-r border-slate-100 text-right font-mono font-semibold">{fmtMoney(row.total_amount)}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePrint(row)}
                          disabled={printingId === row.id}
                          className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/20 disabled:opacity-50"
                        >
                          Print
                        </button>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/account-master/cash-voucher/edit/${row.id}`)}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold hover:bg-amber-100"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-[11px] font-semibold hover:bg-red-100"
                          >
                            Delete
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

        {pagination.totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-3 py-2">
            <span className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} total)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
