'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  faculty: { Faculty_Name: string; EMail: string; Mobile: string; Specialization: string };
  batches: { Batch_Id: number; Batch_code: string }[];
  total_lectures: number;
  recent_lectures: { Take_Id: number; Take_Dt: string; Topic: string; Batch_code: string; student_present: number }[];
  this_month_attendance: number;
  today_attendance: { Check_In: string; Check_Out: string; Status: string } | null;
}

export default function TrainerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trainer-portal/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load dashboard.</p>;

  const stats = [
    {
      label: 'Total Lectures',
      value: data.total_lectures,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      bg: '#2E3093',
    },
    {
      label: 'Batches Assigned',
      value: data.batches.length,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      bg: '#2A6BB5',
    },
    {
      label: 'This Month Attendance',
      value: `${data.this_month_attendance} days`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: '#16a34a',
    },
    {
      label: "Today's Status",
      value: data.today_attendance ? data.today_attendance.Status : 'Not Checked In',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: data.today_attendance ? '#2E3093' : '#dc2626',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 md:p-8 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2E3093 0%, #2A6BB5 100%)' }}
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10" style={{ background: '#FAE452' }} />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">Welcome, {data.faculty.Faculty_Name}</h1>
          <p className="text-blue-100 text-sm md:text-base">
            {data.faculty.Specialization && <span>{data.faculty.Specialization} &bull; </span>}
            {data.faculty.EMail}
          </p>
          {data.today_attendance && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Checked in at {data.today_attendance.Check_In?.slice(0, 5)}
              {data.today_attendance.Check_Out && ` — Out at ${data.today_attendance.Check_Out.slice(0, 5)}`}
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: s.bg }}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent lectures */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Recent Lectures</h2>
            <a href="/trainer-portal/dashboard/daily-lecture" className="text-sm font-medium" style={{ color: '#2A6BB5' }}>View All</a>
          </div>
          {data.recent_lectures.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No lectures found</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recent_lectures.map(l => (
                <div key={l.Take_Id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: '#2E3093' }}>
                    {new Date(l.Take_Dt).getDate()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.Topic || 'Untitled'}</p>
                    <p className="text-xs text-gray-500">{l.Batch_code} &bull; {new Date(l.Take_Dt).toLocaleDateString()}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(42,107,181,0.1)', color: '#2A6BB5' }}>
                    {l.student_present} present
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Batches assigned */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Your Batches</h2>
          </div>
          {data.batches.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No batches assigned</div>
          ) : (
            <div className="p-4 space-y-2">
              {data.batches.map(b => (
                <div key={b.Batch_Id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#2A6BB5' }}>
                    {b.Batch_code?.charAt(0) || 'B'}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{b.Batch_code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
