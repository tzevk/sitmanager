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

interface MetaCampaignPublishLogRow {
  id: number;
  campaignId: string | null;
  campaignName: string;
  objective: string;
  publishStatus: string;
  requestedBy: number | null;
  createdAt: string;
  errorMessage: string | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface Filters { trainings: string[]; sources: string[]; statusOptions: { id: number; label: string }[]; }

const META_PUBLISH_OBJECTIVES = [
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness' },
  { value: 'OUTCOME_SALES', label: 'Sales' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion' },
] as const;

const META_SPECIAL_CATEGORY_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'CREDIT', label: 'Credit' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'ISSUES_ELECTIONS_POLITICS', label: 'Politics / Issues' },
] as const;

const META_CTA_OPTIONS = [
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'APPLY_NOW', label: 'Apply Now' },
  { value: 'CONTACT_US', label: 'Contact Us' },
  { value: 'GET_QUOTE', label: 'Get Quote' },
  { value: 'BOOK_TRAVEL', label: 'Book Travel' },
] as const;

const META_BILLING_EVENT_OPTIONS = [
  { value: 'IMPRESSIONS', label: 'Impressions' },
  { value: 'LINK_CLICKS', label: 'Link Clicks' },
] as const;

const META_OPTIMIZATION_GOAL_OPTIONS = [
  { value: 'QUALITY_LEAD', label: 'Quality Lead' },
  { value: 'LEAD_GENERATION', label: 'Lead Generation' },
  { value: 'LINK_CLICKS', label: 'Link Clicks' },
  { value: 'LANDING_PAGE_VIEWS', label: 'Landing Page Views' },
] as const;

const META_DESTINATION_TYPE_OPTIONS = [
  { value: 'ON_AD', label: 'On Ad' },
  { value: 'WEBSITE', label: 'Website' },
] as const;

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
    if ([35].includes(id)) return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
    if ([12,16].includes(id)) return 'bg-purple-100 text-purple-700 border border-purple-200';
    if ([18,26].includes(id)) return 'bg-slate-100 text-slate-500 border border-slate-200';
  }
  const l = label.toLowerCase();
  if (['admitted','converted','enrolled'].includes(l)) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (['inquiry','new','contacted'].includes(l)) return 'bg-blue-100 text-blue-700 border border-blue-200';
  if (['hot lead','interested'].includes(l)) return 'bg-orange-100 text-orange-700 border border-orange-200';
  if (['warm lead','follow up','callback'].includes(l)) return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (['not interested','lost','dropped','dnc'].includes(l)) return 'bg-red-100 text-red-600 border border-red-200';
  if (['visited','pending'].includes(l)) return 'bg-purple-100 text-purple-700 border border-purple-200';
  return 'bg-gray-100 text-gray-500 border border-gray-200';
}

function hasLatestFollowUp(r: InquiryRow) { return Boolean(r.Discussion && r.Discussion !== 'NULL' && r.Discussion.trim()); }
function isPendingFollowUp(r: InquiryRow) {
  if (r.Status_id != null && [4, 12, 15].includes(r.Status_id)) return true;
  const l = String(r.StatusLabel || '').toLowerCase();
  return l.includes('follow up') || l.includes('pending') || l.includes('callback');
}
function statusBar(id: number | null, label: string) {
  if (id != null) {
    if ([7,10,27].includes(id)) return 'bg-emerald-400';
    if ([1,2,3].includes(id)) return 'bg-blue-400';
    if ([5,24].includes(id)) return 'bg-orange-400';
    if ([4,15,25].includes(id)) return 'bg-amber-400';
    if ([6,9,19,29,34].includes(id)) return 'bg-red-400';
    if ([35].includes(id)) return 'bg-indigo-400';
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
function campaignTier(cpl: number | null, avgCpl: number): { label: string; bg: string; text: string; border: string; bar: string } {
  if (cpl === null || cpl === 0) return { label: 'Awareness', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', bar: 'bg-slate-300' };
  if (avgCpl === 0) return { label: 'Active', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', bar: 'bg-blue-400' };
  const r = cpl / avgCpl;
  if (r <= 0.7) return { label: 'Efficient', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500' };
  if (r <= 1.2) return { label: 'On Track', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-blue-400' };
  if (r <= 1.8) return { label: 'Monitor', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-400' };
  return { label: 'High Cost', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', bar: 'bg-red-500' };
}
function freqTag(freq: number): string {
  if (freq < 1.5) return 'bg-blue-100 text-blue-700';
  if (freq < 2.5) return 'bg-emerald-100 text-emerald-700';
  if (freq < 3.5) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}
function ctrCls(ctr: number): string {
  if (ctr >= 2) return 'text-emerald-600 font-bold';
  if (ctr >= 1) return 'text-blue-600 font-semibold';
  if (ctr >= 0.5) return 'text-amber-600';
  return 'text-red-500';
}
function rowBg(id: number | null, label: string) {
  if (id != null) {
    if ([7,10,27].includes(id)) return 'bg-emerald-50/60 hover:bg-emerald-100/70';
    if ([1,2,3].includes(id)) return 'bg-blue-50/60 hover:bg-blue-100/70';
    if ([5,24].includes(id)) return 'bg-orange-50/60 hover:bg-orange-100/70';
    if ([4,15,25].includes(id)) return 'bg-amber-50/60 hover:bg-amber-100/70';
    if ([6,9,19,29,34].includes(id)) return 'bg-red-50/60 hover:bg-red-100/70';
    if ([35].includes(id)) return 'bg-indigo-50/60 hover:bg-indigo-100/70';
    if ([12,16].includes(id)) return 'bg-purple-50/60 hover:bg-purple-100/70';
    if ([18,26].includes(id)) return 'bg-slate-50/60 hover:bg-slate-100/70';
  }
  const l = label.toLowerCase();
  if (['admitted','converted','enrolled'].includes(l)) return 'bg-emerald-50/60 hover:bg-emerald-100/70';
  if (['inquiry','new','contacted'].includes(l)) return 'bg-blue-50/60 hover:bg-blue-100/70';
  if (['hot lead','interested'].includes(l)) return 'bg-orange-50/60 hover:bg-orange-100/70';
  if (['warm lead','follow up','callback'].includes(l)) return 'bg-amber-50/60 hover:bg-amber-100/70';
  if (['not interested','lost','dropped','dnc'].includes(l)) return 'bg-red-50/60 hover:bg-red-100/70';
  if (['visited','pending'].includes(l)) return 'bg-purple-50/60 hover:bg-purple-100/70';
  return 'hover:bg-slate-50/70';
}

function leadAge(dateStr: string | null): { label: string; cls: string; hours: number } {
  if (!dateStr) return { label: '—', cls: 'text-slate-300', hours: Infinity };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { label: '—', cls: 'text-slate-300', hours: Infinity };
  const hours = (Date.now() - d.getTime()) / 3600000;
  if (hours < 1) return { label: `${Math.round(hours * 60)}m`, cls: 'bg-emerald-100 text-emerald-700', hours };
  if (hours < 4) return { label: `${Math.round(hours)}h`, cls: 'bg-emerald-100 text-emerald-700', hours };
  if (hours < 24) return { label: `${Math.round(hours)}h`, cls: 'bg-amber-100 text-amber-700', hours };
  const days = Math.floor(hours / 24);
  if (days < 7) return { label: `${days}d`, cls: 'bg-red-100 text-red-600', hours };
  return { label: `${days}d`, cls: 'bg-red-200 text-red-700', hours };
}

function waLink(mobile: string | null, name: string | null, course: string | null): string {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const firstName = name?.split(' ')[0] || 'there';
  const msg = `Hi ${firstName}, thank you for your interest${course ? ` in ${course}` : ''} at SIT. Our counsellor will be in touch shortly to assist you!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
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
  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<Filters>({ trainings: [], sources: [], statusOptions: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [leadTag, setLeadTag] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [training, setTraining] = useState('');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [untouchedExpanded, setUntouchedExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [metaPerf, setMetaPerf] = useState<MetaPerformanceSummary | null>(null);
  const [metaPerfError, setMetaPerfError] = useState('');
  const [publishName, setPublishName] = useState('');
  const [publishObjective, setPublishObjective] = useState<string>('OUTCOME_LEADS');
  const [publishSpecialCategory, setPublishSpecialCategory] = useState<string>('NONE');
  const [publishPageId, setPublishPageId] = useState('');
  const [publishWebsiteUrl, setPublishWebsiteUrl] = useState('');
  const [publishWithForm, setPublishWithForm] = useState(false);
  const [publishWithCreative, setPublishWithCreative] = useState(false);
  const [publishWithAdSet, setPublishWithAdSet] = useState(false);
  const [publishWithAd, setPublishWithAd] = useState(false);
  const [publishFormName, setPublishFormName] = useState('');
  const [publishFormPrivacyUrl, setPublishFormPrivacyUrl] = useState('');
  const [publishFormFollowUpUrl, setPublishFormFollowUpUrl] = useState('');
  const [publishFormThankYouTitle, setPublishFormThankYouTitle] = useState('Thanks for your interest');
  const [publishFormThankYouBody, setPublishFormThankYouBody] = useState('We will contact you shortly.');
  const [publishFormQuestions, setPublishFormQuestions] = useState('FULL_NAME, EMAIL, PHONE');
  const [publishCreativeName, setPublishCreativeName] = useState('');
  const [publishCreativeMessage, setPublishCreativeMessage] = useState('');
  const [publishCreativeHeadline, setPublishCreativeHeadline] = useState('');
  const [publishCreativeImageHash, setPublishCreativeImageHash] = useState('');
  const [publishCreativeImageUrl, setPublishCreativeImageUrl] = useState('');
  const [publishCreativeCta, setPublishCreativeCta] = useState<string>('SIGN_UP');
  const [publishAdSetName, setPublishAdSetName] = useState('');
  const [publishAdSetBudget, setPublishAdSetBudget] = useState('10000');
  const [publishAdSetCountries, setPublishAdSetCountries] = useState('IN');
  const [publishAdSetBillingEvent, setPublishAdSetBillingEvent] = useState<string>('IMPRESSIONS');
  const [publishAdSetOptimizationGoal, setPublishAdSetOptimizationGoal] = useState<string>('QUALITY_LEAD');
  const [publishAdSetDestinationType, setPublishAdSetDestinationType] = useState<string>('ON_AD');
  const [publishAdSetStartTime, setPublishAdSetStartTime] = useState('');
  const [publishAdSetEndTime, setPublishAdSetEndTime] = useState('');
  const [publishAdName, setPublishAdName] = useState('');
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');
  const [publishHistory, setPublishHistory] = useState<MetaCampaignPublishLogRow[]>([]);
  const [publishHistoryLoading, setPublishHistoryLoading] = useState(true);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState('');
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
      if (source) p.set('source', source);
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
          sources: data.filters.sources ?? [],
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
  }, [dateFrom, dateTo, duplicatesOnly, leadTag, page, pageSize, search, source, status, training]);

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

  useEffect(() => {
    let cancelled = false;
    async function fetchPublishHistory() {
      setPublishHistoryLoading(true);
      try {
        const res = await fetch('/api/meta-ads/campaigns/publish?limit=8');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load Meta publish history');
        if (!cancelled) setPublishHistory(Array.isArray(data.rows) ? data.rows : []);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setPublishHistory([]);
        }
      } finally {
        if (!cancelled) setPublishHistoryLoading(false);
      }
    }
    fetchPublishHistory();
    return () => { cancelled = true; };
  }, []);

  const submitCampaignPublish = useCallback(async () => {
    if (!publishName.trim()) {
      setPublishError('Campaign name is required.');
      setPublishSuccess('');
      return;
    }

    setPublishBusy(true);
    setPublishError('');
    setPublishSuccess('');
    try {
      const specialAdCategories = publishSpecialCategory === 'NONE' ? ['NONE'] : [publishSpecialCategory];
      const questionKeys = publishFormQuestions
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);
      const countries = publishAdSetCountries
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);
      const res = await fetch('/api/meta-ads/campaigns/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: publishName.trim(),
          objective: publishObjective,
          status: 'PAUSED',
          specialAdCategories,
          pageId: publishPageId.trim() || null,
          websiteUrl: publishWebsiteUrl.trim() || null,
          instantForm: publishWithForm ? {
            name: publishFormName.trim(),
            privacyPolicyUrl: publishFormPrivacyUrl.trim(),
            followUpActionUrl: publishFormFollowUpUrl.trim() || null,
            thankYouTitle: publishFormThankYouTitle.trim() || null,
            thankYouBody: publishFormThankYouBody.trim() || null,
            questionKeys,
          } : null,
          creative: publishWithCreative ? {
            name: publishCreativeName.trim(),
            message: publishCreativeMessage.trim(),
            headline: publishCreativeHeadline.trim() || null,
            imageHash: publishCreativeImageHash.trim() || null,
            imageUrl: publishCreativeImageUrl.trim() || null,
            callToActionType: publishCreativeCta,
            linkUrl: publishWebsiteUrl.trim() || null,
          } : null,
          adSet: publishWithAdSet ? {
            name: publishAdSetName.trim(),
            dailyBudget: Number(publishAdSetBudget || 0),
            countries,
            billingEvent: publishAdSetBillingEvent,
            optimizationGoal: publishAdSetOptimizationGoal,
            destinationType: publishAdSetDestinationType,
            startTime: publishAdSetStartTime || null,
            endTime: publishAdSetEndTime || null,
            status: 'PAUSED',
          } : null,
          ad: publishWithAd ? {
            name: publishAdName.trim(),
            status: 'PAUSED',
          } : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish Meta campaign');

      const message = String(data?.campaign?.message || '').trim();
      const campaignName = String(data?.campaign?.campaignName || publishName.trim());
      const campaignId = String(data?.campaign?.campaignId || '').trim();
      setPublishSuccess(message || (campaignId ? `${campaignName} created as ${campaignId}.` : `${campaignName} created.`));
      setPublishName('');
      setPublishObjective('OUTCOME_LEADS');
      setPublishSpecialCategory('NONE');
      setPublishPageId('');
      setPublishWebsiteUrl('');
      setPublishWithForm(false);
      setPublishWithCreative(false);
      setPublishWithAdSet(false);
      setPublishWithAd(false);
      setPublishFormName('');
      setPublishFormPrivacyUrl('');
      setPublishFormFollowUpUrl('');
      setPublishFormThankYouTitle('Thanks for your interest');
      setPublishFormThankYouBody('We will contact you shortly.');
      setPublishFormQuestions('FULL_NAME, EMAIL, PHONE');
      setPublishCreativeName('');
      setPublishCreativeMessage('');
      setPublishCreativeHeadline('');
      setPublishCreativeImageHash('');
      setPublishCreativeImageUrl('');
      setPublishCreativeCta('SIGN_UP');
      setPublishAdSetName('');
      setPublishAdSetBudget('10000');
      setPublishAdSetCountries('IN');
      setPublishAdSetBillingEvent('IMPRESSIONS');
      setPublishAdSetOptimizationGoal('QUALITY_LEAD');
      setPublishAdSetDestinationType('ON_AD');
      setPublishAdSetStartTime('');
      setPublishAdSetEndTime('');
      setPublishAdName('');

      const historyRes = await fetch('/api/meta-ads/campaigns/publish?limit=8');
      const historyData = await historyRes.json().catch(() => ({}));
      if (historyRes.ok) {
        setPublishHistory(Array.isArray(historyData.rows) ? historyData.rows : []);
      }
    } catch (error: unknown) {
      setPublishError(error instanceof Error ? error.message : 'Failed to publish Meta campaign');
    } finally {
      setPublishBusy(false);
    }
  }, [publishAdName, publishAdSetBillingEvent, publishAdSetBudget, publishAdSetCountries, publishAdSetDestinationType, publishAdSetEndTime, publishAdSetName, publishAdSetOptimizationGoal, publishAdSetStartTime, publishCreativeCta, publishCreativeHeadline, publishCreativeImageHash, publishCreativeImageUrl, publishCreativeMessage, publishCreativeName, publishFormFollowUpUrl, publishFormName, publishFormPrivacyUrl, publishFormQuestions, publishFormThankYouBody, publishFormThankYouTitle, publishName, publishObjective, publishPageId, publishSpecialCategory, publishWebsiteUrl, publishWithAd, publishWithAdSet, publishWithCreative, publishWithForm]);

  const doSearch = () => { setPage(1); setFetchTrigger((t) => t + 1); };
  const doClear = () => {
    setSearch(''); setLeadTag(''); setSource(''); setStatus(''); setDateFrom(''); setDateTo('');
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

  const buildMetaReturnTo = useCallback(() => {
    const params = searchParams.toString();
    return params ? `/dashboard/meta-leads?${params}` : '/dashboard/meta-leads';
  }, [searchParams]);

  const handleConvertLead = useCallback(async (row: InquiryRow) => {
    if (!row.MetaLead_Id) return;

    const returnTo = encodeURIComponent(buildMetaReturnTo());
    if (row.Student_Id > 0) {
      router.push(`/dashboard/inquiry/add?editId=${row.Student_Id}&returnTo=${returnTo}`);
      return;
    }

    if (!canCreate) {
      setConvertError('You do not have permission to create inquiries from Meta leads.');
      return;
    }

    setConvertError('');
    setConvertingLeadId(row.MetaLead_Id);
    try {
      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(row.MetaLead_Id)}/convert`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to convert Meta lead');

      const inquiryId = Number(data?.lead?.Student_Id || 0);
      if (!inquiryId) {
        throw new Error('Meta lead converted but no inquiry id was returned');
      }

      router.push(`/dashboard/inquiry/add?editId=${inquiryId}&returnTo=${returnTo}`);
    } catch (error: unknown) {
      setConvertError(error instanceof Error ? error.message : 'Failed to convert Meta lead');
    } finally {
      setConvertingLeadId(null);
    }
  }, [buildMetaReturnTo, canCreate, router]);

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

  const allCampaigns = useMemo(
    () => (metaPerf?.campaigns || []).slice().sort((a, b) => b.leads - a.leads),
    [metaPerf]
  );

  const campaignStats = useMemo(() => {
    const withLeads = allCampaigns.filter(c => c.costPerLead !== null && c.costPerLead > 0);
    const avgCpl = withLeads.length > 0
      ? withLeads.reduce((s, c) => s + c.costPerLead!, 0) / withLeads.length
      : 0;
    const maxLeads = allCampaigns[0]?.leads || 1;
    return { avgCpl, maxLeads };
  }, [allCampaigns]);

  const untouchedRows = useMemo(
    () => rows
      .filter(r => !hasLatestFollowUp(r))
      .sort((a, b) => (a.Inquiry_Dt ?? '').localeCompare(b.Inquiry_Dt ?? '')),
    [rows]
  );

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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Outbound</p>
                  <h3 className="text-sm font-bold text-slate-800">Publish Meta Campaign</h3>
                  <p className="mt-1 text-xs text-slate-500">Creates a campaign and, when configured below, can also attach a lead form, creative, ad set, and ad in one publish flow.</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Creates paused</span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="block md:col-span-3">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Campaign Name</span>
                  <input
                    value={publishName}
                    onChange={(e) => setPublishName(e.target.value)}
                    placeholder="Example: SIT July 2026 Lead Campaign"
                    className={ctrl}
                    disabled={!canUpdate || publishBusy}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Page ID</span>
                  <input
                    value={publishPageId}
                    onChange={(e) => setPublishPageId(e.target.value)}
                    placeholder="Facebook Page ID"
                    className={ctrl}
                    disabled={!canUpdate || publishBusy}
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Website URL</span>
                  <input
                    value={publishWebsiteUrl}
                    onChange={(e) => setPublishWebsiteUrl(e.target.value)}
                    placeholder="https://sit.example.com/admissions"
                    className={ctrl}
                    disabled={!canUpdate || publishBusy}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Objective</span>
                  <select
                    value={publishObjective}
                    onChange={(e) => setPublishObjective(e.target.value)}
                    className={ctrl}
                    disabled={!canUpdate || publishBusy}
                  >
                    {META_PUBLISH_OBJECTIVES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">Special Ad Category</span>
                  <select
                    value={publishSpecialCategory}
                    onChange={(e) => setPublishSpecialCategory(e.target.value)}
                    className={ctrl}
                    disabled={!canUpdate || publishBusy}
                  >
                    {META_SPECIAL_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={submitCampaignPublish}
                    disabled={!canUpdate || publishBusy}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-[#2E3093] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#25277a] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {publishBusy ? 'Publishing…' : 'Publish Campaign'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {[
                  { checked: publishWithForm, setChecked: setPublishWithForm, label: 'Create Instant Form' },
                  { checked: publishWithCreative, setChecked: setPublishWithCreative, label: 'Create Creative' },
                  { checked: publishWithAdSet, setChecked: setPublishWithAdSet, label: 'Create Ad Set' },
                  { checked: publishWithAd, setChecked: setPublishWithAd, label: 'Create Ad' },
                ].map((item) => (
                  <label key={item.label} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.setChecked(e.target.checked)}
                      disabled={!canUpdate || publishBusy}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {publishWithForm && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Instant Form</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Form Name</span>
                      <input value={publishFormName} onChange={(e) => setPublishFormName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Privacy Policy URL</span>
                      <input value={publishFormPrivacyUrl} onChange={(e) => setPublishFormPrivacyUrl(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Follow-up Action URL</span>
                      <input value={publishFormFollowUpUrl} onChange={(e) => setPublishFormFollowUpUrl(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Thank-you Title</span>
                      <input value={publishFormThankYouTitle} onChange={(e) => setPublishFormThankYouTitle(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Questions</span>
                      <input value={publishFormQuestions} onChange={(e) => setPublishFormQuestions(e.target.value)} placeholder="FULL_NAME, EMAIL, PHONE" className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Thank-you Body</span>
                      <textarea value={publishFormThankYouBody} onChange={(e) => setPublishFormThankYouBody(e.target.value)} rows={3} className={`${ctrl} min-h-[84px]`} disabled={!canUpdate || publishBusy} />
                    </label>
                  </div>
                </div>
              )}

              {publishWithCreative && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Creative</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Creative Name</span>
                      <input value={publishCreativeName} onChange={(e) => setPublishCreativeName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">CTA</span>
                      <select value={publishCreativeCta} onChange={(e) => setPublishCreativeCta(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>
                        {META_CTA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Primary Text</span>
                      <textarea value={publishCreativeMessage} onChange={(e) => setPublishCreativeMessage(e.target.value)} rows={3} className={`${ctrl} min-h-[84px]`} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Headline</span>
                      <input value={publishCreativeHeadline} onChange={(e) => setPublishCreativeHeadline(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Image Hash</span>
                      <input value={publishCreativeImageHash} onChange={(e) => setPublishCreativeImageHash(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Image URL</span>
                      <input value={publishCreativeImageUrl} onChange={(e) => setPublishCreativeImageUrl(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                  </div>
                </div>
              )}

              {publishWithAdSet && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Ad Set</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Ad Set Name</span>
                      <input value={publishAdSetName} onChange={(e) => setPublishAdSetName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Daily Budget</span>
                      <input type="number" min="1" value={publishAdSetBudget} onChange={(e) => setPublishAdSetBudget(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Countries</span>
                      <input value={publishAdSetCountries} onChange={(e) => setPublishAdSetCountries(e.target.value)} placeholder="IN, AE" className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Billing Event</span>
                      <select value={publishAdSetBillingEvent} onChange={(e) => setPublishAdSetBillingEvent(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>
                        {META_BILLING_EVENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Optimization Goal</span>
                      <select value={publishAdSetOptimizationGoal} onChange={(e) => setPublishAdSetOptimizationGoal(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>
                        {META_OPTIMIZATION_GOAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Destination Type</span>
                      <select value={publishAdSetDestinationType} onChange={(e) => setPublishAdSetDestinationType(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>
                        {META_DESTINATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Start Time</span>
                      <input value={publishAdSetStartTime} onChange={(e) => setPublishAdSetStartTime(e.target.value)} placeholder="2026-06-10T09:00:00+0530" className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">End Time</span>
                      <input value={publishAdSetEndTime} onChange={(e) => setPublishAdSetEndTime(e.target.value)} placeholder="Optional" className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                  </div>
                </div>
              )}

              {publishWithAd && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Ad</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">Ad Name</span>
                      <input value={publishAdName} onChange={(e) => setPublishAdName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} />
                    </label>
                  </div>
                </div>
              )}

              {!canUpdate && (
                <p className="mt-3 text-xs text-amber-700">You can view campaign publish history, but campaign creation requires inquiry update permission.</p>
              )}
              {publishError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{publishError}</p>}
              {publishSuccess && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{publishSuccess}</p>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Recent Activity</p>
                  <h3 className="text-sm font-bold text-slate-800">Campaign Publish Log</h3>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {publishHistoryLoading ? (
                  [1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-50 animate-pulse" />)
                ) : publishHistory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">No published campaigns yet.</div>
                ) : publishHistory.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{item.campaignName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{item.objective} · {item.campaignId || 'pending id'}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.errorMessage ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.errorMessage ? 'Failed' : item.publishStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(item.createdAt)}</p>
                    {item.errorMessage && <p className="mt-1 text-[11px] text-red-600">{item.errorMessage}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <KpiCard label="Total Leads" value={pagination.total.toLocaleString()} accent="blue" />
            <KpiCard label="API Leads" value={perfLoading ? '—' : (metaPerf?.totals.leads ?? 0).toLocaleString()} accent="violet" loading={perfLoading} />
            <KpiCard label="Reach" value={perfLoading ? '—' : (metaPerf?.totals.reach ?? 0).toLocaleString()} accent="slate" loading={perfLoading} />
            <KpiCard label="Spend" value={perfLoading ? '—' : `₹${(metaPerf?.totals.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} accent="orange" loading={perfLoading} />
            <KpiCard label="CTR" value={perfLoading ? '—' : `${(metaPerf?.totals.ctr ?? 0).toFixed(2)}%`} accent="emerald" loading={perfLoading} />
            <KpiCard label="Cost / Lead" value={perfLoading ? '—' : (metaPerf?.totals.cpl == null ? '—' : `₹${metaPerf.totals.cpl.toFixed(0)}`)} accent="rose" loading={perfLoading} />
          </div>

          {/* Campaign Analytics — full width */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Meta Ads</p>
                <h3 className="text-sm font-bold text-slate-800">Campaign Analytics</h3>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Legend */}
                {[
                  { dot: 'bg-emerald-500', label: 'Efficient (CPL ≤70% avg)' },
                  { dot: 'bg-blue-400',    label: 'On Track' },
                  { dot: 'bg-amber-400',   label: 'Monitor' },
                  { dot: 'bg-red-500',     label: 'High Cost' },
                  { dot: 'bg-slate-300',   label: 'Awareness (no leads)' },
                ].map(({ dot, label }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <span className="text-[10px] text-slate-500">{label}</span>
                  </span>
                ))}
                <span className="text-[10px] bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-500 font-medium">
                  {allCampaigns.length} campaign{allCampaigns.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              {perfLoading ? (
                <div className="p-4 space-y-2">
                  {[1,2,3,4,5].map((i) => <div key={i} className="h-9 bg-slate-50 rounded-lg animate-pulse" />)}
                </div>
              ) : metaPerfError ? (
                <div className="p-4 text-xs text-amber-700 bg-amber-50 m-3 rounded-lg border border-amber-100">{metaPerfError}</div>
              ) : allCampaigns.length === 0 ? (
                <div className="p-8 text-xs text-slate-400 text-center">No campaign data available</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
                      <th className="text-left px-3 py-2.5 font-bold w-6">#</th>
                      <th className="text-left px-3 py-2.5 font-bold min-w-[180px]">Campaign</th>
                      <th className="text-center px-3 py-2.5 font-bold">Tier</th>
                      <th className="text-right px-3 py-2.5 font-bold">
                        <span className="block">Unique Reach</span>
                        <span className="block text-[9px] normal-case tracking-normal text-slate-300 font-normal">Freq = Imp ÷ Reach</span>
                      </th>
                      <th className="text-right px-3 py-2.5 font-bold">Impressions</th>
                      <th className="text-right px-3 py-2.5 font-bold">Clicks</th>
                      <th className="text-right px-3 py-2.5 font-bold">CTR</th>
                      <th className="text-right px-3 py-2.5 font-bold">Spend</th>
                      <th className="text-right px-3 py-2.5 font-bold">Leads</th>
                      <th className="text-right px-3 py-2.5 font-bold">CPL</th>
                      <th className="text-right px-3 py-2.5 font-bold">
                        <span className="block">Prediction</span>
                        <span className="block text-[9px] normal-case tracking-normal text-slate-300 font-normal">leads per ₹10k more</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allCampaigns.map((c, i) => {
                      const tier = campaignTier(c.costPerLead, campaignStats.avgCpl);
                      const freq = c.reach > 0 ? c.impressions / c.reach : 0;
                      const projected = c.costPerLead && c.costPerLead > 0 ? Math.round(10000 / c.costPerLead) : null;
                      const convRate = c.clicks > 0 ? ((c.leads / c.clicks) * 100) : 0;
                      const leadPct = Math.round((c.leads / campaignStats.maxLeads) * 100);
                      return (
                        <tr key={c.campaignId || i} className={`border-b border-slate-100 transition-colors group ${tier.bg} hover:brightness-95`}>
                          <td className="px-3 py-2.5 relative">
                            <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${tier.bar} rounded-r`} />
                            <span className="text-[10px] font-bold text-slate-400 tabular-nums">{i + 1}</span>
                          </td>
                          <td className="px-3 py-2.5 min-w-[180px]">
                            <div className="font-semibold text-slate-800 truncate max-w-[220px]" title={c.campaignName || c.campaignId || '—'}>
                              {c.campaignName || c.campaignId || '—'}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className="flex-1 h-1 bg-slate-200 rounded-full">
                                <div className={`h-1 ${tier.bar} rounded-full transition-all`} style={{ width: `${leadPct}%` }} />
                              </div>
                              {convRate > 0 && (
                                <span className="text-[9px] text-slate-400 whitespace-nowrap tabular-nums">{convRate.toFixed(1)}% conv</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.bg} ${tier.text} ${tier.border}`}>
                              {tier.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="tabular-nums font-semibold text-slate-700">{c.reach.toLocaleString()}</div>
                            {freq > 0 && (
                              <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${freqTag(freq)}`}>
                                {freq.toFixed(1)}× freq
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{c.impressions.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{c.clicks.toLocaleString()}</td>
                          <td className={`px-3 py-2.5 text-right tabular-nums ${ctrCls(c.ctr)}`}>{c.ctr.toFixed(2)}%</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">₹{c.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2E3093]">{c.leads}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {c.costPerLead != null
                              ? <span className={`font-semibold ${tier.text}`}>₹{c.costPerLead.toFixed(0)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {projected != null ? (
                              <div>
                                <span className="font-bold text-slate-700 tabular-nums">~{projected}</span>
                                <span className="text-slate-400 text-[10px]"> leads</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">no data</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {metaPerf && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200 text-[10px] font-bold text-slate-600">
                        <td colSpan={3} className="px-3 py-2.5">Totals</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{metaPerf.totals.reach.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{metaPerf.totals.impressions.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{metaPerf.totals.clicks.toLocaleString()}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${ctrCls(metaPerf.totals.ctr)}`}>{metaPerf.totals.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">₹{metaPerf.totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#2E3093]">{metaPerf.totals.leads}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {metaPerf.totals.cpl != null ? `₹${metaPerf.totals.cpl.toFixed(0)}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {metaPerf.totals.cpl
                            ? `~${Math.round(10000 / metaPerf.totals.cpl)} leads`
                            : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>

            {/* Reach bifurcation legend */}
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center gap-4 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Frequency guide:</span>
              {[
                { cls: 'bg-blue-100 text-blue-700',     label: '< 1.5× Fresh audience' },
                { cls: 'bg-emerald-100 text-emerald-700', label: '1.5–2.5× Optimal' },
                { cls: 'bg-amber-100 text-amber-700',   label: '2.5–3.5× Saturating' },
                { cls: 'bg-red-100 text-red-600',       label: '> 3.5× Ad fatigue' },
              ].map(({ cls, label }) => (
                <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{label}</span>
              ))}
            </div>
          </div>

          {/* Lead Status + Quality */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
            <select value={source} onChange={(e) => setSource(e.target.value)} className={`${ctrl} w-[150px]`}>
              <option value="">All Sources</option>
              {filters.sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
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

          {/* Untouched Leads Banner */}
          {!loading && untouchedRows.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setUntouchedExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-red-100/60 transition-colors"
              >
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-bold text-red-800 text-sm flex-1">Untouched Leads — No Follow-Up Logged</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-800 tabular-nums">
                  {untouchedRows.length} of {rows.length}
                </span>
                <svg className={`w-4 h-4 text-red-500 transition-transform ${untouchedExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {untouchedExpanded && (
                <div className="overflow-x-auto border-t border-red-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-red-700 bg-red-100/60 border-b border-red-200">
                        <th className="text-left py-1.5 px-3 font-bold">Name</th>
                        <th className="text-left py-1.5 px-3 font-bold">Mobile</th>
                        <th className="text-left py-1.5 px-3 font-bold">Course</th>
                        <th className="text-left py-1.5 px-3 font-bold">Campaign</th>
                        <th className="text-left py-1.5 px-3 font-bold">Status</th>
                        <th className="text-center py-1.5 px-3 font-bold">Age</th>
                        <th className="text-center py-1.5 px-3 font-bold">Reach Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {untouchedRows.map(row => {
                        const age = leadAge(row.Inquiry_Dt);
                        const wa = waLink(row.Present_Mobile, row.Student_Name, row.CourseName);
                        return (
                          <tr key={row.MetaLead_Id || row.Student_Id} className="border-b border-red-100 hover:bg-red-50/60 transition-colors">
                            <td className="py-1.5 px-3 font-semibold text-slate-800">{formatName(row.Student_Name)}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-600">{row.Present_Mobile || '—'}</td>
                            <td className="py-1.5 px-3 text-slate-500 max-w-[120px]"><span className="truncate block">{row.CourseName || '—'}</span></td>
                            <td className="py-1.5 px-3 text-slate-500 max-w-[140px]"><span className="truncate block">{row.MetaCampaignName || '—'}</span></td>
                            <td className="py-1.5 px-3">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusPill(row.Status_id, row.StatusLabel)}`}>
                                {row.StatusLabel}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              {age.label !== '—' && (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${age.cls}`}>{age.label}</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {wa && (
                                  <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                  </a>
                                )}
                                {row.Present_Mobile && (
                                  <a href={`tel:${row.Present_Mobile}`} title="Call"
                                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                  </a>
                                )}
                                {row.MetaLead_Id && (
                                  <button title="Log follow-up"
                                    onClick={() => router.push(`/dashboard/meta-leads/${encodeURIComponent(row.MetaLead_Id)}#followups`)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-[#2E3093] hover:bg-[#2E3093]/5 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Leads Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {convertError && (
              <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                {convertError}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-bold border border-slate-200 w-8">#</th>
                    <th className="text-left py-2.5 px-3 font-bold border border-slate-200">Lead</th>
                    <th className="text-left py-2.5 px-3 font-bold border border-slate-200">Training</th>
                    <th className="text-left py-2.5 px-3 font-bold border border-slate-200">Campaign</th>
                    <th className="text-left py-2.5 px-3 font-bold border border-slate-200">Mobile</th>
                    <th className="text-left py-2.5 px-3 font-bold border border-slate-200">Email</th>
                    <th className="text-left py-2.5 px-3 font-bold border border-slate-200">Date</th>
                    <th className="text-center py-2.5 px-3 font-bold border border-slate-200">Status</th>
                    <th className="text-center py-2.5 px-3 font-bold border border-slate-200 min-w-[148px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td key={j} className="py-2.5 px-3 border border-slate-100"><div className="h-3.5 bg-slate-50 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center border border-slate-100">
                        <div className="text-slate-300 text-2xl mb-2">○</div>
                        <div className="text-xs text-slate-400 font-medium">No Meta leads found</div>
                        <div className="text-xs text-slate-300 mt-1">Try adjusting your filters</div>
                      </td>
                    </tr>
                  ) : rows.map((row, index) => {
                    const attended = hasLatestFollowUp(row);
                    const textCls = isPendingFollowUp(row) ? '[&>td]:text-purple-700' : attended ? '[&>td]:text-slate-800' : '[&>td]:text-red-500';
                    return (
                    <tr
                      key={`${row.Student_Id}-${row.Email || row.Present_Mobile || row.Student_Name}-${row.Inquiry_Dt || index}-${index}`}
                      className={`transition-colors group ${rowBg(row.Status_id, row.StatusLabel)} ${textCls}`}
                    >
                      <td className="py-2 px-3 font-mono tabular-nums text-[10px] border border-slate-100 relative pl-5">
                        <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${statusBar(row.Status_id, row.StatusLabel)} rounded-r`} />
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>
                      <td className="py-2 px-3 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${avatarColor(row.Student_Name)}`}>
                            {getInitials(row.Student_Name)}
                          </div>
                          <span className="font-semibold text-slate-700 whitespace-nowrap">{formatName(row.Student_Name)}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-500 border border-slate-100 max-w-[110px]">
                        <span className="truncate block" title={row.CourseName || undefined}>{row.CourseName || '—'}</span>
                      </td>
                      <td className="py-2 px-3 border border-slate-100 max-w-[130px]">
                        <span className="truncate block font-medium text-slate-700" title={row.MetaCampaignName || undefined}>{row.MetaCampaignName || '—'}</span>
                      </td>
                      <td className="py-2 px-3 border border-slate-100 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                        {row.Present_Mobile || '—'}
                      </td>
                      <td className="py-2 px-3 border border-slate-100 text-slate-500 text-[11px]">
                        <span className="truncate block max-w-[160px]">{row.Email || '—'}</span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap border border-slate-100">
                        <div className="text-slate-500 text-[11px]">{formatDate(row.Inquiry_Dt)}</div>
                        {(() => { const a = leadAge(row.Inquiry_Dt); return a.label !== '—' ? <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${a.cls}`}>{a.label} ago</span> : null; })()}
                      </td>
                      <td className="py-2 px-3 text-center border border-slate-100">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${statusPill(row.Status_id, row.StatusLabel)}`}>
                          {row.StatusLabel}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center border border-slate-100">
                        <div className="flex items-center justify-center gap-1">
                          {/* WhatsApp */}
                          {waLink(row.Present_Mobile, row.Student_Name, row.CourseName) && (
                            <a
                              href={waLink(row.Present_Mobile, row.Student_Name, row.CourseName)}
                              target="_blank" rel="noopener noreferrer" title="WhatsApp"
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-green-600 hover:bg-green-50 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          )}
                          {/* Call */}
                          {row.Present_Mobile && (
                            <a href={`tel:${row.Present_Mobile}`} title="Call"
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </a>
                          )}
                          <button
                            type="button"
                            title={row.Student_Id > 0 ? 'Open linked inquiry' : 'Convert to inquiry'}
                            onClick={() => void handleConvertLead(row)}
                            disabled={
                              !row.MetaLead_Id ||
                              (row.Student_Id > 0 ? !canUpdate : !canCreate) ||
                              convertingLeadId === row.MetaLead_Id
                            }
                            className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                              row.MetaLead_Id && (row.Student_Id > 0 ? canUpdate : canCreate)
                                ? 'border border-[#2E3093]/20 bg-[#2E3093]/5 text-[#2E3093] hover:bg-[#2E3093]/10'
                                : 'border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            {convertingLeadId === row.MetaLead_Id ? 'Converting…' : row.Student_Id > 0 ? 'Open Inquiry' : 'Convert'}
                          </button>
                          <button
                            title="Open lead details"
                            onClick={() => row.MetaLead_Id && router.push(`/dashboard/meta-leads/${encodeURIComponent(row.MetaLead_Id)}`)}
                            disabled={!canView || !row.MetaLead_Id}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                              canView && row.MetaLead_Id
                                ? 'text-slate-300 hover:text-[#2E3093] hover:bg-[#2E3093]/5 group-hover:text-slate-400'
                                : 'text-slate-200 cursor-not-allowed'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50">
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
                      ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      : 'border-slate-100 bg-white text-slate-300 cursor-not-allowed'
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
                      ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      : 'border-slate-100 bg-white text-slate-300 cursor-not-allowed'
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
