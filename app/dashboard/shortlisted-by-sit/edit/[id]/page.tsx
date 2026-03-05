'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ---- shared classes (consultancy style) ---- */
const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
        <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">{icon}</span>
          {title}
        </h3>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

interface Course { Course_Id: number; Course_Name: string; }
interface Company { Const_Id: number; Comp_Name: string; }
interface Batch { Batch_Id: number; Batch_Code: string; Course_Id: number; }

interface BatchRow {
  _key: string;
  CompReqBatchId?: number;
  BatchId: number | null;
}

const emptyBatchRow = (): BatchRow => ({
  _key: Math.random().toString(36).slice(2),
  BatchId: null,
});

export default function EditShortlistedBySitPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('shortlisted_sit');

  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);

  // Form state
  const [companyId, setCompanyId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [profile, setProfile] = useState('');
  const [location, setLocation] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [isPassStudents, setIsPassStudents] = useState(0);
  const [postedDate, setPostedDate] = useState('');
  const [batchRows, setBatchRows] = useState<BatchRow[]>([emptyBatchRow()]);

  // Filtered batches based on selected course
  const filteredBatches = courseId
    ? allBatches.filter(b => b.Course_Id === Number(courseId))
    : allBatches;

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await fetch('/api/placement/shortlisted-by-sit?page=1&limit=1');
      const data = await res.json();
      setCourses(data.courses ?? []);
      setCompanies(data.companies ?? []);
      setAllBatches(data.batches ?? []);
    } catch { /* ignore */ }
  }, []);

  const fetchRecord = useCallback(async () => {
    setLoadingRecord(true);
    try {
      const res = await fetch(`/api/placement/shortlisted-by-sit?id=${id}`);
      const data = await res.json();
      if (data.record) {
        const r = data.record;
        setCompanyId(String(r.CompanyId || ''));
        setCourseId(String(r.CourseId || ''));
        setProfile(r.Profile || '');
        setLocation(r.Location || '');
        setEligibility(r.Eligibility || '');
        setResponsibility(r.Responsibility || '');
        setIsPassStudents(r.IsPassStudents || 0);
        setPostedDate(r.PostedDate || '');

        if (data.children && data.children.length > 0) {
          setBatchRows(
            data.children.map((c: { CompReqBatchId: number; BatchId: number }) => ({
              _key: Math.random().toString(36).slice(2),
              CompReqBatchId: c.CompReqBatchId,
              BatchId: c.BatchId,
            }))
          );
        }
      }
    } catch { /* ignore */ } finally { setLoadingRecord(false); }
  }, [id]);

  useEffect(() => { fetchDropdowns(); fetchRecord(); }, [fetchDropdowns, fetchRecord]);

  const handleSubmit = async () => {
    if (!companyId || !courseId) {
      alert('Company and Course are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/placement/shortlisted-by-sit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CompReqId: Number(id),
          CompanyId: Number(companyId),
          CourseId: Number(courseId),
          Profile: profile || null,
          Location: location || null,
          Eligibility: eligibility || null,
          Responsibility: responsibility || null,
          IsPassStudents: isPassStudents,
          PostedDate: postedDate || null,
          batches: batchRows.filter(b => b.BatchId).map(b => ({
            CompReqBatchId: b.CompReqBatchId || undefined,
            BatchId: b.BatchId,
          })),
        }),
      });
      if (res.ok) {
        router.push('/dashboard/shortlisted-by-sit');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update');
      }
    } catch { alert('Network error'); } finally { setSaving(false); }
  };

  const updateBatchRow = (key: string, field: keyof BatchRow, value: unknown) => {
    setBatchRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
  };
  const addBatchRow = () => setBatchRows(prev => [...prev, emptyBatchRow()]);
  const removeBatchRow = (key: string) => setBatchRows(prev => prev.length > 1 ? prev.filter(r => r._key !== key) : prev);

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit Shortlisted By SIT records." />;

  if (loadingRecord) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          Loading record...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex flex-col">
      {/* Header */}
      <div className="mb-4 flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span>Dashboard</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span>Placement</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <button onClick={() => router.push('/dashboard/shortlisted-by-sit')} className="hover:text-[#2E3093] transition-colors">Shortlisted By SIT</button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-[#2E3093] font-medium">Edit</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Edit Shortlisted By SIT</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/dashboard/shortlisted-by-sit')}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-50">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            )}
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto min-h-0 space-y-3">
        {/* Company Requirement Details */}
        <SectionCard
          title="Requirement Details"
          icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
            <div>
              <label className={labelCls}>Company *</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={selectCls}>
                <option value="">-- Select Company --</option>
                {companies.map(c => <option key={c.Const_Id} value={c.Const_Id}>{c.Comp_Name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Course *</label>
              <select value={courseId} onChange={e => setCourseId(e.target.value)} className={selectCls}>
                <option value="">-- Select Course --</option>
                {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Posted Date</label>
              <input type="date" value={postedDate} onChange={e => setPostedDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Profile</label>
              <input type="text" value={profile} onChange={e => setProfile(e.target.value)} placeholder="Job profile" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Job location" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Pass Students Only</label>
              <select value={isPassStudents} onChange={e => setIsPassStudents(Number(e.target.value))} className={selectCls}>
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Eligibility</label>
              <input type="text" value={eligibility} onChange={e => setEligibility(e.target.value)} placeholder="Eligibility criteria" className={inputCls} />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Responsibility</label>
              <input type="text" value={responsibility} onChange={e => setResponsibility(e.target.value)} placeholder="Job responsibilities" className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Batch Details */}
        <SectionCard
          title="Batch Details"
          icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>}
        >
          <div className="space-y-2">
            {batchRows.map((row, idx) => (
              <div key={row._key} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-6 text-right">{idx + 1}.</span>
                <select
                  value={row.BatchId ?? ''}
                  onChange={e => updateBatchRow(row._key, 'BatchId', e.target.value ? Number(e.target.value) : null)}
                  className={selectCls + ' max-w-xs'}
                >
                  <option value="">-- Select Batch --</option>
                  {filteredBatches.map(b => <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_Code}</option>)}
                </select>
                <button onClick={() => removeBatchRow(row._key)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Remove">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <button onClick={addBatchRow}
              className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#2E3093] hover:text-[#2A6BB5] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Batch
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
