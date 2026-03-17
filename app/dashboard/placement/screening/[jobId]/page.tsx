'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Applicant {
  Application_Id: number;
  Student_Id: number;
  Student_Name: string;
  Student_Surname: string;
  Present_Mobile1: string;
  Student_Email: string;
  Course_Name: string;
  Batch_code: string;
  Percentage: number;
  CV_Path: string;
  Status: string;
  Applied_Date: string;
  Cover_Letter: string;
  Remarks: string;
}

interface JobInfo {
  Job_Title: string;
  Company_Name: string;
}

const STATUS_COLORS: Record<string, string> = {
  Applied: 'bg-blue-100 text-blue-700',
  Screened: 'bg-purple-100 text-purple-700',
  Shortlisted: 'bg-emerald-100 text-emerald-700',
  Waitlisted: 'bg-amber-100 text-amber-700',
  Rejected: 'bg-red-100 text-red-700',
  Selected: 'bg-green-100 text-green-700',
};

export default function ScreeningPage() {
  const router = useRouter();
  const { jobId } = useParams();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkAction, setBulkAction] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const [appRes, jobRes] = await Promise.all([
        fetch(`/api/placement/screening/${jobId}?${params}`),
        fetch(`/api/placement/jobs/${jobId}`),
      ]);
      const appData = await appRes.json();
      const jobData = await jobRes.json();
      setApplicants(appData.applicants ?? []);
      setJob(jobData.job ? { Job_Title: jobData.job.Job_Title, Company_Name: jobData.job.Company_Name } : null);
    } catch { /* silent */ }
    setLoading(false);
  }, [jobId, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === applicants.length) setSelected(new Set());
    else setSelected(new Set(applicants.map(a => a.Application_Id)));
  };

  const handleBulkUpdate = async () => {
    if (!bulkAction || selected.size === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/placement/screening/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_ids: Array.from(selected), status: bulkAction }),
      });
      if (!res.ok) throw new Error('Update failed');
      setSelected(new Set());
      setBulkAction('');
      fetchData();
    } catch { alert('Failed to update'); }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/dashboard/placement')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Screen Applicants</h2>
            <p className="text-xs text-white/70">
              {job ? `${job.Job_Title} — ${job.Company_Name}` : `Job #${jobId}`}
            </p>
          </div>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-white text-xs font-semibold bg-white/20 px-2 py-1 rounded-full">{selected.size} selected</span>
              <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                className="bg-white/20 border border-white/30 rounded text-xs text-white px-2 py-1 focus:outline-none">
                <option value="" className="text-gray-800">Action...</option>
                <option value="Screened" className="text-gray-800">Mark Screened</option>
                <option value="Shortlisted" className="text-gray-800">Shortlist</option>
                <option value="Waitlisted" className="text-gray-800">Waitlist</option>
                <option value="Rejected" className="text-gray-800">Reject</option>
                <option value="Selected" className="text-gray-800">Select</option>
              </select>
              <button onClick={handleBulkUpdate} disabled={!bulkAction || saving}
                className="px-3 py-1 bg-white text-[#2E3093] rounded text-xs font-bold hover:bg-white/90 disabled:opacity-50 transition-colors">
                {saving ? 'Updating...' : 'Apply'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 font-semibold">Filter by status:</label>
          <div className="flex gap-1.5">
            {['', 'Applied', 'Screened', 'Shortlisted', 'Waitlisted', 'Rejected', 'Selected'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${statusFilter === s ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-gray-400">{applicants.length} applicant{applicants.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : applicants.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No applicants found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="py-2.5 px-3 w-8">
                    <input type="checkbox" checked={selected.size === applicants.length} onChange={toggleAll}
                      className="rounded border-gray-300 text-[#2E3093] focus:ring-[#2E3093]/30" />
                  </th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Student</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Contact</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Course / Batch</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">%</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Status</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Applied</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">CV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applicants.map(a => (
                  <tr key={a.Application_Id} className={`hover:bg-gray-50 transition-colors ${selected.has(a.Application_Id) ? 'bg-[#2E3093]/5' : ''}`}>
                    <td className="py-2.5 px-3">
                      <input type="checkbox" checked={selected.has(a.Application_Id)} onChange={() => toggleSelect(a.Application_Id)}
                        className="rounded border-gray-300 text-[#2E3093] focus:ring-[#2E3093]/30" />
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      {a.Student_Name} {a.Student_Surname}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      <div>{a.Student_Email || '—'}</div>
                      <div className="text-gray-400">{a.Present_Mobile1 || ''}</div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      <div>{a.Course_Name || '—'}</div>
                      <div className="text-gray-400">{a.Batch_code || ''}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-gray-700">
                      {a.Percentage != null ? `${a.Percentage}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[a.Status] || 'bg-gray-100 text-gray-600'}`}>
                        {a.Status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {a.Applied_Date ? new Date(a.Applied_Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {a.CV_Path ? (
                        <a href={a.CV_Path} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-semibold">View</a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
