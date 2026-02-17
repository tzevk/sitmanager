'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface BatchCategory {
  id: number;
  BatchCategory: string;
  Batch_Type: string;
  Prefix: string | null;
  Description: string | null;
}

export default function AddAnnualBatchPage() {
  const router = useRouter();

  /* --- form state --- */
  const [courseId, setCourseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [timings, setTimings] = useState('');
  const [inrBasic, setInrBasic] = useState('');
  const [dollarBasic, setDollarBasic] = useState('');
  const [courseName, setCourseName] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [trainingCompletionDate, setTrainingCompletionDate] = useState('');
  const [lastAdmissionDate, setLastAdmissionDate] = useState('');
  const [duration, setDuration] = useState('');
  const [trainingCoordinator, setTrainingCoordinator] = useState('');
  const [publish, setPublish] = useState('1');

  /* --- dropdown data --- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<BatchCategory[]>([]);

  /* --- ui --- */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [courseRes, catRes] = await Promise.all([
          fetch('/api/masters/course?limit=1000'),
          fetch('/api/masters/annual-batch/categories'),
        ]);
        const courseJson = await courseRes.json();
        const catJson = await catRes.json();
        setCourses(courseJson.rows || []);
        setCategories(Array.isArray(catJson) ? catJson : []);
      } catch {
        /* ignore */
      }
    };
    fetchOptions();
  }, []);

  /* Auto-fill course name when course changes */
  useEffect(() => {
    if (courseId) {
      const selected = courses.find((c) => c.Course_Id === Number(courseId));
      if (selected) {
        setCourseName(selected.Course_Name);
      }
    } else {
      setCourseName('');
    }
  }, [courseId, courses]);

  /* --- save --- */
  const handleSubmit = async () => {
    if (!courseId) {
      setError('Please select a course');
      return;
    }
    if (!categoryId) {
      setError('Batch Category is required');
      return;
    }
    if (!plannedStartDate) {
      setError('Planned Start Date is required');
      return;
    }
    if (!timings.trim()) {
      setError('Timings is required');
      return;
    }
    if (!courseName.trim()) {
      setError('Course Name is required');
      return;
    }
    if (!trainingCompletionDate) {
      setError('Training Completion Date is required');
      return;
    }
    if (!duration.trim()) {
      setError('Duration is required');
      return;
    }

    setError('');
    setSaving(true);

    const selectedCat = categories.find((c) => c.id === Number(categoryId));

    try {
      const res = await fetch('/api/masters/annual-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Course_Id: Number(courseId),
          Batch_code: batchCode || null,
          Category: selectedCat?.BatchCategory || null,
          Batch_Category_id: Number(categoryId),
          Timings: timings || null,
          SDate: plannedStartDate || null,
          ActualDate: actualDate || null,
          Admission_Date: lastAdmissionDate || null,
          EDate: trainingCompletionDate || null,
          Duration: duration || null,
          Training_Coordinator: trainingCoordinator || null,
          INR_Basic: inrBasic ? Number(inrBasic) : null,
          Dollar_Basic: dollarBasic ? Number(dollarBasic) : null,
          CourseName: courseName || null,
          Course_description: description || null,
          IsActive: Number(publish),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      router.push('/dashboard/masters/annual-batch');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  const handleCancel = () => {
    router.push('/dashboard/masters/annual-batch');
  };

  /* --- shared classes --- */
  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
  const inputCls =
    'max-w-[220px] w-full bg-white border-2 border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const selectCls =
    'max-w-[220px] w-full bg-white border-2 border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';

  const SectionCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
        <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
            {icon}
          </span>
          {title}
        </h3>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/masters/annual-batch')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Annual Batch</h2>
            <p className="text-xs text-white/70">Masters &gt; Annual Batch &gt; Add</p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        <div className="px-3 py-2 bg-gray-50/40">
          <div className="space-y-3">
            {/* Section: Course & Category */}
            <SectionCard
              title="Course & Category"
              icon={
                <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-1.5">
                {/* Select Course */}
                <div>
                  <label className={labelCls}>
                    Select Course <span className="text-red-400">*</span>
                  </label>
                  <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectCls}>
                    <option value="">Select</option>
                    {courses.map((c) => (
                      <option key={c.Course_Id} value={c.Course_Id}>
                        {c.Course_Name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch Category */}
                <div>
                  <label className={labelCls}>
                    Batch Category <span className="text-red-400">*</span>
                  </label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.BatchCategory}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="lg:col-span-1">
                  <label className={labelCls}>Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    className={inputCls}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Section: Schedule & Timings */}
            <SectionCard
              title="Schedule & Timings"
              icon={
                <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-1.5">
                {/* Planned Start Date */}
                <div>
                  <label className={labelCls}>
                    Planned Start Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Actual Date */}
                <div>
                  <label className={labelCls}>Actual Date</label>
                  <input
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Timings */}
                <div>
                  <label className={labelCls}>
                    Timings <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={timings}
                    onChange={(e) => setTimings(e.target.value)}
                    placeholder="Timings"
                    className={inputCls}
                  />
                </div>

                {/* Training Completion Date */}
                <div>
                  <label className={labelCls}>
                    Training Completion Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={trainingCompletionDate}
                    onChange={(e) => setTrainingCompletionDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Last Date of Admission */}
                <div>
                  <label className={labelCls}>Last Date of Admission</label>
                  <input
                    type="date"
                    value={lastAdmissionDate}
                    onChange={(e) => setLastAdmissionDate(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className={labelCls}>
                    Duration <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Duration"
                    className={inputCls}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Section: Fees & Details */}
            <SectionCard
              title="Fees & Details"
              icon={
                <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-1.5">
                {/* Basic (INR) */}
                <div>
                  <label className={labelCls}>Basic (INR)</label>
                  <input
                    type="number"
                    value={inrBasic}
                    onChange={(e) => setInrBasic(e.target.value)}
                    placeholder="Basic (INR)"
                    className={inputCls}
                  />
                </div>

                {/* Basic ($) */}
                <div>
                  <label className={labelCls}>Basic ($)</label>
                  <input
                    type="number"
                    value={dollarBasic}
                    onChange={(e) => setDollarBasic(e.target.value)}
                    placeholder="Basic ($)"
                    className={inputCls}
                  />
                </div>

                {/* Course Name (if changed) */}
                <div>
                  <label className={labelCls}>
                    Course Name (if changed) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Course Name"
                    className={inputCls}
                  />
                </div>

                {/* Batch Code */}
                <div>
                  <label className={labelCls}>Batch Code</label>
                  <input
                    type="text"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    placeholder="Batch Code"
                    className={inputCls}
                  />
                </div>

                {/* Training Coordinator */}
                <div>
                  <label className={labelCls}>Training Coordinator</label>
                  <input
                    type="text"
                    value={trainingCoordinator}
                    onChange={(e) => setTrainingCoordinator(e.target.value)}
                    placeholder="Training Coordinator"
                    className={inputCls}
                  />
                </div>

                {/* Publish */}
                <div>
                  <label className={labelCls}>Publish</label>
                  <select value={publish} onChange={(e) => setPublish(e.target.value)} className={selectCls}>
                    <option value="">Select</option>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Submit
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
