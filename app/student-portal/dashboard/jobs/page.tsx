'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Job {
  Job_Id: number;
  Company_Name: string;
  Job_Title: string;
  Location: string;
  Package: string;
  Min_Percentage: number | null;
  Max_Backlogs: number | null;
  Application_Deadline: string;
  Job_Description: string;
  Requirements: string;
  eligible: boolean;
  already_applied: boolean;
  eligibility_reasons: string[];
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/student-portal/jobs');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const data = await res.json();
        if (active) setJobs(data.jobs ?? []);
      } catch { /* silent */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [router, refreshKey]);

  const handleApply = async (jobId: number) => {
    setApplying(jobId);
    try {
      const res = await fetch('/api/student-portal/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Application failed'); return; }
      alert('Application submitted successfully!');
      setRefreshKey(k => k + 1);
    } catch { alert('Application failed'); }
    setApplying(null);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-6 py-4 shadow-md">
        <h1 className="text-base font-bold text-white">Campus Placement Jobs</h1>
        <p className="text-xs text-white/70 mt-0.5">Browse and apply for placement opportunities</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm">No open job postings at the moment.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map(job => (
            <div key={job.Job_Id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all
              ${!job.eligible ? 'border-gray-200 opacity-70' : 'border-gray-200 hover:border-[#2E3093]/30 hover:shadow-md'}`}>
              <div className="px-5 py-3.5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 text-lg font-bold shrink-0">
                  {job.Company_Name?.charAt(0) || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{job.Job_Title}</h3>
                      <p className="text-xs text-gray-500">{job.Company_Name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.already_applied && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Applied</span>}
                      {!job.eligible && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">Not Eligible</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2">
                    {job.Location && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {job.Location}
                      </span>
                    )}
                    {job.Package && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {job.Package}
                      </span>
                    )}
                    {job.Min_Percentage != null && <span className="text-[11px] text-gray-500">Min: {job.Min_Percentage}%</span>}
                    {job.Application_Deadline && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Deadline: {new Date(job.Application_Deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {!job.eligible && job.eligibility_reasons?.length > 0 && (
                    <div className="mt-2 text-[11px] text-red-500">
                      {job.eligibility_reasons.map((r, i) => <div key={i}>• {r}</div>)}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => setSelectedJob(selectedJob?.Job_Id === job.Job_Id ? null : job)}
                      className="px-3 py-1 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                      {selectedJob?.Job_Id === job.Job_Id ? 'Hide Details' : 'View Details'}
                    </button>
                    {job.eligible && !job.already_applied && (
                      <button onClick={() => handleApply(job.Job_Id)} disabled={applying === job.Job_Id}
                        className="px-3 py-1 text-[11px] font-semibold text-white bg-[#2E3093] hover:bg-[#252780] rounded transition-colors disabled:opacity-50 flex items-center gap-1">
                        {applying === job.Job_Id ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                        Apply Now
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {selectedJob?.Job_Id === job.Job_Id && (
                <div className="border-t border-gray-200 px-5 py-3 bg-gray-50/50">
                  {job.Job_Description && (
                    <div className="mb-2">
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Job Description</h4>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{job.Job_Description}</p>
                    </div>
                  )}
                  {job.Requirements && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Requirements</h4>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{job.Requirements}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
