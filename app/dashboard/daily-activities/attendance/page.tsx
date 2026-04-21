'use client';

import { useState, useEffect, useCallback } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ─── Types ───────────────────────────────────────────────────────── */
interface Course  { Course_Id: number; Course_Name: string }
interface Batch   { Batch_Id: number; Batch_code: string; Category: string; Timings: string }
interface Student {
  Admission_Id: number;
  Student_Id: number;
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

/* ─── Icon components ─────────────────────────────────────────────── */
function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}
function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function UserIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
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
  }, [batchId, date]);

  /* load students */
  const loadAttendance = useCallback(async () => {
    if (!batchId || !date) return;
    setLoadingStudents(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(
        `/api/daily-activities/attendance?batchId=${batchId}&date=${date}`
      );
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
  const markAll  = (status: 'P' | 'A') => {
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
        body: JSON.stringify({ batchId: Number(batchId), date, records }),
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
    !search || s.studentName.toLowerCase().includes(search.toLowerCase()) || s.rollNo.includes(search)
  );
  const present   = students.filter(s => statusMap[s.Student_Id] === 'P').length;
  const absent    = students.filter(s => statusMap[s.Student_Id] === 'A').length;
  const unmarked  = students.length - present - absent;
  const percentage = pct(present, students.length);

  const selectedBatch = batches.find(b => String(b.Batch_Id) === batchId);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-md">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
          <p className="text-xs text-gray-400">Daily Activities &rsaquo; Attendance</p>
        </div>
      </div>

      {/* ── Selector card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
          Select Batch &amp; Date
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Course */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Course</label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/40 focus:border-[#2A6BB5] transition"
            >
              <option value="">— Select Course —</option>
              {courses.map(c => (
                <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
              ))}
            </select>
          </div>

          {/* Batch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Batch</label>
            <select
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              disabled={!courseId}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/40 focus:border-[#2A6BB5] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={todayStr()}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/40 focus:border-[#2A6BB5] transition"
            />
          </div>

          {/* Load */}
          <div className="flex flex-col justify-end">
            <button
              onClick={loadAttendance}
              disabled={!batchId || !date || loadingStudents}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold rounded-lg shadow hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingStudents ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Load Students
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <XIcon className="w-4 h-4 shrink-0" />
          {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* ── Success banner ── */}
      {saved && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckIcon className="w-4 h-4 shrink-0 text-green-500" />
          Attendance saved successfully for {students.filter(s => statusMap[s.Student_Id]).length} students.
        </div>
      )}

      {/* ── Attendance panel (only when loaded) ── */}
      {loaded && students.length > 0 && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Present */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <CheckIcon className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 leading-none">{present}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Present</p>
              </div>
            </div>
            {/* Absent */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <XIcon className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500 leading-none">{absent}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Absent</p>
              </div>
            </div>
            {/* Unmarked */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500 leading-none">{unmarked}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Not Marked</p>
              </div>
            </div>
            {/* Percentage */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <UserIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2A6BB5] leading-none">{percentage}%</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Attendance</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span className="font-semibold text-gray-700">
                {selectedBatch?.Batch_code}
                {selectedBatch?.Timings ? ` · ${selectedBatch.Timings}` : ''} —{' '}
                {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span>{present} / {students.length} present</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  background: percentage >= 75
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : percentage >= 50
                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                    : 'linear-gradient(90deg, #ef4444, #dc2626)',
                }}
              />
            </div>
          </div>

          {/* Action bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search student or roll no…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/40 focus:border-[#2A6BB5] transition"
              />
            </div>

            {/* Bulk buttons */}
            {canCreate && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => markAll('P')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition"
                >
                  <CheckIcon className="w-3.5 h-3.5" /> All Present
                </button>
                <button
                  onClick={() => markAll('A')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition"
                >
                  <XIcon className="w-3.5 h-3.5" /> All Absent
                </button>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* ── Student list ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_5rem_1fr_auto_auto] gap-x-3 px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-[11px] font-bold uppercase tracking-wider">
              <span>#</span>
              <span className="hidden sm:block">Roll No</span>
              <span>Student</span>
              <span className="hidden sm:block text-right">Mobile</span>
              <span className="text-right">Status</span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <UserIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No students found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((student, idx) => {
                  const status = statusMap[student.Student_Id] ?? '';
                  return (
                    <div
                      key={student.Student_Id}
                      className={`grid grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_5rem_1fr_auto_auto] gap-x-3 items-center px-5 py-3 transition-colors ${
                        status === 'P'
                          ? 'bg-green-50/60'
                          : status === 'A'
                          ? 'bg-red-50/50'
                          : 'hover:bg-gray-50/70'
                      }`}
                    >
                      {/* Index */}
                      <span className="text-xs text-gray-400 font-medium tabular-nums">{idx + 1}</span>

                      {/* Roll No */}
                      <span className="hidden sm:block text-xs font-mono text-gray-500">
                        {student.rollNo || <span className="text-gray-300">—</span>}
                      </span>

                      {/* Name */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{student.studentName}</p>
                        <p className="text-[11px] text-gray-400 sm:hidden">{student.rollNo || '—'}</p>
                      </div>

                      {/* Mobile */}
                      <span className="hidden sm:block text-xs text-gray-400 tabular-nums">
                        {student.mobile || '—'}
                      </span>

                      {/* Toggle buttons */}
                      {canCreate ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggle(student.Student_Id, 'P')}
                            title="Mark Present"
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                              status === 'P'
                                ? 'bg-green-500 text-white shadow-sm shadow-green-200 scale-105'
                                : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                          >
                            <CheckIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">P</span>
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
                            <XIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">A</span>
                          </button>
                        </div>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          status === 'P' ? 'bg-green-100 text-green-700' :
                          status === 'A' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {status === 'P' ? 'Present' : status === 'A' ? 'Absent' : '—'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing {filtered.length} of {students.length} students
                {search ? ` matching "${search}"` : ''}
              </span>
              <span>{unmarked > 0 ? `${unmarked} not yet marked` : 'All students marked'}</span>
            </div>
          </div>

          {/* ── Save button ── */}
          {canCreate && (
            <div className="flex items-center justify-between gap-4 pb-4">
              <p className="text-xs text-gray-400">
                {unmarked > 0
                  ? `${unmarked} student${unmarked > 1 ? 's' : ''} not marked — they will not be saved.`
                  : 'All students marked. Ready to save.'}
              </p>
              <button
                onClick={save}
                disabled={saving || students.filter(s => statusMap[s.Student_Id]).length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : saved ? (
                  <>
                    <CheckIcon className="w-4 h-4" /> Saved!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Attendance
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty state when batch selected but nothing loaded */}
      {!loaded && !loadingStudents && batchId && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#2A6BB5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Ready to load</p>
          <p className="text-xs text-gray-400">Click &ldquo;Load Students&rdquo; to fetch the attendance sheet</p>
        </div>
      )}

      {/* Empty state when no batch selected */}
      {!batchId && !loadingStudents && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500 mb-1">No batch selected</p>
          <p className="text-xs text-gray-400">Select a course and batch above to get started</p>
        </div>
      )}
    </div>
  );
}
