'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Lecture {
  Take_Id: number;
  Take_Dt: string;
  Topic: string;
  Faculty_Name: string;
  present: number;
  Late: number;
}

export default function AttendancePage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [summary, setSummary] = useState({ total_lectures: 0, attended: 0, absent: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student-portal/academics');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const data = await res.json();
        setLectures(data.all_lectures ?? []);
        setSummary(data.attendance ?? { total_lectures: 0, attended: 0, absent: 0, percentage: 0 });
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [router]);

  const filtered = filter === 'all' ? lectures : lectures.filter(l => filter === 'present' ? l.present : !l.present);
  const attColor = summary.percentage >= 75 ? 'text-green-600' : summary.percentage >= 60 ? 'text-amber-600' : 'text-red-500';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_lectures}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Present</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{summary.attended}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Absent</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{summary.absent}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Percentage</p>
          <p className={`text-2xl font-bold mt-1 ${attColor}`}>{summary.percentage}%</p>
        </div>
      </div>

      {/* Filter tabs + table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold text-gray-900">Attendance Records</h2>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['all', 'present', 'absent'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f === 'all' ? `All (${lectures.length})` : f === 'present' ? `Present (${summary.attended})` : `Absent (${summary.absent})`}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Topic</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Faculty</th>
                  <th className="text-center px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((lec, idx) => (
                  <tr key={lec.Take_Id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {lec.Take_Dt ? new Date(lec.Take_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-900 max-w-[220px] truncate">{lec.Topic || '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[160px] truncate hidden md:table-cell">{lec.Faculty_Name || '—'}</td>
                    <td className="px-5 py-3 text-center">
                      {lec.present ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${lec.Late ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {lec.Late ? 'Late' : 'Present'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">Absent</span>
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
