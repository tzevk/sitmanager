'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface CourseOption { Course_Id: number; Course_Name: string; }
interface BatchOption { Batch_Id: number; Batch_code: string; }
interface StudentRow { Student_Id: number; Student_Name: string; }

export default function AddFeeDetailsPage() {
  const { canView, loading: permLoading } = useResourcePermissions('finance');
  const router = useRouter();

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/reports/fees?tab=fees-details&action=courses')
      .then(r => r.json())
      .then(d => setCourses(d.courses ?? []));
  }, []);

  useEffect(() => {
    setBatchId('');
    setBatches([]);
    setStudents([]);
    setStudentId('');
    if (!courseId) return;
    setBatchesLoading(true);
    fetch(`/api/reports/fees?tab=fees-details&action=batches&courseId=${courseId}`)
      .then(r => r.json())
      .then(d => setBatches(d.batches ?? []))
      .finally(() => setBatchesLoading(false));
  }, [courseId]);

  useEffect(() => {
    setStudents([]);
    setStudentId('');
    if (!batchId) return;
    setStudentsLoading(true);
    const params = new URLSearchParams({ courseId, batchId });
    fetch(`/api/fee-details?${params.toString()}`)
      .then(r => r.json())
      .then(d => setStudents(d.rows ?? []))
      .finally(() => setStudentsLoading(false));
  }, [courseId, batchId]);

  const handleImport = () => {
    if (!studentId) return;
    router.push(`/dashboard/fee-details/${studentId}`);
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied />;

  const ctrl = 'h-9 px-3 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 disabled:opacity-50';

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10">
          <h2 className="text-sm font-black text-white tracking-tight leading-none">Add Fees Details</h2>
          <p className="text-[11px] text-white/60 mt-0.5">Select a training programme, batch code and student to import their fee details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Training Programme</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={ctrl}>
              <option value="">Select Course</option>
              {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Batch Code</label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!courseId} className={ctrl}>
              <option value="">{batchesLoading ? 'Loading…' : 'Select Batch'}</option>
              {batches.map(b => <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_code}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!batchId} className={ctrl}>
              <option value="">{studentsLoading ? 'Loading…' : 'Select Student'}</option>
              {students.map(s => <option key={s.Student_Id} value={s.Student_Id}>{s.Student_Name} ({s.Student_Id})</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={!studentId}
            className="h-9 px-4 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252875] disabled:opacity-50"
          >
            Import Details
          </button>
          <button
            onClick={() => router.push('/dashboard/fee-details')}
            className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
