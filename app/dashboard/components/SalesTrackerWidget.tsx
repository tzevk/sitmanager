'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { WidgetSkeleton } from './Skeletons';
import { usePermissions } from '@/lib/permissions-context';

export const SCOREBOARD_UPDATED_EVENT = 'sales-scoreboard-updated';

interface TrackerRow {
  month: string;
  week: number;
  week_key: string;
  week_label: string;
  week_start: string;
  course: string;
  leads: number | null;
  qualified: number | null;
  meetings: number | null;
  proposals: number | null;
  negotiation: number | null;
  closures: number;
}

const STAGES = [
  { key: 'leads', label: 'Leads received' },
  { key: 'qualified', label: 'Qualified leads' },
  { key: 'meetings', label: 'Meetings held' },
  { key: 'proposals', label: 'Course recommendations' },
  { key: 'negotiation', label: 'Negotiation / decision' },
  { key: 'closures', label: 'Admissions closed' },
] as const;

type StageKey = typeof STAGES[number]['key'];

const monthName = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');
const sum = (rows: TrackerRow[], key: StageKey) => rows.reduce((t, r) => t + (Number(r[key]) || 0), 0);

export default function SalesTrackerWidget() {
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [dataThrough, setDataThrough] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState('');
  const [updated, setUpdated] = useState<{ at: string | null; by: string | null; file: string }>({ at: null, by: null, file: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { hasPermission } = usePermissions();
  const canUpload = hasPermission('sales_scoreboard.create');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/sales-scoreboard?view=tracker', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Could not load the sales tracker');
      setRows(data.rows || []);
      setDataThrough(data.dataThrough || '');
      setUpdated({ at: data.uploadedAt, by: data.uploadedBy, file: data.source || '' });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the sales tracker');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadMsg(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/dashboard/sales-scoreboard', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadMsg({
        ok: true,
        text: `Updated from ${file.name}: ${data.trackerWeeks} tracker weeks and ${data.employees.length} employee sheets.`,
      });
      setMonth('');
      await load();
      window.dispatchEvent(new Event(SCOREBOARD_UPDATED_EVENT));
    } catch (e) {
      setUploadMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const months = useMemo(() => [...new Set(rows.map((r) => r.month))].sort(), [rows]);
  const activeMonth = month || months[months.length - 1] || '';
  const monthRows = useMemo(() => rows.filter((r) => r.month === activeMonth), [rows, activeMonth]);
  const weeksInMonth = useMemo(() => [...new Set(monthRows.map((r) => r.week_label))], [monthRows]);

  const totals = useMemo(
    () => Object.fromEntries(STAGES.map((s) => [s.key, sum(monthRows, s.key)])) as Record<StageKey, number>,
    [monthRows]
  );
  const maxStage = Math.max(1, ...Object.values(totals));

  const weekly = useMemo(() => {
    const byWeek = new Map<string, { key: string; label: string; month: string; start: string; leads: number; closures: number }>();
    for (const r of rows) {
      const w = byWeek.get(r.week_key) ?? {
        key: r.week_key,
        label: `${new Date(`${r.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })} W${r.week}`,
        month: r.month,
        start: r.week_label,
        leads: 0,
        closures: 0,
      };
      w.leads += Number(r.leads) || 0;
      w.closures += r.closures || 0;
      byWeek.set(r.week_key, w);
    }
    return [...byWeek.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const byCourse = useMemo(() => {
    const map = new Map<string, Record<StageKey, number>>();
    for (const r of monthRows) {
      const c = map.get(r.course) ?? { leads: 0, qualified: 0, meetings: 0, proposals: 0, negotiation: 0, closures: 0 };
      for (const s of STAGES) c[s.key] += Number(r[s.key]) || 0;
      map.set(r.course, c);
    }
    return [...map.entries()]
      .map(([course, v]) => ({ course, ...v }))
      .sort((a, b) => b.closures - a.closures || b.leads - a.leads);
  }, [monthRows]);

  if (loading) return <WidgetSkeleton lines={6} />;

  return (
    <section id="sales-tracker-widget" className="bg-white rounded-2xl border border-[#2E3093]/10 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">Sales Tracker</h2>
          <p className="text-[11px] text-white/80 mt-0.5">
            {updated.at
              ? `Updated ${new Date(updated.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${updated.by ? ` by ${updated.by}` : ''}`
              : 'From the sales scoreboard sheet'}
            {dataThrough ? ` · entries up to ${new Date(`${dataThrough}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {canUpload && (
          <>
            <input
              ref={fileRef}
              id="sales-scoreboard-file"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-60"
            >
              {uploading
                ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" /></svg>}
              {uploading ? 'Uploading…' : 'Upload sheet'}
            </button>
          </>
        )}
        {months.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-white/80">Month</span>
            <select
              id="sales-tracker-month"
              value={activeMonth}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-slate-800"
            >
              {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </label>
        )}
        </div>
      </div>
      {uploadMsg && (
        <p className={`px-5 py-2 text-xs border-b ${uploadMsg.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
          {uploadMsg.text}
        </p>
      )}

      {error ? (
        <p className="p-5 text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No sales tracker figures yet.</p>
      ) : (
        <div className="p-5 space-y-6">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{totals.closures} admissions</span> from{' '}
            <span className="font-bold text-slate-900">{totals.leads.toLocaleString('en-IN')} leads</span> in {monthName(activeMonth)}{' '}
            ({pct(totals.closures, totals.leads)} lead-to-admission) across {weeksInMonth.length} week{weeksInMonth.length === 1 ? '' : 's'}.
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800">Pipeline · {monthName(activeMonth)}</h3>
              <p className="text-[11px] text-slate-500 mb-3">Each stage as counted on the sheet; % is of leads received.</p>
              <div className="space-y-2.5">
                {STAGES.map((s) => (
                  <div key={s.key} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-xs">
                    <span className="truncate text-slate-600">{s.label}</span>
                    <div className="h-5 rounded-md bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-md ${s.key === 'closures' ? 'bg-emerald-500' : 'bg-[#2A6BB5]'}`}
                        style={{ width: `${Math.max(2, (totals[s.key] / maxStage) * 100)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right tabular-nums">
                      <span className="font-bold text-slate-900">{totals[s.key].toLocaleString('en-IN')}</span>
                      <span className="ml-1.5 text-slate-400">{s.key === 'leads' ? '' : pct(totals[s.key], totals.leads)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800">Admissions closed per week</h3>
              <p className="text-[11px] text-slate-500 mb-3">All weeks on the sheet; the selected month is highlighted.</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(46,48,147,0.06)' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                      labelFormatter={(_, payload) => String(payload?.[0]?.payload?.start ?? '')}
                      formatter={(value, name) => [Number(value).toLocaleString('en-IN'), name === 'closures' ? 'Admissions' : String(name)]}
                    />
                    <Bar dataKey="closures" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {weekly.map((w) => (
                        <Cell key={w.key} fill={w.month === activeMonth ? '#2E3093' : '#c7d2fe'} />
                      ))}
                      <LabelList dataKey="closures" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">By course · {monthName(activeMonth)}</h3>
            <p className="text-[11px] text-slate-500 mb-3">Course names from the weekly sheets merged where they differ in spelling.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Course</th>
                    {STAGES.map((s) => (
                      <th key={s.key} className="text-right font-semibold px-3 py-2 whitespace-nowrap">{s.label}</th>
                    ))}
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Lead → admission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byCourse.map((c) => (
                    <tr key={c.course} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-semibold text-slate-800">{c.course}</td>
                      {STAGES.map((s) => (
                        <td key={s.key} className={`px-3 py-2 text-right tabular-nums ${s.key === 'closures' && c.closures > 0 ? 'font-bold text-emerald-700' : 'text-slate-700'}`}>
                          {c[s.key].toLocaleString('en-IN')}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{pct(c.closures, c.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
