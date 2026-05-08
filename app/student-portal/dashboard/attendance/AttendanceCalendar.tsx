'use client';

import { useState, useMemo } from 'react';

export interface CalendarLecture {
  Take_Id: number;
  Take_Dt: string;
  Topic?: string;
  Faculty_Name?: string;
  present: number;
  Late: number;
}

interface DayStatus {
  present: boolean;
  late: boolean;
  topic: string;
  faculty: string;
  lectureIds: number[];
}

interface AttendanceCalendarProps {
  lectures: CalendarLecture[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function AttendanceCalendar({ lectures }: AttendanceCalendarProps) {
  // Default to the month of the most recent lecture
  const [viewDate, setViewDate] = useState<Date>(() => {
    const valid = lectures
      .filter(l => l.Take_Dt)
      .map(l => new Date(l.Take_Dt))
      .filter(d => !isNaN(d.getTime()));
    if (valid.length > 0) {
      const latest = new Date(Math.max(...valid.map(d => d.getTime())));
      return new Date(latest.getFullYear(), latest.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Build date → status map
  const attendanceMap = useMemo(() => {
    const map: Record<string, DayStatus> = {};
    for (const lec of lectures) {
      if (!lec.Take_Dt) continue;
      const d = new Date(lec.Take_Dt);
      if (isNaN(d.getTime())) continue;
      const key = toDateKey(d);
      if (!map[key]) {
        map[key] = { present: false, late: false, topic: '', faculty: '', lectureIds: [] };
      }
      // A day counts as present if any lecture that day was attended
      if (lec.present) map[key].present = true;
      if (lec.Late) map[key].late = true;
      if (lec.Topic && !map[key].topic) map[key].topic = lec.Topic;
      if (lec.Faculty_Name && !map[key].faculty) map[key].faculty = lec.Faculty_Name;
      map[key].lectureIds.push(lec.Take_Id);
    }
    return map;
  }, [lectures]);

  // Build calendar cells (nulls = blank padding)
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const grid: Array<{ day: number; key: string } | null> = [
      ...Array<null>(firstWeekday).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => {
        const day = i + 1;
        return { day, key: `${year}-${pad2(month + 1)}-${pad2(day)}` };
      }),
    ];
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [year, month]);

  // Month stats
  const monthStats = useMemo(() => {
    const prefix = `${year}-${pad2(month + 1)}`;
    const days = Object.entries(attendanceMap).filter(([k]) => k.startsWith(prefix));
    const present = days.filter(([, v]) => v.present).length;
    return { present, total: days.length, absent: days.length - present };
  }, [attendanceMap, year, month]);

  const todayKey = toDateKey(new Date());
  const selectedStatus = selectedKey ? (attendanceMap[selectedKey] ?? null) : null;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const monthLabel = viewDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-[#2E3093]/10 overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#2E3093] tracking-tight">{monthLabel}</p>
          {monthStats.total > 0 && (
            <p className="text-[11px] text-[#2A6BB5]/70 mt-0.5 tabular-nums">
              {monthStats.present} of {monthStats.total} lectures attended
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={prevMonth} aria-label="Previous month"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#2A6BB5]/60 hover:bg-[#2E3093]/5 active:bg-[#2E3093]/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goToday}
            className="px-2.5 h-8 text-[11px] font-semibold text-[#2A6BB5] hover:bg-[#2E3093]/5 rounded-lg transition-colors">
            Today
          </button>
          <button onClick={nextMonth} aria-label="Next month"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#2A6BB5]/60 hover:bg-[#2E3093]/5 active:bg-[#2E3093]/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-3 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-zinc-400 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 px-3 pb-3">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`blank-${idx}`} />;

          const { day, key } = cell;
          const status = attendanceMap[key];
          const isToday = key === todayKey;
          const isFuture = key > todayKey;
          const isSelected = key === selectedKey;
          const hasData = Boolean(status) && !isFuture;

          let bg = 'bg-zinc-50 text-zinc-300';
          if (hasData) {
            if (status.present && !status.late) bg = 'bg-[#2A6BB5] text-white';
            else if (status.present && status.late) bg = 'bg-amber-100 text-amber-700 border border-amber-200';
            else bg = 'bg-red-50 text-red-500 border border-red-100';
          }

          return (
            <button
              key={key}
              onClick={() => {
                if (!hasData) return;
                setSelectedKey(prev => prev === key ? null : key);
              }}
              disabled={!hasData}
              className={[
                'aspect-square flex flex-col items-center justify-center rounded-xl text-[12px] font-semibold transition-all select-none',
                bg,
                isToday ? 'ring-2 ring-[#2E3093] ring-offset-1' : '',
                isSelected ? 'scale-110 shadow-md' : '',
                hasData ? 'hover:scale-105 active:scale-100 cursor-pointer' : 'cursor-default',
              ].join(' ')}
            >
              <span>{day}</span>
              {/* Status dot */}
              {hasData && status.present && status.late && (
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-0.5 block" />
              )}
              {hasData && !status.present && (
                <span className="w-1 h-1 rounded-full bg-red-400 mt-0.5 block" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedKey && selectedStatus && (() => {
        const [sy, sm, sd] = selectedKey.split('-').map(Number);
        const dateLabel = new Date(sy, sm - 1, sd).toLocaleDateString('en-IN', {
          weekday: 'long', day: 'numeric', month: 'long',
        });
        return (
          <div className="mx-3 mb-3 rounded-xl bg-zinc-50 border border-zinc-100 px-4 py-3">
            <p className="text-[11px] font-semibold text-[#2A6BB5]/70 uppercase tracking-wider mb-1.5">{dateLabel}</p>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {selectedStatus.topic && (
                  <p className="text-[13px] font-semibold text-[#1a1f3c] leading-snug truncate">{selectedStatus.topic}</p>
                )}
                {selectedStatus.faculty && (
                  <p className="text-[11px] text-[#2A6BB5]/70 mt-0.5">{selectedStatus.faculty}</p>
                )}
              </div>
              <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                selectedStatus.present
                  ? selectedStatus.late
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}>
                {selectedStatus.present ? (selectedStatus.late ? 'Late' : 'Present') : 'Absent'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="px-4 py-3 border-t border-zinc-100 flex items-center gap-4 flex-wrap">
        {[
          { dot: 'bg-[#2A6BB5]', label: 'Present' },
          { dot: 'bg-amber-200 border border-amber-300', label: 'Late' },
          { dot: 'bg-red-100 border border-red-200', label: 'Absent' },
          { dot: 'bg-zinc-100', label: 'No class' },
        ].map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
            <span className={`w-3 h-3 rounded-md ${dot} block`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
