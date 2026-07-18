'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';

interface Lecture {
  id: number;
  lecture_no: number | null;
  subject: string | null;
  subject_topic: string | null;
  date: string | null;
  lectureday: string | null;
  starttime: string | null;
  endtime: string | null;
  faculty_id: number | null;
  faculty_name: string | null;
  class_room: string | null;
  documents: string | null;
  unit_test: string | null;
  publish: string | null;
}

interface Faculty {
  Faculty_Id: number;
  Faculty_Name: string;
}

interface BatchInfo {
  Batch_Id: number;
  Batch_code: string | null;
  Course_Id: number | null;
  Course_Name: string | null;
  Course_description: string | null;
}

interface CourseInfo {
  Course_Id: number;
  Course_Name: string | null;
  Course_Code: string | null;
  Eligibility: string | null;
  Introduction: string | null;
  Basic_Subject: string | null;
  Objective: string | null;
  course_Preparation: string | null;
}

interface Assignment {
  id: number;
  assignment_no: number | null;
  assignment_name: string | null;
  description: string | null;
  input_documents: string | null;
  deliverable_produced: string | null;
  trainer: string | null;
  department: string | null;
}

const TABS = [
  { id: 'lecture-topics', label: 'Lecture Topics' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'syllabus', label: 'Syllabus' },
] as const;

const labelCls = 'block text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/10 focus:border-[#2E3093] transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed';
const sectionTitleCls = 'text-xs font-black text-[#2E3093] flex items-center gap-1.5 mb-2';

/** Legacy rows store time as Excel-epoch strings like "1899-12-30 08:00:00.000"; extract HH:MM for <input type="time">. */
const toTimeInputValue = (value: string | null): string => {
  if (!value) return '';
  const match = value.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
};

export default function StandardLecturePlanEditPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params?.id as string;
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('standard_lecture_plan');

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('lecture-topics');

  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lectureSearch, setLectureSearch] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    assignment_no: '',
    assignment_name: '',
    description: '',
    input_documents: '',
    deliverable_produced: '',
    trainer: '',
    department: '',
  });

  const fetchAll = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError('');
    try {
      const [batchRes, slecturesRes] = await Promise.all([
        fetch(`/api/masters/batch/${batchId}`),
        fetch(`/api/masters/batch/${batchId}/slectures`),
      ]);
      const batchJson = await batchRes.json();
      if (!batchRes.ok) throw new Error(batchJson?.error || 'Failed to load batch');
      const info: BatchInfo = batchJson.data;
      setBatchInfo(info);

      const slecturesJson = await slecturesRes.json();
      const loadedLectures: Lecture[] = slecturesJson.lectures || [];
      setLectures(loadedLectures);
      setFacultyList(slecturesJson.facultyList || []);
      setSelectedId(prev => prev ?? loadedLectures[0]?.id ?? null);

      if (info?.Course_Id) {
        const courseRes = await fetch(`/api/masters/course/${info.Course_Id}`);
        if (courseRes.ok) {
          setCourseInfo(await courseRes.json());
        }
      }

      if (info?.Course_Name) {
        const assignRes = await fetch(`/api/masters/standard-lecture-plan/assignments?course=${encodeURIComponent(info.Course_Name)}`);
        if (assignRes.ok) {
          const assignJson = await assignRes.json();
          setAssignments(assignJson.rows || []);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchAssignments = useCallback(async () => {
    if (!batchInfo?.Course_Name) return;
    const res = await fetch(`/api/masters/standard-lecture-plan/assignments?course=${encodeURIComponent(batchInfo.Course_Name)}`);
    if (res.ok) {
      const json = await res.json();
      setAssignments(json.rows || []);
    }
  }, [batchInfo?.Course_Name]);

  const updateLectureInline = (id: number, patch: Partial<Lecture>) => {
    setLectures(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  /** Subject Topic is stored as a newline-separated list. */
  const getSubtopicList = (text: string | null): string[] => {
    if (!text) return [''];
    const items = text.split('\n');
    return items.length ? items : [''];
  };

  const updateSubtopicItem = (lectureId: number, index: number, value: string) => {
    const lecture = lectures.find(l => l.id === lectureId);
    if (!lecture) return;
    const items = getSubtopicList(lecture.subject_topic);
    items[index] = value;
    updateLectureInline(lectureId, { subject_topic: items.join('\n') });
  };

  const addSubtopicItem = (lectureId: number) => {
    const lecture = lectures.find(l => l.id === lectureId);
    if (!lecture) return;
    const items = getSubtopicList(lecture.subject_topic);
    items.push('');
    updateLectureInline(lectureId, { subject_topic: items.join('\n') });
  };

  const removeSubtopicItem = (lectureId: number, index: number) => {
    const lecture = lectures.find(l => l.id === lectureId);
    if (!lecture) return;
    const items = getSubtopicList(lecture.subject_topic);
    items.splice(index, 1);
    updateLectureInline(lectureId, { subject_topic: items.length ? items.join('\n') : null });
  };

  const handleSaveRow = async (row: Lecture) => {
    setSavingRowId(row.id);
    setSaveMessage('');
    try {
      await fetch(`/api/masters/batch/${batchId}/slectures`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      setSaveMessage('Saved.');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Failed to save.');
    }
    setSavingRowId(null);
  };

  const handleAddLecture = async () => {
    if (!canUpdate || adding) return;
    setAdding(true);
    try {
      const nextNo = lectures.reduce((max, l) => Math.max(max, l.lecture_no ?? 0), 0) + 1;
      const res = await fetch(`/api/masters/batch/${batchId}/slectures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lecture_no: nextNo, subject: 'New Lecture', publish: 'No' }),
      });
      const data = await res.json();
      await fetchAll();
      if (data?.insertId) setSelectedId(data.insertId);
    } catch {
      /* ignore */
    }
    setAdding(false);
  };

  const handleAddAssignment = async () => {
    if (!canUpdate || savingAssignment || !batchInfo?.Course_Name) return;
    if (!newAssignment.assignment_name.trim()) return;
    setSavingAssignment(true);
    try {
      await fetch('/api/masters/standard-lecture-plan/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAssignment, course_name: batchInfo.Course_Name }),
      });
      setNewAssignment({
        assignment_no: '',
        assignment_name: '',
        description: '',
        input_documents: '',
        deliverable_produced: '',
        trainer: '',
        department: '',
      });
      setShowAddAssignment(false);
      await fetchAssignments();
    } catch {
      /* ignore */
    }
    setSavingAssignment(false);
  };

  const selectedLecture = lectures.find(l => l.id === selectedId) ?? null;
  const filteredLectures = lectures.filter(l => {
    const q = lectureSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.subject ?? '').toLowerCase().includes(q) ||
      (l.subject_topic ?? '').toLowerCase().includes(q) ||
      String(l.lecture_no ?? '').includes(q)
    );
  });

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-sm font-semibold">Access Denied</p>
        <p className="text-xs">You do not have permission to view standard lecture plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header (compact) */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-base font-black text-white tracking-tight truncate">
              {batchInfo?.Batch_code || `Batch #${batchId}`}
            </h2>
            <p className="text-[11px] text-white/70 font-medium truncate">
              {batchInfo?.Course_Name || '—'}
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/masters/standard-lecture-plan')}
            className="px-2.5 py-1 text-xs font-bold text-white bg-white/10 border border-white/30 rounded-lg hover:bg-white/20 transition-all shrink-0"
          >
            Back
          </button>
        </div>
      </div>

      {/* Main Card with Tabs (single enclosing container) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-slate-200 bg-slate-50 px-2 pt-1.5">
          <div className="flex overflow-x-auto scrollbar-hide gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-t-lg border border-b-0 transition-colors ${
                  activeTab === t.id
                    ? 'border-slate-200 text-[#2E3093] bg-white shadow-sm'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-3 bg-slate-50/40">
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-50/60 text-red-700 text-xs font-medium">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === 'lecture-topics' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-2 h-[70vh]">
              {/* Lecture list (left) */}
              <div className="min-h-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-2.5 py-2 border-b border-slate-100 flex items-center gap-1.5 shrink-0">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={lectureSearch}
                      onChange={e => setLectureSearch(e.target.value)}
                      placeholder="Search…"
                      className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all"
                    />
                    <svg className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {canUpdate && (
                    <button
                      onClick={handleAddLecture}
                      disabled={adding}
                      title="Add Lecture"
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-white bg-[#2E3093] rounded-md hover:opacity-90 disabled:opacity-60 shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add
                    </button>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
                  {filteredLectures.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      No lecture topics found for this batch.
                    </div>
                  ) : (
                    filteredLectures.map(l => (
                      <div
                        key={l.id}
                        className={`w-full flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                          selectedId === l.id ? 'bg-[#2E3093]/5 border-l-4 border-[#2E3093]' : 'border-l-4 border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <button onClick={() => setSelectedId(l.id)} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black text-[#2E3093]">Lec {l.lecture_no ?? '—'}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              l.publish === 'Yes' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {l.publish === 'Yes' ? 'Pub' : 'Draft'}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-800 truncate">{l.subject || 'Untitled'}</div>
                          <div className="text-[9px] text-slate-400 truncate">{l.date || 'No date'}</div>
                        </button>
                        {canUpdate && (
                          <button
                            onClick={() => setSelectedId(l.id)}
                            title="Edit"
                            className="p-1 rounded-md hover:bg-[#FAE452]/70 text-[#2E3093] transition-colors shrink-0"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Edit panel (right) */}
              <div className="min-h-0 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
                {!selectedLecture ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                    Select a lecture from the list to view or edit its details.
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                      {/* Schedule section */}
                      <div>
                        <h3 className={sectionTitleCls}>
                          <span className="w-1 h-3 rounded-full bg-[#2E3093]" />
                          Schedule
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <label className={labelCls}>Lecture No.</label>
                            <input type="number" className={inputCls} value={selectedLecture.lecture_no ?? ''} disabled={!canUpdate}
                              onChange={e => updateLectureInline(selectedLecture.id, { lecture_no: e.target.value ? Number(e.target.value) : null })} />
                          </div>
                          <div>
                            <label className={labelCls}>Date</label>
                            <input type="date" className={inputCls} value={selectedLecture.date ?? ''} disabled={!canUpdate}
                              onChange={e => updateLectureInline(selectedLecture.id, { date: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelCls}>Day</label>
                            <input type="text" className={inputCls} value={selectedLecture.lectureday ?? ''} disabled={!canUpdate}
                              onChange={e => updateLectureInline(selectedLecture.id, { lectureday: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className={labelCls}>Start</label>
                              <input type="time" className={inputCls} value={toTimeInputValue(selectedLecture.starttime)} disabled={!canUpdate}
                                onChange={e => updateLectureInline(selectedLecture.id, { starttime: e.target.value })} />
                            </div>
                            <div>
                              <label className={labelCls}>End</label>
                              <input type="time" className={inputCls} value={toTimeInputValue(selectedLecture.endtime)} disabled={!canUpdate}
                                onChange={e => updateLectureInline(selectedLecture.id, { endtime: e.target.value })} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content section */}
                      <div>
                        <h3 className={sectionTitleCls}>
                          <span className="w-1 h-3 rounded-full bg-[#2E3093]" />
                          Content
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <label className={labelCls}>Subject</label>
                            <input type="text" className={inputCls} value={selectedLecture.subject ?? ''} disabled={!canUpdate}
                              onChange={e => updateLectureInline(selectedLecture.id, { subject: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelCls}>Subject Topic</label>
                            <div className="space-y-1">
                              {getSubtopicList(selectedLecture.subject_topic).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <span className="text-slate-400 text-xs shrink-0">•</span>
                                  <input
                                    type="text"
                                    className={inputCls}
                                    value={item}
                                    disabled={!canUpdate}
                                    onChange={e => updateSubtopicItem(selectedLecture.id, idx, e.target.value)}
                                  />
                                  {canUpdate && (
                                    <button
                                      onClick={() => removeSubtopicItem(selectedLecture.id, idx)}
                                      title="Remove"
                                      className="p-1 text-slate-400 hover:text-red-500 shrink-0"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                              {canUpdate && (
                                <button
                                  onClick={() => addSubtopicItem(selectedLecture.id)}
                                  className="flex items-center gap-1 text-[11px] font-bold text-[#2E3093] hover:opacity-80 mt-1"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                  </svg>
                                  Add sub-topic
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Trainer & Logistics section */}
                      <div>
                        <h3 className={sectionTitleCls}>
                          <span className="w-1 h-3 rounded-full bg-[#2E3093]" />
                          Trainer &amp; Logistics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Trainer</label>
                            <select className={inputCls} disabled={!canUpdate}
                              value={selectedLecture.faculty_id ?? ''}
                              onChange={e => {
                                const fid = e.target.value ? Number(e.target.value) : null;
                                const f = facultyList.find(x => x.Faculty_Id === fid);
                                updateLectureInline(selectedLecture.id, { faculty_id: fid, faculty_name: f?.Faculty_Name ?? selectedLecture.faculty_name });
                              }}>
                              <option value="">{selectedLecture.faculty_name || 'Select trainer'}</option>
                              {facultyList.map(f => (
                                <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Room</label>
                            <input type="text" className={inputCls} value={selectedLecture.class_room ?? ''} disabled={!canUpdate}
                              onChange={e => updateLectureInline(selectedLecture.id, { class_room: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelCls}>Documents</label>
                            <input type="text" className={inputCls} value={selectedLecture.documents ?? ''} disabled={!canUpdate}
                              onChange={e => updateLectureInline(selectedLecture.id, { documents: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelCls}>Unit Test</label>
                            <input type="text" className={inputCls} value={selectedLecture.unit_test ?? ''} disabled={!canUpdate}
                              onChange={e => updateLectureInline(selectedLecture.id, { unit_test: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelCls}>Publish</label>
                            <select className={inputCls} disabled={!canUpdate} value={selectedLecture.publish ?? 'No'}
                              onChange={e => updateLectureInline(selectedLecture.id, { publish: e.target.value })}>
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {canUpdate && (
                      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 shrink-0">
                        <button
                          onClick={() => handleSaveRow(selectedLecture)}
                          disabled={savingRowId === selectedLecture.id}
                          className="flex items-center gap-1.5 bg-[#2E3093] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-60"
                        >
                          {savingRowId === selectedLecture.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Save Changes
                            </>
                          )}
                        </button>
                        {saveMessage && <span className="text-xs font-medium text-emerald-600">{saveMessage}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : activeTab === 'assignments' ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600">
                  {assignments.length} assignment{assignments.length === 1 ? '' : 's'} for {batchInfo?.Course_Name || 'this course'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 hidden md:inline">To import, use Batch Master &gt; Lecture Plan &gt; Import</span>
                  {canUpdate && (
                    <button
                      onClick={() => setShowAddAssignment(v => !v)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-white bg-[#2E3093] rounded-md hover:opacity-90"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add
                    </button>
                  )}
                </div>
              </div>

              {showAddAssignment && (
                <div className="px-3 py-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className={labelCls}>Assignment No.</label>
                      <input type="number" className={inputCls} value={newAssignment.assignment_no}
                        onChange={e => setNewAssignment({ ...newAssignment, assignment_no: e.target.value })} />
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <label className={labelCls}>Assignment Name</label>
                      <input type="text" className={inputCls} value={newAssignment.assignment_name}
                        onChange={e => setNewAssignment({ ...newAssignment, assignment_name: e.target.value })} />
                    </div>
                    <div className="col-span-2 md:col-span-4">
                      <label className={labelCls}>Description</label>
                      <input type="text" className={inputCls} value={newAssignment.description}
                        onChange={e => setNewAssignment({ ...newAssignment, description: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Input Documents</label>
                      <input type="text" className={inputCls} value={newAssignment.input_documents}
                        onChange={e => setNewAssignment({ ...newAssignment, input_documents: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Deliverable Produced</label>
                      <input type="text" className={inputCls} value={newAssignment.deliverable_produced}
                        onChange={e => setNewAssignment({ ...newAssignment, deliverable_produced: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Trainer</label>
                      <input type="text" className={inputCls} value={newAssignment.trainer}
                        onChange={e => setNewAssignment({ ...newAssignment, trainer: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Department</label>
                      <input type="text" className={inputCls} value={newAssignment.department}
                        onChange={e => setNewAssignment({ ...newAssignment, department: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleAddAssignment}
                      disabled={savingAssignment || !newAssignment.assignment_name.trim()}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#2E3093] rounded-lg hover:opacity-90 disabled:opacity-60"
                    >
                      {savingAssignment ? 'Saving...' : 'Save Assignment'}
                    </button>
                    <button
                      onClick={() => setShowAddAssignment(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
                {assignments.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-slate-400">
                    No standard assignments found for this course.
                  </div>
                ) : (
                  assignments.map(a => (
                    <div key={a.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#2E3093]">#{a.assignment_no ?? '—'}</span>
                        <span className="text-xs font-semibold text-slate-800">{a.assignment_name || 'Untitled'}</span>
                      </div>
                      {a.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{a.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[10px] text-slate-400">
                        {a.input_documents && <span>Input: {a.input_documents}</span>}
                        {a.deliverable_produced && <span>Deliverable: {a.deliverable_produced}</span>}
                        {a.trainer && <span>Trainer: {a.trainer}</span>}
                        {a.department && <span>Dept: {a.department}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Course</h3>
                <p className="text-xs text-slate-900 font-semibold">{batchInfo?.Course_Name || courseInfo?.Course_Name || '—'}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Course Description (Batch)</h3>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{batchInfo?.Course_description || '—'}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Introduction</h3>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{courseInfo?.Introduction || '—'}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Eligibility</h3>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{courseInfo?.Eligibility || '—'}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Basic Subject</h3>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{courseInfo?.Basic_Subject || '—'}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Objective</h3>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{courseInfo?.Objective || '—'}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Course Preparation</h3>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{courseInfo?.course_Preparation || '—'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
