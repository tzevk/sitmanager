'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Lecture {
  id: number;
  lecture_no: number | null;
  subject_topic: string | null;
  subject: string | null;
  faculty_name: string | null;
  date: string | null;
  starttime: string | null;
  endtime: string | null;
  duration: string | null;
  class_room: string | null;
  assignment: string | null;
  unit_test: string | null;
  status: string | null;
}

function fmtDate(d: string | null) {
  if (!d) return 'TBD';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

export default function StudentLecturePlanPage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student-portal/lecture-plan');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const json = await res.json();
        setLectures(Array.isArray(json?.lectures) ? json.lectures : []);
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

  const today = new Date().toISOString().slice(0, 10);
  const filtered = lectures.filter((l) => {
    if (filter === 'all') return true;
    const d = l.date ? String(l.date).slice(0, 10) : null;
    if (!d) return filter === 'upcoming';
    return filter === 'upcoming' ? d >= today : d < today;
  });

  return (
    <div className="pb-4">
      {/* Hero */}
      <div className="bg-[#2E3093] px-5 pt-6 pb-8">
        <p className="text-white/40 text-[11px] font-medium uppercase tracking-widest">Lecture Plan</p>
        <p className="text-2xl font-black text-white leading-none mt-1">{lectures.length} Lecture{lectures.length === 1 ? '' : 's'} Scheduled</p>
      </div>

      <div className="px-4 -mt-3">
        <div className="flex items-center gap-1 mb-3 bg-white border border-gray-100 rounded-xl p-1">
          {(['upcoming', 'past', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-colors ${
                filter === f ? 'bg-[#2E3093] text-white' : 'text-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-10 text-center text-sm text-gray-400">
            {lectures.length === 0 ? 'No lecture plan set for your batch yet' : 'Nothing here'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {filtered.map((lec) => (
              <div key={lec.id} className="flex items-start justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {lec.subject_topic || lec.subject || `Lecture ${lec.lecture_no ?? ''}`}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {lec.faculty_name || 'TBD'} · {fmtDate(lec.date)}
                    {lec.starttime && ` · ${lec.starttime}${lec.endtime ? `–${lec.endtime}` : ''}`}
                  </p>
                  {lec.class_room && <p className="text-[11px] text-gray-400 mt-0.5">{lec.class_room}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {lec.assignment === '1' && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#FAE452] text-[#2E3093] rounded-md">ASSGN</span>
                  )}
                  {lec.unit_test === '1' && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#2E3093] text-[#FAE452] rounded-md">TEST</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
