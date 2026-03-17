'use client';

import { useEffect, useState, useCallback } from 'react';

interface Batch { Batch_Id: number; Batch_code: string }
interface LectureSummary {
  Take_Id: number;
  Take_Dt: string;
  Topic: string;
  Lecture_Name: string;
  Assign_Given: number;
  total_students: number;
  assignments_received: number;
}
interface Student {
  ID: number;
  Student_Id: number;
  Student_Name: string;
  Student_Atten: number;
  AssignmentReceived: number;
  Late: number;
}

export default function AssignmentsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [lectures, setLectures] = useState<LectureSummary[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingLectures, setLoadingLectures] = useState(false);

  // Student assignment modal
  const [selectedLecture, setSelectedLecture] = useState<LectureSummary | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [changes, setChanges] = useState<Record<number, number>>({});

  // Load batches
  useEffect(() => {
    fetch('/api/trainer-portal/lectures')
      .then(r => r.json())
      .then(d => {
        setBatches(d.batches || []);
        if (d.batches?.length) setSelectedBatch(d.batches[0].Batch_Id);
      })
      .catch(() => {})
      .finally(() => setLoadingBatches(false));
  }, []);

  // Load lectures for batch
  const loadLectures = useCallback(() => {
    if (!selectedBatch) return;
    setLoadingLectures(true);
    fetch(`/api/trainer-portal/assignments?batchId=${selectedBatch}`)
      .then(r => r.json())
      .then(d => setLectures(d.lectures || []))
      .catch(() => setLectures([]))
      .finally(() => setLoadingLectures(false));
  }, [selectedBatch]);

  useEffect(() => { loadLectures(); }, [loadLectures]);

  async function openStudents(lecture: LectureSummary) {
    setSelectedLecture(lecture);
    setLoadingStudents(true);
    setChanges({});
    setSaveMsg('');
    try {
      const res = await fetch(`/api/trainer-portal/assignments?takeId=${lecture.Take_Id}`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch { setStudents([]); }
    finally { setLoadingStudents(false); }
  }

  function toggleAssignment(studentId: number, current: number) {
    const newVal = current ? 0 : 1;
    setChanges(prev => ({ ...prev, [studentId]: newVal }));
    setStudents(prev => prev.map(s => s.Student_Id === studentId ? { ...s, AssignmentReceived: newVal } : s));
  }

  async function handleSave() {
    if (!selectedLecture || Object.keys(changes).length === 0) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updates = Object.entries(changes).map(([sid, val]) => ({
        student_id: Number(sid),
        assignment_received: val,
      }));
      const res = await fetch('/api/trainer-portal/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: selectedLecture.Take_Id, updates }),
      });
      if (res.ok) {
        setSaveMsg('Saved successfully!');
        setChanges({});
        loadLectures();
      } else {
        const d = await res.json();
        setSaveMsg(d.error || 'Save failed');
      }
    } catch { setSaveMsg('Network error'); }
    finally { setSaving(false); }
  }

  const receivedCount = students.filter(s => s.AssignmentReceived).length;
  const hasChanges = Object.keys(changes).length > 0;

  if (loadingBatches) {
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
          <h1 className="text-2xl font-bold text-gray-800">Student Assignments</h1>
          <p className="text-sm text-gray-500">Track and update assignment submissions per lecture</p>
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

      {/* Lectures grid */}
      {loadingLectures ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#2E3093' }} />
        </div>
      ) : lectures.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 font-medium">No lectures found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lectures.map(l => {
            const pct = l.total_students > 0 ? Math.round((l.assignments_received / l.total_students) * 100) : 0;
            return (
              <div
                key={l.Take_Id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openStudents(l)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white text-xs" style={{ background: '#2E3093' }}>
                    <span className="font-bold leading-none">{new Date(l.Take_Dt).getDate()}</span>
                    <span className="text-[10px] opacity-80">{new Date(l.Take_Dt).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                  {l.Assign_Given ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(250,228,82,0.2)', color: '#92700c' }}>Assignment</span>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-gray-800 truncate mb-1">{l.Topic || l.Lecture_Name || 'Untitled'}</p>
                <p className="text-xs text-gray-400 mb-3">{new Date(l.Take_Dt).toLocaleDateString()}</p>

                {/* Progress bar */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>{l.assignments_received}/{l.total_students} received</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : '#2A6BB5' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student assignment modal */}
      {selectedLecture && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLecture(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Assignment Tracking</h3>
                <p className="text-sm text-gray-500">
                  {selectedLecture.Topic || selectedLecture.Lecture_Name} &bull; {new Date(selectedLecture.Take_Dt).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelectedLecture(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-sm flex-shrink-0">
              <span className="text-gray-500">
                <span className="font-semibold text-gray-800">{receivedCount}</span> / {students.length} received
              </span>
              {hasChanges && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(250,228,82,0.3)', color: '#92700c' }}>
                  {Object.keys(changes).length} unsaved changes
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingStudents ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#2E3093' }} />
                </div>
              ) : students.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No students found</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {students.map(s => (
                    <div key={s.ID} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: s.Student_Atten ? 'rgba(42,107,181,0.1)' : 'rgba(220,38,38,0.1)',
                            color: s.Student_Atten ? '#2A6BB5' : '#dc2626',
                          }}
                        >
                          {s.Student_Name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.Student_Name}</p>
                          <p className="text-xs text-gray-400">ID: {s.Student_Id}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleAssignment(s.Student_Id, s.AssignmentReceived)}
                        className={`w-10 h-6 rounded-full transition-all relative ${
                          s.AssignmentReceived ? '' : 'bg-gray-200'
                        }`}
                        style={s.AssignmentReceived ? { background: '#2E3093' } : {}}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            s.AssignmentReceived ? 'left-4' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saveMsg && (
              <div className={`px-6 py-2 text-sm font-medium ${saveMsg.includes('success') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {saveMsg}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setSelectedLecture(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
                style={{ background: '#2E3093' }}
              >
                {saving ? 'Saving…' : `Save Changes${hasChanges ? ` (${Object.keys(changes).length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
