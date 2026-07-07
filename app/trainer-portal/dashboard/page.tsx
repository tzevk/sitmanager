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
    hourlyRate?: number | null;
  };
  batches: {
    Batch_Id: number;
    Batch_code: string;
    Course_Name?: string;
    Timings?: string | null;
  }[];
  total_lectures: number;
  recent_lectures: {
    Take_Id: number;
    Take_Dt: string;
    Topic: string;
    Lecture_Name?: string;
    Faculty_Start?: string | null;
    Faculty_End?: string | null;
    Batch_code: string;
    Course_Name?: string;
    students_present: number;
  }[];
  this_month_attendance: number;
  this_month_work_minutes?: number;
  this_month_estimated_pay?: number;
  today_attendance: { Check_In: string; Check_Out: string; Status: string } | null;
}

interface PlannedLecture {
  subject_topic: string;
  subject?: string;
  lecturecontent?: string | null;
  date: string;
  starttime?: string;
  assignment?: number;
  unit_test?: number;
}

type ActivityType = 'lecture' | 'assignment' | 'test';

function defaultActivityFor(l: PlannedLecture | null): ActivityType {
  if (!l) return 'lecture';
  if (Number(l.unit_test || 0) > 0) return 'test';
  if (Number(l.assignment || 0) > 0) return 'assignment';
  return 'lecture';
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
  if (minutes == null) return String(t).trim() || '—';
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

function formatCurrencyInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(raw: string) {
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export default function TrainerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedLectures, setPlannedLectures] = useState<PlannedLecture[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [firstHalfTopic, setFirstHalfTopic] = useState('');
  const [firstHalfActivity, setFirstHalfActivity] = useState<ActivityType>('lecture');
  const [secondHalfTopic, setSecondHalfTopic] = useState('');
  const [secondHalfActivity, setSecondHalfActivity] = useState<ActivityType>('lecture');

  useEffect(() => {
    fetch('/api/trainer-portal/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Always the trainer's (first) ongoing batch — no manual picker, it's fetched automatically.
  const batches = data?.batches ?? [];
  const currentBatch = batches[0] ?? null;

  // Pull the standard lecture plan so we can default each half's topic to what's scheduled for today.
  useEffect(() => {
    if (!currentBatch?.Batch_Id) { setPlannedLectures([]); return; }
    const m = monthKey(new Date());
    fetch(`/api/trainer-portal/lectures?batchId=${currentBatch.Batch_Id}&month=${m}`)
      .then(r => r.json())
      .then(d => setPlannedLectures(Array.isArray(d?.lectures) ? d.lectures : []))
      .catch(() => setPlannedLectures([]));
  }, [currentBatch?.Batch_Id]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayLectures = plannedLectures.filter(l => String(l.date || '').slice(0, 10) === todayIso);
  const firstHalfPlan = todayLectures.find(l => {
    const mins = parseTimeToMinutes(l.starttime || null);
    return mins != null ? mins < 13 * 60 : true;
  }) || todayLectures[0] || null;
  const secondHalfPlan = todayLectures.find(l => {
    const mins = parseTimeToMinutes(l.starttime || null);
    return mins != null ? mins >= 13 * 60 : false;
  }) || todayLectures[1] || null;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl mx-auto">
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="h-24 bg-gray-200 rounded-xl" />
        <div className="h-56 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500 text-lg">Could not load the dashboard. Please refresh the page.</p>;

  const canSignIn = !data.today_attendance;
  const canSignOut = !!data.today_attendance && !data.today_attendance.Check_Out;
  const dayComplete = !!data.today_attendance && !!data.today_attendance.Check_Out;

  const recentLectureRows = data.recent_lectures.map(l => ({
    ...l,
    _in: formatTimeAmPm(l.Faculty_Start),
    _out: formatTimeAmPm(l.Faculty_End),
    _summary: (l.Topic || l.Lecture_Name || 'No topic recorded').trim(),
  }));

  async function refreshData() {
    const r = await fetch('/api/trainer-portal/dashboard');
    const nd = await r.json();
    setData(nd);
  }

  async function startDay() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/trainer-portal/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_in' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveMsg(d?.error || 'Something went wrong. Please try again.'); return; }
      await refreshData();
    } catch {
      setSaveMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function openEndDayModal() {
    setSaveMsg('');
    setFirstHalfTopic(String(firstHalfPlan?.lecturecontent || firstHalfPlan?.subject || '').trim());
    setFirstHalfActivity(defaultActivityFor(firstHalfPlan));
    setSecondHalfTopic(String(secondHalfPlan?.lecturecontent || secondHalfPlan?.subject || '').trim());
    setSecondHalfActivity(defaultActivityFor(secondHalfPlan));
    setModalOpen(true);
  }

  async function confirmEndDay() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/trainer-portal/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_out',
          batchId: currentBatch?.Batch_Id ?? null,
          sessions: {
            first_half: { topic: firstHalfTopic.trim() || null, activityType: firstHalfActivity },
            second_half: { topic: secondHalfTopic.trim() || null, activityType: secondHalfActivity },
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveMsg(d?.error || 'Something went wrong. Please try again.'); return; }
      await refreshData();
      setModalOpen(false);
    } catch {
      setSaveMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Greeting + today's status */}
      <div className="rounded-xl p-6 text-white" style={{ background: '#2E3093' }}>
        <p className="text-blue-100 text-base">{todayLabel}</p>
        <h1 className="text-2xl font-bold mt-1">Hello, {data.faculty.name?.split(' ')[0] || 'Trainer'}</h1>

        <div className="mt-4 px-4 py-3 rounded-lg bg-white/10">
          {dayComplete && (
            <p className="text-base">
              Day complete — In {formatTimeAmPm(data.today_attendance!.Check_In)}, Out {formatTimeAmPm(data.today_attendance!.Check_Out)}
            </p>
          )}
          {canSignOut && (
            <p className="text-base">Signed in at {formatTimeAmPm(data.today_attendance!.Check_In)}</p>
          )}
          {canSignIn && (
            <p className="text-base text-blue-100">You have not started your day yet.</p>
          )}
        </div>

        {!dayComplete && (
          <button
            onClick={canSignIn ? startDay : openEndDayModal}
            disabled={saving}
            className="mt-4 w-full py-4 rounded-lg font-bold text-lg disabled:opacity-60"
            style={{ background: canSignIn ? '#16a34a' : '#b45309', color: 'white' }}
          >
            {saving && canSignIn ? 'Starting…' : canSignIn ? 'Start Day' : 'End Day'}
          </button>
        )}

        {saveMsg && !modalOpen && (
          <p className="mt-3 text-sm font-medium text-yellow-100">{saveMsg}</p>
        )}
      </div>

      {/* Today's scheduled lecture, read-only, straight from the standard lecture plan */}
      {(firstHalfPlan || secondHalfPlan) && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <h2 className="text-base font-semibold text-gray-500 mb-3">Today&rsquo;s Lecture</h2>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-500">First Half</p>
              <p className="text-lg font-semibold text-gray-800">
                {String(firstHalfPlan?.lecturecontent || firstHalfPlan?.subject || '—')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Second Half</p>
              <p className="text-lg font-semibold text-gray-800">
                {String(secondHalfPlan?.lecturecontent || secondHalfPlan?.subject || '—')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Monthly summary */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <h2 className="text-base font-semibold text-gray-500 mb-3">This Month</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-800">{data.total_lectures}</p>
            <p className="text-sm text-gray-500">Lectures</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{data.this_month_attendance}</p>
            <p className="text-sm text-gray-500">Days Present</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{formatHmFromMinutes(Number(data.this_month_work_minutes || 0))}</p>
            <p className="text-sm text-gray-500">Hours Worked</p>
          </div>
        </div>
        {Number(data.faculty.hourlyRate || 0) > 0 && (
          <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
            Estimated payout: <span className="font-semibold text-gray-700">{formatCurrencyInr(Number(data.this_month_estimated_pay || 0))}</span>
          </p>
        )}
      </div>

      {/* Ongoing batches */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Ongoing Batches</h2>
        {batches.length === 0 ? (
          <p className="text-base text-gray-400">No ongoing batches assigned to you right now.</p>
        ) : (
          <div className="space-y-2">
            {batches.map(b => (
              <div key={b.Batch_Id} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-800 truncate">{toBatchNumber(b.Batch_code)}</p>
                  <p className="text-sm text-gray-500 truncate">{b.Course_Name || '—'}</p>
                </div>
                <p className="text-sm font-medium text-gray-600 shrink-0">{b.Timings?.trim() || 'Timing not set'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent lectures */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Recent Lectures</h2>
        </div>
        {recentLectureRows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-base">No lectures recorded yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentLectureRows.map(l => (
              <div key={l.Take_Id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-base leading-snug">{l._summary}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{formatDate(l.Take_Dt)} · {toBatchNumber(l.Batch_code)}</p>
                  </div>
                  <p className="text-sm text-gray-500 shrink-0">{l._in} – {l._out}</p>
                </div>
                <p className="text-sm text-gray-400 mt-1">{l.students_present} students present</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* End-day modal: first half + second half, each with a typable lecture name and an activity type */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => !saving && setModalOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-xl font-bold text-gray-800">End My Day</h3>
              <p className="text-sm text-gray-500 mt-1">
                {todayLabel}{currentBatch ? ` · ${toBatchNumber(currentBatch.Batch_code)}` : ''}
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">First Half</label>
                <input
                  type="text"
                  value={firstHalfTopic}
                  onChange={e => setFirstHalfTopic(e.target.value)}
                  placeholder="Lecture name"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-[#2E3093]"
                  autoFocus
                />
                <select
                  value={firstHalfActivity}
                  onChange={e => setFirstHalfActivity(e.target.value as ActivityType)}
                  className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base bg-white"
                >
                  <option value="lecture">Lecture</option>
                  <option value="assignment">Assignment</option>
                  <option value="test">Test</option>
                </select>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Second Half</label>
                <input
                  type="text"
                  value={secondHalfTopic}
                  onChange={e => setSecondHalfTopic(e.target.value)}
                  placeholder="Lecture name"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-[#2E3093]"
                />
                <select
                  value={secondHalfActivity}
                  onChange={e => setSecondHalfActivity(e.target.value as ActivityType)}
                  className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base bg-white"
                >
                  <option value="lecture">Lecture</option>
                  <option value="assignment">Assignment</option>
                  <option value="test">Test</option>
                </select>
              </div>

              <p className="text-sm text-gray-400">Leave a field blank to skip that half.</p>

              {saveMsg && (
                <p className="text-sm font-medium px-4 py-3 rounded-lg bg-red-50 text-red-600">{saveMsg}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1 py-3 rounded-lg font-semibold text-base border-2 border-gray-200 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEndDay}
                  disabled={saving}
                  className="flex-1 py-3 rounded-lg font-bold text-base text-white disabled:opacity-60"
                  style={{ background: '#b45309' }}
                >
                  {saving ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
