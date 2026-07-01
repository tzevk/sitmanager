'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { PageHeader, FilterBar, PrimaryBtn, GhostBtn } from '@/components/ui/PageHeader';

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

function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const raw = String(value).trim();
    if (!raw) return null;
    const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch { return null; }
}

function formatDurationBetween(startValue: string | null | undefined, endValue: string | null | undefined): string {
  const start = parseDateTime(startValue);
  const end = parseDateTime(endValue);
  if (!start || !end) return '—';
  const diffMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
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
  InquirySoftwareTime?: string | null;
  Discussion: string | null;
  DiscussionDate: string | null;
  FirstDiscussionTime?: string | null;
  NextFollowUpDate?: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Location: string | null;
  Discipline: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  IsMetaAdConverted?: boolean;
  Status_id: number | null;
  StatusLabel: string;
  FollowUpBy?: string | null;
  IsDuplicateLead?: boolean;
  IsPuneInquiry?: boolean;
  PuneSourceLocation?: string | null;
  PunePageSource?: string | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface Filters { disciplines: string[]; inquiryTypes: string[]; trainings: string[]; batchCategories: { id: number; label: string }[]; statusOptions: { id: number; label: string }[]; }

function statusPill(id: number | null, label: string) {
  if (id === 1 || label.toLowerCase() === 'new') return 'border-red-300 bg-white/70 text-red-700';
  return 'border-slate-400 bg-white/70 text-slate-800';
}

function statusRow(id: number | null, label: string) {
  const l = label.toLowerCase();
  if (id === 1 || l === 'new') return 'bg-white hover:bg-red-50 [&>td]:text-red-600';
  if (id != null) {
    if (id === 8) return 'bg-emerald-100 hover:bg-emerald-200/80 [&>td]:text-emerald-950';
    if (id === 2) return 'bg-blue-100 hover:bg-blue-200/80 [&>td]:text-blue-950';
    if ([3,5].includes(id)) return 'bg-orange-100 hover:bg-orange-200/80 [&>td]:text-orange-950';
    if (id === 7) return 'bg-amber-100 hover:bg-amber-200/80 [&>td]:text-amber-950';
    if ([6,9].includes(id)) return 'bg-red-100 hover:bg-red-200/80 [&>td]:text-red-950';
    if (id === 4) return 'bg-indigo-100 hover:bg-indigo-200/80 [&>td]:text-indigo-950';
  }
  if (l.includes('admission confirmed')) return 'bg-emerald-100 hover:bg-emerald-200/80 [&>td]:text-emerald-950';
  if (l.includes('not recieved call')) return 'bg-blue-100 hover:bg-blue-200/80 [&>td]:text-blue-950';
  if (l.includes('interested') || l.includes('eligible')) return 'bg-orange-100 hover:bg-orange-200/80 [&>td]:text-orange-950';
  if (l.includes('follow up pending')) return 'bg-amber-100 hover:bg-amber-200/80 [&>td]:text-amber-950';
  if (l.includes('irrelevant') || l.includes('lost lead')) return 'bg-red-100 hover:bg-red-200/80 [&>td]:text-red-950';
  if (l.includes('next batch')) return 'bg-indigo-100 hover:bg-indigo-200/80 [&>td]:text-indigo-950';
  return 'bg-slate-50 hover:bg-slate-100 [&>td]:text-slate-800';
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

export default function InquiryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canView, canUpdate, canDelete, canCreate, loading: permLoading } = useResourcePermissions('inquiry');
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<Filters>({ disciplines: [], inquiryTypes: [], trainings: [], batchCategories: [], statusOptions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getInitParam = (key: string) => searchParams.get(key) || '';

  const [search, setSearch] = useState(() => getInitParam('search'));
  const [inquiryType, setInquiryType] = useState(() => getInitParam('inquiryType'));
  const [status, setStatus] = useState(() => getInitParam('status'));
  const [dateFrom, setDateFrom] = useState(() => getInitParam('dateFrom'));
  const [dateTo, setDateTo] = useState(() => getInitParam('dateTo'));
  const [training, setTraining] = useState(() => getInitParam('training'));
  const [batchCategory, setBatchCategory] = useState(() => getInitParam('batchCategory'));
  const [puneOnly, setPuneOnly] = useState(() => getInitParam('puneOnly'));
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get('page') || '1')));
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      setError('');
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) p.set('search', search);
      if (inquiryType) p.set('inquiryType', inquiryType);
      if (status) p.set('status', status);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      if (training) p.set('training', training);
      if (batchCategory) p.set('batchCategory', batchCategory);
      if (puneOnly) p.set('puneOnly', puneOnly);
      const res = await fetch(`/api/inquiry?${p}`, { signal: controller.signal });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : {};
      if (!res.ok) throw new Error(data?.details || data?.error || 'Failed to fetch inquiries');
      const nextPagination = data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 };
      if (nextPagination.totalPages > 0 && page > nextPagination.totalPages) {
        setPage(nextPagination.totalPages);
        return;
      }
      setRows(data.rows ?? []);
      setPagination(nextPagination);
      if (data.filters) setFilters(data.filters);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      console.error(e);
      setRows([]);
      setPagination({ page: 1, limit: 25, total: 0, totalPages: 0 });
      setError(e instanceof Error ? e.message : 'Failed to load inquiries');
    }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchTrigger, search, inquiryType, status, dateFrom, dateTo, training, batchCategory, puneOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const syncUrl = (params: Record<string, string>) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    router.replace(p.toString() ? `${pathname}?${p}` : pathname, { scroll: false });
  };

  const doSearch = () => {
    const params = {
      search,
      inquiryType,
      status,
      dateFrom,
      dateTo,
      training,
      batchCategory,
      puneOnly,
    };
    syncUrl(params);
    setPage(1); setFetchTrigger(t => t + 1);
  };
  const doClear = () => {
    router.replace(pathname, { scroll: false });
    setSearch(''); setInquiryType('');
    setStatus(''); setDateFrom(''); setDateTo(''); setTraining('');
    setBatchCategory(''); setPuneOnly('');
    setPage(1); setFetchTrigger(t => t + 1);
  };

  const buildReturnTo = () => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (inquiryType) p.set('inquiryType', inquiryType);
    if (status) p.set('status', status);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    if (training) p.set('training', training);
    if (batchCategory) p.set('batchCategory', batchCategory);
    if (puneOnly) p.set('puneOnly', puneOnly);
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const handleDeleteInquiry = async (r: InquiryRow) => {
    const ok = window.confirm(`Delete inquiry for ${formatName(r.Student_Name)}? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(r.Student_Id);
    try {
      const duplicateCluster = r.IsDuplicateLead || /duplicate/i.test(r.StatusLabel || '');
      const res = await fetch(`/api/inquiry/${r.Student_Id}${duplicateCluster ? '?deleteDuplicates=1' : ''}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to delete inquiry');
      }
      setFetchTrigger((t) => t + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete inquiry');
    } finally {
      setDeletingId(null);
    }
  };


  const exportCsv = () => {
    if (rows.length === 0) return;
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Name', 'Training', 'Mobile', 'Email', 'Lead Source',
      'Status', 'Inquiry Date', 'Last Discussion'
    ];
    const csv = [headers.join(',')].concat(
      rows.map((row) => [
        row.Student_Name,
        row.CourseName,
        row.Present_Mobile,
        row.Email,
        `${row.Inquiry_Type || row.Inquiry_From || ''}${row.IsPuneInquiry ? ' [Pune]' : ''}`,
        row.StatusLabel,
        row.Inquiry_Dt,
        row.Discussion,
      ].map(escape).join(','))
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inquiry-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-6">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view inquiries." /> : (<>

      <PageHeader
        title="Inquiry Listing"
        breadcrumbs={[{ label: 'Admission Activity' }, { label: 'Inquiry' }]}
        meta={`${pagination.total.toLocaleString()} records`}
        action={<>
          <GhostBtn href="/public/inquiry" target="_blank" rel="noreferrer">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h6m0 0v6m0-6L10 16m-4 0h2a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
            </svg>
            Public Form
          </GhostBtn>
          <GhostBtn onClick={exportCsv}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
            </svg>
            Export
          </GhostBtn>
          <GhostBtn href="/dashboard/meta-leads">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
            </svg>
            Meta Leads
          </GhostBtn>
          {canCreate && (
            <PrimaryBtn onClick={() => router.push('/dashboard/inquiry/add')}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Inquiry
            </PrimaryBtn>
          )}
        </>}
      />

      <FilterBar>
        <input
          type="text" value={search} placeholder="Search name, mobile, email…"
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          className={`${ctrl} flex-1 min-w-[150px] h-8 py-1`}
        />
        <select value={inquiryType} onChange={e => setInquiryType(e.target.value)} className={`${ctrl} w-[105px] h-8 py-1`}>
          <option value="">Type</option>
          {filters.inquiryTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${ctrl} w-[115px] h-8 py-1`}>
          <option value="">Status</option>
          {filters.statusOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" className={`${ctrl} w-[118px] h-8 py-1`} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" className={`${ctrl} w-[118px] h-8 py-1`} />
        <select value={training} onChange={e => setTraining(e.target.value)} className={`${ctrl} w-[125px] h-8 py-1`}>
          <option value="">Training</option>
          {filters.trainings.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={batchCategory} onChange={e => setBatchCategory(e.target.value)} className={`${ctrl} w-[125px] h-8 py-1`}>
          <option value="">Batch</option>
          {filters.batchCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={puneOnly} onChange={e => setPuneOnly(e.target.value)} className={`${ctrl} w-[112px] h-8 py-1`}>
          <option value="">All Sources</option>
          <option value="1">Pune Only</option>
        </select>
        <button onClick={doSearch} className="h-8 flex items-center gap-1 bg-[#2E3093] text-white px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
        <button onClick={doClear} className="h-8 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-zinc-300 rounded-lg hover:bg-slate-50 transition-colors">
          Clear
        </button>
      </FilterBar>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse [&_th]:border-r [&_th]:border-slate-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-200 border-b border-slate-300">
                <th className="text-left py-2 px-3 font-bold">#</th>
                <th className="text-left py-2 px-3 font-bold">Name</th>
                <th className="text-left py-2 px-3 font-bold">Training</th>
                <th className="text-left py-2 px-3 font-bold">Mobile</th>
                <th className="text-left py-2 px-3 font-bold">Email</th>
                <th className="text-left py-2 px-3 font-bold">Discipline</th>
                <th className="text-left py-2 px-3 font-bold w-[118px]">Source</th>
                <th className="text-left py-2 px-3 font-bold">Inquiry</th>
                <th className="text-left py-2 px-3 font-bold">Last Discussion</th>
                <th className="text-center py-2 px-3 font-bold">Status</th>
                <th className="text-center py-2 px-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Loading…</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-xs text-slate-400">No inquiries found</td>
                </tr>
              ) : rows.map((r, i) => {
                const rowStatusCls = statusRow(r.Status_id, r.StatusLabel);
                const primarySource = r.Inquiry_From || r.Inquiry_Type || '—';
                const secondarySource = r.Inquiry_From && r.Inquiry_Type && r.Inquiry_From !== r.Inquiry_Type
                  ? r.Inquiry_Type
                  : null;
                return (
                  <tr key={r.Student_Id} className={`border-b border-slate-200 transition-colors ${rowStatusCls}`}>
                    <td className="py-1 px-2 font-semibold font-mono tabular-nums relative pl-3">
                      {(pagination.page - 1) * pagination.limit + i + 1}
                    </td>
                    <td className="py-1 px-2 font-semibold max-w-[140px]">
                      <span className="truncate block">{formatName(r.Student_Name)}</span>
                    </td>
                    <td className="py-1 px-2 max-w-[120px]">
                      <span className="truncate block text-red-600">{r.CourseName || '—'}</span>
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap font-mono">{r.Present_Mobile || '—'}</td>
                    <td className="py-1 px-2 max-w-[140px]">
                      <span className="truncate block">{r.Email || '—'}</span>
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      {r.Discipline && r.Discipline !== 'NULL' && r.Discipline !== 'Select' ? r.Discipline : '—'}
                    </td>
                    <td className="py-1 px-2 w-[118px] max-w-[118px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="font-semibold break-words leading-tight">{primarySource}</span>
                          {r.IsMetaAdConverted && (
                            <span
                              title="Converted from Meta Ads"
                              className="inline-flex items-center rounded-full border border-[#2E3093]/30 bg-[#2E3093]/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#2E3093]"
                            >
                              Meta
                            </span>
                          )}
                          {r.IsPuneInquiry && (
                            <span
                              title={r.PunePageSource || r.PuneSourceLocation || 'Pune source'}
                              className="inline-flex items-center rounded-full border border-amber-700 bg-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-amber-950 shadow-sm"
                            >
                              Pune
                            </span>
                          )}
                        </div>
                        {(secondarySource || r.PuneSourceLocation) && (
                          <div className="flex flex-wrap items-center gap-1 text-[10px] leading-tight">
                            {secondarySource && <span className="text-slate-500">{secondarySource}</span>}
                            {r.IsPuneInquiry && r.PuneSourceLocation && (
                              <span className="rounded-full bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-900">
                                {r.PuneSourceLocation}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap min-w-[108px]">
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold text-slate-700">{formatDate(r.Inquiry_Dt)}</span>
                        <span className="text-[9px] text-slate-400">First response: {formatDurationBetween(r.InquirySoftwareTime, r.FirstDiscussionTime)}</span>
                      </div>
                    </td>
                    <td className="py-1 px-2 min-w-[300px] max-w-[520px] align-top">
                      {(() => {
                        const raw = (r.Discussion || '').trim();
                        if (!raw || raw === 'NULL') return <span className="text-slate-300">—</span>;
                        // Strip the legacy "counsellor - note" prefix; the real account
                        // name is shown from FollowUpBy instead.
                        const dashIdx = raw.indexOf(' - ');
                        const hasCounsellor = dashIdx > 0 && dashIdx < 30;
                        const note = hasCounsellor ? raw.slice(dashIdx + 3).trim() : raw;
                        return (
                          <div className="flex flex-col gap-0.5">
                            {(r.FollowUpBy || r.DiscussionDate) && (
                              <span className="inline-flex items-center gap-1 flex-wrap text-[9px] text-slate-400">
                                {r.FollowUpBy && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#2E3093]/20 bg-[#2E3093]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#2E3093] whitespace-nowrap max-w-[110px]">
                                    <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="truncate">{r.FollowUpBy}</span>
                                  </span>
                                )}
                                {r.DiscussionDate && <span className="whitespace-nowrap">{formatDate(r.DiscussionDate)}</span>}
                              </span>
                            )}
                            <span className="block whitespace-pre-wrap break-words text-slate-600 leading-snug">{note}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-1 px-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusPill(r.Status_id, r.StatusLabel)}`}>
                        {r.StatusLabel}
                      </span>
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex items-center justify-center gap-1 flex-nowrap min-w-[48px] whitespace-nowrap">
                        <button
                          title="Edit"
                          onClick={() => {
                            const returnTo = encodeURIComponent(buildReturnTo());
                            router.push(`/dashboard/inquiry/add?editId=${r.Student_Id}&returnTo=${returnTo}`);
                          }}
                          disabled={!canUpdate}
                          className={canUpdate ? 'p-0.5 rounded text-emerald-700 hover:bg-emerald-100 transition-colors' : 'p-0.5 rounded text-slate-400 cursor-not-allowed'}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDeleteInquiry(r)}
                          disabled={!canDelete || deletingId === r.Student_Id}
                          className={canDelete ? 'p-0.5 rounded text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50' : 'p-0.5 rounded text-slate-400 cursor-not-allowed'}
                        >
                          {deletingId === r.Student_Id ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
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

      </>)}
    </div>
  );
}
