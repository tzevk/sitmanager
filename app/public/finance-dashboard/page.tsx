'use client';

import { useMemo, useState } from 'react';

type FinanceTab = 'overview' | 'collections' | 'expenses' | 'outstanding' | 'reconciliation';

const TABS: Array<{ id: FinanceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'collections', label: 'Collections' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'reconciliation', label: 'Reconciliation' },
];

const collectionRows = [
  { stream: 'Online Admission', txns: 148, gross: 1749600, scholarship: 148500, refunds: 32500 },
  { stream: 'Walk-in Enrollment', txns: 59, gross: 708000, scholarship: 42000, refunds: 12000 },
  { stream: 'Corporate Tie-up', txns: 19, gross: 512000, scholarship: 28000, refunds: 21000 },
  { stream: 'Installment Carry Forward', txns: 43, gross: 279500, scholarship: 0, refunds: 0 },
];

const expenseRows = [
  { head: 'Faculty Payout', amount: 634000 },
  { head: 'Digital Marketing', amount: 182500 },
  { head: 'Center Operations', amount: 127800 },
  { head: 'Placement & Events', amount: 96800 },
  { head: 'Refund Bank Charges', amount: 4600 },
  { head: 'Software & Tools', amount: 56800 },
];

const outstandingRows = [
  { bucket: '0-30 Days', students: 38, amount: 286000 },
  { bucket: '31-60 Days', students: 21, amount: 214500 },
  { bucket: '61-90 Days', students: 14, amount: 167000 },
  { bucket: '90+ Days', students: 9, amount: 133000 },
];

const bankStatementCredits = 3039500;
const inTransit = 23500;
const priorPending = -12000;

function inr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PublicFinanceDashboardPage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');

  const collectionSummary = useMemo(() => {
    const gross = collectionRows.reduce((s, r) => s + r.gross, 0);
    const scholarship = collectionRows.reduce((s, r) => s + r.scholarship, 0);
    const refunds = collectionRows.reduce((s, r) => s + r.refunds, 0);
    const net = gross - scholarship - refunds;
    return { gross, scholarship, refunds, net };
  }, []);

  const totalExpense = useMemo(() => expenseRows.reduce((s, r) => s + r.amount, 0), []);
  const totalOutstanding = useMemo(() => outstandingRows.reduce((s, r) => s + r.amount, 0), []);
  const operatingSurplus = collectionSummary.net - totalExpense;
  const reconDifference = collectionSummary.net - (bankStatementCredits - inTransit + priorPending);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Public Auditor View</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Finance Dashboard (Dummy Data)</h1>
          <p className="mt-2 text-sm text-slate-600">
            This page uses sample mixed figures for demonstration. No live or student-sensitive financial records are shown.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === 'overview' && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Net Collection</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{inr(collectionSummary.net)}</p>
              <p className="mt-2 text-xs text-emerald-800">
                Working: {inr(collectionSummary.gross)} - {inr(collectionSummary.scholarship)} - {inr(collectionSummary.refunds)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700">Total Expense</p>
              <p className="mt-1 text-2xl font-bold text-rose-900">{inr(totalExpense)}</p>
              <p className="mt-2 text-xs text-rose-800">Working: Sum of all expense heads</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Operating Surplus</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{inr(operatingSurplus)}</p>
              <p className="mt-2 text-xs text-amber-800">Working: {inr(collectionSummary.net)} - {inr(totalExpense)}</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-violet-700">Receivables Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-violet-900">{inr(totalOutstanding)}</p>
              <p className="mt-2 text-xs text-violet-800">Working: Sum of aging buckets</p>
            </div>
          </section>
        )}

        {activeTab === 'collections' && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Collections</h2>
              <p className="text-sm text-slate-600">Net = Gross - Scholarship - Refunds</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Revenue Stream</th>
                    <th className="px-4 py-3 text-right font-semibold">Transactions</th>
                    <th className="px-4 py-3 text-right font-semibold">Gross</th>
                    <th className="px-4 py-3 text-right font-semibold">Scholarship</th>
                    <th className="px-4 py-3 text-right font-semibold">Refunds</th>
                    <th className="px-4 py-3 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionRows.map((row) => {
                    const net = row.gross - row.scholarship - row.refunds;
                    return (
                      <tr key={row.stream} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-900">{row.stream}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{row.txns}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{inr(row.gross)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{inr(row.scholarship)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{inr(row.refunds)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">{inr(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total Working</td>
                    <td className="px-4 py-3 text-right">{collectionRows.reduce((s, r) => s + r.txns, 0)}</td>
                    <td className="px-4 py-3 text-right">{inr(collectionSummary.gross)}</td>
                    <td className="px-4 py-3 text-right">{inr(collectionSummary.scholarship)}</td>
                    <td className="px-4 py-3 text-right">{inr(collectionSummary.refunds)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{inr(collectionSummary.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'expenses' && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Expense Ledger</h2>
              <p className="text-sm text-slate-600">All values are sample monthly figures.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Expense Head</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.map((row) => (
                    <tr key={row.head} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-900">{row.head}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{inr(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total Working</td>
                    <td className="px-4 py-3 text-right text-rose-700">{inr(totalExpense)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'outstanding' && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Receivables Aging</h2>
              <p className="text-sm text-slate-600">Outstanding = Sum of all aging buckets</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Aging Bucket</th>
                    <th className="px-4 py-3 text-right font-semibold">Students</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingRows.map((row) => (
                    <tr key={row.bucket} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-900">{row.bucket}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{row.students}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{inr(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total Working</td>
                    <td className="px-4 py-3 text-right">{outstandingRows.reduce((s, r) => s + r.students, 0)}</td>
                    <td className="px-4 py-3 text-right text-violet-700">{inr(totalOutstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'reconciliation' && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Bank Reconciliation (Working)</h2>
            <div className="mt-4 grid gap-3 text-sm sm:max-w-2xl">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span>Ledger Net Collection (A)</span>
                <span className="font-semibold">{inr(collectionSummary.net)}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span>Bank Statement Credits (B)</span>
                <span className="font-semibold">{inr(bankStatementCredits)}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span>Less: In Transit Deposits</span>
                <span className="font-semibold">{inr(inTransit)}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span>Add: Prior Pending Adjustment</span>
                <span className="font-semibold">{inr(priorPending)}</span>
              </div>
              <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-3 text-blue-900">
                <p className="font-semibold">
                  Reconciliation Difference = A - (B - In Transit + Prior Pending)
                </p>
                <p className="mt-1 text-lg font-bold">{inr(reconDifference)}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
