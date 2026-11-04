'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Row {
  key: string; leads: number; contacted: number; withinTarget: number; within24h: number; neverContacted: number;
  medianMinutes: number | null; avgMinutes: number | null; converted: number; conversionPct: number; withinTargetPct: number;
}
interface Report {
  from: string; to: string; targetMinutes: number; totals: Row; byOwner: Row[]; bySource: Row[];
  slowest: { Inquiry_Id: number; Student_Name: string; owner: string; source: string; arrived: string; minutes: number | null }[];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ctrl = 'h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30';

function fmtMins(m: number | null): string {
  if (m == null) return '—';
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

function Table({ title, rows, target }: { title: string; rows: Row[]; target: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <p className="border-b border-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-right text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2 text-left">{title.replace('By ', '')}</th>
            <th className="px-3 py-2">Leads</th><th className="px-3 py-2">Contacted</th>
            <th className="px-3 py-2">≤ {fmtMins(target)}</th><th className="px-3 py-2">≤ 24h</th><th className="px-3 py-2">Never</th>
            <th className="px-3 py-2">Median</th><th className="px-3 py-2">Average</th>
            <th className="px-3 py-2">Admitted</th><th className="px-3 py-2">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-400">No leads in this range.</td></tr>}
          {rows.map(r => (
            <tr key={r.key} className="border-b border-slate-50 text-right">
              <td className="px-3 py-1.5 text-left font-semibold text-slate-800">{r.key}</td>
              <td className="px-3 py-1.5 font-bold">{r.leads}</td>
              <td className="px-3 py-1.5">{r.contacted}</td>
              <td className="px-3 py-1.5"><span className={r.withinTargetPct >= 80 ? 'font-bold text-emerald-600' : r.withinTargetPct >= 50 ? 'text-amber-600' : 'font-bold text-rose-600'}>{r.withinTarget} ({r.withinTargetPct}%)</span></td>
              <td className="px-3 py-1.5">{r.within24h}</td>
              <td className={`px-3 py-1.5 ${r.neverContacted ? 'font-bold text-rose-600' : ''}`}>{r.neverContacted}</td>
              <td className="px-3 py-1.5">{fmtMins(r.medianMinutes)}</td>
              <td className="px-3 py-1.5">{fmtMins(r.avgMinutes)}</td>
              <td className="px-3 py-1.5">{r.converted}</td>
              <td className="px-3 py-1.5 font-bold">{r.conversionPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeadResponseReportPage() {
  const { canView, loading: permLoading } = useResourcePermissions('report_inquiry');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return ymd(d); });
  const [to, setTo] = useState(() => ymd(new Date()));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/reports/lead-response?from=${from}&to=${to}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setData(d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    setLoading(false);
  }, [from, to]);
  useEffect(() => { if (canView) load(); }, [canView]); // eslint-disable-line react-hooks/exhaustive-deps

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view this report." />;

  const t = data?.totals;
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-black text-slate-900">Lead Response &amp; Conversion</h1>
          <p className="text-xs text-slate-500">
            How fast each lead got its first call (first staff discussion after the lead arrived) and how many became admissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={ctrl} />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={ctrl} />
          <button onClick={load} disabled={loading} className="h-8 rounded-lg bg-[#2E3093] px-4 text-xs font-bold text-white disabled:opacity-50">{loading ? 'Loading…' : 'Apply'}</button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

      {t && data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {([
              ['Leads', String(t.leads), 'text-slate-900'],
              [`Called ≤ ${fmtMins(data.targetMinutes)}`, `${t.withinTargetPct}%`, t.withinTargetPct >= 80 ? 'text-emerald-600' : 'text-rose-600'],
              ['Median first call', fmtMins(t.medianMinutes), 'text-slate-900'],
              ['Never contacted', String(t.neverContacted), t.neverContacted ? 'text-rose-600' : 'text-emerald-600'],
              ['Admitted', String(t.converted), 'text-[#2E3093]'],
              ['Conversion', `${t.conversionPct}%`, 'text-[#2E3093]'],
            ] as const).map(([label, value, c]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className={`text-2xl font-black ${c}`}>{value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          <Table title="By counsellor" rows={data.byOwner} target={data.targetMinutes} />
          <Table title="By source" rows={data.bySource} target={data.targetMinutes} />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <p className="border-b border-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Slowest / never contacted (not admitted)</p>
            <table className="w-full text-xs">
              <tbody>
                {data.slowest.map(s => (
                  <tr key={s.Inquiry_Id} className="border-b border-slate-50">
                    <td className="px-4 py-1.5"><Link href={`/dashboard/inquiry/add?editId=${s.Inquiry_Id}`} className="font-semibold text-[#2E3093] hover:underline">{s.Student_Name || `#${s.Inquiry_Id}`}</Link></td>
                    <td className="px-2 py-1.5 text-slate-600">{s.owner}</td>
                    <td className="px-2 py-1.5 text-slate-500">{s.source}</td>
                    <td className="px-2 py-1.5 text-slate-400">{s.arrived}</td>
                    <td className={`px-4 py-1.5 text-right font-bold ${s.minutes == null ? 'text-rose-600' : 'text-slate-700'}`}>{s.minutes == null ? 'Never' : fmtMins(s.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
