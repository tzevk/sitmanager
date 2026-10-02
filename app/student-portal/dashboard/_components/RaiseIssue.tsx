'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * "Raise an Issue" for one academic record. The sheet only sends which record
 * (sourceModule + parentId) plus the student's reason — the server checks the
 * record belongs to them and snapshots what they were shown.
 */

export type IssueModule = 'ASSIGNMENT' | 'UNIT_TEST' | 'FINAL_EXAM' | 'VIVA_MOC' | 'ATTENDANCE';

export interface IssueTarget {
  sourceModule: IssueModule;
  parentId: number;
  title: string;
  subtitle?: string;
  shown?: string;
}

const MARKS_TYPES = [
  'Incorrect Marks', 'Marks Missing', 'Marks Not Updated', 'Incorrect Total',
  'Incorrectly Marked Absent', 'Submission Not Recorded', 'Wrong Attempt', 'Evaluation Clarification', 'Other',
];
const ATTENDANCE_TYPES = ['Attendance Discrepancy', 'Incorrectly Marked Absent', 'Other'];

const issueKey = (m: IssueModule, id: number) => `${m}:${id}`;
const ACTIVE = new Set(['OPEN', 'UNDER_REVIEW', 'INFO_REQUIRED']);

/** Loads the student's issues once so rows can show "Issue open" instead of the button. */
export function useIssueTracker() {
  const [active, setActive] = useState<Map<string, number>>(new Map());
  const [target, setTarget] = useState<IssueTarget | null>(null);

  const refresh = useCallback(() => {
    fetch('/api/student-portal/issues', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.issues)) return;
        const m = new Map<string, number>();
        for (const i of d.issues) if (ACTIVE.has(i.status)) m.set(issueKey(i.source_module, Number(i.parent_id)), Number(i.id));
        setActive(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const close = useCallback(() => setTarget(null), []);
  const sheet = target ? <RaiseIssueSheet target={target} onClose={close} onRaised={refresh} /> : null;
  return { active, open: setTarget, sheet };
}

export function IssueButton({ tracker, target }: { tracker: ReturnType<typeof useIssueTracker>; target: IssueTarget }) {
  const openId = tracker.active.get(issueKey(target.sourceModule, target.parentId));
  if (openId) {
    return (
      <Link href={`/student-portal/dashboard/issues?id=${openId}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100">
        Issue open
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => tracker.open(target)}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#E4E4E7] bg-white px-2 py-1 text-[11px] font-medium text-[#2E3093] hover:border-[#2E3093] hover:bg-[#F5F5FB]"
      aria-label={`Raise an issue about ${target.title}`}>
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Raise issue
    </button>
  );
}

const MODULE_LABEL: Record<IssueModule, string> = {
  ASSIGNMENT: 'Assignment Test', UNIT_TEST: 'Unit Test', FINAL_EXAM: 'Final Exam', VIVA_MOC: 'Viva / MOC', ATTENDANCE: 'Attendance',
};

function RaiseIssueSheet({ target, onClose, onRaised }: { target: IssueTarget; onClose: () => void; onRaised: () => void }) {
  const types = target.sourceModule === 'ATTENDANCE' ? ATTENDANCE_TYPES : MARKS_TYPES;
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneId, setDoneId] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueType) { setError('Please choose what is wrong.'); return; }
    if (description.trim().length < 10) { setError('Please describe the issue (at least 10 characters).'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/student-portal/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceModule: target.sourceModule, parentId: target.parentId, issueType, description: description.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && d.issueId) { setDoneId(Number(d.issueId)); setError('You already have an open issue for this record.'); onRaised(); return; }
      if (!res.ok) { setError(d.error || 'Could not submit. Please try again.'); return; }
      setDoneId(Number(d.id));
      onRaised();
    } catch {
      setError('Could not submit. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="raise-issue-title">
      <button className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => !submitting && onClose()} />
      <div className="relative flex h-full w-full flex-col bg-white shadow-xl sm:max-w-md">
        <div className="flex items-center justify-between border-b border-[#E4E4E7] bg-[#2E3093] px-5 py-4 text-white">
          <h2 id="raise-issue-title" className="text-base font-semibold">Raise an issue</h2>
          <button onClick={onClose} disabled={submitting} className="rounded-md p-1 text-white/80 hover:bg-white/10" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="border-b border-[#E4E4E7] bg-[#F8F9FB] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#2A6BB5]">{MODULE_LABEL[target.sourceModule]}</p>
          <p className="mt-0.5 text-sm font-semibold text-[#18181B]">{target.title}</p>
          {target.subtitle && <p className="mt-0.5 text-xs text-[#71717A]">{target.subtitle}</p>}
          {target.shown && <p className="mt-1 text-xs text-[#52525B]">Currently shown: <span className="font-medium">{target.shown}</span></p>}
        </div>

        {doneId ? (
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className={`rounded-lg border p-4 text-sm ${error ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
              <p className="font-semibold">{error || 'Issue submitted'}</p>
              <p className="mt-1">{error ? 'You can follow it in My Issues.' : `Reference #${doneId}. The academic team will review it and you'll see updates in My Issues.`}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Link href={`/student-portal/dashboard/issues?id=${doneId}`} className="rounded-md bg-[#2E3093] px-4 py-2 text-sm font-medium text-white hover:bg-[#25277a]">View in My Issues</Link>
              <button onClick={onClose} className="rounded-md border border-[#E4E4E7] px-4 py-2 text-sm font-medium text-[#18181B] hover:bg-[#F4F4F5]">Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1 space-y-4 px-5 py-5">
              <div>
                <label htmlFor="issue-type" className="block text-sm font-medium text-[#18181B]">What is wrong?</label>
                <select id="issue-type" value={issueType} onChange={(e) => setIssueType(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[#D4D4D8] bg-white px-3 py-2 text-sm focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20">
                  <option value="">Choose an issue type</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="issue-desc" className="block text-sm font-medium text-[#18181B]">Details</label>
                <textarea id="issue-desc" rows={6} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain what you expected and why, e.g. the marks you were told or the date you attended."
                  className="mt-1.5 w-full resize-y rounded-md border border-[#D4D4D8] px-3 py-2 text-sm focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20" />
                <p className="mt-1 text-right text-[11px] text-[#A1A1AA]">{description.length}/2000</p>
              </div>
              {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            </div>
            <div className="flex gap-2 border-t border-[#E4E4E7] px-5 py-4">
              <button type="submit" disabled={submitting} className="flex-1 rounded-md bg-[#2E3093] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#25277a] disabled:opacity-60">
                {submitting ? 'Submitting…' : 'Submit issue'}
              </button>
              <button type="button" onClick={onClose} disabled={submitting} className="rounded-md border border-[#E4E4E7] px-4 py-2.5 text-sm font-medium text-[#18181B] hover:bg-[#F4F4F5]">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
