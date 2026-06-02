'use client';

import { useState, useEffect, useCallback } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';

/* ─── Types ───────────────────────────────────────────────────────── */
interface Course  { Course_Id: number; Course_Name: string }
interface Batch   { Batch_Id: number; Batch_code: string; Category: string; Timings: string }
interface Faculty { Faculty_Id: number; Faculty_Name: string }
interface Student {
  Admission_Id: number;
  Student_Id: number;
  Student_Code: string;
  studentName: string;
  rollNo: string;
  mobile: string;
}

type AttStatus = 'P' | 'A' | 'L' | '';
type StatusMap  = Record<number, AttStatus>;
type FeedbackEntry = { rating: number; comments: string | null };
type StudentFeedback = {
  firstHalf: FeedbackEntry | null;
  secondHalf: FeedbackEntry | null;
};
type FeedbackLink = {
  session: 'first_half' | 'second_half';
  token?: string;
  url: string;
  expiresAt?: string;
};

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

/* ─── Helpers ─────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function pct(present: number, total: number) {
  if (!total) return 0;
  return Math.round((present / total) * 100);
}

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFeedbackSession(session: FeedbackLink['session']) {
  return session === 'first_half' ? 'First Half' : 'Second Half';
}

function parseTimeParts(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return { hour: '', minute: '', period: 'AM' as 'AM' | 'PM' };
  }
  const [hourText, minute] = value.split(':');
  const hourNumber = Number(hourText);
  const period: 'AM' | 'PM' = hourNumber >= 12 ? 'PM' : 'AM';
  const hour12 = hourNumber % 12 || 12;
  return {
    hour: String(hour12).padStart(2, '0'),
    minute,
    period,
  };
}

function buildTimeValue(hour: string, minute: string, period: 'AM' | 'PM') {
  if (!hour || !minute) return '';
  let hourNumber = Number(hour) % 12;
  if (period === 'PM') hourNumber += 12;
  return `${String(hourNumber).padStart(2, '0')}:${minute}`;
}

function formatTime12Hour(value: string) {
  const parts = parseTimeParts(value);
  if (!parts.hour || !parts.minute) return value || '—';
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}

function TimePicker({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const parts = parseTimeParts(value);

  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="grid grid-cols-3 gap-2 min-w-[230px]">
        <select
          value={parts.hour}
          onChange={(e) => onChange(e.target.value ? buildTimeValue(e.target.value, parts.minute || '00', parts.period) : '')}
          className={className}
        >
          <option value="">Hour</option>
          {HOUR_OPTIONS.map((hour) => (
            <option key={hour} value={hour}>{hour}</option>
          ))}
        </select>
        <select
          value={parts.minute}
          onChange={(e) => onChange(parts.hour ? buildTimeValue(parts.hour, e.target.value, parts.period) : '')}
          className={className}
        >
          <option value="">Min</option>
          {MINUTE_OPTIONS.map((minute) => (
            <option key={minute} value={minute}>{minute}</option>
          ))}
        </select>
        <select
          value={parts.period}
          onChange={(e) => onChange(parts.hour ? buildTimeValue(parts.hour, parts.minute || '00', e.target.value as 'AM' | 'PM') : '')}
          className={className}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
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
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId]   = useState('');
  const [date, setDate]         = useState(todayStr());
  const [trainerId, setTrainerId] = useState('');
  const [trainerTimeFrom, setTrainerTimeFrom] = useState('');
  const [trainerTimeTo, setTrainerTimeTo] = useState('');

  /* data */
  const [students, setStudents]     = useState<Student[]>([]);
  const [statusMapFH, setStatusMapFH] = useState<StatusMap>({});
  const [statusMapSH, setStatusMapSH] = useState<StatusMap>({});
  const [search, setSearch]         = useState('');

  /* feedback column */
  const [feedbackMap, setFeedbackMap] = useState<Record<string, StudentFeedback>>({});

  /* ui */
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [error, setError]                     = useState('');
  const [loaded, setLoaded]                   = useState(false);
  const [feedbackLinks, setFeedbackLinks]     = useState<FeedbackLink[]>([]);
  const [copiedFeedbackUrl, setCopiedFeedbackUrl] = useState('');

  /* load courses */
  useEffect(() => {
    fetch('/api/daily-activities/attendance?options=courses')
      .then(r => r.json())
      .then(d => setCourses(d.courses ?? []));

    fetch('/api/daily-activities/attendance?options=faculties')
      .then(r => r.json())
      .then(d => setFaculties(d.faculties ?? []));
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
    setStatusMapFH({});
    setStatusMapSH({});
    setFeedbackMap({});
    setLoaded(false);
    setSaved(false);
    setError('');
    setFeedbackLinks([]);
    setCopiedFeedbackUrl('');
    setTrainerId('');
    setTrainerTimeFrom('');
    setTrainerTimeTo('');
  }, [batchId, date]);

  useEffect(() => {
    if (!batchId || !date) return;
    let cancelled = false;
    fetch(`/api/daily-activities/attendance/feedback-token?batchId=${encodeURIComponent(batchId)}&date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.links) && data.links.length) {
          setFeedbackLinks(data.links.map((link: FeedbackLink) => ({
            session: link.session,
            token: link.token,
            url: String(link.url),
            expiresAt: link.expiresAt ? String(link.expiresAt) : (data.expiresAt ? String(data.expiresAt) : ''),
          })));
          if (!trainerId && data.trainerId != null) setTrainerId(String(data.trainerId));
          if (!trainerTimeFrom && data.trainerTimeFrom) setTrainerTimeFrom(String(data.trainerTimeFrom).slice(0, 5));
          if (!trainerTimeTo && data.trainerTimeTo) setTrainerTimeTo(String(data.trainerTimeTo).slice(0, 5));
        } else {
          setFeedbackLinks([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFeedbackLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, date]);

  /* load both halves in parallel */
  const loadAttendance = useCallback(async () => {
    if (!batchId || !date) return;
    setLoadingStudents(true);
    setError('');
    setSaved(false);
    try {
      const base = `/api/daily-activities/attendance?batchId=${batchId}&date=${date}`;
      const [r1, r2] = await Promise.all([
        fetch(`${base}&session=first_half`),
        fetch(`${base}&session=second_half`),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (!r1.ok) throw new Error(d1.error || 'Failed to load first half');
      if (!r2.ok) throw new Error(d2.error || 'Failed to load second half');

      /* students list comes from first half (same roster for both) */
      const s: Student[] = (d1.students ?? []).map((st: any) => ({
        Admission_Id: st.Admission_Id,
        Student_Id:   st.Student_Id,
        Student_Code: st.Student_Code,
        studentName:  st.studentName,
        rollNo:       st.rollNo,
        mobile:       st.mobile,
      }));
      setStudents(s);

      const fh: StatusMap = {};
      const sh: StatusMap = {};
      for (const st of d1.students ?? []) fh[st.Student_Id] = st.attendanceStatus ?? '';
      for (const st of d2.students ?? []) sh[st.Student_Id] = st.attendanceStatus ?? '';
      setStatusMapFH(fh);
      setStatusMapSH(sh);
      setLoaded(true);

      /* Load feedback for this batch+date (non-critical) */
      fetch(`/api/daily-activities/attendance/feedback-reports?batchId=${batchId}&date=${date}`)
        .then(r => r.json())
        .then(d => { if (d.feedback) setFeedbackMap(d.feedback); })
        .catch(() => {/* non-critical */});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [batchId, date]);

  /* toggle one student for a specific half */
  const toggle = (studentId: number, status: AttStatus, half: 'FH' | 'SH') => {
    const setter = half === 'FH' ? setStatusMapFH : setStatusMapSH;
    setter(prev => ({ ...prev, [studentId]: prev[studentId] === status ? '' : status }));
    setSaved(false);
  };

  /* bulk actions (apply to both halves) */
  const markAll = (status: AttStatus) => {
    const fh: StatusMap = {};
    const sh: StatusMap = {};
    filtered.forEach(s => { fh[s.Student_Id] = status; sh[s.Student_Id] = status; });
    setStatusMapFH(prev => ({ ...prev, ...fh }));
    setStatusMapSH(prev => ({ ...prev, ...sh }));
    setSaved(false);
  };
  const clearAll = () => {
    const fh: StatusMap = {};
    const sh: StatusMap = {};
    filtered.forEach(s => { fh[s.Student_Id] = ''; sh[s.Student_Id] = ''; });
    setStatusMapFH(prev => ({ ...prev, ...fh }));
    setStatusMapSH(prev => ({ ...prev, ...sh }));
    setSaved(false);
  };

  /* save both halves */
  const save = async () => {
    const toRecords = (map: StatusMap) =>
      students
        .filter(s => map[s.Student_Id])
        .map(s => ({ studentId: s.Student_Id, admissionId: s.Admission_Id, status: map[s.Student_Id] as 'P' | 'A' | 'L' }));

    const fhRecords = toRecords(statusMapFH);
    const shRecords = toRecords(statusMapSH);

    if (!fhRecords.length && !shRecords.length) {
      setError('Please mark attendance for at least one student.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const posts = [];
      if (fhRecords.length) posts.push(
        fetch('/api/daily-activities/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: Number(batchId), date, session: 'first_half', records: fhRecords }),
        })
      );
      if (shRecords.length) posts.push(
        fetch('/api/daily-activities/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: Number(batchId), date, session: 'second_half', records: shRecords }),
        })
      );
      const results = await Promise.all(posts);
      for (const res of results) {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save');
        }
      }
      setSaved(true);
      // Generate a geo-locked feedback link for this batch+date
      try {
        const selectedBatchObj = batches.find(b => String(b.Batch_Id) === batchId);
        const selectedTrainer = faculties.find((f) => String(f.Faculty_Id) === trainerId);
        const fbRes = await fetch('/api/daily-activities/attendance/feedback-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: Number(batchId),
            date,
            batchName: selectedBatchObj?.Batch_code,
            trainerId: trainerId || null,
            trainerName: selectedTrainer?.Faculty_Name || null,
            trainerTimeFrom: trainerTimeFrom || null,
            trainerTimeTo: trainerTimeTo || null,
          }),
        });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          setFeedbackLinks(Array.isArray(fbData.links) ? fbData.links.map((link: FeedbackLink) => ({
            session: link.session,
            token: link.token,
            url: link.url,
            expiresAt: link.expiresAt || fbData.expiresAt || '',
          })) : []);
        }
      } catch { /* non-critical */ }
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
  const fhPresent  = students.filter(s => statusMapFH[s.Student_Id] === 'P').length;
  const fhAbsent   = students.filter(s => statusMapFH[s.Student_Id] === 'A').length;
  const fhLate     = students.filter(s => statusMapFH[s.Student_Id] === 'L').length;
  const shPresent  = students.filter(s => statusMapSH[s.Student_Id] === 'P').length;
  const shAbsent   = students.filter(s => statusMapSH[s.Student_Id] === 'A').length;
  const shLate     = students.filter(s => statusMapSH[s.Student_Id] === 'L').length;
  const fhUnmarked = students.length - fhPresent - fhAbsent - fhLate;
  const shUnmarked = students.length - shPresent - shAbsent - shLate;
  const fhPct      = pct(fhPresent, students.length);
  const shPct      = pct(shPresent, students.length);
  const selectedBatch = batches.find(b => String(b.Batch_Id) === batchId);

  const ctrlCls = 'border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]';

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

          <div className="flex items-center gap-2">
            {canCreate && loaded && students.length > 0 && (
              <button
                onClick={save}
                disabled={saving || (!students.some(s => statusMapFH[s.Student_Id]) && !students.some(s => statusMapSH[s.Student_Id]))}
                className="hidden sm:inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-white text-[#2E3093] hover:bg-white/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><div className="w-3.5 h-3.5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : saved ? (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Saved!</>
                ) : (
                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save Attendance</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

        {/* ── Toolbar ── */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-end gap-3 flex-wrap">
          {/* Course */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[180px]">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className={ctrlCls}>
              <option value="">— Select Course —</option>
              {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
            </select>
          </div>

          {/* Batch */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[200px]">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Batch</label>
            <select value={batchId} onChange={e => setBatchId(e.target.value)} disabled={!courseId} className={`${ctrlCls} disabled:opacity-50 disabled:cursor-not-allowed`}>
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
              type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr()}
              className={ctrlCls}
            />
          </div>

          <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[220px]">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Trainer</label>
            <select value={trainerId} onChange={e => setTrainerId(e.target.value)} className={ctrlCls}>
              <option value="">— Select Trainer —</option>
              {faculties.map((faculty) => (
                <option key={faculty.Faculty_Id} value={faculty.Faculty_Id}>{faculty.Faculty_Name}</option>
              ))}
            </select>
          </div>

          <TimePicker label="Trainer From" value={trainerTimeFrom} onChange={setTrainerTimeFrom} className={ctrlCls} />

          <TimePicker label="Trainer To" value={trainerTimeTo} onChange={setTrainerTimeTo} className={ctrlCls} />

          {/* Load button */}
          <button
            onClick={loadAttendance}
            disabled={!batchId || !date || loadingStudents}
            className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2E3093] text-white hover:bg-[#23257A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingStudents ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Loading…</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Load Students</>
            )}
          </button>
        </div>

        {/* ── Per-half stats (once loaded) ── */}
        {loaded && students.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 space-y-2">
            <p className="text-[11px] font-medium text-gray-600">
              {selectedBatch?.Batch_code}{selectedBatch?.Timings ? ` · ${selectedBatch.Timings}` : ''} —{' '}
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* First Half */}
              <div className="bg-blue-50/60 rounded-lg px-3 py-2 border border-blue-100">
                <p className="text-[10px] font-bold text-[#2E3093] uppercase tracking-wide mb-1.5">First Half</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />P: {fhPresent}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />A: {fhAbsent}
                  </span>
                  {fhLate > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />L: {fhLate}
                    </span>
                  )}
                  {fhUnmarked > 0 && (
                    <span className="text-[11px] text-gray-400">{fhUnmarked} unmarked</span>
                  )}
                  <span className="ml-auto text-[11px] font-bold text-[#2A6BB5]">{fhPct}%</span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fhPct}%`, background: fhPct >= 75 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : fhPct >= 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
                </div>
              </div>

              {/* Second Half */}
              <div className="bg-purple-50/60 rounded-lg px-3 py-2 border border-purple-100">
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-1.5">Second Half</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />P: {shPresent}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />A: {shAbsent}
                  </span>
                  {shLate > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />L: {shLate}
                    </span>
                  )}
                  {shUnmarked > 0 && (
                    <span className="text-[11px] text-gray-400">{shUnmarked} unmarked</span>
                  )}
                  <span className="ml-auto text-[11px] font-bold text-purple-600">{shPct}%</span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${shPct}%`, background: shPct >= 75 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : shPct >= 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Action toolbar ── */}
        {loaded && students.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, code or roll no…"
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400"
              />
              <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <span className="text-[11px] font-bold text-[#2E3093] bg-[#2E3093]/10 rounded-full px-2.5 py-0.5">
              Total: {students.length}
            </span>

            {canCreate && (
              <div className="flex items-center gap-1.5 sm:ml-auto w-full sm:w-auto flex-wrap">
                <span className="text-[10px] text-gray-400 hidden sm:inline">Mark both halves:</span>
                <button onClick={() => markAll('P')} className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>All Present
                </button>
                <button onClick={() => markAll('L')} className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>All Late
                </button>
                <button onClick={() => markAll('A')} className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>All Absent
                </button>
                <button onClick={clearAll} className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition">
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Error / Success ── */}
        {error && (
          <div className="mx-4 my-2 flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            {error}
            <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {(saved || feedbackLinks.length > 0) && (
          <div className="mx-4 my-2 space-y-2">
            {saved && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Attendance saved successfully.
              </div>
            )}
            {feedbackLinks.length > 0 && (
              <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700 mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                    Student Feedback Links <span className="font-normal normal-case text-blue-500">(valid 24h · present/late students only)</span>
                </p>
                  {(trainerId || trainerTimeFrom || trainerTimeTo) && (
                    <div className="mb-2 rounded-md border border-blue-200 bg-white px-2.5 py-2 text-[11px] text-blue-800">
                      {trainerId && <p>Trainer: <span className="font-semibold">{faculties.find((f) => String(f.Faculty_Id) === trainerId)?.Faculty_Name || '—'}</span></p>}
                      {(trainerTimeFrom || trainerTimeTo) && <p>Time Allotted: <span className="font-semibold">{formatTime12Hour(trainerTimeFrom)} - {formatTime12Hour(trainerTimeTo)}</span></p>}
                    </div>
                  )}
                <div className="space-y-3">
                  {feedbackLinks.map((link) => (
                    <div key={link.session} className="rounded-md border border-blue-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#2E3093]">{formatFeedbackSession(link.session)} Link</p>
                        {link.expiresAt && (
                          <span className="text-[11px] text-blue-700">Active until {formatExpiry(link.expiresAt)}</span>
                        )}
                      </div>
                      <div className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-800 break-all">
                        {link.url}
                      </div>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-blue-200 bg-white text-[#2E3093] rounded-md hover:bg-blue-100 transition-colors sm:flex-none"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H19m0 0v5.5M19 6l-7.5 7.5M17 13.5V17a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h3.5" />
                          </svg>
                          Open Link
                        </a>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(link.url);
                              setCopiedFeedbackUrl(link.url);
                              window.setTimeout(() => {
                                setCopiedFeedbackUrl((current) => (current === link.url ? '' : current));
                              }, 3000);
                            } catch {
                              setError('Failed to copy feedback link');
                            }
                          }}
                          className="flex-1 shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#2E3093] text-white rounded-md hover:bg-[#252780] transition-colors sm:flex-none"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {copiedFeedbackUrl === link.url ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      {copiedFeedbackUrl === link.url && (
                        <p className="mt-2 text-[11px] text-green-700">
                          Copied link: <span className="font-semibold break-all">{copiedFeedbackUrl}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Table ── */}
        <div className="overflow-x-auto flex-1">
          {!loaded ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-600 mb-1">
                {batchId ? 'Click "Load Students" to fetch the attendance sheet' : 'Select a course and batch to get started'}
              </p>
              <p className="text-xs text-gray-400">
                {batchId ? 'Both first half and second half will load together' : 'Use the filters above to pick a batch and date'}
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No students found for this batch</p>
            </div>
          ) : (
            <>
            {/* ── Mobile cards ── */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((student, idx) => {
                const fh = statusMapFH[student.Student_Id] ?? '';
                const sh = statusMapSH[student.Student_Id] ?? '';
                const fb = student.rollNo ? feedbackMap[student.rollNo] : undefined;
                const btnBase = (active: boolean, activeClr: string, inactiveClr: string) =>
                  `flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${active ? activeClr : inactiveClr}`;
                const ratingColors: Record<number, string> = {
                  5: 'bg-emerald-50 text-emerald-700',
                  4: 'bg-green-50 text-green-700',
                  3: 'bg-blue-50 text-blue-700',
                  2: 'bg-amber-50 text-amber-700',
                  1: 'bg-red-50 text-red-600',
                };
                const ratingLabels: Record<number, string> = {
                  5: 'Excellent',
                  4: 'Very Good',
                  3: 'Good',
                  2: 'Satisfactory',
                  1: 'Unsatisfactory',
                };
                return (
                  <div key={student.Student_Id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{student.studentName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Roll: {student.rollNo || '—'} · Code: {student.Student_Code || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Mobile: {student.mobile || '—'}</p>
                      </div>
                      <span className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold bg-[#2E3093]/8 text-[#2E3093] rounded-full shrink-0">{idx + 1}</span>
                    </div>
                    {canCreate ? (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-[#2E3093] uppercase">First Half</p>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggle(student.Student_Id, 'P', 'FH')} className={btnBase(fh==='P','bg-green-500 text-white shadow-sm shadow-green-200','bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700')}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>P
                          </button>
                          <button onClick={() => toggle(student.Student_Id, 'L', 'FH')} className={btnBase(fh==='L','bg-amber-500 text-white shadow-sm shadow-amber-200','bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700')}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>L
                          </button>
                          <button onClick={() => toggle(student.Student_Id, 'A', 'FH')} className={btnBase(fh==='A','bg-red-500 text-white shadow-sm shadow-red-200','bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600')}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>A
                          </button>
                        </div>
                        <p className="text-[10px] font-bold text-purple-600 uppercase">Second Half</p>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggle(student.Student_Id, 'P', 'SH')} className={btnBase(sh==='P','bg-green-500 text-white shadow-sm shadow-green-200','bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700')}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>P
                          </button>
                          <button onClick={() => toggle(student.Student_Id, 'L', 'SH')} className={btnBase(sh==='L','bg-amber-500 text-white shadow-sm shadow-amber-200','bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700')}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>L
                          </button>
                          <button onClick={() => toggle(student.Student_Id, 'A', 'SH')} className={btnBase(sh==='A','bg-red-500 text-white shadow-sm shadow-red-200','bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600')}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>A
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4 text-xs">
                        <span>1st: <span className={`font-bold ${fh==='P'?'text-green-600':fh==='A'?'text-red-500':fh==='L'?'text-amber-600':'text-gray-400'}`}>{fh||'—'}</span></span>
                        <span>2nd: <span className={`font-bold ${sh==='P'?'text-green-600':sh==='A'?'text-red-500':sh==='L'?'text-amber-600':'text-gray-400'}`}>{sh||'—'}</span></span>
                      </div>
                    )}

                    <div className="rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1.5">Feedback</p>
                      {fb ? (
                        <div className="space-y-2">
                          {([
                            { key: 'FH', label: 'First Half', value: fb.firstHalf },
                            { key: 'SH', label: 'Second Half', value: fb.secondHalf },
                          ] as const).map((part) => (
                            part.value ? (
                              <div key={part.key} className="space-y-0.5">
                                <p className="text-[10px] font-semibold text-gray-500">{part.label}</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${ratingColors[part.value.rating] ?? 'bg-gray-50 text-gray-600'}`}>
                                  {part.value.rating} — {ratingLabels[part.value.rating] ?? part.value.rating}
                                </span>
                                {part.value.comments && (
                                  <p className="text-[11px] text-gray-500 italic leading-relaxed">&ldquo;{part.value.comments}&rdquo;</p>
                                )}
                              </div>
                            ) : null
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No feedback submitted yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table ── */}
            <table className="dashboard-table hidden md:table w-full text-sm min-w-[820px]">
              <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100/80 z-10">
                <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4 border-b border-gray-200 w-14 text-center">Sr</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-20">Roll</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-28">Code</th>
                  <th className="py-3 px-4 border-b border-gray-200">Name</th>
                  <th className="py-3 px-4 border-b border-gray-200 w-32">Mobile</th>
                  <th className="py-3 px-4 border-b border-gray-200 text-center bg-blue-50/60 border-l border-blue-100">
                    <span className="text-[#2E3093]">1st Half</span>
                  </th>
                  <th className="py-3 px-4 border-b border-gray-200 text-center bg-purple-50/60 border-l border-purple-100">
                    <span className="text-purple-700">2nd Half</span>
                  </th>
                  <th className="py-3 px-4 border-b border-gray-200 text-center bg-amber-50/60 border-l border-amber-100">
                    <span className="text-amber-700">Feedback</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((student, idx) => {
                  const fh = statusMapFH[student.Student_Id] ?? '';
                  const sh = statusMapSH[student.Student_Id] ?? '';
                  return (
                    <tr
                      key={student.Student_Id}
                      className={`transition-colors ${
                        fh === 'P' && sh === 'P' ? 'bg-green-50/40 hover:bg-green-50/60' :
                        fh === 'A' || sh === 'A'  ? 'bg-red-50/30 hover:bg-red-50/50' :
                        'hover:bg-blue-50/20'
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold bg-[#2E3093]/8 text-[#2E3093] rounded-full">{idx + 1}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        {student.rollNo ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[#2E3093]/8 text-[#2E3093] rounded">{student.rollNo}</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-500">{student.Student_Code || <span className="text-gray-300">—</span>}</td>
                      <td className="py-2.5 px-4 font-semibold text-gray-800 text-sm">{student.studentName}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500 tabular-nums">{student.mobile || <span className="text-gray-300">—</span>}</td>

                      {/* First Half */}
                      <td className="py-2.5 px-3 bg-blue-50/30 border-l border-blue-100/60">
                        {canCreate ? (
                          <div className="flex items-center justify-center gap-1">
                            {(['P','L','A'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => toggle(student.Student_Id, s, 'FH')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                                  fh === s
                                    ? s === 'P' ? 'bg-green-500 text-white shadow-sm scale-105'
                                    : s === 'L' ? 'bg-amber-500 text-white shadow-sm scale-105'
                                    : 'bg-red-500 text-white shadow-sm scale-105'
                                    : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-gray-600'
                                }`}
                              >{s}</button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${fh==='P'?'bg-green-100 text-green-700':fh==='A'?'bg-red-100 text-red-600':fh==='L'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-400'}`}>
                              {fh||'—'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Second Half */}
                      <td className="py-2.5 px-3 bg-purple-50/30 border-l border-purple-100/60">
                        {canCreate ? (
                          <div className="flex items-center justify-center gap-1">
                            {(['P','L','A'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => toggle(student.Student_Id, s, 'SH')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                                  sh === s
                                    ? s === 'P' ? 'bg-green-500 text-white shadow-sm scale-105'
                                    : s === 'L' ? 'bg-amber-500 text-white shadow-sm scale-105'
                                    : 'bg-red-500 text-white shadow-sm scale-105'
                                    : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-gray-600'
                                }`}
                              >{s}</button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sh==='P'?'bg-green-100 text-green-700':sh==='A'?'bg-red-100 text-red-600':sh==='L'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-400'}`}>
                              {sh||'—'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Feedback */}
                      {(() => {
                        const fb = student.rollNo ? feedbackMap[student.rollNo] : undefined;
                        const RATING_COLORS: Record<number, string> = {
                          5: 'bg-emerald-50 text-emerald-700', 4: 'bg-green-50 text-green-700',
                          3: 'bg-blue-50 text-blue-700', 2: 'bg-amber-50 text-amber-700', 1: 'bg-red-50 text-red-600',
                        };
                        const RATING_LABELS: Record<number, string> = {
                          5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Satisfactory', 1: 'Unsatisfactory',
                        };
                        return (
                          <td className="py-2.5 px-3 bg-amber-50/20 border-l border-amber-100/60">
                            {fb ? (
                              <div className="flex flex-col items-start gap-1">
                                {([
                                  { key: 'FH', label: '1st', value: fb.firstHalf },
                                  { key: 'SH', label: '2nd', value: fb.secondHalf },
                                ] as const).map((part) => (
                                  part.value ? (
                                    <div key={part.key} className="flex flex-col items-start gap-0.5">
                                      <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{part.label} Half</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${RATING_COLORS[part.value.rating] ?? 'bg-gray-50 text-gray-600'}`}>
                                        {part.value.rating} — {RATING_LABELS[part.value.rating] ?? part.value.rating}
                                      </span>
                                      {part.value.comments && (
                                        <span className="text-[10px] text-gray-400 italic max-w-[120px] truncate" title={part.value.comments}>&ldquo;{part.value.comments}&rdquo;</span>
                                      )}
                                    </div>
                                  ) : null
                                ))}
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <span className="text-gray-300 text-xs">—</span>
                              </div>
                            )}
                          </td>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {loaded && students.length > 0 && (
          <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-1.5 px-4 py-3 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-xs text-gray-400">
                Showing {filtered.length} of {students.length} students{search ? ` matching "${search}"` : ''}
              </span>
              <span className="text-xs text-gray-400 hidden sm:inline">·</span>
              <span className="text-xs text-gray-400">
                {fhUnmarked > 0 || shUnmarked > 0 ? `FH: ${fhUnmarked} · SH: ${shUnmarked} not yet marked` : 'All students marked'}
              </span>
            </div>

            {canCreate && (
              <button
                onClick={save}
                disabled={saving || (!students.some(s => statusMapFH[s.Student_Id]) && !students.some(s => statusMapSH[s.Student_Id]))}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-[#2E3093] text-white hover:bg-[#252780] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : saved ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Saved!</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save Attendance</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
