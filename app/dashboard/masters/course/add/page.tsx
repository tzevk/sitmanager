'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

export default function AddCoursePage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('course');

  /* form fields */
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [basicSubject, setBasicSubject] = useState('');
  const [objective, setObjective] = useState('');
  const [coursePreparation, setCoursePreparation] = useState('');

  /* ui state */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* ---- save course ---- */
  const handleSave = async () => {
    if (!courseName.trim()) {
      setError('Course Name is required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/masters/course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Course_Name: courseName,
          Course_Code: courseCode || null,
          Eligibility: eligibility || null,
          Introduction: introduction || null,
          Basic_Subject: basicSubject || null,
          Objective: objective || null,
          course_Preparation: coursePreparation || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      router.push('/dashboard/masters/course');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save course');
    }
    setSaving(false);
  };

  /* ---- shared classes ---- */
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';
  const inputCls =
    'max-w-md w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium';

  const SectionCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.03)] bg-white">
      <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-100">
        <h3 className="text-[14px] font-black text-[#2E3093] flex items-center gap-2.5 tracking-tight">
          <span className="w-8 h-8 rounded-xl bg-[#2E3093]/10 text-[#2A6BB5] flex items-center justify-center border border-[#2A6BB5]/20 shadow-sm">
            {icon}
          </span>
          {title}
        </h3>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );

  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to create courses." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#4547B2] rounded-2xl px-6 py-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="flex items-center gap-4 relative z-10">
          <button
            onClick={() => router.push('/dashboard/masters/course')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all shadow-sm border border-white/10 hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Add New Course</h2>
            <p className="text-[13px] text-white/70 font-medium mt-0.5">Masters &gt; Course &gt; Add</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Body */}
        <div className="px-3 py-2 bg-gray-50/40">
          <div className="space-y-3">
            {/* Section: Course Information */}
            <SectionCard
              title="Course Information"
              icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Course Name */}
                <div className="md:col-span-2 lg:col-span-1">
                  <label className={labelCls}>
                    Course Name <span className="text-red-500 text-sm leading-none">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Enter course name"
                    className={inputCls}
                  />
                </div>
                {/* Course Code */}
                <div>
                  <label className={labelCls}>Course Code</label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="Enter course code"
                    className={inputCls}
                  />
                </div>
                {/* Eligibility */}
                <div className="md:col-span-2">
                  <label className={labelCls}>Eligibility</label>
                  <input
                    type="text"
                    value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)}
                    placeholder="Enter eligibility criteria"
                    className={inputCls + ' max-w-none'}
                  />
                </div>
                {/* Introduction */}
                <div className="md:col-span-2 lg:col-span-3 xl:col-span-4">
                  <label className={labelCls}>Introduction</label>
                  <textarea
                    value={introduction}
                    onChange={(e) => setIntroduction(e.target.value)}
                    placeholder="Enter course introduction"
                    rows={2}
                    className={inputCls + ' max-w-none resize-none'}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Section: Syllabus & Objectives */}
            <SectionCard
              title="Syllabus & Objectives"
              icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            >
              <div className="space-y-3">
                {/* Key Points of Syllabus */}
                <div>
                  <label className={labelCls}>Key Points of Syllabus</label>
                  <textarea
                    value={basicSubject}
                    onChange={(e) => setBasicSubject(e.target.value)}
                    placeholder="Enter key points of the syllabus"
                    rows={3}
                    className={inputCls + ' max-w-none resize-none'}
                  />
                </div>
                {/* Objective */}
                <div>
                  <label className={labelCls}>Objective</label>
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="Enter course objectives"
                    rows={3}
                    className={inputCls + ' max-w-none resize-none'}
                  />
                </div>
                {/* Basic Study Preparation required */}
                <div>
                  <label className={labelCls}>Basic Study Preparation Required</label>
                  <textarea
                    value={coursePreparation}
                    onChange={(e) => setCoursePreparation(e.target.value)}
                    placeholder="Enter basic study preparation requirements"
                    rows={3}
                    className={inputCls + ' max-w-none resize-none'}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 mt-4 pt-5 border-t border-gray-100">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-gradient-to-br from-[#2E3093] to-[#4547B2] hover:to-[#23257A] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_4px_14px_rgba(46,48,147,0.3)] hover:shadow-[0_6px_20px_rgba(46,48,147,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Save Course
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/masters/course')}
                    className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
