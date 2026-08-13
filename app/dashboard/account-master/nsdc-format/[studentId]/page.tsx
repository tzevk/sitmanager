'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { GhostBtn, PageHeader } from '@/components/ui/PageHeader';

interface NsdcStudent {
  Student_Id: number;
  Student_Name: string;
  Father_Name: string | null;
  Mother_Name: string | null;
  Sex: string | null;
  DOB: string | null;
  Aadhar_Number: string | null;
  Social_Category: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Present_Address: string | null;
  Present_City: string | null;
  Present_State: string | null;
  Present_Pin: string | null;
  Qualification: string | null;
  Batch_Code: string | null;
  Admission_Dt: string | null;
  Course_Name: string | null;
}

type EditableField = 'Father_Name' | 'Mother_Name' | 'Sex' | 'DOB' | 'Aadhar_Number' | 'Social_Category'
  | 'Present_Mobile' | 'Email' | 'Present_Address' | 'Present_City' | 'Present_State' | 'Present_Pin' | 'Qualification';

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] placeholder:text-slate-400 transition-colors w-full';

export default function NsdcFormatEditPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router = useRouter();
  const perms = useResourcePermissions('nsdc_format');
  const { loading: permLoading, canView, canUpdate } = perms;

  const [student, setStudent] = useState<NsdcStudent | null>(null);
  const [socialCategories, setSocialCategories] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<EditableField, string>>({} as Record<EditableField, string>);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const fetchStudent = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/account-master/nsdc-format/${studentId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load student');
      setStudent(data.student);
      setSocialCategories(Array.isArray(data.socialCategories) ? data.socialCategories : []);
      setDraft({
        Father_Name: data.student.Father_Name || '',
        Mother_Name: data.student.Mother_Name || '',
        Sex: data.student.Sex || '',
        DOB: data.student.DOB || '',
        Aadhar_Number: data.student.Aadhar_Number || '',
        Social_Category: data.student.Social_Category || '',
        Present_Mobile: data.student.Present_Mobile || '',
        Email: data.student.Email || '',
        Present_Address: data.student.Present_Address || '',
        Present_City: data.student.Present_City || '',
        Present_State: data.student.Present_State || '',
        Present_Pin: data.student.Present_Pin || '',
        Qualification: data.student.Qualification || '',
      });
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (canView) fetchStudent();
  }, [canView, fetchStudent]);

  const updateField = (field: EditableField, value: string) => setDraft((prev) => ({ ...prev, [field]: value }));

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const res = await fetch(`/api/account-master/nsdc-format/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setSaveSuccess('Saved.');
      await fetchStudent();
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [studentId, draft, fetchStudent]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view NSDC Format." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={student ? `NSDC Format — ${student.Student_Name}` : 'NSDC Format'}
        breadcrumbs={[{ label: 'Admin/Accounts' }, { label: 'NSDC Format', href: '/dashboard/account-master/nsdc-format' }, { label: 'Edit' }]}
        action={<GhostBtn href="/dashboard/account-master/nsdc-format">Back To List</GhostBtn>}
      />

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center text-sm text-slate-400">Loading…</div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      ) : student ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Student ID</span>
              <p className="text-sm text-slate-700">{student.Student_Id}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Candidate Name</span>
              <p className="text-sm text-slate-700">{student.Student_Name}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Course / Batch Code</span>
              <p className="text-sm text-slate-700">{student.Course_Name || '—'} {student.Batch_Code ? `(${student.Batch_Code})` : ''}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Candidate name, course, and batch are managed on the Student admission page — this screen edits the NSDC-specific fields below.</p>

          <div className="grid gap-3 md:grid-cols-3 pt-2 border-t border-slate-100">
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Father&apos;s Name</span>
              <input value={draft.Father_Name} onChange={(e) => updateField('Father_Name', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Mother&apos;s Name</span>
              <input value={draft.Mother_Name} onChange={(e) => updateField('Mother_Name', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Gender</span>
              <select value={draft.Sex} onChange={(e) => updateField('Sex', e.target.value)} className={ctrl} disabled={!canUpdate || saving}>
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Date of Birth</span>
              <input value={draft.DOB} onChange={(e) => updateField('DOB', e.target.value)} placeholder="DD/MM/YYYY" className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Aadhar Number</span>
              <input value={draft.Aadhar_Number} onChange={(e) => updateField('Aadhar_Number', e.target.value)} maxLength={20} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Social Category</span>
              <select value={draft.Social_Category} onChange={(e) => updateField('Social_Category', e.target.value)} className={ctrl} disabled={!canUpdate || saving}>
                <option value="">Select…</option>
                {socialCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Mobile</span>
              <input value={draft.Present_Mobile} onChange={(e) => updateField('Present_Mobile', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Email</span>
              <input value={draft.Email} onChange={(e) => updateField('Email', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Qualification</span>
              <input value={draft.Qualification} onChange={(e) => updateField('Qualification', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label className="md:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Address</span>
              <input value={draft.Present_Address} onChange={(e) => updateField('Present_Address', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">City</span>
              <input value={draft.Present_City} onChange={(e) => updateField('Present_City', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">State</span>
              <input value={draft.Present_State} onChange={(e) => updateField('Present_State', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
            <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Pincode</span>
              <input value={draft.Present_Pin} onChange={(e) => updateField('Present_Pin', e.target.value)} className={ctrl} disabled={!canUpdate || saving} /></label>
          </div>

          {!canUpdate && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">View-only — editing requires update permission.</p>}
          {saveError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</p>}
          {saveSuccess && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{saveSuccess}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => router.push('/dashboard/account-master/nsdc-format')} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={!canUpdate || saving} className="px-5 py-2 rounded-lg bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#6366F1]/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
