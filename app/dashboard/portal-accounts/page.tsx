'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type Tab = 'trainer' | 'student';

function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toInt(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (String(i) !== String(n) && String(n) !== value.trim()) {
    // ignore weird floats; parse via Number below anyway
  }
  return i > 0 ? i : null;
}

export default function PortalAccountsPage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('user');
  const { canCreate: canCreateEmployee, loading: employeePermLoading } = useResourcePermissions('employee');

  const DEFAULT_IN_TIME = '08:00';
  const DEFAULT_OUT_TIME = '17:30';
  const DEFAULT_TRAINER_PASSWORD = 'Suvidya@2026';

  const [tab, setTab] = useState<Tab>('trainer');
  const [studentForm, setStudentForm] = useState({
    studentId: '',
    username: '',
    password: '',
    isActive: true,
  });

  // ── Student bulk tab state ───────────────────────────────────────────
  type StudentRow = {
    Student_Id: number; Roll_No: string | null; Student_Name: string;
    Email: string | null; Present_Mobile: string | null;
    auth_id: number | null; existing_username: string | null; account_active: number | null;
  };
  const [studentCourseId, setStudentCourseId] = useState('');
  const [studentBatchId, setStudentBatchId]   = useState('');
  const [studentCourses, setStudentCourses]   = useState<Array<{ Course_Id: number; Course_Name: string }>>([]);
  const [studentBatches, setStudentBatches]   = useState<Array<{ Batch_Id: number; Batch_code: string; Category: string }>>([]);
  const [studentRows, setStudentRows]         = useState<StudentRow[]>([]);
  const [studentLoading, setStudentLoading]   = useState(false);
  const [studentSearch, setStudentSearch]     = useState('');
  const [studentPasswords, setStudentPasswords] = useState<Record<number, string>>({});
  const [studentActiveMap, setStudentActiveMap] = useState<Record<number, boolean>>({});
  const [studentSavingId, setStudentSavingId]   = useState<number | null>(null);
  const [bulkCreating, setBulkCreating]         = useState(false);
  const [bulkSending, setBulkSending]           = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string>('');
  const [copiedTrainerId, setCopiedTrainerId] = useState<number | null>(null);

  const [facultySearch, setFacultySearch] = useState('');
  const [scheduleDate, setScheduleDate] = useState(getTodayIsoDate());

  const [facultyLoading, setFacultyLoading] = useState(false);
  const [facultyRows, setFacultyRows] = useState<
    Array<{
      Faculty_Id: number;
      Faculty_Name: string;
      IsActive?: number | null;
      BreakTimeMinutes?: number | null;
      InTime?: string | null;
      OutTime?: string | null;
      OverrideInTime?: string | null;
      OverrideOutTime?: string | null;
    }>
  >(
    []
  );
  const [trainerActiveByFacultyId, setTrainerActiveByFacultyId] = useState<Record<number, boolean>>({});
  const [breakSavingId, setBreakSavingId] = useState<number | null>(null);
  const [timeSavingId, setTimeSavingId] = useState<number | null>(null);

  const labelCls = 'block text-[10px] font-semibold text-gray-600 mb-0.5';
  const inputCls =
    'w-full bg-white border-[1.5px] border-gray-300 rounded px-2 py-2 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400';
  const btnPrimary =
    'px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252773] text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed';
  const btnGhost =
    'px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700';
  const btnPrimarySm =
    'inline-flex items-center justify-center whitespace-nowrap px-3.5 py-1.5 rounded-lg bg-[#2E3093] hover:bg-[#252773] text-white text-xs font-semibold shadow-sm ring-1 ring-[#2E3093]/20 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

  const title = useMemo(() => (tab === 'trainer' ? 'Trainer Portal Accounts' : 'Create Student Account'), [tab]);
  const subtitle = useMemo(
    () =>
      tab === 'trainer'
        ? 'One-click trainer account creation: login with trainer name and default password'
        : 'Creates or updates a Student Portal login (links to student_master)',
    [tab]
  );

  const suggestUsername = useCallback(
    (facultyName: string, facultyId: number): string => {
      const byName = String(facultyName || '').trim();
      if (byName) return byName;
      return `trainer.${facultyId}`;
    },
    []
  );

  function generatePassword(length = 10): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint8Array(Math.max(1, length));
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  function csvEscape(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
    const csv = ['\uFEFF' + headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ── Student helpers ──────────────────────────────────────────────────
  function suggestStudentUsername(rollNo: string | null, studentId: number): string {
    if (rollNo && rollNo.trim()) return rollNo.trim().toLowerCase();
    return `student.${studentId}`;
  }

  function exportStudentCsv(filteredRows: StudentRow[]) {
    if (!filteredRows.length) return;
    const pwMap: Record<number, string> = { ...studentPasswords };
    for (const r of filteredRows) {
      if (!r.auth_id && !pwMap[r.Student_Id]) pwMap[r.Student_Id] = generatePassword(10);
    }
    setStudentPasswords(pwMap);
    const headers = ['Student ID', 'Roll No', 'Student Name', 'Email', 'Mobile', 'Username', 'Password', 'Has Account'];
    const rows = filteredRows.map(r => {
      const username = r.existing_username || suggestStudentUsername(r.Roll_No, r.Student_Id);
      const password = r.auth_id ? '' : (pwMap[r.Student_Id] || '');
      return [r.Student_Id, r.Roll_No || '', r.Student_Name || '', r.Email || '', r.Present_Mobile || '', username, password, r.auth_id ? 'Yes' : 'No'];
    });
    downloadCsv(`portal-accounts-students-batch${studentBatchId}.csv`, headers, rows);
  }

  async function createStudentAccount(studentId: number, rollNo: string | null) {
    const username = suggestStudentUsername(rollNo, studentId);
    const password = studentPasswords[studentId] || generatePassword(10);
    if (!studentPasswords[studentId]) setStudentPasswords(prev => ({ ...prev, [studentId]: password }));
    setStudentSavingId(studentId);
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/admin/portal-accounts/student', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, username, password, isActive: studentActiveMap[studentId] ?? true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed');
      setStudentRows(prev => prev.map(r =>
        r.Student_Id === studentId ? { ...r, auth_id: 1, existing_username: username, account_active: 1 } : r
      ));
      setSuccess(`Account created: ${username}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setStudentSavingId(null);
    }
  }

  async function bulkCreateStudentAccounts(rows: StudentRow[]) {
    const toCreate = rows.filter(r => !r.auth_id);
    if (!toCreate.length) { setError('All selected students already have accounts'); return; }
    setBulkCreating(true); setError(''); setSuccess('');
    let created = 0; let failed = 0;
    for (const r of toCreate) {
      const username = suggestStudentUsername(r.Roll_No, r.Student_Id);
      const password = studentPasswords[r.Student_Id] || generatePassword(10);
      if (!studentPasswords[r.Student_Id]) setStudentPasswords(prev => ({ ...prev, [r.Student_Id]: password }));
      try {
        const res = await fetch('/api/admin/portal-accounts/student', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: r.Student_Id, username, password, isActive: studentActiveMap[r.Student_Id] ?? true }),
        });
        if (res.ok) {
          created++;
          setStudentRows(prev => prev.map(s =>
            s.Student_Id === r.Student_Id ? { ...s, auth_id: 1, existing_username: username, account_active: 1 } : s
          ));
        } else { failed++; }
      } catch { failed++; }
    }
    setBulkCreating(false);
    setSuccess(`Bulk create done: ${created} created${failed ? `, ${failed} failed` : ''}`);
  }

  async function bulkSendCredentials(rows: StudentRow[]) {
    // Only send to students where we have a plaintext password AND an email
    const eligible = rows.filter(r => studentPasswords[r.Student_Id] && r.Email);
    const noEmail  = rows.filter(r => studentPasswords[r.Student_Id] && !r.Email);
    if (!eligible.length) {
      setError(`No students to email${noEmail.length ? ` (${noEmail.length} have no email on record)` : ' — load a batch and create accounts first'}`);
      return;
    }
    const skippedNote = noEmail.length ? ` (${noEmail.length} will be skipped — no email on record)` : '';
    const confirmed = window.confirm(
      `Send login credentials to ${eligible.length} student${eligible.length !== 1 ? 's' : ''}?${skippedNote}\n\nThis will email each student their username and password.`
    );
    if (!confirmed) return;
    setBulkSending(true); setError(''); setSuccess('');
    try {
      const payload = eligible.map(r => ({
        email: r.Email!,
        studentName: r.Student_Name,
        username: r.existing_username || suggestStudentUsername(r.Roll_No, r.Student_Id),
        password: studentPasswords[r.Student_Id],
      }));
      const res = await fetch('/api/admin/portal-accounts/student/send-credentials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Send failed');
      const skipped = noEmail.length;
      setSuccess(
        `Emails sent: ${data.sent}${data.failed ? `, ${data.failed} failed` : ''}${skipped ? ` · ${skipped} skipped (no email)` : ''}`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send emails');
    } finally {
      setBulkSending(false);
    }
  }

  function exportFacultyCsv() {
    const q = facultySearch.trim().toLowerCase();
    const filtered = !q
      ? facultyRows
      : facultyRows.filter((f) => {
          const facultyId = String(f.Faculty_Id ?? '');
          const facultyName = String(f.Faculty_Name ?? '').toLowerCase();
          const username = suggestUsername(String(f.Faculty_Name ?? '').trim(), Number(f.Faculty_Id));
          return facultyId.includes(q) || facultyName.includes(q) || username.toLowerCase().includes(q);
        });

    if (facultyLoading || filtered.length === 0) return;

    const headers = ['Trainer ID', 'Trainer Name', 'In Time', 'Out Time', 'Break Time (min)', 'Username', 'Password', 'Active'];
    const rows = filtered.map((f) => {
      const facultyId = Number(f.Faculty_Id);
      const facultyName = String(f.Faculty_Name ?? '').trim();
      const defaultIn = f.InTime ? String(f.InTime).slice(0, 5) : DEFAULT_IN_TIME;
      const defaultOut = f.OutTime ? String(f.OutTime).slice(0, 5) : DEFAULT_OUT_TIME;
      const overrideIn = f.OverrideInTime ? String(f.OverrideInTime).slice(0, 5) : null;
      const overrideOut = f.OverrideOutTime ? String(f.OverrideOutTime).slice(0, 5) : null;
      const inTime = overrideIn || defaultIn;
      const outTime = overrideOut || defaultOut;
      const breakMinutes = f.BreakTimeMinutes === null || f.BreakTimeMinutes === undefined ? '' : Number(f.BreakTimeMinutes);
      const username = suggestUsername(facultyName, facultyId);
      const password = DEFAULT_TRAINER_PASSWORD;
      const active = (trainerActiveByFacultyId[facultyId] ?? true) ? 'Yes' : 'No';
      return [facultyId, facultyName, inTime, outTime, breakMinutes, username, password, active];
    });

    const stamp = scheduleDate || new Date().toISOString().slice(0, 10);
    downloadCsv(`portal-accounts-trainer-${stamp}.csv`, headers, rows);
  }

  const filteredFacultyRows = useMemo(() => {
    const q = facultySearch.trim().toLowerCase();
    if (!q) return facultyRows;
    return facultyRows.filter((f) => {
      const facultyId = String(f.Faculty_Id ?? '');
      const facultyName = String(f.Faculty_Name ?? '').toLowerCase();
      const username = suggestUsername(String(f.Faculty_Name ?? '').trim(), Number(f.Faculty_Id));
      return facultyId.includes(q) || facultyName.includes(q) || username.toLowerCase().includes(q);
    });
  }, [facultyRows, facultySearch, suggestUsername]);

  async function createTrainerAccountForFaculty(facultyId: number, facultyName: string) {
    if (!Number.isFinite(facultyId) || facultyId <= 0) return;
    setError('');
    setSuccess('');

    const username = suggestUsername(facultyName, facultyId);

    // Ensure we have a stable password for this faculty.
    const password = DEFAULT_TRAINER_PASSWORD;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/portal-accounts/trainer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId,
          username,
          password,
          isActive: trainerActiveByFacultyId[facultyId] ?? true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create trainer account');

      setSuccess(`Trainer account saved for username: ${username}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create trainer account');
    } finally {
      setSaving(false);
    }
  }

  async function copyTrainerCredentials(facultyId: number, facultyName: string) {
    const loginName = suggestUsername(facultyName, facultyId);
    const text = `Login Name: ${loginName}\nPassword: ${DEFAULT_TRAINER_PASSWORD}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTrainerId(facultyId);
      setTimeout(() => setCopiedTrainerId((prev) => (prev === facultyId ? null : prev)), 1800);
    } catch {
      setError('Failed to copy credentials');
    }
  }

  async function saveBreakTimeMinutes(facultyId: number, breakTimeMinutes: number | null) {
    if (!Number.isFinite(facultyId) || facultyId <= 0) return;
    setBreakSavingId(facultyId);
    setError('');
    try {
      const res = await fetch('/api/admin/portal-accounts/faculty', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Faculty_Id: facultyId, BreakTimeMinutes: breakTimeMinutes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to update break time');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update break time');
    } finally {
      setBreakSavingId(null);
    }
  }

  async function saveScheduleOverride(facultyId: number, inTime: string, outTime: string) {
    if (!Number.isFinite(facultyId) || facultyId <= 0) return;
    if (!scheduleDate) {
      setError('Please select a schedule date');
      return;
    }
    setTimeSavingId(facultyId);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        Faculty_Id: facultyId,
        Work_Date: scheduleDate,
        InTime: inTime || DEFAULT_IN_TIME,
        OutTime: outTime || DEFAULT_OUT_TIME,
      };

      const res = await fetch('/api/admin/portal-accounts/faculty', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to update time');

      if (data?.mode === 'override' && data?.action === 'deleted') {
        setFacultyRows((prev) =>
          prev.map((r) => (Number(r.Faculty_Id) === facultyId ? { ...r, OverrideInTime: null, OverrideOutTime: null } : r))
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update time');
    } finally {
      setTimeSavingId(null);
    }
  }

  useEffect(() => {
    let alive = true;

    async function loadFaculty() {
      setFacultyLoading(true);
      try {
        const url = scheduleDate
          ? `/api/admin/portal-accounts/faculty?date=${encodeURIComponent(scheduleDate)}`
          : '/api/admin/portal-accounts/faculty';
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to fetch trainer');

        const rows = Array.isArray(data?.rows) ? data.rows : [];
        if (!alive) return;
        const sortedRows = [...rows].sort((a, b) => {
          const an = String(a?.Faculty_Name ?? '').trim();
          const bn = String(b?.Faculty_Name ?? '').trim();
          return an.localeCompare(bn, undefined, { sensitivity: 'base' });
        });
        setFacultyRows(sortedRows);

        setTrainerActiveByFacultyId((prev) => {
          const next = { ...prev };
          for (const r of sortedRows) {
            const id = Number(r?.Faculty_Id);
            if (!Number.isFinite(id) || id <= 0) continue;
            if (next[id] === undefined) next[id] = Number(r?.IsActive ?? 1) ? true : false;
          }
          return next;
        });

      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch trainer');
      } finally {
        if (!alive) return;
        setFacultyLoading(false);
      }
    }

    // Ensure hooks are always called in the same order; gate logic here.
    if (!permLoading && canCreate && tab === 'trainer') loadFaculty();

    return () => {
      alive = false;
    };
  }, [tab, permLoading, canCreate, scheduleDate]);

  // Load courses for student tab
  useEffect(() => {
    if (tab !== 'student' || permLoading || !canCreate) return;
    fetch('/api/daily-activities/attendance?options=courses')
      .then(r => r.json())
      .then(d => setStudentCourses(Array.isArray(d.courses) ? d.courses : []))
      .catch(() => {});
  }, [tab, permLoading, canCreate]);

  // Load batches when course changes
  useEffect(() => {
    if (!studentCourseId) { setStudentBatches([]); setStudentBatchId(''); return; }
    fetch(`/api/daily-activities/attendance?options=batches&courseId=${studentCourseId}`)
      .then(r => r.json())
      .then(d => setStudentBatches(Array.isArray(d.batches) ? d.batches : []))
      .catch(() => {});
  }, [studentCourseId]);

  // Load students when batch changes
  useEffect(() => {
    if (!studentBatchId) { setStudentRows([]); return; }
    setStudentLoading(true);
    fetch(`/api/admin/portal-accounts/student?batchId=${studentBatchId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setError(d.message || 'Failed to load students'); return; }
        const rows: StudentRow[] = Array.isArray(d.rows) ? d.rows : [];
        setStudentRows(rows);
        setStudentActiveMap(prev => {
          const next = { ...prev };
          rows.forEach(r => { if (next[r.Student_Id] === undefined) next[r.Student_Id] = (r.account_active ?? 1) === 1; });
          return next;
        });
        setStudentPasswords(prev => {
          const next = { ...prev };
          rows.forEach(r => { if (!r.auth_id && !next[r.Student_Id]) next[r.Student_Id] = generatePassword(10); });
          return next;
        });
      })
      .catch(() => setError('Failed to load students'))
      .finally(() => setStudentLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentBatchId]);

  if (permLoading || employeePermLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to create accounts." />;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-base font-bold text-white">Portal Accounts</h2>
              <p className="text-xs text-white/70">Role Right &gt; Portal Accounts</p>
            </div>
          </div>

          {canCreateEmployee && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/masters/employee/add')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Employee
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {(error || success) && (
          <div className="mx-5 mt-3 space-y-2">
            {error && (
              <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}
            {success && (
              <div className="px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {success}
              </div>
            )}
          </div>
        )}

        <div className="px-3 py-3 bg-gray-50/40">
          <div className="flex items-center gap-2 px-2">
            <button
              className={tab === 'trainer' ? `${btnPrimary} !py-1.5` : btnGhost}
              onClick={() => {
                setTab('trainer');
                setError('');
                setSuccess('');
              }}
              type="button"
            >
              Trainer
            </button>
            <button
              className={tab === 'student' ? `${btnPrimary} !py-1.5` : btnGhost}
              onClick={() => {
                setTab('student');
                setError('');
                setSuccess('');
              }}
              type="button"
            >
              Student
            </button>
            <div className="ml-auto text-[11px] text-gray-600">
              Permission required: <span className="font-semibold">user.create</span>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-2 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-[#2E3093]">{title}</h3>
                  <p className="text-[11px] text-gray-600">{subtitle}</p>
                </div>
                <div className="text-[11px] text-gray-500">
                  Password is stored as MD5 (legacy compatibility)
                </div>
              </div>
            </div>

            <div className="px-3 py-3">
              {tab === 'trainer' ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                      <div>
                        <div className="text-[12px] font-bold text-gray-800">Trainer List</div>
                        <div className="text-[11px] text-gray-600">Username = trainer name, password = Suvidya@2026</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <div className="flex items-center gap-2 rounded-lg border border-[#2E3093]/25 bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10 px-2.5 py-1.5">
                          <div className="text-[11px] text-[#2E3093] font-bold">Schedule Date</div>
                          <input
                            className="bg-white border border-[#2E3093]/30 rounded-md px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/25 focus:border-[#2E3093]"
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                          />
                        </div>
                        <input
                          className="w-56 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]"
                          placeholder="Search trainer…"
                          value={facultySearch}
                          onChange={(e) => setFacultySearch(e.target.value)}
                        />
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={exportFacultyCsv}
                          disabled={facultyLoading || filteredFacultyRows.length === 0}
                          title="Export trainer usernames/passwords"
                        >
                          Export CSV
                        </button>
                        <div className="text-[11px] text-gray-500">
                          {facultyLoading ? 'Loading…' : `${filteredFacultyRows.length} trainers`}
                        </div>
                      </div>
                    </div>

                    <div className="px-3 py-2 border-b border-gray-100 bg-amber-50/60 text-[11px] text-amber-800">
                      Trainers sign in with <span className="font-semibold">their full name</span> and default password <span className="font-semibold">Suvidya@2026</span>.
                    </div>

                    <div className="relative h-[60vh] overflow-x-auto overflow-y-scroll overscroll-contain [-webkit-overflow-scrolling:touch]">
                      <table className="min-w-[1020px] w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <th className="px-3 py-2 sticky top-0 z-10 bg-gray-50">Trainer ID</th>
                            <th className="px-3 py-2 sticky top-0 z-10 bg-gray-50">Trainer Name</th>
                            <th className="px-3 py-2 sticky top-0 z-10 bg-gray-50">In Time</th>
                            <th className="px-3 py-2 sticky top-0 z-10 bg-gray-50">Out Time</th>
                            <th className="px-3 py-2 sticky top-0 z-10 bg-gray-50">Break (min)</th>
                            <th className="px-3 py-2 sticky top-0 z-10 bg-gray-50">Login Name</th>
                            <th className="px-3 py-2 sticky top-0 z-10 bg-gray-50">Default Password</th>
                            <th className="px-3 py-2 w-[230px] sticky top-0 z-10 bg-gray-50">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFacultyRows.map((f) => {
                            const facultyId = Number(f.Faculty_Id);
                            const facultyName = String(f.Faculty_Name ?? '').trim();
                            const breakMinutes = f.BreakTimeMinutes === null || f.BreakTimeMinutes === undefined ? '' : String(f.BreakTimeMinutes);
                            const username = suggestUsername(facultyName, facultyId);
                            const password = DEFAULT_TRAINER_PASSWORD;
                            const defaultIn = (f.InTime ? String(f.InTime).slice(0, 5) : DEFAULT_IN_TIME) || DEFAULT_IN_TIME;
                            const defaultOut = (f.OutTime ? String(f.OutTime).slice(0, 5) : DEFAULT_OUT_TIME) || DEFAULT_OUT_TIME;
                            const overrideIn = f.OverrideInTime ? String(f.OverrideInTime).slice(0, 5) : '';
                            const overrideOut = f.OverrideOutTime ? String(f.OverrideOutTime).slice(0, 5) : '';
                            const inTimeValue = (overrideIn || defaultIn) || DEFAULT_IN_TIME;
                            const outTimeValue = (overrideOut || defaultOut) || DEFAULT_OUT_TIME;

                            return (
                              <tr key={facultyId} className="border-t border-gray-100 hover:bg-gray-50/40">
                                <td className="px-3 py-2 text-gray-900 font-semibold">{facultyId}</td>
                                <td className="px-3 py-2 text-gray-800">{facultyName || '—'}</td>
                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                  <input
                                    className="w-28 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]"
                                    type="time"
                                    step={60}
                                    value={inTimeValue}
                                    disabled={facultyLoading || timeSavingId === facultyId}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setFacultyRows((prev) =>
                                        prev.map((r) =>
                                          Number(r.Faculty_Id) === facultyId ? { ...r, OverrideInTime: v || null } : r
                                        )
                                      );
                                    }}
                                    title="Schedule in time for selected date"
                                  />
                                </td>
                                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                  <input
                                    className="w-28 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]"
                                    type="time"
                                    step={60}
                                    value={outTimeValue}
                                    disabled={facultyLoading || timeSavingId === facultyId}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setFacultyRows((prev) =>
                                        prev.map((r) =>
                                          Number(r.Faculty_Id) === facultyId ? { ...r, OverrideOutTime: v || null } : r
                                        )
                                      );
                                    }}
                                    title="Schedule out time for selected date"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className="w-24 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]"
                                    type="number"
                                    min={0}
                                    max={600}
                                    value={breakMinutes}
                                    disabled={facultyLoading || breakSavingId === facultyId}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      const parsed = v === '' ? null : Number(v);
                                      setFacultyRows((prev) =>
                                        prev.map((r) =>
                                          Number(r.Faculty_Id) === facultyId
                                            ? { ...r, BreakTimeMinutes: parsed === null || Number.isFinite(parsed) ? parsed : r.BreakTimeMinutes ?? null }
                                            : r
                                        )
                                      );
                                    }}
                                    onBlur={(e) => {
                                      const v = e.target.value;
                                      const next = v === '' ? null : Number(v);
                                      void saveBreakTimeMinutes(facultyId, Number.isFinite(next) ? next : null);
                                    }}
                                    title="Break time in minutes"
                                  />
                                </td>
                                <td className="px-3 py-2 text-gray-700 font-medium">{username}</td>
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                    {password}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    <label className="inline-flex items-center gap-2 select-none">
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={trainerActiveByFacultyId[facultyId] ?? true}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setTrainerActiveByFacultyId((prev) => ({ ...prev, [facultyId]: checked }));
                                        }}
                                        disabled={saving}
                                      />
                                      <span
                                        className="relative w-10 h-5 rounded-full bg-gray-200 border border-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#2E3093]/30 peer-checked:bg-[#2E3093] peer-checked:border-[#2E3093] peer-disabled:opacity-60 peer-disabled:cursor-not-allowed transition-colors"
                                        aria-hidden="true"
                                      >
                                        <span className="absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white border border-gray-300 shadow-sm transition-transform peer-checked:translate-x-5" />
                                      </span>
                                      <span
                                        className={
                                          (trainerActiveByFacultyId[facultyId] ?? true)
                                            ? 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-gray-50 text-gray-600 border-gray-200'
                                        }
                                      >
                                        {(trainerActiveByFacultyId[facultyId] ?? true) ? 'Active' : 'Not Active'}
                                      </span>
                                    </label>
                                    <button
                                      type="button"
                                      className={btnGhost}
                                      onClick={() => { void copyTrainerCredentials(facultyId, facultyName); }}
                                      title="Copy login name and password"
                                    >
                                      {copiedTrainerId === facultyId ? 'Copied' : 'Copy'}
                                    </button>
                                    <button
                                      type="button"
                                      className={btnGhost}
                                      onClick={() => {
                                        void saveScheduleOverride(facultyId, inTimeValue, outTimeValue);
                                      }}
                                      disabled={facultyLoading || timeSavingId === facultyId}
                                      title="Save schedule override for selected date"
                                    >
                                      {timeSavingId === facultyId ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      className={btnPrimarySm}
                                      onClick={() => {
                                        void createTrainerAccountForFaculty(facultyId, facultyName);
                                      }}
                                      disabled={saving}
                                    >
                                      Create Account
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {!facultyLoading && facultyRows.length === 0 && (
                            <tr>
                              <td className="px-3 py-3 text-gray-500" colSpan={8}>
                                No trainers found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="space-y-3">
                  {/* ── Course + Batch selectors ── */}
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2 overflow-x-auto">
                      <span className="text-[11px] font-bold text-gray-700 shrink-0">Course</span>
                      <select
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] max-w-[180px]"
                        value={studentCourseId}
                        onChange={e => { setStudentCourseId(e.target.value); setStudentBatchId(''); }}
                      >
                        <option value="">— Select —</option>
                        {studentCourses.map(c => (
                          <option key={c.Course_Id} value={String(c.Course_Id)}>{c.Course_Name}</option>
                        ))}
                      </select>
                      <span className="text-[11px] font-bold text-gray-700 shrink-0">Batch</span>
                      <select
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] disabled:opacity-50 max-w-[180px]"
                        value={studentBatchId}
                        onChange={e => setStudentBatchId(e.target.value)}
                        disabled={!studentCourseId}
                      >
                        <option value="">— Select —</option>
                        {studentBatches.map(b => (
                          <option key={b.Batch_Id} value={String(b.Batch_Id)}>
                            {b.Batch_code}{b.Category ? ` · ${b.Category}` : ''}
                          </option>
                        ))}
                      </select>
                      {studentBatchId && (
                        <>
                          <input
                            className="w-36 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] shrink-0"
                            placeholder="Search name / roll…"
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                          />
                          <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                            {studentLoading ? 'Loading…' : `${studentRows.length} students · ${studentRows.filter(r => r.auth_id).length} with accounts`}
                          </span>
                          <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            <button type="button" className={btnGhost}
                              onClick={() => exportStudentCsv(
                                studentSearch
                                  ? studentRows.filter(r => (r.Roll_No || '').toLowerCase().includes(studentSearch.toLowerCase()) || (r.Student_Name || '').toLowerCase().includes(studentSearch.toLowerCase()))
                                  : studentRows
                              )}
                              disabled={studentLoading || !studentRows.length}
                            >
                              Export CSV
                            </button>
                            <button type="button" className={btnPrimarySm}
                              onClick={() => bulkCreateStudentAccounts(
                                studentSearch
                                  ? studentRows.filter(r => (r.Roll_No || '').toLowerCase().includes(studentSearch.toLowerCase()) || (r.Student_Name || '').toLowerCase().includes(studentSearch.toLowerCase()))
                                  : studentRows
                              )}
                              disabled={bulkCreating || bulkSending || studentLoading || !studentRows.length}
                            >
                              {bulkCreating ? 'Creating…' : 'Create All'}
                            </button>
                            <button type="button"
                              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm ring-1 ring-emerald-700/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                              onClick={() => bulkSendCredentials(
                                studentSearch
                                  ? studentRows.filter(r => (r.Roll_No || '').toLowerCase().includes(studentSearch.toLowerCase()) || (r.Student_Name || '').toLowerCase().includes(studentSearch.toLowerCase()))
                                  : studentRows
                              )}
                              disabled={bulkSending || bulkCreating || studentLoading || !studentRows.length}
                              title="Email login credentials to each student who has an email on record"
                            >
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                              </svg>
                              {bulkSending ? 'Sending…' : 'Send Credentials'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* ── Student table ── */}
                    {!studentBatchId ? (
                      <div className="py-12 text-center text-sm text-gray-400">Select a course and batch to view students</div>
                    ) : studentLoading ? (
                      <div className="py-12 text-center">
                        <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin mx-auto" />
                      </div>
                    ) : (
                      <div className="relative h-[60vh] overflow-x-auto overflow-y-scroll overscroll-contain">
                        <table className="min-w-[900px] w-full text-xs">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              <th className="px-3 py-2 bg-gray-50 w-16">Roll No</th>
                              <th className="px-3 py-2 bg-gray-50">Student Name</th>
                              <th className="px-3 py-2 bg-gray-50 w-32">Username</th>
                              <th className="px-3 py-2 bg-gray-50 w-28">Password</th>
                              <th className="px-3 py-2 bg-gray-50 w-24">Status</th>
                              <th className="px-3 py-2 bg-gray-50 w-40">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(studentSearch
                              ? studentRows.filter(r =>
                                  (r.Roll_No || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                                  (r.Student_Name || '').toLowerCase().includes(studentSearch.toLowerCase())
                                )
                              : studentRows
                            ).map(r => {
                              const username = r.existing_username || suggestStudentUsername(r.Roll_No, r.Student_Id);
                              const password = studentPasswords[r.Student_Id] || '';
                              const hasAccount = Boolean(r.auth_id);
                              const isSaving = studentSavingId === r.Student_Id;
                              return (
                                <tr key={r.Student_Id} className="border-t border-gray-100 hover:bg-gray-50/40">
                                  <td className="px-3 py-2 font-mono text-gray-600">{r.Roll_No || '—'}</td>
                                  <td className="px-3 py-2 text-gray-800 font-medium">
                                    {r.Student_Name || '—'}
                                    {r.Email && <span className="block text-[10px] text-gray-400 font-normal">{r.Email}</span>}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-gray-700">{username}</td>
                                  <td className="px-3 py-2">
                                    {hasAccount ? (
                                      <span className="text-[10px] text-gray-400 italic">••••••••</span>
                                    ) : (
                                      <input
                                        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]"
                                        value={password}
                                        onChange={e => setStudentPasswords(prev => ({ ...prev, [r.Student_Id]: e.target.value }))}
                                        placeholder="password"
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                                      hasAccount
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                      {hasAccount ? 'Active' : 'No account'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <label className="inline-flex items-center gap-1.5 select-none">
                                        <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={studentActiveMap[r.Student_Id] ?? true}
                                          onChange={e => setStudentActiveMap(prev => ({ ...prev, [r.Student_Id]: e.target.checked }))}
                                          disabled={isSaving || bulkCreating}
                                        />
                                        <span className="relative w-8 h-4 rounded-full bg-gray-200 border border-gray-300 peer-focus:outline-none peer-checked:bg-[#2E3093] peer-checked:border-[#2E3093] peer-disabled:opacity-60 transition-colors">
                                          <span className="absolute top-[1px] left-[1px] w-3 h-3 rounded-full bg-white border border-gray-300 shadow-sm transition-transform peer-checked:translate-x-4" />
                                        </span>
                                      </label>
                                      <button
                                        type="button"
                                        className={btnPrimarySm}
                                        onClick={() => createStudentAccount(r.Student_Id, r.Roll_No)}
                                        disabled={isSaving || bulkCreating}
                                      >
                                        {isSaving ? 'Saving…' : hasAccount ? 'Update' : 'Create'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {studentRows.length === 0 && !studentLoading && (
                              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No students found in this batch</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
