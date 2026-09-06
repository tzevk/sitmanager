'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toBatchNumber } from '@/lib/batch-display';

interface AcademicsData {
  fees: {
    total: number;
    paid: number;
    pending: number;
  };
  fee_ledger: Array<{
    fees_id: number;
    receipt_code: string | null;
    date: string | null;
    payment_type: string | null;
    type: 'paid' | 'charged';
    amount: number;
    notes: string | null;
  }>;
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
    trainer_name?: string | null;
    trainer_time_from?: string | null;
    trainer_time_to?: string | null;
    trainer_link?: string | null;
    trainer_date?: string | null;
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
    session?: 'first_half' | 'second_half';
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
    unit_test_date: string | null;
  }>;
  exam_results: Array<{
    Take_Id: number;
    Test_Dt: string;
    Test_No: string;
    Marks: string;
  }>;
}

function cleanTimings(t: string): string {
  // Strip "Monday To Saturday " or "Mon To Sat " prefix
  return t.replace(/^[A-Za-z]+\s+[Tt]o\s+[A-Za-z]+\s*/i, '').trim();
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtINR(n: number): string {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AcademicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [today, setToday] = useState('');
  const [notices, setNotices] = useState<Array<{ id: number; title: string | null; specification: string | null }>>([]);

  useEffect(() => {
    (async () => {
      // Time-based greeting is set here (after the first await) rather than in a
      // synchronous effect body — keeps it client-only and avoids cascading renders.
      try {
        const res = await fetch('/api/student-portal/academics');
        const h = new Date().getHours();
        setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
        setToday(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }));
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const json = await res.json();
        setData(json);
      } catch { /* silent */ }
      setLoading(false);
    })();
    // Notices are non-critical — fetched independently so a failure here
    // never blocks the main dashboard from loading.
    (async () => {
      try {
        const res = await fetch('/api/student-portal/notices');
        if (res.status === 401) return;
        const json = await res.json();
        setNotices(Array.isArray(json?.notices) ? json.notices.slice(0, 3) : []);
      } catch { /* silent */ }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const att    = data?.attendance  ?? { total_lectures: 0, attended: 0, absent: 0, percentage: 0 };
  const assign = data?.assignments ?? { total_given: 0, received: 0, pending: 0, percentage: 0 };
  const fees   = data?.fees        ?? { total: 0, paid: 0, pending: 0 };
  const feeLedger = data?.fee_ledger ?? [];
  const feesCleared = fees.pending <= 0;
  const paidPct = fees.total > 0 ? Math.min(100, Math.round((fees.paid / fees.total) * 100)) : (feesCleared ? 100 : 0);
  const student       = data?.student;
  const recentLectures     = data?.recent_lectures     ?? [];
  const recentAssignments  = data?.recent_assignments  ?? [];
  const upcoming           = data?.upcoming_lectures   ?? [];
  const exams              = data?.exam_results        ?? [];

  const firstName = student?.student_name?.split(' ')[0] ?? 'Student';
  const timings = student?.batch_timings ? cleanTimings(student.batch_timings) : '';

  return (
    <div className="pb-6">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="relative bg-[#2E3093] px-5 sm:px-8 lg:px-10 pt-7 sm:pt-10 pb-14 sm:pb-16 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 bg-white/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 w-40 h-40 bg-[#FAE452]/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

        <div className="relative max-w-5xl mx-auto">
          <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.22em]">{today}</p>

          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-white/50 text-xs sm:text-sm font-medium">{greeting},</p>
              <h1 className="text-[2rem] sm:text-[2.6rem] font-black text-white leading-tight mt-0.5">{firstName}</h1>
              {student?.course_name && (
                <p className="text-white/60 text-xs sm:text-sm mt-2 leading-relaxed">
                  {student.course_name}
                  {student.batch_code ? <><br className="sm:hidden" /><span className="text-white/40 hidden sm:inline"> · </span><span className="text-white/40">{toBatchNumber(student.batch_code)}</span></> : ''}
                  {timings ? <><span className="text-white/30"> · </span><span className="text-[#FAE452]/80">{timings}</span></> : ''}
                </p>
              )}
            </div>
            <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-white/10 border border-white/15 items-center justify-center shrink-0">
              <span className="text-xl font-black text-[#FAE452]">
                {firstName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">

        {/* ── Stat cards — overlap hero ──────────────────────── */}
        <div className="px-4 sm:px-8 lg:px-10 -mt-8 sm:-mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">

          {/* Attendance */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 4px 20px rgba(46,48,147,0.10)' }}>
            <div className="h-[3px] w-full bg-[#2E3093]" />
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Attendance</p>
              <p className="text-3xl sm:text-4xl font-black text-[#2E3093] mt-1 leading-none">
                {att.attended}
                <span className="text-base font-bold text-gray-200">/{att.total_lectures}</span>
              </p>
              <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#2E3093] rounded-full transition-all" style={{ width: `${att.percentage}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">{att.percentage}% this semester</p>
            </div>
          </div>

          {/* Assignments */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 4px 20px rgba(46,48,147,0.10)' }}>
            <div className="h-[3px] w-full bg-[#FAE452]" />
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assignments</p>
              <p className="text-3xl sm:text-4xl font-black text-[#2E3093] mt-1 leading-none">
                {assign.received}
                <span className="text-base font-bold text-gray-200">/{assign.total_given}</span>
              </p>
              <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#FAE452] rounded-full transition-all" style={{ width: `${assign.percentage}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                {assign.pending > 0 ? `${assign.pending} pending` : 'All submitted'}
              </p>
            </div>
          </div>

          {/* Pending fees (compact, sits alongside on desktop) */}
          <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 4px 20px rgba(46,48,147,0.10)' }}>
            <div className={`h-[3px] w-full ${feesCleared ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fees</p>
              {feesCleared ? (
                <p className="text-xl sm:text-2xl font-black text-green-600 mt-1 leading-none flex items-center gap-1.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Fully Paid
                </p>
              ) : (
                <p className="text-3xl sm:text-4xl font-black text-red-600 mt-1 leading-none">{fmtINR(fees.pending)}</p>
              )}
              <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${feesCleared ? 'bg-green-500' : 'bg-[#2E3093]'}`} style={{ width: `${paidPct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">{paidPct}% paid{!feesCleared ? ` · due` : ''}</p>
            </div>
          </div>

        </div>

        {/* ── Notice Board ─────────────────────────────────── */}
        {notices.length > 0 && (
          <div className="px-4 sm:px-8 lg:px-10 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-black text-[#2E3093] uppercase tracking-[0.18em]">Notice Board</h2>
              <Link href="/student-portal/dashboard/notices"
                className="text-[11px] font-bold text-gray-400 hover:text-[#2E3093] transition-colors">
                See all →
              </Link>
            </div>
            <div className="space-y-2.5">
              {notices.slice(0, 3).map((n) => (
                <Link key={n.id} href="/student-portal/dashboard/notices" className="block">
                  <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-start gap-3 hover:border-[#2A6BB5]/35 transition-colors" style={{ boxShadow: '0 4px 20px rgba(46,48,147,0.06)' }}>
                    <div className="w-8 h-8 rounded-lg bg-[#2A6BB5]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 00-7.029-5.912c-.563.097-.994.577-.94 1.145l.152 1.596a3.75 3.75 0 01-1.052 3.06l-4.243 4.243a3.75 3.75 0 01-3.06 1.052l-1.596-.152c-.568-.054-1.048.377-1.145.94a6 6 0 005.911 7.03m4.5-8.25L14.25 15" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">{n.title || 'Announcement'}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.specification}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Fee details (crisp ledger) ───────────────────── */}
        <div className="px-4 sm:px-8 lg:px-10 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-black text-[#2E3093] uppercase tracking-[0.18em]">Fee Details</h2>
            <div className="text-[11px] text-gray-400 font-semibold">
              Paid <span className="text-[#2E3093] font-black">{fmtINR(fees.paid)}</span>
              {' · '}
              {feesCleared ? <span className="text-green-600 font-black">Cleared</span> : <>Due <span className="text-red-500 font-black">{fmtINR(fees.pending)}</span></>}
            </div>
          </div>
          {feeLedger.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center text-sm text-gray-300">
              No fee transactions on record
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-4 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide">Date</th>
                      <th className="px-4 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide">Receipt</th>
                      <th className="px-4 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide hidden sm:table-cell">Mode</th>
                      <th className="px-4 py-2.5 font-bold text-gray-400 text-[10px] uppercase tracking-wide text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {feeLedger.map(row => (
                      <tr key={row.fees_id}>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{row.date ? fmtDate(row.date) : '—'}</td>
                        <td className="px-4 py-2.5 text-gray-800 font-semibold whitespace-nowrap">{row.receipt_code || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{row.payment_type || '—'}</td>
                        <td className={`px-4 py-2.5 text-right font-black whitespace-nowrap ${row.type === 'paid' ? 'text-green-600' : 'text-gray-700'}`}>
                          {row.type === 'paid' ? '+' : ''}{fmtINR(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Lower sections: 2-column on large screens ────── */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

          {/* Recent sessions */}
          <div className="px-4 sm:px-8 lg:px-10 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-black text-[#2E3093] uppercase tracking-[0.18em]">Recent Sessions</h2>
              <Link href="/student-portal/dashboard/attendance"
                className="text-[11px] font-bold text-gray-400 hover:text-[#2E3093] transition-colors">
                See all →
              </Link>
            </div>

            {recentLectures.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-300">
                No sessions recorded yet
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {recentLectures.map(lec => {
                  const isPresent = !!lec.present;
                  const isLate    = !!lec.Late;
                  const barColor  = isPresent ? (isLate ? '#f59e0b' : '#22c55e') : '#ef4444';
                  return (
                    <div key={lec.Take_Id} className="flex items-center gap-0">
                      {/* Status bar */}
                      <div className="w-1 self-stretch rounded-r-full shrink-0" style={{ background: barColor }} />
                      <div className="flex items-center justify-between flex-1 px-4 py-3 gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">
                            {lec.Topic || (lec.session === 'second_half' ? 'Second Half' : 'First Half')}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {lec.Take_Dt ? new Date(lec.Take_Dt).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'}
                            {lec.Faculty_Name ? ` · ${lec.Faculty_Name}` : ''}
                          </p>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 ${
                          isPresent
                            ? isLate ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-500'
                        }`}>
                          {isPresent ? (isLate ? 'Late' : 'Present') : 'Absent'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="px-4 sm:px-8 lg:px-10 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-black text-[#2E3093] uppercase tracking-[0.18em]">Upcoming</h2>
                <Link href="/student-portal/dashboard/lecture-plan"
                  className="text-[11px] font-bold text-gray-400 hover:text-[#2E3093] transition-colors">
                  See all →
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {upcoming.map(lec => {
                  const hasUnitTest = Boolean(lec.unit_test) && Boolean(lec.unit_test_date);
                  return (
                    <div key={lec.id} className={`flex items-start justify-between px-4 py-3 gap-3 ${hasUnitTest ? 'bg-amber-50/70 border-l-2 border-amber-400' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">
                          {lec.subject_topic || lec.subject || `Lecture ${lec.lecture_no}`}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {lec.faculty_name || 'TBD'}
                          {lec.date && ` · ${fmtDate(lec.date)}`}
                        </p>
                        {hasUnitTest && (
                          <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                            Unit Test · {fmtDate(lec.unit_test_date as string)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        {lec.assignment === '1' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#FAE452] text-[#2E3093] rounded-md">ASSGN</span>
                        )}
                        {hasUnitTest && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-400 text-white rounded-md">TEST</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent assignments */}
          {recentAssignments.length > 0 && (
            <div className="px-4 sm:px-8 lg:px-10 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-black text-[#2E3093] uppercase tracking-[0.18em]">Assignments</h2>
                <Link href="/student-portal/dashboard/assignments"
                  className="text-[11px] font-bold text-gray-400 hover:text-[#2E3093] transition-colors">
                  See all →
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {recentAssignments.map(a => (
                  <div key={a.Take_Id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{a.Topic || 'Assignment'}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {a.Faculty_Name || '—'}
                        {a.Take_Dt && ` · ${fmtDate(a.Take_Dt)}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 ${
                      a.received ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                    }`}>
                      {a.received ? 'Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exam results */}
          {exams.length > 0 && (
            <div className="px-4 sm:px-8 lg:px-10 mt-6">
              <h2 className="text-[11px] font-black text-[#2E3093] uppercase tracking-[0.18em] mb-3">Exam Results</h2>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {exams.map(exam => (
                  <div key={exam.Take_Id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        {exam.Test_No ? `Test ${exam.Test_No}` : `Exam #${exam.Take_Id}`}
                      </p>
                      {exam.Test_Dt && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(exam.Test_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <p className="text-2xl font-black text-[#2E3093]">{exam.Marks ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
