'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';

/**
 * Attendance Taken: every half-day already recorded on the Attendance page, as
 * a month calendar or a list. Open a half-day to correct marks or delete it.
 * Saves go through /api/daily-activities/attendance-taken, which keeps the
 * lecture record (used for attendance %) in step.
 */

type Session = 'first_half' | 'second_half';
type Status = 'P' | 'A' | 'L';

interface Course { Course_Id: number; Course_Name: string }
interface Batch { Batch_Id: number; Batch_code: string; Timings?: string | null }

interface SessionRow {
  date: string;
  session: Session;
  present: number;
  late: number;
  absent: number;
  marked: number;
  duplicated: number;
  conflicting: number;
  updatedAt: string | null;
  takeId: number | null;
  topic: string | null;
}

interface RosterRow {
  studentId: number;
  admissionId: number | null;
  studentName: string;
  rollNo: string;
  cancelled: boolean;
  offRoster: boolean;
  status: Status | null;
  inTime: string | null;
  outTime: string | null;
  remarks: string | null;
  copies: number;
  conflicting: boolean;
}

type Edit = Pick<RosterRow, 'status' | 'inTime' | 'outTime' | 'remarks'>;

const SESSION_LABEL: Record<Session, string> = { first_half: 'First half', second_half: 'Second half' };
const SESSION_SHORT: Record<Session, string> = { first_half: '1st', second_half: '2nd' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function monthRange(key: string) {
  const [y, m] = key.split('-').map(Number);
  return { from: `${key}-01`, to: ymd(new Date(y, m, 0)), first: new Date(y, m - 1, 1), days: new Date(y, m, 0).getDate() };
}
function shiftMonth(key: string, by: number) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
}
function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
}
function fmtStamp(v: string | null) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
const pct = (s: SessionRow) => (s.marked ? Math.round(((s.present + s.late) / s.marked) * 100) : 0);

const STATUS_BTN: Record<Status | 'clear', { label: string; on: string }> = {
  P: { label: 'P', on: 'bg-emerald-600 text-white border-emerald-600' },
  L: { label: 'L', on: 'bg-amber-500 text-white border-amber-500' },
  A: { label: 'A', on: 'bg-red-600 text-white border-red-600' },
  clear: { label: '–', on: 'bg-gray-500 text-white border-gray-500' },
};

const ctrlCls = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20';

export default function AttendanceTakenPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [open, setOpen] = useState<{ date: string; session: Session } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SessionRow | { date: string; session: Session } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/daily-activities/attendance?options=courses')
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => setCourses(d.courses ?? []))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    fetch(`/api/daily-activities/attendance?options=batches&courseId=${courseId}`)
      .then((r) => (r.ok ? r.json() : { batches: [] }))
      .then((d) => setBatches(d.batches ?? []))
      .catch(() => setBatches([]));
  }, [courseId]);

  const load = useCallback(() => {
    if (!batchId) return;
    const { from, to } = monthRange(month);
    setLoading(true);
    setError('');
    fetch(`/api/daily-activities/attendance-taken?batchId=${batchId}&from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || d.message || 'Could not load attendance');
        setSessions(d.sessions ?? []);
        setCanEdit(Boolean(d.canEdit));
        setCanDelete(Boolean(d.canDelete));
      })
      .catch((e) => { setSessions([]); setError(e instanceof Error ? e.message : 'Could not load attendance'); })
      .finally(() => setLoading(false));
  }, [batchId, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const byDate = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    for (const s of sessions) m.set(s.date, [...(m.get(s.date) ?? []), s].sort((a, b) => a.session.localeCompare(b.session)));
    return m;
  }, [sessions]);

  const totals = useMemo(() => ({
    halfDays: sessions.length,
    days: byDate.size,
    present: sessions.reduce((n, s) => n + s.present, 0),
    late: sessions.reduce((n, s) => n + s.late, 0),
    absent: sessions.reduce((n, s) => n + s.absent, 0),
    issues: sessions.filter((s) => s.conflicting > 0).length,
  }), [sessions, byDate]);

  const batch = batches.find((b) => String(b.Batch_Id) === batchId);

  const doDelete = async () => {
    if (!confirmDelete || !batchId) return;
    setDeleting(true);
    try {
      const q = new URLSearchParams({ batchId, date: confirmDelete.date, session: confirmDelete.session });
      const r = await fetch(`/api/daily-activities/attendance-taken?${q}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || d.message || 'Delete failed'); return; }
      setToast(`Deleted ${SESSION_LABEL[confirmDelete.session].toLowerCase()} attendance for ${fmtDate(confirmDelete.date)}.`);
      setConfirmDelete(null);
      setOpen(null);
      load();
    } catch {
      setError('Delete failed. Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PermissionGate resource="attendance" action="view">
      {() => (
      <>
      <div className="flex flex-col gap-4">
        {/* Header + filters */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h1 className="text-base font-bold text-gray-800">Attendance Taken</h1>
              <p className="text-xs text-gray-400">Review attendance already recorded — open a half-day to correct or delete it.</p>
            </div>
            <div className="flex rounded-lg border border-gray-200 p-0.5" role="tablist" aria-label="View">
              {(['calendar', 'list'] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === v ? 'bg-[#2E3093] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  {v === 'calendar' ? 'Calendar' : 'List'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-gray-500">
              Course
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setBatchId(''); setBatches([]); setSessions([]); }} className={ctrlCls}>
                <option value="">Select course</option>
                {courses.map((c) => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
              </select>
            </label>
            <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-gray-500">
              Batch
              <select value={batchId} onChange={(e) => { setBatchId(e.target.value); setOpen(null); }} disabled={!courseId} className={`${ctrlCls} disabled:opacity-50`}>
                <option value="">Select batch</option>
                {batches.map((b) => <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_code}{b.Timings ? ` · ${b.Timings}` : ''}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs font-medium text-gray-500">
              Month
              <div className="flex items-center gap-1">
                <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="h-9 w-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50" aria-label="Previous month">‹</button>
                <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`${ctrlCls} w-40`} aria-label="Month" />
                <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="h-9 w-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50" aria-label="Next month">›</button>
                <button onClick={() => setMonth(monthKey(new Date()))} className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50">Today</button>
              </div>
            </div>
          </div>

          {batchId && !loading && !error && (
            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 px-5 py-3 text-xs sm:grid-cols-5">
              <Stat label="Days recorded" value={totals.days} sub={`${totals.halfDays} half-days`} />
              <Stat label="Present marks" value={totals.present} tone="text-emerald-700" />
              <Stat label="Late marks" value={totals.late} tone="text-amber-600" />
              <Stat label="Absent marks" value={totals.absent} tone="text-red-600" />
              <Stat label="Conflicting copies" value={totals.issues} tone={totals.issues ? 'text-amber-700' : 'text-gray-400'} sub={totals.issues ? 'half-days to check' : 'none'} />
            </div>
          )}
        </div>

        {toast && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800" role="status">{toast}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">{error} {batchId && <button onClick={load} className="ml-2 underline">Retry</button>}</div>}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {!batchId ? (
            <Empty title="Select a course and batch" sub="Attendance recorded for that batch will show here by month." />
          ) : loading ? (
            <div className="p-12 text-center text-sm text-gray-400">Loading attendance…</div>
          ) : view === 'calendar' ? (
            <Calendar month={month} byDate={byDate} onOpen={(date, session) => setOpen({ date, session })} />
          ) : sessions.length === 0 ? (
            <Empty title={`No attendance recorded in ${fmtDate(`${month}-01`, { month: 'long', year: 'numeric' })}`} sub="Try another month." />
          ) : (
            <SessionList sessions={sessions} canDelete={canDelete} onOpen={(s) => setOpen({ date: s.date, session: s.session })} onDelete={setConfirmDelete} />
          )}
        </div>
      </div>

      {open && batchId && (
        <SessionEditor
          key={`${open.date}-${open.session}`}
          batchId={batchId}
          batchLabel={batch?.Batch_code ?? ''}
          date={open.date}
          session={open.session}
          canEdit={canEdit}
          canDelete={canDelete && Boolean(byDate.get(open.date)?.some((s) => s.session === open.session))}
          onClose={() => setOpen(null)}
          onSaved={(msg) => { setToast(msg); load(); }}
          onDelete={() => setConfirmDelete(open)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="del-title">
          <button className="absolute inset-0 bg-black/40" aria-label="Cancel" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 id="del-title" className="text-base font-bold text-gray-800">Delete this attendance?</h2>
            <p className="mt-1 text-sm text-gray-600">
              {SESSION_LABEL[confirmDelete.session]} · {fmtDate(confirmDelete.date)}{batch ? ` · Batch ${batch.Batch_code}` : ''}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600">
              <li>All students&apos; marks for this half-day are removed.</li>
              <li>The matching {confirmDelete.session === 'first_half' ? '9:00 AM' : '2:00 PM'} lecture record is removed too, so it no longer counts in attendance % (reports and Student Portal).</li>
              <li>Lectures entered at other times in Lecture Taken are not affected.</li>
              <li>Rows are soft-deleted and can be restored by the database admin if needed.</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={doDelete} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </PermissionGate>
  );
}

function Stat({ label, value, tone = 'text-gray-800', sub }: { label: string; value: number; tone?: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function Calendar({ month, byDate, onOpen }: { month: string; byDate: Map<string, SessionRow[]>; onOpen: (date: string, session: Session) => void }) {
  const { first, days } = monthRange(month);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const today = ymd(new Date());
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAYS.map((w) => <div key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="min-h-[56px] sm:min-h-[96px]" />;
          const list = byDate.get(d) ?? [];
          const isToday = d === today;
          return (
            <div key={d} className={`min-h-[56px] rounded-lg border p-1 sm:min-h-[96px] sm:p-1.5 ${list.length ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/60'} ${isToday ? 'ring-2 ring-[#2E3093]/40' : ''}`}>
              <p className={`text-[11px] font-semibold sm:text-xs ${isToday ? 'text-[#2E3093]' : 'text-gray-500'}`}>{Number(d.slice(8))}</p>
              <div className="mt-1 space-y-1">
                {list.map((s) => (
                  <button key={s.session} onClick={() => onOpen(s.date, s.session)}
                    title={`${SESSION_LABEL[s.session]}: ${s.present} present, ${s.late} late, ${s.absent} absent${s.conflicting ? ` — ${s.conflicting} conflicting copies` : ''}`}
                    className="flex w-full items-center justify-between gap-1 rounded-md border border-[#2E3093]/15 bg-[#2E3093]/5 px-1 py-0.5 text-left hover:border-[#2E3093]/40 hover:bg-[#2E3093]/10 sm:px-1.5 sm:py-1">
                    <span className="text-[10px] font-bold text-[#2E3093] sm:text-[11px]">{SESSION_SHORT[s.session]}</span>
                    <span className="hidden text-[10px] tabular-nums sm:inline">
                      <span className="text-emerald-700">{s.present}P</span>
                      {s.late > 0 && <span className="text-amber-600"> · {s.late}L</span>}
                      <span className="text-red-600"> · {s.absent}A</span>
                    </span>
                    {s.conflicting > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Conflicting copies" />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-gray-400">
        Each chip is a recorded half-day: present · late · absent. <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" /> = some students have conflicting duplicate rows (open it and save to fix).
      </p>
    </div>
  );
}

function SessionList({ sessions, canDelete, onOpen, onDelete }: {
  sessions: SessionRow[]; canDelete: boolean; onOpen: (s: SessionRow) => void; onDelete: (s: SessionRow) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3 text-right">Present</th>
              <th className="px-4 py-3 text-right">Late</th>
              <th className="px-4 py-3 text-right">Absent</th>
              <th className="px-4 py-3 text-right">Attendance</th>
              <th className="px-4 py-3">Last saved</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((s) => (
              <tr key={`${s.date}-${s.session}`} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{fmtDate(s.date)}</td>
                <td className="px-4 py-3 text-gray-600">{SESSION_LABEL[s.session]}</td>
                <td className="max-w-[260px] truncate px-4 py-3 text-gray-500" title={s.topic ?? ''}>{s.topic || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{s.present}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-600">{s.late}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{s.absent}</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {pct(s)}%
                  {s.conflicting > 0 && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title="Conflicting duplicate rows">{s.conflicting} conflict</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{fmtStamp(s.updatedAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button onClick={() => onOpen(s)} className="rounded-md border border-[#2E3093]/30 px-2.5 py-1 text-xs font-semibold text-[#2E3093] hover:bg-[#2E3093]/5">View / Edit</button>
                  {canDelete && <button onClick={() => onDelete(s)} className="ml-1.5 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-gray-100 md:hidden">
        {sessions.map((s) => (
          <li key={`${s.date}-${s.session}`} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{fmtDate(s.date)}</p>
                <p className="text-xs text-gray-500">{SESSION_LABEL[s.session]}{s.topic ? ` · ${s.topic}` : ''}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-gray-700">{pct(s)}%</span>
            </div>
            <p className="mt-1 text-xs">
              <span className="text-emerald-700">{s.present} present</span> · <span className="text-amber-600">{s.late} late</span> · <span className="text-red-600">{s.absent} absent</span>
              {s.conflicting > 0 && <span className="ml-1 text-amber-700">· {s.conflicting} conflict</span>}
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => onOpen(s)} className="flex-1 rounded-md border border-[#2E3093]/30 py-1.5 text-xs font-semibold text-[#2E3093]">View / Edit</button>
              {canDelete && <button onClick={() => onDelete(s)} className="flex-1 rounded-md border border-red-200 py-1.5 text-xs font-semibold text-red-600">Delete</button>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function SessionEditor({ batchId, batchLabel, date, session, canEdit, canDelete, onClose, onSaved, onDelete }: {
  batchId: string; batchLabel: string; date: string; session: Session; canEdit: boolean; canDelete: boolean;
  onClose: () => void; onSaved: (msg: string) => void; onDelete: () => void;
}) {
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams({ batchId, date, session });
    fetch(`/api/daily-activities/attendance-taken?${q}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || d.message || 'Could not load students');
        setRows(d.students ?? []);
        setEdits({});
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load students'));
  }, [batchId, date, session]);

  useEffect(() => { load(); }, [load]);

  const dirty = Object.keys(edits).length;
  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  }, [dirty, saving, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const current = (r: RosterRow): Edit => edits[r.studentId] ?? { status: r.status, inTime: r.inTime, outTime: r.outTime, remarks: r.remarks };

  const change = (r: RosterRow, patch: Partial<Edit>) => {
    setEdits((prev) => {
      const next = { ...current(r), ...patch };
      const same = next.status === r.status && (next.inTime || null) === (r.inTime || null)
        && (next.outTime || null) === (r.outTime || null) && (next.remarks || null) === (r.remarks || null);
      const copy = { ...prev };
      // A conflicting row is always saved so its duplicate copies get rewritten to agree.
      if (same && !r.conflicting) delete copy[r.studentId]; else copy[r.studentId] = next;
      return copy;
    });
  };

  const counts = useMemo(() => {
    const c = { P: 0, L: 0, A: 0, none: 0 };
    for (const r of rows ?? []) { const s = current(r).status; if (s) c[s]++; else c.none++; }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, edits]);

  const conflicts = (rows ?? []).filter((r) => r.conflicting);
  const pendingConflicts = conflicts.filter((r) => !edits[r.studentId]);
  // Stage every conflicting student with their newest values, so Save rewrites all copies to match.
  const keepNewest = () => setEdits((prev) => {
    const copy = { ...prev };
    for (const r of conflicts) if (!copy[r.studentId]) copy[r.studentId] = { status: r.status, inTime: r.inTime, outTime: r.outTime, remarks: r.remarks };
    return copy;
  });

  const filtered = (rows ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || r.studentName.toLowerCase().includes(q) || r.rollNo.includes(q);
  });

  const save = async () => {
    if (!rows || !dirty) return;
    setSaving(true);
    setSaveError('');
    try {
      const records = rows.filter((r) => edits[r.studentId]).map((r) => ({
        studentId: r.studentId, admissionId: r.admissionId, ...edits[r.studentId],
      }));
      const res = await fetch('/api/daily-activities/attendance-taken', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: Number(batchId), date, session, records }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(d.error || d.message || 'Save failed'); return; }
      onSaved(`Saved ${records.length} change${records.length === 1 ? '' : 's'} for ${fmtDate(date)} (${SESSION_LABEL[session].toLowerCase()}).`);
      load();
    } catch {
      setSaveError('Save failed. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const timeCls = 'h-8 w-[92px] rounded-md border border-gray-200 px-1.5 text-xs disabled:bg-gray-50 disabled:text-gray-400 focus:border-[#2E3093] focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <button className="absolute inset-0 bg-black/30" aria-label="Close" onClick={requestClose} />
      <div className="relative flex h-full w-full flex-col bg-white shadow-xl sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs text-gray-400">{batchLabel ? `Batch ${batchLabel} · ` : ''}{SESSION_LABEL[session]}</p>
            <h2 id="editor-title" className="text-base font-bold text-gray-800">{fmtDate(date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>
            {rows && (
              <p className="mt-1 text-xs">
                <span className="font-semibold text-emerald-700">{counts.P} present</span> · <span className="font-semibold text-amber-600">{counts.L} late</span> · <span className="font-semibold text-red-600">{counts.A} absent</span>
                {counts.none > 0 && <span className="text-gray-400"> · {counts.none} not marked</span>}
              </p>
            )}
          </div>
          <button onClick={requestClose} className="rounded-md p-2 text-gray-400 hover:bg-gray-100" aria-label="Close">✕</button>
        </div>

        {!canEdit && rows && <p className="border-b border-gray-100 bg-gray-50 px-5 py-2 text-xs text-gray-500">View only — you don&apos;t have permission to edit attendance.</p>}

        {canEdit && pendingConflicts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-900">
            <span>
              {pendingConflicts.length} student{pendingConflicts.length === 1 ? ' has' : 's have'} duplicate rows that disagree. The newest entry is shown; save to make all copies match it (or pick the correct status first).
            </span>
            <button onClick={keepNewest} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-100">Keep newest values</button>
          </div>
        )}

        <div className="border-b border-gray-100 px-5 py-2.5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or roll no."
            className="h-8 w-full rounded-md border border-gray-200 px-3 text-xs focus:border-[#2E3093] focus:outline-none sm:w-64" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadError ? (
            <p className="p-8 text-center text-sm text-red-600">{loadError}</p>
          ) : !rows ? (
            <p className="p-8 text-center text-sm text-gray-400">Loading students…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No students match.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const v = current(r);
                const changed = Boolean(edits[r.studentId]);
                return (
                  <li key={r.studentId} className={`px-5 py-2.5 ${changed ? 'bg-[#2E3093]/[0.04]' : ''}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="w-8 text-right font-mono text-xs text-gray-400">{r.rollNo || '—'}</span>
                      <div className="min-w-[140px] flex-1">
                        <p className="text-sm font-medium text-gray-800">{r.studentName}</p>
                        <div className="flex flex-wrap gap-1">
                          {r.cancelled && <Badge tone="bg-gray-100 text-gray-600">Cancelled</Badge>}
                          {r.offRoster && <Badge tone="bg-gray-100 text-gray-600">Not on batch roster</Badge>}
                          {r.conflicting && <Badge tone="bg-amber-100 text-amber-800">Duplicate rows disagree</Badge>}
                          {!r.conflicting && r.copies > 1 && <Badge tone="bg-gray-100 text-gray-500">{r.copies} copies</Badge>}
                          {changed && <Badge tone="bg-[#2E3093]/10 text-[#2E3093]">Changed</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1" role="group" aria-label={`Status for ${r.studentName}`}>
                        {(['P', 'L', 'A', 'clear'] as const).map((k) => {
                          const active = k === 'clear' ? v.status === null : v.status === k;
                          return (
                            <button key={k} disabled={!canEdit} aria-pressed={active}
                              onClick={() => change(r, { status: k === 'clear' ? null : k })}
                              title={k === 'clear' ? 'Not marked (clear)' : k === 'P' ? 'Present' : k === 'L' ? 'Late' : 'Absent'}
                              className={`h-8 w-8 rounded-md border text-xs font-bold disabled:cursor-not-allowed ${active ? STATUS_BTN[k].on : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
                              {STATUS_BTN[k].label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="time" value={v.inTime ?? ''} disabled={!canEdit || v.status === null} aria-label="In time"
                          onChange={(e) => change(r, { inTime: e.target.value || null })} className={timeCls} />
                        <span className="text-xs text-gray-300">–</span>
                        <input type="time" value={v.outTime ?? ''} disabled={!canEdit || v.status === null} aria-label="Out time"
                          onChange={(e) => change(r, { outTime: e.target.value || null })} className={timeCls} />
                      </div>
                      <input value={v.remarks ?? ''} disabled={!canEdit || v.status === null} maxLength={255} placeholder="Remarks" aria-label="Remarks"
                        onChange={(e) => change(r, { remarks: e.target.value || null })}
                        className="h-8 min-w-[120px] flex-1 rounded-md border border-gray-200 px-2 text-xs disabled:bg-gray-50 focus:border-[#2E3093] focus:outline-none sm:max-w-[200px]" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          {canDelete && (
            <button onClick={onDelete} disabled={saving} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
              Delete this attendance
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {saveError && <span className="text-xs text-red-600" role="alert">{saveError}</span>}
            {dirty > 0 && <span className="text-xs text-gray-500">{dirty} unsaved</span>}
            {dirty > 0 && <button onClick={() => setEdits({})} disabled={saving} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-100">Undo changes</button>}
            {canEdit && (
              <button onClick={save} disabled={!dirty || saving} className="rounded-lg bg-[#2E3093] px-4 py-2 text-xs font-semibold text-white hover:bg-[#252780] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>{children}</span>;
}
