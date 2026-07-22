'use client';

import { useState, useEffect, useCallback } from 'react';
import { PermissionGate } from '@/components/ui/PermissionGate';
import { StudentTransferBadge } from '@/components/ui/StudentTransferBadge';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
  Cancel?: number | null;
  Transfered?: string | null;
  Moved_To_Batch_Code?: string | null;
  Moved_From_Batch_Code?: string | null;
  movedToCourseName?: string | null;
}

interface AttendanceStudentRow {
  Admission_Id: number;
  Student_Id: number;
  Student_Code: string;
  studentName: string;
  rollNo: string;
  mobile: string;
  attendanceStatus?: AttStatus;
  In_Time?: string | null;
  Out_Time?: string | null;
  Remarks?: string | null;
  Cancel?: number | null;
  Transfered?: string | null;
  Moved_To_Batch_Code?: string | null;
  Moved_From_Batch_Code?: string | null;
  movedToCourseName?: string | null;
}

type AttStatus = 'P' | 'A' | 'L' | '';
type StatusMap  = Record<number, AttStatus>;
type AttMeta    = { inTime?: string; outTime?: string; remarks?: string };
type MetaMap    = Record<number, AttMeta>;
type FacescanPunch = { studentId: number; inTime: string; outTime: string };
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

function formatTime12Hour(value: string) {
  const parts = parseTimeParts(value);
  if (!parts.hour || !parts.minute) return value || '—';
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}

/**
 * Decides Present vs Late from a facescan punch time, against the lecture's
 * scheduled start (from Lecture Taken) when known, else a fixed fallback
 * hour (9 for first half, 14 for second half) — with a 10-minute grace
 * period before something counts as late.
 */
function computeLateFromPunch(inTime: string, scheduledStart: string | null, fallbackHour: number, graceMinutes = 10): { status: 'P' | 'L'; remarks?: string } {
  const [ih, im] = inTime.split(':').map(Number);
  if (!Number.isFinite(ih) || !Number.isFinite(im)) return { status: 'P' };
  const inMinutes = ih * 60 + im;

  let startMinutes: number;
  if (scheduledStart && /^\d{2}:\d{2}/.test(scheduledStart)) {
    const [sh, sm] = scheduledStart.split(':').map(Number);
    startMinutes = sh * 60 + sm;
  } else {
    startMinutes = fallbackHour * 60;
  }

  const lateBy = inMinutes - startMinutes - graceMinutes;
  return lateBy > 0
    ? { status: 'L', remarks: `Late by ${lateBy} min (facescan)` }
    : { status: 'P' };
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read image blob'));
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  } catch {
    return null;
  }
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

  /* Trainer + time are read-only here — sourced from Lecture Taken, per half */
  const [lectureFH, setLectureFH] = useState<{ trainerName: string | null; timeFrom: string | null; timeTo: string | null }>({ trainerName: null, timeFrom: null, timeTo: null });
  const [lectureSH, setLectureSH] = useState<{ trainerName: string | null; timeFrom: string | null; timeTo: string | null }>({ trainerName: null, timeFrom: null, timeTo: null });

  /* data */
  const [students, setStudents]     = useState<Student[]>([]);
  const [statusMapFH, setStatusMapFH] = useState<StatusMap>({});
  const [statusMapSH, setStatusMapSH] = useState<StatusMap>({});
  const [metaMapFH, setMetaMapFH]   = useState<MetaMap>({});
  const [metaMapSH, setMetaMapSH]   = useState<MetaMap>({});
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

  /* per-row auto-save */
  const [savingSet, setSavingSet]   = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors]   = useState<Record<string, string>>({});

  /* facescan panel */
  const [facescanOpen, setFacescanOpen]           = useState(false);
  const [facescanLoading, setFacescanLoading]     = useState(false);
  const [facescanConfigured, setFacescanConfigured] = useState<boolean | null>(null);
  const [facescanError, setFacescanError]         = useState('');
  const [facescanFhPunches, setFacescanFhPunches] = useState<FacescanPunch[]>([]);
  const [facescanShPunches, setFacescanShPunches] = useState<FacescanPunch[]>([]);
  const facescanFhIds = new Set(facescanFhPunches.map(p => p.studentId));
  const facescanShIds = new Set(facescanShPunches.map(p => p.studentId));
  const [facescanManual, setFacescanManual]       = useState('');
  const [facescanApplyTo, setFacescanApplyTo]     = useState<'both' | 'first_half' | 'second_half'>('both');

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
    setStatusMapFH({});
    setStatusMapSH({});
    setMetaMapFH({});
    setMetaMapSH({});
    setFeedbackMap({});
    setLoaded(false);
    setSaved(false);
    setError('');
    setFeedbackLinks([]);
    setCopiedFeedbackUrl('');
    setLectureFH({ trainerName: null, timeFrom: null, timeTo: null });
    setLectureSH({ trainerName: null, timeFrom: null, timeTo: null });
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
      const s: Student[] = (d1.students ?? []).map((st: AttendanceStudentRow) => ({
        Admission_Id: st.Admission_Id,
        Student_Id:   st.Student_Id,
        Student_Code: st.Student_Code,
        studentName:  st.studentName,
        rollNo:       st.rollNo,
        mobile:       st.mobile,
        Cancel:       st.Cancel,
        Transfered:   st.Transfered,
        Moved_To_Batch_Code: st.Moved_To_Batch_Code,
        Moved_From_Batch_Code: st.Moved_From_Batch_Code,
        movedToCourseName:   st.movedToCourseName,
      }));
      setStudents(s);

      const fh: StatusMap = {};
      const sh: StatusMap = {};
      for (const st of d1.students ?? []) fh[st.Student_Id] = st.attendanceStatus ?? '';
      for (const st of d2.students ?? []) sh[st.Student_Id] = st.attendanceStatus ?? '';
      setStatusMapFH(fh);
      setStatusMapSH(sh);

      const fhMeta: MetaMap = {};
      const shMeta: MetaMap = {};
      for (const st of (d1.students ?? []) as AttendanceStudentRow[]) {
        fhMeta[st.Student_Id] = { inTime: st.In_Time ?? undefined, outTime: st.Out_Time ?? undefined, remarks: st.Remarks ?? undefined };
      }
      for (const st of (d2.students ?? []) as AttendanceStudentRow[]) {
        shMeta[st.Student_Id] = { inTime: st.In_Time ?? undefined, outTime: st.Out_Time ?? undefined, remarks: st.Remarks ?? undefined };
      }
      setMetaMapFH(fhMeta);
      setMetaMapSH(shMeta);
      setLectureFH({
        trainerName: d1.trainerName ?? null,
        timeFrom: d1.trainerTimeFrom ? String(d1.trainerTimeFrom).slice(0, 5) : null,
        timeTo: d1.trainerTimeTo ? String(d1.trainerTimeTo).slice(0, 5) : null,
      });
      setLectureSH({
        trainerName: d2.trainerName ?? null,
        timeFrom: d2.trainerTimeFrom ? String(d2.trainerTimeFrom).slice(0, 5) : null,
        timeTo: d2.trainerTimeTo ? String(d2.trainerTimeTo).slice(0, 5) : null,
      });
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

  /* per-row click → immediate save */
  const handleStatusClick = async (student: Student, status: AttStatus, half: 'FH' | 'SH') => {
    const currentMap = half === 'FH' ? statusMapFH : statusMapSH;
    const current    = currentMap[student.Student_Id] ?? '';
    if (current === status) return; // clicking same status is a no-op

    const key     = `${student.Student_Id}-${half}`;
    const session = half === 'FH' ? 'first_half' : 'second_half';

    // Optimistic update
    const setter = half === 'FH' ? setStatusMapFH : setStatusMapSH;
    setter(prev => ({ ...prev, [student.Student_Id]: status }));
    setSavingSet(prev => new Set([...prev, key]));
    setRowErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

    try {
      const res = await fetch('/api/daily-activities/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: Number(batchId),
          date,
          session,
          records: [{ studentId: student.Student_Id, admissionId: student.Admission_Id, status }],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Save failed');
      }
    } catch (e: unknown) {
      // Revert
      setter(prev => ({ ...prev, [student.Student_Id]: current }));
      setRowErrors(prev => ({ ...prev, [key]: e instanceof Error ? e.message : 'Save failed' }));
    } finally {
      setSavingSet(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  /* save both halves — accepts optional pre-computed maps (used by facescan apply-and-save) */
  const save = async (fhOverride?: StatusMap, shOverride?: StatusMap, fhMetaOverride?: MetaMap, shMetaOverride?: MetaMap) => {
    const toRecords = (map: StatusMap, meta: MetaMap) =>
      students
        .filter(s => map[s.Student_Id])
        .map(s => ({
          studentId: s.Student_Id, admissionId: s.Admission_Id, status: map[s.Student_Id] as 'P' | 'A' | 'L',
          In_Time: meta[s.Student_Id]?.inTime, Out_Time: meta[s.Student_Id]?.outTime, Remarks: meta[s.Student_Id]?.remarks,
        }));

    const fhRecords = toRecords(fhOverride ?? statusMapFH, fhMetaOverride ?? metaMapFH);
    const shRecords = toRecords(shOverride ?? statusMapSH, shMetaOverride ?? metaMapSH);

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
          body: JSON.stringify({
            batchId: Number(batchId),
            date,
            session: 'first_half',
            records: fhRecords,
          }),
        })
      );
      if (shRecords.length) posts.push(
        fetch('/api/daily-activities/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: Number(batchId),
            date,
            session: 'second_half',
            records: shRecords,
          }),
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
      // Generate a geo-locked feedback link for this batch+date — trainer info
      // (if any) comes from whichever half Lecture Taken has recorded.
      try {
        const selectedBatchObj = batches.find(b => String(b.Batch_Id) === batchId);
        const lectureForFeedback = lectureFH.trainerName ? lectureFH : lectureSH;
        const fbRes = await fetch('/api/daily-activities/attendance/feedback-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: Number(batchId),
            date,
            batchName: selectedBatchObj?.Batch_code,
            trainerName: lectureForFeedback.trainerName || null,
            trainerTimeFrom: lectureForFeedback.timeFrom || null,
            trainerTimeTo: lectureForFeedback.timeTo || null,
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

  /* ── Facescan panel handlers ── */
  const openFacescan = async () => {
    setFacescanOpen(true);
    setFacescanError('');
    setFacescanFhPunches([]);
    setFacescanShPunches([]);
    if (!batchId || !date) return;
    setFacescanLoading(true);
    try {
      const res = await fetch(
        `/api/daily-activities/attendance/facescan-sync?batchId=${encodeURIComponent(batchId)}&date=${encodeURIComponent(date)}`
      );
      const data = await res.json();
      if (!data.configured) {
        setFacescanConfigured(false);
      } else if (data.error) {
        setFacescanConfigured(true);
        setFacescanError(data.error);
      } else {
        setFacescanConfigured(true);
        setFacescanFhPunches((data.firstHalf ?? []) as FacescanPunch[]);
        setFacescanShPunches((data.secondHalf ?? []) as FacescanPunch[]);
      }
    } catch {
      setFacescanConfigured(null);
      setFacescanError('Could not reach the facescan sync service.');
    } finally {
      setFacescanLoading(false);
    }
  };

  /**
   * Builds status + meta updates from facescan punches for one half: Present
   * or Late (vs the lecture's scheduled start, or a 9am/2pm fallback) with an
   * auto remark, plus the in/out time from the device.
   */
  const buildFacescanUpdates = (punches: FacescanPunch[], scheduledStart: string | null, fallbackHour: number) => {
    const statusUpdates: StatusMap = {};
    const metaUpdates: MetaMap = {};
    for (const p of punches) {
      const { status, remarks } = computeLateFromPunch(p.inTime, scheduledStart, fallbackHour);
      statusUpdates[p.studentId] = status;
      metaUpdates[p.studentId] = { inTime: p.inTime, outTime: p.outTime, remarks };
    }
    return { statusUpdates, metaUpdates };
  };

  const applyFacescan = () => {
    // Parse manual entries — support Student_Id (number) or Roll Number (string)
    const lines = facescanManual.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const manualIds = new Set<number>();
    for (const line of lines) {
      const byId = students.find(s => String(s.Student_Id) === line);
      if (byId) { manualIds.add(byId.Student_Id); continue; }
      const byRoll = students.find(s => s.rollNo && s.rollNo.toLowerCase() === line.toLowerCase());
      if (byRoll) manualIds.add(byRoll.Student_Id);
    }

    const applyFH = facescanApplyTo === 'both' || facescanApplyTo === 'first_half';
    const applySH = facescanApplyTo === 'both' || facescanApplyTo === 'second_half';

    if (applyFH) {
      const { statusUpdates, metaUpdates } = buildFacescanUpdates(facescanFhPunches, lectureFH.timeFrom, 9);
      for (const id of manualIds) if (!(id in statusUpdates)) statusUpdates[id] = 'P';
      setStatusMapFH(prev => ({ ...prev, ...statusUpdates }));
      setMetaMapFH(prev => ({ ...prev, ...metaUpdates }));
    }
    if (applySH) {
      const { statusUpdates, metaUpdates } = buildFacescanUpdates(facescanShPunches, lectureSH.timeFrom, 14);
      for (const id of manualIds) if (!(id in statusUpdates)) statusUpdates[id] = 'P';
      setStatusMapSH(prev => ({ ...prev, ...statusUpdates }));
      setMetaMapSH(prev => ({ ...prev, ...metaUpdates }));
    }

    setSaved(false);
    setFacescanOpen(false);
    setFacescanManual('');
  };

  const applyAndSave = async () => {
    // Build merged maps locally — can't wait for async React state update
    const mergedFH = { ...statusMapFH };
    const mergedSH = { ...statusMapSH };
    const mergedMetaFH = { ...metaMapFH };
    const mergedMetaSH = { ...metaMapSH };

    const applyFH = facescanApplyTo !== 'second_half';
    const applySH = facescanApplyTo !== 'first_half';

    if (applyFH) {
      const { statusUpdates, metaUpdates } = buildFacescanUpdates(facescanFhPunches, lectureFH.timeFrom, 9);
      Object.assign(mergedFH, statusUpdates);
      Object.assign(mergedMetaFH, metaUpdates);
    }
    if (applySH) {
      const { statusUpdates, metaUpdates } = buildFacescanUpdates(facescanShPunches, lectureSH.timeFrom, 14);
      Object.assign(mergedSH, statusUpdates);
      Object.assign(mergedMetaSH, metaUpdates);
    }

    const lines = facescanManual.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      const student =
        students.find(s => String(s.Student_Id) === line) ??
        students.find(s => s.rollNo && s.rollNo.toLowerCase() === line.toLowerCase());
      if (!student) continue;
      if (applyFH && !mergedFH[student.Student_Id]) mergedFH[student.Student_Id] = 'P';
      if (applySH && !mergedSH[student.Student_Id]) mergedSH[student.Student_Id] = 'P';
    }

    setStatusMapFH(mergedFH);
    setStatusMapSH(mergedSH);
    setMetaMapFH(mergedMetaFH);
    setMetaMapSH(mergedMetaSH);
    setFacescanOpen(false);
    setFacescanManual('');
    setFacescanFhPunches([]);
    setFacescanShPunches([]);

    await save(mergedFH, mergedSH, mergedMetaFH, mergedMetaSH);
  };

  const exportExcel = useCallback(async () => {
    if (!students.length) return;

    let exportFeedbackMap: Record<string, StudentFeedback> = feedbackMap;
    if (!Object.keys(exportFeedbackMap).length && batchId && date) {
      try {
        const fbRes = await fetch(`/api/daily-activities/attendance/feedback-reports?batchId=${batchId}&date=${date}`);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          if (fbData?.feedback && typeof fbData.feedback === 'object') {
            exportFeedbackMap = fbData.feedback as Record<string, StudentFeedback>;
          }
        }
      } catch {
        // Non-critical: keep export working even if feedback fetch fails.
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIT Manager';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Attendance Sheet');
    sheet.getColumn('A').width = 8;
    sheet.getColumn('B').width = 12;
    sheet.getColumn('C').width = 28;
    sheet.getColumn('D').width = 16;
    sheet.getColumn('E').width = 14;
    sheet.getColumn('F').width = 14;
    sheet.getColumn('G').width = 44;

    const titleCell = sheet.getCell('B1');
    titleCell.value = 'Suvidya Institute of Technology';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F2A78' } };

    sheet.getCell('B2').value = 'Attendance Register';
    sheet.getCell('B2').font = { bold: true, size: 12, color: { argb: 'FF2E3093' } };

    sheet.mergeCells('F1:G1');
    const formIdCell = sheet.getCell('F1');
    formIdCell.value = 'Form ID: F/TD/05/01';
    formIdCell.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
    formIdCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const selectedCourse = courses.find((c) => String(c.Course_Id) === courseId)?.Course_Name || '—';
    const selectedBatchObj = batches.find((b) => String(b.Batch_Id) === batchId);

    sheet.getCell('B4').value = `Course: ${selectedCourse}`;
    sheet.getCell('D4').value = `Batch: ${selectedBatchObj?.Batch_code || '—'}`;
    sheet.getCell('F4').value = `Date: ${new Date(`${date}T00:00:00`).toLocaleDateString('en-IN')}`;
    sheet.getCell('B5').value = `Trainer (FH): ${lectureFH.trainerName || '—'}`;
    sheet.getCell('D5').value = `Time (FH): ${formatTime12Hour(lectureFH.timeFrom || '') || '—'} - ${formatTime12Hour(lectureFH.timeTo || '') || '—'}`;
    sheet.getCell('B6').value = `Trainer (SH): ${lectureSH.trainerName || '—'}`;
    sheet.getCell('D6').value = `Time (SH): ${formatTime12Hour(lectureSH.timeFrom || '') || '—'} - ${formatTime12Hour(lectureSH.timeTo || '') || '—'}`;

    const logoData = await loadImageAsDataUrl('/sit.png');
    if (logoData) {
      const imageId = workbook.addImage({ base64: logoData, extension: 'png' });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 110, height: 48 },
      });
    }

    const headerRowNumber = 7;
    const headerLabels = [
      'Sr',
      'Roll No',
      'Student Name',
      'Mobile',
      'First Half',
      'Second Half',
      'Feedback',
    ];
    const headerRow = sheet.getRow(headerRowNumber);
    headerLabels.forEach((label, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1F2A78' } },
        left: { style: 'thin', color: { argb: 'FF1F2A78' } },
        bottom: { style: 'thin', color: { argb: 'FF1F2A78' } },
        right: { style: 'thin', color: { argb: 'FF1F2A78' } },
      };
    });
    headerRow.height = 22;

    students.forEach((student, index) => {
      const rowNumber = headerRowNumber + 1 + index;
      const row = sheet.getRow(rowNumber);
      const firstHalf = statusMapFH[student.Student_Id] || '';
      const secondHalf = statusMapSH[student.Student_Id] || '';
      const feedback = student.rollNo ? exportFeedbackMap[student.rollNo] : undefined;
      const fhFeedback = feedback?.firstHalf?.rating ? String(feedback.firstHalf.rating) : '—';
      const shFeedback = feedback?.secondHalf?.rating ? String(feedback.secondHalf.rating) : '—';
      const fhComments = feedback?.firstHalf?.comments?.trim() || '';
      const shComments = feedback?.secondHalf?.comments?.trim() || '';
      const feedbackSummary = [
        fhFeedback !== '—' || fhComments ? `FH: ${fhFeedback}${fhComments ? ` (${fhComments})` : ''}` : '',
        shFeedback !== '—' || shComments ? `SH: ${shFeedback}${shComments ? ` (${shComments})` : ''}` : '',
      ].filter(Boolean).join(' | ') || '—';
      const values = [
        index + 1,
        student.rollNo || '—',
        student.studentName,
        student.mobile || '—',
        firstHalf || '—',
        secondHalf || '—',
        feedbackSummary,
      ];

      values.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        const isCenterCol = [0, 1, 4, 5].includes(colIndex);
        cell.alignment = {
          horizontal: isCenterCol ? 'center' : 'left',
          vertical: 'middle',
          wrapText: colIndex === 6,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });

      const applyStatusColor = (cellRef: string, status: string) => {
        const statusCell = sheet.getCell(cellRef);
        if (status === 'P') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          statusCell.font = { bold: true, color: { argb: 'FF065F46' } };
        } else if (status === 'A') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          statusCell.font = { bold: true, color: { argb: 'FFB91C1C' } };
        } else if (status === 'L') {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          statusCell.font = { bold: true, color: { argb: 'FF92400E' } };
        }
      };

      applyStatusColor(`E${rowNumber}`, firstHalf);
      applyStatusColor(`F${rowNumber}`, secondHalf);

      if (feedbackSummary !== '—') {
        const feedbackCell = sheet.getCell(`G${rowNumber}`);
        feedbackCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
        feedbackCell.font = { color: { argb: 'FF854D0E' } };
      }
    });

    const filenameDate = date.replaceAll('-', '');
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `Attendance_${selectedBatchObj?.Batch_code || 'batch'}_${filenameDate}.xlsx`
    );
  }, [students, statusMapFH, statusMapSH, feedbackMap, courses, courseId, batches, batchId, date, lectureFH, lectureSH]);

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
            {canCreate && batchId && date && (
              <button
                onClick={openFacescan}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg border border-white/50 text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Facescan Sync
              </button>
            )}
            {loaded && students.length > 0 && (
              <button
                onClick={exportExcel}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg border border-white/50 text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6m0 0l-3-3m3 3l3-3M7 4h7l5 5v10a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>
                Export Excel
              </button>
            )}
            {canCreate && loaded && students.length > 0 && (
              <button
                onClick={() => save()}
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
                <p className="text-[11px] text-gray-500 mb-1.5">
                  Trainer: <span className="font-semibold text-gray-700">{lectureFH.trainerName || 'Not recorded in Lecture Taken'}</span>
                  {(lectureFH.timeFrom || lectureFH.timeTo) && (
                    <> · {formatTime12Hour(lectureFH.timeFrom || '')} - {formatTime12Hour(lectureFH.timeTo || '')}</>
                  )}
                </p>
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
                <p className="text-[11px] text-gray-500 mb-1.5">
                  Trainer: <span className="font-semibold text-gray-700">{lectureSH.trainerName || 'Not recorded in Lecture Taken'}</span>
                  {(lectureSH.timeFrom || lectureSH.timeTo) && (
                    <> · {formatTime12Hour(lectureSH.timeFrom || '')} - {formatTime12Hour(lectureSH.timeTo || '')}</>
                  )}
                </p>
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800 truncate">{student.studentName}</p>
                          {Number(student.Cancel) === 1 && (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Cancelled</span>
                          )}
                          <StudentTransferBadge transferred={student.Transfered} movedFromBatchCode={student.Moved_From_Batch_Code} movedToCourseName={student.movedToCourseName} movedToBatchCode={student.Moved_To_Batch_Code} />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Roll: {student.rollNo || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Mobile: {student.mobile || '—'}</p>
                      </div>
                      <span className="inline-flex items-center justify-center w-8 h-6 text-xs font-bold bg-[#2E3093]/8 text-[#2E3093] rounded-full shrink-0">{idx + 1}</span>
                    </div>
                    {canCreate ? (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-[#2E3093] uppercase">First Half</p>
                        {savingSet.has(`${student.Student_Id}-FH`) ? (
                          <div className="flex items-center gap-1.5 py-1 text-[11px] text-blue-500">
                            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Saving…
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleStatusClick(student, 'P', 'FH')} className={btnBase(fh==='P','bg-green-500 text-white shadow-sm shadow-green-200','bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700')}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>P
                            </button>
                            <button onClick={() => handleStatusClick(student, 'L', 'FH')} className={btnBase(fh==='L','bg-amber-500 text-white shadow-sm shadow-amber-200','bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700')}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>L
                            </button>
                            <button onClick={() => handleStatusClick(student, 'A', 'FH')} className={btnBase(fh==='A','bg-red-500 text-white shadow-sm shadow-red-200','bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600')}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>A
                            </button>
                          </div>
                        )}
                        {rowErrors[`${student.Student_Id}-FH`] && (
                          <p className="text-[10px] text-red-500">{rowErrors[`${student.Student_Id}-FH`]}</p>
                        )}
                        <p className="text-[10px] font-bold text-purple-600 uppercase">Second Half</p>
                        {savingSet.has(`${student.Student_Id}-SH`) ? (
                          <div className="flex items-center gap-1.5 py-1 text-[11px] text-purple-500">
                            <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Saving…
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleStatusClick(student, 'P', 'SH')} className={btnBase(sh==='P','bg-green-500 text-white shadow-sm shadow-green-200','bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700')}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>P
                            </button>
                            <button onClick={() => handleStatusClick(student, 'L', 'SH')} className={btnBase(sh==='L','bg-amber-500 text-white shadow-sm shadow-amber-200','bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700')}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>L
                            </button>
                            <button onClick={() => handleStatusClick(student, 'A', 'SH')} className={btnBase(sh==='A','bg-red-500 text-white shadow-sm shadow-red-200','bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600')}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>A
                            </button>
                          </div>
                        )}
                        {rowErrors[`${student.Student_Id}-SH`] && (
                          <p className="text-[10px] text-red-500">{rowErrors[`${student.Student_Id}-SH`]}</p>
                        )}
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
                  const fhMeta = metaMapFH[student.Student_Id];
                  const shMeta = metaMapSH[student.Student_Id];
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
                      <td className="py-2.5 px-4 font-semibold text-gray-800 text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{student.studentName}</span>
                          {Number(student.Cancel) === 1 && (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Cancelled</span>
                          )}
                          <StudentTransferBadge transferred={student.Transfered} movedFromBatchCode={student.Moved_From_Batch_Code} movedToCourseName={student.movedToCourseName} movedToBatchCode={student.Moved_To_Batch_Code} />
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-500 tabular-nums">{student.mobile || <span className="text-gray-300">—</span>}</td>

                      {/* First Half */}
                      <td className="py-2.5 px-3 bg-blue-50/30 border-l border-blue-100/60">
                        {canCreate ? (
                          <div className="flex flex-col items-center gap-1">
                            {savingSet.has(`${student.Student_Id}-FH`) ? (
                              <div className="flex items-center gap-1.5 py-1.5 text-[11px] text-blue-500">
                                <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                Saving…
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {(['P','L','A'] as const).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleStatusClick(student, s, 'FH')}
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
                            )}
                            {rowErrors[`${student.Student_Id}-FH`] && (
                              <p className="text-[10px] text-red-500 text-center">{rowErrors[`${student.Student_Id}-FH`]}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${fh==='P'?'bg-green-100 text-green-700':fh==='A'?'bg-red-100 text-red-600':fh==='L'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-400'}`}>
                              {fh||'—'}
                            </span>
                          </div>
                        )}
                        {(fhMeta?.inTime || fhMeta?.outTime) && (
                          <p className="mt-1 text-center text-[10px] text-gray-400 tabular-nums">
                            {fhMeta.inTime ? `In: ${formatTime12Hour(fhMeta.inTime.slice(0, 5))}` : ''}
                            {fhMeta.outTime ? ` · Out: ${formatTime12Hour(fhMeta.outTime.slice(0, 5))}` : ''}
                          </p>
                        )}
                        {fhMeta?.remarks && (
                          <p className="mt-0.5 text-center text-[10px] text-amber-600 font-medium">{fhMeta.remarks}</p>
                        )}
                      </td>

                      {/* Second Half */}
                      <td className="py-2.5 px-3 bg-purple-50/30 border-l border-purple-100/60">
                        {canCreate ? (
                          <div className="flex flex-col items-center gap-1">
                            {savingSet.has(`${student.Student_Id}-SH`) ? (
                              <div className="flex items-center gap-1.5 py-1.5 text-[11px] text-purple-500">
                                <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                Saving…
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {(['P','L','A'] as const).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleStatusClick(student, s, 'SH')}
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
                            )}
                            {rowErrors[`${student.Student_Id}-SH`] && (
                              <p className="text-[10px] text-red-500 text-center">{rowErrors[`${student.Student_Id}-SH`]}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${sh==='P'?'bg-green-100 text-green-700':sh==='A'?'bg-red-100 text-red-600':sh==='L'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-400'}`}>
                              {sh||'—'}
                            </span>
                          </div>
                        )}
                        {(shMeta?.inTime || shMeta?.outTime) && (
                          <p className="mt-1 text-center text-[10px] text-gray-400 tabular-nums">
                            {shMeta.inTime ? `In: ${formatTime12Hour(shMeta.inTime.slice(0, 5))}` : ''}
                            {shMeta.outTime ? ` · Out: ${formatTime12Hour(shMeta.outTime.slice(0, 5))}` : ''}
                          </p>
                        )}
                        {shMeta?.remarks && (
                          <p className="mt-0.5 text-center text-[10px] text-amber-600 font-medium">{shMeta.remarks}</p>
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
                onClick={() => save()}
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
      {/* ── Facescan Panel ── */}
      {facescanOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
          onClick={() => !facescanLoading && setFacescanOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.35)] overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Facescan Attendance</p>
                  <p className="text-[11px] text-slate-500">
                    {facescanLoading ? 'Connecting to device…' :
                     facescanConfigured === false ? 'SmartOffice not configured — manual mode' :
                     facescanConfigured === true && !facescanError ? 'SmartOffice connected' :
                     facescanError ? 'Device error — manual mode available' :
                     'Checking device…'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFacescanOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* SmartOffice status */}
              {facescanLoading ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin shrink-0" />
                  <p className="text-xs text-slate-600">Fetching punch logs from biometric device…</p>
                </div>
              ) : facescanConfigured === true && !facescanError ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-bold text-emerald-700">SmartOffice Connected</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-center">
                      <p className="font-bold text-[#2E3093] text-base">{facescanFhIds.size}</p>
                      <p className="text-[11px] text-blue-600">1st Half</p>
                    </div>
                    <div className="rounded-md bg-purple-50 border border-purple-100 px-2.5 py-1.5 text-center">
                      <p className="font-bold text-purple-700 text-base">{facescanShIds.size}</p>
                      <p className="text-[11px] text-purple-600">2nd Half</p>
                    </div>
                  </div>
                  {facescanFhIds.size === 0 && facescanShIds.size === 0 && (
                    <p className="text-[11px] text-emerald-600">No punches found for this batch on {date}.</p>
                  )}
                  {(facescanFhIds.size > 0 || facescanShIds.size > 0) && (
                    <div className="max-h-32 overflow-y-auto rounded-md border border-emerald-200 divide-y divide-emerald-100">
                      {students.filter(s => facescanFhIds.has(s.Student_Id) || facescanShIds.has(s.Student_Id)).map(s => (
                        <div key={s.Student_Id} className="flex items-center gap-2 px-2.5 py-1 text-[11px]">
                          <span className="font-semibold text-slate-700 truncate flex-1">{s.studentName}</span>
                          {facescanFhIds.has(s.Student_Id) && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">FH</span>
                          )}
                          {facescanShIds.has(s.Student_Id) && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">SH</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : facescanConfigured === false || facescanError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold text-amber-700">
                      {facescanConfigured === false ? 'No Facescan Data Yet' : 'Device Unreachable'}
                    </p>
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      {facescanError || 'No punches synced for this date yet, and SmartOffice isn’t configured. If the device is on the institute LAN, the facescan-relay app needs to push logs first — you can still mark attendance manually below.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Manual entry — always available */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Manual Entry
                  <span className="ml-1 font-normal normal-case text-slate-400">— type or scan Student IDs / Roll Numbers</span>
                </label>
                <textarea
                  value={facescanManual}
                  onChange={e => setFacescanManual(e.target.value)}
                  placeholder={"101\n102\nRN001\n(one per line, or scan barcode)"}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] resize-none"
                />
                {facescanManual.trim() && (() => {
                  const lines = facescanManual.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
                  const matched = lines.filter(line =>
                    students.some(s => String(s.Student_Id) === line || (s.rollNo && s.rollNo.toLowerCase() === line.toLowerCase()))
                  );
                  return (
                    <p className="text-[11px] text-slate-500">
                      <span className="font-bold text-emerald-600">{matched.length}</span> of {lines.length} entries matched to students in this batch
                    </p>
                  );
                })()}
              </div>

              {/* Apply to selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Apply To</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['both', 'first_half', 'second_half'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFacescanApplyTo(opt)}
                      className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                        facescanApplyTo === opt
                          ? 'bg-[#2E3093] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt === 'both' ? 'Both Halves' : opt === 'first_half' ? '1st Half' : '2nd Half'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
              {saving && (
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                  <div className="w-3.5 h-3.5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                  Saving attendance…
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFacescanOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyFacescan}
                  disabled={facescanLoading || saving || (facescanFhIds.size === 0 && facescanShIds.size === 0 && !facescanManual.trim())}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Apply Only
                </button>
                {canCreate && (
                  <button
                    type="button"
                    onClick={applyAndSave}
                    disabled={facescanLoading || saving || (facescanFhIds.size === 0 && facescanShIds.size === 0 && !facescanManual.trim())}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#2E3093] hover:bg-[#252780] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    {saving ? 'Saving…' : 'Apply & Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
