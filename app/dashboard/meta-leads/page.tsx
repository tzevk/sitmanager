'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FilterBar, GhostBtn, PageHeader } from '@/components/ui/PageHeader';

interface InquiryRow {
  Student_Id: number;
  Student_Name: string;
  CourseName: string | null;
  Inquiry_Dt: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Status_id: number | null;
  StatusLabel: string;
  Discussion: string | null;
  MetaCampaignName?: string | null;
  MetaFormName?: string | null;
  LeadTags?: string[];
  IsDuplicateLead?: boolean;
}

interface MetaPerformanceRow {
  campaignId: string | null;
  campaignName: string | null;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  cpc: number;
  leads: number;
  costPerLead: number | null;
}

interface MetaPerformanceSummary {
  campaigns: MetaPerformanceRow[];
  totals: {
    reach: number;
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
    ctr: number;
    cpl: number | null;
  };
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface Filters { trainings: string[]; statusOptions: { id: number; label: string }[]; }

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

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

function statusPill(id: number | null, label: string) {
  if (id != null) {
    if ([7,10,27].includes(id)) return 'bg-emerald-100 text-emerald-700';
    if ([1,2,3].includes(id)) return 'bg-blue-100 text-blue-700';
    if ([5,24].includes(id)) return 'bg-orange-100 text-orange-700';
    if ([4,15,25].includes(id)) return 'bg-amber-100 text-amber-700';
    if ([6,9,19,29,34].includes(id)) return 'bg-red-100 text-red-600';
    if ([8,33].includes(id)) return 'bg-gray-100 text-gray-500';
  }
  const l = label.toLowerCase();
  if (['admitted','converted','enrolled'].includes(l)) return 'bg-emerald-100 text-emerald-700';
  if (['inquiry','new','contacted'].includes(l)) return 'bg-blue-100 text-blue-700';
  if (['hot lead','interested'].includes(l)) return 'bg-orange-100 text-orange-700';
  if (['warm lead','follow up','callback'].includes(l)) return 'bg-amber-100 text-amber-700';
  if (['not interested','lost','dropped','dnc'].includes(l)) return 'bg-red-100 text-red-600';
  return 'bg-gray-100 text-gray-500';
}

export default function MetaLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<Filters>({ trainings: [], statusOptions: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [leadTag, setLeadTag] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [training, setTraining] = useState('');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [metaPerf, setMetaPerf] = useState<MetaPerformanceSummary | null>(null);
  const [metaPerfError, setMetaPerfError] = useState('');
  const oauthStatus = searchParams.get('metaOAuth');
  const oauthMessage = searchParams.get('metaOAuthMessage');
  const oauthPages = searchParams.get('metaOAuthPages');
  const oauthUser = searchParams.get('metaOAuthUser');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) p.set('search', search);
      if (leadTag) p.set('leadTag', leadTag);
      if (status) p.set('status', status);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo) p.set('dateTo', dateTo);
      if (training) p.set('training', training);
      if (duplicatesOnly) p.set('duplicatesOnly', '1');
      const res = await fetch(`/api/meta-ads/leads?${p.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load Meta leads');
      setRows(data.rows ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
      if (data.filters) {
        setFilters({
          trainings: data.filters.trainings ?? [],
          statusOptions: data.filters.statusOptions ?? [],
        });
      }
    } catch (error) {
      console.error(error);
      setRows([]);
      setPagination({ page: 1, limit: 25, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, duplicatesOnly, leadTag, page, search, status, training]);

  useEffect(() => { fetchData(); }, [fetchData, fetchTrigger]);

  useEffect(() => {
    let cancelled = false;
    async function fetchMetaPerformance() {
      setMetaPerfError('');
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        const res = await fetch(`/api/meta-ads/performance?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load Meta campaign performance');
        if (!cancelled) setMetaPerf(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setMetaPerf(null);
          setMetaPerfError(error instanceof Error ? error.message : 'Failed to load Meta campaign performance');
        }
      }
    }
    fetchMetaPerformance();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const doSearch = () => {
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  const doClear = () => {
    setSearch('');
    setLeadTag('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setTraining('');
    setDuplicatesOnly(false);
    setPage(1);
    setFetchTrigger((t) => t + 1);
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Name', 'Training', 'Mobile', 'Email', 'Campaign', 'Form', 'Tags', 'Duplicate', 'Status', 'Inquiry Date'];
    const csv = [headers.join(',')].concat(
      rows.map((row) => [
        row.Student_Name,
        row.CourseName,
        row.Present_Mobile,
        row.Email,
        row.MetaCampaignName,
        row.MetaFormName,
        row.LeadTags?.join(' | '),
        row.IsDuplicateLead ? 'Yes' : 'No',
        row.StatusLabel,
        row.Inquiry_Dt,
      ].map(escape).join(','))
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view meta leads." /> : <>
        <PageHeader
          title="Meta Leads"
          breadcrumbs={[{ label: 'Admission Activity' }, { label: 'Meta Leads' }]}
          meta={`${pagination.total.toLocaleString()} records`}
          action={<>
            <GhostBtn href="/api/meta-ads/oauth/start?redirectTo=/dashboard/meta-leads">Connect Meta</GhostBtn>
            <GhostBtn href="/dashboard/inquiry">Inquiry Listing</GhostBtn>
            <GhostBtn onClick={exportCsv}>Export</GhostBtn>
          </>}
        />

        {oauthStatus === 'connected' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Connected to Meta{oauthUser ? ` as ${oauthUser}` : ''}{oauthPages ? ` with ${oauthPages} page${oauthPages === '1' ? '' : 's'} available` : ''}.
          </div>
        )}
        {oauthStatus === 'error' && oauthMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Meta connection failed: {oauthMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr] gap-4">
          <div className="rounded-xl border border-[#2E3093]/10 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A6BB5]/70">Meta Ads</p>
                <h3 className="text-sm font-bold text-slate-800">Campaign Performance</h3>
              </div>
              <span className="text-[11px] text-slate-400">{dateFrom || 'Any'} to {dateTo || 'Today'}</span>
            </div>
            {metaPerfError ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{metaPerfError}</p>
            ) : !metaPerf ? (
              <div className="h-24 rounded-lg bg-slate-50 animate-pulse" />
            ) : (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-5 gap-2">
                  {[
                    { label: 'Reach', value: metaPerf.totals.reach.toLocaleString() },
                    { label: 'Impressions', value: metaPerf.totals.impressions.toLocaleString() },
                    { label: 'Clicks', value: metaPerf.totals.clicks.toLocaleString() },
                    { label: 'Leads', value: metaPerf.totals.leads.toLocaleString() },
                    { label: 'Spend', value: `Rs ${metaPerf.totals.spend.toFixed(0)}` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{item.label}</div>
                      <div className="text-sm font-bold text-slate-800">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 flex gap-4">
                  <span>CTR {metaPerf.totals.ctr.toFixed(2)}%</span>
                  <span>CPL {metaPerf.totals.cpl == null ? '—' : `Rs ${metaPerf.totals.cpl.toFixed(0)}`}</span>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-[#2E3093]/10 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A6BB5]/70">Top Campaigns</p>
                <h3 className="text-sm font-bold text-slate-800">Lead and reach summary</h3>
              </div>
              <span className="text-[11px] text-slate-400">Top 5 by leads</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="text-left px-4 py-2 font-bold">Campaign</th>
                    <th className="text-right px-4 py-2 font-bold">Reach</th>
                    <th className="text-right px-4 py-2 font-bold">Clicks</th>
                    <th className="text-right px-4 py-2 font-bold">Leads</th>
                    <th className="text-right px-4 py-2 font-bold">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {(metaPerf?.campaigns || []).slice().sort((a, b) => b.leads - a.leads).slice(0, 5).map((campaign, index) => (
                    <tr key={`${campaign.campaignId || campaign.campaignName || index}`} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-semibold text-slate-700">{campaign.campaignName || campaign.campaignId || '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{campaign.reach.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{campaign.clicks.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-bold text-[#2E3093]">{campaign.leads.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-500">Rs {campaign.spend.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <FilterBar>
          <input
            type="text"
            value={search}
            placeholder="Search name, mobile, email…"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            className={`${ctrl} flex-1 min-w-[160px]`}
          />
          <input
            type="text"
            value={leadTag}
            placeholder="Meta tag / campaign"
            onChange={(e) => setLeadTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            className={`${ctrl} w-[160px]`}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${ctrl} w-[130px]`}>
            <option value="">Status</option>
            {filters.statusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${ctrl} w-[130px]`} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${ctrl} w-[130px]`} />
          <select value={training} onChange={(e) => setTraining(e.target.value)} className={`${ctrl} w-[140px]`}>
            <option value="">Training</option>
            {filters.trainings.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
            <input type="checkbox" checked={duplicatesOnly} onChange={(e) => setDuplicatesOnly(e.target.checked)} />
            Duplicate leads only
          </label>
          <button onClick={doSearch} className="flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors">Search</button>
          <button onClick={doClear} className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors">Clear</button>
        </FilterBar>

        <div className="bg-white rounded-xl border border-[#2E3093]/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#2A6BB5]/60 bg-zinc-50 border-b border-zinc-200">
                  <th className="text-left py-2 px-3 font-bold">#</th>
                  <th className="text-left py-2 px-3 font-bold">Name</th>
                  <th className="text-left py-2 px-3 font-bold">Training</th>
                  <th className="text-left py-2 px-3 font-bold">Campaign</th>
                  <th className="text-left py-2 px-3 font-bold">Form</th>
                  <th className="text-left py-2 px-3 font-bold">Tags</th>
                  <th className="text-left py-2 px-3 font-bold">Mobile</th>
                  <th className="text-left py-2 px-3 font-bold">Email</th>
                  <th className="text-left py-2 px-3 font-bold">Date</th>
                  <th className="text-center py-2 px-3 font-bold">Status</th>
                  <th className="text-center py-2 px-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="py-10 text-center text-xs text-slate-400">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={11} className="py-10 text-center text-xs text-slate-400">No Meta leads found</td></tr>
                ) : rows.map((row, index) => (
                  <tr key={row.Student_Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-1.5 px-3 font-semibold font-mono tabular-nums">{(pagination.page - 1) * pagination.limit + index + 1}</td>
                    <td className="py-1.5 px-3 font-semibold">{formatName(row.Student_Name)}</td>
                    <td className="py-1.5 px-3 text-slate-500">{row.CourseName || '—'}</td>
                    <td className="py-1.5 px-3 font-medium text-slate-700">{row.MetaCampaignName || '—'}</td>
                    <td className="py-1.5 px-3 text-slate-500">{row.MetaFormName || '—'}</td>
                    <td className="py-1.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(row.LeadTags || []).slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded-full bg-[#EEF3FF] text-[#2E3093] text-[10px] font-semibold">{tag}</span>
                        ))}
                        {row.IsDuplicateLead && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Duplicate</span>}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 font-mono">{row.Present_Mobile || '—'}</td>
                    <td className="py-1.5 px-3">{row.Email || '—'}</td>
                    <td className="py-1.5 px-3">{formatDate(row.Inquiry_Dt)}</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusPill(row.Status_id, row.StatusLabel)}`}>{row.StatusLabel}</span>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        title="Edit inquiry"
                        onClick={() => row.Student_Id > 0 && router.push(`/dashboard/inquiry/add?editId=${row.Student_Id}`)}
                        disabled={!canUpdate || row.Student_Id <= 0}
                        className={canUpdate && row.Student_Id > 0 ? 'p-1 rounded hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 transition-colors' : 'p-1 rounded text-slate-200 cursor-not-allowed'}
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
        </div>
      </>}
    </div>
  );
}