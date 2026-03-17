'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Assignment {
  Take_Id: number;
  Take_Dt: string;
  Topic: string;
  Lecture_Name: string;
  Duration: string;
  ClassRoom: string;
  Faculty_Name: string;
  received: number;
  was_present: number;
}

interface AssignmentsData {
  summary: {
    total_given: number;
    received: number;
    pending: number;
    percentage: number;
  };
  assignments: Assignment[];
}

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const [data, setData] = useState<AssignmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'received' | 'pending'>('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student-portal/assignments');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const json = await res.json();
        setData(json);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = data?.summary ?? { total_given: 0, received: 0, pending: 0, percentage: 0 };
  const assignments = data?.assignments ?? [];

  const filtered = assignments.filter((a) => {
    if (filter === 'received') return a.received === 1;
    if (filter === 'pending') return a.received === 0;
    return true;
  });

  const pctColor = summary.percentage >= 75 ? 'text-green-600' : summary.percentage >= 50 ? 'text-amber-600' : 'text-red-500';
  const pctBg = summary.percentage >= 75 ? 'bg-green-50 border-green-200' : summary.percentage >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">Assignments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track your assignment submissions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-xl border p-4 ${pctBg}`}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Completion</p>
          <p className={`text-3xl font-bold mt-1 ${pctColor}`}>{summary.percentage}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {summary.percentage >= 75 ? 'Good standing' : `${summary.pending} pending`}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Given</p>
          <p className="text-3xl font-bold mt-1 text-blue-600">{summary.total_given}</p>
          <p className="text-xs text-gray-500 mt-1">assignments</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Submitted</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{summary.received}</p>
          <p className="text-xs text-gray-500 mt-1">completed</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Pending</p>
          <p className="text-3xl font-bold mt-1 text-orange-600">{summary.pending}</p>
          <p className="text-xs text-gray-500 mt-1">to submit</p>
        </div>
      </div>

      {/* Filter + List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">All Assignments</h2>
            <p className="text-xs text-gray-400 mt-0.5">{filtered.length} of {assignments.length} shown</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['all', 'received', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all
                  ${filter === f
                    ? 'bg-white text-[#2E3093] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'}`}
              >
                {f === 'all' ? 'All' : f === 'received' ? 'Submitted' : 'Pending'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {assignments.length === 0 ? 'No assignments given yet.' : 'No assignments match this filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Topic</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Faculty</th>
                  <th className="text-center px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Present</th>
                  <th className="text-center px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((a) => (
                  <tr key={a.Take_Id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {a.Take_Dt
                        ? new Date(a.Take_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-900 max-w-[200px] truncate">
                      {a.Topic || a.Lecture_Name || '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[140px] truncate hidden md:table-cell">
                      {a.Faculty_Name || '—'}
                    </td>
                    <td className="px-5 py-3 text-center hidden sm:table-cell">
                      {a.was_present ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Yes</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">No</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {a.received ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Pending
                        </span>
                      )}
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
