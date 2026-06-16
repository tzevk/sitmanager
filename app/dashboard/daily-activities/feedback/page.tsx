'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type StagePercent = 30 | 60 | 90;

type FeedbackListRow = {
  id: number;
  stage_percent: number;
  training_program: string | null;
  batch_no: string | null;
  feedback_date: string | null;
  published: 0 | 1;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '\u2014';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${mon} ${year}`;
  } catch {
    return '\u2014';
  }
}

export default function FeedbackPage() {
  const router = useRouter();
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('feedback1');

  const [rows, setRows] = useState<FeedbackListRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/daily-activities/feedback');
      const json = await res.json();
      setRows(json.rows ?? []);
    } catch (e) {
      console.error('Failed to fetch feedback list', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const grouped = useMemo(() => {
    const by: Record<StagePercent, FeedbackListRow[]> = { 30: [], 60: [], 90: [] };
    for (const r of rows) {
      if (r.stage_percent === 30 || r.stage_percent === 60 || r.stage_percent === 90) {
        by[r.stage_percent].push(r);
      }
    }
    return by;
  }, [rows]);

  const handleTogglePublish = async (id: number, next: boolean) => {
    try {
      const res = await fetch(`/api/daily-activities/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: next }),
      });
      if (res.ok) fetchRows();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this feedback entry?')) return;
    try {
      const res = await fetch(`/api/daily-activities/feedback/${id}`, { method: 'DELETE' });
      if (res.ok) fetchRows();
    } catch {
      // ignore
    }
  };

  const handleDownloadExcel = async (id: number) => {
    try {
      const res = await fetch(`/api/daily-activities/feedback/${id}?include=submissions&export=excel`);
      if (!res.ok) throw new Error('Failed to download Excel');
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const nameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = nameMatch?.[1] || `feedback_${id}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download feedback excel', e);
      alert('Failed to download feedback Excel.');
    }
  };

  const Section = ({ stage }: { stage: StagePercent }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-black text-slate-900">{stage}% Completed</h3>
          <p className="text-xs text-slate-500 mt-0.5">{grouped[stage].length} entries</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="dashboard-table w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-500 bg-white border-b border-slate-200">
              <th className="text-left py-3 px-4 font-bold">Training Program</th>
              <th className="text-left py-3 px-4 font-bold">Batch No</th>
              <th className="text-left py-3 px-4 font-bold">Date</th>
              <th className="text-center py-3 px-4 font-bold">Publish</th>
              <th className="text-center py-3 px-4 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : grouped[stage].length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">No feedback entries</td>
              </tr>
            ) : (
              grouped[stage].map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900 max-w-[260px]">
                    <span className="truncate block">{r.training_program || '\u2014'}</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap font-mono text-xs">{r.batch_no || '\u2014'}</td>
                  <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{formatDate(r.feedback_date)}</td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      disabled={!canUpdate}
                      onClick={() => handleTogglePublish(r.id, r.published === 0)}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors ${
                        r.published
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      } ${!canUpdate ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white'}`}
                      title={r.published ? 'Unpublish' : 'Publish'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 12l-4-4-4 4m4-4v14" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 21H4" />
                      </svg>
                    </button>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleDownloadExcel(r.id)}
                        className="p-2 rounded-xl hover:bg-indigo-50 transition-colors text-slate-500 hover:text-indigo-700"
                        title="Download Excel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                      <button
                        disabled={!canUpdate}
                        onClick={() => router.push(`/dashboard/daily-activities/feedback/add?id=${r.id}`)}
                        className={`p-2 rounded-xl hover:bg-blue-50 transition-colors ${
                          canUpdate ? 'text-slate-500 hover:text-[#2A6BB5]' : 'text-slate-200 cursor-not-allowed'
                        }`}
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        disabled={!canDelete}
                        onClick={() => handleDelete(r.id)}
                        className={`p-2 rounded-xl hover:bg-red-50 transition-colors ${
                          canDelete ? 'text-slate-500 hover:text-red-600' : 'text-slate-200 cursor-not-allowed'
                        }`}
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {permLoading ? (
        <PermissionLoading />
      ) : !canView ? (
        <AccessDenied message="You do not have permission to view feedback." />
      ) : (
        <>
          <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-8 py-6 shadow-[0_10px_30px_rgba(46,48,147,0.18)] relative overflow-hidden">
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="flex items-center justify-between gap-4 flex-wrap relative z-10">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Training Feedback</h2>
                <p className="text-[14px] text-white/80 font-medium mt-1">
                  {rows.length.toLocaleString()} total entries
                </p>
              </div>
              {canCreate && (
                <button
                  onClick={() => router.push('/dashboard/daily-activities/feedback/add')}
                  className="inline-flex items-center gap-2 bg-[#FAE452] text-[#2E3093] px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Feedback
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Section stage={30} />
            <Section stage={60} />
            <Section stage={90} />
          </div>
        </>
      )}
    </div>
  );
}
