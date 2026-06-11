'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

type QuestionType = 'text' | 'textarea' | 'yesno' | 'multiple_choice';

type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
};

type FeedbackFormSchema = {
  version: 1;
  ratingOptions: string[];
  trainingProgram: {
    title: string;
    questions: Question[];
  };
  trainingExecutive: {
    title: string;
    ratingHint: string;
    questions: Array<{ id: string; label: string }>;
    otherSuggestionsLabel: string;
  };
  trainers: {
    title: string;
    ratingHint: string;
    trainerNameLabel: string;
    allowMultiple: boolean;
    trainerColumns: number;
    questions: Array<{ id: string; label: string }>;
    viewsOnTrainerLabel: string;
    viewsOnSiteVisitLabel: string;
  };
};

type FormMeta = {
  id: number;
  trainingProgram: string | null;
  batchNo: string | null;
  date: string | null;
  schema: FeedbackFormSchema;
};

type Student = { studentId: number; studentCode: string; studentName: string };

type TrainerEntry = {
  trainerName: string;
  ratings: Record<string, string>;
  viewsOnTrainer: string;
  viewsOnSiteVisit: string;
};

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]';

function newTrainerEntry(): TrainerEntry {
  return { trainerName: '', ratings: {}, viewsOnTrainer: '', viewsOnSiteVisit: '' };
}

export default function TrainingFeedbackPublicPage() {
  const params = useParams();
  const id = params.id as string;

  const [meta, setMeta] = useState<FormMeta | null>(null);
  const [loadError, setLoadError] = useState('');

  /* verify step */
  const [last3, setLast3] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [matches, setMatches] = useState<Student[] | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  /* answers */
  const [trainingProgramAnswers, setTrainingProgramAnswers] = useState<Record<string, string>>({});
  const [executiveRatings, setExecutiveRatings] = useState<Record<string, string>>({});
  const [otherSuggestions, setOtherSuggestions] = useState('');
  const [trainers, setTrainers] = useState<TrainerEntry[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public/training-feedback/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(d.error); return; }
        setMeta(d as FormMeta);
        const cols = Math.max(1, Number(d?.schema?.trainers?.trainerColumns) || 1);
        setTrainers(Array.from({ length: cols }, () => newTrainerEntry()));
      })
      .catch(() => setLoadError('Unable to load feedback form.'));
  }, [id]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{3}$/.test(last3.trim())) {
      setVerifyError('Enter the last 3 digits of your student code.');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    setMatches(null);
    try {
      const res = await fetch(`/api/public/training-feedback/${id}?last3=${encodeURIComponent(last3.trim())}`);
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error || 'Verification failed.'); return; }
      const students = (data.students || []) as Student[];
      if (students.length === 1) {
        setStudent(students[0]);
      } else {
        setMatches(students);
      }
    } catch {
      setVerifyError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const ratingOptions = useMemo(() => meta?.schema.ratingOptions ?? [], [meta]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !meta) return;

    for (const q of meta.schema.trainingExecutive.questions) {
      if (!executiveRatings[q.id]) {
        setSubmitError('Please rate all items in the Training Executive section.');
        return;
      }
    }
    for (const trainer of trainers) {
      for (const q of meta.schema.trainers.questions) {
        if (!trainer.ratings[q.id]) {
          setSubmitError('Please rate all items in the Trainers section.');
          return;
        }
      }
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/public/training-feedback/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          studentCode: student.studentCode,
          studentName: student.studentName,
          answers: {
            trainingProgram: trainingProgramAnswers,
            trainingExecutive: { ratings: executiveRatings, otherSuggestions },
            trainers,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2E3093]/5 via-white to-[#2A6BB5]/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Training Feedback</h1>
          <p className="text-xs text-gray-500 mt-0.5">Suvidya Institute of Technology</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loadError && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">{loadError}</p>
            </div>
          )}

          {!loadError && !meta && (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {meta && !loadError && (
            <>
              <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-[#2E3093]">{meta.trainingProgram || 'Training Program'}</p>
                <div className="mt-0.5 space-y-0.5 text-[11px] text-gray-500">
                  {meta.batchNo && <p>Batch: <span className="font-semibold text-gray-700">{meta.batchNo}</span></p>}
                  {meta.date && <p>Date: <span className="font-semibold text-gray-700">{meta.date}</span></p>}
                </div>
              </div>

              {submitted && (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-800">Thank you{student?.studentName ? `, ${student.studentName}` : ''}!</p>
                  <p className="text-xs text-gray-500 mt-1">Your feedback has been recorded.</p>
                </div>
              )}

              {/* Step 1 — verify identity */}
              {!submitted && !student && (
                <form onSubmit={handleVerify} className="p-5 space-y-4">
                  <p className="text-xs text-gray-500">Enter the last 3 digits of your student code to continue.</p>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                      Student Code (last 3 digits) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={last3}
                      onChange={(e) => { setLast3(e.target.value.replace(/\D/g, '')); setVerifyError(''); }}
                      placeholder="e.g. 042"
                      className={inputCls}
                    />
                  </div>

                  {matches && matches.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Multiple students found. Select your name:</p>
                      {matches.map((m) => (
                        <button
                          key={m.studentId}
                          type="button"
                          onClick={() => setStudent(m)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#2E3093]/40 hover:bg-[#2E3093]/5 transition-colors"
                        >
                          {m.studentName} <span className="text-gray-400 font-mono text-xs">({m.studentCode})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {verifyError && <p className="text-xs text-red-500">{verifyError}</p>}

                  {!matches && (
                    <button
                      type="submit"
                      disabled={verifying}
                      className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors disabled:opacity-50"
                    >
                      {verifying ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Verifying…
                        </span>
                      ) : 'Continue'}
                    </button>
                  )}
                </form>
              )}

              {/* Step 2 — feedback form */}
              {!submitted && student && (
                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><span className="font-semibold">{student.studentName}</span> — {student.studentCode}</span>
                  </div>

                  {/* Training Program */}
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{meta.schema.trainingProgram.title}</p>
                    {meta.schema.trainingProgram.questions.map((q) => (
                      <div key={q.id}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{q.label}</label>
                        {q.type === 'textarea' ? (
                          <textarea
                            rows={3}
                            className={inputCls + ' resize-none'}
                            value={trainingProgramAnswers[q.id] || ''}
                            onChange={(e) => setTrainingProgramAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                          />
                        ) : q.type === 'yesno' ? (
                          <div className="flex items-center gap-4">
                            {['Yes', 'No'].map((opt) => (
                              <label key={opt} className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={q.id}
                                  checked={trainingProgramAnswers[q.id] === opt}
                                  onChange={() => setTrainingProgramAnswers((p) => ({ ...p, [q.id]: opt }))}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        ) : q.type === 'multiple_choice' ? (
                          <div className="space-y-1.5">
                            {(q.options ?? []).map((opt) => (
                              <label key={opt} className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={q.id}
                                  checked={trainingProgramAnswers[q.id] === opt}
                                  onChange={() => setTrainingProgramAnswers((p) => ({ ...p, [q.id]: opt }))}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            className={inputCls}
                            value={trainingProgramAnswers[q.id] || ''}
                            onChange={(e) => setTrainingProgramAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Training Executive */}
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{meta.schema.trainingExecutive.title}</p>
                    <p className="text-[11px] text-gray-500">{meta.schema.trainingExecutive.ratingHint}</p>
                    {meta.schema.trainingExecutive.questions.map((q) => (
                      <div key={q.id}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">{q.label}</label>
                        <div className="flex flex-wrap gap-2">
                          {ratingOptions.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setExecutiveRatings((p) => ({ ...p, [q.id]: n }))}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                executiveRatings[q.id] === n
                                  ? 'bg-[#2E3093] border-[#2E3093] text-white'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-[#2E3093]/40'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">{meta.schema.trainingExecutive.otherSuggestionsLabel}</label>
                      <textarea
                        rows={3}
                        className={inputCls + ' resize-none'}
                        value={otherSuggestions}
                        onChange={(e) => setOtherSuggestions(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Trainers */}
                  <div className="space-y-4">
                    {trainers.map((trainer, idx) => (
                      <div key={idx} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                            {meta.schema.trainers.title}{trainers.length > 1 ? ` ${idx + 1}` : ''}
                          </p>
                          {meta.schema.trainers.allowMultiple && trainers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setTrainers((p) => p.filter((_, i) => i !== idx))}
                              className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">{meta.schema.trainers.ratingHint}</p>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">{meta.schema.trainers.trainerNameLabel}</label>
                          <input
                            type="text"
                            className={inputCls}
                            value={trainer.trainerName}
                            onChange={(e) => setTrainers((p) => p.map((t, i) => i === idx ? { ...t, trainerName: e.target.value } : t))}
                          />
                        </div>
                        {meta.schema.trainers.questions.map((q) => (
                          <div key={q.id}>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">{q.label}</label>
                            <div className="flex flex-wrap gap-2">
                              {ratingOptions.map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setTrainers((p) => p.map((t, i) => i === idx ? { ...t, ratings: { ...t.ratings, [q.id]: n } } : t))}
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                    trainer.ratings[q.id] === n
                                      ? 'bg-[#2E3093] border-[#2E3093] text-white'
                                      : 'bg-white border-gray-200 text-gray-700 hover:border-[#2E3093]/40'
                                  }`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">{meta.schema.trainers.viewsOnTrainerLabel}</label>
                          <textarea
                            rows={2}
                            className={inputCls + ' resize-none'}
                            value={trainer.viewsOnTrainer}
                            onChange={(e) => setTrainers((p) => p.map((t, i) => i === idx ? { ...t, viewsOnTrainer: e.target.value } : t))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">{meta.schema.trainers.viewsOnSiteVisitLabel}</label>
                          <textarea
                            rows={2}
                            className={inputCls + ' resize-none'}
                            value={trainer.viewsOnSiteVisit}
                            onChange={(e) => setTrainers((p) => p.map((t, i) => i === idx ? { ...t, viewsOnSiteVisit: e.target.value } : t))}
                          />
                        </div>
                      </div>
                    ))}
                    {meta.schema.trainers.allowMultiple && (
                      <button
                        type="button"
                        onClick={() => setTrainers((p) => [...p, newTrainerEntry()])}
                        className="w-full py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-[#2E3093]/40 hover:text-[#2E3093] transition-colors"
                      >
                        + Add another trainer
                      </button>
                    )}
                  </div>

                  {submitError && <p className="text-xs text-red-500">{submitError}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting…
                      </span>
                    ) : 'Submit Feedback'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
