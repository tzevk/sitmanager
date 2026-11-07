'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  CalendarCheck,
  Clock,
  GraduationCap,
  MessageSquareWarning,
  Presentation,
  School,
  Star,
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

function Section({ title, hint, href, linkLabel = 'Open', icon: Icon, count, children, className = '' }: { title: string; hint?: string; href?: string; linkLabel?: string; icon: IconType; count?: number; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2E3093]/[0.07] text-[#2E3093]">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#2E3093]">
              <span className="truncate">{title}</span>
              {typeof count === 'number' && (
                <span className="rounded-full bg-[#2A6BB5]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2A6BB5]">{count.toLocaleString('en-IN')}</span>
              )}
            </h3>
            {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
          </div>
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-[11px] font-semibold text-[#2A6BB5] hover:text-[#2E3093] hover:underline">{linkLabel} →</Link>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto">{children}</div>
    </section>
  );
}

function DashboardBand({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-[#1a1f3c]">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, alert = false }: { label: string; value: string | number; detail: string; icon: IconType; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold leading-none tabular-nums ${alert ? 'text-rose-600' : 'text-[#2E3093]'}`}>{value}</p>
        </div>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${alert ? 'bg-rose-50 text-rose-600' : 'bg-[#2E3093]/[0.07] text-[#2E3093]'}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 truncate text-[11px] text-slate-500">{detail}</p>
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
        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-semibold truncate">{column}</th>
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <TableSkeleton rows={4} cols={4} />
          <TableSkeleton rows={4} cols={4} />
        </div>
      </div>
    );
  }

  const batchActivity: any[] = td.batchActivity ?? [];
  // A batch is "quiet" when it hasn't recorded a lecture for longer than its
  // rhythm allows: 2 days for full-time/online batches, 8 for weekend batches.
  const quietBatches = batchActivity.filter((row) => {
    const limit = /weekend/i.test(String(row.category ?? '')) ? 8 : 2;
    return row.last_lecture_date == null || toNumber(row.days_since) > limit;
  });
  const totalStudents = ongoing.reduce((sum: number, row: any) => sum + toNumber(row.total_students), 0);
  const avgAttendance = ongoing.length ? ongoing.reduce((sum: number, row: any) => sum + toNumber(row.avg_attendance_pct), 0) / ongoing.length : 0;
  const atRisk = new Set([...lowAttendance, ...lowPerformance].map((row: any) => `${row.batch_no}|${row.name}`)).size;
  const weekAhead = Date.now() + 7 * 86400000;
  const examsThisWeek = upcomingExams.filter((row: any) => {
    const t = new Date(String(row.exam_date ?? '')).getTime();
    return Number.isFinite(t) && t <= weekAhead;
  }).length;
  const resultsToShow = finishedExams.filter((row: any) => String(row.paper_status ?? 'Pending') !== 'Shown').length;

  return (
    <div className="space-y-6 pb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Running batches" value={ongoing.length.toLocaleString('en-IN')} detail={`${totalStudents.toLocaleString('en-IN')} students · ${pct(avgAttendance)} avg. attendance`} icon={School} />
        <MetricCard label="Lectures today" value={todaysLectures.length.toLocaleString('en-IN')} detail="Recorded so far today" icon={CalendarCheck} />
        <MetricCard label="Quiet batches" value={quietBatches.length.toLocaleString('en-IN')} detail="No lecture recorded recently" icon={Clock} alert={quietBatches.length > 0} />
        <MetricCard label="Students at risk" value={atRisk.toLocaleString('en-IN')} detail="Low attendance or low marks" icon={AlertTriangle} alert={atRisk > 0} />
        <MetricCard label="Exams this week" value={examsThisWeek.toLocaleString('en-IN')} detail={`${resultsToShow.toLocaleString('en-IN')} results still to show`} icon={BookOpenCheck} />
      </div>

      <DashboardBand title="Today" description="Is every batch being taught and recorded?">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Section title="Today's lectures" hint="Sessions recorded today, with attendance count" href="/dashboard/daily-activities/lecture-taken" linkLabel="Lecture taken" icon={CalendarCheck} count={todaysLectures.length}>
            <DataTable columns={['Batch', 'Topic / trainer', 'Time', 'Present']}>
              {todaysLectures.length === 0 ? (
                <tr><td colSpan={4}><EmptyState>No lectures recorded yet today</EmptyState></td></tr>
              ) : todaysLectures.map((row: any, index: number) => (
                <tr key={`lecture-${row.take_id ?? row.batch_no ?? 'row'}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                  <td className="px-3 py-2">
                    <p className="truncate font-semibold text-slate-900">{row.lecture_topic || 'Session'}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{row.trainer || '-'} · {row.room_no || '-'}</p>
                  </td>
                  <td className="px-3 py-2 text-[11px] font-semibold text-slate-600 truncate">{row.timing || '-'}</td>
                  <td className="px-3 py-2 text-center font-bold text-slate-700">{toNumber(row.attendance_count)}</td>
                </tr>
              ))}
            </DataTable>
          </Section>
          <Section title="Batch activity" hint="Last lecture recorded per running batch — quiet batches first" href="/dashboard/daily-activities/lecture-taken" linkLabel="Record lecture" icon={Clock} count={quietBatches.length}>
            <DataTable columns={['Batch', 'Program', 'Last lecture', 'Last 7 days']}>
              {batchActivity.length === 0 ? (
                <tr><td colSpan={4}><EmptyState>No running batches</EmptyState></td></tr>
              ) : batchActivity.map((row: any, index: number) => {
                const quiet = quietBatches.includes(row);
                return (
                  <tr key={`activity-${row.Batch_Id ?? index}`} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                    <td className="px-3 py-2 text-slate-700 truncate">{row.training_program || '-'}<span className="ml-1 text-[10px] text-slate-400">{row.category || ''}</span></td>
                    <td className="px-3 py-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${quiet ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                        {row.last_lecture_date == null ? 'None in 120 days' : toNumber(row.days_since) === 0 ? 'Today' : `${toNumber(row.days_since)}d ago`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-700">{toNumber(row.lectures_last_7_days)}</td>
                  </tr>
                );
              })}
            </DataTable>
          </Section>
        </div>
      </DashboardBand>

      <DashboardBand title="Batch progress" description="Where each running batch stands">
        <Section title="Running batches" hint="Course progress, class size, attendance and students below 40% marks" href="/dashboard/masters/batch" linkLabel="Batch master" icon={Presentation} count={ongoing.length}>
          <DataTable columns={['Batch', 'Type', 'Program', 'Day', 'Progress', 'Students', 'Attendance', 'Below 40%']}>
            {ongoing.length === 0 ? (
              <tr><td colSpan={8}><EmptyState>No running batches</EmptyState></td></tr>
            ) : ongoing.map((row: any, index: number) => (
              <tr key={`ongoing-${row.Batch_Id ?? row.batch_no ?? 'row'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-3 py-2 text-[11px] text-slate-600 truncate">{row.batch_status || '-'}</td>
                <td className="px-3 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{toNumber(row.days_completed)}/{toNumber(row.duration_days)}</td>
                <td className="px-3 py-2"><ProgressBar value={row.percentage_complete} /></td>
                <td className="px-3 py-2 text-center font-semibold text-slate-700">{toNumber(row.total_students)}</td>
                <td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${riskTone(row.avg_attendance_pct)}`}>{pct(row.avg_attendance_pct)}</span></td>
                <td className="px-3 py-2 text-center font-bold text-rose-700">{toNumber(row.low_performing_students)}</td>
              </tr>
            ))}
          </DataTable>
        </Section>
      </DashboardBand>

      <DashboardBand title="Students needing attention" description="Follow up before they fall behind">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title="Low attendance" hint="Below the attendance threshold — call or counsel" href="/dashboard/reports/attendance" linkLabel="Attendance report" icon={AlertTriangle} count={lowAttendance.length}>
          <DataTable columns={['Name', 'Batch', 'Program', 'Att.']}>
            {lowAttendance.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No attendance exceptions</EmptyState></td></tr>
            ) : lowAttendance.map((row: any, index: number) => (
              <tr key={`low-attendance-${row.batch_no || 'batch'}-${row.name || 'student'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-3 py-2 font-semibold text-slate-900 truncate">{row.name || '-'}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-3 py-2 text-slate-600 truncate">{row.training_program || '-'}</td>
                <td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${riskTone(row.attendance_pct)}`}>{pct(row.attendance_pct)}</span></td>
              </tr>
            ))}
          </DataTable>
        </Section>

        <Section title="Low marks" hint="Weak scores — plan extra sessions or revision" href="/dashboard/reports/final-exam" linkLabel="Final exam report" icon={MessageSquareWarning} count={lowPerformance.length}>
          <DataTable columns={['Name', 'Batch', 'Program', 'Score']}>
            {lowPerformance.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No performance exceptions</EmptyState></td></tr>
            ) : lowPerformance.map((row: any, index: number) => (
              <tr key={`low-performance-${row.batch_no || 'batch'}-${row.name || 'student'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-3 py-2 font-semibold text-slate-900 truncate">{row.name || '-'}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-3 py-2 text-slate-600 truncate">{row.training_program || '-'}</td>
                <td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${riskTone(row.marks_pct, 60)}`}>{pct(row.marks_pct)}</span></td>
              </tr>
            ))}
          </DataTable>
        </Section>
      </div>
      </DashboardBand>

      <DashboardBand title="Assessments" description="Papers ready on time, results shown to students">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title="Upcoming exams" hint="Update paper status as it is prepared and approved" href="/dashboard/daily-activities/final-exam-taken" linkLabel="Final exams" icon={BookOpenCheck} count={upcomingExams.length}>
          <DataTable columns={['Batch', 'Program', 'Date', 'Status']}>
            {upcomingExams.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No upcoming assessment records</EmptyState></td></tr>
            ) : upcomingExams.map((row: any, index: number) => {
              const key = `upcoming_exam:${row.entity_key}`;
              const status = String(fieldOverrides[key] ?? row.paper_status ?? 'Not Started');
              return (
                <tr key={`upcoming-exam-${row.entity_key ?? `${row.batch_no || 'batch'}-${row.exam_date || 'date'}`}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 truncate">{formatDate(row.exam_date)}</td>
                  <td className="px-3 py-2">
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

        <Section title="Completed exams" hint="Mark papers checked and set the date results are shown" href="/dashboard/daily-activities/generate-final-result" linkLabel="Generate result" icon={Award} count={finishedExams.length}>
          <DataTable columns={['Batch', 'Program', 'Date', 'Status', 'Review', 'Avg.']}>
            {finishedExams.length === 0 ? (
              <tr><td colSpan={6}><EmptyState>No completed assessment records</EmptyState></td></tr>
            ) : finishedExams.map((row: any, index: number) => {
              const statusKey = `finished_exam:${row.entity_key}:status`;
              const dateKey = `finished_exam:${row.entity_key}:date`;
              const saveKey = `finished_exam:${row.entity_key}`;
              const status = String(fieldOverrides[statusKey] ?? row.paper_status ?? 'Pending');
              const showingDate = String(fieldOverrides[dateKey] ?? dateInputValue(row.paper_showing_date));
              return (
                <tr key={`finished-exam-${row.entity_key ?? `${row.batch_no || 'batch'}-${row.exam_date || 'date'}`}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 truncate">{formatDate(row.exam_date)}</td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2 font-bold text-slate-700">{pct(row.average_marks_pct)}</td>
                </tr>
              );
            })}
          </DataTable>
        </Section>
      </div>
      </DashboardBand>

      <DashboardBand title="Course close-out" description="Reviews collected and convocations planned">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title="Google reviews" hint="Reviews received per batch — enter the count as they come in" href="/dashboard/daily-activities/feedback" linkLabel="Feedback" icon={Star} count={googleReviews.length}>
          <DataTable columns={['Batch', 'Program', 'End', 'Responses']}>
            {googleReviews.length === 0 ? (
              <tr><td colSpan={4}><EmptyState>No feedback records in the current window</EmptyState></td></tr>
            ) : googleReviews.map((row: any, index: number) => {
              const key = `google_review:${row.entity_key}`;
              const value = fieldOverrides[key] ?? row.reviews_received ?? 0;
              return (
                <tr key={`google-review-${row.entity_key ?? row.batch_no ?? 'row'}-${index}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 truncate">{formatDate(row.end_date)}</td>
                  <td className="px-3 py-2">
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

        <Section title="Upcoming convocations" hint="Batches finishing soon and their convocation dates" icon={GraduationCap} count={upcomingConvocations.length}>
          <DataTable columns={['Batch', 'Program', 'End', 'Date', 'Location']}>
            {upcomingConvocations.length === 0 ? (
              <tr><td colSpan={5}><EmptyState>No upcoming event records</EmptyState></td></tr>
            ) : upcomingConvocations.map((row: any, index: number) => (
              <tr key={`convocation-${row.id ?? row.batch_no ?? 'row'}-${row.convocation_date ?? 'date'}-${index}`} className="hover:bg-slate-50/70">
                <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-700 truncate">{toBatchNumber(row.batch_no)}</td>
                <td className="px-3 py-2 font-semibold text-slate-900 truncate">{row.training_program || '-'}</td>
                <td className="px-3 py-2 text-slate-600 truncate">{formatDate(row.end_date)}</td>
                <td className="px-3 py-2 text-slate-600 truncate">{formatDate(row.convocation_date)}</td>
                <td className="px-3 py-2 text-slate-600 truncate">{row.location || '-'}</td>
              </tr>
            ))}
          </DataTable>
        </Section>
      </div>
      </DashboardBand>
    </div>
  );
}
