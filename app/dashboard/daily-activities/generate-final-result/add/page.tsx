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
interface Employee { Emp_Id: number; Employee_Name: string; }
interface Faculty { Faculty_Id: number; Faculty_Name: string; }

/* eslint-disable @typescript-eslint/no-explicit-any */
type ReportCardRow = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface FormData {
  Course_Id: string;
  Batch_Id: string;
  Result_Dt: string;
  Print_Dt: string;
  Approved_By: string;
  Period_Start: string;
  Period_End: string;
  Faculty1: string;
  Faculty2: string;
}

const emptyForm: FormData = {
  Course_Id: '',
  Batch_Id: '',
  Result_Dt: new Date().toISOString().slice(0, 10),
  Print_Dt: '',
  Approved_By: '',
  Period_Start: '',
  Period_End: '',
  Faculty1: '',
  Faculty2: '',
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AddGenerateFinalResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const isEdit = !!editId;

  const { canCreate, loading: permLoading } = useResourcePermissions('final_result');

  const [form, setForm] = useState<FormData>(emptyForm);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resultId, setResultId] = useState<string>(editId || '');
  const [printing, setPrinting] = useState(false);
  const [reportCardRows, setReportCardRows] = useState<ReportCardRow[]>([]);
  const [reportCardLoading, setReportCardLoading] = useState(false);
  const [reportCardError, setReportCardError] = useState('');

  /* ── Load courses & employees on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const [courseRes, empRes, facRes] = await Promise.all([
          fetch('/api/daily-activities/generate-final-result?options=courses'),
          fetch('/api/daily-activities/generate-final-result?options=employees'),
          fetch('/api/daily-activities/generate-final-result?options=faculties'),
        ]);
        const courseData = await courseRes.json();
        const empData = await empRes.json();
        const facData = await facRes.json();
        setCourses(courseData.courses || []);
        setEmployees(empData.employees || []);
        setFaculties(facData.faculties || []);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Load edit data ── */
  useEffect(() => {
    if (!editId) return;
    setLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/generate-final-result?id=${editId}`);
        const data = await res.json();
        if (data.finalResult) {
          const a = data.finalResult;
          setForm({
            Course_Id: String(a.Course_Id || ''),
            Batch_Id: String(a.Batch_Id || ''),
            Result_Dt: a.Result_Dt ? a.Result_Dt.slice(0, 10) : '',
            Print_Dt: a.Print_Dt ? a.Print_Dt.slice(0, 10) : '',
            Approved_By: String(a.Approved_By || ''),
            Period_Start: a.Period_Start ? a.Period_Start.slice(0, 10) : '',
            Period_End: a.Period_End ? a.Period_End.slice(0, 10) : '',
            Faculty1: String(a.Faculty1 || ''),
            Faculty2: String(a.Faculty2 || ''),
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
        const res = await fetch(`/api/daily-activities/generate-final-result?options=batches&courseId=${form.Course_Id}`);
        const data = await res.json();
        setBatches(data.batches || []);
      } catch { /* ignore */ }
    })();
  }, [form.Course_Id]);

  /* ── Load report card preview whenever a result exists ── */
  useEffect(() => {
    if (!resultId) { setReportCardRows([]); setReportCardError(''); return; }
    setReportCardLoading(true);
    setReportCardError('');
    (async () => {
      try {
        const res = await fetch(`/api/daily-activities/generate-final-result/report-card?genId=${resultId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load report card data');
        setReportCardRows(data.students || []);
      } catch (err: unknown) {
        setReportCardRows([]);
        setReportCardError(err instanceof Error ? err.message : 'Failed to load report card data');
      }
      setReportCardLoading(false);
    })();
  }, [resultId]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  /* ── Submit (Generate) ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        Course_Id: form.Course_Id ? parseInt(form.Course_Id) : null,
        Batch_Id: form.Batch_Id ? parseInt(form.Batch_Id) : null,
        Result_Dt: form.Result_Dt || null,
        Print_Dt: form.Print_Dt || null,
        Approved_By: form.Approved_By ? parseInt(form.Approved_By) : null,
        Period_Start: form.Period_Start || null,
        Period_End: form.Period_End || null,
        Faculty1: form.Faculty1 ? parseInt(form.Faculty1) : null,
        Faculty2: form.Faculty2 ? parseInt(form.Faculty2) : null,
      };
      if (isEdit) payload.Result_Id = parseInt(editId!);

      const res = await fetch('/api/daily-activities/generate-final-result', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setSuccess(isEdit ? 'Final result updated successfully!' : 'Final result generated successfully!');
      if (!isEdit && data.Result_Id) {
        setResultId(String(data.Result_Id));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  /* ── Action button handler (placeholder for future) ── */
  const handleAction = (action: string) => {
    if (!form.Course_Id || !form.Batch_Id) {
      setError('Please select Course and Batch first.');
      return;
    }
    alert(`Action: ${action}\n\nThis will process "${action}" for the selected batch. Feature coming soon.`);
  };

  /* ── Print Performance Report (F/TD/08/02) ── */
  // Marks, attendance and grades are calculated live (lib/performance-report.ts —
  // same numbers as the Final Exam report); this only lays them out like the
  // printed Performance Report. Every value is HTML-escaped before printing.
  const handlePrintReportCard = async () => {
    if (!resultId) {
      setError('Please Generate the final result first, then Print Performance Report.');
      return;
    }
    setError(''); setPrinting(true);
    try {
      const res = await fetch(`/api/daily-activities/generate-final-result/performance-report?genId=${resultId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load performance report');

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const header: any = data.header || {};
      const students: any[] = data.students || [];
      const criteria: any[] = data.passingCriteria || [];
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
      const fix2 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(2) : '0.00'; };
      const pct = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0'; };
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const reportDate = (() => {
        const m = String(header.Result_date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]} - ${months[Number(m[2]) - 1]} - ${m[1]}` : '';
      })();
      const gradeLabel = (g: string) => (g === 'NO CERT' ? 'NO CERTIFICATE' : g || 'NA');
      const range = (c: { grade: string; from: number; to: number | null }) =>
        c.grade === 'No certificate' ? `${fix2(c.to)} and below` : `${fix2(c.from)}% to ${c.to === 100 ? '100' : fix2(c.to)}%`;

      // One cell per assignment / unit test: number on top, mark (or Absent /
      // Not Submitted / -) underneath. Absent-type cells are bold so they stand out.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markGrid = (cells: any[], prefix: string) => cells.length === 0
        ? '<span class="muted">None recorded</span>'
        : `<table class="grid"><tr>${cells.map((c) => `<th>${prefix}${esc(c.no)}</th>`).join('')}</tr>
             <tr>${cells.map((c) => `<td class="${c.status === 'marks' ? '' : 'flag'}">${esc(c.display)}</td>`).join('')}</tr></table>`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const card = (s: any) => `
        <div class="page">
          <table class="rep">
            <tr><th colspan="4" class="title">PERFORMANCE REPORT</th></tr>
            <tr>
              <td colspan="2">Name : <b>${esc(s.Student_Name)}</b></td>
              <td colspan="2">ID No : <b>${esc(s.Roll_No || s.Student_Code)}</b></td>
            </tr>
            <tr>
              <td colspan="2">Training Programme: <b>${esc(header.Course_Name)}</b></td>
              <td>Batch No : <b>${esc(header.Batch_code)}</b></td>
              <td>Date: <b>${esc(reportDate)}</b></td>
            </tr>
            <tr>
              <td class="lbl" colspan="2"><b>Passing Criteria :</b></td>
              <td colspan="2" class="nopad">
                <table class="crit">${criteria.map((c) => `<tr><td>${esc(c.grade)}</td><td>${esc(range(c))}</td></tr>`).join('')}</table>
              </td>
            </tr>
            ${header.Course_Description ? `<tr><td colspan="4" class="desc"><b>Brief Description of Training Programme :</b><br/>${esc(header.Course_Description)}</td></tr>` : ''}
          </table>

          <table class="rep sec">
            <tr><td rowspan="5" class="no">01</td><td rowspan="5" class="name">Assignments</td>
                <td class="k">Total No of Assignments</td><td>${esc(s.assignments.total)}</td></tr>
            <tr><td class="k">Assignments Submitted</td><td>${esc(s.assignments.submitted)}</td></tr>
            <tr><td class="k">Marks obtained in Assignments</td><td class="nopad">${markGrid(s.assignments.cells, 'A')}</td></tr>
            <tr><td class="k">Total Marks obtained in Assignments</td><td>${esc(s.assignments.obtained)} / ${esc(s.assignments.max)}</td></tr>
            <tr><td class="k"><b>Weightage - ${esc(s.assignments.weightage)}%</b></td><td>${fix2(s.assignments.weighted)}<span class="tag">(A)</span></td></tr>

            <tr><td rowspan="5" class="no">02</td><td rowspan="5" class="name">Unit Tests</td>
                <td class="k">Total Unit Test/s</td><td>${esc(s.unitTests.total)}</td></tr>
            <tr><td class="k">Attended Unit Test/s</td><td>${esc(s.unitTests.attended)}</td></tr>
            <tr><td class="k">Marks obtained in Unit Test/s</td><td class="nopad">${markGrid(s.unitTests.cells, 'T')}</td></tr>
            <tr><td class="k">Total Marks obtained in Unit Test/s</td><td>${esc(s.unitTests.obtained)} / ${esc(s.unitTests.max)}</td></tr>
            <tr><td class="k"><b>Weightage - ${esc(s.unitTests.weightage)}%</b></td><td>${fix2(s.unitTests.weighted)}<span class="tag">(B)</span></td></tr>

            <tr><td rowspan="2" class="no">03</td><td rowspan="2" class="name">Final Examination</td>
                <td class="k">Marks obtained</td>
                <td class="nopad"><table class="grid">
                  <tr>${s.finalExam.attempts.map((a: { label: string }) => `<th>${esc(a.label)}</th>`).join('')}</tr>
                  <tr>${s.finalExam.attempts.map((a: { status: string; display: string }) => `<td class="${a.status === 'marks' ? '' : 'flag'}">${esc(a.display)}</td>`).join('')}</tr>
                </table></td></tr>
            <tr><td class="k"><b>Weightage - ${esc(s.finalExam.weightage)}%</b></td><td>${fix2(s.finalExam.weighted)}<span class="tag">(C)</span></td></tr>

            <tr><td rowspan="3" class="no">04</td><td rowspan="3" class="name">Attendance Record</td>
                <td class="k">Attended Lectures/Total Lectures</td><td>${esc(s.attendance.attended)} / ${esc(s.attendance.total)}</td></tr>
            <tr><td class="k">Total No of Absent Days</td><td>${esc(s.attendance.absentDays)}</td></tr>
            <tr><td class="k"><b>Attendance %</b></td><td>${pct(s.attendance.percentage)}</td></tr>

            <tr><td rowspan="${Number(s.discipline) > 0 ? 3 : 2}" class="no">05</td><td rowspan="${Number(s.discipline) > 0 ? 3 : 2}" class="name">Final Result</td>
                <td class="k"><b>A + B + C${Number(s.discipline) > 0 ? ' − Discipline' : ''}</b></td><td>${fix2(s.totalScore)}</td></tr>
            ${Number(s.discipline) > 0 ? `<tr><td class="k">Discipline deduction</td><td>${fix2(s.discipline)}</td></tr>` : ''}
            <tr><td class="k"><b>Grade</b></td><td><b>${esc(gradeLabel(s.grade))}</b></td></tr>
          </table>

          <table class="rep sign">
            <tr><td class="space"></td><td class="space"></td><td class="space"></td></tr>
            <tr><td>${esc(header.faculty2)}</td><td>${esc(header.faculty1)}</td><td>${esc(header.approve_by)}</td></tr>
            <tr><th>${esc(header.Label2 || 'Training Coordinator')}</th><th>${esc(header.Label1 || 'Faculty')}</th><th>Managing Director</th></tr>
          </table>
          <div class="form-no">F/TD/08/02</div>
        </div>`;

      const w = window.open('', '_blank');
      if (!w) { setError('Please allow popups to print the performance report.'); setPrinting(false); return; }

      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Performance Report - ${esc(header.Batch_code)}</title><style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 11.5px; }
        .page { width: 760px; margin: 0 auto; padding: 36px 40px 20px; page-break-after: always; }
        table.rep { width: 100%; border-collapse: collapse; }
        table.rep + table.rep { margin-top: -1px; }
        .rep th, .rep td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; text-align: left; }
        .rep .title { text-align: center; font-size: 13px; padding: 7px; }
        .rep .lbl { vertical-align: middle; }
        .rep .nopad { padding: 0; }
        .rep .desc { font-size: 9.5px; line-height: 1.35; }
        .crit { width: 100%; border-collapse: collapse; }
        .crit td { border: none; border-bottom: 1px solid #000; padding: 1.5px 6px; font-size: 10.5px; }
        .crit tr:last-child td { border-bottom: none; }
        .sec .no { width: 28px; text-align: center; }
        .sec .name { width: 120px; }
        .sec .k { width: 220px; }
        .tag { float: right; padding-right: 30px; }
        .grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .grid th, .grid td { border: none; border-right: 1px solid #999; text-align: center; padding: 2px 1px; font-size: 10px; }
        .grid th { font-weight: 600; color: #444; border-bottom: 1px solid #999; }
        .grid th:last-child, .grid td:last-child { border-right: none; }
        .grid td.flag { font-weight: 700; font-size: 9px; }
        .muted { color: #666; padding: 4px 6px; display: inline-block; }
        .sign { margin-top: 18px !important; }
        .sign td, .sign th { text-align: center; width: 33.33%; }
        .sign .space { height: 54px; }
        .form-no { margin-top: 6px; font-weight: 700; font-size: 11px; }
        @media print { @page { size: A4 portrait; margin: 8mm; } .page { width: 100%; padding: 14px 18px 8px; } }
      </style></head><body>${students.map(card).join('')}<script>window.onload = () => { setTimeout(() => window.print(), 500); };<\/script></body></html>`);
      w.document.close();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to print performance report');
    }
    setPrinting(false);
  };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to generate final results." />;

  return (
    <div className="space-y-6">

      {/* ──── Page Header ──── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/daily-activities/generate-final-result')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="p-2.5 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-xl shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            {isEdit ? 'Edit Final Result' : 'Generate Final Result'}
          </h1>
          <p className="text-xs text-gray-400">
            Daily Activities / Generate Final Result / {isEdit ? 'Edit' : 'Add'}
          </p>
        </div>
      </div>

      {loadingEdit ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading final result details...</span>
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
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Result Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Course */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Course <span className="text-red-400">*</span></label>
                <select value={form.Course_Id} onChange={set('Course_Id')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">Select</option>
                  {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                </select>
              </div>

              {/* Batch */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Batch <span className="text-red-400">*</span></label>
                <select value={form.Batch_Id} onChange={set('Batch_Id')} required disabled={!form.Course_Id}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white disabled:opacity-50">
                  <option value="">Select</option>
                  {batches.map(b => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>
                      {b.Batch_code}{b.Category ? ` (${b.Category})` : ''}{b.Timings ? ` — ${b.Timings}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Result Date <span className="text-red-400">*</span></label>
                <input type="date" value={form.Result_Dt} onChange={set('Result_Dt')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Print Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Print Date</label>
                <input type="date" value={form.Print_Dt} onChange={set('Print_Dt')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Approved By */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Approved By <span className="text-red-400">*</span></label>
                <select value={form.Approved_By} onChange={set('Approved_By')} required
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">Select</option>
                  {employees.map(e => <option key={e.Emp_Id} value={e.Emp_Id}>{e.Employee_Name}</option>)}
                </select>
              </div>

              {/* Period Start */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Period (Start Date)</label>
                <input type="date" value={form.Period_Start} onChange={set('Period_Start')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* End Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">End Date</label>
                <input type="date" value={form.Period_End} onChange={set('Period_End')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white" />
              </div>

              {/* Faculty Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Faculty Name</label>
                <select value={form.Faculty1} onChange={set('Faculty1')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">Select</option>
                  {faculties.map(f => <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>)}
                </select>
              </div>

              {/* Training Coordinator */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Training Coordinator</label>
                <select value={form.Faculty2} onChange={set('Faculty2')}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5] bg-white">
                  <option value="">Select</option>
                  {faculties.map(f => <option key={f.Faculty_Id} value={f.Faculty_Id}>{f.Faculty_Name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Actions</h3>
            <div className="flex flex-wrap items-center gap-3">
              {/* Generate */}
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#23257A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md">
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generate
              </button>

              {/* Print Report Card */}
              <button type="button" onClick={handlePrintReportCard} disabled={printing || !resultId}
                title={!resultId ? 'Generate the final result first' : undefined}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#2E3093] bg-[#2E3093]/5 border border-[#2E3093]/20 hover:bg-[#2E3093]/10 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                {printing && <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Performance Report
              </button>

              {/* MarkSheet */}
              <button type="button" onClick={() => handleAction('MarkSheet')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#2E3093] bg-[#2E3093]/5 border border-[#2E3093]/20 hover:bg-[#2E3093]/10 rounded-lg transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                MarkSheet
              </button>

              {/* Certificate Print */}
              <button type="button" onClick={() => handleAction('Certificate Print')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#2E3093] bg-[#2E3093]/5 border border-[#2E3093]/20 hover:bg-[#2E3093]/10 rounded-lg transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Certificate Print
              </button>

              {/* Print Sheet */}
              <button type="button" onClick={() => handleAction('Print Sheet')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#2E3093] bg-[#2E3093]/5 border border-[#2E3093]/20 hover:bg-[#2E3093]/10 rounded-lg transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Sheet
              </button>

              {/* Cancel */}
              <button type="button" onClick={() => router.push('/dashboard/daily-activities/generate-final-result')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>

          {/* ── Report Card Preview ── */}
          {resultId && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#2E3093] uppercase tracking-wider mb-4">Report Card Preview</h3>
              {reportCardLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-gray-500">Loading report card data...</span>
                </div>
              ) : reportCardError ? (
                <div className="text-sm text-gray-500 py-4">{reportCardError}</div>
              ) : reportCardRows.length === 0 ? (
                <div className="text-sm text-gray-500 py-4">No report card data has been generated for this result yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        {[
                          'Roll No', 'Student Name',
                          'Ass1 Given', 'Ass1 Max', 'Ass1 Status', 'Ass %',
                          'Test1 Given', 'Test1 Max', 'Test1 Status', 'Test %',
                          'Final %', 'Full Attend', 'Total Lectures', 'Atten. Lectures', 'Absents',
                          'Full Attendance', 'Total Assignments', 'Given Assignments',
                          'Total Tests', 'Given Tests', 'Discipline', 'Final Result %', 'Grade',
                        ].map(h => (
                          <th key={h} className="border border-gray-200 px-2.5 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportCardRows.map((s, i) => (
                        <tr key={s.id ?? i} className="hover:bg-gray-50">
                          <td className="border border-gray-200 px-2.5 py-1.5 whitespace-nowrap">{s.Roll_No || s.Student_Code || ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 whitespace-nowrap">{s.Student_Name || ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Ass1_Given ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Ass1_Max ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Ass1_Status ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Ass_Percent ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Test1_Given ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Test1_Max ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Test1_Status ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Test_Percent ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Final_Percent ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Full_Attend ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Total_Lectures ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.AttenLectures ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Absents ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Full_Attendance ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Total_Assignments ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Given_Assignments ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Total_Tests ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Given_Tests ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center">{s.Discipline ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center font-semibold">{s.Final_Result_Percent ?? ''}</td>
                          <td className="border border-gray-200 px-2.5 py-1.5 text-center font-semibold">{s.Grade ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
