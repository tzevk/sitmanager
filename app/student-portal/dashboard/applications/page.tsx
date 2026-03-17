'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Application {
  Application_Id: number;
  Job_Title: string;
  Company_Name: string;
  Location: string;
  Package: string;
  Status: string;
  Applied_Date: string;
  Screened_Date: string | null;
  Remarks: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  Applied: 'bg-blue-100 text-blue-700',
  Screened: 'bg-purple-100 text-purple-700',
  Shortlisted: 'bg-emerald-100 text-emerald-700',
  Waitlisted: 'bg-amber-100 text-amber-700',
  Rejected: 'bg-red-100 text-red-700',
  Selected: 'bg-green-100 text-green-700',
};

const STATUS_ICONS: Record<string, string> = {
  Applied: '📝',
  Screened: '🔍',
  Shortlisted: '⭐',
  Waitlisted: '⏳',
  Rejected: '❌',
  Selected: '🎉',
};

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/student-portal/applications');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const data = await res.json();
        if (active) setApplications(data.applications ?? []);
      } catch { /* silent */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  return (
    <div className="p-6">
        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-6 py-4 shadow-md mb-5">
          <h1 className="text-base font-bold text-white">My Applications</h1>
          <p className="text-xs text-white/70 mt-0.5">Track your application status and progress</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <p className="text-gray-400 text-sm">You haven&apos;t applied to any jobs yet.</p>
            <Link href="/student-portal/dashboard"
              className="inline-block mt-3 px-4 py-1.5 bg-[#2E3093] text-white text-xs font-semibold rounded-lg hover:bg-[#252780] transition-colors">
              Browse Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => (
              <div key={app.Application_Id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-[#2E3093]/20 hover:shadow-md transition-all">
                <div className="px-5 py-3.5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-lg shrink-0">
                    {STATUS_ICONS[app.Status] || '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900">{app.Job_Title}</h3>
                    <p className="text-xs text-gray-500">{app.Company_Name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {app.Location && <span className="text-[11px] text-gray-400">{app.Location}</span>}
                      {app.Package && <span className="text-[11px] text-gray-400">{app.Package}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[app.Status] || 'bg-gray-100 text-gray-600'}`}>
                      {app.Status}
                    </span>
                    <div className="text-[11px] text-gray-400 mt-1">
                      Applied {new Date(app.Applied_Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-5 pb-3">
                  <div className="flex items-center gap-1.5">
                    {['Applied', 'Screened', 'Shortlisted', 'Selected'].map((step, i) => {
                      const steps = ['Applied', 'Screened', 'Shortlisted', 'Selected'];
                      const currentIdx = steps.indexOf(app.Status);
                      const isRejected = app.Status === 'Rejected';
                      const isWaitlisted = app.Status === 'Waitlisted';
                      const isActive = !isRejected && !isWaitlisted && i <= currentIdx;
                      return (
                        <div key={step} className="flex-1">
                          <div className={`h-1.5 rounded-full transition-colors ${isActive ? 'bg-[#2E3093]' : isRejected ? 'bg-red-200' : 'bg-gray-200'}`} />
                          <p className={`text-[10px] mt-0.5 ${isActive ? 'text-[#2E3093] font-semibold' : 'text-gray-400'}`}>{step}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {app.Remarks && (
                  <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                    <span className="font-semibold">Note:</span> {app.Remarks}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
