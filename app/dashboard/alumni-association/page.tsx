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
  matchType: 'phone' | 'name' | 'manual' | null;
  currentAlumniStatus: string | null;
  hasReceipt: boolean;
  csvEmail: string | null;
  csvSecondaryEmail: string | null;
  csvDob: string | null;
  csvBatchNumber: string | null;
  csvTrainingProgram: string | null;
}

interface AlumniCsvRow {
  csvName: string;
  csvPhone: string;
  firstName: string;
  lastName: string;
  email: string;
  secondaryEmail: string;
  dob: string;
  batchNumber: string;
  trainingProgram: string;
}

interface PreviewResult {
  totalRows: number;
  totalStudents: number;
  matchedCount: number;
  noAccountCount: number;
  batchCodes: string[];
  trainingPrograms: string[];
  students: StudentAccountRow[];
  unmatchedCsvRows: AlumniCsvRow[];
  fileName: string;
}

const BLANK_CSV_ROW: AlumniCsvRow = {
  csvName: '', csvPhone: '', firstName: '', lastName: '',
  email: '', secondaryEmail: '', dob: '', batchNumber: '', trainingProgram: '',
};

interface StudentSearchResult {
  studentId: number;
  studentName: string;
  batchCode: string | null;
  mobile: string | null;
  email: string | null;
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

function LinkStudentModal({
  csvRow,
  onClose,
  onLink,
}: {
  csvRow: AlumniCsvRow;
  onClose: () => void;
  onLink: (student: StudentSearchResult) => void;
}) {
  const [query, setQuery] = useState(csvRow.csvName);
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const runSearch = async () => {
    if (query.trim().length < 2) { setSearchError('Type at least 2 characters'); return; }
    setSearchError('');
    setSearching(true);
    try {
      const res = await fetch(`/api/admission-activity/alumni/search-students?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Search failed');
      setResults(data.students ?? []);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{csvRow.csvName ? 'Link to Student Master' : 'Manually Link Student'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          {csvRow.csvName ? (
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">{csvRow.csvName || '—'}</div>
              <div>{csvRow.csvPhone || 'no phone'} {csvRow.email ? `· ${csvRow.email}` : ''}</div>
              {csvRow.trainingProgram && <div className="text-slate-400">{csvRow.trainingProgram}</div>}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Search for a student and mark them as a registered alumnus directly, without an alumni-portal CSV row.
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search student by name, mobile or email"
              className={`${ctrl} flex-1`}
              autoFocus
            />
            <button onClick={runSearch} disabled={searching}
              className="px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors disabled:opacity-50">
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchError && <div className="text-xs text-red-600 font-semibold">{searchError}</div>}
          <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
            {results.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {searching ? 'Searching…' : 'No results yet — search above.'}
              </div>
            ) : results.map((s) => (
              <button
                key={s.studentId}
                onClick={() => onLink(s)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{s.studentName}</div>
                  <div className="text-[10px] text-slate-500">{s.mobile || '—'} · {s.email || '—'} {s.batchCode ? `· ${s.batchCode}` : ''}</div>
                </div>
                <span className="text-[10px] font-bold text-[#2E3093] shrink-0">Link</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
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
      {/* Fixed height + the row count below keep both tables the same size regardless
          of how many rows happen to be on the current page of either list. */}
      <div className="overflow-x-auto overflow-y-auto h-[520px]">
        <table className="w-full text-xs border-collapse [&_th]:border-r [&_th]:border-slate-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0">
          <thead className="sticky top-0 z-10">
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
                      {s.matchType === 'manual' && (
                        <span className="inline-block w-fit px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wide">Manually Linked</span>
                      )}
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-1.5 px-3 text-center whitespace-nowrap"><ReceiptBadge hasReceipt={s.hasReceipt} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Always rendered (not just when totalPages > 1) so both lists' footers take the
          same space and the two cards stay visually the same height either way. */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50/50">
        <p className="text-[10px] text-slate-400">
          {rows.length === 0 ? '0 of 0' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, rows.length)} of ${rows.length}`}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-2 py-0.5 text-[10px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Prev</button>
          <span className="text-[10px] text-slate-500 px-1">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-2 py-0.5 text-[10px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Next</button>
        </div>
      </div>
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
  const [trainingFilter, setTrainingFilter] = useState('');
  const [linkingCsvRow, setLinkingCsvRow] = useState<AlumniCsvRow | null>(null);

  const handleLink = (student: StudentSearchResult) => {
    if (!linkingCsvRow) return;
    const row = linkingCsvRow;
    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unmatchedCsvRows: prev.unmatchedCsvRows.filter((r) => r !== row),
        students: prev.students.map((s) => s.studentId === student.studentId
          ? {
              ...s,
              hasAccount: true,
              matchType: 'manual',
              csvEmail: row.email || null,
              csvSecondaryEmail: row.secondaryEmail || null,
              csvDob: row.dob || null,
              csvBatchNumber: row.batchNumber || null,
              csvTrainingProgram: row.trainingProgram || null,
            }
          : s),
      };
    });
    setLinkingCsvRow(null);
  };

  const runPreview = async () => {
    if (!file) { setError('Choose a CSV file first'); return; }
    setError('');
    setAppliedCount(null);
    setBatchFilter('');
    setTrainingFilter('');
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
          matchedCount: studentIds.length,
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
    return preview.students.filter((s) =>
      (!batchFilter || s.batchCode === batchFilter) &&
      (!trainingFilter || s.csvTrainingProgram === trainingFilter)
    );
  }, [preview, batchFilter, trainingFilter]);

  const withAccount = useMemo(() => filteredStudents.filter((s) => s.hasAccount), [filteredStudents]);
  const withoutAccount = useMemo(() => filteredStudents.filter((s) => !s.hasAccount), [filteredStudents]);

  // Unfiltered totals — Save always applies to every student regardless of the batch
  // filter, and manual linking can change these counts after the initial preview.
  const totalWithAccount = useMemo(() => preview?.students.filter((s) => s.hasAccount).length ?? 0, [preview]);
  const totalWithoutAccount = useMemo(() => preview?.students.filter((s) => !s.hasAccount).length ?? 0, [preview]);

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
            <select value={trainingFilter} onChange={(e) => setTrainingFilter(e.target.value)} className={`${ctrl} w-[180px]`}>
              <option value="">All Training Programs</option>
              {preview.trainingPrograms.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {preview && (
            <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className={`${ctrl} w-[140px]`}>
              <option value="">All Batches</option>
              {preview.batchCodes.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {preview && canUpdate && (
            <button
              onClick={() => setLinkingCsvRow(BLANK_CSV_ROW)}
              className="px-3 py-1.5 text-xs font-bold border border-[#2E3093]/30 text-[#2E3093] rounded-lg hover:bg-[#2E3093]/10 transition-colors"
            >
              Manually Link Student
            </button>
          )}
          {preview && canUpdate && (
            <button
              onClick={applyImport}
              disabled={applying}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {applying ? 'Saving…' : `Save (${totalWithAccount} Yes, ${totalWithoutAccount} No)`}
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
              <div className="max-h-64 overflow-y-auto flex flex-col divide-y divide-slate-100">
                {preview.unmatchedCsvRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-1.5 text-xs text-slate-600">
                    <span className="truncate">{r.csvName || '—'} — {r.csvPhone || 'no phone'}</span>
                    {canUpdate && (
                      <button
                        onClick={() => setLinkingCsvRow(r)}
                        className="shrink-0 px-2 py-1 text-[10px] font-bold border border-[#2E3093]/30 text-[#2E3093] rounded hover:bg-[#2E3093]/10 transition-colors"
                      >
                        Link to Student
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {linkingCsvRow && (
        <LinkStudentModal
          csvRow={linkingCsvRow}
          onClose={() => setLinkingCsvRow(null)}
          onLink={handleLink}
        />
      )}
    </div>
  );
}
