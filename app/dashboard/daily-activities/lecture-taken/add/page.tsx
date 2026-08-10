'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Course { Course_Id: number; Course_Name: string; }
interface Batch { Batch_Id: number; Batch_code: string; Category: string | null; Timings: string | null; }
interface Faculty { Faculty_Id: number; Faculty_Name: string; }
/* Options come from the course's Standard Assignment List (standard_assignment_list.id) — NOT
   the batch's own Assignments tab. Picking one auto-adds/reuses a matching row in the batch's
   Assignments tab (batch_assignment_list) and stores THAT id as Assignment_Id. */
interface StandardAssignmentOption {
  id: number;
  assignment_no: number | null;
  assignment_name: string | null;
  description: string | null;
  deliverable_produced: string | null;
  input_documents: string | null;
  trainer: string | null;
  department: string | null;
}
interface BatchAssignmentRow {
  id: number;
  assignment_no: number | null;
  actual_no: number | null;
}
interface BatchLecture {
  id: number;
  lecture_no: number | null;
  standard_seq: number | null;
  actual_seq: number | null;
  subject: string | null;
  subject_topic: string | null;
  covered_subtopics: string | null;
  department: string | null;
  lecturecontent: string | null;
  date: string | null;
  lectureday: string | null;
  session: string | null;
  starttime: string | null;
  endtime: string | null;
  faculty_id: number | null;
  faculty_name: string | null;
  class_room: string | null;
  documents: string | null;
  assignment: string | null;
  assignment_date: string | null;
  unit_test: string | null;
  unit_test_date: string | null;
  publish: string | null;
}

/* Sub Topics is stored as a newline-separated list — same convention as the batch Lecture Plan. */
const getSubtopicList = (text: string): string[] => text.split('\n').filter((s) => s.trim() !== '');
const getCoveredSet = (text: string): Set<number> =>
  new Set(text.split(',').map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n)));

interface FormData {
  Course_Id: string;
  Batch_Id: string;
  Lecture_Id: string;
  Standard_Seq: string;
  Actual_Seq: string;
  Lecture_Name: string;
  Faculty_Id: string;
  Take_Dt: string;
  Day: string;
  Session: string;
  Topic: string;
  Sub_Topics: string;
  Covered_Subtopics: string;
  Duration: string;
  ClassRoom: string;
  Lecture_Start: string;
  Lecture_End: string;
  Faculty_Start: string;
  Faculty_End: string;
  Material: string;
  Documents: string;
  Assign_Given: string;
  Assignment_Id: string;
  Assignment_No: string;
  Assignment_Date: string;
  Assignment_Description: string;
  Deliverables: string;
  Assign_Start: string;
  Assign_End: string;
  Test_Given: string;
  Unit_Test: string;
  Unit_Test_Date: string;
  Publish: string;
  Next_Planning: string;
}

const emptyForm: FormData = {
  Course_Id: '', Batch_Id: '', Lecture_Id: '', Standard_Seq: '', Actual_Seq: '',
  Lecture_Name: '', Faculty_Id: '',
  Take_Dt: new Date().toISOString().slice(0, 10), Day: '', Session: '',
  Topic: '', Sub_Topics: '', Covered_Subtopics: '', Duration: '', ClassRoom: '',
  Lecture_Start: '', Lecture_End: '', Faculty_Start: '', Faculty_End: '',
  Material: '', Documents: '', Assign_Given: '', Assignment_Id: '',
  Assignment_No: '', Assignment_Date: '', Assignment_Description: '', Deliverables: '',
  Assign_Start: '', Assign_End: '',
  Test_Given: '', Unit_Test: '', Unit_Test_Date: '', Publish: 'No', Next_Planning: '',
};

const labelCls = 'text-xs font-semibold text-gray-600';
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white';
const disabledInputCls = 'h-10 w-full rounded-lg border border-gray-200 px-3 text-sm bg-gray-100 text-gray-500';

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AddLectureTakenPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = !!editId;

  const { canCreate, canUpdate, loading: permLoading } = useResourcePermissions('lecture');

  const [form, setForm] = useState<FormData>(emptyForm);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [batchLectures, setBatchLectures] = useState<BatchLecture[]>([]);
  const [assignmentOptions, setAssignmentOptions] = useState<StandardAssignmentOption[]>([]);
  const [assigningAssignment, setAssigningAssignment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── Load courses & faculties on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const [cRes, fRes] = await Promise.all([
          fetch('/api/daily-activities/lecture-taken?options=courses'),
          fetch('/api/daily-activities/lecture-taken?options=faculties'),
        ]);
        const cData = await cRes.json();
        const fData = await fRes.json();
        setCourses(cData.courses || []);
        setFaculties(fData.faculties || []);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Prefill from a batch's Lecture Plan (e.g. "Mark Lecture Taken" action) ── */
  useEffect(() => {
    if (editId) return;
    const courseId = searchParams.get('courseId');
    const batchId = searchParams.get('batchId');
    const lectureId = searchParams.get('lectureId');
    const date = searchParams.get('date');
    if (!courseId && !batchId && !lectureId && !date) return;

    setForm(prev => ({
      ...prev,
      Course_Id: courseId || prev.Course_Id,
      Batch_Id: batchId || prev.Batch_Id,
      Lecture_Id: lectureId || prev.Lecture_Id,
      Take_Dt: date || prev.Take_Dt,
      Standard_Seq: searchParams.get('standardSeq') || prev.Standard_Seq,
      Actual_Seq: searchParams.get('actualSeq') || prev.Actual_Seq,
      Day: searchParams.get('day') || prev.Day,
      Session: searchParams.get('session') || prev.Session,
      Lecture_Name: searchParams.get('topic') || prev.Lecture_Name,
      Topic: searchParams.get('topic') || prev.Topic,
      Sub_Topics: searchParams.get('subTopics') || prev.Sub_Topics,
      Faculty_Id: searchParams.get('facultyId') || prev.Faculty_Id,
      ClassRoom: searchParams.get('classRoom') || prev.ClassRoom,
      Lecture_Start: searchParams.get('start') || prev.Lecture_Start,
      Lecture_End: searchParams.get('end') || prev.Lecture_End,
      Assign_Given: searchParams.get('assignGiven') || prev.Assign_Given,
      Documents: searchParams.get('documents') || prev.Documents,
      Unit_Test: searchParams.get('unitTest') || prev.Unit_Test,
      Unit_Test_Date: searchParams.get('unitTestDate') || prev.Unit_Test_Date,
      Publish: searchParams.get('publish') || prev.Publish,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  /* ── Load edit data ── */
  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/lecture-taken?id=${editId}`);
        const data = await res.json();
        if (data.lecture) {
          const l = data.lecture;
          setForm({
            Course_Id: String(l.Course_Id || ''),
            Batch_Id: String(l.Batch_Id || ''),
            Lecture_Id: String(l.Lecture_Id || ''),
            Standard_Seq: l.Standard_Seq != null ? String(l.Standard_Seq) : '',
            Actual_Seq: l.Actual_Seq != null ? String(l.Actual_Seq) : '',
            Lecture_Name: l.Lecture_Name || '',
            Faculty_Id: String(l.Faculty_Id || ''),
            Take_Dt: l.Take_Dt || '',
            Day: l.Day || '',
            Session: l.Session || '',
            Topic: l.Topic || '',
            Sub_Topics: l.Sub_Topics || '',
            Covered_Subtopics: l.Covered_Subtopics || '',
            Duration: l.Duration || '',
            ClassRoom: l.ClassRoom || '',
            Lecture_Start: l.Lecture_Start || '',
            Lecture_End: l.Lecture_End || '',
            Faculty_Start: l.Faculty_Start || '',
            Faculty_End: l.Faculty_End || '',
            Material: l.Material || '',
            Documents: l.Documents || '',
            Assign_Given: l.Assign_Given || '',
            Assignment_Id: l.Assignment_Id != null ? String(l.Assignment_Id) : '',
            Assignment_No: l.Assignment_No != null ? String(l.Assignment_No) : '',
            Assignment_Date: l.Assignment_Date || '',
            Assignment_Description: l.Assignment_Description || '',
            Deliverables: l.Deliverables || '',
            Assign_Start: l.Assign_Start || '',
            Assign_End: l.Assign_End || '',
            Test_Given: l.Test_Given || '',
            Unit_Test: l.Unit_Test || '',
            Unit_Test_Date: l.Unit_Test_Date || '',
            Publish: l.Publish || 'No',
            Next_Planning: l.Next_Planning || '',
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
        const res = await fetch(`/api/daily-activities/lecture-taken?options=batches&courseId=${form.Course_Id}`);
        const data = await res.json();
        setBatches(data.batches || []);
      } catch { /* ignore */ }
    })();
  }, [form.Course_Id]);

  /* ── Load this batch's Lecture Plan rows (needed to sync Sub Topics "done" checkboxes back to
     the plan) and the course's Standard Assignment List (for the Assignment No. dropdown) when
     batch changes ── */
  useEffect(() => {
    if (!form.Batch_Id) { setBatchLectures([]); setAssignmentOptions([]); return; }
    (async () => {
      try {
        const [lRes, aRes] = await Promise.all([
          fetch(`/api/daily-activities/lecture-taken?options=lectures&batchId=${form.Batch_Id}`),
          fetch(`/api/daily-activities/lecture-taken?options=assignments&batchId=${form.Batch_Id}`),
        ]);
        const lData = await lRes.json();
        const aData = await aRes.json();
        setBatchLectures(lData.lectures || []);
        setAssignmentOptions(aData.assignments || []);
      } catch { /* ignore */ }
    })();
  }, [form.Batch_Id]);

  /* The Lecture Plan row this record is linked to (if any) — used to write Sub Topics "done"
     state back to the plan without touching any of its other, otherwise-frozen fields. */
  const linkedPlanRow = batchLectures.find(l => String(l.id) === form.Lecture_Id) || null;

  /* ── Update form field ── */
  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  /* ── Assignment No. (dropdown, sourced from the course's Standard Assignment List) ──
     Picking one fills Assignment Name/Description/Deliverables here, and auto-adds (or reuses)
     the matching row in the batch's own Assignments tab — one-way sync, that tab never pushes
     changes back into an already-saved Lecture Taken record. */
  const handleAssignmentSelect = async (assignmentNo: string) => {
    const opt = assignmentOptions.find(a => String(a.assignment_no) === assignmentNo);
    if (!opt) {
      setForm(prev => ({ ...prev, Assignment_No: '', Assignment_Id: '' }));
      return;
    }
    setForm(prev => ({
      ...prev,
      Assignment_No: assignmentNo,
      Assign_Given: opt.assignment_name || '',
      Assignment_Description: opt.description || '',
      Deliverables: opt.deliverable_produced || '',
    }));

    if (!form.Batch_Id) return;
    setAssigningAssignment(true);
    try {
      const res = await fetch(`/api/masters/batch/${form.Batch_Id}/assignment-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_no: opt.assignment_no,
          assignment_name: opt.assignment_name,
          description: opt.description,
          deliverable_produced: opt.deliverable_produced,
        }),
      });
      const data = await res.json();
      if (data?.insertId) {
        setForm(prev => ({ ...prev, Assignment_Id: String(data.insertId) }));
      }
    } catch { /* ignore */ }
    setAssigningAssignment(false);
  };

  /* ── Sub Topics — checkbox "done" list, synced back to the Lecture Plan row's covered_subtopics ── */
  const subtopicItems = getSubtopicList(form.Sub_Topics);
  const coveredSet = getCoveredSet(form.Covered_Subtopics);
  const toggleSubtopicCovered = async (idx: number) => {
    const next = new Set(coveredSet);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    const nextValue = Array.from(next).sort((a, b) => a - b).join(',');
    setForm(prev => ({ ...prev, Covered_Subtopics: nextValue }));

    if (linkedPlanRow && form.Batch_Id) {
      try {
        await fetch(`/api/masters/batch/${form.Batch_Id}/slectures`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...linkedPlanRow, id: linkedPlanRow.id, covered_subtopics: nextValue }),
        });
      } catch { /* ignore */ }
    }
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        ...form,
        Course_Id: form.Course_Id ? parseInt(form.Course_Id) : null,
        Batch_Id: form.Batch_Id ? parseInt(form.Batch_Id) : null,
        Lecture_Id: form.Lecture_Id ? parseInt(form.Lecture_Id) : null,
        Faculty_Id: form.Faculty_Id ? parseInt(form.Faculty_Id) : null,
        Assignment_Id: form.Assignment_Id ? parseInt(form.Assignment_Id) : null,
      };
      if (isEdit) payload.Take_Id = parseInt(editId!);

      const res = await fetch('/api/daily-activities/lecture-taken', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setSuccess(isEdit ? 'Lecture updated successfully!' : 'Lecture created successfully!');
      if (!isEdit) {
        setTimeout(() => router.push('/dashboard/daily-activities/lecture-taken'), 1200);
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
  if (isEdit && !canUpdate) return <AccessDenied message="You do not have permission to edit lectures." />;
  if (!isEdit && !canCreate) return <AccessDenied message="You do not have permission to create lectures." />;

  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/daily-activities/lecture-taken')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            {isEdit ? 'Edit Lecture Details' : 'Add Lecture Details'}
          </h1>
          <p className="text-xs text-gray-400">
            Daily Activities / Lecture Taken / {isEdit ? 'Edit' : 'Add'}
          </p>
        </div>
      </div>

      {loadingEdit ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading lecture details...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Messages ── */}
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

          {/* ── Batch & Schedule Selection ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Batch & Schedule Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Course <span className="text-red-400">*</span></label>
                <select value={form.Course_Id} onChange={set('Course_Id')} required className={inputCls}>
                  <option value="">— Select Course —</option>
                  {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Batch Code <span className="text-red-400">*</span></label>
                <select value={form.Batch_Id} onChange={set('Batch_Id')} required disabled={!form.Course_Id}
                  className={`${inputCls} disabled:opacity-50`}>
                  <option value="">— Select Batch —</option>
                  {batches.map(b => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>
                      {b.Batch_code}{b.Category ? ` (${b.Category})` : ''}{b.Timings ? ` — ${b.Timings}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.Take_Dt} onChange={set('Take_Dt')} required className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── Lecture Plan Fields — arranged in the same order as the batch's Lecture Plan columns ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Lecture Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Std Seq</label>
                <input type="number" value={form.Standard_Seq} disabled title="Fixed reference from the Standard Lecture Plan" className={disabledInputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Actual Seq</label>
                <input type="number" value={form.Actual_Seq} onChange={set('Actual_Seq')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Day</label>
                <input type="text" value={form.Day} onChange={set('Day')} placeholder="e.g. Monday" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Session</label>
                <select value={form.Session} onChange={set('Session')} className={inputCls}>
                  <option value="">— Select —</option>
                  <option value="First Half">First Half</option>
                  <option value="Second Half">Second Half</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label className={labelCls}>Topic (Module / Topic)</label>
              <textarea value={form.Topic} onChange={set('Topic')} rows={2} placeholder="Lecture topic..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white resize-none" />
            </div>

            {subtopicItems.length > 0 && (
              <div className="mt-4 flex flex-col gap-1.5">
                <label className={labelCls}>Sub Topics — check off what&apos;s done</label>
                <div className="space-y-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {subtopicItems.map((s, idx) => (
                    <label key={idx} className="flex items-start gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coveredSet.has(idx)}
                        onChange={() => toggleSubtopicCovered(idx)}
                        className="mt-0.5 shrink-0"
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Trainer</label>
                <select value={form.Faculty_Id} onChange={set('Faculty_Id')} className={inputCls}>
                  <option value="">— Select Trainer —</option>
                  {faculties.map(f => <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Lecture Start</label>
                <input type="time" value={form.Lecture_Start} onChange={set('Lecture_Start')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Lecture End</label>
                <input type="time" value={form.Lecture_End} onChange={set('Lecture_End')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Assignment No.{assigningAssignment && <span className="text-[10px] text-gray-400 ml-1">(adding to batch...)</span>}</label>
                <select value={form.Assignment_No} onChange={(e) => handleAssignmentSelect(e.target.value)} disabled={!form.Batch_Id}
                  className={`${inputCls} disabled:opacity-50`}>
                  <option value="">— Select Assignment —</option>
                  {assignmentOptions.map(a => (
                    <option key={a.id} value={String(a.assignment_no)}>#{a.assignment_no ?? '—'} — {a.assignment_name || 'Untitled'}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Assignment Date</label>
                <input type="date" value={form.Assignment_Date} onChange={set('Assignment_Date')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Assignment Name</label>
                <input type="text" value={form.Assign_Given} onChange={set('Assign_Given')} placeholder="Assignment name" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Documents</label>
                <input type="text" value={form.Documents} onChange={set('Documents')} placeholder="e.g. Projector/Laptop" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Classroom</label>
                <input type="text" value={form.ClassRoom} onChange={set('ClassRoom')} placeholder="e.g. SIT TR 03" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>UT</label>
                <input type="text" value={form.Unit_Test} onChange={set('Unit_Test')} placeholder="Unit test" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>UT Date</label>
                <input type="date" value={form.Unit_Test_Date} onChange={set('Unit_Test_Date')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Publish</label>
                <select value={form.Publish} onChange={set('Publish')} className={inputCls}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Assignment Description</label>
                <textarea value={form.Assignment_Description} onChange={set('Assignment_Description')} rows={2} placeholder="Assignment description..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white resize-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Deliverables</label>
                <textarea value={form.Deliverables} onChange={set('Deliverables')} rows={2} placeholder="Deliverable produced..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white resize-none" />
              </div>
            </div>
          </div>

          {/* ── Additional Details — fields with no Lecture Plan equivalent ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Additional Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Trainer Start</label>
                <input type="time" value={form.Faculty_Start} onChange={set('Faculty_Start')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Trainer End</label>
                <input type="time" value={form.Faculty_End} onChange={set('Faculty_End')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Duration</label>
                <input type="time" value={form.Duration} onChange={set('Duration')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Material</label>
                <input type="text" value={form.Material} onChange={set('Material')} placeholder="Material issued" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Assignment Start</label>
                <input type="date" value={form.Assign_Start} onChange={set('Assign_Start')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Assignment End</label>
                <input type="date" value={form.Assign_End} onChange={set('Assign_End')} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Test Given</label>
                <input type="text" value={form.Test_Given} onChange={set('Test_Given')} placeholder="Test description" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Next Planning</label>
                <input type="text" value={form.Next_Planning} onChange={set('Next_Planning')} placeholder="Next planned topic" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── Submit Buttons ── */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#23257A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {isEdit ? 'Update Lecture' : 'Save Lecture'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/daily-activities/lecture-taken')}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
