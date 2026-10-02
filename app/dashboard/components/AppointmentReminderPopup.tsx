'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Reminder {
  id: number;
  title: string;
  link: string;
  appointment_id: number;
  applicant?: string;
  time?: string;
  program?: string;
  mode?: string;
  code?: string;
  /** No counsellor assigned — shown to users who manage all appointments. */
  unassigned?: boolean;
}

const POLL_MS = 60 * 1000;
// Non-counsellors are re-checked rarely, in case they get enrolled mid-session.
const IDLE_POLL_MS = 15 * 60 * 1000;

/**
 * "Upcoming Counselling Appointment" popup, 30 minutes before start. Users who
 * manage all appointments also get it for appointments with no counsellor
 * assigned ("Unassigned Counselling Appointment"), so those aren't missed.
 * Mounted once in the dashboard shell. The server de-duplicates reminders
 * (one per appointment + time + counsellor), only returns them for the assigned
 * counsellor while the appointment is still Scheduled, and records
 * delivered_at / read_at — so a refresh never spawns duplicates and a dismissed
 * reminder never returns.
 */
export default function AppointmentReminderPopup() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const poll = async () => {
      let next = POLL_MS;
      try {
        const r = await fetch('/api/appointments/reminders', { cache: 'no-store' });
        if (r.status === 401) return; // signed out — stop
        const d = await r.json();
        if (stopped) return;
        if (d.success) setReminders(d.reminders || []);
        if (d.isCounsellor === false) next = IDLE_POLL_MS;
      } catch {
        /* network blip — retry on next tick */
      }
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, next);
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

  const markRead = useCallback(async (ids: number[]) => {
    setReminders((list) => list.filter((r) => !ids.includes(r.id)));
    try {
      await fetch('/api/appointments/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      });
    } catch { /* will simply re-appear on next poll */ }
  }, []);

  if (!reminders.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3" role="alert" aria-live="assertive">
      {reminders.map((r) => (
        <div key={r.id} className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center gap-2 bg-[#2E3093] px-4 py-2.5 text-white">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="flex-1 text-sm font-bold">{r.title}</p>
            <button onClick={() => markRead([r.id])} className="rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Dismiss">✕</button>
          </div>
          <div className="px-4 py-3 text-sm text-gray-700">
            {r.unassigned ? (
              <p><span className="font-bold text-gray-900">{r.applicant}</span> has an appointment at <span className="font-bold text-[#2E3093]">{r.time}</span> with <span className="font-bold">no counsellor assigned</span>.</p>
            ) : (
              <p><span className="font-bold text-gray-900">{r.applicant}</span> has an appointment with you at <span className="font-bold text-[#2E3093]">{r.time}</span>.</p>
            )}
            <dl className="mt-2 space-y-0.5 text-xs">
              <div className="flex gap-2"><dt className="w-16 text-gray-400">Program</dt><dd className="font-semibold">{r.program}</dd></div>
              <div className="flex gap-2"><dt className="w-16 text-gray-400">Mode</dt><dd className="font-semibold">{r.mode}</dd></div>
              {r.code && <div className="flex gap-2"><dt className="w-16 text-gray-400">ID</dt><dd className="font-mono">{r.code}</dd></div>}
            </dl>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => markRead([r.id])} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Dismiss</button>
              <button
                onClick={() => { markRead([r.id]); router.push(r.link); }}
                className="rounded-lg bg-[#2E3093] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#252780]"
              >
                {r.unassigned ? 'Assign Counsellor' : 'View Appointment'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
