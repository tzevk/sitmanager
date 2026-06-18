'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  CalendarCheck,
  GraduationCap,
  MessageSquareWarning,
  Presentation,
  School,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { TableSkeleton, WidgetSkeleton } from './Skeletons';
import { toBatchNumber } from '@/lib/batch-display';

type IconType = ComponentType<{ className?: string }>;

type DashboardProps = {
  data: any;
  loading: boolean;
};

const UPCOMING_EXAM_STATUS_OPTIONS = ['Not Started', 'Being Prepared', 'Prepared', 'Approved'];
const FINISHED_EXAM_STATUS_OPTIONS = ['Pending', 'Checked', 'Shown'];

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(value: unknown) {
  return `${toNumber(value).toFixed(1)}%`;
}

function formatDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateInputValue(value: unknown) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function clampPct(value: unknown) {
  return Math.max(0, Math.min(100, toNumber(value)));
}

function progressTone(value: unknown) {
  const n = toNumber(value);
  if (n >= 80) return 'bg-emerald-500';
  if (n >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function statusTone(value: unknown) {
  const text = String(value || '').toLowerCase();
  if (text.includes('being') || text.includes('pending')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (text.includes('prepared') || text.includes('approved') || text.includes('shown') || text.includes('checked') || text.includes('taken') || text.includes('completed')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function riskTone(value: unknown, goodAt = 75) {
  const n = toNumber(value);
  if (n >= goodAt) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (n >= Math.max(40, goodAt - 20)) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}

function EmptyState({ children = 'No data available' }: { children?: ReactNode }) {
  return <div className="px-3 py-5 text-center text-xs text-slate-400">{children}</div>;
}

function Section({ title, icon: Icon, count, children, className = '' }: { title: string; icon: IconType; count?: number; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-full ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2A6BB5]/20 bg-[#2A6BB5]/8 text-[#2E3093]">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="truncate text-xs font-black uppercase tracking-wide text-slate-800">{title}</h3>
        </div>
        {typeof count === 'number' && (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
            {count.toLocaleString('en-IN')}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function DashboardBand({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 sm:p-3">
      <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-900">{title}</h3>
          <p className="text-[11px] font-medium text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string | number; detail: string; icon: IconType; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-xl font-black leading-none text-slate-950">{value}</p>
        </div>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 truncate text-[11px] font-medium text-slate-500">{detail}</p>
    </div>
  );
}

function ProgressBar({ value }: { value: unknown }) {
  return (
    <div className="min-w-[82px]">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
        <span>{pct(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${progressTone(value)}`} style={{ width: `${clampPct(value)}%` }} />
      </div>
    </div>
  );
}

function DataTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-2 py-2 text-left font-bold truncate">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export default function TrainingDevelopmentDashboard({ data, loading }: DashboardProps) {
  const td = data?.trainingDevelopment ?? {};
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string | number>>({});

  const ongoing = td.ongoingBatches ?? [];
  const lowAttendance = td.lowAttendanceStudents ?? [];
  const lowPerformance = td.lowPerformingStudents ?? [];
  const upcomingExams = td.upcomingExams ?? [];
  const finishedExams = td.finishedExams ?? [];
  const todaysLectures = td.todaysLectures ?? [];
  const googleReviews = td.googleReviews ?? [];
  const upcomingConvocations = td.upcomingConvocations ?? [];

  const saveMeta = async (params: {
    widgetType: 'upcoming_exam' | 'finished_exam' | 'google_review';
    entityKey: string;
    status?: string | null;
    numericValue?: number | null;
    dateValue?: string | null;
  }) => {
    const requestKey = `${params.widgetType}:${params.entityKey}`;
    setSavingKey(requestKey);
    try {
      await fetch('/api/dashboard/training-development', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } finally {
      setSavingKey((current) => (current === requestKey ? null : current));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 pb-4">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <WidgetSkeleton key={index} lines={2} />)}
        </div>
        <TableSkeleton rows={4} cols={7} />
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          <TableSkeleton rows={4} cols={4} />
          <TableSkeleton rows={4} cols={4} />
        </div>
      </div>
    );
  }

  const totalStudents = ongoing.reduce((sum: number, row: any) => sum + toNumber(row.total_students), 0);
  const avgCompletion = ongoing.length ? ongoing.reduce((sum: number, row: any) => sum + toNumber(row.percentage_complete), 0) / ongoing.length : 0;
  const avgAttendance = ongoing.length ? ongoing.reduce((sum: number, row: any) => sum + toNumber(row.avg_attendance_pct), 0) / ongoing.length : 0;
  const avgMarks = ongoing.length ? ongoing.reduce((sum: number, row: any) => sum + toNumber(row.avg_marks_pct), 0) / ongoing.length : 0;
  return (
    <div className="space-y-3 pb-4">
      <DashboardBand title="Overview" description="Key indicators">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricCard label="Batches" value={ongoing.length.toLocaleString('en-IN')} detail={`${totalStudents.toLocaleString('en-IN')} participants`} icon={School} tone="border-[#2A6BB5]/20 bg-[#2A6BB5]/8 text-[#2E3093]" />
          <MetricCard label="Completion" value={pct(avgCompletion)} detail="Average progress" icon={TrendingUp} tone="border-cyan-200 bg-cyan-50 text-cyan-700" />
          <MetricCard label="Attendance" value={pct(avgAttendance)} detail={`${lowAttendance.length.toLocaleString('en-IN')} exceptions`} icon={Users} tone="border-amber-200 bg-amber-50 text-amber-700" />
          <MetricCard label="Performance" value={pct(avgMarks)} detail={`${lowPerformance.length.toLocaleString('en-IN')} exceptions`} icon={BookOpenCheck} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
        </div>
      </DashboardBand>

      <DashboardBand title="Activity" description="Current work">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <Section title="Status" icon={Presentation} count={ongoing.length}>
          <DataTable columns={['Batch', 'State', 'Program', 'Days', 'Done', 'Count', 'Att.', 'Flag']}>
            {ongoing.length === 0 ? (
              <tr><td colSpan={8}><EmptyState>No current batch records</EmptyState></td></tr>
            ) : ongoing.slice(0, 4).map((row: any, index: number) => (
              <tr key={`ongoing-${row.Batch_Id ?? row.batch_no ?? 'row'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-2 py-2"><span className="inline-block max-w-full truncate rounded border border-[#2A6BB5]/20 bg-[#2A6BB5]/8 px-1.5 py-0.5 text-[10px] font-bold text-[#2E3093]">{row.batch_status || '-'}</span></td>
                <td className="px-2 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                <td className="px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">{toNumber(row.days_completed)}/{toNumber(row.duration_days)}</td>
                <td className="px-2 py-2"><ProgressBar value={row.percentage_complete} /></td>
                <td className="px-2 py-2 text-center font-semibold text-slate-700">{toNumber(row.total_students)}</td>
                <td className="px-2 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${riskTone(row.avg_attendance_pct)}`}>{pct(row.avg_attendance_pct)}</span></td>
                <td className="px-2 py-2 text-center font-bold text-rose-700">{toNumber(row.low_performing_students)}</td>
              </tr>
            ))}
          </DataTable>
        </Section>

        <Section title="Schedule" icon={CalendarCheck} count={todaysLectures.length}>
          <DataTable columns={['Batch', 'Topic', 'Time', 'Att.']}>
            {todaysLectures.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No sessions scheduled today</EmptyState></td></tr>
            ) : todaysLectures.slice(0, 4).map((row: any, index: number) => (
              <tr key={`lecture-${row.take_id ?? row.batch_no ?? 'row'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-2 py-2">
                  <p className="truncate font-semibold text-slate-900">{row.lecture_topic || 'Session'}</p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">{row.trainer || '-'} · {row.room_no || '-'}</p>
                </td>
                <td className="px-2 py-2 text-[11px] font-semibold text-slate-600 truncate">{row.timing || '-'}</td>
                <td className="px-2 py-2 text-center font-bold text-slate-700">{toNumber(row.attendance_count)}</td>
              </tr>
            ))}
          </DataTable>
        </Section>
      </div>
      </DashboardBand>

      <DashboardBand title="Exceptions" description="Items requiring review">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Section title="Attendance" icon={AlertTriangle} count={lowAttendance.length}>
          <DataTable columns={['Name', 'Batch', 'Program', 'Att.']}>
            {lowAttendance.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No attendance exceptions</EmptyState></td></tr>
            ) : lowAttendance.slice(0, 4).map((row: any, index: number) => (
              <tr key={`low-attendance-${row.batch_no || 'batch'}-${row.name || 'student'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-2 py-2 font-semibold text-slate-900 truncate">{row.name || '-'}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-slate-600 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-2 py-2 text-slate-600 truncate">{row.training_program || '-'}</td>
                <td className="px-2 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${riskTone(row.attendance_pct)}`}>{pct(row.attendance_pct)}</span></td>
              </tr>
            ))}
          </DataTable>
        </Section>

        <Section title="Performance" icon={MessageSquareWarning} count={lowPerformance.length}>
          <DataTable columns={['Name', 'Batch', 'Program', 'Score']}>
            {lowPerformance.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No performance exceptions</EmptyState></td></tr>
            ) : lowPerformance.slice(0, 4).map((row: any, index: number) => (
              <tr key={`low-performance-${row.batch_no || 'batch'}-${row.name || 'student'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-2 py-2 font-semibold text-slate-900 truncate">{row.name || '-'}</td>
                <td className="px-2 py-2 font-mono text-[11px] text-slate-600 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-2 py-2 text-slate-600 truncate">{row.training_program || '-'}</td>
                <td className="px-2 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${riskTone(row.marks_pct, 60)}`}>{pct(row.marks_pct)}</span></td>
              </tr>
            ))}
          </DataTable>
        </Section>
      </div>
      </DashboardBand>

      <DashboardBand title="Assessments" description="Preparation and review status">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Section title="Upcoming" icon={BookOpenCheck} count={upcomingExams.length}>
          <DataTable columns={['Batch', 'Program', 'Date', 'Status']}>
            {upcomingExams.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No upcoming assessment records</EmptyState></td></tr>
            ) : upcomingExams.slice(0, 4).map((row: any, index: number) => {
              const key = `upcoming_exam:${row.entity_key}`;
              const status = String(fieldOverrides[key] ?? row.paper_status ?? 'Not Started');
              return (
                <tr key={`upcoming-exam-${row.entity_key ?? `${row.batch_no || 'batch'}-${row.exam_date || 'date'}`}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                  <td className="px-2 py-2 text-slate-600 truncate">{formatDate(row.exam_date)}</td>
                  <td className="px-2 py-2">
                    <select
                      value={status}
                      onChange={(event) => {
                        const next = event.target.value;
                        setFieldOverrides((prev) => ({ ...prev, [key]: next }));
                        void saveMeta({ widgetType: 'upcoming_exam', entityKey: row.entity_key, status: next });
                      }}
                      disabled={savingKey === key}
                      className={`w-full rounded border px-1.5 py-1 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 ${statusTone(status)}`}
                    >
                      {UPCOMING_EXAM_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </Section>

        <Section title="Completed" icon={Award} count={finishedExams.length}>
          <DataTable columns={['Batch', 'Program', 'Date', 'Status', 'Review', 'Avg.']}>
            {finishedExams.length === 0 ? (
              <tr><td colSpan={6}><EmptyState>No completed assessment records</EmptyState></td></tr>
            ) : finishedExams.slice(0, 4).map((row: any, index: number) => {
              const statusKey = `finished_exam:${row.entity_key}:status`;
              const dateKey = `finished_exam:${row.entity_key}:date`;
              const saveKey = `finished_exam:${row.entity_key}`;
              const status = String(fieldOverrides[statusKey] ?? row.paper_status ?? 'Pending');
              const showingDate = String(fieldOverrides[dateKey] ?? dateInputValue(row.paper_showing_date));
              return (
                <tr key={`finished-exam-${row.entity_key ?? `${row.batch_no || 'batch'}-${row.exam_date || 'date'}`}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                  <td className="px-2 py-2 text-slate-600 truncate">{formatDate(row.exam_date)}</td>
                  <td className="px-2 py-2">
                    <select
                      value={status}
                      onChange={(event) => {
                        const next = event.target.value;
                        setFieldOverrides((prev) => ({ ...prev, [statusKey]: next }));
                        void saveMeta({ widgetType: 'finished_exam', entityKey: row.entity_key, status: next, dateValue: showingDate || null });
                      }}
                      disabled={savingKey === saveKey}
                      className={`w-full rounded border px-1.5 py-1 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 ${statusTone(status)}`}
                    >
                      {FINISHED_EXAM_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={showingDate}
                      onChange={(event) => {
                        const next = event.target.value;
                        setFieldOverrides((prev) => ({ ...prev, [dateKey]: next }));
                        void saveMeta({ widgetType: 'finished_exam', entityKey: row.entity_key, status, dateValue: next || null });
                      }}
                      disabled={savingKey === saveKey}
                      className="w-full rounded border border-slate-200 px-1.5 py-1 text-[10px] font-semibold text-slate-700 focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15"
                    />
                  </td>
                  <td className="px-2 py-2 font-bold text-slate-700">{pct(row.average_marks_pct)}</td>
                </tr>
              );
            })}
          </DataTable>
        </Section>
      </div>
      </DashboardBand>

      <DashboardBand title="Outcomes" description="Feedback and events">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Section title="Feedback" icon={Star} count={googleReviews.length}>
          <DataTable columns={['Batch', 'Program', 'End', 'Responses']}>
            {googleReviews.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No feedback records in the current window</EmptyState></td></tr>
            ) : googleReviews.slice(0, 4).map((row: any, index: number) => {
              const key = `google_review:${row.entity_key}`;
              const value = fieldOverrides[key] ?? row.reviews_received ?? 0;
              return (
                <tr key={`google-review-${row.entity_key ?? row.batch_no ?? 'row'}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                  <td className="px-2 py-2 text-slate-600 truncate">{formatDate(row.end_date)}</td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(event) => {
                        const next = Math.max(0, Number(event.target.value) || 0);
                        setFieldOverrides((prev) => ({ ...prev, [key]: next }));
                      }}
                      onBlur={(event) => {
                        const next = Math.max(0, Number(event.target.value) || 0);
                        void saveMeta({ widgetType: 'google_review', entityKey: row.entity_key, numericValue: next });
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.currentTarget.blur();
                      }}
                      className="w-full rounded border border-slate-200 px-1.5 py-1 text-[10px] font-semibold text-slate-700 focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15"
                      disabled={savingKey === key}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </Section>

        <Section title="Events" icon={GraduationCap} count={upcomingConvocations.length}>
          <DataTable columns={['Batch', 'Program', 'End', 'Date', 'Location']}>
            {upcomingConvocations.length === 0 ? (
              <tr><td colSpan={5}><EmptyState>No upcoming event records</EmptyState></td></tr>
            ) : upcomingConvocations.slice(0, 4).map((row: any, index: number) => (
              <tr key={`convocation-${row.id ?? row.batch_no ?? 'row'}-${row.convocation_date ?? 'date'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-2 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-2 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                <td className="px-2 py-2 text-slate-600 truncate">{formatDate(row.end_date)}</td>
                <td className="px-2 py-2 text-slate-600 truncate">{formatDate(row.convocation_date)}</td>
                <td className="px-2 py-2 text-slate-600 truncate">{row.location || '-'}</td>
              </tr>
            ))}
          </DataTable>
        </Section>
      </div>
      </DashboardBand>
    </div>
  );
}
