'use client';

import { useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { PageHeader } from '@/components/ui/PageHeader';

interface AlumniMatch {
  csvName: string;
  csvPhone: string;
  matchType: 'phone' | 'name';
  studentId: number;
  studentName: string;
  currentAlumniStatus: string | null;
}

interface AlumniCsvRow {
  csvName: string;
  csvPhone: string;
  firstName: string;
  lastName: string;
}

interface PreviewResult {
  totalRows: number;
  matches: AlumniMatch[];
  unmatched: AlumniCsvRow[];
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

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
      setSelected(new Set(
        (data.matches as AlumniMatch[]).filter((m) => m.matchType === 'phone').map((m) => m.studentId)
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to preview import');
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const toggleSelected = (studentId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const applySelected = async () => {
    if (!preview || selected.size === 0) return;
    setError('');
    setApplying(true);
    try {
      const res = await fetch('/api/admission-activity/alumni/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: Array.from(selected),
          fileName: preview.fileName,
          totalRows: preview.totalRows,
          matchedCount: preview.matches.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to apply');
      setAppliedCount(data.updatedCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view Alumni Association." />;

  const phoneMatches = preview?.matches.filter((m) => m.matchType === 'phone') ?? [];
  const nameMatches = preview?.matches.filter((m) => m.matchType === 'name') ?? [];

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Alumni Association"
        breadcrumbs={[{ label: 'Admission Activity' }, { label: 'Alumni Association' }]}
        meta={preview ? `${preview.totalRows.toLocaleString()} rows in file` : undefined}
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
            {previewing ? 'Previewing…' : 'Preview Import'}
          </button>
        </div>
        {error && <div className="text-xs text-red-600 font-semibold mt-2">{error}</div>}
      </div>

      {preview && (
        <>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Rows</div>
              <div className="text-lg font-black text-slate-700">{preview.totalRows}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Matched by Phone</div>
              <div className="text-lg font-black text-emerald-600">{phoneMatches.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Matched by Name (Review)</div>
              <div className="text-lg font-black text-amber-600">{nameMatches.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Unmatched</div>
              <div className="text-lg font-black text-slate-400">{preview.unmatched.length}</div>
            </div>
          </div>

          {appliedCount != null && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-semibold">
              Applied — {appliedCount} student{appliedCount === 1 ? '' : 's'} marked as registered alumni.
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse [&_th]:border-r [&_th]:border-slate-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-200 border-b border-slate-300">
                    <th className="text-center py-2 px-3 font-bold w-10"></th>
                    <th className="text-left py-2 px-3 font-bold">CSV Name</th>
                    <th className="text-left py-2 px-3 font-bold">CSV Phone</th>
                    <th className="text-left py-2 px-3 font-bold">Matched Student</th>
                    <th className="text-center py-2 px-3 font-bold">Match Type</th>
                    <th className="text-center py-2 px-3 font-bold">Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.matches.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-400">No matches found.</td></tr>
                  ) : preview.matches.map((m) => (
                    <tr key={m.studentId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-1.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(m.studentId)}
                          onChange={() => toggleSelected(m.studentId)}
                        />
                      </td>
                      <td className="py-1.5 px-3">{m.csvName}</td>
                      <td className="py-1.5 px-3 font-mono">{m.csvPhone || '—'}</td>
                      <td className="py-1.5 px-3">
                        <a href={`/dashboard/student/edit/${m.studentId}`} target="_blank" rel="noreferrer" className="text-[#2E3093] font-semibold hover:underline">
                          {m.studentName}
                        </a>
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${m.matchType === 'phone' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {m.matchType === 'phone' ? 'Phone' : 'Name (verify)'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center text-slate-500">{m.currentAlumniStatus || 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canUpdate && preview.matches.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                <p className="text-[11px] text-slate-400">{selected.size} selected</p>
                <button
                  onClick={applySelected}
                  disabled={applying || selected.size === 0}
                  className="px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {applying ? 'Applying…' : `Apply Selected (${selected.size})`}
                </button>
              </div>
            )}
          </div>

          {preview.unmatched.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Unmatched ({preview.unmatched.length})
              </div>
              <div className="max-h-48 overflow-y-auto text-xs text-slate-500 flex flex-col gap-0.5">
                {preview.unmatched.map((r, i) => (
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
