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
interface MocDef { id: number; subject: string; marks: string | null; date: string | null; }

interface FormData {
  Course_Id: string;
  Batch_Id: string;
  Moc_Id: string;
  vivamocname: string;
  marks: string;
  date: string;
}

const emptyForm: FormData = {
  Course_Id: '', Batch_Id: '', Moc_Id: '',
  vivamocname: '',
  marks: '',
  date: new Date().toISOString().slice(0, 10),
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AddVivaMocTakenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = !!editId;

  const { canCreate, canUpdate, loading: permLoading } = useResourcePermissions('viva_moc');

  const [form, setForm] = useState<FormData>(emptyForm);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [mocDefs, setMocDefs] = useState<MocDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── Load courses on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/daily-activities/viva-moc-taken?options=courses');
        const data = await res.json();
        setCourses(data.courses || []);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Load edit data ── */
  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/viva-moc-taken?id=${editId}`);
        const data = await res.json();
        if (data.vivaMoc) {
          const a = data.vivaMoc;
          setForm({
            Course_Id: String(a.Course_Id || ''),
            Batch_Id: String(a.Batch_Id || a.batchcode || ''),
            Moc_Id: '',
            vivamocname: a.vivamocname || '',
            marks: String(a.marks || ''),
            date: a.date ? a.date.slice(0, 10) : '',
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
        const res = await fetch(`/api/daily-activities/viva-moc-taken?options=batches&courseId=${form.Course_Id}`);
        const data = await res.json();
        setBatches(data.batches || []);
      } catch { /* ignore */ }
    })();
  }, [form.Course_Id]);

  /* ── Load moc definitions when batch changes ── */
  useEffect(() => {
    if (!form.Batch_Id) { setMocDefs([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/viva-moc-taken?options=mocs&batchId=${form.Batch_Id}`);
        const data = await res.json();
        setMocDefs(data.mocs || []);
      } catch { /* ignore */ }
    })();
  }, [form.Batch_Id]);

  /* ── Auto-fill from selected moc definition ── */
  const handleMocSelect = (mocId: string) => {
    setForm(prev => ({ ...prev, Moc_Id: mocId }));
    const def = mocDefs.find(t => String(t.id) === mocId);
    if (def) {
      setForm(prev => ({
        ...prev,
        Moc_Id: mocId,
        vivamocname: def.subject || prev.vivamocname,
        marks: def.marks || prev.marks,
        date: def.date ? def.date.slice(0, 10) : prev.date,
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
        batchcode: form.Batch_Id || null,
        vivamocname: form.vivamocname || null,
        marks: form.marks || null,
        date: form.date || null,
      };
      if (isEdit) payload.id = parseInt(editId!);

      const res = await fetch('/api/daily-activities/viva-moc-taken', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setSuccess(isEdit ? 'Viva/MOC record updated successfully!' : 'Viva/MOC record created successfully!');
      if (!isEdit) {
        setTimeout(() => router.push('/dashboard/daily-activities/viva-moc-taken'), 1200);
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
  if (isEdit && !canUpdate) return <AccessDenied message="You do not have permission to edit Viva/MOC records." />;
  if (!isEdit && !canCreate) return <AccessDenied message="You do not have permission to create Viva/MOC records." />;

  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/daily-activities/viva-moc-taken')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            {isEdit ? 'Edit Viva / MOC' : 'Add Viva / MOC'}
          </h1>
          <p className="text-xs text-gray-400">
            Daily Activities / Viva / MOC Taken / {isEdit ? 'Edit' : 'Add'}
          </p>
        </div>
      </div>

      {loadingEdit ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading Viva/MOC details...</span>
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
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Viva / MOC Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Course Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Course Name <span className="text-red-400">*</span></label>
                <select value={form.Course_Id} onChange={set('Course_Id')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">Select</option>
                  {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                </select>
              </div>

              {/* Batch Code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Batch Code <span className="text-red-400">*</span></label>
                <select value={form.Batch_Id} onChange={set('Batch_Id')} required disabled={!form.Course_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  <option value="">-Select Batch Code-</option>
                  {batches.map(b => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>
                      {b.Batch_code}{b.Category ? ` (${b.Category})` : ''}{b.Timings ? ` — ${b.Timings}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Viva/Moc Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Viva/Moc Name <span className="text-red-400">*</span></label>
                <select value={form.Moc_Id} onChange={(e) => handleMocSelect(e.target.value)} required disabled={!form.Batch_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  <option value="">--Select--</option>
                  {mocDefs.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.subject}{m.marks ? ` (${m.marks} marks)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max Marks */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Max Marks</label>
                <input type="text" value={form.marks} onChange={set('marks')} placeholder="Max Marks"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.date} onChange={set('date')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>
            </div>
          </div>

          {/* ── Submit / Cancel ── */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#23257A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Submit
            </button>
            <button type="button" onClick={() => router.push('/dashboard/daily-activities/viva-moc-taken')}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
