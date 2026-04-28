'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Course { Course_Id: number; Course_Name: string; }
interface Batch { Batch_Id: number; Batch_code: string; Category: string | null; Timings: string | null; }
interface Faculty { Faculty_Id: number; Faculty_Name: string; }
interface AssignmentDef { id: number; assignmentname: string; subjects: string | null; marks: string | null; assignmentdate: string | null; }

interface StudentRow {
  Admission_Id: number;
  Student_Id: number;
  Student_Code: string;
  Student_Name: string;
  row_num: number;
  marks: string;
  status: string;
  actual_dt: string;
}

interface FormData {
  Course_Id: string;
  Batch_Id: string;
  Assignment_Id: string;
  Assign_No: string;
  Marks: string;
  Faculty_Id: string;
  Assign_Dt: string;
  Return_Dt: string;
}

const emptyForm: FormData = {
  Course_Id: '', Batch_Id: '', Assignment_Id: '', Assign_No: '',
  Marks: '', Faculty_Id: '',
  Assign_Dt: new Date().toISOString().slice(0, 10), Return_Dt: '',
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AddAssignmentTakenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = !!editId;

  const { canCreate, canUpdate, loading: permLoading } = useResourcePermissions('assignment');

  const [form, setForm] = useState<FormData>(emptyForm);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [assignmentDefs, setAssignmentDefs] = useState<AssignmentDef[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── Load courses & faculties on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const [cRes, fRes] = await Promise.all([
          fetch('/api/daily-activities/assignments-taken?options=courses'),
          fetch('/api/daily-activities/assignments-taken?options=faculties'),
        ]);
        const cData = await cRes.json();
        const fData = await fRes.json();
        setCourses(cData.courses || []);
        setFaculties(fData.faculties || []);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Load edit data ── */
  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/assignments-taken?id=${editId}`);
        const data = await res.json();
        if (data.assignment) {
          const a = data.assignment;
          const toDateStr = (v: unknown) => {
            if (!v) return '';
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            return String(v).slice(0, 10);
          };
          setForm({
            Course_Id: String(a.Course_Id || ''),
            Batch_Id: String(a.Batch_Id || ''),
            Assignment_Id: String(a.Assignment_Id || ''),
            Assign_No: String(a.Assign_No || ''),
            Marks: String(a.Marks ?? ''),
            Faculty_Id: String(a.Faculty_Id || ''),
            Assign_Dt: toDateStr(a.Assign_Dt),
            Return_Dt: toDateStr(a.Return_Dt),
          });
        }
      } catch { /* ignore */ }
      setLoadingEdit(false);
    })();
  }, [editId]);

  /* ── Load batches when course changes ── */
  useEffect(() => {
    if (!form.Course_Id) { setBatches([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/assignments-taken?options=batches&courseId=${form.Course_Id}`);
        const data = await res.json();
        setBatches(data.batches || []);
      } catch { /* ignore */ }
    })();
  }, [form.Course_Id]);

  /* ── Load assignment definitions when batch changes ── */
  useEffect(() => {
    if (!form.Batch_Id) { setAssignmentDefs([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/assignments-taken?options=assignments&batchId=${form.Batch_Id}`);
        const data = await res.json();
        setAssignmentDefs(data.assignments || []);
      } catch { /* ignore */ }
    })();
  }, [form.Batch_Id]);

  /* ── Load students when batch changes ── */
  useEffect(() => {
    if (!form.Batch_Id) { setStudents([]); return; }
    setStudentsLoading(true);
    (async () => {
      try {
        const givenId = isEdit ? editId : '0';
        const res = await fetch(
          `/api/daily-activities/assignments-taken?options=students&batchId=${form.Batch_Id}&givenId=${givenId}`
        );
        const data = await res.json();
        setStudents(
          (data.students || []).map((s: StudentRow & { existing_marks: string | null; existing_status: string | null; existing_actual_dt: string | null }) => ({
            ...s,
            marks: s.existing_marks != null ? String(s.existing_marks) : '',
            status: s.existing_status || 'Present',
            actual_dt: s.existing_actual_dt ? String(s.existing_actual_dt).slice(0, 10) : '',
          }))
        );
      } catch { /* ignore */ }
      setStudentsLoading(false);
    })();
  }, [form.Batch_Id, editId, isEdit]);

  /* ── Auto-fill from selected assignment definition ── */
  const handleAssignmentSelect = (assignmentId: string) => {
    const def = assignmentDefs.find(a => String(a.id) === assignmentId);
    setForm(prev => ({
      ...prev,
      Assignment_Id: assignmentId,
      Marks: def?.marks || prev.Marks,
      Assign_Dt: def?.assignmentdate ? def.assignmentdate.slice(0, 10) : prev.Assign_Dt,
    }));
  };

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const updateStudent = (idx: number, field: 'marks' | 'status' | 'actual_dt', value: string) => {
    setStudents(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        Course_Id: form.Course_Id ? parseInt(form.Course_Id) : null,
        Batch_Id: form.Batch_Id ? parseInt(form.Batch_Id) : null,
        Assignment_Id: form.Assignment_Id ? parseInt(form.Assignment_Id) : null,
        Assign_No: form.Assign_No ? parseInt(form.Assign_No) : null,
        Marks: form.Marks ? parseInt(form.Marks) : null,
        Faculty_Id: form.Faculty_Id ? parseInt(form.Faculty_Id) : null,
        Assign_Dt: form.Assign_Dt || null,
        Return_Dt: form.Return_Dt || null,
        students: students.map(s => ({
          Student_Id: s.Student_Id,
          marks: s.marks,
          status: s.status,
          actual_dt: s.actual_dt || null,
        })),
      };
      if (isEdit) payload.Given_Id = parseInt(editId!);

      const res = await fetch('/api/daily-activities/assignments-taken', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setSuccess(isEdit ? 'Assignment updated successfully!' : 'Assignment created successfully!');
      if (!isEdit) {
        setTimeout(() => router.push('/dashboard/daily-activities/assignments-taken'), 1200);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  if (permLoading) return <PermissionLoading />;
  if (isEdit && !canUpdate) return <AccessDenied message="You do not have permission to edit assignments." />;
  if (!isEdit && !canCreate) return <AccessDenied message="You do not have permission to create assignments." />;

  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/daily-activities/assignments-taken')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            {isEdit ? 'Edit Assignment' : 'Add Assignment'}
          </h1>
          <p className="text-xs text-gray-400">
            Daily Activities / Assignments Taken / {isEdit ? 'Edit' : 'Add'}
          </p>
        </div>
      </div>

      {loadingEdit ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading assignment details...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </div>
          )}

          {/* ── Assignment Details ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Add Assignment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              {/* Course */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Course Name <span className="text-red-400">*</span></label>
                <select value={form.Course_Id} onChange={set('Course_Id')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">— Select Course —</option>
                  {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                </select>
              </div>

              {/* Batch */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Batch Code <span className="text-red-400">*</span></label>
                <select value={form.Batch_Id} onChange={set('Batch_Id')} required disabled={!form.Course_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  <option value="">— Select Batch —</option>
                  {batches.map(b => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>
                      {b.Batch_code}{b.Category ? ` (${b.Category})` : ''}{b.Timings ? ` — ${b.Timings}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Assignment Name</label>
                <select value={form.Assignment_Id} onChange={e => handleAssignmentSelect(e.target.value)} disabled={!form.Batch_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  <option value="">— Select Assignment —</option>
                  {assignmentDefs.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assignmentname}{a.marks ? ` (${a.marks} marks)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max Marks (read-only) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Max Marks</label>
                <input type="number" value={form.Marks} onChange={set('Marks')} placeholder="e.g. 25"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Assignment Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Assignment Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.Assign_Dt} onChange={set('Assign_Dt')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Return Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Return Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.Return_Dt} onChange={set('Return_Dt')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Assignment No */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Assignment Number <span className="text-red-400">*</span></label>
                <input type="number" value={form.Assign_No} onChange={set('Assign_No')} placeholder="e.g. 1"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Faculty */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Trainer</label>
                <select value={form.Faculty_Id} onChange={set('Faculty_Id')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">— Select Trainer —</option>
                  {faculties.map(f => <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>)}
                </select>
              </div>
            </div>

            {/* Submit buttons */}
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#23257A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {isEdit ? 'Update Assignment' : 'Submit'}
              </button>
              <button type="button" onClick={() => router.push('/dashboard/daily-activities/assignments-taken')}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>

          {/* ── Student Table ── */}
          {form.Batch_Id && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {studentsLoading ? (
                <div className="py-10 flex items-center justify-center gap-2 text-gray-400 text-sm">
                  <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                  Loading students...
                </div>
              ) : students.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No students found for this batch.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100/80">
                    <tr className="text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-4 border-b border-gray-200 w-12">Id</th>
                      <th className="py-3 px-4 border-b border-gray-200 w-36">Student Code</th>
                      <th className="py-3 px-4 border-b border-gray-200">Student Name</th>
                      <th className="py-3 px-4 border-b border-gray-200 w-40">Marks</th>
                      <th className="py-3 px-4 border-b border-gray-200 w-40">Status</th>
                      <th className="py-3 px-4 border-b border-gray-200 w-40">Actual Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s, idx) => (
                      <tr key={s.Student_Id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-2.5 px-4 text-xs text-gray-400">{s.row_num}</td>
                        <td className="py-2.5 px-4">
                          <span className="text-xs font-mono text-gray-700">{s.Student_Code || s.Student_Id}</span>
                        </td>
                        <td className="py-2.5 px-4 text-sm font-medium text-gray-800">{s.Student_Name}</td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            value={s.marks}
                            onChange={e => updateStudent(idx, 'marks', e.target.value)}
                            placeholder="—"
                            min={0}
                            max={form.Marks ? parseInt(form.Marks) : undefined}
                            className="w-full h-8 px-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={s.status}
                            onChange={e => updateStudent(idx, 'status', e.target.value)}
                            className="w-full h-8 px-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white"
                          >
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="date"
                            value={s.actual_dt}
                            onChange={e => updateStudent(idx, 'actual_dt', e.target.value)}
                            className="w-full h-8 px-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </form>
      )}
    </div>
  );
}
