'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const raw = String(dateStr).trim();
    let d = new Date(raw);
    if (isNaN(d.getTime())) {
      const m = raw.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
      if (m) d = new Date(+m[3], +m[2] - 1, +m[1]);
    }
    if (isNaN(d.getTime())) return '—';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return '—'; }
}

function formatName(name: string | null | undefined): string {
  const t = String(name ?? '').trim();
  if (!t) return '—';
  const [first, ...rest] = t.split(/\s+/);
  return [(first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()), ...rest].filter(Boolean).join(' ');
}

interface InquiryRow {
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  Discussion: string | null;
  DiscussionDate: string | null;
  NextFollowUpDate?: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Location: string | null;
  Discipline: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
  FollowUpBy?: string | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface Filters { disciplines: string[]; inquiryTypes: string[]; statusOptions: { id: number; label: string }[]; }

function hasLatestFollowUp(r: InquiryRow) { return Boolean(r.Discussion && r.Discussion !== 'NULL' && r.Discussion.trim()); }
function hasScheduledFollowUp(r: InquiryRow) { return Boolean(r.NextFollowUpDate); }
function isPendingFollowUp(r: InquiryRow) {
  if (r.Status_id != null && [4, 12, 15].includes(r.Status_id)) return true;
  const l = String(r.StatusLabel || '').toLowerCase();
  return l.includes('follow up') || l.includes('pending') || l.includes('callback');
}

function statusPill(id: number | null, label: string) {
  if (id != null) {
    if ([7,10,27].includes(id)) return 'bg-emerald-100 text-emerald-700';
    if ([1,2,3].includes(id)) return 'bg-blue-100 text-blue-700';
    if ([5,24].includes(id)) return 'bg-orange-100 text-orange-700';
    if ([4,15,25].includes(id)) return 'bg-amber-100 text-amber-700';
    if ([6,9,19,29].includes(id)) return 'bg-red-100 text-red-600';
    if ([8,33].includes(id)) return 'bg-gray-100 text-gray-500';
    if ([12,16].includes(id)) return 'bg-purple-100 text-purple-700';
    if ([18,26].includes(id)) return 'bg-slate-100 text-slate-500';
  }
  const l = label.toLowerCase();
  if (['admitted','converted','enrolled'].includes(l)) return 'bg-emerald-100 text-emerald-700';
  if (['inquiry','new','contacted'].includes(l)) return 'bg-blue-100 text-blue-700';
  if (['hot lead','interested'].includes(l)) return 'bg-orange-100 text-orange-700';
  if (['warm lead','follow up','callback'].includes(l)) return 'bg-amber-100 text-amber-700';
  if (['not interested','lost','dropped','dnc'].includes(l)) return 'bg-red-100 text-red-600';
  if (['visited','pending'].includes(l)) return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-500';
}

function statusBar(id: number | null, label: string) {
  if (id != null) {
    if ([7,10,27].includes(id)) return 'bg-emerald-400';
    if ([1,2,3].includes(id)) return 'bg-blue-400';
    if ([5,24].includes(id)) return 'bg-orange-400';
    if ([4,15,25].includes(id)) return 'bg-amber-400';
    if ([6,9,19,29].includes(id)) return 'bg-red-400';
    if ([12,16].includes(id)) return 'bg-purple-400';
    if ([18,26].includes(id)) return 'bg-slate-400';
  }
  const l = label.toLowerCase();
  if (['admitted','converted','enrolled'].includes(l)) return 'bg-emerald-400';
  if (['hot lead','interested'].includes(l)) return 'bg-orange-400';
  if (['warm lead','follow up','callback'].includes(l)) return 'bg-amber-400';
  if (['not interested','lost','dropped','dnc'].includes(l)) return 'bg-red-400';
  if (['visited','pending'].includes(l)) return 'bg-purple-400';
  return 'bg-slate-300';
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

export default function InquiryPage() {
  const router = useRouter();
  const { canView, canUpdate, canDelete, canCreate, loading: permLoading } = useResourcePermissions('inquiry');
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<Filters>({ disciplines: [], inquiryTypes: [], statusOptions: [] });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) p.set('search', search);
      if (discipline) p.set('discipline', discipline);
      if (inquiryType) p.set('inquiryType', inquiryType);
      if (status) p.set('status', status);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      const res = await fetch(`/api/inquiry?${p}`);
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : {};
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
      if (data.filters) setFilters(data.filters);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doSearch = () => { setPage(1); setFetchTrigger(t => t + 1); };
  const doClear = () => {
    setSearch(''); setDiscipline(''); setInquiryType('');
    setStatus(''); setDateFrom(''); setDateTo('');
    setPage(1); setFetchTrigger(t => t + 1);
  };

  const handleSendAdmissionForm = async (r: InquiryRow) => {
    const recipient = String(r.Email || '').trim();
    if (!recipient) { alert('No email address found. Please update inquiry email first.'); return; }
    setSendingId(r.Student_Id);
    try {
      const prev = await fetch('/api/inquiry/send-admission-form', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: r.Student_Id, toEmail: recipient, studentName: r.Student_Name, previewOnly: true }),
      });
      const pd = await prev.json();
      if (!prev.ok) throw new Error(pd?.error || 'Failed to load preview');
      const ok = window.confirm(['Verify before sending:','',`To: ${pd.toEmail}`,`Subject: ${pd.preview?.subject || 'SIT Admission Form'}`,`Link: ${pd.admissionFormUrl}`,'',String(pd.preview?.text || ''),'','Click OK to send.'].join('\n'));
      if (!ok) return;
      const send = await fetch('/api/inquiry/send-admission-form', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: r.Student_Id, toEmail: recipient, studentName: r.Student_Name }),
      });
      const sd = await send.json();
      if (!send.ok) throw new Error(sd?.error || 'Failed to send');
      alert('Email sent successfully');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send');
    } finally { setSendingId(null); }
  };

  const followUps = rows.filter(hasScheduledFollowUp);

  return (
    <div className="space-y-6">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view inquiries." /> : (<>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-2.5 flex items-center justify-between relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex items-center gap-3">
          <h2 className="text-sm font-black text-white tracking-tight">Inquiry Listing</h2>
          <span className="text-[11px] text-white/60">{pagination.total.toLocaleString()} records</span>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push('/dashboard/inquiry/add')}
            className="relative z-10 flex items-center gap-1 bg-white text-[#2E3093] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Inquiry
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2.5">
        <input
          type="text" value={search} placeholder="Search name, mobile, email…"
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          className={`${ctrl} flex-1 min-w-[160px]`}
        />
        <select value={discipline} onChange={e => setDiscipline(e.target.value)} className={`${ctrl} w-[130px]`}>
          <option value="">Discipline</option>
          {filters.disciplines.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={inquiryType} onChange={e => setInquiryType(e.target.value)} className={`${ctrl} w-[120px]`}>
          <option value="">Type</option>
          {filters.inquiryTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${ctrl} w-[130px]`}>
          <option value="">Status</option>
          {filters.statusOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" className={`${ctrl} w-[130px]`} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" className={`${ctrl} w-[130px]`} />
        <button onClick={doSearch} className="flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
        <button onClick={doClear} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2 px-3 font-bold">#</th>
                <th className="text-left py-2 px-3 font-bold">Name</th>
                <th className="text-left py-2 px-3 font-bold">Course</th>
                <th className="text-left py-2 px-3 font-bold">Mobile</th>
                <th className="text-left py-2 px-3 font-bold">Email</th>
                <th className="text-left py-2 px-3 font-bold">Discipline</th>
                <th className="text-left py-2 px-3 font-bold">Type</th>
                <th className="text-left py-2 px-3 font-bold">Date</th>
                <th className="text-center py-2 px-3 font-bold">Status</th>
                <th className="text-center py-2 px-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Loading…</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-xs text-slate-400">No inquiries found</td>
                </tr>
              ) : rows.map((r, i) => {
                const attended = hasLatestFollowUp(r);
                const colorCls = isPendingFollowUp(r) ? '[&>td]:text-purple-600' : attended ? '[&>td]:text-slate-800' : '[&>td]:text-red-500';
                return (
                  <tr key={r.Student_Id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${colorCls}`}>
                    <td className="py-1.5 px-3 font-semibold relative pl-5">
                      <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${statusBar(r.Status_id, r.StatusLabel)} rounded-r`} />
                      {(pagination.page - 1) * pagination.limit + i + 1}
                    </td>
                    <td className="py-1.5 px-3 font-semibold max-w-[160px]">
                      <span className="truncate block">{formatName(r.Student_Name)}</span>
                    </td>
                    <td className="py-1.5 px-3 max-w-[140px]">
                      <span className="truncate block text-slate-500">{r.CourseName || '—'}</span>
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap font-mono">{r.Present_Mobile || '—'}</td>
                    <td className="py-1.5 px-3 max-w-[160px]">
                      <span className="truncate block">{r.Email || '—'}</span>
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      {r.Discipline && r.Discipline !== 'NULL' && r.Discipline !== 'Select' ? r.Discipline : '—'}
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">{r.Inquiry_Type || r.Inquiry_From || '—'}</td>
                    <td className="py-1.5 px-3 whitespace-nowrap">{formatDate(r.Inquiry_Dt)}</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusPill(r.Status_id, r.StatusLabel)}`}>
                        {r.StatusLabel}
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <button title="View" className="p-1 rounded hover:bg-blue-50 text-slate-300 hover:text-[#2A6BB5] transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button title="Edit" onClick={() => router.push(`/dashboard/inquiry/add?editId=${r.Student_Id}`)}
                          disabled={!canUpdate}
                          className={canUpdate ? 'p-1 rounded hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 transition-colors' : 'p-1 rounded text-slate-200 cursor-not-allowed'}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button title="Send admission form" onClick={() => handleSendAdmissionForm(r)}
                          disabled={!canUpdate || sendingId === r.Student_Id}
                          className={canUpdate ? 'p-1 rounded hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 transition-colors disabled:opacity-50' : 'p-1 rounded text-slate-200 cursor-not-allowed'}>
                          {sendingId === r.Student_Id
                            ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>}
                        </button>
                        <button title="Delete" disabled={!canDelete}
                          className={canDelete ? 'p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors' : 'p-1 rounded text-slate-200 cursor-not-allowed'}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] text-slate-400">
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={pagination.page <= 1} className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">First</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {(() => {
                const cur = pagination.page, tot = pagination.totalPages;
                const pages = [];
                for (let p = Math.max(1, cur - 2); p <= Math.min(tot, cur + 2); p++) pages.push(p);
                return pages.map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-6 h-6 text-[11px] rounded border font-semibold ${p === cur ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'border-slate-200 hover:bg-white text-slate-600'}`}>
                    {p}
                  </button>
                ));
              })()}
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages} className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white disabled:opacity-30 text-slate-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={() => setPage(pagination.totalPages)} disabled={pagination.page >= pagination.totalPages} className="px-2 py-0.5 text-[11px] rounded border border-slate-200 hover:bg-white disabled:opacity-30 font-semibold text-slate-600">Last</button>
            </div>
          </div>
        )}
      </div>

      {/* Follow-ups */}
      {!loading && followUps.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Scheduled Follow-ups</span>
            <span className="text-[10px] font-semibold text-slate-400">{followUps.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                  <th className="text-left py-2 px-3 font-bold">Name</th>
                  <th className="text-left py-2 px-3 font-bold">Course</th>
                  <th className="text-left py-2 px-3 font-bold">Mobile</th>
                  <th className="text-left py-2 px-3 font-bold">Follow-Up Date</th>
                  <th className="text-left py-2 px-3 font-bold">By</th>
                  <th className="text-left py-2 px-3 font-bold">Note</th>
                  <th className="text-center py-2 px-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {followUps.map(r => (
                  <tr key={`fu-${r.Student_Id}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-1.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{formatName(r.Student_Name)}</td>
                    <td className="py-1.5 px-3 text-slate-500 max-w-[140px]"><span className="truncate block">{r.CourseName || '—'}</span></td>
                    <td className="py-1.5 px-3 font-mono whitespace-nowrap">{r.Present_Mobile || '—'}</td>
                    <td className="py-1.5 px-3 font-semibold text-[#2E3093] whitespace-nowrap">{formatDate(r.NextFollowUpDate || null)}</td>
                    <td className="py-1.5 px-3 text-slate-400 whitespace-nowrap">{r.FollowUpBy || 'System'}</td>
                    <td className="py-1.5 px-3 text-slate-600 max-w-[220px]"><span className="line-clamp-2 block">{r.Discussion || '—'}</span></td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusPill(r.Status_id, r.StatusLabel)}`}>
                        {r.StatusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}
