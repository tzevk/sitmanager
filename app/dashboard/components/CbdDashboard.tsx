/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

/* ── Utilities ────────────────────────────────────────────────────── */
function fmtPct(v: number) {
  return `${Number.isFinite(v) ? v.toFixed(1) : '0.0'}%`;
}

function clamp(v: number) {
  return Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));
}

function tone(v: number) {
  if (v >= 80) return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
  if (v >= 50) return { text: 'text-amber-600',   bar: 'bg-amber-400'   };
  return         { text: 'text-rose-600',   bar: 'bg-rose-500'   };
}

/* ── Shared primitives ────────────────────────────────────────────── */
function Bar({ value, className = '' }: { value: number; className?: string }) {
  const t = tone(value);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${clamp(value)}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${t.text}`}>
        {fmtPct(value)}
      </span>
    </div>
  );
}

function CardHeader({
  title,
  accent = '#2E3093',
  count,
  icon,
}: {
  title: string;
  accent?: string;
  count?: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)` }}
      >
        <span style={{ color: accent }} className="[&_svg]:w-3.5 [&_svg]:h-3.5">{icon}</span>
      </span>
      <span className="font-bold text-gray-800 text-sm flex-1">{title}</span>
      {count !== undefined && (
        <span className="text-[11px] font-semibold text-gray-400 tabular-nums">{count}</span>
      )}
    </div>
  );
}

function Empty({ text = 'No data available' }: { text?: string }) {
  return <p className="px-5 py-10 text-center text-sm text-gray-400">{text}</p>;
}

function PulseRows({ cols, rows = 4 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-5 py-3">
              <div
                className="h-3 bg-gray-100 rounded animate-pulse"
                style={{ width: j === 0 ? '70%' : '40%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th className={`py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
}

/* ── Icon set ─────────────────────────────────────────────────────── */
const Icons = {
  funnel:    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  target:    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  calendar:  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M8 4V2m8 2V2" /></svg>,
  star:      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  batch:     <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  bell:      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  activity:  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  pie:       <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
  wallet:    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M7 14h.01M11 14h.01M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" /></svg>,
  grad:      <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
};

/* ── Component ────────────────────────────────────────────────────── */
export default function CbdDashboard({ data, loading }: { data: any; loading: boolean }) {
  const annualTargets   = data?.annualTargets?.batchTargets ?? [];
  const seminarTargets  = data?.seminarTargets ?? [];
  const pendingFollowups = data?.pendingFollowups ?? [];
  const dailyActivity   = data?.dailyActivity ?? [];
  const pendingFees     = data?.pendingFees ?? [];
  const alumniProgress  = data?.alumniRegistration ?? [];
  const sourceRows      = data?.sourcePerformance ?? [];

  const upcomingBatches = (data?.upcomingBatches ?? []).filter((b: any) => {
    if (!b?.SDate) return false;
    const start = new Date(b.SDate);
    if (Number.isNaN(start.getTime())) return false;
    const now = new Date();
    const cap = new Date();
    cap.setMonth(cap.getMonth() + 3);
    return start >= now && start <= cap;
  });

  const leadSummary = data?.enquiryReport?.summary ?? {};
  const funnel = {
    total:     Number(leadSummary.total_enquiries        || 0),
    contacted: Number(data?.leadFunnel?.contacted        || 0),
    interested:Number(data?.leadFunnel?.interested       || 0),
    converted: Number(data?.leadFunnel?.converted        || 0),
  };

  const funnelSteps = [
    { label: 'Total Enquiries', value: funnel.total,     pct: null,                                                          color: '#2E3093' },
    { label: 'Contacted',       value: funnel.contacted, pct: funnel.total ? funnel.contacted  / funnel.total * 100 : null,  color: '#2A6BB5' },
    { label: 'Interested',      value: funnel.interested,pct: funnel.total ? funnel.interested / funnel.total * 100 : null,  color: '#059669' },
    { label: 'Converted',       value: funnel.converted, pct: funnel.total ? funnel.converted  / funnel.total * 100 : null,  color: '#D97706' },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* ①  Total Lead Funnel Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader title="Total Lead Funnel Summary" accent="#2E3093" icon={Icons.funnel} />
        {loading ? (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
            {funnelSteps.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center justify-center py-7 px-4 text-center relative">
                {i > 0 && i < 4 && (
                  <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10">
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{step.label}</p>
                <p className="text-4xl font-black tabular-nums leading-none" style={{ color: step.color }}>
                  {step.value.toLocaleString('en-IN')}
                </p>
                {step.pct !== null && (
                  <p className="text-[11px] text-gray-400 mt-2">{fmtPct(step.pct)} of total</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ②  Annual Targets */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader
          title="Annual Targets"
          accent="#2E3093"
          icon={Icons.target}
          count={loading ? undefined : annualTargets.length}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <Th>Training Program Name</Th>
                <Th center>Target Students</Th>
                <Th center>Students Admitted</Th>
                <Th center>Average Student per Batch</Th>
                <Th>Percentage Achieved</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <PulseRows cols={5} rows={5} />
              ) : annualTargets.length === 0 ? (
                <tr><td colSpan={5}><Empty text="No annual targets available" /></td></tr>
              ) : (
                annualTargets.map((row: any, i: number) => {
                  const minStu      = parseInt(row.min_students_batch) || 15;
                  const targetFreq  = Number(row.target_frequency) || 1;
                  const targetStu   = minStu * targetFreq;
                  const admitted    = Number(row.students_admitted) || 0;
                  const avg         = targetFreq > 0 ? admitted / targetFreq : 0;
                  const achieved    = targetStu > 0 ? (admitted / targetStu) * 100 : 0;
                  return (
                    <tr key={`${row.Course_Id || i}`} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{row.CourseName || '—'}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums text-gray-600">{targetStu}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums font-semibold text-gray-800">{admitted}</td>
                      <td className="px-4 py-3.5 text-center tabular-nums text-gray-500">{avg.toFixed(1)}</td>
                      <td className="px-4 py-3.5 w-44"><Bar value={achieved} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ③  Seminar Targets + Exhibition Targets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Seminar Targets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2">
          <CardHeader
            title="Seminar Targets"
            accent="#2A6BB5"
            icon={Icons.calendar}
            count={loading ? undefined : seminarTargets.length}
          />
          <div className="overflow-x-auto">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <Th>Month</Th>
                    <Th>College Names</Th>
                    <Th center>Date</Th>
                    <Th>Annual Percentage</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <PulseRows cols={4} />
                  ) : seminarTargets.length === 0 ? (
                    <tr><td colSpan={4}><Empty text="No seminar target records available" /></td></tr>
                  ) : (
                    seminarTargets.map((row: any, i: number) => (
                      <tr key={`${row.id || i}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-gray-500">{row.month || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{row.college_name || '—'}</td>
                        <td className="px-4 py-3 text-center tabular-nums text-gray-500">{row.date || '—'}</td>
                        <td className="px-4 py-3 w-40"><Bar value={Number(row.annual_percentage || 0)} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Exhibition Targets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader title="Exhibition Targets" accent="#2E3093" icon={Icons.star} />
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between px-5 py-5">
                <span className="text-sm text-gray-500 font-medium">Planned</span>
                <span className="text-3xl font-black tabular-nums text-[#2E3093]">
                  {data?.exhibitionTargets?.planned ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-5">
                <span className="text-sm text-gray-500 font-medium">Completed</span>
                <span className="text-3xl font-black tabular-nums text-emerald-600">
                  {data?.exhibitionTargets?.completed ?? 0}
                </span>
              </div>
              <div className="px-5 py-5">
                <p className="text-sm text-gray-500 font-medium mb-2.5">Achievement</p>
                <Bar value={Number(data?.exhibitionTargets?.achievement_pct || 0)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ④  Upcoming Batches (next 3 months) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <CardHeader
          title="Upcoming Batches (next 3 months)"
          accent="#2A6BB5"
          icon={Icons.batch}
          count={loading ? undefined : upcomingBatches.length}
        />
        <div className="overflow-x-auto">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <Th>Batch number</Th>
                  <Th>Training Program Name</Th>
                  <Th center>Enquiries Received</Th>
                  <Th center>Enquiries Contacted</Th>
                  <Th center>Interested Students</Th>
                  <Th center>Confirmed Admissions</Th>
                  <Th>% Filled</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <PulseRows cols={7} rows={5} />
                ) : upcomingBatches.length === 0 ? (
                  <tr><td colSpan={7}><Empty text="No upcoming batches for the next 3 months" /></td></tr>
                ) : (
                  upcomingBatches.map((b: any, i: number) => {
                    const confirmed = Number(b.NoStudent || 0);
                    const max       = Number(b.Max_Students || 0);
                    const fillPct   = max > 0 ? (confirmed / max) * 100 : 0;
                    return (
                      <tr key={`${b.Batch_Id || i}`} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-semibold text-gray-800">{b.Batch_code || '—'}</td>
                        <td className="px-4 py-3.5 text-gray-700">{b.CourseName || '—'}</td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-gray-600">{b.Enquiries_Received ?? 0}</td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-gray-600">{b.Enquiries_Contacted ?? 0}</td>
                        <td className="px-4 py-3.5 text-center tabular-nums text-gray-600">{b.Interested_Students ?? 0}</td>
                        <td className="px-4 py-3.5 text-center tabular-nums font-semibold text-gray-800">{confirmed}</td>
                        <td className="px-4 py-3.5 w-40"><Bar value={fillPct} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ⑤  Pending Followups · Daily Activity Tracker · Source Wise Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Pending Followups */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Pending Followups"
            accent="#DC2626"
            icon={Icons.bell}
            count={loading ? undefined : pendingFollowups.length}
          />
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : pendingFollowups.length === 0 ? (
              <Empty text="No pending followups" />
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingFollowups.map((f: any, i: number) => (
                  <div key={`${f.id || i}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                    <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {(f.name || f.student_name || 'F')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{f.name || f.student_name || 'Followup'}</p>
                      <p className="text-[11px] text-gray-400">{f.next_followup_date || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Activity Tracker */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader title="Daily Activity Tracker" accent="#2E3093" icon={Icons.activity} />
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : dailyActivity.length === 0 ? (
              <Empty text="No daily activity data" />
            ) : (
              <div className="divide-y divide-gray-100">
                {dailyActivity.map((a: any, i: number) => (
                  <div key={`${a.id || i}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50">
                    <span className="text-sm text-gray-600">{a.label || a.activity || '—'}</span>
                    <span className="text-xl font-black tabular-nums text-[#2E3093]">{a.value ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Source Wise Performance */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Source Wise Performance"
            accent="#2A6BB5"
            icon={Icons.pie}
            count={loading ? undefined : sourceRows.length}
          />
          <div className="max-h-64 overflow-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : sourceRows.length === 0 ? (
              <Empty text="No source data available" />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <Th>Source</Th>
                    <Th center>Leads</Th>
                    <Th center>Admissions</Th>
                    <Th>Conversion %</Th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((r: any, i: number) => {
                    const conv = Number(r.conversion_pct || 0);
                    const t = tone(conv);
                    return (
                      <tr key={`${r.source || i}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                        <td className="px-5 py-2.5 font-medium text-gray-700 truncate max-w-[8rem]">{r.source || '—'}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-gray-600">{r.leads ?? 0}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-gray-600">{r.admissions ?? 0}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-bold tabular-nums ${t.text}`}>{fmtPct(conv)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ⑥  Pending Fees · Alumni Registration Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Pending Fees */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Pending Fees"
            accent="#DC2626"
            icon={Icons.wallet}
            count={loading ? undefined : pendingFees.length}
          />
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : pendingFees.length === 0 ? (
              <Empty text="No pending fees" />
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingFees.map((f: any, i: number) => (
                  <div key={`${f.id || i}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                    <span className="text-sm text-gray-700 truncate max-w-[55%]">
                      {f.student_name || f.name || 'Student'}
                    </span>
                    <span className="text-sm font-bold text-rose-600 tabular-nums">
                      {f.amount ? `₹ ${Number(f.amount).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alumni Registration Progress */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <CardHeader
            title="Alumni Registration Progress"
            accent="#2E3093"
            icon={Icons.grad}
            count={loading ? undefined : alumniProgress.length}
          />
          <div className="max-h-64 overflow-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
              </div>
            ) : alumniProgress.length === 0 ? (
              <Empty text="No alumni registration data" />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    <Th>Batch No.</Th>
                    <Th>Training Program Name</Th>
                    <Th>% Registered</Th>
                  </tr>
                </thead>
                <tbody>
                  {alumniProgress.map((r: any, i: number) => (
                    <tr key={`${r.batch_no || i}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-mono text-gray-700">{r.batch_no || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{r.training_program || '—'}</td>
                      <td className="px-4 py-3 w-40"><Bar value={Number(r.registered_pct || 0)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
