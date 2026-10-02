'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/** The student's raised academic issues, their progress, and replies to staff requests. */

type Status = 'OPEN' | 'UNDER_REVIEW' | 'INFO_REQUIRED' | 'RESOLVED' | 'REJECTED';

interface IssueEvent {
  id: number;
  event_type: string;
  to_status: Status | null;
  message: string | null;
  actor_type: 'STUDENT' | 'STAFF';
  created_at: string;
}

interface Issue {
  id: number;
  source_module: 'ASSIGNMENT' | 'UNIT_TEST' | 'FINAL_EXAM' | 'VIVA_MOC' | 'ATTENDANCE';
  assessment_name: string;
  record_date: string | null;
  shown_to_student: string | null;
  issue_type: string;
  description: string;
  status: Status;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  events: IssueEvent[];
}

const MODULE_LABEL: Record<Issue['source_module'], string> = {
  ASSIGNMENT: 'Assignment Test', UNIT_TEST: 'Unit Test', FINAL_EXAM: 'Final Exam', VIVA_MOC: 'Viva / MOC', ATTENDANCE: 'Attendance',
};

const STATUS_META: Record<Status, { label: string; tone: string }> = {
  OPEN: { label: 'Open', tone: 'bg-[#2A6BB5]/[0.08] text-[#2A6BB5] border-[#2A6BB5]/20' },
  UNDER_REVIEW: { label: 'Under review', tone: 'bg-indigo-50 text-[#2E3093] border-indigo-200' },
  INFO_REQUIRED: { label: 'Information required', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  RESOLVED: { label: 'Resolved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', tone: 'bg-red-50 text-red-700 border-red-200' },
};

const FILTERS: Array<{ key: 'ALL' | Status; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'INFO_REQUIRED', label: 'Info required' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const EVENT_LABEL: Record<string, string> = {
  RAISED: 'You raised this issue',
  STATUS: 'Moved to review',
  INFO_REQUESTED: 'Academic team asked for more information',
  STUDENT_REPLY: 'You replied',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  REOPENED: 'Reopened',
  NOTICE_POSTED: 'Update posted on the Notice Board',
};

function fmtDateTime(v: string | null): string {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function IssuesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const focusId = Number(params.get('id')) || null;
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState<'ALL' | Status>('ALL');
  const [expanded, setExpanded] = useState<number | null>(focusId);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');

  const load = useCallback(() => {
    fetch('/api/student-portal/issues', { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        setIssues(Array.isArray(d.issues) ? d.issues : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => (filter === 'ALL' ? issues : issues.filter((i) => i.status === filter)), [issues, filter]);
  const count = (k: 'ALL' | Status) => (k === 'ALL' ? issues.length : issues.filter((i) => i.status === k).length);

  const sendReply = async (id: number) => {
    if (reply.trim().length < 2) { setReplyError('Please write a reply.'); return; }
    setSending(true);
    setReplyError('');
    try {
      const res = await fetch(`/api/student-portal/issues/${id}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: reply.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setReplyError(d.error || 'Could not send. Please try again.'); return; }
      setReply('');
      load();
    } catch {
      setReplyError('Could not send. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-[#52525B]">Couldn&apos;t load your issues.</p>
        <button onClick={() => { setState('loading'); load(); }} className="mt-3 rounded-md bg-[#2E3093] px-4 py-2 text-sm font-medium text-white">Retry</button>
      </div>
    );
  }

  const active = issues.filter((i) => i.status === 'OPEN' || i.status === 'UNDER_REVIEW' || i.status === 'INFO_REQUIRED').length;
  const needsReply = issues.filter((i) => i.status === 'INFO_REQUIRED').length;

  return (
    <div className="pb-4">
      <div className="bg-[#2E3093] px-5 pt-6 pb-10">
        <p className="text-white/40 text-[11px] font-medium uppercase tracking-widest">My Issues</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-6xl font-black text-white leading-none">{active}</p>
          <p className="text-sm font-semibold text-white/50 mb-1.5">active</p>
        </div>
        <p className="text-white/50 text-[11px] mt-3">
          {needsReply > 0
            ? <span className="text-[#FAE452] font-semibold">{needsReply} issue{needsReply === 1 ? ' needs' : 's need'} your reply.</span>
            : 'Raise an issue from any test or attendance record if something looks wrong.'}
        </p>
      </div>

      <div className="px-4 -mt-5">
        <div className="flex gap-1 overflow-x-auto bg-white border border-[#2E3093]/10 rounded-xl p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filter === f.key ? 'bg-[#2E3093] text-white' : 'text-[#2A6BB5]/60'}`}>
              {f.label} ({count(f.key)})
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3 space-y-2">
        {list.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-10 text-center text-sm text-gray-400">
            {issues.length === 0 ? (
              <>No issues raised. <Link href="/student-portal/dashboard/tests" className="text-[#2A6BB5] underline">Go to Tests</Link></>
            ) : 'No issues with this status'}
          </div>
        ) : list.map((i) => {
          const meta = STATUS_META[i.status];
          const open = expanded === i.id;
          return (
            <div key={i.id} className={`bg-white rounded-xl border overflow-hidden ${i.status === 'INFO_REQUIRED' ? 'border-amber-300' : 'border-gray-100'}`}>
              <button onClick={() => { setExpanded(open ? null : i.id); setReply(''); setReplyError(''); }}
                className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#2A6BB5]">#{i.id} · {MODULE_LABEL[i.source_module]}</p>
                  <p className="text-xs font-semibold text-gray-800 truncate mt-0.5">{i.assessment_name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{i.issue_type} · {fmtDateTime(i.created_at)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>
              </button>

              {open && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                  <div className="text-[11px] text-gray-500">
                    {i.record_date && <>Record date: {i.record_date} · </>}
                    {i.shown_to_student && <>Shown when raised: <span className="font-medium text-gray-700">{i.shown_to_student}</span></>}
                  </div>
                  {i.resolution_note && (i.status === 'RESOLVED' || i.status === 'REJECTED') && (
                    <div className={`rounded-lg border px-3 py-2 text-xs ${meta.tone}`}>
                      <p className="font-semibold">{i.status === 'RESOLVED' ? 'Resolution' : 'Reason'}</p>
                      <p className="mt-0.5 whitespace-pre-wrap">{i.resolution_note}</p>
                    </div>
                  )}

                  <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
                    {i.events.map((e) => (
                      <li key={e.id} className="relative pl-4">
                        <span className={`absolute -left-[5.5px] top-1 h-2.5 w-2.5 rounded-full ${e.actor_type === 'STUDENT' ? 'bg-[#2A6BB5]' : 'bg-[#2E3093]'}`} aria-hidden />
                        <p className="text-[11px] font-semibold text-gray-700">{EVENT_LABEL[e.event_type] ?? e.event_type}</p>
                        <p className="text-[10px] text-gray-400">{fmtDateTime(e.created_at)}</p>
                        {e.message && <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">{e.message}</p>}
                      </li>
                    ))}
                  </ol>

                  {i.status === 'INFO_REQUIRED' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <label htmlFor={`reply-${i.id}`} className="block text-xs font-semibold text-amber-900">Your reply</label>
                      <textarea id={`reply-${i.id}`} rows={3} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)}
                        className="mt-1.5 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20" />
                      {replyError && <p className="mt-1 text-xs text-red-700" role="alert">{replyError}</p>}
                      <button onClick={() => sendReply(i.id)} disabled={sending}
                        className="mt-2 rounded-md bg-[#2E3093] px-4 py-2 text-xs font-semibold text-white hover:bg-[#25277a] disabled:opacity-60">
                        {sending ? 'Sending…' : 'Send reply'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentIssuesPage() {
  return (
    <Suspense fallback={null}>
      <IssuesInner />
    </Suspense>
  );
}
