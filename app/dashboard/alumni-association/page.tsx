'use client';

import { useMemo, useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { PageHeader } from '@/components/ui/PageHeader';

interface StudentAccountRow {
  studentId: number;
  studentName: string;
  batchCode: string | null;
  mobile: string | null;
  email: string | null;
  hasAccount: boolean;
  matchType: 'phone' | 'name' | null;
  currentAlumniStatus: string | null;
  hasReceipt: boolean;
  csvEmail: string | null;
  csvSecondaryEmail: string | null;
  csvDob: string | null;
  csvBatchNumber: string | null;
  csvTrainingProgram: string | null;
}

interface PreviewResult {
  totalRows: number;
  totalStudents: number;
  matchedCount: number;
  noAccountCount: number;
  batchCodes: string[];
  students: StudentAccountRow[];
  unmatchedCsvRows: { csvName: string; csvPhone: string }[];
  fileName: string;
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors';
const PAGE_SIZE = 15;

function ReceiptBadge({ hasReceipt }: { hasReceipt: boolean }) {
  return hasReceipt ? (
    <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#2E3093]/10 text-[#2E3093]">Receipt Generated</span>
  ) : (
    <span className="text-slate-300 text-[10px]">—</span>
  );
}

function StudentList({ title, rows, accentClass }: { title: string; rows: StudentAccountRow[]; accentClass: string }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-sm flex flex-col min-w-0">
      <div className={`px-3 py-2 border-b border-slate-200 flex items-center justify-between ${accentClass}`}>
        <span className="text-xs font-black uppercase tracking-wider">{title}</span>
        <span className="text-[11px] font-semibold opacity-80">{rows.length.toLocaleString()}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse [&_th]:border-r [&_th]:border-slate-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-100 border-b border-slate-200">
              <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Student</th>
              <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Batch</th>
              <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Mobile</th>
              <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Email</th>
              <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Alumni Details</th>
              <th className="text-center py-2 px-3 font-bold whitespace-nowrap">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-400">No students.</td></tr>
            ) : pageRows.map((s) => (
              <tr key={s.studentId} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-1.5 px-3 font-semibold text-slate-900 max-w-[160px]">
                  <a href={`/dashboard/student/edit/${s.studentId}`} target="_blank" rel="noreferrer" className="truncate block text-[#2E3093] hover:underline">
                    {s.studentName}
                  </a>
                </td>
                <td className="py-1.5 px-3 font-mono whitespace-nowrap">{s.batchCode || '—'}</td>
                <td className="py-1.5 px-3 font-mono whitespace-nowrap">{s.mobile || '—'}</td>
                <td className="py-1.5 px-3 max-w-[150px]"><span className="truncate block">{s.email || '—'}</span></td>
                <td className="py-1.5 px-3 max-w-[180px]">
                  {s.hasAccount ? (
                    <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                      <span className="truncate">{s.csvTrainingProgram || '—'}</span>
                      <span className="truncate">{s.csvDob || ''}</span>
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-1.5 px-3 text-center whitespace-nowrap"><ReceiptBadge hasReceipt={s.hasReceipt} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[10px] text-slate-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-2 py-0.5 text-[10px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Prev</button>
            <span className="text-[10px] text-slate-500 px-1">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-2 py-0.5 text-[10px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlumniAssociationPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('alumni');
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [appliedCount, setAppliedCount] = useState<{ updatedCount: number; markedNoCount: number } | null>(null);
  const [batchFilter, setBatchFilter] = useState('');

  const runPreview = async () => {
    if (!file) { setError('Choose a CSV file first'); return; }
    setError('');
    setAppliedCount(null);
    setBatchFilter('');
    setPreviewing(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admission-activity/alumni/preview', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to preview import');
      setPreview(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to preview import');
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const applyImport = async () => {
    if (!preview) return;
    setError('');
    setApplying(true);
    try {
      const studentIds = preview.students.filter((s) => s.hasAccount).map((s) => s.studentId);
      const res = await fetch('/api/admission-activity/alumni/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds,
          fileName: preview.fileName,
          totalRows: preview.totalRows,
          matchedCount: preview.matchedCount,
          markOthersAsNo: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to apply');
      setAppliedCount({ updatedCount: data.updatedCount, markedNoCount: data.markedNoCount });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!preview) return [];
    if (!batchFilter) return preview.students;
    return preview.students.filter((s) => s.batchCode === batchFilter);
  }, [preview, batchFilter]);

  const withAccount = useMemo(() => filteredStudents.filter((s) => s.hasAccount), [filteredStudents]);
  const withoutAccount = useMemo(() => filteredStudents.filter((s) => !s.hasAccount), [filteredStudents]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view Alumni Association." />;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Alumni Association"
        breadcrumbs={[{ label: 'Admission Activity' }, { label: 'Alumni Association' }]}
        meta={preview ? `${preview.totalStudents.toLocaleString()} students` : undefined}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Import Alumni CSV</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setAppliedCount(null); }}
            className={`${ctrl} flex-1 min-w-[200px]`}
          />
          <button
            onClick={runPreview}
            disabled={!file || previewing}
            className="px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {previewing ? 'Checking…' : 'Check Accounts'}
          </button>
          {preview && (
            <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className={`${ctrl} w-[140px]`}>
              <option value="">All Batches</option>
              {preview.batchCodes.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {preview && canUpdate && (
            <button
              onClick={applyImport}
              disabled={applying}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {applying ? 'Saving…' : `Save (${preview.matchedCount} Yes, ${preview.noAccountCount} No)`}
            </button>
          )}
        </div>
        {error && <div className="text-xs text-red-600 font-semibold mt-2">{error}</div>}
        {appliedCount != null && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-semibold">
            Saved — {appliedCount.updatedCount} marked Yes, {appliedCount.markedNoCount} marked No.
          </div>
        )}
      </div>

      {preview && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {batchFilter ? `Students in ${batchFilter}` : 'Total Students'}
              </div>
              <div className="text-lg font-black text-slate-700">{filteredStudents.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Has Alumni Account</div>
              <div className="text-lg font-black text-emerald-600">{withAccount.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">No Account</div>
              <div className="text-lg font-black text-red-500">{withoutAccount.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <StudentList title="Has Alumni Account" rows={withAccount} accentClass="bg-emerald-50 text-emerald-800" />
            <StudentList title="No Alumni Account" rows={withoutAccount} accentClass="bg-red-50 text-red-700" />
          </div>

          {preview.unmatchedCsvRows.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Alumni portal entries with no matching student ({preview.unmatchedCsvRows.length})
              </div>
              <div className="max-h-48 overflow-y-auto text-xs text-slate-500 flex flex-col gap-0.5">
                {preview.unmatchedCsvRows.map((r, i) => (
                  <div key={i}>{r.csvName || '—'} — {r.csvPhone || 'no phone'}</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
