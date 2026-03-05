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
          setForm({
            Course_Id: String(a.Course_Id || ''),
            Batch_Id: String(a.Batch_Id || ''),
            Assignment_Id: String(a.Assignment_Id || ''),
            Assign_No: String(a.Assign_No || ''),
            Marks: String(a.Marks || ''),
            Faculty_Id: String(a.Faculty_Id || ''),
            Assign_Dt: a.Assign_Dt || '',
            Return_Dt: a.Return_Dt || '',
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

  /* ── Auto-fill from selected assignment definition ── */
  const handleAssignmentSelect = (assignmentId: string) => {
    setForm(prev => ({ ...prev, Assignment_Id: assignmentId }));
    const def = assignmentDefs.find(a => String(a.id) === assignmentId);
    if (def) {
      setForm(prev => ({
        ...prev,
        Assignment_Id: assignmentId,
        Marks: def.marks || prev.Marks,
        Assign_Dt: def.assignmentdate || prev.Assign_Dt,
      }));
    }
  };

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

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

          {/* ── Core Details ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Assignment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Course */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Course <span className="text-red-400">*</span></label>
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

              {/* Assignment Definition */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Assignment</label>
                <select value={form.Assignment_Id} onChange={(e) => handleAssignmentSelect(e.target.value)} disabled={!form.Batch_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  <option value="">— Select Assignment —</option>
                  {assignmentDefs.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.assignmentname}{a.marks ? ` (${a.marks} marks)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Assignment Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.Assign_Dt} onChange={set('Assign_Dt')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Return Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Return Date</label>
                <input type="date" value={form.Return_Dt} onChange={set('Return_Dt')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Marks */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Marks</label>
                <input type="number" value={form.Marks} onChange={set('Marks')} placeholder="e.g. 25"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Faculty */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Faculty</label>
                <select value={form.Faculty_Id} onChange={set('Faculty_Id')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">— Select Faculty —</option>
                  {faculties.map(f => <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>)}
                </select>
              </div>

              {/* Assignment No */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Assignment No.</label>
                <input type="number" value={form.Assign_No} onChange={set('Assign_No')} placeholder="e.g. 1"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>
            </div>
          </div>

          {/* ── Submit ── */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#23257A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {isEdit ? 'Update Assignment' : 'Save Assignment'}
            </button>
            <button type="button" onClick={() => router.push('/dashboard/daily-activities/assignments-taken')}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
