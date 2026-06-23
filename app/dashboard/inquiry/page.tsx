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
  IsPuneInquiry?: boolean;
  PuneSourceLocation?: string | null;
  PunePageSource?: string | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface Filters { disciplines: string[]; inquiryTypes: string[]; trainings: string[]; batchCategories: { id: number; label: string }[]; statusOptions: { id: number; label: string }[]; }

function hasLatestFollowUp(r: InquiryRow) { return Boolean(r.Discussion && r.Discussion !== 'NULL' && r.Discussion.trim()); }
function hasScheduledFollowUp(r: InquiryRow) { return Boolean(r.NextFollowUpDate); }
function isPendingFollowUp(r: InquiryRow) {
  if (r.Status_id === 7) return true;
  const l = String(r.StatusLabel || '').toLowerCase();
  return l.includes('follow up pending');
}

function statusPill(id: number | null, label: string) {
  if (id != null) {
    if (id === 8) return 'bg-emerald-100 text-emerald-700';
    if ([1,2].includes(id)) return 'bg-blue-100 text-blue-700';
    if ([3,5].includes(id)) return 'bg-orange-100 text-orange-700';
    if (id === 7) return 'bg-amber-100 text-amber-700';
    if ([6,9].includes(id)) return 'bg-red-100 text-red-600';
    if (id === 4) return 'bg-indigo-100 text-indigo-700';
  }
  const l = label.toLowerCase();
  if (l.includes('admission confirmed')) return 'bg-emerald-100 text-emerald-700';
  if (l === 'new' || l.includes('not recieved call')) return 'bg-blue-100 text-blue-700';
  if (l.includes('interested') || l.includes('eligible')) return 'bg-orange-100 text-orange-700';
  if (l.includes('follow up pending')) return 'bg-amber-100 text-amber-700';
  if (l.includes('irrelevant') || l.includes('lost lead')) return 'bg-red-100 text-red-600';
  if (l.includes('next batch')) return 'bg-indigo-100 text-indigo-700';
  return 'bg-gray-100 text-gray-500';
}

function statusBar(id: number | null, label: string) {
  if (id != null) {
    if (id === 8) return 'bg-emerald-400';
    if ([1,2].includes(id)) return 'bg-blue-400';
    if ([3,5].includes(id)) return 'bg-orange-400';
    if (id === 7) return 'bg-amber-400';
    if ([6,9].includes(id)) return 'bg-red-400';
    if (id === 4) return 'bg-indigo-400';
  }
  const l = label.toLowerCase();
  if (l.includes('admission confirmed')) return 'bg-emerald-400';
  if (l.includes('interested') || l.includes('eligible')) return 'bg-orange-400';
  if (l.includes('follow up pending')) return 'bg-amber-400';
  if (l.includes('irrelevant') || l.includes('lost lead')) return 'bg-red-400';
  if (l.includes('next batch')) return 'bg-indigo-400';
  return 'bg-slate-300';
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
  const [discipline, setDiscipline] = useState(() => getInitParam('discipline'));
  const [inquiryType, setInquiryType] = useState(() => getInitParam('inquiryType'));
  const [status, setStatus] = useState(() => getInitParam('status'));
  const [dateFrom, setDateFrom] = useState(() => getInitParam('dateFrom'));
  const [dateTo, setDateTo] = useState(() => getInitParam('dateTo'));
  const [training, setTraining] = useState(() => getInitParam('training'));
  const [batchCategory, setBatchCategory] = useState(() => getInitParam('batchCategory'));
  const [puneOnly, setPuneOnly] = useState(() => getInitParam('puneOnly'));
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get('page') || '1')));
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  type ContactInfo = { count: number; lastAt: string | null };
  const [rowContacts, setRowContacts] = useState<Record<number, Record<string, ContactInfo>>>({});
  const [contactBusy, setContactBusy] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Record a contact attempt (Call / Mail / WhatsApp / Walk-in). Each click logs a
  // timestamped entry on the server; the button stays highlighted once any exist.
  const logContact = async (studentId: number, channel: string) => {
    const busyKey = `${studentId}:${channel}`;
    if (contactBusy === busyKey) return;
    setContactBusy(busyKey);
    // Optimistic: bump count + timestamp immediately.
    const nowIso = new Date().toISOString();
    setRowContacts(prev => {
      const forRow = { ...(prev[studentId] ?? {}) };
      const existing = forRow[channel];
      forRow[channel] = { count: (existing?.count ?? 0) + 1, lastAt: nowIso };
      return { ...prev, [studentId]: forRow };
    });
    try {
      const res = await fetch('/api/inquiry/contact-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: studentId, channel }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Roll back the optimistic bump on failure.
      setRowContacts(prev => {
        const forRow = { ...(prev[studentId] ?? {}) };
        const existing = forRow[channel];
        const nextCount = (existing?.count ?? 1) - 1;
        if (nextCount <= 0) delete forRow[channel];
        else forRow[channel] = { count: nextCount, lastAt: existing?.lastAt ?? null };
        return { ...prev, [studentId]: forRow };
      });
    } finally {
      setContactBusy(null);
    }
  };

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      setError('');
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) p.set('search', search);
      if (discipline) p.set('discipline', discipline);
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
  }, [page, fetchTrigger, search, discipline, inquiryType, status, dateFrom, dateTo, training, batchCategory, puneOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load the timestamped contact summary for the inquiries on the current page so the
  // Call/Mail/WhatsApp/Walk-in buttons reflect prior contacts. One batched request.
  useEffect(() => {
    const ids = rows.map(r => r.Student_Id).filter(Boolean);
    if (ids.length === 0) { setRowContacts({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inquiry/contact-log?inquiryIds=${ids.join(',')}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRowContacts(data.contacts ?? {});
      } catch { /* non-fatal: buttons just start unhighlighted */ }
    })();
    return () => { cancelled = true; };
  }, [rows]);

  const syncUrl = (params: Record<string, string>) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    router.replace(p.toString() ? `${pathname}?${p}` : pathname, { scroll: false });
  };

  const doSearch = () => {
    const params = {
      search,
      discipline,
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
    setSearch(''); setDiscipline(''); setInquiryType('');
    setStatus(''); setDateFrom(''); setDateTo(''); setTraining('');
    setBatchCategory(''); setPuneOnly('');
    setPage(1); setFetchTrigger(t => t + 1);
  };

  const buildReturnTo = () => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (discipline) p.set('discipline', discipline);
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

  const handleRegenerateAdmissionLink = async (r: InquiryRow) => {
    const ok = window.confirm(
      `Regenerate admission link for ${formatName(r.Student_Name)}?\n\nThis clears the saved online admission form/draft for this inquiry and creates a fresh usable form link.`
    );
    if (!ok) return;

    setRegeneratingId(r.Student_Id);
    try {
      const res = await fetch('/api/inquiry/regenerate-admission-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: r.Student_Id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to regenerate admission link');
      }

      if (data.admissionFormUrl) {
        await navigator.clipboard.writeText(String(data.admissionFormUrl));
      }
      alert('Admission link regenerated successfully. Fresh link copied to clipboard.');
      setFetchTrigger((t) => t + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate admission link');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDeleteInquiry = async (r: InquiryRow) => {
    const ok = window.confirm(`Delete inquiry for ${formatName(r.Student_Name)}? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(r.Student_Id);
    try {
      const res = await fetch(`/api/inquiry/${r.Student_Id}`, { method: 'DELETE' });
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

  // Overdue / today scheduled follow-ups — fetched only when expanded
  const [overdueFollowUps, setOverdueFollowUps] = useState<InquiryRow[]>([]);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  const [overdueLoadedForTrigger, setOverdueLoadedForTrigger] = useState<number | null>(null);

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

  useEffect(() => {
    if (!overdueExpanded || overdueLoadedForTrigger === fetchTrigger) return;

    let cancelled = false;
    async function fetchOverdue() {
      setOverdueLoading(true);
      try {
        const res = await fetch('/api/inquiry?followUpDue=1&limit=100');
        const ct = res.headers.get('content-type') || '';
        const data = ct.includes('application/json') ? await res.json() : {};
        if (!cancelled) {
          setOverdueFollowUps(data.rows ?? []);
          setOverdueLoadedForTrigger(fetchTrigger);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setOverdueLoading(false); }
    }
    fetchOverdue();
    return () => { cancelled = true; };
  }, [fetchTrigger, overdueExpanded, overdueLoadedForTrigger]);

  const followUps = rows.filter(hasScheduledFollowUp);

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

      {/* Scheduled Follow-ups Due Today & Overdue */}
      {
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOverdueExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-amber-100/60 transition-colors"
          >
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-bold text-amber-800 text-sm flex-1">
              Scheduled Follow-ups Due Today &amp; Overdue
            </span>
            {overdueLoadedForTrigger === fetchTrigger && !overdueLoading && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 tabular-nums">
                {overdueFollowUps.length}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-amber-500 transition-transform ${overdueExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {overdueExpanded && (
            <div className="overflow-x-auto border-t border-amber-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-100/60 border-b border-amber-200">
                    <th className="text-left py-1.5 px-3 font-bold">Name</th>
                    <th className="text-left py-1.5 px-3 font-bold">Training</th>
                    <th className="text-left py-1.5 px-3 font-bold">Mobile</th>
                    <th className="text-left py-1.5 px-3 font-bold">Follow-up Date</th>
                    <th className="text-left py-1.5 px-3 font-bold">Last Discussion</th>
                    <th className="text-left py-1.5 px-3 font-bold">By</th>
                    <th className="text-center py-1.5 px-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-amber-500">Loading…</span>
                        </div>
                      </td>
                    </tr>
                  ) : overdueFollowUps.map(r => (
                    <tr key={r.Student_Id} className="border-b border-amber-100 hover:bg-amber-50 transition-colors">
                      <td className="py-1.5 px-3 font-semibold">{formatName(r.Student_Name)}</td>
                      <td className="py-1.5 px-3 text-red-600 max-w-[140px]">
                        <span className="truncate block">{r.CourseName || '—'}</span>
                      </td>
                      <td className="py-1.5 px-3 font-mono whitespace-nowrap">{r.Present_Mobile || '—'}</td>
                      <td className="py-1.5 px-3 whitespace-nowrap font-semibold text-amber-700">
                        {formatDate(r.NextFollowUpDate ?? null)}
                      </td>
                      <td className="py-1.5 px-3 max-w-[200px]">
                        <span className="line-clamp-2 text-slate-600">{r.Discussion || '—'}</span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 whitespace-nowrap">{r.FollowUpBy || '—'}</td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          title="Edit"
                          onClick={() => {
                            const returnTo = encodeURIComponent(buildReturnTo());
                            router.push(`/dashboard/inquiry/add?editId=${r.Student_Id}&returnTo=${returnTo}`);
                          }}
                          disabled={!canUpdate}
                          className={canUpdate ? 'p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors' : 'p-1 rounded text-slate-200 cursor-not-allowed'}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      }

      <FilterBar>
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
        <select value={training} onChange={e => setTraining(e.target.value)} className={`${ctrl} w-[140px]`}>
          <option value="">Training</option>
          {filters.trainings.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={batchCategory} onChange={e => setBatchCategory(e.target.value)} className={`${ctrl} w-[150px]`}>
          <option value="">Batch Category</option>
          {filters.batchCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={puneOnly} onChange={e => setPuneOnly(e.target.value)} className={`${ctrl} w-[130px]`}>
          <option value="">All Sources</option>
          <option value="1">Pune Only</option>
        </select>
        <button onClick={doSearch} className="flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
        <button onClick={doClear} className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors">
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
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-200 border-b border-slate-300">
                <th className="text-left py-2 px-3 font-bold">#</th>
                <th className="text-left py-2 px-3 font-bold">Name</th>
                <th className="text-left py-2 px-3 font-bold">Training</th>
                <th className="text-left py-2 px-3 font-bold">Mobile</th>
                <th className="text-left py-2 px-3 font-bold">Email</th>
                <th className="text-left py-2 px-3 font-bold">Discipline</th>
                <th className="text-left py-2 px-3 font-bold">Source</th>
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
                const attended = hasLatestFollowUp(r);
                const colorCls = isPendingFollowUp(r) ? '[&>td]:text-purple-600' : attended ? '[&>td]:text-slate-800' : '[&>td]:text-red-500';
                const sourceRowCls = r.IsPuneInquiry
                  ? 'bg-amber-100/80 hover:bg-amber-200/70'
                  : r.IsMetaAdConverted
                    ? 'bg-[#2E3093]/[0.06] hover:bg-[#2E3093]/[0.12]'
                    : 'hover:bg-slate-50';
                const primarySource = r.Inquiry_From || r.Inquiry_Type || '—';
                const secondarySource = r.Inquiry_From && r.Inquiry_Type && r.Inquiry_From !== r.Inquiry_Type
                  ? r.Inquiry_Type
                  : null;
                const rowContact = rowContacts[r.Student_Id] ?? {};
                const tagButtons = [
                  {
                    key: 'call',
                    label: 'Call',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.95.68l1.03 3.09a1 1 0 01-.5 1.2l-1.52.76a11.04 11.04 0 005.52 5.52l.76-1.52a1 1 0 011.2-.5l3.09 1.03a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C8.82 21 3 15.18 3 8V5z" />,
                  },
                  {
                    key: 'mail',
                    label: 'Mail',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
                  },
                  {
                    key: 'whatsapp',
                    label: 'WhatsApp',
                    icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M8.6 13.4c1.6 1.6 3.2 2.4 4 2.1.5-.2.9-.8 1.1-1.3.1-.3 0-.6-.3-.8l-1.1-.7a.8.8 0 00-.9.1l-.5.5c-.9-.5-1.6-1.2-2.1-2.1l.5-.5a.8.8 0 00.1-.9l-.7-1.1a.8.8 0 00-.8-.3c-.5.2-1.1.6-1.3 1.1-.3.8.5 2.4 2 3.9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a8 8 0 01-11.9 7L4 20l1.5-4.1A8 8 0 1120 11.5z" /></>,
                  },
                  {
                    key: 'personal-inquiry',
                    label: 'Personal Inquiry',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />,
                  },
                ];
                return (
                  <tr key={r.Student_Id} className={`border-b border-slate-200 transition-colors ${colorCls} ${sourceRowCls}`}>
                    <td className="py-1 px-2 font-semibold font-mono tabular-nums relative pl-4">
                      <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${statusBar(r.Status_id, r.StatusLabel)} rounded-r`} />
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
                    <td className="py-1 px-2 min-w-[190px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="font-semibold">{primarySource}</span>
                          {r.IsMetaAdConverted && (
                            <span
                              title="Converted from Meta Ads"
                              className="inline-flex items-center rounded-full border border-[#2E3093]/30 bg-[#2E3093]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#2E3093]"
                            >
                              Meta Converted
                            </span>
                          )}
                          {r.IsPuneInquiry && (
                            <span
                              title={r.PunePageSource || r.PuneSourceLocation || 'Pune source'}
                              className="inline-flex items-center rounded-full border border-amber-700 bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-950 shadow-sm"
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
                    <td className="py-1 px-2 max-w-[190px]">
                      {(() => {
                        const raw = (r.Discussion || '').trim();
                        if (!raw || raw === 'NULL') return <span className="text-slate-300">—</span>;
                        // Parse "counsellor - note" format
                        const dashIdx = raw.indexOf(' - ');
                        const hasCounsellor = dashIdx > 0 && dashIdx < 30;
                        const counsellor = hasCounsellor ? raw.slice(0, dashIdx).trim() : null;
                        const note = hasCounsellor ? raw.slice(dashIdx + 3).trim() : raw;
                        return (
                          <div className="flex flex-col gap-0.5">
                            {counsellor && (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full max-w-[80px] truncate">{counsellor}</span>
                                {r.DiscussionDate && <span className="text-[9px] text-slate-400 whitespace-nowrap">{formatDate(r.DiscussionDate)}</span>}
                              </span>
                            )}
                            <span className="line-clamp-2 text-slate-600 leading-snug">{note}</span>
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
                      <div className="flex items-center justify-center gap-0.5 flex-nowrap min-w-[210px] whitespace-nowrap">
                        {tagButtons.map(tag => {
                          const info = rowContact[tag.key];
                          const contacted = (info?.count ?? 0) > 0;
                          const busy = contactBusy === `${r.Student_Id}:${tag.key}`;
                          const title = contacted
                            ? `${tag.label} — ${info!.count}× , last ${info!.lastAt ? formatDate(info!.lastAt) : '—'}`
                            : tag.label;
                          return (
                            <button
                              key={tag.key}
                              type="button"
                              title={title}
                              aria-label={tag.label}
                              aria-pressed={contacted}
                              disabled={busy}
                              onClick={() => logContact(r.Student_Id, tag.key)}
                              className={`relative inline-flex h-5 w-5 items-center justify-center rounded border transition-colors disabled:opacity-50 ${contacted ? 'border-[#2E3093] bg-[#2E3093]/15 text-[#2E3093]' : 'border-slate-400 text-slate-600 hover:border-[#2A6BB5] hover:bg-blue-50 hover:text-[#2A6BB5]'}`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">{tag.icon}</svg>
                              {contacted && info!.count > 1 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#2E3093] text-white text-[8px] font-bold leading-[14px] text-center">{info!.count}</span>
                              )}
                            </button>
                          );
                        })}
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
                        <button title="Send admission form" onClick={() => handleSendAdmissionForm(r)}
                          disabled={!canUpdate || sendingId === r.Student_Id}
                          className={canUpdate ? 'p-0.5 rounded text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50' : 'p-0.5 rounded text-slate-400 cursor-not-allowed'}>
                          {sendingId === r.Student_Id
                            ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>}
                        </button>
                        <button
                          title="Regenerate admission link"
                          onClick={() => handleRegenerateAdmissionLink(r)}
                          disabled={!canUpdate || regeneratingId === r.Student_Id}
                          className={canUpdate ? 'p-0.5 rounded text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50' : 'p-0.5 rounded text-slate-400 cursor-not-allowed'}>
                          {regeneratingId === r.Student_Id
                            ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>}
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDeleteInquiry(r)}
                          disabled={!(canDelete || canUpdate) || deletingId === r.Student_Id}
                          className={(canDelete || canUpdate) ? 'p-0.5 rounded text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50' : 'p-0.5 rounded text-slate-400 cursor-not-allowed'}
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
                  <th className="text-left py-2 px-3 font-bold">Training</th>
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
                    <td className="py-1.5 px-3 text-red-600 max-w-[140px]"><span className="truncate block">{r.CourseName || '—'}</span></td>
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
