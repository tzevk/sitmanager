'use client';

import { useState, useEffect, useCallback } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ─── Types ───────────────────────────────────────────────────────── */
interface Course  { Course_Id: number; Course_Name: string }
interface Batch   { Batch_Id: number; Batch_code: string; Category: string; Timings: string }
interface Student {
  Admission_Id: number;
  Student_Id: number;
  Student_Code: string;
  studentName: string;
  rollNo: string;
  mobile: string;
  attendanceStatus: 'P' | 'A' | '';
  Attendance_Id?: number;
}

type StatusMap = Record<number, 'P' | 'A' | ''>;

/* ─── Helpers ─────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function pct(present: number, total: number) {
  if (!total) return 0;
  return Math.round((present / total) * 100);
}

/* ─── Main page ───────────────────────────────────────────────────── */
export default function AttendancePage() {
  return (
    <PermissionGate resource="attendance" action="view">
      {(perms) => <AttendanceContent canCreate={perms.canCreate} />}
    </PermissionGate>
  );
}

function AttendanceContent({ canCreate }: { canCreate: boolean }) {
  /* selectors */
  const [courses, setCourses]   = useState<Course[]>([]);
  const [batches, setBatches]   = useState<Batch[]>([]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId]   = useState('');
  const [date, setDate]         = useState(todayStr());
  const [sessionHalf, setSessionHalf] = useState<'first_half' | 'second_half'>('first_half');

  /* data */
  const [students, setStudents]   = useState<Student[]>([]);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [search, setSearch]       = useState('');

  /* ui */
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [error, setError]                     = useState('');
  const [loaded, setLoaded]                   = useState(false);

  /* load courses */
  useEffect(() => {
    fetch('/api/daily-activities/attendance?options=courses')
      .then(r => r.json())
      .then(d => setCourses(d.courses ?? []));
  }, []);

  /* load batches when course changes */
  useEffect(() => {
    setBatchId('');
    setBatches([]);
    setStudents([]);
    setLoaded(false);
    if (!courseId) return;
    fetch(`/api/daily-activities/attendance?options=batches&courseId=${courseId}`)
      .then(r => r.json())
      .then(d => setBatches(d.batches ?? []));
  }, [courseId]);

  /* reset when batch/date changes */
  useEffect(() => {
    setStudents([]);
    setLoaded(false);
    setSaved(false);
    setError('');
  }, [batchId, date, sessionHalf]);

  /* load students */
  const loadAttendance = useCallback(async () => {
    if (!batchId || !date) return;
    setLoadingStudents(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/daily-activities/attendance?batchId=${batchId}&date=${date}&session=${sessionHalf}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const s: Student[] = data.students ?? [];
      setStudents(s);
      const map: StatusMap = {};
      s.forEach(st => { map[st.Student_Id] = st.attendanceStatus; });
      setStatusMap(map);
      setLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [batchId, date]);

  /* toggle one student */
  const toggle = (studentId: number, status: 'P' | 'A') => {
    setStatusMap(prev => ({ ...prev, [studentId]: prev[studentId] === status ? '' : status }));
    setSaved(false);
  };

  /* bulk actions */
  const markAll = (status: 'P' | 'A') => {
    const map: StatusMap = {};
    filtered.forEach(s => { map[s.Student_Id] = status; });
    setStatusMap(prev => ({ ...prev, ...map }));
    setSaved(false);
  };
  const clearAll = () => {
    const map: StatusMap = {};
    filtered.forEach(s => { map[s.Student_Id] = ''; });
    setStatusMap(prev => ({ ...prev, ...map }));
    setSaved(false);
  };

  /* save */
  const save = async () => {
    const records = students
      .filter(s => statusMap[s.Student_Id])
      .map(s => ({ studentId: s.Student_Id, admissionId: s.Admission_Id, status: statusMap[s.Student_Id] as 'P' | 'A' }));

    if (!records.length) {
      setError('Please mark attendance for at least one student.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/daily-activities/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: Number(batchId), date, session: sessionHalf, records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  /* derived */
  const filtered = students.filter(s =>
    !search ||
    s.studentName.toLowerCase().includes(search.toLowerCase()) ||
    String(s.Student_Code).includes(search) ||
    String(s.rollNo).includes(search)
  );
  const present    = students.filter(s => statusMap[s.Student_Id] === 'P').length;
  const absent     = students.filter(s => statusMap[s.Student_Id] === 'A').length;
  const unmarked   = students.length - present - absent;
  const percentage = pct(present, students.length);
  const selectedBatch = batches.find(b => String(b.Batch_Id) === batchId);

  return (
    <div className="space-y-6">

      {/* ── Gradient Header ── */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/15">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Attendance</h1>
              <p className="text-xs text-white/70">Daily Activities / Attendance</p>
            </div>
          </div>

          {/* Save button in header */}
          {canCreate && loaded && students.length > 0 && (
            <button
              onClick={save}
              disabled={saving || students.filter(s => statusMap[s.Student_Id]).length === 0}
              className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-white text-[#2E3093] hover:bg-white/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Attendance
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Main Card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

        {/* ── Toolbar: selectors ── */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-end gap-3 flex-wrap">
          {/* Course */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[180px]">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Course</label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
            >
              <option value="">— Select Course —</option>
              {courses.map(c => (
                <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
              ))}
            </select>
          </div>

          {/* Batch */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[200px]">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Batch</label>
            <select
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              disabled={!courseId}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">— Select Batch —</option>
              {batches.map(b => (
                <option key={b.Batch_Id} value={b.Batch_Id}>
                  {b.Batch_code}{b.Timings ? ` (${b.Timings})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={todayStr()}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
            />
          </div>

          {/* Session toggle */}
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Session</label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSessionHalf('first_half')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  sessionHalf === 'first_half'
                    ? 'bg-[#2E3093] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                First Half
              </button>
              <button
                type="button"
                onClick={() => setSessionHalf('second_half')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  sessionHalf === 'second_half'
                    ? 'bg-[#2E3093] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Second Half
              </button>
            </div>
          </div>

          {/* Load button */}
          <button
            onClick={loadAttendance}
            disabled={!batchId || !date || loadingStudents}
            className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingStudents ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Load Students
              </>
            )}
          </button>

          {/* Stats badges (once loaded) */}
          {loaded && students.length > 0 && (
            <div className="flex items-center gap-2 sm:ml-auto flex-wrap w-full sm:w-auto">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-100">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                P: {present}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                A: {absent}
              </span>
              {unmarked > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Unmarked: {unmarked}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-[#2A6BB5] border border-blue-100">
                {percentage}% attendance
              </span>
            </div>
          )}
        </div>

        {/* ── Progress bar (loaded state) ── */}
        {loaded && students.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-gray-500 mb-1.5">
              <span className="font-medium text-gray-700">
                {selectedBatch?.Batch_code}
                {selectedBatch?.Timings ? ` · ${selectedBatch.Timings}` : ''} —{' '}
                {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {` · ${sessionHalf === 'first_half' ? 'First Half' : 'Second Half'}`}
              </span>
              <span>{present} / {students.length} present</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  background: percentage >= 75
                    ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                    : percentage >= 50
                    ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                    : 'linear-gradient(90deg,#ef4444,#dc2626)',
                }}
              />
            </div>
          </div>
        )}

        {/* ── Action toolbar: search + bulk ── */}
        {loaded && students.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, code or roll no…"
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Total records */}
            <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2.5 py-0.5">
              Total: {students.length}
            </span>

            {/* Bulk action buttons */}
            {canCreate && (
              <div className="flex items-center gap-1.5 sm:ml-auto w-full sm:w-auto flex-wrap">
                <button
                  onClick={() => markAll('P')}
                  className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  All Present
                </button>
                <button
                  onClick={() => markAll('A')}
                  className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  All Absent
                </button>
                <button
                  onClick={clearAll}
                  className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Error / Success banners ── */}
        {error && (
          <div className="mx-4 my-2 flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {error}
            <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {saved && (
          <div className="mx-4 my-2 flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Attendance saved successfully for {students.filter(s => statusMap[s.Student_Id]).length} students.
          </div>
        )}

        {/* ── Table ── */}
        <div className="overflow-x-auto flex-1">
          {!loaded ? (
            /* Empty / prompt state */
            <div className="py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">
                {batchId ? 'Click "Load Students" to fetch the attendance sheet' : 'Select a course and batch to get started'}
              </p>
              <p className="text-xs text-gray-400">
                {batchId ? 'Students for the selected batch and date will appear here' : 'Use the filters above to pick a batch and date'}
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No students found for this batch</p>
            </div>
          ) : (
            <>
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((student, idx) => {
                const status = statusMap[student.Student_Id] ?? '';
                return (
                  <div key={student.Student_Id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{student.studentName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Roll: {student.rollNo || '—'} · Code: {student.Student_Code || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Mobile: {student.mobile || '—'}</p>
                      </div>
                      <span className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold bg-[#2E3093]/8 text-[#2E3093] rounded-full shrink-0">
                        {idx + 1}
                      </span>
                    </div>

                    {canCreate ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggle(student.Student_Id, 'P')}
                          title="Mark Present"
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                            status === 'P'
                              ? 'bg-green-500 text-white shadow-sm shadow-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Present
                        </button>
                        <button
                          onClick={() => toggle(student.Student_Id, 'A')}
                          title="Mark Absent"
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                            status === 'A'
                              ? 'bg-red-500 text-white shadow-sm shadow-red-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Absent
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          status === 'P' ? 'bg-green-100 text-green-700' :
                          status === 'A' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {status === 'P' ? 'Present' : status === 'A' ? 'Absent' : '—'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <table className="dashboard-table hidden md:table w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100/80 z-10">
                <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4 border-b border-gray-200 w-14 text-center">Sr No</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-24">Roll No</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-28">Code</th>
                  <th className="py-3 px-4 border-b border-gray-200">Student Name</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-36">Mobile</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-36 text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((student, idx) => {
                  const status = statusMap[student.Student_Id] ?? '';
                  return (
                    <tr
                      key={student.Student_Id}
                      className={`transition-colors ${
                        status === 'P'
                          ? 'bg-green-50/60 hover:bg-green-50'
                          : status === 'A'
                          ? 'bg-red-50/50 hover:bg-red-50'
                          : 'hover:bg-blue-50/30'
                      }`}
                    >
                      {/* Sr No */}
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold bg-[#2E3093]/8 text-[#2E3093] rounded-full">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Roll No */}
                      <td className="py-2.5 px-4">
                        {student.rollNo ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[#2E3093]/8 text-[#2E3093] rounded">
                            {student.rollNo}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Student Code */}
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-500">
                        {student.Student_Code || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Name */}
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-gray-800 text-sm">{student.studentName}</span>
                      </td>

                      {/* Mobile */}
                      <td className="py-2.5 px-4 text-xs text-gray-500 tabular-nums">
                        {student.mobile || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Attendance toggle */}
                      <td className="py-2.5 px-4">
                        {canCreate ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => toggle(student.Student_Id, 'P')}
                              title="Mark Present"
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                                status === 'P'
                                  ? 'bg-green-500 text-white shadow-sm shadow-green-200 scale-105'
                                  : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              P
                            </button>
                            <button
                              onClick={() => toggle(student.Student_Id, 'A')}
                              title="Mark Absent"
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                                status === 'A'
                                  ? 'bg-red-500 text-white shadow-sm shadow-red-200 scale-105'
                                  : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              A
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              status === 'P' ? 'bg-green-100 text-green-700' :
                              status === 'A' ? 'bg-red-100 text-red-600' :
                              'bg-gray-100 text-gray-400'
                            }`}>
                              {status === 'P' ? 'Present' : status === 'A' ? 'Absent' : '—'}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </>
          )}
        </div>

        {/* ── Table Footer ── */}
        {loaded && students.length > 0 && (
          <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Showing {filtered.length} of {students.length} students
              {search ? ` matching "${search}"` : ''}
            </span>
            <span className="text-xs text-gray-400">
              {unmarked > 0 ? `${unmarked} not yet marked` : 'All students marked'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
