'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ── API shapes (existing endpoints, unchanged) ─────────────────────────── */

interface AcademicsData {
  student: {
    student_name: string | null;
    roll_no: string | null;
    course_name: string | null;
    batch_code: string | null;
    batch_timings: string | null;
  };
  attendance: { total_lectures: number; attended: number; absent: number; percentage: number };
  fees: { total: number; paid: number; pending: number };
  fee_ledger: Array<{ fees_id: number; receipt_code: string | null; date: string | null; payment_type: string | null; type: 'paid' | 'charged'; amount: number; notes: string | null }>;
  final_exams: Array<{ take_id: number; date: string | null; attempt: number; label: string; max_marks: number | null; status: 'upcoming' | 'held' }>;
}

interface Lecture {
  id: number;
  lecture_no: number | null;
  subject_topic: string | null;
  subject: string | null;
  faculty_name: string | null;
  date: string | null;
  starttime: string | null;
  endtime: string | null;
  class_room: string | null;
  session: string | null;
  lecture_status: string | null;
  taken: number | boolean | null;
}

interface AssignmentRecord {
  parentId: number;
  assessmentName: string;
  assessmentNo: number | null;
  date: string | null;
  maxMarks: number | null;
  marksObtained: number | null;
  status: 'EVALUATED' | 'ABSENT' | 'NOT_SUBMITTED' | 'NOT_EVALUATED' | 'RESULT_PENDING' | 'NOT_APPLICABLE';
  published: boolean;
  absentOnLectureDate: boolean | null;
}

interface Notice { id: number; title: string | null; specification: string | null }

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };

/* ── Formatting ─────────────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function fmtDate(iso: string | null, withWeekday = false): string {
  if (!iso) return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', withWeekday ? { weekday: 'short', day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(t: string | null): string {
  const m = String(t ?? '').trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return String(t ?? '').trim();
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const timeRange = (l: Lecture) => [fmtTime(l.starttime), fmtTime(l.endtime)].filter(Boolean).join(' – ');
const fmtINR = (n: number) => '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
const isUrl = (v: string | null) => /^https?:\/\//i.test(String(v ?? '').trim());

/* ── Lecture status (from the lecture plan; no guessing) ────────────────── */

type LectureKey = 'cancelled' | 'completed' | 'today' | 'upcoming' | 'past' | 'unscheduled';

function lectureStatus(l: Lecture, today: string): { key: LectureKey; label: string } {
  const replacement = String(l.lecture_status ?? '').toLowerCase() === 'replacement';
  if (String(l.lecture_status ?? '').toLowerCase() === 'cancelled') return { key: 'cancelled', label: 'Cancelled' };
  if (l.taken === true || Number(l.taken) === 1) return { key: 'completed', label: 'Completed' };
  if (!l.date) return { key: 'unscheduled', label: 'Date TBA' };
  if (l.date === today) return { key: 'today', label: replacement ? 'Today · Replacement' : 'Today' };
  if (l.date > today) return { key: 'upcoming', label: replacement ? 'Replacement' : 'Upcoming' };
  return { key: 'past', label: 'Not recorded' };
}

const LECTURE_TONE: Record<LectureKey, string> = {
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  today: 'bg-[#FAE452]/40 text-[#3F3A00] border-[#E6CF2E]',
  upcoming: 'bg-[#2E3093]/[0.06] text-[#2E3093] border-[#2E3093]/20',
  past: 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]',
  unscheduled: 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]',
};

/* ── Assignment status (0 is a mark; null is "no mark") ─────────────────── */

function assignmentDisplay(r: AssignmentRecord): { text: string; tone: string } {
  if (r.status === 'EVALUATED' && r.marksObtained !== null) {
    return { text: r.maxMarks !== null ? `${r.marksObtained} / ${r.maxMarks}` : String(r.marksObtained), tone: 'bg-[#2E3093]/[0.06] text-[#2E3093] border-[#2E3093]/20' };
  }
  switch (r.status) {
    case 'RESULT_PENDING': return { text: 'Result pending', tone: 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]' };
    case 'NOT_EVALUATED': return { text: 'Pending', tone: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'NOT_SUBMITTED': return { text: 'Not submitted', tone: 'bg-red-50 text-red-700 border-red-200' };
    case 'ABSENT': return { text: 'Absent', tone: 'bg-red-50 text-red-700 border-red-200' };
    default: return { text: '—', tone: 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]' };
  }
}

/* Attendance bands — same thresholds as the Attendance page (75% / 60%). */
function attendanceTone(pct: number) {
  if (pct >= 75) return { color: '#047857', label: 'On track' };
  if (pct >= 60) return { color: '#B45309', label: 'Needs attention' };
  return { color: '#B91C1C', label: 'Below minimum' };
}

/* ── Small building blocks ──────────────────────────────────────────────── */

function Card({ title, action, children, className = '', accent }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-xl border border-[#E4E4E7] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
      {accent && <div className="h-[3px]" style={{ background: accent }} aria-hidden />}
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-4 sm:px-5">
          {title && <h2 className="text-sm font-semibold text-[#2E3093]">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4 sm:px-5">{children}</div>
    </section>
  );
}

const linkCls = 'shrink-0 text-xs font-medium text-[#2A6BB5] hover:text-[#2E3093] hover:underline underline-offset-2';

function Chip({ text, tone }: { text: string; tone: string }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{text}</span>;
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-4 animate-pulse rounded bg-[#F4F4F5]" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

function ErrorState({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#71717A]" role="alert">
      <span>Couldn&apos;t load {what}.</span>
      <button onClick={onRetry} className="rounded-md border border-[#E4E4E7] px-2.5 py-1 text-xs font-medium text-[#18181B] hover:bg-[#F4F4F5]">Retry</button>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-2 text-sm text-[#71717A]">{children}</p>;

/* ── Fees dialog (full-screen on phones, centered on larger screens) ────── */

function FeesDialog({ data, onClose }: { data: AcademicsData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const { fees, fee_ledger: ledger } = data;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="fees-title">
      <button className="absolute inset-0 bg-black/30" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-xl sm:border sm:border-[#E4E4E7] sm:shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E4E4E7] px-5 py-4">
          <h2 id="fees-title" className="text-base font-semibold text-[#18181B]">Fees</h2>
          <button onClick={onClose} className="rounded-md p-1 text-[#71717A] hover:bg-[#F4F4F5]" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 border-b border-[#E4E4E7] px-5 py-4 text-sm">
          <div><p className="text-xs text-[#71717A]">Total</p><p className="font-semibold">{fmtINR(fees.total)}</p></div>
          <div><p className="text-xs text-[#71717A]">Paid</p><p className="font-semibold text-emerald-700">{fmtINR(fees.paid)}</p></div>
          <div><p className="text-xs text-[#71717A]">Outstanding</p><p className={`font-semibold ${fees.pending > 0 ? 'text-red-700' : ''}`}>{fmtINR(Math.max(0, fees.pending))}</p></div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <p className="pb-2 text-xs text-[#71717A]">Recent transactions{ledger.length ? ` (latest ${ledger.length})` : ''}</p>
          {ledger.length === 0 ? <Empty>No fee transactions on record.</Empty> : (
            <ul className="divide-y divide-[#F4F4F5]">
              {ledger.map((row) => (
                <li key={row.fees_id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[#18181B]">{row.type === 'paid' ? 'Payment' : 'Charge'}{row.receipt_code ? ` · ${row.receipt_code}` : ''}</p>
                    <p className="truncate text-xs text-[#71717A]">{fmtDate(row.date)}{row.payment_type ? ` · ${row.payment_type}` : ''}</p>
                  </div>
                  <p className={`shrink-0 font-semibold ${row.type === 'paid' ? 'text-emerald-700' : 'text-[#18181B]'}`}>{fmtINR(row.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

const LECTURE_FILTERS = ['all', 'upcoming', 'completed', 'cancelled'] as const;
type LectureFilter = (typeof LECTURE_FILTERS)[number];

export default function StudentDashboardPage() {
  const router = useRouter();
  const [academics, setAcademics] = useState<Load<AcademicsData>>({ state: 'loading' });
  const [lectures, setLectures] = useState<Load<Lecture[]>>({ state: 'loading' });
  const [assignments, setAssignments] = useState<Load<AssignmentRecord[]>>({ state: 'loading' });
  const [notices, setNotices] = useState<Notice[]>([]);
  const [lectureFilter, setLectureFilter] = useState<LectureFilter>('all');
  const [feesOpen, setFeesOpen] = useState(false);
  const [today, setToday] = useState('');

  const fetchJson = useCallback(async (url: string) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 401) { router.push('/student-portal/signin'); throw new Error('signed out'); }
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, [router]);

  const loadAcademics = useCallback(() => {
    setAcademics({ state: 'loading' });
    fetchJson('/api/student-portal/academics')
      .then((d) => { setToday(localToday()); setAcademics({ state: 'ready', data: d }); })
      .catch(() => setAcademics({ state: 'error' }));
  }, [fetchJson]);
  const loadLectures = useCallback(() => {
    setLectures({ state: 'loading' });
    fetchJson('/api/student-portal/lecture-plan')
      .then((d) => { setToday(localToday()); setLectures({ state: 'ready', data: Array.isArray(d.lectures) ? d.lectures : [] }); })
      .catch(() => setLectures({ state: 'error' }));
  }, [fetchJson]);
  const loadAssignments = useCallback(() => {
    setAssignments({ state: 'loading' });
    fetchJson('/api/student-portal/assignments')
      .then((d) => setAssignments({ state: 'ready', data: Array.isArray(d.records) ? d.records : [] }))
      .catch(() => setAssignments({ state: 'error' }));
  }, [fetchJson]);

  useEffect(() => {
    // Promise callbacks (not the effect body) set state.
    const academicsP = fetchJson('/api/student-portal/academics');
    const lecturesP = fetchJson('/api/student-portal/lecture-plan');
    const assignmentsP = fetchJson('/api/student-portal/assignments');
    academicsP.then((d) => { setToday(localToday()); setAcademics({ state: 'ready', data: d }); }).catch(() => setAcademics({ state: 'error' }));
    lecturesP.then((d) => { setToday(localToday()); setLectures({ state: 'ready', data: Array.isArray(d.lectures) ? d.lectures : [] }); }).catch(() => setLectures({ state: 'error' }));
    assignmentsP.then((d) => setAssignments({ state: 'ready', data: Array.isArray(d.records) ? d.records : [] })).catch(() => setAssignments({ state: 'error' }));
    // Notices are secondary — a failure just hides them.
    fetchJson('/api/student-portal/notices').then((d) => setNotices(Array.isArray(d.notices) ? d.notices.slice(0, 2) : [])).catch(() => {});
  }, [fetchJson]);

  const closeFees = useCallback(() => setFeesOpen(false), []);

  const lectureView = useMemo(() => {
    if (lectures.state !== 'ready' || !today) return null;
    const withStatus = lectures.data.map((l) => ({ l, s: lectureStatus(l, today) }));
    const key = (l: Lecture) => `${l.date ?? '9999-99-99'} ${l.starttime ?? ''}`;
    const upcomingNext = withStatus
      .filter(({ l, s }) => l.date && l.date >= today && s.key !== 'completed')
      .sort((a, b) => key(a.l).localeCompare(key(b.l)))
      .slice(0, 5);
    const counts = {
      all: withStatus.length,
      upcoming: withStatus.filter(({ s }) => s.key === 'upcoming' || s.key === 'today').length,
      completed: withStatus.filter(({ s }) => s.key === 'completed').length,
      cancelled: withStatus.filter(({ s }) => s.key === 'cancelled').length,
    };
    const filtered = withStatus.filter(({ s }) =>
      lectureFilter === 'all' ? true
        : lectureFilter === 'upcoming' ? s.key === 'upcoming' || s.key === 'today'
        : s.key === lectureFilter
    );
    filtered.sort((a, b) => lectureFilter === 'upcoming' ? key(a.l).localeCompare(key(b.l)) : key(b.l).localeCompare(key(a.l)));
    return { upcomingNext, counts, list: filtered.slice(0, 8), total: filtered.length };
  }, [lectures, today, lectureFilter]);

  const assignmentView = useMemo(() => {
    if (assignments.state !== 'ready') return null;
    const all = assignments.data;
    return {
      total: all.length,
      pending: all.filter((r) => r.status === 'NOT_EVALUATED').length,
      // Recorded by staff but not published yet. This also covers entries recorded
      // as not submitted, so it must not be labelled "Submitted".
      awaiting: all.filter((r) => r.status === 'RESULT_PENDING').length,
      evaluated: all.filter((r) => r.status === 'EVALUATED' && r.published).length,
      recent: [...all].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, 6),
    };
  }, [assignments]);

  const a = academics.state === 'ready' ? academics.data : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 md:px-6 md:py-6 lg:px-8">

      {/* 1. Student details */}
      <section className="rounded-xl bg-[#2E3093] px-4 py-4 text-white sm:px-5" aria-label="Student details">
        {academics.state === 'loading' && <div className="opacity-40"><Skeleton rows={2} /></div>}
        {academics.state === 'error' && <div className="rounded-lg bg-white p-3"><ErrorState what="your details" onRetry={loadAcademics} /></div>}
        {a && (
          <>
            <h1 className="text-lg font-semibold sm:text-xl">{a.student.student_name || 'Student'}</h1>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <div className="min-w-0"><dt className="text-xs text-white/60">Roll Number</dt><dd className="truncate font-semibold text-[#FAE452]">{a.student.roll_no || '—'}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-white/60">Batch</dt><dd className="truncate font-medium">{a.student.batch_code && a.student.batch_code !== 'N/A' ? a.student.batch_code : '—'}</dd></div>
              <div className="col-span-2 min-w-0"><dt className="text-xs text-white/60">Training Programme</dt><dd className="font-medium">{a.student.course_name && a.student.course_name !== 'N/A' ? a.student.course_name : '—'}</dd></div>
            </dl>
          </>
        )}
      </section>

      {/* 2. Attendance · Fees · Assignments */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Attendance" accent={a && a.attendance.total_lectures > 0 ? attendanceTone(a.attendance.percentage).color : '#2E3093'} action={<Link href="/student-portal/dashboard/attendance" className={linkCls}>View attendance</Link>}>
          {academics.state === 'loading' && <Skeleton rows={2} />}
          {academics.state === 'error' && <ErrorState what="attendance" onRetry={loadAcademics} />}
          {a && (a.attendance.total_lectures === 0 ? <Empty>No lectures recorded yet.</Empty> : (
            <>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-semibold" style={{ color: attendanceTone(a.attendance.percentage).color }}>{a.attendance.percentage}%</p>
                <span className="text-xs font-medium" style={{ color: attendanceTone(a.attendance.percentage).color }}>{attendanceTone(a.attendance.percentage).label}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F4F4F5]" role="progressbar" aria-valuenow={a.attendance.percentage} aria-valuemin={0} aria-valuemax={100} aria-label="Attendance">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, a.attendance.percentage)}%`, background: attendanceTone(a.attendance.percentage).color }} />
              </div>
              <p className="mt-2 text-sm text-[#71717A]">{a.attendance.attended} of {a.attendance.total_lectures} lectures attended</p>
            </>
          ))}
        </Card>

        <Card title="Fees" accent={a ? (a.fees.pending > 0 ? '#B91C1C' : '#047857') : '#2E3093'} action={a ? <button onClick={() => setFeesOpen(true)} className={linkCls}>View fees</button> : undefined}>
          {academics.state === 'loading' && <Skeleton rows={2} />}
          {academics.state === 'error' && <ErrorState what="fees" onRetry={loadAcademics} />}
          {a && (a.fees.total === 0 && a.fees.paid === 0 ? <Empty>No fee records yet.</Empty> : (
            <>
              <p className="text-xs text-[#71717A]">Outstanding</p>
              <p className={`text-3xl font-semibold ${a.fees.pending > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {a.fees.pending > 0 ? fmtINR(a.fees.pending) : 'No dues'}
              </p>
              <p className="mt-2 text-sm text-[#71717A]">{fmtINR(a.fees.paid)} paid of {fmtINR(a.fees.total)}</p>
            </>
          ))}
        </Card>

        <Card title="Assignments" accent="#2A6BB5" action={<Link href="/student-portal/dashboard/assignments" className={linkCls}>View all</Link>}>
          {assignments.state === 'loading' && <Skeleton rows={2} />}
          {assignments.state === 'error' && <ErrorState what="assignments" onRetry={loadAssignments} />}
          {assignmentView && (assignmentView.total === 0 ? <Empty>No assignments given yet.</Empty> : (
            <>
              <p className="text-3xl font-semibold text-[#2A6BB5]">{assignmentView.total}</p>
              <p className="text-xs text-[#71717A]">assignments given</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-[#71717A]">Pending</dt><dd className="font-medium">{assignmentView.pending}</dd></div>
                <div><dt className="text-xs text-[#71717A]">Awaiting result</dt><dd className="font-medium">{assignmentView.awaiting}</dd></div>
                <div><dt className="text-xs text-[#71717A]">Evaluated</dt><dd className="font-medium">{assignmentView.evaluated}</dd></div>
              </dl>
            </>
          ))}
        </Card>
      </div>

      {/* 3. Upcoming lectures · 4. All lectures */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Upcoming Lectures" accent="#2E3093" action={<Link href="/student-portal/dashboard/lecture-plan" className={linkCls}>Schedule</Link>}>
          {lectures.state === 'loading' && <Skeleton rows={4} />}
          {lectures.state === 'error' && <ErrorState what="lectures" onRetry={loadLectures} />}
          {lectureView && (lectureView.upcomingNext.length === 0 ? <Empty>No upcoming lectures scheduled.</Empty> : (
            <ul className="divide-y divide-[#F4F4F5]">
              {lectureView.upcomingNext.map(({ l, s }) => (
                <li key={l.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${s.key === 'cancelled' ? 'text-[#71717A] line-through' : 'text-[#18181B]'}`}>{l.subject_topic || l.subject || 'Lecture'}</p>
                      <p className="mt-0.5 text-xs text-[#71717A]">
                        {fmtDate(l.date, true)}{timeRange(l) ? ` · ${timeRange(l)}` : ''}{l.faculty_name ? ` · ${l.faculty_name}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Chip text={s.label} tone={LECTURE_TONE[s.key]} />
                      {isUrl(l.class_room) && s.key !== 'cancelled' && (
                        <a href={l.class_room!.trim()} target="_blank" rel="noreferrer" className={linkCls}>Join</a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </Card>

        <Card title="All Lectures" accent="#2E3093" action={<Link href="/student-portal/dashboard/lecture-plan" className={linkCls}>View all</Link>}>
          {lectures.state === 'loading' && <Skeleton rows={4} />}
          {lectures.state === 'error' && <ErrorState what="lectures" onRetry={loadLectures} />}
          {lectureView && (
            <>
              <div className="-mx-1 mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter lectures">
                {LECTURE_FILTERS.map((f) => (
                  <button key={f} role="tab" aria-selected={lectureFilter === f} onClick={() => setLectureFilter(f)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${lectureFilter === f ? 'border-[#2E3093] bg-[#2E3093] text-white' : 'border-[#E4E4E7] text-[#52525B] hover:bg-[#F4F4F5]'}`}>
                    {f} <span className={lectureFilter === f ? 'text-white/70' : 'text-[#A1A1AA]'}>{lectureView.counts[f]}</span>
                  </button>
                ))}
              </div>
              {lectureView.list.length === 0 ? <Empty>No {lectureFilter === 'all' ? '' : `${lectureFilter} `}lectures.</Empty> : (
                <ul className="divide-y divide-[#F4F4F5]">
                  {lectureView.list.map(({ l, s }) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#18181B]">{l.subject_topic || l.subject || 'Lecture'}</p>
                        <p className="mt-0.5 text-xs text-[#71717A]">
                          {fmtDate(l.date, true)}{timeRange(l) ? ` · ${timeRange(l)}` : ''}{l.faculty_name ? ` · ${l.faculty_name}` : ''}
                        </p>
                      </div>
                      <Chip text={s.label} tone={LECTURE_TONE[s.key]} />
                    </li>
                  ))}
                </ul>
              )}
              {lectureView.total > lectureView.list.length && (
                <p className="mt-2 text-xs text-[#71717A]">Showing {lectureView.list.length} of {lectureView.total}. <Link href="/student-portal/dashboard/lecture-plan" className={linkCls}>View all</Link></p>
              )}
            </>
          )}
        </Card>
      </div>

      {/* 5. Assignments */}
      <Card title="Assignments" accent="#2A6BB5" action={<Link href="/student-portal/dashboard/assignments" className={linkCls}>View all</Link>}>
        {assignments.state === 'loading' && <Skeleton rows={4} />}
        {assignments.state === 'error' && <ErrorState what="assignments" onRetry={loadAssignments} />}
        {assignmentView && (assignmentView.recent.length === 0 ? <Empty>No assignments given yet.</Empty> : (
          <>
            <ul className="divide-y divide-[#F4F4F5]">
              {assignmentView.recent.map((r) => {
                const shown = assignmentDisplay(r);
                return (
                  <li key={r.parentId} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#18181B]">{r.assessmentName}</p>
                      <p className="mt-0.5 text-xs text-[#71717A]">
                        {fmtDate(r.date)}{r.maxMarks !== null ? ` · Max. ${r.maxMarks} marks` : ''}
                        {r.absentOnLectureDate === true && <span className="text-amber-700"> · Absent on lecture date</span>}
                      </p>
                    </div>
                    <Chip text={shown.text} tone={shown.tone} />
                  </li>
                );
              })}
            </ul>
            {assignmentView.awaiting > 0 && assignmentView.evaluated === 0 && (
              <p className="mt-3 text-xs text-[#71717A]">Marks will appear here once results are published.</p>
            )}
          </>
        ))}
      </Card>

      {/* Existing sections kept from the previous dashboard: exam schedule and notices */}
      {(a?.final_exams.length || notices.length > 0) ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {a && a.final_exams.length > 0 && (
            <Card title="Final Examinations">
              <ul className="divide-y divide-[#F4F4F5]">
                {a.final_exams.map((e) => (
                  <li key={e.take_id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#18181B]">{e.label}</p>
                      <p className="mt-0.5 text-xs text-[#71717A]">{e.date ? fmtDate(e.date) : 'Date to be announced'}{e.max_marks ? ` · Max. ${e.max_marks} marks` : ''}</p>
                    </div>
                    <Chip text={e.status === 'upcoming' ? 'Upcoming' : 'Held'} tone={e.status === 'upcoming' ? LECTURE_TONE.upcoming : LECTURE_TONE.past} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[#71717A]">Results will appear once they are published.</p>
            </Card>
          )}
          {notices.length > 0 && (
            <Card title="Notices" action={<Link href="/student-portal/dashboard/notices" className={linkCls}>View all</Link>}>
              <ul className="divide-y divide-[#F4F4F5]">
                {notices.map((n) => (
                  <li key={n.id} className="py-2.5 first:pt-0">
                    <p className="text-sm font-medium text-[#18181B]">{n.title || 'Notice'}</p>
                    {n.specification && <p className="mt-0.5 line-clamp-2 text-xs text-[#71717A]">{n.specification}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : null}

      {feesOpen && a && <FeesDialog data={a} onClose={closeFees} />}
    </div>
  );
}
