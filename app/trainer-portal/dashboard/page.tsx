'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toBatchNumber } from '@/lib/batch-display';
import { parseTimeToMinutes, formatTimeAmPm, localIsoDate } from '@/lib/time-format';

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
  lecture_status?: string | null;
  id: number;
  lecture_no?: number | null;
  subject_topic: string | null;
  subject?: string | null;
  lecturecontent?: string | null;
  date: string | null;
  starttime?: string | null;
  endtime?: string | null;
  session?: string | null;
  class_room?: string | null;
  assignment?: string | number | null;
  unit_test?: string | number | null;
  trainer_in_time?: string | null;
  trainer_out_time?: string | null;
  taken?: number | boolean;
}

interface BatchDetails {
  batch: {
    batch_id: number;
    batch_code: string;
    course_name: string | null;
    duration: string | null;
    timings: string | null;
  };
  students: { student_id: number; student_name: string }[];
  assignments: { lecture_no: number | null; assignment: string; date: string | null }[];
}

type ActivityType = 'lecture' | 'assignment' | 'test';

function defaultActivityFor(l: PlannedLecture | null): ActivityType {
  if (!l) return 'lecture';
  if (Number(l.unit_test || 0) > 0) return 'test';
  if (Number(l.assignment || 0) > 0) return 'assignment';
  return 'lecture';
}

function lectureTitle(l: PlannedLecture) {
  return String(l.lecturecontent || l.subject || '').trim()
    || subtopicOptions(l)[0]
    || `Lecture ${l.lecture_no ?? ''}`.trim();
}

/** "Session 1 · 10:00 am – 1:00 pm" */
function lectureWhen(l: PlannedLecture) {
  const time = l.starttime ? `${formatTimeAmPm(l.starttime)}${l.endtime ? ` – ${formatTimeAmPm(l.endtime)}` : ''}` : '';
  return [l.session ? `Session ${l.session}` : '', time].filter(Boolean).join(' · ') || 'Time not set';
}

const byStartTime = (a: PlannedLecture, b: PlannedLecture) =>
  (parseTimeToMinutes(a.starttime || null) ?? 9999) - (parseTimeToMinutes(b.starttime || null) ?? 9999);

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

/** subject_topic is stored as a newline-separated list of individual sub-topic lines. */
function subtopicOptions(l: PlannedLecture | null): string[] {
  if (!l?.subject_topic) return [];
  return l.subject_topic
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

export default function TrainerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedLectures, setPlannedLectures] = useState<PlannedLecture[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [breakMinutes, setBreakMinutes] = useState<number | ''>('');

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Start My Day: the Lecture Plan rows the trainer picks, each with the
  // sub-topic positions (in subject_topic) they will cover.
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [picked, setPicked] = useState<Record<number, number[]>>({});
  // End My Day: what each started session turned out to be.
  const [endActivities, setEndActivities] = useState<Record<number, ActivityType>>({});

  const [batchDetailsOpen, setBatchDetailsOpen] = useState(false);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null);
  const [batchDetailsError, setBatchDetailsError] = useState('');

  useEffect(() => {
    fetch('/api/trainer-portal/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const batches = useMemo(() => data?.batches ?? [], [data]);

  // Default to the trainer's first ongoing batch once loaded; the Start My Day
  // modal lets them pick a different one if they teach more than one.
  useEffect(() => {
    if (selectedBatchId == null && batches.length > 0) {
      setSelectedBatchId(batches[0].Batch_Id);
    }
  }, [batches, selectedBatchId]);

  const currentBatch = batches.find(b => b.Batch_Id === selectedBatchId) ?? batches[0] ?? null;

  // The batch's whole lecture plan — the same rows the Student Portal shows.
  const loadPlan = useCallback(async (batchId: number | undefined) => {
    if (!batchId) { setPlannedLectures([]); return; }
    try {
      const r = await fetch(`/api/trainer-portal/lectures?batchId=${batchId}`);
      const d = await r.json();
      setPlannedLectures(Array.isArray(d?.lectures) ? d.lectures : []);
    } catch {
      setPlannedLectures([]);
    }
  }, []);

  useEffect(() => { loadPlan(currentBatch?.Batch_Id); }, [currentBatch?.Batch_Id, loadPlan]);

  const todayIso = localIsoDate();
  const todayLectures = plannedLectures
    .filter(l => String(l.date || '').slice(0, 10) === todayIso && String(l.lecture_status || '') !== 'cancelled')
    .sort(byStartTime);
  // Lectures a trainer may pick instead of today's: not yet taken, nearest first.
  const otherLectures = plannedLectures
    .filter(l => !todayLectures.includes(l) && !Number(l.taken))
    .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
  // Sessions started today and not yet ended.
  const startedLectures = plannedLectures.filter(l => l.trainer_in_time && !l.trainer_out_time).sort(byStartTime);

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

  function openStartDayModal() {
    setSaveMsg('');
    // Today's sessions are pre-selected with all their sub-topics ticked.
    setPicked(Object.fromEntries(todayLectures.map(l => [l.id, subtopicOptions(l).map((_, i) => i)])));
    setStartModalOpen(true);
  }

  function togglePicked(l: PlannedLecture) {
    setPicked(prev => {
      const next = { ...prev };
      if (next[l.id]) delete next[l.id];
      else next[l.id] = subtopicOptions(l).map((_, i) => i);
      return next;
    });
  }

  function toggleSubtopic(lectureId: number, idx: number) {
    setPicked(prev => {
      const cur = prev[lectureId] ?? [];
      return { ...prev, [lectureId]: cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx] };
    });
  }

  async function confirmStartDay() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/trainer-portal/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_in',
          batchId: currentBatch?.Batch_Id ?? null,
          lectures: Object.entries(picked).map(([id, subtopics]) => ({ id: Number(id), subtopics })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveMsg(d?.error || 'Something went wrong. Please try again.'); return; }
      await Promise.all([refreshData(), loadPlan(currentBatch?.Batch_Id)]);
      setStartModalOpen(false);
    } catch {
      setSaveMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function openBatchDetails(batchId: number) {
    setBatchDetailsOpen(true);
    setBatchDetailsLoading(true);
    setBatchDetailsError('');
    setBatchDetails(null);
    try {
      const res = await fetch(`/api/trainer-portal/batch-details?batchId=${batchId}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setBatchDetailsError(d?.error || 'Could not load batch details.'); return; }
      setBatchDetails(d);
    } catch {
      setBatchDetailsError('Network error. Please try again.');
    } finally {
      setBatchDetailsLoading(false);
    }
  }

  // The sessions picked at Start My Day (or, failing that, today's plan).
  const endLectures = startedLectures.length ? startedLectures : todayLectures;

  function openEndDayModal() {
    setSaveMsg('');
    setEndActivities(Object.fromEntries(endLectures.map(l => [l.id, defaultActivityFor(l)])));
    const defaultBreak = data?.faculty?.breakTimeMinutes;
    setBreakMinutes(Number.isFinite(Number(defaultBreak)) && defaultBreak != null ? Number(defaultBreak) : '');
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
          breakMinutes: breakMinutes === '' ? null : Number(breakMinutes),
          lectures: endLectures.map(l => ({ id: l.id, activityType: endActivities[l.id] ?? defaultActivityFor(l) })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveMsg(d?.error || 'Something went wrong. Please try again.'); return; }
      await Promise.all([refreshData(), loadPlan(currentBatch?.Batch_Id)]);
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
            onClick={canSignIn ? openStartDayModal : openEndDayModal}
            disabled={saving}
            className="mt-4 w-full py-4 rounded-lg font-bold text-lg disabled:opacity-60"
            style={{ background: canSignIn ? '#16a34a' : '#b45309', color: 'white' }}
          >
            {canSignIn ? 'Start My Day' : 'End My Day'}
          </button>
        )}

        {saveMsg && !modalOpen && !startModalOpen && (
          <p className="mt-3 text-sm font-medium text-yellow-100">{saveMsg}</p>
        )}
      </div>

      {/* Today's sessions, straight from the batch's lecture plan */}
      {currentBatch && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-800">Today&rsquo;s Sessions</h2>
            <p className="text-sm text-gray-500 truncate">{toBatchNumber(currentBatch.Batch_code)}</p>
          </div>
          {todayLectures.length === 0 ? (
            <p className="text-base text-gray-400">No session planned for today in this batch.</p>
          ) : (
            <div className="space-y-3">
              {todayLectures.map(l => (
                <div key={l.id} className="rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-sm font-semibold text-[#2E3093]">{lectureWhen(l)}</p>
                  <p className="text-base font-semibold text-gray-800 mt-0.5">{lectureTitle(l)}</p>
                  {subtopicOptions(l).length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {subtopicOptions(l).map((t, i) => <li key={i} className="text-sm text-gray-600">• {t}</li>)}
                    </ul>
                  )}
                  {l.class_room && <p className="text-sm text-gray-400 mt-1">Room {l.class_room}</p>}
                </div>
              ))}
            </div>
          )}
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
              <button
                key={b.Batch_Id}
                type="button"
                onClick={() => openBatchDetails(b.Batch_Id)}
                className="w-full text-left rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between gap-3 hover:border-[#2E3093]/40 hover:bg-[#2E3093]/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-800 truncate">{toBatchNumber(b.Batch_code)}</p>
                  <p className="text-sm text-gray-500 truncate">{b.Course_Name || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-medium text-gray-600">{b.Timings?.trim() || 'Timing not set'}</p>
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
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

      {/* Start-my-day modal: pick the batch, then the session(s) from its lecture plan
          and the sub-topics to cover. */}
      {startModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => !saving && setStartModalOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2 shrink-0">
              <h3 className="text-xl font-bold text-gray-800">Start My Day</h3>
              <p className="text-sm text-gray-500 mt-1">{todayLabel}</p>
            </div>

            <div className="px-6 py-4 space-y-5 overflow-y-auto">
              {batches.length > 1 && (
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">Batch</label>
                  <select
                    value={selectedBatchId ?? ''}
                    onChange={e => setSelectedBatchId(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base bg-white"
                  >
                    {batches.map(b => (
                      <option key={b.Batch_Id} value={b.Batch_Id}>
                        {toBatchNumber(b.Batch_code)} — {b.Course_Name || 'Untitled'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {batches.length === 1 && currentBatch && (
                <div>
                  <p className="text-base font-semibold text-gray-700">{toBatchNumber(currentBatch.Batch_code)}</p>
                  <p className="text-sm text-gray-500">{currentBatch.Course_Name || '—'}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <p className="text-base font-semibold text-gray-700">Which session(s) are you taking today?</p>
                <p className="text-sm text-gray-400 mt-0.5">Tick the session, then the topics you will cover.</p>
              </div>

              {[...todayLectures, ...otherLectures.filter(l => picked[l.id] && !todayLectures.includes(l))].map(l => {
                const isPicked = Boolean(picked[l.id]);
                const isToday = todayLectures.includes(l);
                return (
                  <div key={l.id} className={`rounded-lg border-2 ${isPicked ? 'border-[#2E3093] bg-[#2E3093]/[0.03]' : 'border-gray-200'}`}>
                    <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
                      <input type="checkbox" checked={isPicked} onChange={() => togglePicked(l)} className="mt-1 w-5 h-5 accent-[#2E3093]" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#2E3093]">
                          {lectureWhen(l)}{!isToday && l.date ? ` · planned ${formatDate(l.date)}` : ''}
                        </p>
                        <p className="text-base font-semibold text-gray-800">{lectureTitle(l)}</p>
                      </div>
                    </label>
                    {isPicked && subtopicOptions(l).length > 0 && (
                      <div className="px-4 pb-3 pl-12 space-y-2">
                        {subtopicOptions(l).map((topic, idx) => (
                          <label key={idx} className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(picked[l.id] ?? []).includes(idx)}
                              onChange={() => toggleSubtopic(l.id, idx)}
                              className="mt-0.5 w-4 h-4 accent-[#2E3093]"
                            />
                            <span className="text-sm text-gray-700">{topic}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {todayLectures.length === 0 && (
                <p className="text-sm text-gray-500">No session is planned for today. Pick the lecture you are taking:</p>
              )}
              {otherLectures.length > 0 && (
                <select
                  value=""
                  onChange={e => {
                    const l = otherLectures.find(x => x.id === Number(e.target.value));
                    if (l && !picked[l.id]) togglePicked(l);
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base bg-white"
                >
                  <option value="">{todayLectures.length ? '+ Taking a different lecture?' : 'Choose a lecture from the plan'}</option>
                  {otherLectures.filter(l => !picked[l.id]).map(l => (
                    <option key={l.id} value={l.id}>
                      {l.date ? `${formatDate(l.date)} · ` : ''}{lectureTitle(l)}
                    </option>
                  ))}
                </select>
              )}

              {saveMsg && (
                <p className="text-sm font-medium px-4 py-3 rounded-lg bg-red-50 text-red-600">{saveMsg}</p>
              )}
            </div>

            <div className="px-6 pb-6 pt-2 flex gap-3 shrink-0">
              <button
                onClick={() => setStartModalOpen(false)}
                disabled={saving}
                className="flex-1 py-3 rounded-lg font-semibold text-base border-2 border-gray-200 text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmStartDay}
                disabled={saving}
                className="flex-1 py-3 rounded-lg font-bold text-base text-white disabled:opacity-60"
                style={{ background: '#16a34a' }}
              >
                {saving ? 'Starting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch details modal: opened by clicking a batch in "Ongoing Batches" */}
      {batchDetailsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setBatchDetailsOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-3 shrink-0 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Batch Details</h3>
            </div>
            <div className="px-6 py-4 overflow-y-auto space-y-5">
              {batchDetailsLoading ? (
                <p className="text-base text-gray-400">Loading…</p>
              ) : batchDetailsError ? (
                <p className="text-sm font-medium px-4 py-3 rounded-lg bg-red-50 text-red-600">{batchDetailsError}</p>
              ) : batchDetails ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-400">Training Programme</p>
                      <p className="text-base font-semibold text-gray-800">{batchDetails.batch.course_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Batch</p>
                      <p className="text-base font-semibold text-gray-800">{toBatchNumber(batchDetails.batch.batch_code)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Duration</p>
                      <p className="text-base font-semibold text-gray-800">{batchDetails.batch.duration || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Timings</p>
                      <p className="text-base font-semibold text-gray-800">{batchDetails.batch.timings || '—'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-2">
                      Students ({batchDetails.students.length})
                    </p>
                    {batchDetails.students.length === 0 ? (
                      <p className="text-sm text-gray-400">No students on record for this batch.</p>
                    ) : (
                      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {batchDetails.students.map(s => (
                          <p key={s.student_id} className="px-4 py-2.5 text-sm text-gray-700">{s.student_name}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-2">
                      Assignments (Standard Lecture Plan)
                    </p>
                    {batchDetails.assignments.length === 0 ? (
                      <p className="text-sm text-gray-400">No assignments planned for this batch.</p>
                    ) : (
                      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {batchDetails.assignments.map((a, idx) => (
                          <div key={idx} className="px-4 py-2.5">
                            <p className="text-sm font-medium text-gray-700">{a.assignment}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {a.lecture_no ? `Lecture ${a.lecture_no}` : ''}
                              {a.date ? ` · ${formatDate(a.date)}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <div className="px-6 py-4 shrink-0 border-t border-gray-100">
              <button
                onClick={() => setBatchDetailsOpen(false)}
                className="w-full py-3 rounded-lg font-semibold text-base border-2 border-gray-200 text-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End-day modal: each session picked at Start My Day, with what it turned out to be */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => !saving && setModalOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-xl font-bold text-gray-800">End My Day</h3>
              <p className="text-sm text-gray-500 mt-1">
                {todayLabel}{currentBatch ? ` · ${toBatchNumber(currentBatch.Batch_code)}` : ''}
              </p>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {endLectures.length === 0 ? (
                <p className="text-sm text-gray-500">No session was picked today.</p>
              ) : endLectures.map(l => (
                <div key={l.id}>
                  <p className="text-sm font-semibold text-[#2E3093]">{lectureWhen(l)}</p>
                  <p className="text-base font-semibold text-gray-800">{lectureTitle(l)}</p>
                  <select
                    value={endActivities[l.id] ?? defaultActivityFor(l)}
                    onChange={e => setEndActivities(prev => ({ ...prev, [l.id]: e.target.value as ActivityType }))}
                    className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base bg-white"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="assignment">Assignment</option>
                    <option value="test">Test</option>
                  </select>
                </div>
              ))}

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">Break (minutes)</label>
                <input
                  type="number"
                  min={0}
                  value={breakMinutes}
                  onChange={e => setBreakMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Break minutes"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-base focus:outline-none focus:border-[#2E3093]"
                />
              </div>

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
