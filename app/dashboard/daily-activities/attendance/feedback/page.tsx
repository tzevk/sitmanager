'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ── Types ─────────────────────────────────────────────────────────── */
type StudentRow = {
  id: number; rollNo: string; studentName: string;
  rating: number; comments: string | null; submittedAt: string;
};
type BatchGroup = { batchId: number; batchName: string; students: StudentRow[] };
type DateGroup  = { date: string; batches: BatchGroup[] };

/* ── Constants ──────────────────────────────────────────────────────── */
const RATING_LABELS: Record<number, string> = {
  5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Satisfactory', 1: 'Unsatisfactory',
};
const RATING_COLORS: Record<number, string> = {
  5: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  4: 'bg-green-50 text-green-700 border-green-100',
  3: 'bg-blue-50 text-blue-700 border-blue-100',
  2: 'bg-amber-50 text-amber-700 border-amber-100',
  1: 'bg-red-50 text-red-600 border-red-100',
};
const RATING_DOT: Record<number, string> = {
  5: 'bg-emerald-500', 4: 'bg-green-500', 3: 'bg-blue-500', 2: 'bg-amber-400', 1: 'bg-red-500',
};

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m)-1]} ${y}`;
}
function fmtTime(dt: string) {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/* ── Student row with inline edit / delete ──────────────────────────── */
function StudentFeedbackRow({
  s, onUpdate, onDelete,
}: {
  s: StudentRow;
  onUpdate: (id: number, rating: number, comments: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing]       = useState(false);
  const [editRating, setEditRating] = useState(s.rating);
  const [editComments, setEditComments] = useState(s.comments ?? '');
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const startEdit = () => { setEditRating(s.rating); setEditComments(s.comments ?? ''); setEditing(true); };

  const handleSave = async () => {
    setSaving(true);
    try { await onUpdate(s.id, editRating, editComments); setEditing(false); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try { await onDelete(s.id); }
    finally { setDeleting(false); setConfirmDel(false); }
  };

  return (
    <>
      <tr className="group hover:bg-[#2E3093]/[0.02] transition-colors">
        {/* Roll */}
        <td className="px-4 py-2.5 text-xs font-mono text-gray-500 whitespace-nowrap align-top">{s.rollNo}</td>

        {/* Student + comment */}
        <td className="px-4 py-2.5 align-top">
          <span className="text-sm font-medium text-gray-800">{s.studentName || '—'}</span>
          {!editing && s.comments && (
            <p className="text-[11px] text-gray-400 italic mt-0.5 leading-snug">&ldquo;{s.comments}&rdquo;</p>
          )}
        </td>

        {/* Rating */}
        <td className="px-4 py-2.5 align-top whitespace-nowrap">
          {!editing ? (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${RATING_COLORS[s.rating] ?? 'bg-gray-50 text-gray-600 border-gray-100'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${RATING_DOT[s.rating] ?? 'bg-gray-400'}`} />
              {s.rating} — {RATING_LABELS[s.rating] ?? s.rating}
            </span>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {([5,4,3,2,1] as const).map(r => (
                <button key={r} type="button" onClick={() => setEditRating(r)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                    editRating === r
                      ? RATING_COLORS[r] + ' ring-1 ring-offset-1 ring-current font-bold'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </td>

        {/* Time */}
        <td className="px-4 py-2.5 text-[11px] text-gray-400 whitespace-nowrap align-top">{fmtTime(s.submittedAt)}</td>

        {/* Actions */}
        <td className="px-3 py-2.5 align-top">
          <div className={`flex items-center justify-end gap-1 transition-opacity ${confirmDel || editing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {!editing && !confirmDel && (
              <>
                <button onClick={startEdit} title="Edit"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#2E3093] hover:bg-[#2E3093]/10 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button onClick={handleDelete} title="Delete"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </>
            )}
            {confirmDel && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-red-600 font-semibold mr-0.5">Delete?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {deleting ? '…' : 'Yes'}
                </button>
                <button onClick={() => setConfirmDel(false)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                  No
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* Inline edit expansion */}
      {editing && (
        <tr className="bg-[#2E3093]/[0.02]">
          <td />
          <td colSpan={3} className="px-4 pb-3 pt-1">
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500 font-medium">{RATING_LABELS[editRating]}</p>
              <textarea
                value={editComments}
                onChange={e => setEditComments(e.target.value)}
                placeholder={editRating === 1 ? 'Comments for Unsatisfactory…' : 'Comments (optional)…'}
                rows={2}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
              />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="px-3 py-1 text-xs font-semibold bg-[#2E3093] text-white rounded-lg hover:bg-[#252780] disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </td>
          <td />
        </tr>
      )}
    </>
  );
}

/* ── Batch accordion ─────────────────────────────────────────────────── */
function BatchSection({
  batch, defaultOpen, onUpdate, onDelete,
}: {
  batch: BatchGroup; defaultOpen: boolean;
  onUpdate: (id: number, rating: number, comments: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total  = batch.students.length;
  const avgRaw = total ? batch.students.reduce((s, r) => s + r.rating, 0) / total : 0;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50/70 hover:bg-gray-100/60 transition-colors text-left">
        <div className="w-5 h-5 rounded bg-[#2E3093]/10 flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <span className="flex-1 text-xs font-semibold text-gray-700">{batch.batchName}</span>
        <span className="text-[11px] text-gray-400 mr-2">{total} response{total !== 1 ? 's' : ''}</span>
        {avgRaw > 0 && <span className="text-[11px] font-bold text-[#2E3093] mr-2">⌀ {avgRaw.toFixed(1)}</span>}
        <Chevron open={open} />
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-24">Roll</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Student</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-40">Rating</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-16">Time</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {batch.students.map(s => (
                <StudentFeedbackRow key={s.id} s={s} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Date accordion ──────────────────────────────────────────────────── */
function DateSection({
  group, defaultOpen, onUpdate, onDelete,
}: {
  group: DateGroup; defaultOpen: boolean;
  onUpdate: (id: number, rating: number, comments: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalResponses = group.batches.reduce((s, b) => s + b.students.length, 0);
  const ratingDist = [5,4,3,2,1].map(r => ({
    r, count: group.batches.flatMap(b => b.students).filter(s => s.rating === r).length,
  }));

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-[#2E3093]/10 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{fmtDate(group.date)}</p>
          <p className="text-[11px] text-gray-400">
            {group.batches.length} batch{group.batches.length !== 1 ? 'es' : ''} · {totalResponses} response{totalResponses !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1 mr-2">
          {ratingDist.filter(({ count }) => count > 0).map(({ r, count }) => (
            <span key={r} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${RATING_COLORS[r]}`}>
              {r}×{count}
            </span>
          ))}
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="border-b border-gray-200">
          {group.batches.map((b, i) => (
            <BatchSection key={b.batchId} batch={b}
              defaultOpen={i === 0 && group.batches.length <= 2}
              onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────── */
export default function AttendanceFeedbackReportsPage() {
  return (
    <PermissionGate resource="attendance" action="view">
      {() => <FeedbackReportsContent />}
    </PermissionGate>
  );
}

function FeedbackReportsContent() {
  const [data, setData]       = useState<DateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const load = () => {
    setLoading(true); setError('');
    fetch('/api/daily-activities/attendance/feedback-reports')
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return; } setData(d.data ?? []); })
      .catch(() => setError('Failed to load feedback data.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleUpdate = useCallback(async (id: number, rating: number, comments: string) => {
    const res = await fetch(`/api/daily-activities/attendance/feedback-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comments }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Update failed');
    setData(prev => prev.map(dg => ({
      ...dg,
      batches: dg.batches.map(bg => ({
        ...bg,
        students: bg.students.map(s =>
          s.id === id ? { ...s, rating, comments: comments?.trim() || null } : s
        ),
      })),
    })));
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    const res = await fetch(`/api/daily-activities/attendance/feedback-reports/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Delete failed');
    setData(prev =>
      prev.map(dg => ({
        ...dg,
        batches: dg.batches
          .map(bg => ({ ...bg, students: bg.students.filter(s => s.id !== id) }))
          .filter(bg => bg.students.length > 0),
      })).filter(dg => dg.batches.length > 0)
    );
  }, []);

  const q = search.toLowerCase().trim();
  const filtered: DateGroup[] = q
    ? data.map(dg => ({
        ...dg,
        batches: dg.batches
          .map(bg => ({
            ...bg,
            students: bg.students.filter(
              s => s.rollNo.toLowerCase().includes(q)
                || s.studentName.toLowerCase().includes(q)
                || (RATING_LABELS[s.rating] ?? '').toLowerCase().includes(q)
            ),
          }))
          .filter(bg => bg.students.length > 0 || bg.batchName.toLowerCase().includes(q)),
      })).filter(dg => dg.batches.length > 0)
    : data;

  const totalAll = data.reduce((s, dg) => s + dg.batches.reduce((ss, b) => ss + b.students.length, 0), 0);

  return (
    <div className="space-y-6">

      {/* ── Gradient header ── */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/15">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Feedback Reports</h1>
              <p className="text-xs text-white/70">Daily Activities / Attendance / Feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/daily-activities/attendance"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Attendance
            </Link>
            <button onClick={load}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-[#2E3093] hover:bg-white/90 transition-colors shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative w-full sm:w-auto">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student, roll number or rating…"
              className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2.5 py-0.5">
            {totalAll} response{totalAll !== 1 ? 's' : ''} · {data.length} day{data.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 my-2 flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            {error}
            <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-20 flex justify-center">
            <div className="w-7 h-7 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">
              {search ? 'No results match your search' : 'No feedback submissions yet'}
            </p>
            <p className="text-xs text-gray-400">
              {search ? 'Try a different name, roll number, or rating' : 'Save attendance and share the feedback link with students'}
            </p>
          </div>
        )}

        {/* Data */}
        {!loading && !error && filtered.length > 0 && (
          <div className="divide-y divide-gray-100">
            {filtered.map((dg, i) => (
              <DateSection key={dg.date} group={dg} defaultOpen={i === 0}
                onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
