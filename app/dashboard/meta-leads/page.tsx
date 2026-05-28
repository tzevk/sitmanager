'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FilterBar, GhostBtn, PageHeader } from '@/components/ui/PageHeader';

interface InquiryRow {
  MetaLead_Id: string;
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

function getInitials(name: string | null | undefined): string {
  const t = String(name ?? '').trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function statusPill(id: number | null, label: string) {
  if (id != null) {
    if ([7,10,27].includes(id)) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    if ([1,2,3].includes(id)) return 'bg-blue-100 text-blue-700 border border-blue-200';
    if ([5,24].includes(id)) return 'bg-orange-100 text-orange-700 border border-orange-200';
    if ([4,15,25].includes(id)) return 'bg-amber-100 text-amber-700 border border-amber-200';
    if ([6,9,19,29,34].includes(id)) return 'bg-red-100 text-red-600 border border-red-200';
    if ([8,33].includes(id)) return 'bg-gray-100 text-gray-500 border border-gray-200';
  }
  const l = label.toLowerCase();
  if (['admitted','converted','enrolled'].includes(l)) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (['inquiry','new','contacted'].includes(l)) return 'bg-blue-100 text-blue-700 border border-blue-200';
  if (['hot lead','interested'].includes(l)) return 'bg-orange-100 text-orange-700 border border-orange-200';
  if (['warm lead','follow up','callback'].includes(l)) return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (['not interested','lost','dropped','dnc'].includes(l)) return 'bg-red-100 text-red-600 border border-red-200';
  return 'bg-gray-100 text-gray-500 border border-gray-200';
}

function avatarColor(name: string | null | undefined): string {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-teal-100 text-teal-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
    'bg-indigo-100 text-indigo-700',
  ];
  const t = String(name ?? '').trim();
  if (!t) return colors[0];
  return colors[t.charCodeAt(0) % colors.length];
}

function KpiCard({ label, value, accent, loading }: {
  label: string;
  value: string;
  accent?: 'blue' | 'emerald' | 'orange' | 'violet' | 'rose' | 'slate';
  loading?: boolean;
}) {
  const dot: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    orange: 'bg-orange-500',
    violet: 'bg-violet-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-2.5">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[accent ?? 'slate']}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 truncate">{label}</p>
        {loading ? (
          <div className="mt-0.5 h-4 w-12 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className="text-sm font-bold text-slate-800 leading-tight">{value}</p>
        )}
      </div>
    </div>
  );
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
  const [pageSize, setPageSize] = useState(100);
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
      const p = new URLSearchParams({ page: String(page), limit: String(pageSize) });
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
      setPagination(data.pagination ?? { page: 1, limit: pageSize, total: 0, totalPages: 0 });
      if (data.filters) {
        setFilters({
          trainings: data.filters.trainings ?? [],
          statusOptions: data.filters.statusOptions ?? [],
        });
      }
    } catch (error) {
      console.error(error);
      setRows([]);
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, duplicatesOnly, leadTag, page, pageSize, search, status, training]);

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

  const doSearch = () => { setPage(1); setFetchTrigger((t) => t + 1); };
  const doClear = () => {
    setSearch(''); setLeadTag(''); setStatus(''); setDateFrom(''); setDateTo('');
    setTraining(''); setDuplicatesOnly(false); setPage(1); setFetchTrigger((t) => t + 1);
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Name', 'Training', 'Mobile', 'Email', 'Campaign', 'Form', 'Tags', 'Duplicate', 'Status', 'Inquiry Date'];
    const csv = [headers.join(',')].concat(
      rows.map((row) => [
        row.Student_Name, row.CourseName, row.Present_Mobile, row.Email,
        row.MetaCampaignName, row.MetaFormName, row.LeadTags?.join(' | '),
        row.IsDuplicateLead ? 'Yes' : 'No', row.StatusLabel, row.Inquiry_Dt,
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

  const fromRow = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const toRow = pagination.total === 0 ? 0 : Math.min(pagination.page * pagination.limit, pagination.total);

  const perfLoading = !metaPerf && !metaPerfError;

  const duplicatesInView = useMemo(() => rows.filter((r) => r.IsDuplicateLead).length, [rows]);
  const statusBreakdown = useMemo(() => {
    const map = new Map<string, { id: number | null; count: number }>();
    for (const row of rows) {
      const key = row.StatusLabel || 'Unknown';
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, { id: row.Status_id, count: 1 });
    }
    return Array.from(map.entries())
      .map(([label, { id, count }]) => ({ label, id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rows]);

  const topCampaigns = useMemo(
    () => (metaPerf?.campaigns || []).slice().sort((a, b) => b.leads - a.leads).slice(0, 5),
    [metaPerf]
  );

  const maxCampaignLeads = topCampaigns[0]?.leads || 1;

  return (
    <div className="space-y-5">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view meta leads." /> : (
        <>
          <PageHeader
            title="Meta Leads"
            breadcrumbs={[{ label: 'Admission Activity' }, { label: 'Meta Leads' }]}
            meta={`${pagination.total.toLocaleString()} records`}
            action={<>
              <GhostBtn href="/dashboard/inquiry">Inquiry Listing</GhostBtn>
              <GhostBtn onClick={exportCsv}>Export CSV</GhostBtn>
            </>}
          />

          {oauthStatus === 'connected' && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Connected to Meta{oauthUser ? ` as ${oauthUser}` : ''}{oauthPages ? ` · ${oauthPages} page${oauthPages === '1' ? '' : 's'} available` : ''}.
            </div>
          )}
          {oauthStatus === 'error' && oauthMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Meta connection failed: {oauthMessage}
            </div>
          )}

          {/* KPI Row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <KpiCard label="Total Leads" value={pagination.total.toLocaleString()} accent="blue" />
            <KpiCard label="API Leads" value={perfLoading ? '—' : (metaPerf?.totals.leads ?? 0).toLocaleString()} accent="violet" loading={perfLoading} />
            <KpiCard label="Reach" value={perfLoading ? '—' : (metaPerf?.totals.reach ?? 0).toLocaleString()} accent="slate" loading={perfLoading} />
            <KpiCard label="Spend" value={perfLoading ? '—' : `₹${(metaPerf?.totals.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} accent="orange" loading={perfLoading} />
            <KpiCard label="CTR" value={perfLoading ? '—' : `${(metaPerf?.totals.ctr ?? 0).toFixed(2)}%`} accent="emerald" loading={perfLoading} />
            <KpiCard label="Cost / Lead" value={perfLoading ? '—' : (metaPerf?.totals.cpl == null ? '—' : `₹${metaPerf.totals.cpl.toFixed(0)}`)} accent="rose" loading={perfLoading} />
          </div>

          {/* Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_0.9fr] gap-4">

            {/* Campaign Performance */}
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Meta Ads</p>
                  <h3 className="text-sm font-bold text-slate-800">Campaign Performance</h3>
                </div>
                <span className="text-[10px] bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-500 font-medium">
                  Top 5 by leads
                </span>
              </div>
              <div className="overflow-x-auto">
                {perfLoading ? (
                  <div className="p-4 space-y-2">
                    {[1,2,3,4].map((i) => <div key={i} className="h-8 bg-slate-50 rounded-lg animate-pulse" />)}
                  </div>
                ) : metaPerfError ? (
                  <div className="p-4 text-xs text-amber-700 bg-amber-50 m-3 rounded-lg border border-amber-100">{metaPerfError}</div>
                ) : topCampaigns.length === 0 ? (
                  <div className="p-6 text-xs text-slate-400 text-center">No campaign data available</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 font-bold">Campaign</th>
                        <th className="text-right px-3 py-2.5 font-bold">Reach</th>
                        <th className="text-right px-3 py-2.5 font-bold">Leads</th>
                        <th className="text-right px-4 py-2.5 font-bold">Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCampaigns.map((c, i) => (
                        <tr key={c.campaignId || i} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-slate-300 tabular-nums w-3">#{i + 1}</span>
                              <div>
                                <div className="font-semibold text-slate-700 truncate max-w-[140px]" title={c.campaignName || c.campaignId || '—'}>
                                  {c.campaignName || c.campaignId || '—'}
                                </div>
                                <div className="mt-1 h-1 bg-slate-100 rounded-full w-full">
                                  <div
                                    className="h-1 bg-[#2E3093]/40 rounded-full transition-all"
                                    style={{ width: `${Math.round((c.leads / maxCampaignLeads) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{c.reach.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-[#2E3093] tabular-nums">{c.leads.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">₹{c.spend.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {metaPerf && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 grid grid-cols-3 gap-3 text-[11px]">
                  <div className="text-center">
                    <div className="font-bold text-slate-700">{metaPerf.totals.impressions.toLocaleString()}</div>
                    <div className="text-slate-400 uppercase tracking-wide text-[9px] font-bold mt-0.5">Impressions</div>
                  </div>
                  <div className="text-center border-x border-slate-200">
                    <div className="font-bold text-slate-700">{metaPerf.totals.clicks.toLocaleString()}</div>
                    <div className="text-slate-400 uppercase tracking-wide text-[9px] font-bold mt-0.5">Clicks</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-slate-700">{metaPerf.totals.ctr.toFixed(2)}%</div>
                    <div className="text-slate-400 uppercase tracking-wide text-[9px] font-bold mt-0.5">CTR</div>
                  </div>
                </div>
              )}
            </div>

            {/* Lead Status Breakdown */}
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Current View</p>
                  <h3 className="text-sm font-bold text-slate-800">Lead Status Breakdown</h3>
                </div>
                <span className="text-[10px] bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-500 font-medium">
                  {rows.length} shown
                </span>
              </div>
              <div className="p-4 space-y-3">
                {loading ? (
                  [1,2,3,4,5].map((i) => <div key={i} className="h-7 bg-slate-50 rounded-lg animate-pulse" />)
                ) : statusBreakdown.length === 0 ? (
                  <div className="py-4 text-xs text-slate-400 text-center">No leads in current view</div>
                ) : (
                  statusBreakdown.map(({ label, id, count }) => {
                    const pct = rows.length > 0 ? Math.round((count / rows.length) * 100) : 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusPill(id, label)}`}>{label}</span>
                            <span className="text-[11px] font-bold text-slate-600 tabular-nums">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Lead Quality Summary */}
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Data Quality</p>
                <h3 className="text-sm font-bold text-slate-800">Lead Quality Summary</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Duplicate ratio */}
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Duplicate Leads</span>
                    {duplicatesInView > 0 ? (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        {rows.length > 0 ? `${Math.round((duplicatesInView / rows.length) * 100)}%` : '0%'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Clean</span>
                    )}
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-bold text-slate-800">{duplicatesInView}</span>
                    <span className="text-xs text-slate-400 mb-1">of {rows.length} leads in view</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-200 rounded-full">
                    <div
                      className="h-1.5 rounded-full bg-amber-400 transition-all"
                      style={{ width: rows.length > 0 ? `${Math.round((duplicatesInView / rows.length) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Meta attribution */}
                {metaPerf && (
                  <div className="space-y-2.5">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Campaigns Active</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">{metaPerf.campaigns.length}</div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Avg Cost / Click</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">
                          {metaPerf.totals.clicks > 0
                            ? `₹${(metaPerf.totals.spend / metaPerf.totals.clicks).toFixed(0)}`
                            : '—'}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Impressions / Lead</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">
                          {metaPerf.totals.leads > 0
                            ? Math.round(metaPerf.totals.impressions / metaPerf.totals.leads).toLocaleString()
                            : '—'}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <FilterBar>
            <input
              type="text"
              value={search}
              placeholder="Search name, mobile, email…"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              className={`${ctrl} flex-1 min-w-[180px]`}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${ctrl} w-[130px]`}>
              <option value="">All Statuses</option>
              {filters.statusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${ctrl} w-[130px]`} />
            <span className="text-slate-300 text-xs select-none">–</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${ctrl} w-[130px]`} />
            <button onClick={doSearch} className="flex items-center gap-1.5 bg-[#2E3093] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              Search
            </button>
            <button onClick={doClear} className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-zinc-200 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 transition-colors shrink-0">Clear</button>
          </FilterBar>

          {/* Leads Table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                    <th className="text-left py-3 px-3 font-bold w-8">#</th>
                    <th className="text-left py-3 px-3 font-bold">Lead</th>
                    <th className="text-left py-3 px-3 font-bold">Training</th>
                    <th className="text-left py-3 px-3 font-bold">Campaign</th>
                    <th className="text-left py-3 px-3 font-bold">Form</th>
                    <th className="text-left py-3 px-3 font-bold">Tags</th>
                    <th className="text-left py-3 px-3 font-bold">Contact</th>
                    <th className="text-left py-3 px-3 font-bold">Date</th>
                    <th className="text-center py-3 px-3 font-bold">Status</th>
                    <th className="text-center py-3 px-3 font-bold w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {Array.from({ length: 10 }).map((__, j) => (
                          <td key={j} className="py-3 px-3"><div className="h-4 bg-slate-50 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="text-slate-300 text-2xl mb-2">○</div>
                        <div className="text-xs text-slate-400 font-medium">No Meta leads found</div>
                        <div className="text-xs text-slate-300 mt-1">Try adjusting your filters</div>
                      </td>
                    </tr>
                  ) : rows.map((row, index) => (
                    <tr
                      key={`${row.Student_Id}-${row.Email || row.Present_Mobile || row.Student_Name}-${row.Inquiry_Dt || index}-${index}`}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-slate-300 font-mono tabular-nums text-[10px]">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor(row.Student_Name)}`}>
                            {getInitials(row.Student_Name)}
                          </div>
                          <span className="font-semibold text-slate-700">{formatName(row.Student_Name)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-[120px]">
                        <span className="truncate block" title={row.CourseName || undefined}>{row.CourseName || '—'}</span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[140px]">
                        <span className="truncate block font-medium text-slate-700" title={row.MetaCampaignName || undefined}>{row.MetaCampaignName || '—'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[120px]">
                        <span className="truncate block" title={row.MetaFormName || undefined}>{row.MetaFormName || '—'}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(row.LeadTags || []).slice(0, 2).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded-md bg-[#EEF3FF] text-[#2E3093] text-[9px] font-bold border border-[#2E3093]/10">{tag}</span>
                          ))}
                          {(row.LeadTags || []).length > 2 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[9px] font-bold">+{(row.LeadTags || []).length - 2}</span>
                          )}
                          {row.IsDuplicateLead && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[9px] font-bold border border-amber-200">Dup</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="space-y-0.5">
                          <div className="font-mono text-slate-700 text-[11px]">{row.Present_Mobile || '—'}</div>
                          <div className="text-slate-400 text-[10px] truncate max-w-[140px]">{row.Email || ''}</div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatDate(row.Inquiry_Dt)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${statusPill(row.Status_id, row.StatusLabel)}`}>
                          {row.StatusLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          title="Open lead details"
                          onClick={() => row.MetaLead_Id && router.push(`/dashboard/meta-leads/${encodeURIComponent(row.MetaLead_Id)}`)}
                          disabled={!canView || !row.MetaLead_Id}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                            canView && row.MetaLead_Id
                              ? 'text-slate-300 hover:text-[#2E3093] hover:bg-[#2E3093]/5 group-hover:text-slate-400'
                              : 'text-slate-200 cursor-not-allowed'
                          }`}
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

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <div className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{fromRow.toLocaleString()}–{toRow.toLocaleString()}</span> of <span className="font-semibold text-slate-600">{pagination.total.toLocaleString()}</span> leads
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.max(1, c - 1))}
                  disabled={loading || pagination.page <= 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    pagination.page > 1
                      ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      : 'border-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  ← Prev
                </button>
                <span className="min-w-[100px] text-center text-xs font-semibold text-slate-600">
                  Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.min(pagination.totalPages || 1, c + 1))}
                  disabled={loading || pagination.page >= pagination.totalPages}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    pagination.page < pagination.totalPages
                      ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      : 'border-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
