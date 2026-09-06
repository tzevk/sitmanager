'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Notice {
  id: number;
  title: string | null;
  specification: string | null;
  startdate: string | null;
  enddate: string | null;
  created_date: string | null;
}

function fmtDate(d: string | null) {
  if (!d) return '';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StudentNoticesPage() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student-portal/notices');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const json = await res.json();
        setNotices(Array.isArray(json?.notices) ? json.notices : []);
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

  return (
    <div className="pb-4">
      {/* Hero */}
      <div className="bg-[#2E3093] px-5 pt-6 pb-8">
        <p className="text-white/40 text-[11px] font-medium uppercase tracking-widest">Notice Board</p>
        <p className="text-2xl font-black text-white leading-none mt-1">{notices.length} Announcement{notices.length === 1 ? '' : 's'}</p>
      </div>

      <div className="px-4 -mt-3">
        {notices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-10 text-center text-sm text-gray-400">
            No announcements right now
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((n) => (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-100 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#2A6BB5]/60" />
                <p className="text-sm font-bold text-gray-800">{n.title || 'Announcement'}</p>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed whitespace-pre-wrap">{n.specification}</p>
                {(n.startdate || n.enddate) && (
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-[#2A6BB5] font-semibold uppercase tracking-wider">
                    {n.startdate && <span>{fmtDate(n.startdate)}</span>}
                    {n.enddate && <span>{n.startdate ? '→ ' : 'Until '}{fmtDate(n.enddate)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
