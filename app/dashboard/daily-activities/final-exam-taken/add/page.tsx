'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FINAL_EXAM_ATTEMPTS, RE_EXAM_PATTERN, recordedAttempt } from '@/lib/final-exam-attempt';

/** Status for a student who didn't sit a re-exam — no marks row is saved for them. */
const NOT_TAKEN = 'Not Taken';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Course { Course_Id: number; Course_Name: string; }
interface Batch { Batch_Id: number; Batch_code: string; Category: string | null; Timings: string | null; }
interface ExamDef { id: number; subject: string; max_marks: string | null; duration: string | null; exam_date: string | null; }
interface StudentMark {
  row_num: number;
  Admission_Id: number;
  Student_Id: number;
  Student_Code: string | null;
  Student_Name: string;
  Roll_No: string | null;
  marks_obtained: number | null;
  status: string | null;
  child_id: number | null;
}

interface FormData {
  Course_Id: string;
  Batch_Id: string;
  Exam_Id: string;
  Test_No: string;
  Attempt_No: string;
  Max_Marks: string;
  Exam_Dt: string;
}

const emptyForm: FormData = {
  Course_Id: '', Batch_Id: '', Exam_Id: '', Test_No: '', Attempt_No: '1',
  Max_Marks: '',
  Exam_Dt: new Date().toISOString().slice(0, 10),
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AddFinalExamTakenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = !!editId;

  const { canCreate, canUpdate, loading: permLoading } = useResourcePermissions('final_exam');

  const [form, setForm] = useState<FormData>(emptyForm);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [examDefs, setExamDefs] = useState<ExamDef[]>([]);
  const [examDefsReload, setExamDefsReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── Students ── */
  const [students, setStudents] = useState<StudentMark[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  type MarkEdit = { marks: string; status: string; child_id: number | null; Student_Name: string };
  const [markEdits, setMarkEdits] = useState<Record<number, MarkEdit>>({});

  const setStudentMark = (studentId: number, field: 'marks' | 'status', value: string) =>
    setMarkEdits(prev => {
      const current = prev[studentId];
      // Absent / Not Taken always mean no marks — clear/lock the marks field the moment status flips,
      // so a stale or mistyped value from before can never get saved for an absent student.
      const next = field === 'status' && (value === 'Absent' || value === NOT_TAKEN)
        ? { ...current, status: value, marks: '' }
        : { ...current, [field]: value };
      return { ...prev, [studentId]: next };
    });

  /* ── Load courses on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/daily-activities/final-exam-taken?options=courses');
        const data = await res.json();
        setCourses(data.courses || []);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Load edit data ── */
  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/final-exam-taken?id=${editId}`);
        const data = await res.json();
        if (data.finalExam) {
          const a = data.finalExam;
          setForm({
            Course_Id: String(a.Course_Id || ''),
            Batch_Id: String(a.Batch_Id || ''),
            Exam_Id: String(a.Exam_Id || ''),
            Test_No: String(a.Test_No || ''),
            // Older sittings have no Attempt_No — infer it from the exam name.
            Attempt_No: String(recordedAttempt(a.Attempt_No) ?? (RE_EXAM_PATTERN.test(String(a.ExamName || '')) ? 2 : 1)),
            Max_Marks: String(a.Max_Marks || ''),
            Exam_Dt: a.Exam_Dt ? a.Exam_Dt.slice(0, 10) : '',
          });
        }
      } catch { /* ignore */ }
      setLoadingEdit(false);
    })();
  }, [editId]);

  /* ── Load batches when course changes ── */
  useEffect(() => {
    if (!form.Course_Id) { setBatches([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/final-exam-taken?options=batches&courseId=${form.Course_Id}`);
        const data = await res.json();
        setBatches(data.batches || []);
      } catch { /* ignore */ }
    })();
  }, [form.Course_Id]);

  /* ── Load exam definitions when batch changes ── */
  useEffect(() => {
    if (!form.Batch_Id) { setExamDefs([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/final-exam-taken?options=exams&batchId=${form.Batch_Id}`);
        const data = await res.json();
        setExamDefs(data.exams || []);
      } catch { /* ignore */ }
    })();
  }, [form.Batch_Id, examDefsReload]);

  /* ── Load students in edit mode when batch is known ── */
  useEffect(() => {
    if (!isEdit || !editId || !form.Batch_Id) { setStudents([]); setMarkEdits({}); return; }
    setStudentsLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/daily-activities/final-exam-taken?options=students&batchId=${form.Batch_Id}&takeId=${editId}`
        );
        const data = await res.json();
        const list: StudentMark[] = data.students ?? [];
        setStudents(list);
        const edits: Record<number, MarkEdit> = {};
        for (const s of list) {
          edits[s.Student_Id] = {
            marks: s.marks_obtained != null ? String(s.marks_obtained) : '',
            status: s.status || '',
            child_id: s.child_id ?? null,
            Student_Name: s.Student_Name,
          };
        }
        setMarkEdits(edits);
      } catch { setStudents([]); setMarkEdits({}); }
      setStudentsLoading(false);
    })();
  }, [isEdit, editId, form.Batch_Id]);

  /* ── Re-exam sittings ── */
  // On a re-exam (attempt 2+), students with no saved marks default to "Not Taken"
  // so only those who actually sat it need entering; on the regular exam they
  // default to Present as before.
  const isReExam = Number(form.Attempt_No) >= 2;
  const effectiveStatus = (edit: MarkEdit | undefined) => {
    if (!edit?.status) return isReExam ? NOT_TAKEN : 'Present';
    // "Not Taken" only exists on re-exams; switched back to the regular exam → Present.
    return edit.status === NOT_TAKEN && !isReExam ? 'Present' : edit.status;
  };

  // Re-exam flag. With no exam entry chosen, saving reuses — or adds to Batch
  // Master — "Re-Final Exam" (2nd attempt) / "Re-Final Exam - II" (3rd attempt).
  const isReExamDef = (t: ExamDef | undefined) => !!t && RE_EXAM_PATTERN.test(t.subject);
  const autoReExamSubject = Number(form.Attempt_No) >= 3 ? 'Re-Final Exam - II' : 'Re-Final Exam';
  const autoReExamExists = examDefs.some(t => t.subject.trim().toLowerCase() === autoReExamSubject.toLowerCase());
  const AUTO_SUBJECTS = ['re-final exam', 're-final exam - ii'];

  const toggleReExam = (on: boolean) => setForm(prev => {
    const current = examDefs.find(t => String(t.id) === prev.Exam_Id);
    const regular = examDefs.find(t => !isReExamDef(t));
    return {
      ...prev,
      Attempt_No: on ? (Number(prev.Attempt_No) >= 2 ? prev.Attempt_No : '2') : '1',
      // A regular exam entry can't stand for a re-exam, or the other way round.
      Exam_Id: on === isReExamDef(current) ? prev.Exam_Id : '',
      // Re-exam papers are normally marked out of the same total as the regular exam.
      Max_Marks: on && !prev.Max_Marks ? (regular?.max_marks || '') : prev.Max_Marks,
      // Test No is numbered automatically for re-exams.
      Test_No: on ? '' : prev.Test_No,
    };
  });

  const changeAttempt = (value: string) => setForm(prev => {
    const current = examDefs.find(t => String(t.id) === prev.Exam_Id);
    // The automatic entries belong to one attempt each — switching attempt drops them.
    const isAutoEntry = !!current && AUTO_SUBJECTS.includes(current.subject.trim().toLowerCase());
    return { ...prev, Attempt_No: value, Exam_Id: isAutoEntry ? '' : prev.Exam_Id };
  });

  /* ── Auto-fill from selected exam definition ── */
  const handleExamSelect = (examId: string) => {
    setForm(prev => ({ ...prev, Exam_Id: examId }));
    const def = examDefs.find(t => String(t.id) === examId);
    if (def) {
      setForm(prev => ({
        ...prev,
        Exam_Id: examId,
        Max_Marks: def.max_marks || prev.Max_Marks,
        Exam_Dt: def.exam_date ? def.exam_date.slice(0, 10) : prev.Exam_Dt,
        // An exam named like a re-exam suggests the second attempt; still changeable.
        Attempt_No: RE_EXAM_PATTERN.test(def.subject) && prev.Attempt_No === '1' ? '2' : prev.Attempt_No,
      }));
    }
  };

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        Course_Id: form.Course_Id ? parseInt(form.Course_Id) : null,
        Batch_Id: form.Batch_Id ? parseInt(form.Batch_Id) : null,
        Exam_Id: form.Exam_Id ? parseInt(form.Exam_Id) : null,
        Test_No: form.Test_No ? parseInt(form.Test_No) : null,
        Attempt_No: parseInt(form.Attempt_No) || 1,
        Max_Marks: form.Max_Marks ? parseInt(form.Max_Marks) : null,
        Exam_Dt: form.Exam_Dt || null,
      };
      if (isEdit) payload.Take_Id = parseInt(editId!);

      if (isEdit && Object.keys(markEdits).length > 0) {
        payload.studentMarks = Object.entries(markEdits).map(([studentId, edit]) => {
          const status = effectiveStatus(edit);
          return {
            Student_Id: parseInt(studentId),
            Student_Name: edit.Student_Name,
            marks_obtained: status === 'Absent' || status === NOT_TAKEN ? 0 : (edit.marks !== '' ? Number(edit.marks) : null),
            status,
            child_id: edit.child_id,
          };
        });
      }

      const res = await fetch('/api/daily-activities/final-exam-taken', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      const added = data.createdReExamEntry ? ` "${data.createdReExamEntry}" was added to Batch Master.` : '';
      setSuccess((isEdit ? 'Final exam updated successfully!' : 'Final exam created successfully!') + added);
      if (isEdit && data.Exam_Id) {
        setForm(prev => ({ ...prev, Exam_Id: String(data.Exam_Id) }));
        if (data.createdReExamEntry) setExamDefsReload(n => n + 1);
      }
      if (!isEdit) {
        setTimeout(() => router.push('/dashboard/daily-activities/final-exam-taken'), 1200);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  if (permLoading) return <PermissionLoading />;
  if (isEdit && !canUpdate) return <AccessDenied message="You do not have permission to edit final exams." />;
  if (!isEdit && !canCreate) return <AccessDenied message="You do not have permission to create final exams." />;

  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/daily-activities/final-exam-taken')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            {isEdit ? 'Edit Final Exam' : 'Add Final Exam'}
          </h1>
          <p className="text-xs text-gray-400">
            Daily Activities / Final Exam Taken / {isEdit ? 'Edit' : 'Add'}
          </p>
        </div>
      </div>

      {loadingEdit ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading final exam details...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </div>
          )}

          {/* ── Core Details ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Final Exam Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Training Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Training Name <span className="text-red-400">*</span></label>
                <select value={form.Course_Id} onChange={set('Course_Id')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">-Select-</option>
                  {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                </select>
              </div>

              {/* Batch Code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Batch Code <span className="text-red-400">*</span></label>
                <select value={form.Batch_Id} onChange={set('Batch_Id')} required disabled={!form.Course_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  <option value="">-Select-</option>
                  {batches.map(b => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>
                      {b.Batch_code}{b.Category ? ` (${b.Category})` : ''}{b.Timings ? ` — ${b.Timings}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exam Test Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Exam Test Name {!isReExam && <span className="text-red-400">*</span>}</label>
                <select value={form.Exam_Id} onChange={(e) => handleExamSelect(e.target.value)} required={!isReExam} disabled={!form.Batch_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  {isReExam
                    ? <option value="">{autoReExamExists ? `Auto — use “${autoReExamSubject}” from Batch Master` : `Auto — add “${autoReExamSubject}” to Batch Master`}</option>
                    : <option value="">-Select-</option>}
                  {(isReExam ? examDefs.filter(isReExamDef) : examDefs).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.subject}{t.max_marks ? ` (${t.max_marks} marks)` : ''}{t.duration ? ` — ${t.duration}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Re-Exam flag */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Re-Exam</label>
                <div className="flex h-10 items-center gap-3">
                  <label className="inline-flex shrink-0 items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input type="checkbox" checked={isReExam} onChange={(e) => toggleReExam(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-[#2E3093]" />
                    This is a re-exam
                  </label>
                  {isReExam && (
                    <select value={form.Attempt_No} onChange={(e) => changeAttempt(e.target.value)} aria-label="Re-exam attempt"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                      {FINAL_EXAM_ATTEMPTS.filter(a => a.value >= 2).map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  )}
                </div>
                {isReExam && (
                  <p className="text-[11px] text-gray-500">Enter marks only for students who sat the re-exam; leave the rest as “Not Taken”.</p>
                )}
              </div>

              {/* Max Marks */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Max Marks {isReExam && <span className="text-red-400">*</span>}</label>
                <input type="number" value={form.Max_Marks} onChange={set('Max_Marks')} placeholder="Max Marks" required={isReExam} min={1}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.Exam_Dt} onChange={set('Exam_Dt')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Test No */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Test No {!isReExam && <span className="text-red-400">*</span>}</label>
                <input type="number" value={form.Test_No} onChange={set('Test_No')} required={!isReExam} placeholder={isReExam ? 'Auto' : 'e.g. 1'}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>
            </div>
          </div>

          {/* ── Students (edit mode only) ── */}
          {isEdit && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider">Students</h3>
                {students.length > 0 && (
                  <span className="ml-1 text-xs text-gray-400">({students.length})</span>
                )}
              </div>

              {studentsLoading ? (
                <div className="flex items-center gap-2 py-4 text-gray-400 text-xs">
                  <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                  Loading students...
                </div>
              ) : !form.Batch_Id ? (
                <p className="text-xs text-gray-400 py-2">Select a batch to view students.</p>
              ) : students.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No students found for this batch.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-2 px-3 text-left w-10">#</th>
                        <th className="py-2 px-3 text-left">Roll No</th>
                        <th className="py-2 px-3 text-left">Student Name</th>
                        <th className="py-2 px-3 text-center w-28">Marks Obtained</th>
                        <th className="py-2 px-3 text-center w-24">Max Marks</th>
                        <th className="py-2 px-3 text-center w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {students.map((s) => {
                        const edit = markEdits[s.Student_Id];
                        const status = effectiveStatus(edit);
                        const isAbsent = status === 'Absent';
                        const notTaken = status === NOT_TAKEN;
                        const maxMarks = form.Max_Marks ? parseInt(form.Max_Marks) : null;
                        const marksVal = isAbsent || notTaken ? '' : (edit?.marks ?? '');
                        return (
                          <tr key={s.Student_Id} className={`transition-colors ${isAbsent ? 'bg-red-50/40' : notTaken ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50/20'}`}>
                            <td className="py-1.5 px-3 text-gray-400 font-mono">{s.row_num}</td>
                            <td className="py-1.5 px-3 text-gray-500">{s.Roll_No || '—'}</td>
                            <td className="py-1.5 px-3 font-medium text-gray-800">{s.Student_Name}</td>
                            <td className="py-1.5 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={maxMarks ?? undefined}
                                value={marksVal}
                                disabled={isAbsent || notTaken}
                                onChange={(e) => setStudentMark(s.Student_Id, 'marks', e.target.value)}
                                placeholder={isAbsent ? '0' : '—'}
                                className="w-20 h-7 rounded border border-gray-300 px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-40 disabled:bg-gray-50"
                              />
                            </td>
                            <td className="py-1.5 px-3 text-center text-gray-500">{maxMarks ?? '—'}</td>
                            <td className="py-1.5 px-3 text-center">
                              <select
                                value={status}
                                onChange={(e) => setStudentMark(s.Student_Id, 'status', e.target.value)}
                                className={`h-7 rounded border px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] ${
                                  isAbsent ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white'
                                }`}
                              >
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                {isReExam && <option value={NOT_TAKEN}>{NOT_TAKEN}</option>}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Submit / Cancel ── */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#23257A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {isEdit ? 'Update Final Exam' : 'Submit'}
            </button>
            <button type="button" onClick={() => router.push('/dashboard/daily-activities/final-exam-taken')}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
