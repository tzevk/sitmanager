'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface StudentRow {
  Student_Id: number;
  Student_Name: string;
  Course_Name: string | null;
  Batch_code: string | null;
  Present_Mobile: string | null;
  Email: string | null;
}

export default function AddFeeDetailsPage() {
  const { canView, loading: permLoading } = useResourcePermissions('finance');
  const router = useRouter();

  const [students, setStudents] = useState<StudentRow[]>([]);

  const [studentId, setStudentId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);

  const searchStudents = async () => {
    const q = searchTerm.trim();
    setSearching(true);
    setStudents([]);
    setStudentId('');
    try {
      if (!q) return;
      const params = new URLSearchParams({ q });
      const res = await fetch(`/api/fee-details?${params.toString()}`);
      const d = await res.json();
      setStudents(d.rows ?? []);
    } finally {
      setSearching(false);
    }
  };

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
          <p className="text-[11px] text-white/60 mt-0.5">Search a student directly, then open the fee form to add or edit their receipt details</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Search Student</label>
            <div className="flex gap-2">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchStudents()}
                placeholder="Name, Student ID or Batch Code"
                className={`${ctrl} flex-1`}
              />
              <button
                onClick={searchStudents}
                disabled={searching}
                className="h-9 px-4 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252875] disabled:opacity-50"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">This removes the course and batch filter. Search the student directly, then continue to the fee form.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!students.length} className={ctrl}>
              <option value="">{searching ? 'Loading…' : 'Select Student'}</option>
              {students.map(s => (
                <option key={s.Student_Id} value={s.Student_Id}>
                  {s.Student_Name} ({s.Student_Id}){s.Batch_code ? ` - ${s.Batch_code}` : ''}
                </option>
              ))}
            </select>
            {students.length ? (
              <div className="text-[11px] text-slate-500">
                {students.length} match{students.length === 1 ? '' : 'es'} found
              </div>
            ) : null}
          </div>
        </div>

        {students.length > 0 && (
          <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Student</th>
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Course</th>
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Batch</th>
                  <th className="text-left py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Contact</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.Student_Id}
                    className={`cursor-pointer hover:bg-slate-50 ${String(student.Student_Id) === studentId ? 'bg-[#2E3093]/5' : ''}`}
                    onClick={() => setStudentId(String(student.Student_Id))}
                  >
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-medium">
                      {student.Student_Name} <span className="font-mono text-slate-400">({student.Student_Id})</span>
                    </td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">{student.Course_Name || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100 font-mono">{student.Batch_code || '—'}</td>
                    <td className="py-2 px-3 text-xs border-b border-slate-100">{student.Present_Mobile || student.Email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={!studentId}
            className="h-9 px-4 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252875] disabled:opacity-50"
          >
            Open Fee Form
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
