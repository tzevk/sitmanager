'use client';

import { useCallback, useEffect, useState } from 'react';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FilterBar, PageHeader, PrimaryBtn } from '@/components/ui/PageHeader';
import { useResourcePermissions } from '@/lib/permissions-context';

interface Course { id: number; name: string }
interface Batch { id: number; name: string }
interface Discipline { id: number; name: string }

interface ReportRow {
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
  SIT_Performance: string | null;
  Placement_Remark: string | null;
  Company: string | null;
  Designation: string | null;
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return s;
  return `${day}/${m}/${y}`;
}

export default function StudentInterviewReportPage() {
  const { canView, loading: permLoading } = useResourcePermissions('report_student_interview');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [year, setYear] = useState('');
  const [qualification, setQualification] = useState('');
  const [discipline, setDiscipline] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    (async () => {
      const [cRes, yRes, qRes, dRes] = await Promise.all([
        fetch('/api/reports/student-interview?options=courses'),
        fetch('/api/reports/student-interview?options=years'),
        fetch('/api/reports/student-interview?options=qualifications'),
        fetch('/api/reports/student-interview?options=disciplines'),
      ]);
      const [cd, yd, qd, dd] = await Promise.all([cRes.json(), yRes.json(), qRes.json(), dRes.json()]);
      setCourses(cd.courses ?? []);
      setYears(yd.years ?? []);
      setQualifications(qd.qualifications ?? []);
      setDisciplines(dd.disciplines ?? []);
    })();
  }, []);

  useEffect(() => {
    setBatchId('');
    setBatches([]);
    if (!courseId) return;
    (async () => {
      const res = await fetch(`/api/reports/student-interview?options=batches&courseId=${courseId}`);
      const data = await res.json();
      setBatches(data.batches ?? []);
    })();
  }, [courseId]);

  const fetchReport = useCallback(async () => {
    if (!courseId || !batchId || !year || !qualification || !discipline) {
      setError('Course, Batch, Year, Qualification, and Discipline are required.');
      return;
    }
    setError('');
    setLoading(true);
    setTriggered(true);
    try {
      const params = new URLSearchParams({ courseId, batchId, year, qualification, discipline });
      const res = await fetch(`/api/reports/student-interview?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch report');
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [courseId, batchId, year, qualification, discipline]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view the Student Search For Interview report." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Search For Interview Report"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Student Search For Interview' }]}
        meta={triggered ? `${rows.length} records` : 'Apply all filters'}
      />

      <FilterBar>
        <select className={`${ctrl} w-[170px]`} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Course*</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className={`${ctrl} w-[150px]`} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">Batch*</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select className={`${ctrl} w-[110px]`} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Year*</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <select className={`${ctrl} w-[170px]`} value={qualification} onChange={(e) => setQualification(e.target.value)}>
          <option value="">Qualification*</option>
          {qualifications.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>

        <select className={`${ctrl} w-[160px]`} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          <option value="">Discipline*</option>
          {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-3 text-left w-24">Code</th>
                  <th className="py-3 px-3 text-left">Student Name</th>
                  <th className="py-3 px-3 text-left w-28">Mobile</th>
                  <th className="py-3 px-3 text-left">Email</th>
                  <th className="py-3 px-3 text-left w-28">Qualification</th>
                  <th className="py-3 px-3 text-left w-24">Discipline</th>
                  <th className="py-3 px-3 text-left">Course</th>
                  <th className="py-3 px-3 text-left w-24">Batch</th>
                  <th className="py-3 px-3 text-left w-24">Batch Start</th>
                  <th className="py-3 px-3 text-left">Company</th>
                  <th className="py-3 px-3 text-left">Designation</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-gray-400">No records found</td>
                  </tr>
                ) : rows.map((r, i) => (
                  <tr key={r.Student_Id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 text-center text-gray-500">{i + 1}</td>
                    <td className="py-2.5 px-3">{r.Student_Code || '—'}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">{r.Student_Name}</td>
                    <td className="py-2.5 px-3">{r.Present_Mobile || '—'}</td>
                    <td className="py-2.5 px-3">{r.Email || '—'}</td>
                    <td className="py-2.5 px-3">{r.Qualification || '—'}</td>
                    <td className="py-2.5 px-3">{r.Discipline_Name || '—'}</td>
                    <td className="py-2.5 px-3">{r.Course_Name || '—'}</td>
                    <td className="py-2.5 px-3">{r.Batch_code || '—'}</td>
                    <td className="py-2.5 px-3">{fmtDate(r.Batch_Start)}</td>
                    <td className="py-2.5 px-3">{r.Company || '—'}</td>
                    <td className="py-2.5 px-3">{r.Designation || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}