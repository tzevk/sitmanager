'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableHeader, TableSkeleton, EmptyRow, TotalRow, SectionTitle, thCls, tdCls, tdNum, trCls, PctBar, downloadCsv } from '../shared/primitives';
import { fmt, todayISO } from '../shared/format';
import type { PendingFee } from '../shared/types';
import { feeRecoveryPriority } from '../shared/predictions';

interface PlanRow {
  Plan_Id: number;
  Training_Program_Name: string;
  Target_Frequency: number;
  Min_Students_Per_Batch: number;
  Students_Admitted: number;
  Yearly_Students_Target: number;
  Frequency_Conducted: number;
  Percentage: number;
  Fees: number;
}

export default function CbdTab() {
  /* ── Annual targets (read-only from CBD dashboard masters) ── */
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [annualTargets, setAnnualTargets] = useState<PlanRow[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);

  const loadTargets = useCallback(async (y: number) => {
    setTargetsLoading(true);
    try {
      const res = await fetch(`/api/masters/annual-batch/plan?year=${y}`, { cache: 'no-store' });
      if (res.ok) {
        const all: PlanRow[] = (await res.json()).rows ?? [];
        setAnnualTargets(all.filter(r =>
          Number(r.Yearly_Students_Target) > 0 ||
          (Number(r.Target_Frequency) > 0 && Number(r.Min_Students_Per_Batch) > 0)
        ));
      } else {
        setAnnualTargets([]);
      }
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  useEffect(() => { loadTargets(year); }, [loadTargets, year]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  /* ── Pending Fees (read-only live from admission_master + s_fees_mst) ── */
  const [feeRows, setFeeRows]       = useState<PendingFee[]>([]);
  const [feesLoading, setFeesLoading] = useState(true);
  const [feeSearch, setFeeSearch]   = useState('');

  const loadFees = useCallback(async (q: string) => {
    setFeesLoading(true);
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const res = await fetch(`/api/finance/pending-fees-live${params}`, { cache: 'no-store' });
      if (res.ok) setFeeRows((await res.json()).rows ?? []);
      else setFeeRows([]);
    } finally {
      setFeesLoading(false);
    }
  }, []);

  useEffect(() => { loadFees(''); }, [loadFees]);

  /* debounce search — refetch after 400 ms of inactivity */
  useEffect(() => {
    const t = setTimeout(() => loadFees(feeSearch), 400);
    return () => clearTimeout(t);
  }, [feeSearch, loadFees]);

  const today = todayISO();

  const exportFees = useCallback(() => {
    downloadCsv(`pending-fees-${today}.csv`, feeRows.map(r => ({
      Student: r.student_name,
      'Batch / Programme': r.batch,
      'Total Fees': r.total_fees,
      Paid: r.paid,
      Pending: Math.max(0, Number(r.total_fees) - Number(r.paid)),
    })));
  }, [feeRows, today]);

  const priorityMap = useMemo(() => {
    const items = feeRecoveryPriority(feeRows, today);
    return new Map(items.map(item => [(item.row as PendingFee).id, item]));
  }, [feeRows, today]);

  const feeTotals = useMemo(() => ({
    total:   feeRows.reduce((s, r) => s + Number(r.total_fees), 0),
    paid:    feeRows.reduce((s, r) => s + Number(r.paid), 0),
    pending: feeRows.reduce((s, r) => s + Math.max(0, Number(r.total_fees) - Number(r.paid)), 0),
  }), [feeRows]);

  return (
    <div className="space-y-6">
      {/* ── Yearly Performance ────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>CBD / Inhouse Training — Yearly Performance</SectionTitle>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="text-xs font-semibold rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Training Programme</th>
              <th className={`${thCls} text-center`}>Target Freq.</th>
              <th className={`${thCls} text-center`}>Freq. Conducted</th>
              <th className={`${thCls} text-center`}>Target Students</th>
              <th className={`${thCls} text-center`}>Students Admitted</th>
              <th className={`${thCls} text-center`}>Fees (₹)</th>
              <th className={`${thCls} text-center`}>Target Fees (₹)</th>
              <th className={`${thCls} text-center`}>Fees Received (₹)</th>
              <th className={`${thCls} text-center`}>% Achievement</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {targetsLoading ? <TableSkeleton cols={9} /> :
               annualTargets.length === 0 ? <EmptyRow cols={9} message={`No annual targets found for ${year}.`} /> :
               annualTargets.map((r, i) => {
                const tgt          = Number(r.Yearly_Students_Target) || (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch));
                const adm          = Number(r.Students_Admitted) || 0;
                const fees         = Number(r.Fees) || 0;
                const feesTarget   = fees * tgt;
                const feesReceived = fees * adm;
                const pct          = Number(r.Percentage) || (tgt > 0 ? (adm / tgt) * 100 : 0);
                return (
                  <tr key={r.Plan_Id} className={trCls(i)}>
                    <td className={tdCls}>{r.Training_Program_Name}</td>
                    <td className={tdNum}>{r.Target_Frequency}</td>
                    <td className={tdNum}>{r.Frequency_Conducted}</td>
                    <td className={tdNum}>{tgt.toLocaleString('en-IN')}</td>
                    <td className={tdNum}>{adm.toLocaleString('en-IN')}</td>
                    <td className={tdNum}>{fees ? fmt(fees) : '—'}</td>
                    <td className={tdNum}>{feesTarget ? fmt(feesTarget) : '—'}</td>
                    <td className={tdNum}>{feesReceived ? fmt(feesReceived) : '—'}</td>
                    <td className={tdNum}><PctBar value={pct} denominator={100} /></td>
                  </tr>
                );
               })}
              {annualTargets.length > 0 && (
                <TotalRow>
                  <td className="px-3 py-2 text-xs text-[#2E3093]">Total ({annualTargets.length})</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{annualTargets.reduce((s, r) => s + Number(r.Target_Frequency), 0)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{annualTargets.reduce((s, r) => s + Number(r.Frequency_Conducted), 0)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">
                    {annualTargets.reduce((s, r) => s + (Number(r.Yearly_Students_Target) || (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch))), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{annualTargets.reduce((s, r) => s + Number(r.Students_Admitted), 0).toLocaleString('en-IN')}</td>
                  <td />
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">
                    {fmt(annualTargets.reduce((s, r) => {
                      const tgt = Number(r.Yearly_Students_Target) || (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch));
                      return s + (Number(r.Fees) * tgt);
                    }, 0))}
                  </td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">
                    {fmt(annualTargets.reduce((s, r) => s + (Number(r.Fees) * Number(r.Students_Admitted)), 0))}
                  </td>
                  <td />
                </TotalRow>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pending Fees ──────────────────────────────── */}
      <div>
        <TableHeader
          title="Pending Fees"
          extra={
            <>
              <input
                type="text"
                placeholder="Search student, batch, course…"
                value={feeSearch}
                onChange={e => setFeeSearch(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
              <button
                onClick={exportFees}
                disabled={feeRows.length === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Export
              </button>
            </>
          }
        />
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead><tr className="bg-[#2E3093]">
              <th className={thCls}>Student Name</th>
              <th className={thCls}>Batch / Programme</th>
              <th className={`${thCls} text-center`}>Total Fees (₹)</th>
              <th className={`${thCls} text-center`}>Paid (₹)</th>
              <th className={`${thCls} text-center`}>Pending (₹)</th>
              <th className={`${thCls} text-center`}>Recovery Priority</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {feesLoading ? <TableSkeleton cols={6} /> :
               feeRows.length === 0 ? <EmptyRow cols={6} message="No pending fees found." /> :
               feeRows.map((r, i) => {
                 const pending = Math.max(0, Number(r.total_fees) - Number(r.paid));
                 const pri = priorityMap.get(r.id);
                 return (
                   <tr key={r.id} className={trCls(i)}>
                     <td className={tdCls}>{r.student_name}</td>
                     <td className={tdCls}>{r.batch}</td>
                     <td className={tdNum}>{fmt(r.total_fees)}</td>
                     <td className={tdNum}>{fmt(r.paid)}</td>
                     <td className={`${tdNum} text-red-600 font-medium`}>{fmt(pending)}</td>
                     <td className={tdNum}>
                       {pri ? (
                         <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                           pri.priority === 'HIGH'   ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                           pri.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' :
                                                       'bg-gray-100 text-gray-500'
                         }`}>
                           {pri.priority === 'HIGH' ? '⚠️' : pri.priority === 'MEDIUM' ? '●' : ''} {pri.priority}
                         </span>
                       ) : <span className="text-[10px] text-gray-400">—</span>}
                     </td>
                   </tr>
                 );
               })}
              {feeRows.length > 0 && (
                <TotalRow>
                  <td colSpan={2} className="px-3 py-2 text-xs text-[#2E3093]">Total ({feeRows.length})</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(feeTotals.total)}</td>
                  <td className="px-3 py-2 text-xs text-center text-[#2E3093]">{fmt(feeTotals.paid)}</td>
                  <td className="px-3 py-2 text-xs text-center text-red-600">{fmt(feeTotals.pending)}</td>
                  <td />
                </TotalRow>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
