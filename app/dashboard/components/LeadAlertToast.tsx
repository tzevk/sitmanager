'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LeadAlert {
  id: number;
  kind: 'lead_assigned' | 'lead_unassigned' | 'lead_uncontacted' | string;
  title: string;
  link: string | null;
  inquiryId: number | null;
  createdAt: string;
  name?: string;
  course?: string | null;
  source?: string | null;
  minutes?: number;
  reason?: string;
}

const POLL_MS = 60 * 1000;
const MAX_SHOWN = 4;

const KIND_STYLE: Record<string, string> = {
  lead_assigned: 'bg-emerald-100 text-emerald-700',
  lead_uncontacted: 'bg-orange-100 text-orange-700',
  lead_unassigned: 'bg-rose-100 text-rose-700',
};
const KIND_LABEL: Record<string, string> = {
  lead_assigned: 'New',
  lead_uncontacted: 'Not called',
  lead_unassigned: 'Unassigned',
};

/**
 * App-wide new-lead alert. Polls the signed-in user's unread lead notifications every minute
 * (and when the tab becomes visible). Opening a lead or dismissing marks the alerts read on the
 * server, so they don't come back on other devices.
 */
export default function LeadAlertToast() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<LeadAlert[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/inquiry/lead-alerts', { cache: 'no-store' });
        if (r.status === 401 || r.status === 403) return;
        const d = await r.json();
        if (!stopped && r.ok) setAlerts(d.alerts || []);
      } catch { /* network blip — retry next tick */ }
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, POLL_MS);
    };
    poll();
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const markRead = useCallback(async (ids: number[] | 'all') => {
    setAlerts((prev) => (ids === 'all' ? [] : prev.filter((a) => !ids.includes(a.id))));
    try {
      await fetch('/api/inquiry/lead-alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
      });
    } catch { /* it reappears on the next poll */ }
  }, []);

  if (!alerts.length) return null;
  const shown = alerts.slice(0, MAX_SHOWN);

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[calc(100%-2rem)] max-w-sm" role="alert" aria-live="assertive">
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center gap-2 bg-emerald-600 px-4 py-2.5 text-white">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <p className="flex-1 text-sm font-bold">Lead alerts ({alerts.length})</p>
          <button onClick={() => markRead('all')} className="rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Dismiss all">✕</button>
        </div>
        <ul className="divide-y divide-slate-100">
          {shown.map((a) => (
            <li key={a.id} className="flex items-start gap-2 px-4 py-2.5">
              <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_STYLE[a.kind] ?? 'bg-slate-100 text-slate-600'}`}>
                {KIND_LABEL[a.kind] ?? 'Lead'}
              </span>
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => { markRead([a.id]); if (a.link) router.push(a.link); }}
              >
                <p className="truncate text-sm font-semibold text-slate-900">{a.name || `Inquiry #${a.inquiryId}`}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {[a.course, a.source].filter(Boolean).join(' · ') || a.title}
                  {a.kind === 'lead_uncontacted' && a.minutes != null && ` · waiting ${a.minutes} min`}
                  {a.kind === 'lead_assigned' && a.minutes != null && ` · call within ${a.minutes} min`}
                </p>
              </button>
            </li>
          ))}
          {alerts.length > shown.length && <li className="px-4 py-2 text-[11px] text-slate-400">+{alerts.length - shown.length} more</li>}
        </ul>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-2.5">
          <button onClick={() => markRead('all')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Dismiss</button>
          <button
            onClick={() => { markRead('all'); router.push('/dashboard/my-tasks'); }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Open My Tasks
          </button>
        </div>
      </div>
    </div>
  );
}
