'use client';

import { useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { PageHeader } from '@/components/ui/PageHeader';

interface StudentAccountRow {
  studentId: number;
  studentName: string;
  mobile: string | null;
  email: string | null;
  hasAccount: boolean;
  matchType: 'phone' | 'name' | null;
  currentAlumniStatus: string | null;
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
  students: StudentAccountRow[];
  unmatchedCsvRows: { csvName: string; csvPhone: string }[];
  fileName: string;
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors';

export default function AlumniAssociationPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('alumni');
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [appliedCount, setAppliedCount] = useState<{ updatedCount: number; markedNoCount: number } | null>(null);

  const runPreview = async () => {
    if (!file) { setError('Choose a CSV file first'); return; }
    setError('');
    setAppliedCount(null);
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
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setAppliedCount(null); }}
            className={`${ctrl} flex-1`}
          />
          <button
            onClick={runPreview}
            disabled={!file || previewing}
            className="px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {previewing ? 'Checking…' : 'Check Accounts'}
          </button>
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
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Students</div>
              <div className="text-lg font-black text-slate-700">{preview.totalStudents}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Has Alumni Account</div>
              <div className="text-lg font-black text-emerald-600">{preview.matchedCount}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">No Account</div>
              <div className="text-lg font-black text-red-500">{preview.noAccountCount}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse [&_th]:border-r [&_th]:border-slate-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-200 border-b border-slate-300 sticky top-0">
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">Account</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Student</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Mobile</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Email</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Alumni E-mail</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">DoB</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Training Program</th>
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Batch Number</th>
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">Matched Via</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.students.map((s) => (
                    <tr key={s.studentId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${s.hasAccount ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
                          {s.hasAccount ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-slate-900 max-w-[180px]">
                        <a href={`/dashboard/student/edit/${s.studentId}`} target="_blank" rel="noreferrer" className="truncate block text-[#2E3093] hover:underline">
                          {s.studentName}
                        </a>
                      </td>
                      <td className="py-1.5 px-3 font-mono whitespace-nowrap">{s.mobile || '—'}</td>
                      <td className="py-1.5 px-3 max-w-[160px]"><span className="truncate block">{s.email || '—'}</span></td>
                      <td className="py-1.5 px-3 max-w-[160px]"><span className="truncate block">{s.csvEmail || '—'}</span></td>
                      <td className="py-1.5 px-3 whitespace-nowrap">{s.csvDob || '—'}</td>
                      <td className="py-1.5 px-3 max-w-[160px]"><span className="truncate block">{s.csvTrainingProgram || '—'}</span></td>
                      <td className="py-1.5 px-3 whitespace-nowrap">{s.csvBatchNumber || '—'}</td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        {s.matchType
                          ? <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${s.matchType === 'phone' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {s.matchType === 'phone' ? 'Phone' : 'Name'}
                            </span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
