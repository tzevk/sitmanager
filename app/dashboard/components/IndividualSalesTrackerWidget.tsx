'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { WidgetSkeleton } from './Skeletons';
import { SCOREBOARD_UPDATED_EVENT } from './SalesTrackerWidget';

type Temperature = 'Hot' | 'Warm' | 'Cold' | 'Not tagged';

interface ProspectRow {
  date: string;
  week_start: string;
  prospect_ref: string;
  course: string;
  temperature: Temperature;
  follow_up_connected: 'Yes' | 'No' | '';
  outcome: 'Admitted' | 'Not interested' | 'Open' | 'Other';
  outcome_note: string;
  employee?: string;
}

const ALL = '__all';

interface Individual {
  employee: string;
  rows: ProspectRow[];
}

const TEMPS: { key: Temperature; color: string; text: string }[] = [
  { key: 'Hot', color: '#ef4444', text: 'text-red-700' },
  { key: 'Warm', color: '#f59e0b', text: 'text-amber-700' },
  { key: 'Cold', color: '#3b82f6', text: 'text-blue-700' },
  { key: 'Not tagged', color: '#cbd5e1', text: 'text-slate-500' },
];

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function IndividualSalesTrackerWidget() {
  const [people, setPeople] = useState<Individual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employee, setEmployee] = useState(ALL);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/sales-scoreboard?view=individual', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Could not load the individual tracker');
      setPeople(data.individuals || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the individual tracker');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(SCOREBOARD_UPDATED_EVENT, load);
    return () => window.removeEventListener(SCOREBOARD_UPDATED_EVENT, load);
  }, [load]);

  const showAll = employee === ALL || !people.some((p) => p.employee === employee);
  const person = showAll ? null : people.find((p) => p.employee === employee) ?? null;
  const rows = useMemo<ProspectRow[]>(
    () => (person ? person.rows : people.flatMap((p) => p.rows.map((r) => ({ ...r, employee: p.employee })))),
    [person, people]
  );

  const team = useMemo(
    () => people
      .map((p) => ({
        employee: p.employee,
        prospects: new Set(p.rows.map((r) => r.prospect_ref)).size,
        entries: p.rows.length,
        hot: p.rows.filter((r) => r.temperature === 'Hot').length,
        warm: p.rows.filter((r) => r.temperature === 'Warm').length,
        cold: p.rows.filter((r) => r.temperature === 'Cold').length,
        followUps: p.rows.filter((r) => r.follow_up_connected === 'Yes').length,
        admitted: p.rows.filter((r) => r.outcome === 'Admitted').length,
        last: p.rows.map((r) => r.date).sort().at(-1) ?? '',
      }))
      .sort((a, b) => b.admitted - a.admitted || b.prospects - a.prospects),
    [people]
  );

  const stats = useMemo(() => {
    const byTemp = Object.fromEntries(TEMPS.map((t) => [t.key, rows.filter((r) => r.temperature === t.key).length])) as Record<Temperature, number>;
    const dates = rows.map((r) => r.date).sort();
    return {
      entries: rows.length,
      unique: new Set(rows.map((r) => `${r.employee ?? ''}|${r.prospect_ref}`)).size,
      byTemp,
      followUps: rows.filter((r) => r.follow_up_connected === 'Yes').length,
      admitted: rows.filter((r) => r.outcome === 'Admitted').length,
      lost: rows.filter((r) => r.outcome === 'Not interested').length,
      from: dates[0],
      to: dates[dates.length - 1],
    };
  }, [rows]);

  const weekly = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const w = map.get(r.week_start) ?? { week: r.week_start, label: fmtDay(r.week_start), Hot: 0, Warm: 0, Cold: 0, 'Not tagged': 0 };
      w[r.temperature] = Number(w[r.temperature]) + 1;
      map.set(r.week_start, w);
    }
    return [...map.values()].sort((a, b) => String(a.week).localeCompare(String(b.week)));
  }, [rows]);

  const byCourse = useMemo(() => {
    const map = new Map<string, { course: string; entries: number; Hot: number; Warm: number; Cold: number; followUps: number; admitted: number }>();
    for (const r of rows) {
      const c = map.get(r.course) ?? { course: r.course, entries: 0, Hot: 0, Warm: 0, Cold: 0, followUps: 0, admitted: 0 };
      c.entries += 1;
      if (r.temperature !== 'Not tagged') c[r.temperature] += 1;
      if (r.follow_up_connected === 'Yes') c.followUps += 1;
      if (r.outcome === 'Admitted') c.admitted += 1;
      map.set(r.course, c);
    }
    return [...map.values()].sort((a, b) => b.admitted - a.admitted || b.entries - a.entries);
  }, [rows]);

  const outcomes = useMemo(() => rows.filter((r) => r.outcome !== 'Open').sort((a, b) => b.date.localeCompare(a.date)), [rows]);

  if (loading) return <WidgetSkeleton lines={6} />;

  const tiles = [
    { label: 'Prospects handled', value: stats.unique, note: `${stats.entries} entries` },
    { label: 'Hot', value: stats.byTemp.Hot, note: `${stats.byTemp.Warm} warm · ${stats.byTemp.Cold} cold` },
    { label: 'Follow-ups connected', value: stats.followUps, note: 'calls marked connected' },
    { label: 'Admissions closed', value: stats.admitted, note: `${stats.lost} not interested`, good: true },
  ];

  return (
    <section id="individual-sales-tracker-widget" className="bg-white rounded-2xl border border-[#2E3093]/10 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">Individual Sales Tracker · {person ? person.employee : 'All employees'}</h2>
          <p className="text-[11px] text-white/80 mt-0.5">
            {stats.from && stats.to ? `${fmtDay(stats.from)} – ${fmtDay(stats.to)} 2026 · ` : ''}from the employee&apos;s daily prospect sheet
          </p>
        </div>
        {people.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-white/80">Employee</span>
            <select
              id="individual-tracker-employee"
              value={person?.employee ?? ALL}
              onChange={(e) => setEmployee(e.target.value)}
              className="rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-slate-800"
            >
              <option value={ALL}>All employees</option>
              {people.map((p) => <option key={p.employee} value={p.employee}>{p.employee}</option>)}
            </select>
          </label>
        )}
      </div>

      {error ? (
        <p className="p-5 text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No prospect entries yet.</p>
      ) : (
        <div className="p-5 space-y-6">
          {showAll && (
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800">By employee</h3>
              <p className="text-[11px] text-slate-500 mb-3">Each salesperson&apos;s sheet. Click a row to see that person&apos;s tracker.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">Employee</th>
                      <th className="text-right font-semibold px-3 py-2">Prospects</th>
                      <th className="text-right font-semibold px-3 py-2">Hot</th>
                      <th className="text-right font-semibold px-3 py-2">Warm</th>
                      <th className="text-right font-semibold px-3 py-2">Cold</th>
                      <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Follow-ups</th>
                      <th className="text-right font-semibold px-3 py-2">Admitted</th>
                      <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Last entry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {team.map((t) => (
                      <tr key={t.employee} className="cursor-pointer hover:bg-indigo-50/60" onClick={() => setEmployee(t.employee)}>
                        <td className="px-3 py-2 font-semibold text-[#2E3093]">{t.employee}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.prospects}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.hot}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.warm}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.cold}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{t.followUps}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${t.admitted > 0 ? 'font-bold text-emerald-700' : 'text-slate-700'}`}>{t.admitted}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500 whitespace-nowrap">{t.last ? fmtDay(t.last) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.label}</p>
                <p className={`mt-1 text-2xl font-black tabular-nums ${t.good ? 'text-emerald-700' : 'text-slate-900'}`}>{t.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{t.note}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800">Lead temperature mix</h3>
              <p className="text-[11px] text-slate-500 mb-3">Share of {stats.entries} prospect entries by how they were marked.</p>
              <div className="flex h-6 w-full overflow-hidden rounded-md bg-slate-100 gap-[2px]">
                {TEMPS.filter((t) => stats.byTemp[t.key] > 0).map((t) => (
                  <div
                    key={t.key}
                    title={`${t.key}: ${stats.byTemp[t.key]}`}
                    style={{ width: `${(stats.byTemp[t.key] / stats.entries) * 100}%`, background: t.color }}
                  />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {TEMPS.map((t) => (
                  <li key={t.key} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: t.color }} />
                    <span className="text-slate-600">{t.key}</span>
                    <span className="ml-auto font-bold tabular-nums text-slate-900">{stats.byTemp[t.key]}</span>
                    <span className="w-12 text-right tabular-nums text-slate-400">{((stats.byTemp[t.key] / stats.entries) * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800">Prospects per week</h3>
              <p className="text-[11px] text-slate-500 mb-3">Weeks start on Monday.</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(46,48,147,0.06)' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                      labelFormatter={(label) => `Week of ${label}`}
                    />
                    <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                    {TEMPS.map((t, i) => (
                      <Bar key={t.key} dataKey={t.key} stackId="t" fill={t.color} maxBarSize={32}
                        radius={i === TEMPS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="min-w-0 xl:col-span-3">
              <h3 className="text-sm font-bold text-slate-800">By course</h3>
              <p className="text-[11px] text-slate-500 mb-3">Prospect entries and admissions for each training programme.</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">Course</th>
                      <th className="text-right font-semibold px-3 py-2">Entries</th>
                      <th className="text-right font-semibold px-3 py-2">Hot</th>
                      <th className="text-right font-semibold px-3 py-2">Warm</th>
                      <th className="text-right font-semibold px-3 py-2">Cold</th>
                      <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Follow-ups</th>
                      <th className="text-right font-semibold px-3 py-2">Admitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {byCourse.map((c) => (
                      <tr key={c.course} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-semibold text-slate-800">{c.course}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.entries}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.Hot}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.Warm}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.Cold}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{c.followUps}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${c.admitted > 0 ? 'font-bold text-emerald-700' : 'text-slate-700'}`}>{c.admitted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="min-w-0 xl:col-span-2">
              <h3 className="text-sm font-bold text-slate-800">Outcomes recorded</h3>
              <p className="text-[11px] text-slate-500 mb-3">Entries with a result in the Admission Closures column.</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 max-h-72 overflow-y-auto">
                {outcomes.map((r, i) => (
                  <li key={`${r.employee ?? ''}-${r.prospect_ref}-${r.date}-${i}`} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="w-14 shrink-0 tabular-nums text-slate-500">{fmtDay(r.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-800">{r.course}</span>
                      <span className="text-[11px] text-slate-400">{r.employee ? `${r.employee} · ` : ''}{r.prospect_ref} · {r.temperature}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      r.outcome === 'Admitted' ? 'bg-emerald-50 text-emerald-700'
                        : r.outcome === 'Not interested' ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.outcome === 'Other' ? r.outcome_note : r.outcome}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
