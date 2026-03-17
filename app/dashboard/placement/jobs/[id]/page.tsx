'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Course { Course_Id: number; Course_Name: string }
interface Batch  { Batch_Id: number; Batch_code: string; Course_Id: number }

export default function EditJobPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  const [form, setForm] = useState({
    Company_Name: '', Company_Email: '', Job_Title: '', Job_Description: '',
    Requirements: '', Location: '', Package: '', Min_Percentage: '',
    Max_Backlogs: '0', Application_Deadline: '', Status: 'Open',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const fetchJob = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/placement/jobs/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const j = data.job;
      setForm({
        Company_Name: j.Company_Name || '', Company_Email: j.Company_Email || '',
        Job_Title: j.Job_Title || '', Job_Description: j.Job_Description || '',
        Requirements: j.Requirements || '', Location: j.Location || '',
        Package: j.Package || '', Min_Percentage: j.Min_Percentage != null ? String(j.Min_Percentage) : '',
        Max_Backlogs: j.Max_Backlogs != null ? String(j.Max_Backlogs) : '0',
        Application_Deadline: j.Application_Deadline ? String(j.Application_Deadline).slice(0, 10) : '',
        Status: j.Status || 'Open',
      });
      setSelectedCourses(j.Eligible_Courses ? j.Eligible_Courses.split(',').map((c: string) => c.trim()) : []);
      setSelectedBatches(j.Eligible_Batches ? j.Eligible_Batches.split(',').map((b: string) => b.trim()) : []);
      setCourses(data.courses ?? []);
      setBatches(data.batches ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`/api/placement/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, Eligible_Courses: selectedCourses.join(','), Eligible_Batches: selectedBatches.join(',') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      router.push('/dashboard/placement');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" /></div>;

  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
  const inputCls = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const selectCls = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
  const textareaCls = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

  const toggleCourse = (cid: string) => setSelectedCourses(p => p.includes(cid) ? p.filter(c => c !== cid) : [...p, cid]);
  const toggleBatch  = (bid: string) => setSelectedBatches(p => p.includes(bid) ? p.filter(b => b !== bid) : [...p, bid]);

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/dashboard/placement')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Edit Job Posting</h2>
            <p className="text-xs text-white/70">Job #{id}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && <div className="mx-3 mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-600 font-medium">{error}</div>}
        <div className="px-4 py-3 space-y-4">
          {/* Company */}
          <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b"><h3 className="text-[13px] font-bold text-[#2E3093]">Company Details</h3></div>
            <div className="px-3 py-2 grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
              <div><label className={labelCls}>Company Name</label><input type="text" value={form.Company_Name} onChange={e => set('Company_Name', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Email</label><input type="email" value={form.Company_Email} onChange={e => set('Company_Email', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Location</label><input type="text" value={form.Location} onChange={e => set('Location', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Status</label>
                <select value={form.Status} onChange={e => set('Status', e.target.value)} className={selectCls}>
                  <option value="Open">Open</option><option value="Closed">Closed</option><option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>
          {/* Job */}
          <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b"><h3 className="text-[13px] font-bold text-[#2E3093]">Job Details</h3></div>
            <div className="px-3 py-2 grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
              <div><label className={labelCls}>Job Title</label><input type="text" value={form.Job_Title} onChange={e => set('Job_Title', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Package</label><input type="text" value={form.Package} onChange={e => set('Package', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Deadline</label><input type="date" value={form.Application_Deadline} onChange={e => set('Application_Deadline', e.target.value)} className={inputCls} /></div>
              <div className="col-span-2 md:col-span-3"><label className={labelCls}>Description</label><textarea value={form.Job_Description} onChange={e => set('Job_Description', e.target.value)} rows={4} className={textareaCls} /></div>
              <div className="col-span-2 md:col-span-3"><label className={labelCls}>Requirements</label><textarea value={form.Requirements} onChange={e => set('Requirements', e.target.value)} rows={3} className={textareaCls} /></div>
            </div>
          </div>
          {/* Eligibility */}
          <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b"><h3 className="text-[13px] font-bold text-[#2E3093]">Eligibility</h3></div>
            <div className="px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-2">
              <div><label className={labelCls}>Min %</label><input type="number" step="0.01" value={form.Min_Percentage} onChange={e => set('Min_Percentage', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Max Backlogs</label><input type="number" value={form.Max_Backlogs} onChange={e => set('Max_Backlogs', e.target.value)} className={inputCls} /></div>
              <div className="col-span-2">
                <label className={labelCls}>Courses</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {courses.map(c => (
                    <button key={c.Course_Id} type="button" onClick={() => toggleCourse(String(c.Course_Id))}
                      className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${selectedCourses.includes(String(c.Course_Id)) ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'bg-white text-gray-600 border-gray-300'}`}>
                      {c.Course_Name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Batches</label>
                <div className="flex flex-wrap gap-1.5 mt-1 max-h-32 overflow-y-auto">
                  {batches.filter(b => !selectedCourses.length || selectedCourses.includes(String(b.Course_Id))).map(b => (
                    <button key={b.Batch_Id} type="button" onClick={() => toggleBatch(String(b.Batch_Id))}
                      className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${selectedBatches.includes(String(b.Batch_Id)) ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'bg-white text-gray-600 border-gray-300'}`}>
                      {b.Batch_code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md disabled:opacity-50">
              {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              Save Changes
            </button>
            <button type="button" onClick={() => router.push('/dashboard/placement')}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 shadow-sm">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  );
}
