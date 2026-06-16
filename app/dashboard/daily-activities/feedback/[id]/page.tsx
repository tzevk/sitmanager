'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type FeedbackFormRow = {
  id: number;
  stage_percent: number;
  training_program: string | null;
  batch_no: string | null;
  feedback_date: string | null;
  published: 0 | 1;
};

type SubmissionRow = {
  id: number;
  student_id: number;
  student_code: string | null;
  student_name: string | null;
  answers_json: string;
  submitted_at: string | null;
};

type ParsedAnswers = {
  trainingProgram?: Record<string, unknown>;
  trainingExecutive?: {
    ratings?: Record<string, unknown>;
    otherSuggestions?: unknown;
  };
  trainers?: {
    entries?: Array<{
      trainerName?: unknown;
      ratings?: Record<string, unknown>;
    }>;
    viewsOnTrainer?: unknown;
    viewsOnSiteVisit?: unknown;
  };
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm}`;
}

function prettifyKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (ch) => ch.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value.trim() || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '—';
}

export default function FeedbackResponsesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const formId = params.id;

  const { canView, loading: permLoading } = useResourcePermissions('feedback1');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FeedbackFormRow | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    if (!formId) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/daily-activities/feedback/${formId}?include=submissions`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load feedback responses');
        }
        setForm(data.row ?? null);
        setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load feedback responses');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [formId]);

  const parsedSubmissions = useMemo(() => {
    return submissions.map((s) => {
      let answers: ParsedAnswers | null = null;
      try {
        answers = JSON.parse(s.answers_json || '{}') as ParsedAnswers;
      } catch {
        answers = null;
      }
      return {
        ...s,
        answers,
      };
    });
  }, [submissions]);

  if (permLoading || loading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view feedback responses." />;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-6 py-5 shadow-[0_10px_30px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Student Feedback Responses</h2>
            <p className="text-[12px] text-white/80 mt-0.5">
              {form?.training_program || 'Training Program'}
              {form?.batch_no ? ` • Batch ${form.batch_no}` : ''}
              {form?.feedback_date ? ` • ${formatDate(form.feedback_date)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/daily-activities/feedback')}
            className="h-9 px-4 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold"
          >
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700">Responses</h3>
          <span className="text-[11px] text-slate-500">{parsedSubmissions.length} submissions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Student Name</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Student Code</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Response</th>
                <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {!parsedSubmissions.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-slate-400">No student responses submitted yet.</td>
                </tr>
              )}

              {parsedSubmissions.map((s) => (
                <tr key={s.id} className="align-top border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 text-xs font-semibold text-slate-800">{s.student_name || '—'}</td>
                  <td className="py-2.5 px-3 text-xs font-mono text-slate-600">{s.student_code || '—'}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">
                    {s.answers ? (
                      <details>
                        <summary className="cursor-pointer text-[#2E3093] font-semibold">View Response</summary>
                        <div className="mt-2 space-y-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <p className="text-[11px] font-bold text-slate-700 mb-1">Training Program</p>
                            {Object.entries(s.answers.trainingProgram || {}).length ? (
                              <div className="space-y-1">
                                {Object.entries(s.answers.trainingProgram || {}).map(([k, v]) => (
                                  <p key={k} className="leading-5">
                                    <span className="font-semibold">{prettifyKey(k)}:</span> {displayValue(v)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p>—</p>
                            )}
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <p className="text-[11px] font-bold text-slate-700 mb-1">Training Executive</p>
                            {Object.entries(s.answers.trainingExecutive?.ratings || {}).length ? (
                              <div className="space-y-1 mb-1">
                                {Object.entries(s.answers.trainingExecutive?.ratings || {}).map(([k, v]) => (
                                  <p key={k} className="leading-5">
                                    <span className="font-semibold">{prettifyKey(k)}:</span> {displayValue(v)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p>—</p>
                            )}
                            <p className="leading-5">
                              <span className="font-semibold">Other Suggestions:</span> {displayValue(s.answers.trainingExecutive?.otherSuggestions)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <p className="text-[11px] font-bold text-slate-700 mb-1">Trainers</p>
                            {(s.answers.trainers?.entries || []).length ? (
                              <div className="space-y-1.5 mb-1">
                                {(s.answers.trainers?.entries || []).map((entry, idx) => (
                                  <div key={idx} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                    <p className="font-semibold text-slate-800">{displayValue(entry.trainerName) || `Trainer ${idx + 1}`}</p>
                                    <div className="mt-1 space-y-0.5">
                                      {Object.entries(entry.ratings || {}).map(([k, v]) => (
                                        <p key={k} className="leading-5">
                                          <span className="font-semibold">{prettifyKey(k)}:</span> {displayValue(v)}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p>—</p>
                            )}
                            <p className="leading-5">
                              <span className="font-semibold">Views On Trainer:</span> {displayValue(s.answers.trainers?.viewsOnTrainer)}
                            </p>
                            <p className="leading-5">
                              <span className="font-semibold">Views On Site Visit:</span> {displayValue(s.answers.trainers?.viewsOnSiteVisit)}
                            </p>
                          </div>
                        </div>
                      </details>
                    ) : (
                      <pre className="whitespace-pre-wrap text-[11px]">{s.answers_json || '—'}</pre>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(s.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
