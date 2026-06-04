'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FilterBar, PageHeader, PrimaryBtn } from '@/components/ui/PageHeader';
import { useResourcePermissions } from '@/lib/permissions-context';

interface Course { id: number; name: string }
interface Batch { id: number; name: string }

interface ReportRow {
  Row_Key: string;
  Student_Id: number;
  Student_Code: string | null;
  Student_Name: string;
  Present_Mobile: string | null;
  Email: string | null;
  Qualification: string | null;
  Discipline_Name: string | null;
  Course_Name: string | null;
  Batch_code: string | null;
  Batch_Start: string | null;
  Batch_End: string | null;
  Final_Result_Percent: string | null;
  Final_Grade: string | null;
  Placement_Remark: string | null;
  Shortlist_Status: 'Placed' | 'Interview Call' | '';
  Shortlist_Date: string | null;
  CV_Sent: string | null;
  Interviewed: string | null;
  Placed: string | null;
  Shortlist_Remark: string | null;
  Company: string | null;
  Designation: string | null;
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

function getRowTone(row: ReportRow): { rowClass: string; badgeClass: string; label: string | null } {
  const status = String(row.Shortlist_Status || '').trim();

  if (status === 'Placed') {
    return {
      rowClass: 'bg-yellow-200/85 hover:bg-yellow-300/85',
      badgeClass: 'bg-yellow-300 text-yellow-950 border border-yellow-500',
      label: 'Placed',
    };
  }

  if (status === 'Interview Call') {
    return {
      rowClass: 'bg-blue-200/85 hover:bg-blue-300/85',
      badgeClass: 'bg-blue-300 text-blue-950 border border-blue-500',
      label: 'Interview Call',
    };
  }

  return {
    rowClass: 'hover:bg-gray-50',
    badgeClass: '',
    label: null,
  };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return s;
  return `${day}/${m}/${y}`;
}

export default function StudentInterviewReportPage() {
  const { canView, canExport, loading: permLoading } = useResourcePermissions('report_student_interview');
  const [courseId, setCourseId] = useState('all');
  const [batchId, setBatchId] = useState('');
  const [year, setYear] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [triggered, setTriggered] = useState(false);

  const groupedRows = useMemo(() => {
    return rows.map((row, index) => {
      const previous = rows[index - 1];
      const showStudent = !previous || previous.Student_Id !== row.Student_Id;
      let rowSpan = 0;

      if (showStudent) {
        rowSpan = 1;
        while (index + rowSpan < rows.length && rows[index + rowSpan].Student_Id === row.Student_Id) {
          rowSpan += 1;
        }
      }

      return {
        ...row,
        showStudent,
        rowSpan,
      };
    });
  }, [rows]);

  useEffect(() => {
    (async () => {
      const [cRes, yRes] = await Promise.all([
        fetch('/api/reports/student-interview?options=courses'),
        fetch('/api/reports/student-interview?options=years'),
      ]);
      const [cd, yd] = await Promise.all([cRes.json(), yRes.json()]);
      setCourses(cd.courses ?? []);
      setYears(yd.years ?? []);
    })();
  }, []);

  useEffect(() => {
    setBatchId('');
    setBatches([]);
    (async () => {
      const res = await fetch(`/api/reports/student-interview?options=batches&courseId=${courseId}`);
      const data = await res.json();
      setBatches(data.batches ?? []);
    })();
  }, [courseId]);

  const fetchReport = useCallback(async () => {
    if (!batchId) {
      setError('Batch is required.');
      return;
    }
    setError('');
    setLoading(true);
    setTriggered(true);
    try {
      const params = new URLSearchParams({ courseId, batchId });
      if (year) params.set('year', year);
      const res = await fetch(`/api/reports/student-interview?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch report');
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [courseId, batchId, year]);

  const handleExport = useCallback(async () => {
    if (!batchId) {
      setError('Batch is required.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({ courseId, batchId, export: 'excel' });
      if (year) params.set('year', year);
      const res = await fetch(`/api/reports/student-interview?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to export report');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = fileNameMatch?.[1] || `Student_Search_For_Interview_${Date.now()}.xlsx`;
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to export report');
    } finally {
      setLoading(false);
    }
  }, [courseId, batchId, year]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the Student Search For Interview report." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Search For Interview Report"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Student Search For Interview' }]}
        meta={triggered ? `${rows.length} records` : 'Apply filters'}
        action={
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#24267A] transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2E3093]"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
            </svg>
            Excel
          </button>
        }
      />

      <FilterBar>
        <select className={`${ctrl} w-[170px]`} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="all">All Courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className={`${ctrl} w-[150px]`} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">Batch*</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select className={`${ctrl} w-[110px]`} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <PrimaryBtn onClick={fetchReport}>
          {loading ? 'Searching…' : 'Go'}
        </PrimaryBtn>
      </FilterBar>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {triggered && !error && (
        <div className="bg-white rounded-xl border border-[#2E3093]/10 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-zinc-50 text-[11px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500 bg-yellow-300 px-2.5 py-1 text-yellow-950">
              <span className="h-2 w-2 rounded-full bg-yellow-700" />
              Placed students
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500 bg-blue-300 px-2.5 py-1 text-blue-950">
              <span className="h-2 w-2 rounded-full bg-blue-700" />
              Interview calls
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1450px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-3 text-left w-24">Code</th>
                  <th className="py-3 px-3 text-left">Student Name</th>
                  <th className="py-3 px-3 text-left w-24">Final Grade</th>
                  <th className="py-3 px-3 text-left w-28">Mobile</th>
                  <th className="py-3 px-3 text-left">Email</th>
                  <th className="py-3 px-3 text-left w-28">Qualification</th>
                  <th className="py-3 px-3 text-left w-24">Discipline</th>
                  <th className="py-3 px-3 text-left">Course</th>
                  <th className="py-3 px-3 text-left w-24">Batch</th>
                  <th className="py-3 px-3 text-left w-24">Batch Start</th>
                  <th className="py-3 px-3 text-left w-24">Interview Date</th>
                  <th className="py-3 px-3 text-left w-28">Status</th>
                  <th className="py-3 px-3 text-center w-20">CV Sent</th>
                  <th className="py-3 px-3 text-center w-24">Interviewed</th>
                  <th className="py-3 px-3 text-center w-20">Placed</th>
                  <th className="py-3 px-3 text-left">Company</th>
                  <th className="py-3 px-3 text-left min-w-[220px]">Remark</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((r, i) => {
                  const tone = getRowTone(r);
                  return (
                  <tr key={r.Row_Key || `${r.Student_Id}-${i}`} className={`border-b border-gray-100 transition-colors ${tone.rowClass}`}>
                    {r.showStudent && (
                      <>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 text-center text-gray-500 align-top">{i + 1}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Student_Code || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 font-medium text-gray-900 align-top">{r.Student_Name}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Final_Grade || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Present_Mobile || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Email || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Qualification || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Discipline_Name || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Course_Name || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{r.Batch_code || '—'}</td>
                        <td rowSpan={r.rowSpan} className="py-2.5 px-3 align-top">{fmtDate(r.Batch_Start)}</td>
                      </>
                    )}
                    <td className="py-2.5 px-3">{fmtDate(r.Shortlist_Date)}</td>
                    <td className="py-2.5 px-3">
                      {tone.label ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badgeClass}`}>
                          {tone.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">{r.CV_Sent || '—'}</td>
                    <td className="py-2.5 px-3 text-center">{r.Interviewed || '—'}</td>
                    <td className="py-2.5 px-3 text-center">{r.Placed || '—'}</td>
                    <td className="py-2.5 px-3">{r.Company || '—'}</td>
                    <td className="py-2.5 px-3 whitespace-pre-wrap break-words">{r.Shortlist_Remark || '—'}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}