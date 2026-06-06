'use client';

import { useEffect, useState } from 'react';
import { toBatchNumber } from '@/lib/batch-display';

interface Batch { Batch_Id: number; Batch_code: string }
interface Lecture {
  id: number;
  lecture_no: number;
  subject_topic: string;
  subject: string;
  lecturecontent?: string | null;
  faculty_name: string;
  date: string;
  starttime: string;
  endtime: string;
  duration: string;
  class_room: string;
  assignment: number;
  unit_test: number;
  module: string;
  planned: number;
  status: string;
}

function parseTimeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const raw = String(t).trim();
  if (!raw) return null;

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

export default function LecturePlanPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLectures, setLoadingLectures] = useState(false);

  // Load batches
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/trainer-portal/lectures');
        const d = await r.json();
        setBatches(d.batches || []);
        if (d.batches?.length) setSelectedBatch(d.batches[0].Batch_Id);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load lectures when batch/month changes
  useEffect(() => {
    if (!selectedBatch) return;
    (async () => {
      setLoadingLectures(true);
      try {
        const r = await fetch(`/api/trainer-portal/lectures?batchId=${selectedBatch}&month=${month}`);
        const d = await r.json();
        setLectures(d.lectures || []);
      } catch {
        setLectures([]);
      } finally {
        setLoadingLectures(false);
      }
    })();
  }, [selectedBatch, month]);

  const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const totalPlanned = lectures.filter(l => l.planned).length;
  const totalAssignments = lectures.filter(l => l.assignment).length;
  const totalTests = lectures.filter(l => l.unit_test).length;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Schedule</h1>
        <p className="text-base text-gray-500 mt-0.5">Planned lectures for the selected month</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedBatch || ''}
          onChange={e => setSelectedBatch(Number(e.target.value))}
          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2A6BB5] bg-white"
        >
          {batches.map(b => (
            <option key={b.Batch_Id} value={b.Batch_Id}>{toBatchNumber(b.Batch_code)}</option>
          ))}
        </select>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-[#2A6BB5] bg-white"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-3xl font-bold" style={{ color: '#2E3093' }}>{lectures.length}</p>
          <p className="text-base text-gray-500 font-medium mt-1">Lectures Planned</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-3xl font-bold text-amber-600">{totalAssignments}</p>
          <p className="text-base text-gray-500 font-medium mt-1">With Assignment</p>
        </div>
      </div>

      {/* Lectures list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{monthLabel}</h2>
        </div>

        {loadingLectures ? (
          <div className="p-10 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: '#2E3093' }} />
            <p className="text-base text-gray-400">Loading…</p>
          </div>
        ) : lectures.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-14 h-14 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 font-semibold text-lg">No lectures for {monthLabel}</p>
            <p className="text-base text-gray-400 mt-1">Try a different month or batch</p>
          </div>
        ) : (
          /* Card list — readable at any age */
          <div className="divide-y divide-gray-100">
            {lectures.map(l => (
              <div key={l.id} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  {/* Lecture number bubble */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5"
                    style={{ background: '#2E3093' }}
                  >
                    {l.lecture_no}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-800 leading-snug">
                      {l.subject_topic || l.subject || '—'}
                    </p>
                    {l.lecturecontent && (
                      <p className="text-sm text-gray-500 mt-0.5">{String(l.lecturecontent).trim()}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      {l.date && (
                        <span className="text-sm text-gray-600 font-medium">
                          {new Date(l.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {(l.starttime || l.endtime) && (
                        <span className="text-sm text-gray-500">
                          {formatTimeAmPm(l.starttime)}{l.endtime ? ` – ${formatTimeAmPm(l.endtime)}` : ''}
                        </span>
                      )}
                      {l.class_room && (
                        <span className="text-sm text-gray-500">Room: {l.class_room}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        l.status === 'Completed'
                          ? 'bg-green-50 text-green-700'
                          : l.planned
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {l.status || (l.planned ? 'Planned' : 'Pending')}
                      </span>
                      {!!l.assignment && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                          Assignment
                        </span>
                      )}
                      {!!l.unit_test && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
                          Unit Test
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
