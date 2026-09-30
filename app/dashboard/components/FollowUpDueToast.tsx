'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DueFollowUp {
  Inquiry_Id: number;
  Student_Name: string;
  CourseName: string | null;
  NextFollowUpDate: string;
  Days_Overdue: number;
}

const POLL_MS = 5 * 60 * 1000;
const DISMISS_KEY = 'inquiryFollowUpToastDismissed';
const MAX_NAMES = 3;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Inquiry ids the viewer already dismissed today. A new day, or a newly due
 * follow-up not in this list, brings the toast back. */
function readDismissed(): Set<number> {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || 'null');
    if (raw && raw.date === todayKey() && Array.isArray(raw.ids)) return new Set(raw.ids.map(Number));
  } catch { /* storage blocked or corrupt — treat as nothing dismissed */ }
  return new Set();
}

function writeDismissed(ids: number[]) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: todayKey(), ids }));
  } catch { /* storage blocked — the toast just reappears on the next poll */ }
}

function formatName(name: string | null | undefined): string {
  const t = String(name ?? '').trim();
  if (!t) return '—';
  const [first, ...rest] = t.split(/\s+/);
  return [first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(), ...rest].join(' ');
}

/**
 * App-wide "Follow-ups Due" toast, driven by each inquiry's latest next
 * follow-up date (see getDueFollowUps). Mounted once in the dashboard shell so
 * it shows at the top of every screen for anyone who can view inquiries; users
 * without inquiry.view get a 403 and polling stops. Dismissing hides the
 * current set for the rest of the day — only newly due follow-ups re-open it.
 */
export default function FollowUpDueToast() {
  const router = useRouter();
  const [followUps, setFollowUps] = useState<DueFollowUp[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const poll = async () => {
      try {
        const r = await fetch('/api/inquiry/follow-ups/due', { cache: 'no-store' });
        if (r.status === 401 || r.status === 403) return; // signed out / no inquiry access — stop
        const d = await r.json();
        if (stopped) return;
        if (r.ok) {
          setFollowUps(d.followUps || []);
          setDismissed(readDismissed());
        }
      } catch {
        /* network blip — retry on next tick */
      }
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

  const hasUndismissed = useMemo(
    () => followUps.some((f) => !dismissed.has(f.Inquiry_Id)),
    [followUps, dismissed]
  );

  const dismiss = useCallback(() => {
    const ids = followUps.map((f) => f.Inquiry_Id);
    writeDismissed(ids);
    setDismissed(new Set(ids));
  }, [followUps]);

  if (!hasUndismissed) return null;

  const dueToday = followUps.filter((f) => f.Days_Overdue === 0).length;
  const overdue = followUps.length - dueToday;
  const shown = followUps.slice(0, MAX_NAMES);

  return (
    <div className="fixed top-4 right-4 z-[60] w-[calc(100%-2rem)] max-w-sm" role="alert" aria-live="polite">
      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center gap-2 bg-[#2E3093] px-4 py-2.5 text-white">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="flex-1 text-sm font-bold">Follow-ups Due ({followUps.length})</p>
          <button onClick={dismiss} className="rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Dismiss">✕</button>
        </div>
        <div className="px-4 py-3 text-sm text-gray-700">
          <p>
            <span className="font-bold text-[#2E3093]">{dueToday}</span> due today
            {overdue > 0 && <> · <span className="font-bold text-gray-900">{overdue}</span> overdue</>}
          </p>
          <ul className="mt-2 space-y-0.5 text-xs">
            {shown.map((f) => (
              <li key={f.Inquiry_Id} className="flex gap-2">
                <span className="flex-1 truncate font-semibold text-gray-900">{formatName(f.Student_Name)}</span>
                <span className="shrink-0 text-gray-400">
                  {f.Days_Overdue === 0 ? 'Today' : `${f.Days_Overdue}d overdue`}
                </span>
              </li>
            ))}
            {followUps.length > shown.length && (
              <li className="text-gray-400">+{followUps.length - shown.length} more</li>
            )}
          </ul>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={dismiss} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Dismiss</button>
            <button
              onClick={() => { dismiss(); router.push('/dashboard/inquiry'); }}
              className="rounded-lg bg-[#2E3093] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#252780]"
            >
              View Follow-ups
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
