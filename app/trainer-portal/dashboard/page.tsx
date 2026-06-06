'use client';

import { useEffect, useState } from 'react';
import { toBatchNumber } from '@/lib/batch-display';

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
  lecturecontent?: string | null;
  assignment?: number;
  unit_test?: number;
  faculty_name?: string;
  date: string;
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
  const m = raw
    .replace(/\./g, '')
    .trim()
    .match(/^\s*(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*([aApP])?\s*([mM])?\s*$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm2 = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm2)) return null;
  if (mm2 < 0 || mm2 > 59) return null;
  const hasMeridiem = Boolean(m[4]);
  if (hasMeridiem) {
    const ap = String(m[4]).toLowerCase();
    if (hh < 1 || hh > 12) return null;
    if (ap === 'a') { if (hh === 12) hh = 0; }
    else if (ap === 'p') { if (hh !== 12) hh += 12; }
  }
  if (hh < 0 || hh > 23) return null;
  return hh * 60 + mm2;
}

function formatTimeAmPm(t?: string | null): string {
  if (!t) return '—';
  const minutes = parseTimeToMinutes(t);
  if (minutes == null) {
    const compact = String(t).trim();
    const normalized = compact
      .replace(/\s+/g, '')
      .replace(/([0-9])([aApP])([mM])?$/, '$1 $2m')
      .replace(/\s([aApP])m$/, (s) => s.toLowerCase());
    return normalized || '—';
  }
  const hh24 = Math.floor(minutes / 60);
  const mm2 = minutes % 60;
  const suffix = hh24 >= 12 ? 'pm' : 'am';
  const hh12 = (hh24 % 12) || 12;
  return `${hh12}:${String(mm2).padStart(2, '0')} ${suffix}`;
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

function formatDate(raw: string) {
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TrainerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedLectures, setPlannedLectures] = useState<PlannedLecture[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>('');
  const [nowTime, setNowTime] = useState<Date>(() => new Date());
  const [disciplineOptions, setDisciplineOptions] = useState<DisciplineOption[]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [firstHalfTopic, setFirstHalfTopic] = useState('');
  const [firstHalfSubtopic, setFirstHalfSubtopic] = useState('');
  const [firstHalfActivity, setFirstHalfActivity] = useState<'lecture' | 'assignment' | 'test'>('lecture');
  const [secondHalfTopic, setSecondHalfTopic] = useState('');
  const [secondHalfSubtopic, setSecondHalfSubtopic] = useState('');
  const [secondHalfActivity, setSecondHalfActivity] = useState<'lecture' | 'assignment' | 'test'>('lecture');

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
    fetch(`/api/trainer-portal/lectures?batchId=${currentBatch.Batch_Id}&month=${m}`)
      .then(r => r.json())
      .then(d => setPlannedLectures(Array.isArray(d?.lectures) ? d.lectures : []))
      .catch(() => setPlannedLectures([]));
  }, [currentBatch?.Batch_Id]);

  useEffect(() => {
    if (!modalOpen || !currentBatch?.Batch_Id) return;
    setTopicLoading(true);
    fetch(`/api/trainer-portal/lecture-topics?batchId=${currentBatch.Batch_Id}`)
      .then(r => r.json())
      .then(d => {
        const opts: DisciplineOption[] = Array.isArray(d?.disciplines) ? d.disciplines : [];
        setDisciplineOptions(opts);
        setSelectedTopic(prev => {
          const has = prev && opts.some(o => o.name === prev);
          return has ? prev : (opts[0]?.name || '');
        });
      })
      .catch(() => setDisciplineOptions([]))
      .finally(() => setTopicLoading(false));
  }, [modalOpen, currentBatch?.Batch_Id]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLectures = plannedLectures.filter((l) => String(l.date || '').slice(0, 10) === todayIso);

  const firstHalfPlan = todayLectures.find((l) => {
    const mins = parseTimeToMinutes(l.starttime || null);
    return mins != null ? mins < 13 * 60 : true;
  }) || todayLectures[0] || null;

  const secondHalfPlan = todayLectures.find((l) => {
    const mins = parseTimeToMinutes(l.starttime || null);
    return mins != null ? mins >= 13 * 60 : false;
  }) || todayLectures[1] || null;

  useEffect(() => {
    if (!modalOpen) return;

    const defaultActivity = (l: PlannedLecture | null): 'lecture' | 'assignment' | 'test' => {
      if (!l) return 'lecture';
      if (Number(l.unit_test || 0) > 0) return 'test';
      if (Number(l.assignment || 0) > 0) return 'assignment';
      return 'lecture';
    };

    const firstTopic = String(firstHalfPlan?.lecturecontent || firstHalfPlan?.subject || '').trim();
    const firstSubtopic = String(firstHalfPlan?.subject_topic || '').trim();
    const secondTopic = String(secondHalfPlan?.lecturecontent || secondHalfPlan?.subject || '').trim();
    const secondSubtopic = String(secondHalfPlan?.subject_topic || '').trim();

    setFirstHalfTopic(firstTopic);
    setFirstHalfSubtopic(firstSubtopic);
    setSecondHalfTopic(secondTopic);
    setSecondHalfSubtopic(secondSubtopic);
    setFirstHalfActivity(defaultActivity(firstHalfPlan));
    setSecondHalfActivity(defaultActivity(secondHalfPlan));
  }, [modalOpen, firstHalfPlan, secondHalfPlan]);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-40 bg-gray-200 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 bg-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-200 rounded-2xl" />
        </div>
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500 text-lg">Failed to load. Please refresh.</p>;

  const canSignIn = !data.today_attendance;
  const canSignOut = !!data.today_attendance && !data.today_attendance.Check_Out;
  const dayComplete = !!data.today_attendance && !!data.today_attendance.Check_Out;

  const breakMinutes = Math.max(0, Math.round(Number(data.faculty.breakTimeMinutes ?? 60)));

  const recentLectureRows = data.recent_lectures.map(l => {
    const startMin = parseTimeToMinutes(l.Faculty_Start);
    const endMin = parseTimeToMinutes(l.Faculty_End);
    const minutes = startMin != null && endMin != null ? computeMinutesMinusBreak(startMin, endMin, breakMinutes) : null;
    return {
      ...l,
      _in: formatTimeAmPm(l.Faculty_Start),
      _out: formatTimeAmPm(l.Faculty_End),
      _hours: minutes == null ? '—' : formatHmFromMinutes(minutes),
      _summary: (l.Topic || l.Lecture_Name || '—').trim(),
    };
  });

  async function submitDay() {
    if (!data) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const action = canSignIn ? 'check_in' : (canSignOut ? 'check_out' : null);
      if (!action) { setSaveMsg('Already done for today.'); return; }
      const remarks = selectedTopic.trim() ? `Main Topic: ${selectedTopic.trim()}` : null;
      const res = await fetch('/api/trainer-portal/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          remarks,
          batchId: currentBatch?.Batch_Id ?? null,
          sessions: {
            first_half: {
              topic: firstHalfTopic || null,
              subtopic: firstHalfSubtopic || null,
              activityType: firstHalfActivity,
            },
            second_half: {
              topic: secondHalfTopic || null,
              subtopic: secondHalfSubtopic || null,
              activityType: secondHalfActivity,
            },
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveMsg(d?.error || 'Something went wrong. Try again.'); return; }
      setSaveMsg(action === 'check_in' ? 'You\'re signed in for today!' : 'Day ended. See you tomorrow!');
      const r = await fetch('/api/trainer-portal/dashboard');
      const nd = await r.json();
      setData(nd);
      setTimeout(() => setModalOpen(false), 900);
    } catch {
      setSaveMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const todayLabel = nowTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Hero: Today's status + big action */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2E3093 0%, #2A6BB5 100%)' }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="relative z-10">
          <p className="text-blue-200 text-base font-medium">{todayLabel}</p>
          <h1 className="text-2xl font-bold mt-1 mb-1">Hello, {data.faculty.name.split(' ')[0]}</h1>
          {data.faculty.specialization && (
            <p className="text-blue-200 text-sm mb-4">{data.faculty.specialization}</p>
          )}

          {/* Day status */}
          {dayComplete && (
            <div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/15">
              <svg className="w-6 h-6 text-green-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-white">Day complete</p>
                <p className="text-sm text-blue-200">
                  In: {formatTimeAmPm(data.today_attendance!.Check_In)} &nbsp;·&nbsp; Out: {formatTimeAmPm(data.today_attendance!.Check_Out)}
                </p>
              </div>
            </div>
          )}

          {canSignOut && (
            <div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/15">
              <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse shrink-0" />
              <div>
                <p className="font-semibold text-white">You signed in today</p>
                <p className="text-sm text-blue-200">
                  Started at {formatTimeAmPm(data.today_attendance!.Check_In)}
                </p>
              </div>
            </div>
          )}

          {canSignIn && (
            <div className="mt-2 px-4 py-3 rounded-2xl bg-white/10">
              <p className="text-sm text-blue-200">You haven't started your day yet.</p>
            </div>
          )}

          {/* Big action button */}
          {!dayComplete && (
            <button
              onClick={() => { setSaveMsg(''); setModalOpen(true); }}
              className="mt-4 w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95"
              style={{
                background: canSignIn ? '#16a34a' : '#ea580c',
                color: 'white',
                boxShadow: canSignIn ? '0 4px 20px rgba(22,163,74,0.4)' : '0 4px 20px rgba(234,88,12,0.4)',
              }}
            >
              {canSignIn ? '▶  Start My Day' : '■  End My Day'}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1">
          <p className="text-3xl font-bold" style={{ color: '#2E3093' }}>{data.total_lectures}</p>
          <p className="text-base text-gray-500 font-medium">Total Lectures</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-1">
          <p className="text-3xl font-bold" style={{ color: '#16a34a' }}>{data.this_month_attendance}</p>
          <p className="text-base text-gray-500 font-medium">Days This Month</p>
        </div>
      </div>

      {/* Current batch */}
      {currentBatch && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: '#2A6BB5' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Batch</p>
            <p className="text-lg font-bold text-gray-800 leading-tight">{toBatchNumber(currentBatch.Batch_code)}</p>
            <p className="text-sm text-gray-500 truncate">{currentBatch.Course_Name || '—'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm text-gray-500">{plannedLectures.length} planned</p>
            <p className="text-xs text-gray-400">this month</p>
          </div>
        </div>
      )}

      {/* Today's lecture cross-check */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-gray-800">Today's Lecture Cross-Check</h2>
          <span className="text-xs text-gray-400">From Standard Lecture Plan</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <p className="text-xs font-bold text-[#2E3093] uppercase tracking-wide">First Half</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{String(firstHalfPlan?.lecturecontent || firstHalfPlan?.subject || '—')}</p>
            <p className="text-xs text-gray-500 mt-0.5">Subtopic: {String(firstHalfPlan?.subject_topic || '—')}</p>
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Second Half</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{String(secondHalfPlan?.lecturecontent || secondHalfPlan?.subject || '—')}</p>
            <p className="text-xs text-gray-500 mt-0.5">Subtopic: {String(secondHalfPlan?.subject_topic || '—')}</p>
          </div>
        </div>
      </div>

      {/* Recent lectures */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Recent Lectures</h2>
          <a
            href="/trainer-portal/dashboard/lecture-plan"
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: '#2A6BB5', background: 'rgba(42,107,181,0.08)' }}
          >
            See All
          </a>
        </div>

        {recentLectureRows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-base">No lectures recorded yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentLectureRows.map(l => (
              <div key={l.Take_Id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-base leading-snug">{l._summary}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{formatDate(l.Take_Dt)} &nbsp;·&nbsp; {toBatchNumber(l.Batch_code)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-700">{l._hours}</p>
                    <p className="text-xs text-gray-400">{l._in} – {l._out}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(42,107,181,0.10)', color: '#2A6BB5' }}
                  >
                    {l.students_present} students present
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {breakMinutes > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">Break of {breakMinutes} min deducted from total hours (1:00 PM overlap).</p>
          </div>
        )}
      </div>

      {/* Sign-in / Sign-out modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle on mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="px-6 pt-4 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {canSignIn ? 'Start My Day' : 'End My Day'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {nowTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &nbsp;·&nbsp; {todayLabel}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Topic selector */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  What topic did you cover today?
                </label>
                {topicLoading ? (
                  <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                ) : disciplineOptions.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No topics found for this batch.</p>
                ) : (
                  <select
                    value={selectedTopic}
                    onChange={e => setSelectedTopic(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2A6BB5] bg-white"
                  >
                    {disciplineOptions.map(o => (
                      <option key={o.name} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                )}
                <p className="mt-1.5 text-xs text-gray-400">Optional — you can skip this.</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Today's Plan Cross-Check</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
                    <p className="text-[11px] font-bold text-[#2E3093] uppercase tracking-wide">First Half</p>
                    <p className="text-xs text-gray-800 mt-1">Topic: {String(firstHalfPlan?.lecturecontent || firstHalfPlan?.subject || '—')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Subtopic: {String(firstHalfPlan?.subject_topic || '—')}</p>
                  </div>
                  <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-2.5">
                    <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">Second Half</p>
                    <p className="text-xs text-gray-800 mt-1">Topic: {String(secondHalfPlan?.lecturecontent || secondHalfPlan?.subject || '—')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Subtopic: {String(secondHalfPlan?.subject_topic || '—')}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                  <p className="text-xs font-bold text-[#2E3093] uppercase tracking-wide">First Half</p>
                  <select
                    value={firstHalfTopic}
                    onChange={(e) => {
                      setFirstHalfTopic(e.target.value);
                      setFirstHalfSubtopic('');
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select topic</option>
                    {disciplineOptions.map((o) => (
                      <option key={`fh-${o.name}`} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                  <select
                    value={firstHalfSubtopic}
                    onChange={(e) => setFirstHalfSubtopic(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select subtopic</option>
                    {(disciplineOptions.find((o) => o.name === firstHalfTopic)?.subtopics || []).map((s) => (
                      <option key={`fh-sub-${s}`} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={firstHalfActivity}
                    onChange={(e) => setFirstHalfActivity(e.target.value as 'lecture' | 'assignment' | 'test')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="assignment">Assignment</option>
                    <option value="test">Test</option>
                  </select>
                </div>

                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 space-y-2">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Second Half</p>
                  <select
                    value={secondHalfTopic}
                    onChange={(e) => {
                      setSecondHalfTopic(e.target.value);
                      setSecondHalfSubtopic('');
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select topic</option>
                    {disciplineOptions.map((o) => (
                      <option key={`sh-${o.name}`} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                  <select
                    value={secondHalfSubtopic}
                    onChange={(e) => setSecondHalfSubtopic(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select subtopic</option>
                    {(disciplineOptions.find((o) => o.name === secondHalfTopic)?.subtopics || []).map((s) => (
                      <option key={`sh-sub-${s}`} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={secondHalfActivity}
                    onChange={(e) => setSecondHalfActivity(e.target.value as 'lecture' | 'assignment' | 'test')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="assignment">Assignment</option>
                    <option value="test">Test</option>
                  </select>
                </div>
              </div>

              {saveMsg && (
                <p
                  className="text-sm font-medium px-4 py-3 rounded-xl"
                  style={{
                    color: saveMsg.toLowerCase().includes('error') || saveMsg.toLowerCase().includes('wrong') ? '#dc2626' : '#16a34a',
                    background: saveMsg.toLowerCase().includes('error') || saveMsg.toLowerCase().includes('wrong') ? '#fef2f2' : '#f0fdf4',
                  }}
                >
                  {saveMsg}
                </p>
              )}

              <button
                onClick={submitDay}
                disabled={saving || dayComplete}
                className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95 disabled:opacity-50"
                style={{ background: canSignIn ? '#16a34a' : '#ea580c' }}
              >
                {saving ? 'Please wait…' : (canSignIn ? 'Confirm — Start My Day' : 'Confirm — End My Day')}
              </button>

              <p className="text-center text-xs text-gray-400 pb-2">
                Time is recorded automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
