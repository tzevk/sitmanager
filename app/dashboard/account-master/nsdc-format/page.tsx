'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { GhostBtn, PageHeader } from '@/components/ui/PageHeader';

interface UploadBatch {
  id: number;
  source_filename: string;
  row_count: number;
  columns_json: string[];
  uploaded_by: number | null;
  created_at: string;
}

interface UploadRow {
  id: number;
  row_index: number;
  row_data: Record<string, string>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function NsdcFormatPage() {
  const perms = useResourcePermissions('nsdc_format');
  const { loading: permLoading, canView, canCreate } = perms;

  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<UploadBatch | null>(null);
  const [previewRows, setPreviewRows] = useState<UploadRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await fetch('/api/account-master/nsdc-format');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBatches(Array.isArray(data.batches) ? data.batches : []);
    } catch {
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) fetchBatches();
  }, [canView, fetchBatches]);

  const openBatch = useCallback(async (batch: UploadBatch) => {
    setSelectedBatch(batch);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/account-master/nsdc-format?batchId=${batch.id}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPreviewRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/account-master/nsdc-format', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setUploadSuccess(`Uploaded ${data.rowCount} row${data.rowCount === 1 ? '' : 's'} from ${file.name}.`);
      await fetchBatches();
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [fetchBatches]);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
  }, [handleUpload]);

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view NSDC Format." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="NSDC Format"
        breadcrumbs={[{ label: 'Admin/Accounts' }, { label: 'NSDC Format' }]}
        meta="Candidate upload sheet"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Upload</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Candidate Upload Sheet (NSDC format)</h3>
            <p className="mt-1 text-xs text-slate-500">Upload the candidate_upload Excel or CSV sheet. Columns are read directly from the file&apos;s header row — no fixed template is assumed.</p>

            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFilePick}
                disabled={!canCreate || uploading}
                className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#6366F1]/10 file:text-[#6366F1] hover:file:bg-[#6366F1]/20 disabled:opacity-50"
              />
            </div>
            {!canCreate && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">View-only — uploading requires create permission.</p>}
            {uploading && <p className="mt-2 text-xs text-slate-500">Uploading…</p>}
            {uploadError && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</p>}
            {uploadSuccess && <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{uploadSuccess}</p>}
          </div>

          {selectedBatch && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Preview</p>
                  <h3 className="text-sm font-semibold text-slate-900">{selectedBatch.source_filename}</h3>
                </div>
                <GhostBtn onClick={() => { setSelectedBatch(null); setPreviewRows([]); }}>Close</GhostBtn>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                {previewLoading ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading…</div>
                ) : previewRows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No rows found.</div>
                ) : (
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">#</th>
                        {(selectedBatch.columns_json || []).map((col) => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {previewRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-1.5 text-slate-400">{row.row_index + 1}</td>
                          {(selectedBatch.columns_json || []).map((col) => (
                            <td key={col} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{row.row_data[col] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">History</p>
            <h3 className="text-sm font-semibold text-slate-900">Past uploads</h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {batchesLoading ? (
              <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-50 animate-pulse" />)}</div>
            ) : batches.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-slate-400">No uploads yet.</div>
            ) : (
              batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => openBatch(batch)}
                  className={`block w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selectedBatch?.id === batch.id ? 'bg-[#6366F1]/5' : ''}`}
                >
                  <p className="truncate text-xs font-semibold text-slate-800">{batch.source_filename}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{batch.row_count} row{batch.row_count === 1 ? '' : 's'}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatDate(batch.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
