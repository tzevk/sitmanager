'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface CalendlyBooking {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  eventStartTime: string | null;
  eventType: string | null;
  questions: { question: string; answer: string }[];
  receivedAt: string;
  calledAt: string | null;
  inquiryId: number | null;
  minutesSinceReceived: number;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return '—'; }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return '—'; }
}

function TimerBadge({ minutesSince }: { minutesSince: number }) {
  const minsLeft = Math.max(0, 30 - minutesSince);
  const isUrgent = minsLeft <= 10;
  const isWarning = minsLeft <= 20;
  const cls = isUrgent
    ? 'bg-red-100 text-red-700 font-black animate-pulse border border-red-300'
    : isWarning
      ? 'bg-amber-100 text-amber-700 font-bold border border-amber-300'
      : 'bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] ${cls}`}>
      {minsLeft === 0 ? 'OVERDUE!' : `${minsLeft}m left`}
    </span>
  );
}

export default function AppointmentsPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view appointments." />;

  return <AppointmentsContent canUpdate={canUpdate} />;
}

function AppointmentsContent({ canUpdate }: { canUpdate: boolean }) {
  const router = useRouter();
  const [bookings, setBookings] = useState<CalendlyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [windowHours, setWindowHours] = useState(4);
  const [showCalled, setShowCalled] = useState(false);
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        windowHours: String(windowHours),
        uncalledOnly: showCalled ? '0' : '1',
      });
      const res = await fetch(`/api/calendly/bookings?${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [windowHours, showCalled]);

  useEffect(() => {
    setLoading(true);
    fetchBookings();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchBookings();
      setTick(t => t + 1);
    }, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchBookings]);

  const markCalled = async (id: number) => {
    setMarkingId(id);
    try {
      await fetch('/api/calendly/webhook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, called: true }),
      });
      await fetchBookings();
    } catch { /* ignore */ }
    finally { setMarkingId(null); }
  };

  const handleConvert = (b: CalendlyBooking) => {
    const params = new URLSearchParams();
    if (b.name) params.set('prefillName', b.name);
    if (b.email) params.set('prefillEmail', b.email);
    if (b.mobile) params.set('prefillMobile', b.mobile);
    const notesFromQA = (b.questions || []).map(q => `${q.question}: ${q.answer}`).join('\n');
    if (notesFromQA) params.set('prefillNotes', notesFromQA);
    params.set('calendlyBookingId', String(b.id));
    params.set('returnTo', encodeURIComponent('/dashboard/appointments'));
    router.push(`/dashboard/inquiry/add?${params}`);
  };

  const uncalled = bookings.filter(b => !b.calledAt);
  const called   = bookings.filter(b =>  b.calledAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#2E3093]">Appointments</h1>
          <p className="text-xs text-gray-500 mt-0.5">Calendly bookings — call within 30 minutes of receipt</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCalled}
              onChange={e => setShowCalled(e.target.checked)}
              className="rounded"
            />
            Show called
          </label>
          <select
            value={windowHours}
            onChange={e => setWindowHours(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20"
          >
            <option value={2}>Last 2 hrs</option>
            <option value={4}>Last 4 hrs</option>
            <option value={8}>Last 8 hrs</option>
            <option value={24}>Last 24 hrs</option>
          </select>
          <button
            onClick={() => { setLoading(true); fetchBookings(); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      )}

      {/* Uncalled */}
      {!loading && (
        <>
          {uncalled.length === 0 ? (
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-6 py-10 text-center">
              <svg className="w-10 h-10 mx-auto text-emerald-400 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-emerald-700">All clear — no pending appointments</p>
              <p className="text-xs text-emerald-500 mt-1">New Calendly bookings will appear here automatically</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden shadow-md ring-1 ring-[#0ae448]/40"
              style={{ background: 'linear-gradient(135deg, #00a2ff 0%, #0ae448 100%)' }}>
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <span className="text-white font-black text-sm flex-1 drop-shadow">
                  🔔 {uncalled.length} Pending Appointment{uncalled.length > 1 ? 's' : ''} — Call Within 30 Minutes
                </span>
              </div>
              <div className="bg-white overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#0070cc] bg-gradient-to-r from-blue-50 to-green-50 border-b border-blue-100">
                      <th className="text-left py-2 px-3 font-black">#</th>
                      <th className="text-left py-2 px-3 font-black">Name</th>
                      <th className="text-left py-2 px-3 font-black">Mobile</th>
                      <th className="text-left py-2 px-3 font-black">Email</th>
                      <th className="text-left py-2 px-3 font-black">Questions</th>
                      <th className="text-left py-2 px-3 font-black">Event Time</th>
                      <th className="text-left py-2 px-3 font-black">Received</th>
                      <th className="text-center py-2 px-3 font-black">⏱ Time Left</th>
                      <th className="text-center py-2 px-3 font-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uncalled.map((b, i) => (
                      <tr key={b.id} className={`border-b border-blue-100/60 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'} hover:bg-blue-50/60`}>
                        <td className="py-2.5 px-3 text-slate-400 tabular-nums">{i + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{b.name || '—'}</td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {b.mobile
                            ? <a href={`tel:${b.mobile}`} className="text-blue-600 hover:underline font-bold">{b.mobile}</a>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-[180px]">
                          <span className="truncate block">{b.email || '—'}</span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[280px]">
                          {b.questions && b.questions.length > 0 ? (
                            <div className="space-y-0.5">
                              {b.questions.map((q, qi) => (
                                <div key={qi} className="text-[10px] leading-snug">
                                  <span className="font-semibold text-slate-500">{q.question}:</span>{' '}
                                  <span className="text-slate-700">{q.answer}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatDateTime(b.eventStartTime)}</td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatTime(b.receivedAt)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <TimerBadge minutesSince={b.minutesSinceReceived} />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              title="Mark as Called"
                              disabled={markingId === b.id || !canUpdate}
                              onClick={() => markCalled(b.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-blue-500 to-emerald-500 text-white hover:from-blue-600 hover:to-emerald-600 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
                            >
                              {markingId === b.id ? (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              )}
                              Called
                            </button>
                            <button
                              title="Convert to Inquiry"
                              disabled={!canUpdate}
                              onClick={() => handleConvert(b)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border-2 border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                              Convert to Inquiry
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Called section */}
          {showCalled && called.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-bold text-slate-600">Called ({called.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-bold">Name</th>
                      <th className="text-left py-2 px-3 font-bold">Mobile</th>
                      <th className="text-left py-2 px-3 font-bold">Email</th>
                      <th className="text-left py-2 px-3 font-bold">Questions</th>
                      <th className="text-left py-2 px-3 font-bold">Received</th>
                      <th className="text-left py-2 px-3 font-bold">Called At</th>
                      <th className="text-center py-2 px-3 font-bold">Inquiry</th>
                      <th className="text-center py-2 px-3 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {called.map((b, i) => (
                      <tr key={b.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">{b.name || '—'}</td>
                        <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {b.mobile
                            ? <a href={`tel:${b.mobile}`} className="text-blue-600 hover:underline">{b.mobile}</a>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-500 max-w-[160px]">
                          <span className="truncate block">{b.email || '—'}</span>
                        </td>
                        <td className="py-2 px-3 max-w-[240px]">
                          {b.questions && b.questions.length > 0 ? (
                            <div className="space-y-0.5">
                              {b.questions.map((q, qi) => (
                                <div key={qi} className="text-[10px] leading-snug">
                                  <span className="font-semibold text-slate-400">{q.question}:</span>{' '}
                                  <span className="text-slate-600">{q.answer}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDateTime(b.receivedAt)}</td>
                        <td className="py-2 px-3 text-emerald-600 font-semibold whitespace-nowrap">{formatDateTime(b.calledAt)}</td>
                        <td className="py-2 px-3 text-center">
                          {b.inquiryId ? (
                            <button
                              onClick={() => router.push(`/dashboard/inquiry/add?editId=${b.inquiryId}`)}
                              className="text-[10px] font-bold text-blue-600 hover:underline"
                            >
                              #{b.inquiryId}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConvert(b)}
                              disabled={!canUpdate}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5 transition-colors disabled:opacity-40"
                            >
                              Convert
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {!b.inquiryId && (
                            <button
                              onClick={() => handleConvert(b)}
                              disabled={!canUpdate}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border-2 border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5 transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                              Convert to Inquiry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
