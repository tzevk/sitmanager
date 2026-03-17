'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Job {
  Job_Id: number;
  Company_Name: string;
  Company_Email: string;
  Job_Title: string;
  Location: string;
  Package: string;
  Status: string;
  Application_Deadline: string;
  Created_Date: string;
  application_count: number;
  Token: string;
}

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-green-100 text-green-700',
  Closed: 'bg-red-100 text-red-700',
  Completed: 'bg-blue-100 text-blue-700',
};

export default function PlacementJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        const res = await fetch(`/api/placement/jobs?${params}`);
        const data = await res.json();
        if (active) {
          setJobs(data.rows ?? []);
          setTotalPages(data.pagination?.totalPages ?? 1);
        }
      } catch { /* silent */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [page, search, statusFilter, refreshKey]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this job posting?')) return;
    await fetch(`/api/placement/jobs/${id}`, { method: 'DELETE' });
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Placement — Job Postings</h2>
            <p className="text-xs text-white/70">Manage company requirements and job openings</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/dashboard/placement/email-company')}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Company
            </button>
            <button onClick={() => router.push('/dashboard/placement/jobs/add')}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Job Posting
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex gap-3 items-center">
          <input
            type="text" placeholder="Search company or title..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]"
          />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]">
            <option value="">All Status</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No job postings found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Company</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Job Title</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Location</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Package</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Deadline</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Applicants</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Status</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[11px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((j) => (
                  <tr key={j.Job_Id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{j.Company_Name || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-700">{j.Job_Title || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{j.Location || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{j.Package || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {j.Application_Deadline ? new Date(j.Application_Deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#2E3093]/10 text-[#2E3093] font-bold text-xs">
                        {j.application_count}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[j.Status] || 'bg-gray-100 text-gray-600'}`}>
                        {j.Status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => router.push(`/dashboard/placement/screening/${j.Job_Id}`)}
                          title="Screen applicants"
                          className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </button>
                        <button onClick={() => router.push(`/dashboard/placement/jobs/${j.Job_Id}`)}
                          title="Edit job"
                          className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(j.Job_Id)}
                          title="Delete"
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/company/submit-jd/${j.Token}`); alert('JD submission link copied!'); }}
                          title="Copy JD link"
                          className="p-1.5 rounded-md hover:bg-green-50 text-green-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-3 py-1 text-xs font-semibold rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="px-3 py-1 text-xs font-semibold rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
