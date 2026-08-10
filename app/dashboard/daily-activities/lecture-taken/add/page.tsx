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
interface BatchLecture {
  id: number;
  lecture_no: number;
  standard_seq: number | null;
  actual_seq: number | null;
  subject: string | null;
  subject_topic: string | null;
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
const getSubtopicList = (text: string): string[] => {
  const items = text.split('\n');
  return items.length ? items : [''];
};

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
  Duration: string;
  ClassRoom: string;
  Lecture_Start: string;
  Lecture_End: string;
  Faculty_Start: string;
  Faculty_End: string;
  Material: string;
  Documents: string;
  Assign_Given: string;
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
  Topic: '', Sub_Topics: '', Duration: '', ClassRoom: '',
  Lecture_Start: '', Lecture_End: '', Faculty_Start: '', Faculty_End: '',
  Material: '', Documents: '', Assign_Given: '', Assign_Start: '', Assign_End: '',
  Test_Given: '', Unit_Test: '', Unit_Test_Date: '', Publish: 'No', Next_Planning: '',
};

const labelCls = 'text-xs font-semibold text-gray-600';
const inputCls = 'h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white';

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
            Duration: l.Duration || '',
            ClassRoom: l.ClassRoom || '',
            Lecture_Start: l.Lecture_Start || '',
            Lecture_End: l.Lecture_End || '',
            Faculty_Start: l.Faculty_Start || '',
            Faculty_End: l.Faculty_End || '',
            Material: l.Material || '',
            Documents: l.Documents || '',
            Assign_Given: l.Assign_Given || '',
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

  /* ── Load batch lectures when batch changes ── */
  useEffect(() => {
    if (!form.Batch_Id) { setBatchLectures([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/lecture-taken?options=lectures&batchId=${form.Batch_Id}`);
        const data = await res.json();
        setBatchLectures(data.lectures || []);
      } catch { /* ignore */ }
    })();
  }, [form.Batch_Id]);

  /* ── Auto-fill every matching field from the selected Planned Lecture ── */
  const handleLectureSelect = (lectureId: string) => {
    setForm(prev => ({ ...prev, Lecture_Id: lectureId }));
    const lec = batchLectures.find(l => String(l.id) === lectureId);
    if (lec) {
      setForm(prev => ({
        ...prev,
        Lecture_Id: lectureId,
        Standard_Seq: lec.standard_seq != null ? String(lec.standard_seq) : prev.Standard_Seq,
        Actual_Seq: lec.actual_seq != null ? String(lec.actual_seq) : prev.Actual_Seq,
        Lecture_Name: lec.subject || lec.subject_topic || '',
        Topic: lec.subject || lec.subject_topic || '',
        Sub_Topics: lec.subject_topic || prev.Sub_Topics,
        Day: lec.lectureday || prev.Day,
        Session: lec.session || prev.Session,
        ClassRoom: lec.class_room || prev.ClassRoom,
        Lecture_Start: lec.starttime || prev.Lecture_Start,
        Lecture_End: lec.endtime || prev.Lecture_End,
        Faculty_Id: lec.faculty_id != null ? String(lec.faculty_id) : prev.Faculty_Id,
        Assign_Given: lec.assignment || prev.Assign_Given,
        Documents: lec.documents || prev.Documents,
        Unit_Test: lec.unit_test || prev.Unit_Test,
        Unit_Test_Date: lec.unit_test_date || prev.Unit_Test_Date,
        Publish: lec.publish || prev.Publish,
      }));
    }
  };

  /* ── Update form field ── */
  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  /* ── Sub Topics editor (multi-line, bulleted, matching the Lecture Plan's list convention) ── */
  const subtopicItems = getSubtopicList(form.Sub_Topics);
  const updateSubtopicItem = (index: number, value: string) => {
    const items = [...subtopicItems];
    items[index] = value;
    setForm(prev => ({ ...prev, Sub_Topics: items.join('\n') }));
  };
  const addSubtopicItem = () => {
    setForm(prev => ({ ...prev, Sub_Topics: [...subtopicItems, ''].join('\n') }));
  };
  const removeSubtopicItem = (index: number) => {
    const items = subtopicItems.filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, Sub_Topics: items.join('\n') }));
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <label className={labelCls}>Planned Lecture</label>
                <select value={form.Lecture_Id} onChange={(e) => handleLectureSelect(e.target.value)} disabled={!form.Batch_Id}
                  className={`${inputCls} disabled:opacity-50`}>
                  <option value="">— Select Lecture —</option>
                  {batchLectures.map(l => (
                    <option key={l.id} value={l.id}>
                      #{l.lecture_no} — {l.subject || l.subject_topic || 'Untitled'}
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
                <input type="number" value={form.Standard_Seq} onChange={set('Standard_Seq')} className={inputCls} />
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

            <div className="mt-4 flex flex-col gap-1.5">
              <label className={labelCls}>Sub Topics</label>
              <div className="space-y-1">
                {subtopicItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-gray-400 text-xs shrink-0">&bull;</span>
                    <input type="text" value={item} onChange={(e) => updateSubtopicItem(idx, e.target.value)}
                      className="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
                    <button type="button" onClick={() => removeSubtopicItem(idx)} title="Remove"
                      className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addSubtopicItem}
                  className="flex items-center gap-1 text-xs font-bold text-[#2E3093] hover:opacity-80 mt-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add sub-topic
                </button>
              </div>
            </div>

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
                <input type="text" value={form.Lecture_Start} onChange={set('Lecture_Start')} placeholder="e.g. 2:00PM" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Lecture End</label>
                <input type="text" value={form.Lecture_End} onChange={set('Lecture_End')} placeholder="e.g. 5:30PM" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Assignment Given</label>
                <input type="text" value={form.Assign_Given} onChange={set('Assign_Given')} placeholder="Assignment description" className={inputCls} />
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
          </div>

          {/* ── Additional Details — fields with no Lecture Plan equivalent ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Additional Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Trainer Start</label>
                <input type="text" value={form.Faculty_Start} onChange={set('Faculty_Start')} placeholder="e.g. 1:45PM" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Trainer End</label>
                <input type="text" value={form.Faculty_End} onChange={set('Faculty_End')} placeholder="e.g. 5:30PM" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Duration</label>
                <input type="text" value={form.Duration} onChange={set('Duration')} placeholder="e.g. 4 hrs" className={inputCls} />
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
