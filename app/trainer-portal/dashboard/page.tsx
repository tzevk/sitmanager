'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  faculty: {
    id: number;
    name: string;
    email: string;
    mobile: string;
    specialization: string;
    type: string;
    breakTimeMinutes?: number | null;
  };
  batches: {
    Batch_Id: number;
    Batch_code: string;
    Course_Name?: string;
  }[];
  total_lectures: number;
  recent_lectures: {
    Take_Id: number;
    Take_Dt: string;
    Topic: string;
    Lecture_Name?: string;
    Duration?: string | number;
    Faculty_Start?: string | null;
    Faculty_End?: string | null;
    Batch_code: string;
    Course_Name?: string;
    students_present: number;
  }[];
  this_month_attendance: number;
  today_attendance: { Check_In: string; Check_Out: string; Status: string } | null;
}

interface PlannedLecture {
  id: number;
  lecture_no: number;
  subject_topic: string;
  subject?: string;
  faculty_name?: string;
  date: string; // YYYY-MM-DD
  starttime?: string;
  endtime?: string;
  duration?: string;
  planned?: string;
  status?: string;
}

type DisciplineOption = { name: string; subtopics: string[] };

function monthKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const raw = t.trim();
  if (!raw) return null;

  // Supports: HH:mm, HH:mm:ss, h:mm am/pm, h:mma, h:mmA (legacy-like)
  const m = raw
    .replace(/\./g, '')
    .trim()
    .match(/^\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*([aApP])?\s*([mM])?\s*$/);

  if (!m) return null;

  let hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (mm < 0 || mm > 59) return null;

  const hasMeridiem = Boolean(m[4]);
  if (hasMeridiem) {
    const ap = String(m[4]).toLowerCase();
    if (hh < 1 || hh > 12) return null;
    if (ap === 'a') {
      if (hh === 12) hh = 0;
    } else if (ap === 'p') {
      if (hh !== 12) hh += 12;
    }
  }

  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm;
}

function formatTimeAmPm(t?: string | null): string {
  if (!t) return '—';
  const minutes = parseTimeToMinutes(t);
  if (minutes == null) {
    // Fallback: best-effort insert space before AM/PM and lower-case.
    const compact = String(t).trim();
    const normalized = compact
      .replace(/\s+/g, '')
      .replace(/([0-9])([aApP])([mM])?$/, '$1 $2m')
      .replace(/\s([aApP])m$/, (s) => s.toLowerCase());
    return normalized || '—';
  }
  const hh24 = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const suffix = hh24 >= 12 ? 'pm' : 'am';
  const hh12 = (hh24 % 12) || 12;
  return `${hh12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

function formatHmFromMinutes(totalMinutes: number) {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function computeMinutesMinusBreak(startMin: number, endMin: number, breakMinutes: number) {
  if (endMin <= startMin) return 0;
  const total = endMin - startMin;
  const breakStart = 13 * 60;
  const breakEnd = breakStart + Math.max(0, Math.round(breakMinutes));
  const overlap = Math.max(0, Math.min(endMin, breakEnd) - Math.max(startMin, breakStart));
  return Math.max(0, total - overlap);
}

export default function TrainerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedLectures, setPlannedLectures] = useState<PlannedLecture[]>([]);
  const [plannedLoading, setPlannedLoading] = useState(false);

  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceMsg, setAttendanceMsg] = useState<string>('');
  const [nowTime, setNowTime] = useState<Date>(() => new Date());
  const [disciplineOptions, setDisciplineOptions] = useState<DisciplineOption[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [subtopicOpen, setSubtopicOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    discipline: '',
    subTopics: [] as string[],
    firstHalf: {
      lecture: false,
      assignment: false,
      unitTest: false,
    },
    secondHalf: {
      lecture: false,
      assignment: false,
      unitTest: false,
    },
  });

  useEffect(() => {
    fetch('/api/trainer-portal/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentBatch = data?.batches?.[0] ?? null;

  useEffect(() => {
    const t = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!currentBatch?.Batch_Id) return;
    const m = monthKey(new Date());
    setPlannedLoading(true);
    fetch(`/api/trainer-portal/lectures?batchId=${currentBatch.Batch_Id}&month=${m}`)
      .then(r => r.json())
      .then(d => setPlannedLectures(Array.isArray(d?.lectures) ? d.lectures : []))
      .catch(() => setPlannedLectures([]))
      .finally(() => setPlannedLoading(false));
  }, [currentBatch?.Batch_Id]);

  useEffect(() => {
    if (!attendanceOpen) return;
    if (!currentBatch?.Batch_Id) return;
    const m = monthKey(new Date());
    setTopicLoading(true);
    fetch(`/api/trainer-portal/lecture-topics?batchId=${currentBatch.Batch_Id}&month=${m}`)
      .then(r => r.json())
      .then(d => {
        const opts = Array.isArray(d?.disciplines) ? d.disciplines : [];
        setDisciplineOptions(opts);
        setAttendanceForm(f => {
          const has = f.discipline && opts.some((o: DisciplineOption) => o.name === f.discipline);
          const nextDiscipline = has ? f.discipline : (opts[0]?.name || '');
          return { ...f, discipline: nextDiscipline, subTopics: [] };
        });
      })
      .catch(() => setDisciplineOptions([]))
      .finally(() => setTopicLoading(false));
  }, [attendanceOpen, currentBatch?.Batch_Id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load dashboard.</p>;

  const stats = [
    {
      label: 'Total Lectures',
      value: data.total_lectures,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      bg: '#2E3093',
    },
    {
      label: 'This Month Attendance',
      value: `${data.this_month_attendance} days`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: '#16a34a',
    },
    {
      label: 'Attendance',
      value: data.today_attendance
        ? (data.today_attendance.Check_Out ? 'Day complete' : 'Working')
        : 'Schedule not marked',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: '#2E3093',
    },
  ];

  const canCheckIn = !data.today_attendance;
  const canCheckOut = !!data.today_attendance && !data.today_attendance.Check_Out;
  const dayComplete = !!data.today_attendance && !!data.today_attendance.Check_Out;

  function buildRemarks() {
    const first: string[] = [];
    if (attendanceForm.firstHalf.lecture) first.push('Lecture');
    if (attendanceForm.firstHalf.assignment) first.push('Assignment');
    if (attendanceForm.firstHalf.unitTest) first.push('Unit Test');
    const second: string[] = [];
    if (attendanceForm.secondHalf.lecture) second.push('Lecture');
    if (attendanceForm.secondHalf.assignment) second.push('Assignment');
    if (attendanceForm.secondHalf.unitTest) second.push('Unit Test');

    const parts: string[] = [];
    if (attendanceForm.discipline.trim()) parts.push(`Main Topic: ${attendanceForm.discipline.trim()}`);
    if (attendanceForm.subTopics.length) parts.push(`Sub Topic: ${attendanceForm.subTopics.join(', ')}`);
    if (first.length) parts.push(`1st Half: ${first.join(', ')}`);
    if (second.length) parts.push(`2nd Half: ${second.join(', ')}`);
    return parts.join(' | ') || null;
  }

  async function submitAttendance() {
    if (!data) return;
    setAttendanceSaving(true);
    setAttendanceMsg('');
    try {
      const action = canCheckIn ? 'check_in' : (canCheckOut ? 'check_out' : null);
      if (!action) {
        setAttendanceMsg('Attendance already completed for today.');
        return;
      }
      const res = await fetch('/api/trainer-portal/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks: buildRemarks() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAttendanceMsg(d?.error || 'Failed to mark attendance');
        return;
      }
      setAttendanceMsg(action === 'check_in' ? 'Schedule marked successfully.' : 'Checked out successfully.');
      // refresh dashboard data
      const r = await fetch('/api/trainer-portal/dashboard');
      const nd = await r.json();
      setData(nd);
      setTimeout(() => setAttendanceOpen(false), 700);
    } catch {
      setAttendanceMsg('Network error');
    } finally {
      setAttendanceSaving(false);
    }
  }

  const breakMinutes = Math.max(0, Math.round(Number(data.faculty.breakTimeMinutes ?? 60)));
  const breakLabel = breakMinutes === 0 ? 'No break deduction' : `Break overlap deducts ${breakMinutes} min max (from 1:00 PM)`;

  const recentLectureRows = data.recent_lectures.map(l => {
    const startMin = parseTimeToMinutes(l.Faculty_Start);
    const endMin = parseTimeToMinutes(l.Faculty_End);
    const minutes = startMin != null && endMin != null ? computeMinutesMinusBreak(startMin, endMin, breakMinutes) : null;
    return {
      ...l,
      _in: formatTimeAmPm(l.Faculty_Start),
      _out: formatTimeAmPm(l.Faculty_End),
      _hours: minutes == null ? '-' : formatHmFromMinutes(minutes),
      _summary: (l.Topic || l.Lecture_Name || '—').trim(),
      _date: new Date(l.Take_Dt),
    };
  });

  return (
    <div className="space-y-6">
      {/* Mobile: compact, phone-first */}
      <div className="sm:hidden space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Today</h2>
            <button
              onClick={() => { setAttendanceMsg(''); setAttendanceOpen(true); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: '#2A6BB5' }}
              disabled={dayComplete}
            >
              {dayComplete ? 'Attendance Done' : 'Attendance'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2 text-gray-500 font-semibold whitespace-nowrap">Batch No</td>
                  <td className="px-4 py-2 text-gray-800 font-medium">{currentBatch?.Batch_code || '—'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-500 font-semibold whitespace-nowrap">Batch Name</td>
                  <td className="px-4 py-2 text-gray-800 font-medium">{currentBatch?.Course_Name || '—'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-500 font-semibold whitespace-nowrap">Planned Lectures</td>
                  <td className="px-4 py-2 text-gray-800 font-medium">
                    {plannedLoading ? 'Loading…' : `${plannedLectures.length} (this month)`}
                    <a
                      href="/trainer-portal/dashboard/lecture-plan"
                      className="ml-2 text-xs font-semibold"
                      style={{ color: '#2A6BB5' }}
                    >
                      View
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Recent Lectures</h2>
          </div>

          {recentLectureRows.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">No lectures found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Summary</th>
                    <th className="px-3 py-2 font-semibold">In</th>
                    <th className="px-3 py-2 font-semibold">Out</th>
                    <th className="px-3 py-2 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentLectureRows.map(l => (
                    <tr key={l.Take_Id} className="align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                        {Number.isFinite(l._date.getTime()) ? l._date.toLocaleDateString() : l.Take_Dt}
                      </td>
                      <td className="px-3 py-2 text-gray-800">
                        <div className="max-w-[14rem]">
                          <p className="font-medium truncate">{l._summary}</p>
                          <p className="text-[11px] text-gray-500 truncate">{l.Batch_code}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">{l._in}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">{l._out}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-800">{l._hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-500">{breakLabel}.</p>
          </div>
        </div>
      </div>

      {/* Desktop/tablet: existing layout */}
      <div className="hidden sm:block space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-5 md:p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2E3093 0%, #2A6BB5 100%)' }}
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: '#FAE452' }} />
        <div className="relative z-10">
          <h1 className="text-xl md:text-2xl font-bold mb-1">Welcome, {data.faculty.name}</h1>
          <p className="text-blue-100 text-sm">
            {data.faculty.specialization && <span>{data.faculty.specialization} &bull; </span>}
            {data.faculty.email}
          </p>
          {data.today_attendance && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Checked in at {formatTimeAmPm(data.today_attendance.Check_In)}
              {data.today_attendance.Check_Out && ` — Out at ${formatTimeAmPm(data.today_attendance.Check_Out)}`}
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Batch card (inline, before Total Lectures) */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#2A6BB5' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Current Batch</p>
            <p className="text-lg font-bold text-gray-800 leading-tight truncate">{currentBatch?.Batch_code || '—'}</p>
            <p className="text-[11px] text-gray-500 truncate">{currentBatch?.Course_Name || '—'}</p>
          </div>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{ background: 'rgba(42,107,181,0.10)', color: '#2A6BB5' }}
          >
            Latest
          </span>
        </div>

        {stats.map(s => {
          const isAttendance = s.label === 'Attendance';
          if (!isAttendance) {
            return (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800 leading-tight">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: s.bg }}>
                  {s.icon}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-sm font-bold text-gray-800">{s.value}</p>
                </div>
              </div>
              <button
                onClick={() => { setAttendanceMsg(''); setAttendanceOpen(true); }}
                className="mt-3 w-full px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#2A6BB5' }}
                disabled={dayComplete}
              >
                {dayComplete ? 'Attendance Completed' : (canCheckIn ? 'Mark Schedule' : 'Check Out')}
              </button>
              {data.today_attendance && (
                <p className="mt-2 text-xs text-gray-500">
                  In: {formatTimeAmPm(data.today_attendance.Check_In)}
                  {data.today_attendance.Check_Out ? ` | Out: ${formatTimeAmPm(data.today_attendance.Check_Out)}` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent lectures */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Recent Lectures</h2>
          </div>
          {recentLectureRows.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No lectures found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Lecture Summary</th>
                    <th className="px-6 py-3">In</th>
                    <th className="px-6 py-3">Out</th>
                    <th className="px-6 py-3">Total Hours</th>
                    <th className="px-6 py-3 text-right">Present</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentLectureRows.map(l => (
                    <tr key={l.Take_Id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700 font-medium">
                        {Number.isFinite(l._date.getTime()) ? l._date.toLocaleDateString() : l.Take_Dt}
                      </td>
                      <td className="px-6 py-3 text-gray-800">
                        <div className="max-w-[28rem]">
                          <p className="font-semibold truncate">{l._summary}</p>
                          <p className="text-xs text-gray-500 truncate">{l.Batch_code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{l._in}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">{l._out}</td>
                      <td className="px-6 py-3 whitespace-nowrap font-semibold text-gray-800">{l._hours}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(42,107,181,0.1)', color: '#2A6BB5' }}>
                          {l.students_present}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{breakLabel}.</p>
          </div>
        </div>

        {/* Planned lectures (this month) — only for latest batch */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Planned Lectures</h2>
              <p className="text-sm text-gray-500">This month • {currentBatch?.Batch_code || '—'}</p>
            </div>
            <a href="/trainer-portal/dashboard/lecture-plan" className="text-sm font-medium" style={{ color: '#2A6BB5' }}>View</a>
          </div>

          {plannedLoading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : plannedLectures.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No planned lectures found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Topic</th>
                    <th className="px-6 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {plannedLectures.slice(0, 8).map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700 font-medium">{p.date}</td>
                      <td className="px-6 py-3 text-gray-800">
                        <p className="font-medium truncate max-w-xs">{(p.subject_topic || p.subject || '—').trim()}</p>
                        <p className="text-xs text-gray-500 truncate">Lecture {p.lecture_no}</p>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-gray-700">
                        {formatTimeAmPm(p.starttime)}{p.endtime ? `–${formatTimeAmPm(p.endtime)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Attendance Modal */}
      {attendanceOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAttendanceOpen(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[calc(100dvh-2rem)] flex flex-col min-h-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Mark Attendance</h3>
                <p className="text-sm text-gray-500">
                  {nowTime.toLocaleDateString()} &bull; {nowTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setAttendanceOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main Topic</label>
                  <select
                    value={attendanceForm.discipline}
                    onChange={e => {
                      setAttendanceForm(f => ({ ...f, discipline: e.target.value, subTopics: [] }));
                      setSubtopicOpen(false);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5] bg-white"
                    disabled={topicLoading || disciplineOptions.length === 0}
                  >
                    {topicLoading ? (
                      <option value="">Loading…</option>
                    ) : disciplineOptions.length === 0 ? (
                      <option value="">No topics found</option>
                    ) : (
                      disciplineOptions.map(o => (
                        <option key={o.name} value={o.name}>{o.name}</option>
                      ))
                    )}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-500">Derived from lectures assigned to you.</p>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Topic</label>
                  <button
                    type="button"
                    onClick={() => setSubtopicOpen(o => !o)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]"
                    disabled={topicLoading || disciplineOptions.length === 0}
                  >
                    {attendanceForm.subTopics.length ? `${attendanceForm.subTopics.length} selected` : 'Select sub topics'}
                  </button>

                  {subtopicOpen && (
                    <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-auto p-3">
                      {(() => {
                        const d = disciplineOptions.find(o => o.name === attendanceForm.discipline);
                        const subs = d?.subtopics || [];
                        if (subs.length === 0) {
                          return <p className="text-xs text-gray-500">No subtopics for this topic.</p>;
                        }
                        return (
                          <div className="space-y-2">
                            {subs.map(s => {
                              const checked = attendanceForm.subTopics.includes(s);
                              return (
                                <label key={s} className="flex items-start gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={checked}
                                    onChange={e => {
                                      setAttendanceForm(f => {
                                        const next = new Set(f.subTopics);
                                        if (e.target.checked) next.add(s);
                                        else next.delete(s);
                                        return { ...f, subTopics: Array.from(next) };
                                      });
                                    }}
                                  />
                                  <span className="leading-snug">{s}</span>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })()}

                      <div className="mt-3 flex items-center justify-between">
                        <button
                          type="button"
                          className="text-xs font-semibold"
                          style={{ color: '#2A6BB5' }}
                          onClick={() => setAttendanceForm(f => ({ ...f, subTopics: [] }))}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ background: '#2A6BB5' }}
                          onClick={() => setSubtopicOpen(false)}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-gray-500">Select one or more.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[11px] font-semibold text-gray-500">Selected</p>
                <p className="mt-1 text-sm text-gray-800">
                  <span className="font-semibold">Topic:</span> {attendanceForm.discipline?.trim() || '—'}
                </p>
                <p className="mt-1 text-sm text-gray-800">
                  <span className="font-semibold">Sub Topic:</span>{' '}
                  {attendanceForm.subTopics.length ? attendanceForm.subTopics.join(', ') : '—'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-gray-800">1st Half</p>
                  <p className="text-xs text-gray-500">(checkboxes saved as notes)</p>
                  <div className="mt-3 space-y-2">
                    {([
                      { key: 'lecture', label: 'Lecture' },
                      { key: 'assignment', label: 'Assignment' },
                      { key: 'unitTest', label: 'Unit Test' },
                    ] as const).map(opt => (
                      <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={attendanceForm.firstHalf[opt.key]}
                          onChange={e => setAttendanceForm(f => ({
                            ...f,
                            firstHalf: { ...f.firstHalf, [opt.key]: e.target.checked },
                          }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-gray-800">2nd Half</p>
                  <p className="text-xs text-gray-500">(checkboxes saved as notes)</p>
                  <div className="mt-3 space-y-2">
                    {([
                      { key: 'lecture', label: 'Lecture' },
                      { key: 'assignment', label: 'Assignment' },
                      { key: 'unitTest', label: 'Unit Test' },
                    ] as const).map(opt => (
                      <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={attendanceForm.secondHalf[opt.key]}
                          onChange={e => setAttendanceForm(f => ({
                            ...f,
                            secondHalf: { ...f.secondHalf, [opt.key]: e.target.checked },
                          }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {dayComplete
                    ? 'Already checked out today.'
                    : (canCheckIn ? 'Will mark schedule now (time is automatic).' : 'Will check out now (time is automatic).')}
                </div>
                <button
                  onClick={submitAttendance}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: '#2A6BB5' }}
                  disabled={attendanceSaving || dayComplete}
                >
                  {attendanceSaving ? 'Saving…' : (canCheckIn ? 'Mark Schedule' : 'Check Out')}
                </button>
              </div>

              {attendanceMsg && (
                <p className="text-sm" style={{ color: attendanceMsg.toLowerCase().includes('success') ? '#16a34a' : '#dc2626' }}>
                  {attendanceMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
