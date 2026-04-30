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

interface AssignmentMark {
  assignmentname: string | null;
  subjects: string | null;
  Assign_Dt: string | null;
  Return_Dt: string | null;
  Marks: number | null;
  MaxMarks: number | null;
  Status: string | null;
}

interface AssignmentsData {
  summary: { total_given: number; received: number; pending: number; percentage: number };
  assignments: Assignment[];
  marks: AssignmentMark[];
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = data?.summary ?? { total_given: 0, received: 0, pending: 0, percentage: 0 };
  const assignments = data?.assignments ?? [];
  const marks = data?.marks ?? [];
  const filtered = assignments.filter(a =>
    filter === 'received' ? a.received === 1 : filter === 'pending' ? a.received === 0 : true
  );

  return (
    <div className="pb-4">

      {/* Hero */}
      <div className="bg-[#2E3093] px-5 pt-6 pb-10">
        <p className="text-white/40 text-[11px] font-medium uppercase tracking-widest">Assignments</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-6xl font-black text-white leading-none">{summary.received}</p>
          <p className="text-2xl font-black text-white/30 mb-1">/ {summary.total_given}</p>
        </div>
        <div className="mt-4 h-[3px] bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#FAE452] rounded-full" style={{ width: `${summary.percentage}%` }} />
        </div>
        <p className="text-white/40 text-[11px] mt-1.5">
          {summary.percentage}% submitted{summary.pending > 0 ? ` · ${summary.pending} pending` : ' · all done'}
        </p>
      </div>

      {/* Stats strip */}
      <div className="px-4 -mt-5 grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: summary.total_given, color: 'text-gray-900' },
          { label: 'Submitted', value: summary.received, color: 'text-green-600' },
          { label: 'Pending', value: summary.pending, color: 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter + list */}
      <div className="px-4 mt-4">
        <div className="flex items-center gap-1 mb-3 bg-white border border-gray-100 rounded-xl p-1">
          {(['all', 'received', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                filter === f ? 'bg-[#2E3093] text-white' : 'text-gray-400'
              }`}
            >
              {f === 'all' ? 'All' : f === 'received' ? 'Submitted' : 'Pending'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-10 text-center text-sm text-gray-400">
            {assignments.length === 0 ? 'No assignments yet' : 'No assignments match'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {filtered.map(a => (
              <div key={a.Take_Id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {a.Topic || a.Lecture_Name || 'Assignment'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {a.Faculty_Name || '—'}
                    {a.Take_Dt && ` · ${new Date(a.Take_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                  a.received ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
                }`}>
                  {a.received ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marks */}
      {marks.length > 0 && (
        <div className="px-4 mt-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Marks</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {marks.map((m, idx) => {
              const scored = m.Marks ?? null;
              const max = m.MaxMarks ?? null;
              const pct = scored !== null && max ? Math.round((scored / max) * 100) : null;
              return (
                <div key={idx} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{m.assignmentname || '—'}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {m.subjects || '—'}
                      {m.Assign_Dt && ` · ${new Date(m.Assign_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {scored !== null ? (
                      <>
                        <p className={`text-sm font-black ${pct !== null && pct >= 60 ? 'text-[#2E3093]' : 'text-red-500'}`}>
                          {scored}{max ? `/${max}` : ''}
                        </p>
                        {pct !== null && <p className="text-[10px] text-gray-400">{pct}%</p>}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
