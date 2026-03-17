'use client';

import { useEffect, useState } from 'react';

interface Batch { Batch_Id: number; Batch_code: string }
interface Lecture {
  id: number;
  lecture_no: number;
  subject_topic: string;
  subject: string;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Monthly Lecture Plan</h1>
          <p className="text-sm text-gray-500">View planned lectures from the annual batch plan</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedBatch || ''}
            onChange={e => setSelectedBatch(Number(e.target.value))}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5] bg-white"
          >
            {batches.map(b => (
              <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_code}</option>
            ))}
          </select>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5] bg-white"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold" style={{ color: '#2E3093' }}>{lectures.length}</p>
          <p className="text-xs text-gray-500">Total Lectures</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold" style={{ color: '#2A6BB5' }}>{totalPlanned}</p>
          <p className="text-xs text-gray-500">Planned</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{totalAssignments}</p>
          <p className="text-xs text-gray-500">With Assignment</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-green-600">{totalTests}</p>
          <p className="text-xs text-gray-500">With Unit Test</p>
        </div>
      </div>

      {/* Lecture table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{monthLabel} — Lecture Schedule</h2>
        </div>

        {loadingLectures ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{ borderColor: '#2E3093' }} />
            <p className="text-sm text-gray-400">Loading lectures…</p>
          </div>
        ) : lectures.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 font-medium">No lectures for {monthLabel}</p>
            <p className="text-sm text-gray-400 mt-1">Try selecting a different month or batch</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Subject / Topic</th>
                  <th className="px-6 py-3">Module</th>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Room</th>
                  <th className="px-6 py-3 text-center">Assign.</th>
                  <th className="px-6 py-3 text-center">U.Test</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lectures.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-600">{l.lecture_no}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-gray-700">
                      {l.date ? new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-xs">{l.subject_topic || l.subject || '—'}</p>
                      {l.subject && l.subject_topic && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{l.subject}</p>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{l.module || '—'}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-gray-600">
                      {l.starttime?.slice(0, 5)} – {l.endtime?.slice(0, 5)}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{l.class_room || '—'}</td>
                    <td className="px-6 py-3 text-center">
                      {l.assignment ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: '#FAE452', color: '#2E3093' }}>✓</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {l.unit_test ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: '#2A6BB5' }}>✓</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        l.status === 'Completed'
                          ? 'bg-green-50 text-green-700'
                          : l.planned
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {l.status || (l.planned ? 'Planned' : 'Pending')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
