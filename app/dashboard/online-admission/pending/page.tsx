'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type DraftRow = {
  Inquiry_Id: number;
  Student_Name: string;
  Email: string;
  Present_Mobile: string;
  StatusLabel: string;
  LastActivityAt: string | null;
};

function fmtDateTime(value: string): string {
  if (!value) return '—';
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return value;
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PendingAdmissionFormsPage() {
  const { canView, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('online_admission');

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchRows = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('tab', 'pending');
      p.set('page', '1');
      p.set('limit', '200');
      if (search.trim()) p.set('search', search.trim());
      const res = await fetch(`/api/online-admission?${p.toString()}`, { signal: ctrl.signal, cache: 'no-store' });
      const data = await res.json();
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void fetchRows();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchRows]);

  const handleDelete = useCallback(async (r: DraftRow) => {
    const ok = window.confirm(`Delete admission form for ${r.Student_Name || `Inquiry #${r.Inquiry_Id}`}? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(r.Inquiry_Id);
    try {
      const res = await fetch(`/api/inquiry/${r.Inquiry_Id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to delete admission form');
      }
      setRows((prev) => prev.filter((row) => row.Inquiry_Id !== r.Inquiry_Id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete admission form');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const canRemove = canDelete || canUpdate;

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view pending admission forms." />;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black text-white tracking-tight">Pending Admission Form Access</h2>
          <span className="text-[11px] text-white/70">{rows.length.toLocaleString()} records</span>
        </div>
        <Link
          href="/dashboard/online-admission"
          className="text-xs font-semibold text-white/90 border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/15 transition-colors"
        >
          Open Main Admissions
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void fetchRows(); }}
          placeholder="Search name, email, mobile, id..."
          className="flex-1 min-w-[180px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]"
        />
        <button
          onClick={() => void fetchRows()}
          className="bg-[#2E3093] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors"
        >
          Search
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold">Id</th>
                <th className="text-left py-2 px-3 font-bold">Student Name</th>
                <th className="text-left py-2 px-3 font-bold">Email</th>
                <th className="text-left py-2 px-3 font-bold">Mobile</th>
                <th className="text-left py-2 px-3 font-bold">Stage</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">Last Activity</th>
                <th className="text-left py-2 px-3 font-bold">Type</th>
                <th className="text-center py-2 px-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">Loading forms...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">No pending forms found</td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.Inquiry_Id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-1.5 px-3 font-mono text-slate-600">{r.Inquiry_Id}</td>
                  <td className="py-1.5 px-3 font-semibold text-slate-700">{r.Student_Name || '—'}</td>
                  <td className="py-1.5 px-3 text-slate-600">{r.Email || '—'}</td>
                  <td className="py-1.5 px-3 text-slate-600">{r.Present_Mobile || '—'}</td>
                  <td className="py-1.5 px-3 text-slate-600">{r.StatusLabel || 'Pending'}</td>
                  <td className="py-1.5 px-3 text-slate-500 whitespace-nowrap">{fmtDateTime(r.LastActivityAt || '')}</td>
                  <td className="py-1.5 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 whitespace-nowrap">
                      Submitted & Pending
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => window.open(`/admission/${r.Inquiry_Id}`, '_blank')}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#2E3093] bg-[#2E3093]/10 hover:bg-[#2E3093]/15"
                      >
                        Open
                      </button>
                      {canRemove && (
                        <button
                          onClick={() => void handleDelete(r)}
                          disabled={deletingId === r.Inquiry_Id}
                          title="Delete"
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === r.Inquiry_Id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
