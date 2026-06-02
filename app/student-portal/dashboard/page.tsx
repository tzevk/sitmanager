'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toBatchNumber } from '@/lib/batch-display';

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
    trainer_name?: string | null;
    trainer_time_from?: string | null;
    trainer_time_to?: string | null;
    trainer_link?: string | null;
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

function fmtTime(value?: string | null): string {
  const t = String(value ?? '').trim();
  if (!t) return '';
  const hhmm = t.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return t;
  const [hhRaw, mmRaw] = hhmm.split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return t;
  const period = hh >= 12 ? 'PM' : 'AM';
  const twelveHour = hh % 12 || 12;
  return `${String(twelveHour).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`;
}

function normalizeUrl(link?: string | null): string | null {
  const raw = String(link ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return null;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AcademicsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [today, setToday] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    setToday(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }));
  }, []);

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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const att    = data?.attendance  ?? { total_lectures: 0, attended: 0, absent: 0, percentage: 0 };
  const assign = data?.assignments ?? { total_given: 0, received: 0, pending: 0, percentage: 0 };
  const student       = data?.student;
  const recentLectures     = data?.recent_lectures     ?? [];
  const recentAssignments  = data?.recent_assignments  ?? [];
  const upcoming           = data?.upcoming_lectures   ?? [];
  const exams              = data?.exam_results        ?? [];

  const firstName = student?.student_name?.split(' ')[0] ?? 'Student';
  const timings = student?.batch_timings ? cleanTimings(student.batch_timings) : '';
  const trainerFrom = fmtTime(student?.trainer_time_from);
  const trainerTo = fmtTime(student?.trainer_time_to);
  const trainerLink = normalizeUrl(student?.trainer_link);
  const trainerLinkLabel = String(student?.trainer_link ?? '').trim();

  return (
    <div className="pb-6">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="bg-[#2E3093] px-5 pt-7 pb-14">
        <p className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.22em]">{today}</p>

        <div className="mt-2">
          <p className="text-white/50 text-xs font-medium">{greeting},</p>
          <h1 className="text-[2rem] font-black text-white leading-tight mt-0.5">{firstName}</h1>
          {student?.course_name && (
            <>
              <p className="text-white/60 text-xs mt-2 leading-relaxed">
                {student.course_name}
                {student.batch_code ? <><br /><span className="text-white/40">{toBatchNumber(student.batch_code)}</span></> : ''}
                {timings ? <><span className="text-white/30"> · </span><span className="text-[#FAE452]/80">{timings}</span></> : ''}
              </p>
              {(student?.trainer_name || trainerFrom || trainerTo || trainerLinkLabel) && (
                <div className="mt-3 rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 max-w-md">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Trainer</p>
                  {student?.trainer_name ? (
                    <p className="text-xs text-white font-semibold mt-0.5">{student.trainer_name}</p>
                  ) : null}
                  {(trainerFrom || trainerTo) ? (
                    <p className="text-[11px] text-[#FAE452] mt-1">
                      {trainerFrom || '—'}{trainerFrom || trainerTo ? ' - ' : ''}{trainerTo || '—'}
                    </p>
                  ) : null}
                  {trainerLink ? (
                    <a
                      href={trainerLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-1 text-[11px] text-white underline underline-offset-2 break-all"
                    >
                      Join link
                    </a>
                  ) : trainerLinkLabel ? (
                    <p className="text-[11px] text-white/70 mt-1 break-all">{trainerLinkLabel}</p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Stat cards — overlap hero ──────────────────────── */}
      <div className="px-4 -mt-8 grid grid-cols-2 gap-3">

        {/* Attendance */}
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: '0 4px 20px rgba(46,48,147,0.10)' }}>
          <div className="h-[3px] w-full bg-[#2E3093]" />
          <div className="p-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Attendance</p>
            <p className="text-3xl font-black text-[#2E3093] mt-1 leading-none">
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
          <div className="p-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assignments</p>
            <p className="text-3xl font-black text-[#2E3093] mt-1 leading-none">
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

      </div>

      {/* ── Recent sessions ───────────────────────────────── */}
      <div className="px-4 mt-6">
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
                  <div className="flex items-center justify-between flex-1 px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        {lec.Take_Dt ? new Date(lec.Take_Dt).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : '—'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {lec.session === 'second_half' ? 'Second Half' : 'First Half'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
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

      {/* ── Upcoming ─────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-[11px] font-black text-[#2E3093] uppercase tracking-[0.18em] mb-3">Upcoming</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {upcoming.map(lec => (
              <div key={lec.id} className="flex items-start justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">
                    {lec.subject_topic || lec.subject || `Lecture ${lec.lecture_no}`}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {lec.faculty_name || 'TBD'}
                    {lec.date && ` · ${fmtDate(lec.date)}`}
                  </p>
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
        </div>
      )}

      {/* ── Recent assignments ───────────────────────────── */}
      {recentAssignments.length > 0 && (
        <div className="px-4 mt-6">
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

      {/* ── Exam results ─────────────────────────────────── */}
      {exams.length > 0 && (
        <div className="px-4 mt-6">
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
  );
}
