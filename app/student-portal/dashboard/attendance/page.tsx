'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AttendanceCalendar from './AttendanceCalendar';

interface Lecture {
  Take_Id: number;
  Take_Dt: string;
  Topic?: string;
  Faculty_Name?: string;
  session?: 'first_half' | 'second_half';
  present: number;
  Late: number;
}

interface StudentInfo {
  trainer_name?: string | null;
  trainer_time_from?: string | null;
  trainer_time_to?: string | null;
  trainer_link?: string | null;
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

export default function AttendancePage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [summary, setSummary] = useState({ total_lectures: 0, attended: 0, absent: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student-portal/academics');
        if (res.status === 401) { router.push('/student-portal/signin'); return; }
        const data = await res.json();
        setLectures(data.all_lectures ?? []);
        setStudentInfo(data.student ?? null);
        setSummary(data.attendance ?? { total_lectures: 0, attended: 0, absent: 0, percentage: 0 });
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

  const filtered = filter === 'all' ? lectures : lectures.filter(l => filter === 'present' ? l.present : !l.present);
  const attStatus = summary.percentage >= 75 ? 'good' : summary.percentage >= 60 ? 'warning' : 'low';
  const trainerFrom = fmtTime(studentInfo?.trainer_time_from);
  const trainerTo = fmtTime(studentInfo?.trainer_time_to);
  const trainerLink = normalizeUrl(studentInfo?.trainer_link);
  const trainerLinkLabel = String(studentInfo?.trainer_link ?? '').trim();

  return (
    <div className="pb-4">

      {/* Hero */}
      <div className="bg-[#2E3093] px-5 pt-6 pb-10">
        <p className="text-white/40 text-[11px] font-medium uppercase tracking-widest">Attendance</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-6xl font-black text-white leading-none">{summary.percentage}</p>
          <p className="text-2xl font-black text-white/40 mb-1">%</p>
        </div>
        <div className="mt-4 h-[3px] bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FAE452] rounded-full transition-all"
            style={{ width: `${summary.percentage}%` }}
          />
        </div>
        <p className="text-white/40 text-[11px] mt-1.5">
          {attStatus === 'good' ? 'On track' : attStatus === 'warning' ? 'Needs improvement' : 'Below minimum'}
        </p>

        {(studentInfo?.trainer_name || trainerFrom || trainerTo || trainerLinkLabel) && (
          <div className="mt-4 rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Trainer</p>
            {studentInfo?.trainer_name ? (
              <p className="text-xs text-white font-semibold mt-0.5">{studentInfo.trainer_name}</p>
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
      </div>

      {/* Stats strip — overlap */}
      <div className="px-4 -mt-5 grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: summary.total_lectures, color: 'text-gray-900' },
          { label: 'Present', value: summary.attended, color: 'text-green-600' },
          { label: 'Absent', value: summary.absent, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* View toggle + content */}
      <div className="px-4 mt-4">

        {/* Toggle */}
        <div className="flex items-center gap-1 mb-3 bg-white border border-[#2E3093]/10 rounded-xl p-1">
          {(['calendar', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                view === v ? 'bg-[#2E3093] text-white' : 'text-[#2A6BB5]/60'
              }`}
            >
              {v === 'calendar' ? 'Calendar' : 'List'}
            </button>
          ))}
        </div>

        {view === 'calendar' ? (
          <AttendanceCalendar lectures={lectures} />
        ) : (
          <>
            {/* List filter tabs */}
            <div className="flex items-center gap-1 mb-3 bg-white border border-[#2E3093]/10 rounded-xl p-1">
              {(['all', 'present', 'absent'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                    filter === f ? 'bg-[#2E3093] text-white' : 'text-[#2A6BB5]/60'
                  }`}
                >
                  {f === 'all' ? `All (${lectures.length})` : f === 'present' ? `Present (${summary.attended})` : `Absent (${summary.absent})`}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#2E3093]/10 px-4 py-10 text-center text-sm text-[#2A6BB5]/40">
                No records
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#2E3093]/10 overflow-hidden divide-y divide-zinc-50">
                {filtered.map((lec, idx) => (
                  <div key={lec.Take_Id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-zinc-300 w-5 text-right font-mono tabular-nums">{idx + 1}</span>
                      <div>
                        <p className="text-xs font-semibold text-[#1a1f3c]">
                          {lec.Take_Dt ? new Date(lec.Take_Dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </p>
                        {lec.Topic ? (
                          <p className="text-[11px] text-[#2A6BB5]/70 mt-0.5 truncate max-w-[180px]">{lec.Topic}</p>
                        ) : (
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {lec.session === 'second_half' ? 'Second Half' : 'First Half'}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      lec.present
                        ? lec.Late ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {lec.present ? (lec.Late ? 'Late' : 'Present') : 'Absent'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
