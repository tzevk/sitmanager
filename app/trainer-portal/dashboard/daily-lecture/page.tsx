'use client';

import { useEffect, useState, useCallback } from 'react';

interface Batch { Batch_Id: number; Batch_code: string }
interface Lecture {
  Take_Id: number;
  Take_Dt: string;
  Topic: string;
  Lecture_Name: string;
  Duration: string;
  ClassRoom: string;
  Faculty_Start: string;
  Faculty_End: string;
  Assign_Given: number;
  Test_Given: number;
  total_students: number;
  students_present: number;
}
interface LectureDetail {
  Take_Id: number;
  Take_Dt: string;
  Topic: string;
  Lecture_Name: string;
  Duration: string;
  ClassRoom: string;
  Faculty_Start: string;
  Faculty_End: string;
  Next_Planning: string;
  Batch_code: string;
}

export default function DailyLecturePage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);

  // Edit modal state
  const [editing, setEditing] = useState<LectureDetail | null>(null);
  const [editForm, setEditForm] = useState({
    topic: '',
    faculty_start: '',
    faculty_end: '',
    duration: '',
    class_room: '',
    next_planning: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Load batches
  useEffect(() => {
    fetch('/api/trainer-portal/lectures')
      .then(r => r.json())
      .then(d => {
        setBatches(d.batches || []);
        if (d.batches?.length) setSelectedBatch(d.batches[0].Batch_Id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadLectures = useCallback(() => {
    if (!selectedBatch) return;
    setLoadingList(true);
    fetch(`/api/trainer-portal/daily-lecture?batchId=${selectedBatch}`)
      .then(r => r.json())
      .then(d => setLectures(d.lectures || []))
      .catch(() => setLectures([]))
      .finally(() => setLoadingList(false));
  }, [selectedBatch]);

  useEffect(() => { loadLectures(); }, [loadLectures]);

  async function openEdit(takeId: number) {
    const res = await fetch(`/api/trainer-portal/daily-lecture?takeId=${takeId}`);
    const data = await res.json();
    if (data.lecture) {
      setEditing(data.lecture);
      setEditForm({
        topic: data.lecture.Topic || '',
        faculty_start: data.lecture.Faculty_Start || '',
        faculty_end: data.lecture.Faculty_End || '',
        duration: data.lecture.Duration || '',
        class_room: data.lecture.ClassRoom || '',
        next_planning: data.lecture.Next_Planning || '',
      });
      setSaveMsg('');
    }
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/trainer-portal/daily-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: editing.Take_Id, ...editForm }),
      });
      if (res.ok) {
        setSaveMsg('Saved successfully!');
        loadLectures();
        setTimeout(() => setEditing(null), 1000);
      } else {
        const d = await res.json();
        setSaveMsg(d.error || 'Save failed');
      }
    } catch { setSaveMsg('Network error'); }
    finally { setSaving(false); }
  }

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
          <h1 className="text-2xl font-bold text-gray-800">Daily Lecture</h1>
          <p className="text-sm text-gray-500">View and update your lecture records</p>
        </div>
        <select
          value={selectedBatch || ''}
          onChange={e => setSelectedBatch(Number(e.target.value))}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5] bg-white w-fit"
        >
          {batches.map(b => (
            <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_code}</option>
          ))}
        </select>
      </div>

      {/* Lectures list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Lecture Records</h2>
        </div>

        {loadingList ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#2E3093' }} />
          </div>
        ) : lectures.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="font-medium">No lectures found</p>
            <p className="text-sm mt-1">Select a different batch to view lectures</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Topic</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3">Room</th>
                  <th className="px-6 py-3 text-center">Students</th>
                  <th className="px-6 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lectures.map(l => (
                  <tr key={l.Take_Id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white text-xs" style={{ background: '#2E3093' }}>
                          <span className="font-bold leading-none">{new Date(l.Take_Dt).getDate()}</span>
                          <span className="text-[10px] opacity-80">{new Date(l.Take_Dt).toLocaleDateString('en-US', { month: 'short' })}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-xs">{l.Topic || l.Lecture_Name || '—'}</p>
                      {l.Faculty_Start && (
                        <p className="text-xs text-gray-400">{l.Faculty_Start?.slice(0, 5)} – {l.Faculty_End?.slice(0, 5)}</p>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{l.Duration || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{l.ClassRoom || '—'}</td>
                    <td className="px-6 py-3 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(42,107,181,0.1)', color: '#2A6BB5' }}>
                        {l.students_present}/{l.total_students}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => openEdit(l.Take_Id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ background: '#2A6BB5' }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Update Lecture</h3>
                <p className="text-sm text-gray-500">{editing.Batch_code} &bull; {new Date(editing.Take_Dt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                <input
                  type="text"
                  value={editForm.topic}
                  onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editForm.faculty_start}
                    onChange={e => setEditForm(f => ({ ...f, faculty_start: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={editForm.faculty_end}
                    onChange={e => setEditForm(f => ({ ...f, faculty_end: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={editForm.duration}
                    onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Classroom</label>
                  <input
                    type="text"
                    value={editForm.class_room}
                    onChange={e => setEditForm(f => ({ ...f, class_room: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Planning</label>
                <textarea
                  value={editForm.next_planning}
                  onChange={e => setEditForm(f => ({ ...f, next_planning: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5] resize-none"
                />
              </div>

              {saveMsg && (
                <p className={`text-sm font-medium ${saveMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMsg}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60"
                style={{ background: '#2E3093' }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
