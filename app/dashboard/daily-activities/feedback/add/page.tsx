'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type StagePercent = 30 | 60 | 90;

type QuestionType = 'text' | 'textarea' | 'yesno' | 'multiple_choice';

type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
};

type FeedbackFormSchema = {
  version: 1;
  ratingOptions: string[]; // e.g. ['5','4','3','2','1']
  trainingProgram: {
    title: string;
    questions: Question[];
  };
  trainingExecutive: {
    title: string;
    ratingHint: string;
    questions: Array<{ id: string; label: string }>; // rating + comment implied
    otherSuggestionsLabel: string;
  };
  trainers: {
    title: string;
    ratingHint: string;
    trainerNameLabel: string;
    allowMultiple: boolean;
    trainerColumns: number; // number of trainer columns to render in the grid/print layout
    questions: Array<{ id: string; label: string }>; // rating grid implied
    viewsOnTrainerLabel: string;
    viewsOnSiteVisitLabel: string;
    selectedTrainers: Array<{ facultyId: number; name: string }>; // trainers picked for the trainerColumns
  };
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.min(max, Math.max(min, i));
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const defaultSchema = (): FeedbackFormSchema => ({
  version: 1,
  ratingOptions: ['5', '4', '3', '2', '1'],
  trainingProgram: {
    title: 'ABOUT TRAINING PROGRAM',
    questions: [
      { id: newId(), label: 'a. What did you like most about this Training?', type: 'textarea' },
      { id: newId(), label: 'b. What aspect of Training could be improved?', type: 'textarea' },
      { id: newId(), label: 'c. Do you feel you can implement the learning from training program at workplace?', type: 'yesno' },
      { id: newId(), label: 'If yes till what extent (%)', type: 'text' },
    ],
  },
  trainingExecutive: {
    title: 'ABOUT TRAINING EXECUTIVE',
    ratingHint: 'Ratings : 5 – Excellent, 4 – Very Good, 3 – Good, 2 – Satisfactory, 1 – Unsatisfactory',
    questions: [
      { id: newId(), label: 'Proper lecture planning and implementation.' },
      { id: newId(), label: 'Instruction were given well in advance before Test, Assignment and Final Examination.' },
      { id: newId(), label: 'Test Papers and Assignments were checked properly and showed within a week.' },
      { id: newId(), label: 'All the Nontechnical queries were handled by Training executives up to the expectations' },
      { id: newId(), label: 'All the Technical queries were handled by Training coordinators up to the expectations' },
    ],
    otherSuggestionsLabel: 'Any other Suggestions if any...',
  },
  trainers: {
    title: 'ABOUT TRAINERS',
    ratingHint: 'Ratings : 5 – Excellent, 4 – Very Good, 3 – Good, 2 – Satisfactory, 1 – Unsatisfactory',
    trainerNameLabel: 'Write Name of Trainer',
    allowMultiple: true,
    trainerColumns: 1,
    questions: [
      { id: newId(), label: 'Objective of the Training Clearly Defined' },
      { id: newId(), label: 'Participation and Interaction encouraged during Training till understanding' },
      { id: newId(), label: 'The contents was organized and easy to understand' },
      { id: newId(), label: 'Training Handouts distributed were helpful / written notes were given' },
      { id: newId(), label: 'Trainer was knowledgeable about the Training topics' },
      { id: newId(), label: 'Trainer was well prepared, Punctual and Disciplined' },
      { id: newId(), label: 'Doubts solving during the lecture' },
      { id: newId(), label: 'Assignments provided are specific, relevant to the topic or whether it is very lengthy.' },
    ],
    viewsOnTrainerLabel: 'i. Your views on Trainer',
    viewsOnSiteVisitLabel: 'j. Your views on Site Visit',
    selectedTrainers: [],
  },
});

function normalizeSchema(raw: unknown): FeedbackFormSchema {
  const d = defaultSchema();
  const s = (raw ?? {}) as Partial<FeedbackFormSchema>;
  return {
    ...d,
    ...s,
    version: 1,
    ratingOptions: Array.isArray(s.ratingOptions) && s.ratingOptions.length ? s.ratingOptions : d.ratingOptions,
    trainingProgram: {
      ...d.trainingProgram,
      ...(s.trainingProgram ?? {}),
      questions:
        Array.isArray(s.trainingProgram?.questions) && s.trainingProgram?.questions?.length
          ? (s.trainingProgram.questions as Question[])
          : d.trainingProgram.questions,
    },
    trainingExecutive: {
      ...d.trainingExecutive,
      ...(s.trainingExecutive ?? {}),
      questions:
        Array.isArray(s.trainingExecutive?.questions) && s.trainingExecutive?.questions?.length
          ? (s.trainingExecutive.questions as Array<{ id: string; label: string }>)
          : d.trainingExecutive.questions,
    },
    trainers: {
      ...d.trainers,
      ...(s.trainers ?? {}),
      allowMultiple: typeof s.trainers?.allowMultiple === 'boolean' ? s.trainers.allowMultiple : d.trainers.allowMultiple,
      trainerColumns: clampInt(s.trainers?.trainerColumns, 1, 6, d.trainers.trainerColumns),
      questions:
        Array.isArray(s.trainers?.questions) && s.trainers?.questions?.length
          ? (s.trainers.questions as Array<{ id: string; label: string }>)
          : d.trainers.questions,
      selectedTrainers: Array.isArray(s.trainers?.selectedTrainers)
        ? (s.trainers.selectedTrainers as Array<{ facultyId: number; name: string }>)
        : d.trainers.selectedTrainers,
    },
  };
}

function safeJsonParse<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function parseRatingOptions(raw: string) {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ['5', '4', '3', '2', '1'];
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;
  const copy = items.slice();
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

function MiniIconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-300'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function FeedbackAddPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const editId = sp.get('id');

  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('feedback1');
  const canEditPage = useMemo(() => (editId ? canUpdate : canCreate), [editId, canCreate, canUpdate]);

  const [loading, setLoading] = useState(false);
  const [stagePercent, setStagePercent] = useState<StagePercent>(30);
  const [trainingProgram, setTrainingProgram] = useState('');
  const [batchId, setBatchId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [date, setDate] = useState('');
  const [schema, setSchema] = useState<FeedbackFormSchema>(() => defaultSchema());
  const [facultyOptions, setFacultyOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [programOptions, setProgramOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [batchOptions, setBatchOptions] = useState<Array<{ id: number; batchNo: string }>>([]);
  const [formLink, setFormLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const previewTrainerColumns = useMemo(() => {
    const desired = clampInt(schema.trainers.trainerColumns, 1, 6, 1);
    return Array.from({ length: desired }, (_, idx) => schema.trainers.selectedTrainers[idx] ?? { facultyId: 0, name: '' });
  }, [schema.trainers.trainerColumns, schema.trainers.selectedTrainers]);

  const trainingProgramOptionNames = useMemo(() => new Set(programOptions.map((o) => o.name)), [programOptions]);

  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';
  const inputCls =
    'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium';

  const loadForEdit = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-activities/feedback/${editId}`);
      const json = await res.json();
      const r = json.row;
      if (!r) return;

      setStagePercent((r.stage_percent as StagePercent) || 30);
      setTrainingProgram(r.training_program || '');
      setBatchId(r.batch_id ? String(r.batch_id) : '');
      setBatchNo(r.batch_no || '');
      setDate(r.feedback_date ? String(r.feedback_date).slice(0, 10) : '');
      if (r.id) {
        setFormLink(`${window.location.origin}/public/training-feedback/${r.id}`);
      }

      const parsed = safeJsonParse<FeedbackFormSchema>(r.schema_json, defaultSchema());
      setSchema(normalizeSchema(parsed));
    } catch (e) {
      console.error('Failed to load feedback form', e);
    } finally {
      setLoading(false);
    }
  }, [editId]);

  useEffect(() => {
    loadForEdit();
  }, [loadForEdit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Best-effort: populate trainer dropdown from faculty master.
        // If current user lacks `faculty.view`, API may 403 — we just fall back to empty.
        // The API caps `limit` at 100, so page through all results to get the full list.
        const rows: Array<{ Faculty_Id?: number; Faculty_Name?: string; IsActive?: number | boolean }> = [];
        let page = 1;
        let totalPages = 1;
        do {
          const res = await fetch(`/api/masters/faculty?limit=100&page=${page}`);
          if (!res.ok) return;
          const json = await res.json();
          rows.push(...(Array.isArray(json?.rows) ? json.rows : []));
          totalPages = Number(json?.pagination?.totalPages) || 1;
          page += 1;
        } while (page <= totalPages);

        const options = rows
          .filter((r) => {
            if (!r?.Faculty_Id) return false;
            if (r?.IsActive === 0) return false;
            return true;
          })
          .map((r) => ({
            id: Number(r.Faculty_Id),
            name: String(r?.Faculty_Name || '').trim(),
          }))
          .filter((o) => o.id && o.name);

        if (!cancelled) setFacultyOptions(options);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Best-effort: populate Training Program dropdown from Course master.
        // If current user lacks `course.view`, API may 403 — we just fall back to empty.
        const res = await fetch('/api/masters/course?limit=100&page=1&isActive=1');
        if (!res.ok) return;
        const json = await res.json();
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        const options = rows
          .filter((r: { Course_Id?: number; Course_Name?: string; IsActive?: number | boolean }) => {
            if (!r?.Course_Id) return false;
            if (r?.IsActive === 0) return false;
            return true;
          })
          .map((r: { Course_Id: number; Course_Name?: string }) => ({
            id: Number(r.Course_Id),
            name: String(r?.Course_Name || '').trim(),
          }))
          .filter((o: { id: number; name: string }) => o.id && o.name);

        if (!cancelled) setProgramOptions(options);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Populate Batch dropdown from Batch master, scoped to the selected Training Program (course).
        const courseId = programOptions.find((o) => o.name === trainingProgram)?.id;
        const qs = new URLSearchParams({ limit: '100', page: '1' });
        if (courseId) qs.set('courseId', String(courseId));

        const res = await fetch(`/api/masters/batch?${qs.toString()}`);
        if (!res.ok) return;
        const json = await res.json();
        const rows = Array.isArray(json?.rows) ? json.rows : [];
        const options = rows
          .filter((r: { id?: number; batchNo?: string }) => r?.id)
          .map((r: { id: number; batchNo?: string }) => ({ id: Number(r.id), batchNo: String(r?.batchNo || '').trim() }));

        if (!cancelled) setBatchOptions(options);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trainingProgram, programOptions]);

  const save = async () => {
    if (!canEditPage) return;
    setLoading(true);
    try {
      const payload = {
        stagePercent,
        trainingProgram,
        batchId: batchId ? Number(batchId) : null,
        batchNo,
        date: date || null,
        schema,
      };

      const url = editId ? `/api/daily-activities/feedback/${editId}` : '/api/daily-activities/feedback';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        const id = editId || j.id;
        if (id) setFormLink(`${window.location.origin}/public/training-feedback/${id}`);
        if (!editId && j.id) router.replace(`/dashboard/daily-activities/feedback/add?id=${j.id}`);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Failed to save');
      }
    } catch {
      alert('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const copyFormLink = async () => {
    try {
      await navigator.clipboard.writeText(formLink);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      // ignore
    }
  };

  const ratingOptionsCsv = schema.ratingOptions.join(', ');

  return (
    <div className="space-y-6">
      {permLoading ? (
        <PermissionLoading />
      ) : !canView ? (
        <AccessDenied message="You do not have permission to view feedback." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">{editId ? 'Edit' : 'Create'} Training Feedback Form</h2>
                <p className="text-xs text-white/80 mt-0.5">Form builder (add/remove questions and options)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/dashboard/daily-activities/feedback')}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-bold hover:bg-white/15 transition-colors"
                  type="button"
                >
                  Back
                </button>
                <button
                  onClick={save}
                  disabled={!canEditPage || loading}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#FAE452] text-[#2E3093] text-sm font-black disabled:opacity-50"
                  type="button"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[160px_1fr_180px_180px] gap-4">
                <div>
                  <label className={labelCls}>Completed %</label>
                  <select
                    value={stagePercent}
                    onChange={(e) => setStagePercent(Number(e.target.value) as StagePercent)}
                    className={inputCls}
                    disabled={!canEditPage}
                  >
                    <option value={30}>30%</option>
                    <option value={60}>60%</option>
                    <option value={90}>90%</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Training Program</label>
                  <select
                    className={inputCls}
                    value={trainingProgram}
                    onChange={(e) => setTrainingProgram(e.target.value)}
                    disabled={!canEditPage}
                  >
                    <option value="">Select Training Program</option>
                    {trainingProgram && !trainingProgramOptionNames.has(trainingProgram) && (
                      <option value={trainingProgram}>Current: {trainingProgram}</option>
                    )}
                    {programOptions.map((opt) => (
                      <option key={opt.id} value={opt.name}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                  {programOptions.length === 0 && (
                    <div className="text-[11px] text-slate-400 mt-1">No training programs loaded</div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Batch No.</label>
                  <select
                    className={inputCls}
                    value={batchId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setBatchId(id);
                      const opt = batchOptions.find((o) => String(o.id) === id);
                      setBatchNo(opt?.batchNo || '');
                    }}
                    disabled={!canEditPage}
                  >
                    <option value="">Select Batch</option>
                    {batchId && !batchOptions.some((o) => String(o.id) === batchId) && (
                      <option value={batchId}>Current: {batchNo || batchId}</option>
                    )}
                    {batchOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.batchNo}
                      </option>
                    ))}
                  </select>
                  {batchOptions.length === 0 && (
                    <div className="text-[11px] text-slate-400 mt-1">No batches loaded</div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={!canEditPage}
                  />
                </div>
              </div>

              {formLink && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Student Feedback Link</div>
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 break-all">
                      {formLink}
                    </div>
                    <button
                      type="button"
                      onClick={copyFormLink}
                      className="px-4 py-2 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252780] transition-colors shrink-0"
                    >
                      {linkCopied ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Students open this link and enter the last 3 digits of their student code to fill the form.
                    Publish this form from the feedback list to make the link active.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* BUILDER */}
                <div className="form-card p-3 sm:p-5 space-y-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="section-title">Builder</div>
                      <div className="text-xs text-slate-500 mt-1">Edit titles, questions, options and order</div>
                    </div>
                    <div className="text-[11px] text-slate-500">Schema v{schema.version}</div>
                  </div>

                  {/* Ratings settings */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/30">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Ratings</div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3">
                      <input
                        className={inputCls + ' text-[11px]'}
                        value={ratingOptionsCsv}
                        onChange={(e) => setSchema((p) => ({ ...p, ratingOptions: parseRatingOptions(e.target.value) }))}
                        disabled={!canEditPage}
                        placeholder="Rating options (comma separated)"
                      />
                      <div className="text-[11px] text-slate-500 flex items-center">
                        Used for Executive + Trainers sections
                      </div>
                    </div>
                  </div>

                  {/* Training Program */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2">
                      <div className="text-xs font-black text-slate-700">Training Program</div>
                    </div>
                    <div className="p-4 space-y-3">
                      <input
                        className={inputCls}
                        value={schema.trainingProgram.title}
                        onChange={(e) => setSchema((p) => ({ ...p, trainingProgram: { ...p.trainingProgram, title: e.target.value } }))}
                        disabled={!canEditPage}
                      />

                      <div className="space-y-3">
                        {schema.trainingProgram.questions.map((q, idx) => (
                          <div key={q.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                className={inputCls}
                                value={q.label}
                                onChange={(e) =>
                                  setSchema((p) => ({
                                    ...p,
                                    trainingProgram: {
                                      ...p.trainingProgram,
                                      questions: p.trainingProgram.questions.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x)),
                                    },
                                  }))
                                }
                                disabled={!canEditPage}
                              />
                              <div className="flex items-center gap-1 sm:pt-0.5">
                                <MiniIconButton
                                  title="Move up"
                                  disabled={!canEditPage || idx === 0}
                                  onClick={() =>
                                    setSchema((p) => ({
                                      ...p,
                                      trainingProgram: {
                                        ...p.trainingProgram,
                                        questions: moveItem(p.trainingProgram.questions, idx, idx - 1),
                                      },
                                    }))
                                  }
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
                                  </svg>
                                </MiniIconButton>
                                <MiniIconButton
                                  title="Move down"
                                  disabled={!canEditPage || idx === schema.trainingProgram.questions.length - 1}
                                  onClick={() =>
                                    setSchema((p) => ({
                                      ...p,
                                      trainingProgram: {
                                        ...p.trainingProgram,
                                        questions: moveItem(p.trainingProgram.questions, idx, idx + 1),
                                      },
                                    }))
                                  }
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                  </svg>
                                </MiniIconButton>
                                <MiniIconButton
                                  title="Remove"
                                  disabled={!canEditPage}
                                  onClick={() =>
                                    setSchema((p) => ({
                                      ...p,
                                      trainingProgram: {
                                        ...p.trainingProgram,
                                        questions: p.trainingProgram.questions.filter((x) => x.id !== q.id),
                                      },
                                    }))
                                  }
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                                  </svg>
                                </MiniIconButton>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className={labelCls}>Type</label>
                                <select
                                  className={inputCls + ' text-xs'}
                                  value={q.type}
                                  onChange={(e) =>
                                    setSchema((p) => ({
                                      ...p,
                                      trainingProgram: {
                                        ...p.trainingProgram,
                                        questions: p.trainingProgram.questions.map((x) =>
                                          x.id === q.id ? { ...x, type: e.target.value as QuestionType } : x
                                        ),
                                      },
                                    }))
                                  }
                                  disabled={!canEditPage}
                                >
                                  <option value="text">Text</option>
                                  <option value="textarea">Textarea</option>
                                  <option value="yesno">Yes/No</option>
                                  <option value="multiple_choice">Multiple Choice</option>
                                </select>
                              </div>

                              {q.type === 'multiple_choice' ? (
                                <div>
                                  <div className="flex items-center justify-between">
                                    <label className={labelCls}>Options</label>
                                    <button
                                      type="button"
                                      disabled={!canEditPage}
                                      onClick={() =>
                                        setSchema((p) => ({
                                          ...p,
                                          trainingProgram: {
                                            ...p.trainingProgram,
                                            questions: p.trainingProgram.questions.map((x) =>
                                              x.id === q.id
                                                ? { ...x, options: [...(x.options ?? []), `Option ${(x.options?.length ?? 0) + 1}`] }
                                                : x
                                            ),
                                          },
                                        }))
                                      }
                                      className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      Add Option
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(q.options ?? []).length === 0 ? (
                                      <div className="text-xs text-slate-400">No options</div>
                                    ) : (
                                      (q.options ?? []).map((opt, optIdx) => (
                                        <div key={optIdx} className="flex items-center gap-2">
                                          <input
                                            className={inputCls + ' text-xs'}
                                            value={opt}
                                            onChange={(e) =>
                                              setSchema((p) => ({
                                                ...p,
                                                trainingProgram: {
                                                  ...p.trainingProgram,
                                                  questions: p.trainingProgram.questions.map((x) =>
                                                    x.id === q.id
                                                      ? {
                                                          ...x,
                                                          options: (x.options ?? []).map((o, i) => (i === optIdx ? e.target.value : o)),
                                                        }
                                                      : x
                                                  ),
                                                },
                                              }))
                                            }
                                            disabled={!canEditPage}
                                          />
                                          <MiniIconButton
                                            title="Remove option"
                                            disabled={!canEditPage}
                                            onClick={() =>
                                              setSchema((p) => ({
                                                ...p,
                                                trainingProgram: {
                                                  ...p.trainingProgram,
                                                  questions: p.trainingProgram.questions.map((x) =>
                                                    x.id === q.id ? { ...x, options: (x.options ?? []).filter((_, i) => i !== optIdx) } : x
                                                  ),
                                                },
                                              }))
                                            }
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                                            </svg>
                                          </MiniIconButton>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 flex items-center">Preview updates on the right</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={!canEditPage}
                        onClick={() =>
                          setSchema((p) => ({
                            ...p,
                            trainingProgram: {
                              ...p.trainingProgram,
                              questions: [...p.trainingProgram.questions, { id: newId(), label: 'New question', type: 'textarea' }],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Question
                      </button>
                    </div>
                  </div>

                  {/* Training Executive */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2">
                      <div className="text-xs font-black text-slate-700">Training Executive</div>
                    </div>
                    <div className="p-4 space-y-3">
                      <input
                        className={inputCls}
                        value={schema.trainingExecutive.title}
                        onChange={(e) => setSchema((p) => ({ ...p, trainingExecutive: { ...p.trainingExecutive, title: e.target.value } }))}
                        disabled={!canEditPage}
                      />
                      <input
                        className={inputCls + ' text-[11px]'}
                        value={schema.trainingExecutive.ratingHint}
                        onChange={(e) => setSchema((p) => ({ ...p, trainingExecutive: { ...p.trainingExecutive, ratingHint: e.target.value } }))}
                        disabled={!canEditPage}
                      />

                      <div className="space-y-3">
                        {schema.trainingExecutive.questions.map((q, idx) => (
                          <div key={q.id} className="flex flex-col sm:flex-row gap-2">
                            <input
                              className={inputCls}
                              value={q.label}
                              onChange={(e) =>
                                setSchema((p) => ({
                                  ...p,
                                  trainingExecutive: {
                                    ...p.trainingExecutive,
                                    questions: p.trainingExecutive.questions.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x)),
                                  },
                                }))
                              }
                              disabled={!canEditPage}
                            />
                            <div className="flex items-center gap-1 sm:pt-0.5">
                              <MiniIconButton
                                title="Move up"
                                disabled={!canEditPage || idx === 0}
                                onClick={() =>
                                  setSchema((p) => ({
                                    ...p,
                                    trainingExecutive: {
                                      ...p.trainingExecutive,
                                      questions: moveItem(p.trainingExecutive.questions, idx, idx - 1),
                                    },
                                  }))
                                }
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
                                </svg>
                              </MiniIconButton>
                              <MiniIconButton
                                title="Move down"
                                disabled={!canEditPage || idx === schema.trainingExecutive.questions.length - 1}
                                onClick={() =>
                                  setSchema((p) => ({
                                    ...p,
                                    trainingExecutive: {
                                      ...p.trainingExecutive,
                                      questions: moveItem(p.trainingExecutive.questions, idx, idx + 1),
                                    },
                                  }))
                                }
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                </svg>
                              </MiniIconButton>
                              <MiniIconButton
                                title="Remove"
                                disabled={!canEditPage}
                                onClick={() =>
                                  setSchema((p) => ({
                                    ...p,
                                    trainingExecutive: {
                                      ...p.trainingExecutive,
                                      questions: p.trainingExecutive.questions.filter((x) => x.id !== q.id),
                                    },
                                  }))
                                }
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                                </svg>
                              </MiniIconButton>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label className={labelCls}>Other suggestions label</label>
                          <button
                            type="button"
                            disabled={!canEditPage}
                            onClick={() =>
                              setSchema((p) => ({
                                ...p,
                                trainingExecutive: {
                                  ...p.trainingExecutive,
                                  questions: [...p.trainingExecutive.questions, { id: newId(), label: 'New row' }],
                                },
                              }))
                            }
                            className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                          >
                            Add Row
                          </button>
                        </div>
                        <input
                          className={inputCls + ' text-xs'}
                          value={schema.trainingExecutive.otherSuggestionsLabel}
                          onChange={(e) => setSchema((p) => ({ ...p, trainingExecutive: { ...p.trainingExecutive, otherSuggestionsLabel: e.target.value } }))}
                          disabled={!canEditPage}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trainers */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2">
                      <div className="text-xs font-black text-slate-700">Trainers</div>
                    </div>
                    <div className="p-4 space-y-3">
                      <input
                        className={inputCls}
                        value={schema.trainers.title}
                        onChange={(e) => setSchema((p) => ({ ...p, trainers: { ...p.trainers, title: e.target.value } }))}
                        disabled={!canEditPage}
                      />
                      <input
                        className={inputCls + ' text-[11px]'}
                        value={schema.trainers.ratingHint}
                        onChange={(e) => setSchema((p) => ({ ...p, trainers: { ...p.trainers, ratingHint: e.target.value } }))}
                        disabled={!canEditPage}
                      />
                      <div>
                        <label className={labelCls}>Trainer name label</label>
                        <input
                          className={inputCls}
                          value={schema.trainers.trainerNameLabel}
                          onChange={(e) => setSchema((p) => ({ ...p, trainers: { ...p.trainers, trainerNameLabel: e.target.value } }))}
                          disabled={!canEditPage}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Multiple trainers</label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mt-1">
                          <input
                            type="checkbox"
                            checked={schema.trainers.allowMultiple}
                            onChange={(e) =>
                              setSchema((p) => ({
                                ...p,
                                trainers: { ...p.trainers, allowMultiple: e.target.checked },
                              }))
                            }
                            disabled={!canEditPage}
                          />
                          Allow adding feedback for multiple trainers
                        </label>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Users can add multiple trainer sections while filling.
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/40">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Trainer Columns</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Adds extra trainer columns in the Trainers grid</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MiniIconButton
                              title="Remove column"
                              disabled={!canEditPage || schema.trainers.trainerColumns <= 1}
                              onClick={() =>
                                setSchema((p) => ({
                                  ...p,
                                  trainers: {
                                    ...p.trainers,
                                    trainerColumns: clampInt(p.trainers.trainerColumns - 1, 1, 6, 1),
                                  },
                                }))
                              }
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                              </svg>
                            </MiniIconButton>
                            <div className="min-w-10 text-center text-sm font-black text-slate-800">{schema.trainers.trainerColumns}</div>
                            <MiniIconButton
                              title="Add column"
                              disabled={!canEditPage || schema.trainers.trainerColumns >= 6}
                              onClick={() =>
                                setSchema((p) => ({
                                  ...p,
                                  trainers: {
                                    ...p.trainers,
                                    trainerColumns: clampInt(p.trainers.trainerColumns + 1, 1, 6, 1),
                                  },
                                }))
                              }
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            </MiniIconButton>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {schema.trainers.questions.map((q, idx) => (
                          <div key={q.id} className="flex flex-col sm:flex-row gap-2">
                            <input
                              className={inputCls}
                              value={q.label}
                              onChange={(e) =>
                                setSchema((p) => ({
                                  ...p,
                                  trainers: {
                                    ...p.trainers,
                                    questions: p.trainers.questions.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x)),
                                  },
                                }))
                              }
                              disabled={!canEditPage}
                            />
                            <div className="flex items-center gap-1 sm:pt-0.5">
                              <MiniIconButton
                                title="Move up"
                                disabled={!canEditPage || idx === 0}
                                onClick={() =>
                                  setSchema((p) => ({
                                    ...p,
                                    trainers: {
                                      ...p.trainers,
                                      questions: moveItem(p.trainers.questions, idx, idx - 1),
                                    },
                                  }))
                                }
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
                                </svg>
                              </MiniIconButton>
                              <MiniIconButton
                                title="Move down"
                                disabled={!canEditPage || idx === schema.trainers.questions.length - 1}
                                onClick={() =>
                                  setSchema((p) => ({
                                    ...p,
                                    trainers: {
                                      ...p.trainers,
                                      questions: moveItem(p.trainers.questions, idx, idx + 1),
                                    },
                                  }))
                                }
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                </svg>
                              </MiniIconButton>
                              <MiniIconButton
                                title="Remove"
                                disabled={!canEditPage}
                                onClick={() =>
                                  setSchema((p) => ({
                                    ...p,
                                    trainers: {
                                      ...p.trainers,
                                      questions: p.trainers.questions.filter((x) => x.id !== q.id),
                                    },
                                  }))
                                }
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                                </svg>
                              </MiniIconButton>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Views on Trainer label</label>
                          <input
                            className={inputCls}
                            value={schema.trainers.viewsOnTrainerLabel}
                            onChange={(e) => setSchema((p) => ({ ...p, trainers: { ...p.trainers, viewsOnTrainerLabel: e.target.value } }))}
                            disabled={!canEditPage}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Views on Site Visit label</label>
                          <input
                            className={inputCls}
                            value={schema.trainers.viewsOnSiteVisitLabel}
                            onChange={(e) => setSchema((p) => ({ ...p, trainers: { ...p.trainers, viewsOnSiteVisitLabel: e.target.value } }))}
                            disabled={!canEditPage}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canEditPage}
                        onClick={() =>
                          setSchema((p) => ({
                            ...p,
                            trainers: {
                              ...p.trainers,
                              questions: [...p.trainers.questions, { id: newId(), label: 'New row' }],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Row
                      </button>
                    </div>
                  </div>
                </div>

                {/* PREVIEW */}
                <div className="form-card p-0 overflow-hidden">
                  <div className="bg-slate-100 px-5 py-3 border-b border-slate-200">
                    <div className="section-title">Live Preview</div>
                    <div className="text-xs text-slate-500 mt-1">This is what users will fill</div>
                  </div>

                  <div className="p-3 sm:p-5 space-y-5">
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 text-center">
                        <div className="text-sm font-black text-slate-900 tracking-wide">TRAINING FEEDBACK</div>
                      </div>

                      {/* Training Program preview */}
                      <div className="border-t border-slate-300">
                        <div className="bg-slate-200/60 px-4 py-2 text-xs font-black text-slate-800 text-center">
                          {schema.trainingProgram.title}
                        </div>
                        <div className="divide-y divide-slate-300">
                          {schema.trainingProgram.questions.map((q) => (
                            <div key={q.id} className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
                              <div className="p-3 text-xs font-semibold text-slate-800 border-r-0 sm:border-r border-b sm:border-b-0 border-slate-300">{q.label}</div>
                              <div className="p-3">
                                {q.type === 'textarea' ? (
                                  <textarea className={inputCls + ' min-h-[70px]'} disabled placeholder="" />
                                ) : q.type === 'yesno' ? (
                                  <div className="flex items-center gap-4">
                                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                      <input type="radio" disabled /> Yes
                                    </label>
                                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                      <input type="radio" disabled /> No
                                    </label>
                                  </div>
                                ) : q.type === 'multiple_choice' ? (
                                  <div className="space-y-2">
                                    {(q.options ?? []).length ? (
                                      (q.options ?? []).map((opt, idx) => (
                                        <label key={idx} className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                          <input type="radio" disabled /> {opt}
                                        </label>
                                      ))
                                    ) : (
                                      <div className="text-xs text-slate-400">(No options)</div>
                                    )}
                                  </div>
                                ) : (
                                  <input className={inputCls} disabled placeholder="" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Training Executive preview */}
                      <div className="border-t border-slate-300">
                        <div className="bg-slate-200/60 px-4 py-2 text-xs font-black text-slate-800 text-center">
                          {schema.trainingExecutive.title}
                        </div>
                        <div className="px-4 py-2 text-[11px] text-slate-600 bg-slate-50 border-t border-slate-300">
                          <div>{schema.trainingExecutive.ratingHint}</div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-t border-slate-300 text-xs">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="text-left px-3 py-2 font-black text-slate-700 border-b border-slate-300"> </th>
                                <th className="text-center px-3 py-2 font-black text-slate-700 border-b border-slate-300 w-24">RATING</th>
                                <th className="text-left px-3 py-2 font-black text-slate-700 border-b border-slate-300">Your Views / Suggestions / Comments</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schema.trainingExecutive.questions.map((q) => (
                                <tr key={q.id} className="border-b border-slate-300">
                                  <td className="px-3 py-2 text-slate-800 font-semibold">{q.label}</td>
                                  <td className="px-3 py-2 text-center">
                                    <select className={inputCls + ' text-xs'} disabled value="">
                                      <option value="">-</option>
                                      {schema.ratingOptions.map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input className={inputCls + ' text-xs'} disabled placeholder="" />
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-b border-slate-300">
                                <td colSpan={3} className="px-3 py-2">
                                  <div className="text-xs font-bold text-slate-700">{schema.trainingExecutive.otherSuggestionsLabel}</div>
                                  <textarea className={inputCls + ' min-h-[70px] mt-2'} disabled placeholder="" />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Trainers preview */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 text-center">
                        <div className="text-sm font-black text-slate-900 tracking-wide">TRAINING FEEDBACK</div>
                      </div>

                      <div className="bg-slate-200/60 px-4 py-2 text-xs font-black text-slate-800 text-center border-t border-slate-300">
                        {schema.trainers.title}
                      </div>

                      <div className="px-4 py-2 text-[11px] text-slate-600 bg-slate-50 border-t border-slate-300">
                        <div className="flex items-start justify-between gap-3">
                          <div>{schema.trainers.ratingHint}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">Columns: {schema.trainers.trainerColumns}</div>
                        </div>
                      </div>

                      <div className="overflow-x-auto border-t border-slate-300">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="text-left px-3 py-2 font-black text-slate-700 border-b border-slate-300 w-[280px]"> </th>
                              {previewTrainerColumns.map((col, idx) => (
                                <th key={idx} className="px-3 py-2 border-b border-slate-300 min-w-[220px]">
                                  <div className="text-xs font-black text-slate-700">Trainer {idx + 1}</div>
                                  <select
                                    className={inputCls + ' mt-1 text-xs'}
                                    value={col.facultyId || ''}
                                    disabled={!canEditPage}
                                    onChange={(e) => {
                                      const facultyId = Number(e.target.value);
                                      const opt = facultyOptions.find((o) => o.id === facultyId);
                                      setSchema((p) => {
                                        const next = previewTrainerColumns.map((c) => ({ ...c }));
                                        next[idx] = { facultyId, name: opt?.name || '' };
                                        return { ...p, trainers: { ...p.trainers, selectedTrainers: next } };
                                      });
                                    }}
                                  >
                                    <option value="">Select trainer</option>
                                    {facultyOptions.map((opt) => (
                                      <option key={opt.id} value={String(opt.id)}>
                                        {opt.name}
                                      </option>
                                    ))}
                                  </select>
                                </th>
                              ))}
                            </tr>
                            {facultyOptions.length === 0 && (
                              <tr>
                                <th colSpan={1 + previewTrainerColumns.length} className="px-3 py-2 text-left text-[11px] text-slate-400 border-b border-slate-300">
                                  No trainers loaded
                                </th>
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            {schema.trainers.questions.map((q) => (
                              <tr key={q.id} className="border-b border-slate-300">
                                <td className="px-3 py-2 text-slate-800 font-semibold">{q.label}</td>
                                {previewTrainerColumns.map((_, idx) => (
                                  <td key={idx} className="px-3 py-2">
                                    <select className={inputCls + ' text-xs'} disabled value="">
                                      <option value="">-</option>
                                      {schema.ratingOptions.map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="border-b border-slate-300">
                              <td className="px-3 py-2 text-slate-800 font-semibold">{schema.trainers.viewsOnTrainerLabel}</td>
                              {previewTrainerColumns.map((_, idx) => (
                                <td key={idx} className="px-3 py-2">
                                  <input className={inputCls + ' text-xs'} disabled placeholder="" />
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="px-3 py-2 text-slate-800 font-semibold">{schema.trainers.viewsOnSiteVisitLabel}</td>
                              {previewTrainerColumns.map((_, idx) => (
                                <td key={idx} className="px-3 py-2">
                                  <input className={inputCls + ' text-xs'} disabled placeholder="" />
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
