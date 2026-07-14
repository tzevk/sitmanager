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
}

const emptyForm: FormData = {
  Course_Id: '',
  Batch_Id: '',
  Result_Dt: new Date().toISOString().slice(0, 10),
  Print_Dt: '',
  Approved_By: '',
  Period_Start: '',
  Period_End: '',
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
        const [courseRes, empRes] = await Promise.all([
          fetch('/api/daily-activities/generate-final-result?options=courses'),
          fetch('/api/daily-activities/generate-final-result?options=employees'),
        ]);
        const courseData = await courseRes.json();
        const empData = await empRes.json();
        setCourses(courseData.courses || []);
        setEmployees(empData.employees || []);
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

  /* ── Print Report Card ── */
  const fmtPct = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  };

  const handlePrintReportCard = async () => {
    if (!resultId) {
      setError('Please Generate the final result first, then Print Report Card.');
      return;
    }
    setError(''); setPrinting(true);
    try {
      const res = await fetch(`/api/daily-activities/generate-final-result/report-card?genId=${resultId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report card data');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const students: any[] = data.students || [];
      const logo = `${window.location.origin}/sit.png`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markRows = (label: string, given: string, max: string, status: string, s: any) => {
        const items: string[] = [];
        for (let i = 1; i <= 10; i++) {
          const m = s[`${max.replace('{n}', String(i))}`];
          if (m === null || m === undefined) continue;
          const g = s[`${given.replace('{n}', String(i))}`];
          const st = s[`${status.replace('{n}', String(i))}`];
          items.push(
            `<tr><td>${label} ${i}</td><td>${g ?? '-'}</td><td>${m}</td><td>${st || '-'}</td></tr>`
          );
        }
        return items.join('');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const card = (s: any) => `
        <div class="card">
          <div class="top-row">
            <img src="${logo}" alt="SIT" class="logo" />
            <div class="header">
              <div class="org-name">Suvidya Institute of Technology Private Limited</div>
              <div class="org-addr">Regd. Office : 18/140 Anand Nagar, Nehru Road, Vakola, Santacruz (E),<br />Mumbai - 400 055. Tel.: 022 26682290, 9821569885</div>
              <div class="card-title">FINAL EXAMINATION REPORT CARD</div>
            </div>
          </div>

          <div class="info-row">
            <span>Student Name</span><span class="fill">${s.Student_Name || ''}</span>
            <span>Student Code</span><span class="fill">${s.Student_Code || ''}</span>
          </div>
          <div class="info-row">
            <span>Course</span><span class="fill">${s.Course_Name || ''}</span>
            <span>Batch</span><span class="fill">${s.Batch_code || ''}</span>
          </div>
          <div class="info-row">
            <span>Period</span><span class="fill">${s.Start_date || ''} to ${s.End_date || ''}</span>
            <span>Result Date</span><span class="fill">${s.Result_date || ''}</span>
          </div>

          <div class="section-title">Assignments</div>
          <table class="marks-table">
            <thead><tr><th>Assignment</th><th>Given</th><th>Max</th><th>Status</th></tr></thead>
            <tbody>${markRows('Assignment', 'Ass{n}_Given', 'Ass{n}_Max', 'Ass{n}_Status', s) || '<tr><td colspan="4">No assignments recorded</td></tr>'}</tbody>
          </table>

          <div class="section-title">Unit Tests</div>
          <table class="marks-table">
            <thead><tr><th>Test</th><th>Given</th><th>Max</th><th>Status</th></tr></thead>
            <tbody>${markRows('Test', 'Test{n}_Given', 'Test{n}_Max', 'Test{n}_Status', s) || '<tr><td colspan="4">No tests recorded</td></tr>'}</tbody>
          </table>

          <div class="section-title">Final Exam</div>
          <table class="marks-table">
            <thead><tr><th>Paper</th><th>Given</th><th>Max</th><th>Status</th></tr></thead>
            <tbody>${markRows('Final', 'Final{n}_Given', 'Final{n}_Max', 'Final{n}_Status', s) || '<tr><td colspan="4">No final exam recorded</td></tr>'}</tbody>
          </table>

          <div class="summary-grid">
            <div><span>Assignment %</span><b>${fmtPct(s.Ass_Percent)}%</b></div>
            <div><span>Test %</span><b>${fmtPct(s.Test_Percent)}%</b></div>
            <div><span>Viva %</span><b>${fmtPct(s.Viva_Percent)}%</b></div>
            <div><span>Final Exam %</span><b>${fmtPct(s.Final_Percent)}%</b></div>
            <div><span>Total Lectures</span><b>${s.Total_Lectures ?? '-'}</b></div>
            <div><span>Attended</span><b>${s.AttenLectures ?? '-'}</b></div>
            <div><span>Absents</span><b>${s.Absents ?? '-'}</b></div>
            <div><span>Attendance %</span><b>${fmtPct(s.Full_Attendance)}%</b></div>
            <div><span>Discipline</span><b>${s.Discipline ?? '-'}</b></div>
            <div class="highlight"><span>Final Result %</span><b>${fmtPct(s.Final_Result_Percent)}%</b></div>
            <div class="highlight"><span>Grade</span><b>${s.Grade || 'NA'}</b></div>
          </div>

          <div class="sign-row">
            <div><div class="sign-line"></div><span>${s.Label1 || 'Faculty'}${s.faculty1 ? ` (${s.faculty1})` : ''}</span></div>
            <div><div class="sign-line"></div><span>${s.Label2 || 'Faculty'}${s.faculty2 ? ` (${s.faculty2})` : ''}</span></div>
            <div><div class="sign-line"></div><span>Approved By${s.approve_by ? ` (${s.approve_by})` : ''}</span></div>
          </div>
          <div class="footer-text">This is a computer generated report card, signature does not required.</div>
        </div>`;

      const w = window.open('', '_blank');
      if (!w) { setError('Please allow popups to print the report card.'); setPrinting(false); return; }

      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report Card</title><style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #000; background: #fff; font-size: 13px; }
        .card { width: 760px; margin: 0 auto; padding: 40px 44px 24px; background: #fff; page-break-after: always; }
        .top-row { display: flex; align-items: flex-start; gap: 16px; }
        .logo { width: 150px; height: auto; object-fit: contain; }
        .header { flex: 1; text-align: center; }
        .org-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .org-addr { font-size: 11px; line-height: 1.4; }
        .card-title { font-size: 15px; font-weight: 700; margin-top: 14px; text-decoration: underline; }
        .info-row { display: flex; gap: 10px; margin-top: 16px; font-size: 13px; }
        .info-row span:nth-child(odd) { font-weight: 700; width: 90px; }
        .fill { flex: 1; border-bottom: 1.5px dotted #222; padding-bottom: 2px; }
        .section-title { margin-top: 20px; font-size: 13px; font-weight: 700; color: #2E3093; text-transform: uppercase; letter-spacing: 0.03em; }
        .marks-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .marks-table th, .marks-table td { border: 1px solid #999; padding: 5px 8px; font-size: 12px; text-align: left; }
        .marks-table th { background: #F1F2FA; font-weight: 700; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; margin-top: 20px; }
        .summary-grid div { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding-bottom: 3px; font-size: 12.5px; }
        .summary-grid .highlight { background: #F1F2FA; padding: 4px 8px; border-radius: 4px; border-bottom: none; }
        .sign-row { display: flex; justify-content: space-between; margin-top: 46px; gap: 20px; }
        .sign-row > div { flex: 1; text-align: center; font-size: 11px; }
        .sign-line { border-top: 1.5px solid #222; margin-bottom: 4px; height: 1px; }
        .footer-text { margin-top: 26px; text-align: center; font-size: 11px; font-weight: 700; }
        @media print { @page { size: A4 portrait; margin: 8mm; } .card { width: 100%; padding: 20px 24px 12px; } }
      </style></head><body>${students.map(card).join('')}<script>window.onload = () => { setTimeout(() => window.print(), 500); };<\/script></body></html>`);
      w.document.close();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to print report card');
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
                Print Report Card
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
                          'Student Code', 'Student Name',
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
                          <td className="border border-gray-200 px-2.5 py-1.5 whitespace-nowrap">{s.Student_Code || ''}</td>
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
