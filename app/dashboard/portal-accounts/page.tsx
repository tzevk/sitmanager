'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type Tab = 'trainer' | 'student';

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

  const [tab, setTab] = useState<Tab>('trainer');

  const [trainerForm, setTrainerForm] = useState({
    facultyId: '',
    username: '',
    password: '',
    isActive: true,
  });
  const [studentForm, setStudentForm] = useState({
    studentId: '',
    username: '',
    password: '',
    isActive: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string>('');

  const [facultyLoading, setFacultyLoading] = useState(false);
  const [facultyRows, setFacultyRows] = useState<Array<{ Faculty_Id: number; Faculty_Name: string; IsActive?: number | null }>>(
    []
  );
  const [facultyPasswords, setFacultyPasswords] = useState<Record<number, string>>({});

  const labelCls = 'block text-[10px] font-semibold text-gray-600 mb-0.5';
  const inputCls =
    'w-full bg-white border-[1.5px] border-gray-300 rounded px-2 py-2 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400';
  const btnPrimary =
    'px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252773] text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed';
  const btnGhost =
    'px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700';

  const title = useMemo(() => (tab === 'trainer' ? 'Create Trainer Account' : 'Create Student Account'), [tab]);
  const subtitle = useMemo(
    () =>
      tab === 'trainer'
        ? 'Creates or updates a Trainer Portal login (links to faculty_master)'
        : 'Creates or updates a Student Portal login (links to student_master)',
    [tab]
  );

  function slugifyUsernamePart(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 30);
  }

  function suggestUsername(facultyName: string, facultyId: number): string {
    const base = slugifyUsernamePart(facultyName || 'faculty');
    const withId = `${base || 'faculty'}.${facultyId}`;
    return withId.replace(/\.+/g, '.');
  }

  function generatePassword(length = 10): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint8Array(Math.max(1, length));
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  useEffect(() => {
    let alive = true;

    async function loadFaculty() {
      setFacultyLoading(true);
      try {
        const res = await fetch('/api/admin/portal-accounts/faculty', { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to fetch faculty');

        const rows = Array.isArray(data?.rows) ? data.rows : [];
        if (!alive) return;
        setFacultyRows(rows);

        setFacultyPasswords((prev) => {
          const next = { ...prev };
          for (const r of rows) {
            const id = Number(r?.Faculty_Id);
            if (!Number.isFinite(id) || id <= 0) continue;
            if (!next[id]) next[id] = generatePassword(10);
          }
          return next;
        });
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch faculty');
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
  }, [tab, permLoading, canCreate]);

  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to create accounts." />;

  async function submitTrainer() {
    setError('');
    setSuccess('');

    const facultyId = toInt(trainerForm.facultyId);
    if (!facultyId) {
      setError('Faculty ID is required');
      return;
    }
    if (!trainerForm.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!trainerForm.password) {
      setError('Password is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/portal-accounts/trainer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId,
          username: trainerForm.username.trim(),
          password: trainerForm.password,
          isActive: trainerForm.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create trainer account');

      setSuccess(`Trainer account saved for username: ${trainerForm.username.trim()}`);
      setTrainerForm(prev => ({ ...prev, password: '' }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create trainer account');
    } finally {
      setSaving(false);
    }
  }

  async function submitStudent() {
    setError('');
    setSuccess('');

    const studentId = toInt(studentForm.studentId);
    if (!studentId) {
      setError('Student ID is required');
      return;
    }
    if (!studentForm.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!studentForm.password) {
      setError('Password is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/portal-accounts/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          username: studentForm.username.trim(),
          password: studentForm.password,
          isActive: studentForm.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create student account');

      setSuccess(`Student account saved for username: ${studentForm.username.trim()}`);
      setStudentForm(prev => ({ ...prev, password: '' }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create student account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
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
                        <div className="text-[12px] font-bold text-gray-800">Faculty List</div>
                        <div className="text-[11px] text-gray-600">Auto-generated username &amp; password per faculty</div>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {facultyLoading ? 'Loading…' : `${facultyRows.length} faculty`}
                      </div>
                    </div>

                    <div className="overflow-auto">
                      <table className="min-w-[900px] w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <th className="px-3 py-2">Faculty ID</th>
                            <th className="px-3 py-2">Faculty Name</th>
                            <th className="px-3 py-2">Username</th>
                            <th className="px-3 py-2">Password</th>
                            <th className="px-3 py-2 w-[140px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {facultyRows.map((f) => {
                            const facultyId = Number(f.Faculty_Id);
                            const facultyName = String(f.Faculty_Name ?? '').trim();
                            const username = suggestUsername(facultyName, facultyId);
                            const password = facultyPasswords[facultyId] || '';

                            return (
                              <tr key={facultyId} className="border-t border-gray-100 hover:bg-gray-50/40">
                                <td className="px-3 py-2 text-gray-900 font-semibold">{facultyId}</td>
                                <td className="px-3 py-2 text-gray-800">{facultyName || '—'}</td>
                                <td className="px-3 py-2 text-gray-700 font-mono">{username}</td>
                                <td className="px-3 py-2 text-gray-700 font-mono">{password || '—'}</td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    className={btnGhost}
                                    onClick={() => {
                                      setTrainerForm((prev) => ({
                                        ...prev,
                                        facultyId: String(facultyId),
                                        username,
                                        password: password || generatePassword(10),
                                      }));
                                    }}
                                  >
                                    Use
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {!facultyLoading && facultyRows.length === 0 && (
                            <tr>
                              <td className="px-3 py-3 text-gray-500" colSpan={5}>
                                No faculty found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <label className={labelCls}>Faculty ID <span className="text-red-500">*</span></label>
                      <input
                        className={inputCls}
                        value={trainerForm.facultyId}
                        onChange={(e) => setTrainerForm(prev => ({ ...prev, facultyId: e.target.value }))}
                        placeholder="e.g. 123"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelCls}>Username <span className="text-red-500">*</span></label>
                      <input
                        className={inputCls}
                        value={trainerForm.username}
                        onChange={(e) => setTrainerForm(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="trainer_username"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelCls}>Password <span className="text-red-500">*</span></label>
                      <input
                        className={inputCls}
                        value={trainerForm.password}
                        onChange={(e) => setTrainerForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="password"
                        type="password"
                      />
                    </div>
                    <div className="col-span-1 flex items-end gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={trainerForm.isActive}
                          onChange={(e) => setTrainerForm(prev => ({ ...prev, isActive: e.target.checked }))}
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={btnPrimary} onClick={submitTrainer} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Trainer Account'}
                    </button>
                    <button
                      className={btnGhost}
                      type="button"
                      onClick={() => setTrainerForm({ facultyId: '', username: '', password: '', isActive: true })}
                      disabled={saving}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <label className={labelCls}>Student ID <span className="text-red-500">*</span></label>
                      <input
                        className={inputCls}
                        value={studentForm.studentId}
                        onChange={(e) => setStudentForm(prev => ({ ...prev, studentId: e.target.value }))}
                        placeholder="e.g. 456"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelCls}>Username <span className="text-red-500">*</span></label>
                      <input
                        className={inputCls}
                        value={studentForm.username}
                        onChange={(e) => setStudentForm(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="student_username"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelCls}>Password <span className="text-red-500">*</span></label>
                      <input
                        className={inputCls}
                        value={studentForm.password}
                        onChange={(e) => setStudentForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="password"
                        type="password"
                      />
                    </div>
                    <div className="col-span-1 flex items-end gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={studentForm.isActive}
                          onChange={(e) => setStudentForm(prev => ({ ...prev, isActive: e.target.checked }))}
                        />
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={btnPrimary} onClick={submitStudent} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Student Account'}
                    </button>
                    <button
                      className={btnGhost}
                      type="button"
                      onClick={() => setStudentForm({ studentId: '', username: '', password: '', isActive: true })}
                      disabled={saving}
                    >
                      Clear
                    </button>
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
