'use client';

import { useEffect, useState } from 'react';
import { toBatchNumber } from '@/lib/batch-display';
import { formatTimeAmPm, localIsoDate } from '@/lib/time-format';

interface Batch { Batch_Id: number; Batch_code: string; Course_Name?: string | null; Timings?: string | null }
interface Lecture {
  id: number;
  lecture_no: number | null;
  subject_topic: string | null;
  subject: string | null;
  lecturecontent?: string | null;
  faculty_name: string | null;
  date: string | null;
  starttime: string | null;
  endtime: string | null;
  class_room: string | null;
  assignment: string | number | null;
  unit_test: string | number | null;
  unit_test_date: string | null;
  session: string | null;
  lecture_status?: string | null;
  taken?: number | boolean;
}

function fmtDate(d: string | null) {
  if (!d) return 'Date not set';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

/** subject_topic is a newline-separated list of sub-topics. */
function subtopicLines(l: Lecture) {
  return String(l.subject_topic || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

export default function LecturePlanPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [error, setError] = useState('');

  function selectBatch(id: number) {
    setSelectedBatch(id);
    setLoadingLectures(true);
    setError('');
  }

  useEffect(() => {
    fetch('/api/trainer-portal/lectures')
      .then((r) => r.json())
      .then((d) => {
        const list: Batch[] = d.batches || [];
        setBatches(list);
        if (list.length) selectBatch(list[0].Batch_Id);
      })
      .catch(() => setError('Could not load your batches.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBatch) return;
    fetch(`/api/trainer-portal/lectures?batchId=${selectedBatch}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || 'Could not load the lecture plan.');
        setLectures(Array.isArray(d.lectures) ? d.lectures : []);
      })
      .catch((err: unknown) => { setLectures([]); setError(err instanceof Error ? err.message : 'Could not load the lecture plan.'); })
      .finally(() => setLoadingLectures(false));
  }, [selectedBatch]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-3xl mx-auto">
        <div className="h-10 w-48 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  const today = localIsoDate();
  const filtered = lectures.filter((l) => {
    if (filter === 'all') return true;
    const d = l.date ? String(l.date).slice(0, 10) : null;
    if (!d) return filter === 'upcoming';
    return filter === 'upcoming' ? d >= today : d < today;
  });
  const batch = batches.find((b) => b.Batch_Id === selectedBatch);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Schedule</h1>
        <p className="text-base text-gray-500 mt-0.5">The lecture plan for your batch — the same one your students see.</p>
      </div>

      {batches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-lg font-semibold text-gray-600">No batches linked to you yet</p>
          <p className="text-base text-gray-400 mt-1">Ask the office to add you as a trainer on the batch in Batch Master.</p>
        </div>
      ) : (
        <>
          {batches.length > 1 ? (
            <select
              value={selectedBatch || ''}
              onChange={(e) => selectBatch(Number(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2A6BB5] bg-white"
            >
              {batches.map((b) => (
                <option key={b.Batch_Id} value={b.Batch_Id}>
                  {toBatchNumber(b.Batch_code)}{b.Course_Name ? ` — ${b.Course_Name}` : ''}
                </option>
              ))}
            </select>
          ) : batch && (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-base font-semibold text-gray-800">{toBatchNumber(batch.Batch_code)}</p>
              <p className="text-sm text-gray-500">{batch.Course_Name || '—'}{batch.Timings ? ` · ${batch.Timings}` : ''}</p>
            </div>
          )}

          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {(['upcoming', 'past', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2.5 rounded-lg text-base font-semibold capitalize transition-colors ${
                  filter === f ? 'bg-[#2E3093] text-white' : 'text-gray-500'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {error && <p className="text-base font-medium px-4 py-3 rounded-lg bg-red-50 text-red-600">{error}</p>}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loadingLectures ? (
              <p className="p-10 text-center text-base text-gray-400">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-10 text-center text-base text-gray-400">
                {lectures.length === 0 ? 'No lecture plan set for this batch yet' : 'Nothing here'}
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((l) => {
                  const isToday = String(l.date || '').slice(0, 10) === today;
                  const hasUnitTest = Boolean(l.unit_test) && Boolean(l.unit_test_date);
                  const topics = subtopicLines(l);
                  const title = String(l.lecturecontent || l.subject || '').trim() || topics[0] || `Lecture ${l.lecture_no ?? ''}`;
                  return (
                    <div key={l.id} className={`px-5 py-4 ${isToday ? 'bg-[#2E3093]/[0.04] border-l-4 border-[#2E3093]' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-base font-semibold text-gray-800 leading-snug">{title}</p>
                        <div className="flex flex-wrap justify-end gap-1 shrink-0">
                          {isToday && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#2E3093] text-white">Today</span>}
                          {Number(l.taken) ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Taken</span> : null}
                          {String(l.lecture_status || '') === 'cancelled' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Cancelled</span>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {fmtDate(l.date)}
                        {l.starttime && ` · ${formatTimeAmPm(l.starttime)}${l.endtime ? ` – ${formatTimeAmPm(l.endtime)}` : ''}`}
                        {l.session ? ` · Session ${l.session}` : ''}
                      </p>
                      {(l.class_room || l.faculty_name) && (
                        <p className="text-sm text-gray-400 mt-0.5">
                          {[l.class_room && `Room ${l.class_room}`, l.faculty_name].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {topics.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {topics.map((t, i) => <li key={i} className="text-sm text-gray-600">• {t}</li>)}
                        </ul>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {!l.session && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-50 text-pink-700">Session not set</span>}
                        {String(l.assignment) === '1' && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Assignment</span>}
                        {hasUnitTest && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">Unit Test · {fmtDate(l.unit_test_date)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
