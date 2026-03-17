'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AcademicsData {
  student: {
    student_id: number;
    student_name: string;
    email: string;
    mobile: string;
    course_name: string;
    batch_code: string;
    batch_timings: string;
    batch_start: string;
    batch_end: string;
    percentage: string;
  };
  attendance: {
    total_lectures: number;
    attended: number;
    absent: number;
    percentage: number;
  };
  assignments: {
    total_given: number;
    received: number;
    pending: number;
    percentage: number;
  };
  recent_assignments: Array<{
    Take_Id: number;
    Take_Dt: string;
    Topic: string;
    Faculty_Name: string;
    received: number;
  }>;
  recent_lectures: Array<{
    Take_Id: number;
    Take_Dt: string;
    Topic: string;
    Faculty_Name: string;
    present: number;
    Late: number;
  }>;
  upcoming_lectures: Array<{
    id: number;
    lecture_no: number;
    subject_topic: string;
    subject: string;
    faculty_name: string;
    date: string;
    starttime: string;
    endtime: string;
    assignment: string;
    unit_test: string;
  }>;
  exam_results: Array<{
    Take_Id: number;
    Test_Dt: string;
    Test_No: string;
    Marks: string;
  }>;
}

/* Animated donut ring */
function ProgressRing({ percentage, size = 110, strokeWidth = 10, color, trackColor = '#e5e7eb' }: {
  percentage: number; size?: number; strokeWidth?: number; color: string; trackColor?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = r * 2 * Math.PI;
  const offset = circ - (percentage / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle stroke={trackColor} fill="transparent" strokeWidth={strokeWidth} r={r} cx={size / 2} cy={size / 2} />
      <circle
        stroke={color} fill="transparent" strokeWidth={strokeWidth}
        strokeDasharray={`${circ} ${circ}`}
        style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
        strokeLinecap="round" r={r} cx={size / 2} cy={size / 2}
      />
    </svg>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AcademicsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student-portal/academics');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const json = await res.json();
        setData(json);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const att = data?.attendance ?? { total_lectures: 0, attended: 0, absent: 0, percentage: 0 };
  const assign = data?.assignments ?? { total_given: 0, received: 0, pending: 0, percentage: 0 };
  const recentAssignments = data?.recent_assignments ?? [];
  const student = data?.student;
  const recentLectures = data?.recent_lectures ?? [];
  const upcoming = data?.upcoming_lectures ?? [];
  const exams = data?.exam_results ?? [];

  const attColor = att.percentage >= 75 ? '#22c55e' : att.percentage >= 60 ? '#f59e0b' : '#ef4444';
  const assignColor = assign.percentage >= 75 ? '#22c55e' : assign.percentage >= 50 ? '#f59e0b' : '#ef4444';
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  })();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Hero welcome */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg, #1a1d5e 0%, #2E3093 30%, #2A6BB5 70%, #3b82f6 100%)' }}
      >
        {/* Decorative shapes */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FAE452]/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 blur-2xl" />
        <div className="absolute top-6 right-8 w-16 h-16 border border-white/10 rounded-2xl rotate-12 hidden sm:block" />
        <div className="absolute bottom-4 right-32 w-10 h-10 border border-white/10 rounded-full hidden sm:block" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-white/40 text-xs font-medium uppercase tracking-widest">{greeting}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              {student?.student_name?.split(' ')[0] ?? 'Student'}
            </h1>
            <p className="text-white/50 text-sm mt-1">Here&apos;s how you&apos;re doing this semester</p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#FAE452]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wide">Course</p>
                  <p className="text-xs font-semibold text-white">{student?.course_name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#FAE452]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wide">Batch</p>
                  <p className="text-xs font-semibold text-white">{student?.batch_code ?? '—'}</p>
                </div>
              </div>
              {student?.batch_timings && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#FAE452]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Timings</p>
                    <p className="text-xs font-semibold text-white">{student.batch_timings}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attendance ring — desktop */}
          <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
            <div className="relative">
              <ProgressRing percentage={att.percentage} size={110} strokeWidth={10} color={attColor} trackColor="rgba(255,255,255,0.1)" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white">{att.percentage}%</span>
                <span className="text-[10px] text-white/40 font-medium">Attendance</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance */}
        <div className="group relative bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] opacity-[0.07]" style={{ background: attColor }} />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${attColor}15` }}>
              <svg className="w-4 h-4" style={{ color: attColor }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Attendance</span>
          </div>
          <p className="text-3xl font-black" style={{ color: attColor }}>{att.percentage}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {att.percentage < 75 && att.total_lectures > 0
              ? `Need ${Math.ceil((0.75 * att.total_lectures - att.attended) / 0.25)} more`
              : 'Good standing'}
          </p>
          {/* Mini bar */}
          <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${att.percentage}%`, background: attColor }} />
          </div>
        </div>

        {/* Lectures attended */}
        <div className="group relative bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-blue-500 opacity-[0.07]" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Attended</span>
          </div>
          <p className="text-3xl font-black text-blue-600">{att.attended}</p>
          <p className="text-xs text-gray-400 mt-1">of {att.total_lectures} lectures</p>
          <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: att.total_lectures > 0 ? `${(att.attended / att.total_lectures) * 100}%` : '0%' }} />
          </div>
        </div>

        {/* Absent */}
        <div className="group relative bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-gray-500 opacity-[0.05]" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Absent</span>
          </div>
          <p className="text-3xl font-black text-gray-700">{att.absent}</p>
          <p className="text-xs text-gray-400 mt-1">lectures missed</p>
          <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gray-400 transition-all duration-700" style={{ width: att.total_lectures > 0 ? `${(att.absent / att.total_lectures) * 100}%` : '0%' }} />
          </div>
        </div>

        {/* Assignments */}
        <div className="group relative bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-purple-500 opacity-[0.07]" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Assignments</span>
          </div>
          <p className="text-3xl font-black text-purple-600">{assign.received}<span className="text-lg text-purple-300">/{assign.total_given}</span></p>
          <p className="text-xs text-gray-400 mt-1">{assign.pending > 0 ? `${assign.pending} pending` : 'All submitted!'}</p>
          <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-purple-500 transition-all duration-700" style={{ width: `${assign.percentage}%` }} />
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent Lectures — 2 cols */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] flex items-center justify-center shadow-lg shadow-[#2E3093]/20">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Recent Lectures</h2>
                <p className="text-[11px] text-gray-400">Your attendance record</p>
              </div>
            </div>
            <Link href="/student-portal/dashboard/attendance" className="text-xs font-semibold text-[#2E3093] hover:text-[#2A6BB5] transition-colors flex items-center gap-1">
              View all
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="border-t border-gray-50">
            {recentLectures.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">No lecture records yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60">
                      <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Topic</th>
                      <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Faculty</th>
                      <th className="text-center px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentLectures.map((lec, i) => (
                      <tr key={lec.Take_Id} className="hover:bg-blue-50/30 transition-colors" style={{ animationDelay: `${i * 50}ms` }}>
                        <td className="px-6 py-3.5 text-xs text-gray-500 whitespace-nowrap font-medium">
                          {lec.Take_Dt ? new Date(lec.Take_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-800 font-medium max-w-[200px] truncate">{lec.Topic || '—'}</td>
                        <td className="px-6 py-3.5 text-xs text-gray-400 max-w-[140px] truncate hidden md:table-cell">{lec.Faculty_Name || '—'}</td>
                        <td className="px-6 py-3.5 text-center">
                          {lec.present ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${lec.Late ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'}`}>
                              {lec.Late ? (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              )}
                              {lec.Late ? 'Late' : 'Present'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 text-red-500 ring-1 ring-red-200">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              Absent
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

        {/* Right column */}
        <div className="space-y-5">

          {/* Quick Rings */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Progress Overview</h3>
            <div className="flex items-center justify-around">
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing percentage={att.percentage} size={72} strokeWidth={7} color={attColor} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-gray-800">{att.percentage}%</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-gray-400 mt-1">Attendance</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing percentage={assign.percentage} size={72} strokeWidth={7} color={assignColor} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-gray-800">{assign.percentage}%</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-gray-400 mt-1">Assignments</span>
              </div>
            </div>
          </div>

          {/* Upcoming Lectures */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Upcoming</h2>
                <p className="text-[10px] text-gray-400">Scheduled sessions</p>
              </div>
            </div>
            <div className="border-t border-gray-50">
              {upcoming.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-xs">No upcoming lectures</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcoming.map((lec) => (
                    <div key={lec.id} className="px-5 py-3.5 hover:bg-indigo-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{lec.subject_topic || lec.subject || `Lecture ${lec.lecture_no}`}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{lec.faculty_name || 'TBD'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-500">#{lec.lecture_no}</span>
                          {lec.date && <p className="text-[10px] text-gray-400 mt-0.5">{new Date(lec.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {lec.assignment === '1' && (
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-orange-50 text-orange-500 font-bold ring-1 ring-orange-200">ASSIGNMENT</span>
                        )}
                        {lec.unit_test === '1' && (
                          <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-500 font-bold ring-1 ring-purple-200">UNIT TEST</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Assignments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Assignments</h2>
                  <p className="text-[10px] text-gray-400">{assign.percentage}% complete</p>
                </div>
              </div>
              <Link href="/student-portal/dashboard/assignments" className="text-xs font-semibold text-[#2E3093] hover:text-[#2A6BB5] transition-colors flex items-center gap-1">
                All
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="border-t border-gray-50">
              {recentAssignments.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-xs">No assignments yet</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentAssignments.map((a) => (
                    <div key={a.Take_Id} className="px-5 py-3.5 hover:bg-purple-50/30 transition-colors flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${a.received ? 'bg-emerald-500' : 'bg-orange-400 animate-pulse'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{a.Topic || 'Assignment'}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[10px] text-gray-400">{a.Faculty_Name || '—'}</p>
                            {a.Take_Dt && (
                              <>
                                <span className="text-gray-200">|</span>
                                <p className="text-[10px] text-gray-400">
                                  {new Date(a.Take_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {a.received ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 shrink-0">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-500 ring-1 ring-orange-200 shrink-0">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Pending
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Exam Results */}
          {exams.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-gray-900">Exam Results</h2>
              </div>
              <div className="border-t border-gray-50 divide-y divide-gray-50">
                {exams.map((exam) => (
                  <div key={exam.Take_Id} className="px-5 py-3.5 flex items-center justify-between hover:bg-amber-50/30 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{exam.Test_No ? `Test ${exam.Test_No}` : `Exam #${exam.Take_Id}`}</p>
                      {exam.Test_Dt && <p className="text-[10px] text-gray-400 mt-0.5">{new Date(exam.Test_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-black text-[#2E3093]">{exam.Marks ?? '—'}</span>
                      <span className="text-[10px] text-gray-400 font-medium">marks</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placement CTA */}
          <div className="relative overflow-hidden rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #FAE452 0%, #f0c030 100%)' }}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-lg" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h3 className="text-sm font-black text-[#1a1d5e]">Placement Portal</h3>
              </div>
              <p className="text-xs text-[#1a1d5e]/60">Browse companies & apply for jobs</p>
              <Link href="/student-portal/dashboard/jobs"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E3093] text-white text-xs font-bold rounded-xl hover:bg-[#252780] transition-all shadow-lg shadow-[#2E3093]/30 hover:shadow-xl hover:shadow-[#2E3093]/40 hover:-translate-y-0.5">
                View Jobs
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
