'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { FilterBar, GhostBtn, PageHeader } from '@/components/ui/PageHeader';

interface InquiryRow {
  MetaLead_Id: string;
  Student_Id: number;
  StudentMaster_Id: number;
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
  ApplicantEmailSentAt?: string | null;
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

interface MetaBatchRecommendationRow {
  scoreDate: string;
  batchId: number;
  batchCode: string;
  courseId: number | null;
  courseName: string;
  startDate: string | null;
  endDate: string | null;
  daysToStart: number;
  maxStudents: number;
  studentsAdmitted: number;
  seatGap: number;
  gapRatio: number;
  urgency: number;
  leadToAdmissionRate: number;
  estimatedCpl: number | null;
  efficiencyScore: number;
  valueScore: number;
  priorityScore: number;
  recommendedBudget: number;
  adAngle: string;
  effectivePlan?: string[];
}

interface MetaBatchRecommendationResponse {
  source: 'persisted' | 'live';
  formula: string;
  scoreDate: string;
  totalBudget: number;
  recommendations: MetaBatchRecommendationRow[];
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }
interface Filters { trainings: string[]; sources: string[]; statusOptions: { id: number; label: string }[]; }

interface LeadRowDraft {
  studentName: string;
  courseName: string;
  mobile: string;
  email: string;
  discussion: string;
  statusId: number | null;
}

type SpreadsheetColumnKey =
  | 'rowNo'
  | 'lead'
  | 'training'
  | 'campaign'
  | 'source'
  | 'mobile'
  | 'email'
  | 'date'
  | 'age'
  | 'status'
  | 'questions'
  | 'actions';

const SPREADSHEET_DEFAULT_COLUMN_WIDTHS: Record<SpreadsheetColumnKey, number> = {
  rowNo: 52,
  lead: 230,
  training: 170,
  campaign: 190,
  source: 150,
  mobile: 140,
  email: 220,
  date: 140,
  age: 115,
  status: 130,
  questions: 320,
  actions: 180,
};

const SPREADSHEET_MIN_COLUMN_WIDTH = 80;
const SPREADSHEET_ROW_HEIGHT = 64;
const SPREADSHEET_OVERSCAN_ROWS = 12;
const REGULAR_PAGE_SIZE = 100;
const EXCEL_PAGE_SIZE = 150;
const SHEET_PAGE_SIZE = 300;

function toBulletEditorValue(raw: string | null | undefined): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const parts = text.includes('\n') ? text.split('\n') : text.split('|');
  return parts
    .map((part) => part.trim().replace(/^[-*•]\s+/, ''))
    .filter(Boolean)
    .join('\n');
}

function fromBulletEditorValue(raw: string | null | undefined): string | null {
  const lines = String(raw || '')
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•]\s+/, ''))
    .filter(Boolean);
  if (!lines.length) return null;
  return lines.join('\n');
}

interface SpreadsheetTextCellProps {
  value: string;
  leadId: string;
  field: 'studentName' | 'courseName' | 'mobile' | 'email';
  disabled: boolean;
  onDraftChange: (leadId: string, field: 'studentName' | 'courseName' | 'mobile' | 'email', value: string) => void;
}

const SpreadsheetTextCell = memo(function SpreadsheetTextCell({ value, leadId, field, disabled, onDraftChange }: SpreadsheetTextCellProps) {
  return (
    <input
      value={value}
      onChange={(e) => onDraftChange(leadId, field, e.target.value)}
      disabled={disabled}
      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
});

interface SpreadsheetDiscussionCellProps {
  value: string;
  leadId: string;
  disabled: boolean;
  onDraftChange: (leadId: string, field: 'discussion', value: string) => void;
}

const SpreadsheetDiscussionCell = memo(function SpreadsheetDiscussionCell({ value, leadId, disabled, onDraftChange }: SpreadsheetDiscussionCellProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onDraftChange(leadId, 'discussion', e.target.value)}
      disabled={disabled}
      rows={3}
      placeholder="Person replies / answered questions"
      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[10px] leading-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
});

interface SpreadsheetStatusCellProps {
  value: number | null;
  leadId: string;
  disabled: boolean;
  statusOptions: { id: number; label: string }[];
  onDraftChange: (leadId: string, field: 'statusId', value: number | null) => void;
}

const SpreadsheetStatusCell = memo(function SpreadsheetStatusCell({ value, leadId, disabled, statusOptions, onDraftChange }: SpreadsheetStatusCellProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onDraftChange(leadId, 'statusId', e.target.value ? Number(e.target.value) : null)}
      disabled={disabled}
      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] disabled:bg-slate-50 disabled:text-slate-400"
    >
      <option value="">Select status</option>
      {statusOptions.map((s) => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  );
});

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

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '₹0';
  return `₹${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPercentFromRatio(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
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

function emailSentRowBg(sentAt: string | null | undefined): string | null {
  return sentAt ? 'bg-blue-50/80 hover:bg-blue-100/80' : null;
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
  const [kpiExpanded, setKpiExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'regular' | 'excel' | 'sheet'>('regular');
  const [page, setPage] = useState(1);
  const pageSize = viewMode === 'sheet' ? SHEET_PAGE_SIZE : viewMode === 'excel' ? EXCEL_PAGE_SIZE : REGULAR_PAGE_SIZE;
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [metaPerf, setMetaPerf] = useState<MetaPerformanceSummary | null>(null);
  const [metaPerfError, setMetaPerfError] = useState('');
  const [metaReco, setMetaReco] = useState<MetaBatchRecommendationResponse | null>(null);
  const [metaRecoError, setMetaRecoError] = useState('');
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [rowDrafts, setRowDrafts] = useState<Record<string, LeadRowDraft>>({});
  const [columnWidths, setColumnWidths] = useState<Record<SpreadsheetColumnKey, number>>(SPREADSHEET_DEFAULT_COLUMN_WIDTHS);
  const [columnResize, setColumnResize] = useState<{
    key: SpreadsheetColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportHeight, setTableViewportHeight] = useState(640);
  const [convertError, setConvertError] = useState('');
  const oauthStatus = searchParams.get('metaOAuth');
  const oauthMessage = searchParams.get('metaOAuthMessage');
  const oauthPages = searchParams.get('metaOAuthPages');
  const oauthUser = searchParams.get('metaOAuthUser');
  const isSpreadsheetView = viewMode !== 'regular';

  const getSpreadsheetColStyle = useCallback((key: SpreadsheetColumnKey) => {
    if (!isSpreadsheetView) return undefined;
    const width = columnWidths[key] ?? SPREADSHEET_DEFAULT_COLUMN_WIDTHS[key];
    return {
      width,
      minWidth: width,
      maxWidth: width,
    };
  }, [columnWidths, isSpreadsheetView]);

  const beginColumnResize = useCallback((event: ReactMouseEvent<HTMLButtonElement>, key: SpreadsheetColumnKey) => {
    if (!isSpreadsheetView) return;
    event.preventDefault();
    event.stopPropagation();
    const width = columnWidths[key] ?? SPREADSHEET_DEFAULT_COLUMN_WIDTHS[key];
    setColumnResize({ key, startX: event.clientX, startWidth: width });
  }, [columnWidths, isSpreadsheetView]);

  useEffect(() => {
    if (!columnResize) return;
    const onMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - columnResize.startX;
      const nextWidth = Math.max(SPREADSHEET_MIN_COLUMN_WIDTH, Math.round(columnResize.startWidth + delta));
      setColumnWidths((prev) => ({ ...prev, [columnResize.key]: nextWidth }));
    };
    const onMouseUp = () => setColumnResize(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [columnResize]);

  const renderColumnResizeHandle = useCallback((key: SpreadsheetColumnKey) => {
    if (!isSpreadsheetView) return null;
    return (
      <button
        type="button"
        aria-label="Resize column"
        onMouseDown={(event) => beginColumnResize(event, key)}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-transparent hover:border-slate-300"
      />
    );
  }, [beginColumnResize, isSpreadsheetView]);

  useEffect(() => {
    if (!isSpreadsheetView) return;
    const el = tableViewportRef.current;
    if (!el) return;
    setTableViewportHeight(Math.max(240, el.clientHeight || 640));

    const onResize = () => {
      const curr = tableViewportRef.current;
      if (!curr) return;
      setTableViewportHeight(Math.max(240, curr.clientHeight || 640));
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isSpreadsheetView]);

  const onTableScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!isSpreadsheetView) return;
    setTableScrollTop(event.currentTarget.scrollTop);
  }, [isSpreadsheetView]);

  useEffect(() => {
    if (!isSpreadsheetView) return;
    setTableScrollTop(0);
    if (tableViewportRef.current) tableViewportRef.current.scrollTop = 0;
  }, [isSpreadsheetView, page, fetchTrigger]);

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
    setPage(1);
  }, [viewMode]);

  useEffect(() => {
    const nextDrafts: Record<string, LeadRowDraft> = {};
    for (const row of rows) {
      if (!row.MetaLead_Id) continue;
      nextDrafts[row.MetaLead_Id] = {
        studentName: row.Student_Name || '',
        courseName: row.CourseName || '',
        mobile: row.Present_Mobile || '',
        email: row.Email || '',
        discussion: toBulletEditorValue(row.Discussion),
        statusId: row.Status_id ?? null,
      };
    }
    setRowDrafts(nextDrafts);
  }, [rows]);

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
    async function fetchRecommendations() {
      setMetaRecoError('');
      try {
        const res = await fetch('/api/meta-ads/recommendations?source=persisted&limit=6');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load Meta batch recommendations');
        if (!cancelled) setMetaReco(data);
      } catch (error: unknown) {
        if (!cancelled) {
          setMetaReco(null);
          setMetaRecoError(error instanceof Error ? error.message : 'Failed to load Meta batch recommendations');
        }
      }
    }

    fetchRecommendations();
    return () => { cancelled = true; };
  }, []);

  const doSearch = () => { setPage(1); setFetchTrigger((t) => t + 1); };
  const doClear = () => {
    setSearch('');
    setLeadTag('');
    setSource('');
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

  const updateRowDraft = useCallback((leadId: string, patch: Partial<LeadRowDraft>) => {
    setRowDrafts((prev) => {
      const current = prev[leadId] || { studentName: '', courseName: '', mobile: '', email: '', discussion: '', statusId: null };
      return { ...prev, [leadId]: { ...current, ...patch } };
    });
  }, []);

  const updateRowDraftTextField = useCallback((leadId: string, field: 'studentName' | 'courseName' | 'mobile' | 'email' | 'discussion', value: string) => {
    updateRowDraft(leadId, { [field]: value });
  }, [updateRowDraft]);

  const updateRowDraftStatusField = useCallback((leadId: string, field: 'statusId', value: number | null) => {
    updateRowDraft(leadId, { [field]: value });
  }, [updateRowDraft]);

  const saveExcelRow = useCallback(async (row: InquiryRow) => {
    if (!canUpdate || !row.MetaLead_Id) return;
    const draft = rowDrafts[row.MetaLead_Id];
    if (!draft) return;

    setConvertError('');
    setSavingLeadId(row.MetaLead_Id);
    try {
      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(row.MetaLead_Id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: draft.studentName,
          courseName: draft.courseName,
          mobile: draft.mobile,
          email: draft.email,
          discussion: fromBulletEditorValue(draft.discussion),
          statusId: draft.statusId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save lead changes');

      const updated = data?.lead as InquiryRow | undefined;
      if (!updated) throw new Error('Lead updated but response was empty');

      setRows((prev) => prev.map((item) => (item.MetaLead_Id === row.MetaLead_Id ? { ...item, ...updated } : item)));
    } catch (error: unknown) {
      setConvertError(error instanceof Error ? error.message : 'Failed to save lead changes');
    } finally {
      setSavingLeadId(null);
    }
  }, [canUpdate, rowDrafts]);
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

  const virtualWindow = useMemo(() => {
    if (!isSpreadsheetView || rows.length === 0) {
      return {
        start: 0,
        end: rows.length,
        topSpacer: 0,
        bottomSpacer: 0,
      };
    }

    const visibleCount = Math.max(20, Math.ceil(tableViewportHeight / SPREADSHEET_ROW_HEIGHT));
    const start = Math.max(0, Math.floor(tableScrollTop / SPREADSHEET_ROW_HEIGHT) - SPREADSHEET_OVERSCAN_ROWS);
    const end = Math.min(rows.length, start + visibleCount + (SPREADSHEET_OVERSCAN_ROWS * 2));
    const topSpacer = start * SPREADSHEET_ROW_HEIGHT;
    const bottomSpacer = Math.max(0, (rows.length - end) * SPREADSHEET_ROW_HEIGHT);

    return { start, end, topSpacer, bottomSpacer };
  }, [isSpreadsheetView, rows.length, tableScrollTop, tableViewportHeight]);

  const visibleRows = useMemo(
    () => (isSpreadsheetView ? rows.slice(virtualWindow.start, virtualWindow.end) : rows),
    [isSpreadsheetView, rows, virtualWindow.end, virtualWindow.start],
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
              <GhostBtn href="/dashboard/meta-leads/outbound">Outbound</GhostBtn>
              <GhostBtn href="/dashboard/inquiry">Inquiry Listing</GhostBtn>
              <GhostBtn onClick={exportCsv}>Export CSV</GhostBtn>
            </>}
          />

          {viewMode !== 'sheet' && (
            <>
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

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(46,48,147,0.16),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#2E3093]/70">Outbound</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Open the dedicated outbound publishing page</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">The full Meta campaign builder now lives on its own page so this lead listing stays focused on operations, follow-up, and conversion work.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <GhostBtn href="/dashboard/meta-leads/outbound">Go To Outbound</GhostBtn>
                </div>
              </div>
            </div>
            <div className="grid gap-3 px-5 py-4 md:grid-cols-3">
              {[
                { title: 'Dedicated builder', text: 'Campaign, ad set, creative, form, and ad are now handled on a separate page.' },
                { title: 'Cleaner lead ops', text: 'This page stays focused on lead filters, conversion, and performance review.' },
                { title: 'Safer publish flow', text: 'Outbound publishing still submits the Meta stack in paused mode for review.' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Row */}
          {/* KPI Bar — collapsible */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setKpiExpanded(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors text-left"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 shrink-0">Performance</span>
              <div className="flex items-center gap-4 flex-1 flex-wrap min-w-0 overflow-hidden">
                {[
                  { dot: 'bg-blue-500',    label: 'Leads',     value: pagination.total.toLocaleString() },
                  { dot: 'bg-violet-500',  label: 'API Leads', value: perfLoading ? '...' : (metaPerf?.totals.leads ?? 0).toLocaleString() },
                  { dot: 'bg-slate-400',   label: 'Reach',     value: perfLoading ? '...' : (metaPerf?.totals.reach ?? 0).toLocaleString() },
                  { dot: 'bg-orange-500',  label: 'Spend',     value: perfLoading ? '...' : `₹${(metaPerf?.totals.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                  { dot: 'bg-emerald-500', label: 'CTR',       value: perfLoading ? '...' : `${(metaPerf?.totals.ctr ?? 0).toFixed(2)}%` },
                  { dot: 'bg-rose-500',    label: 'CPL',       value: perfLoading ? '...' : (metaPerf?.totals.cpl == null ? '—' : `₹${metaPerf.totals.cpl.toFixed(0)}`) },
                ].map(({ dot, label, value }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{value}</span>
                    <span className="text-[10px] text-slate-400">{label}</span>
                  </span>
                ))}
              </div>
              <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${kpiExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {kpiExpanded && (
              <div className="px-4 pb-3 pt-2 border-t border-slate-100 grid grid-cols-3 sm:grid-cols-6 gap-2">
                <KpiCard label="Total Leads" value={pagination.total.toLocaleString()} accent="blue" />
                <KpiCard label="API Leads" value={perfLoading ? '—' : (metaPerf?.totals.leads ?? 0).toLocaleString()} accent="violet" loading={perfLoading} />
                <KpiCard label="Reach" value={perfLoading ? '—' : (metaPerf?.totals.reach ?? 0).toLocaleString()} accent="slate" loading={perfLoading} />
                <KpiCard label="Spend" value={perfLoading ? '—' : `₹${(metaPerf?.totals.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} accent="orange" loading={perfLoading} />
                <KpiCard label="CTR" value={perfLoading ? '—' : `${(metaPerf?.totals.ctr ?? 0).toFixed(2)}%`} accent="emerald" loading={perfLoading} />
                <KpiCard label="Cost / Lead" value={perfLoading ? '—' : (metaPerf?.totals.cpl == null ? '—' : `₹${metaPerf.totals.cpl.toFixed(0)}`)} accent="rose" loading={perfLoading} />
              </div>
            )}
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


          {/* Batch recommendation card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Meta Planning</p>
                <h3 className="text-sm font-bold text-slate-800">Batch Budget Recommendations</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {metaReco?.formula || 'score = (0.35*gap + 0.25*urgency + 0.20*conversion + 0.10*efficiency + 0.10*value) * previous_ads_comparison * batchwise_multiplier'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Source</p>
                <p className="text-xs font-semibold text-slate-700">{metaReco?.source === 'persisted' ? 'Daily Snapshot' : 'Live Calculation'}</p>
                {metaReco?.scoreDate && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Scored on {formatDate(metaReco.scoreDate)}</p>
                )}
              </div>
            </div>

            {metaRecoError ? (
              <div className="m-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">{metaRecoError}</div>
            ) : !metaReco ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}
              </div>
            ) : metaReco.recommendations.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">No upcoming batches found for recommendation.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
                      <th className="text-left px-3 py-2 font-bold">Batch</th>
                      <th className="text-left px-3 py-2 font-bold">Course</th>
                      <th className="text-right px-3 py-2 font-bold">Days</th>
                      <th className="text-right px-3 py-2 font-bold">Seat Gap</th>
                      <th className="text-right px-3 py-2 font-bold">Priority</th>
                      <th className="text-right px-3 py-2 font-bold">Budget</th>
                      <th className="text-left px-3 py-2 font-bold min-w-[260px]">Ad Angle</th>
                      <th className="text-left px-3 py-2 font-bold min-w-[340px]">Effective Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metaReco.recommendations.map((row) => (
                      <tr key={`${row.scoreDate}-${row.batchId}`} className="border-b border-slate-100 hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{row.batchCode}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.courseName}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{row.daysToStart}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {Math.round(row.seatGap)} / {Math.round(row.maxStudents || 0)}
                          <span className="ml-1 text-[10px] text-slate-400">({formatPercentFromRatio(row.gapRatio)})</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#2E3093]">{formatPercentFromRatio(row.priorityScore)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">{formatCurrency(row.recommendedBudget)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.adAngle}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {row.effectivePlan && row.effectivePlan.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-4">
                              {row.effectivePlan.map((step, idx) => (
                                <li key={`${row.batchId}-plan-${idx}`}>{step}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400">Plan will be generated after next score run.</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}

          {/* Leads Section */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Leads</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 tabular-nums">{pagination.total.toLocaleString()} total</span>
                  {!loading && untouchedRows.length > 0 && (
                    <><span className="text-slate-300 text-[10px]">·</span>
                    <span className="text-[11px] font-semibold text-red-500 tabular-nums">{untouchedRows.length} untouched</span></>
                  )}
                  {!loading && (rows.length - untouchedRows.length) > 0 && (
                    <><span className="text-slate-300 text-[10px]">·</span>
                    <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">{(rows.length - untouchedRows.length)} touched</span></>
                  )}
                  {!loading && rows.filter(r => r.IsDuplicateLead).length > 0 && (
                    <><span className="text-slate-300 text-[10px]">·</span>
                    <span className="text-[11px] font-semibold text-amber-600 tabular-nums">{rows.filter(r => r.IsDuplicateLead).length} dupes</span></>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 mr-2">
                <button
                  type="button"
                  onClick={() => setViewMode('regular')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    viewMode === 'regular'
                      ? 'bg-[#2E3093] text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('excel')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    viewMode === 'excel'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Excel View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('sheet')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    viewMode === 'sheet'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Spreadsheet
                </button>
              </div>
              <span className="tabular-nums">Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
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
          {viewMode !== 'sheet' && !loading && untouchedRows.length > 0 && (
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
            <div
              ref={tableViewportRef}
              onScroll={onTableScroll}
              className={`${viewMode !== 'regular' ? 'overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)]' : 'overflow-x-auto'} ${columnResize ? 'cursor-col-resize select-none' : ''}`}
            >
              <table className={`w-full border-collapse ${viewMode !== 'regular' ? 'text-[10px] table-fixed' : ''}`}>
                <thead>
                  <tr className={`text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 ${(viewMode === 'excel' || viewMode === 'sheet') ? 'sticky top-0 z-20' : ''}`}>
                    <th style={getSpreadsheetColStyle('rowNo')} className={`text-left font-bold border border-slate-200 w-8 ${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2.5 px-3'} ${viewMode === 'sheet' ? 'sticky left-0 z-30 bg-slate-50' : ''}`}>
                      <div className="relative"># {renderColumnResizeHandle('rowNo')}</div>
                    </th>
                    <th style={getSpreadsheetColStyle('lead')} className={`text-left font-bold border border-slate-200 ${viewMode !== 'regular' ? 'py-1.5 px-2 min-w-[180px]' : 'py-2.5 px-3'}`}>
                      <div className="relative">Lead {renderColumnResizeHandle('lead')}</div>
                    </th>
                    <th style={getSpreadsheetColStyle('training')} className={`text-left font-bold border border-slate-200 ${viewMode !== 'regular' ? 'py-1.5 px-2 min-w-[140px]' : 'py-2.5 px-3'}`}>
                      <div className="relative">Training {renderColumnResizeHandle('training')}</div>
                    </th>
                    <th style={getSpreadsheetColStyle('campaign')} className={`text-left font-bold border border-slate-200 ${viewMode !== 'regular' ? 'py-1.5 px-2 min-w-[160px]' : 'py-2.5 px-3'}`}>
                      <div className="relative">Campaign {renderColumnResizeHandle('campaign')}</div>
                    </th>
                    {viewMode !== 'regular' && <th style={getSpreadsheetColStyle('source')} className="text-left py-1.5 px-2 font-bold border border-slate-200 min-w-[140px]"><div className="relative">Source {renderColumnResizeHandle('source')}</div></th>}
                    <th style={getSpreadsheetColStyle('mobile')} className={`text-left font-bold border border-slate-200 ${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2.5 px-3'}`}>
                      <div className="relative">Mobile {renderColumnResizeHandle('mobile')}</div>
                    </th>
                    <th style={getSpreadsheetColStyle('email')} className={`text-left font-bold border border-slate-200 ${viewMode !== 'regular' ? 'py-1.5 px-2 min-w-[180px]' : 'py-2.5 px-3'}`}>
                      <div className="relative">Email {renderColumnResizeHandle('email')}</div>
                    </th>
                    <th style={getSpreadsheetColStyle('date')} className={`text-left font-bold border border-slate-200 ${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2.5 px-3'}`}>
                      <div className="relative">Date {renderColumnResizeHandle('date')}</div>
                    </th>
                    {viewMode !== 'regular' && <th style={getSpreadsheetColStyle('age')} className="text-left py-1.5 px-2 font-bold border border-slate-200 min-w-[110px]"><div className="relative">Age {renderColumnResizeHandle('age')}</div></th>}
                    <th style={getSpreadsheetColStyle('status')} className={`text-center font-bold border border-slate-200 ${viewMode !== 'regular' ? 'py-1.5 px-2 min-w-[110px]' : 'py-2.5 px-3'}`}>
                      <div className="relative">Status {renderColumnResizeHandle('status')}</div>
                    </th>
                    {viewMode !== 'regular' && <th style={getSpreadsheetColStyle('questions')} className="text-left py-1.5 px-2 font-bold border border-slate-200 min-w-[220px]"><div className="relative">Questions Replied {renderColumnResizeHandle('questions')}</div></th>}
                    <th style={getSpreadsheetColStyle('actions')} className={`text-center font-bold border border-slate-200 min-w-[148px] ${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2.5 px-3'}`}>
                      <div className="relative">Actions {renderColumnResizeHandle('actions')}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: viewMode !== 'regular' ? 12 : 9 }).map((__, j) => (
                          <td key={j} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2.5 px-3'} border border-slate-100`}><div className="h-3.5 bg-slate-50 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={viewMode !== 'regular' ? 12 : 9} className="py-16 text-center border border-slate-100">
                        <div className="text-slate-300 text-2xl mb-2">○</div>
                        <div className="text-xs text-slate-400 font-medium">No Meta leads found</div>
                        <div className="text-xs text-slate-300 mt-1">Try adjusting your filters</div>
                      </td>
                    </tr>
                  ) : (
                    <>
                  {isSpreadsheetView && virtualWindow.topSpacer > 0 && (
                    <tr>
                      <td colSpan={12} className="border-0 p-0">
                        <div style={{ height: `${virtualWindow.topSpacer}px` }} />
                      </td>
                    </tr>
                  )}
                  {visibleRows.map((row, localIndex) => {
                    const index = isSpreadsheetView ? virtualWindow.start + localIndex : localIndex;
                    const attended = hasLatestFollowUp(row);
                    const textCls = isPendingFollowUp(row) ? '[&>td]:text-purple-700' : attended ? '[&>td]:text-slate-800' : '[&>td]:text-red-500';
                    const sentEmail = Boolean(row.ApplicantEmailSentAt);
                    const bgCls = emailSentRowBg(row.ApplicantEmailSentAt) || rowBg(row.Status_id, row.StatusLabel);
                    return (
                    <tr
                      key={`${row.Student_Id}-${row.Email || row.Present_Mobile || row.Student_Name}-${row.Inquiry_Dt || index}-${index}`}
                      className={`transition-colors group ${bgCls} ${textCls}`}
                    >
                      <td style={getSpreadsheetColStyle('rowNo')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} font-mono tabular-nums text-[10px] border border-slate-100 relative ${viewMode !== 'regular' ? 'pl-4' : 'pl-5'} ${viewMode === 'sheet' ? 'sticky left-0 z-10 bg-white' : ''}`}>
                        <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${statusBar(row.Status_id, row.StatusLabel)} rounded-r`} />
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>
                      <td style={getSpreadsheetColStyle('lead')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} border border-slate-100`}>
                        <div className="flex items-center gap-2">
                          {viewMode === 'regular' && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${sentEmail ? 'bg-blue-100 text-blue-700' : avatarColor(row.Student_Name)}`}>
                              {getInitials(row.Student_Name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            {viewMode !== 'regular' ? (
                              <SpreadsheetTextCell
                                value={rowDrafts[row.MetaLead_Id]?.studentName ?? row.Student_Name ?? ''}
                                leadId={row.MetaLead_Id}
                                field="studentName"
                                disabled={!canUpdate || savingLeadId === row.MetaLead_Id}
                                onDraftChange={updateRowDraftTextField}
                              />
                            ) : (
                              <span className={`font-semibold whitespace-nowrap ${sentEmail ? 'text-blue-700' : 'text-slate-700'}`}>{formatName(row.Student_Name)}</span>
                            )}
                            <div className="mt-0.5 text-[10px] text-slate-400 whitespace-nowrap">
                              {row.Student_Id > 0 ? `Inquiry #${row.Student_Id}` : 'Inquiry not linked'}
                              {' • '}
                              {row.StudentMaster_Id > 0 ? `Student Master #${row.StudentMaster_Id}` : 'Student master not linked'}
                            </div>
                            {sentEmail && viewMode === 'regular' && (
                              <div className="mt-0.5">
                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                                  Auto emailed
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={getSpreadsheetColStyle('training')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} text-slate-500 border border-slate-100 max-w-[140px]`}>
                        {viewMode !== 'regular' ? (
                          <SpreadsheetTextCell
                            value={rowDrafts[row.MetaLead_Id]?.courseName ?? row.CourseName ?? ''}
                            leadId={row.MetaLead_Id}
                            field="courseName"
                            disabled={!canUpdate || savingLeadId === row.MetaLead_Id}
                            onDraftChange={updateRowDraftTextField}
                          />
                        ) : (
                          <span className="truncate block" title={row.CourseName || undefined}>{row.CourseName || '—'}</span>
                        )}
                      </td>
                      <td style={getSpreadsheetColStyle('campaign')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} border border-slate-100 max-w-[160px]`}>
                        <span className="truncate block font-medium text-slate-700" title={row.MetaCampaignName || undefined}>{row.MetaCampaignName || '—'}</span>
                      </td>
                      {viewMode !== 'regular' && (
                        <td style={getSpreadsheetColStyle('source')} className="py-1.5 px-2 border border-slate-100 text-slate-600 whitespace-nowrap">
                          {row.Inquiry_From || row.MetaFormName || '—'}
                        </td>
                      )}
                      <td style={getSpreadsheetColStyle('mobile')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} border border-slate-100 font-mono text-slate-700 text-[11px] whitespace-nowrap`}>
                        {viewMode !== 'regular' ? (
                          <SpreadsheetTextCell
                            value={rowDrafts[row.MetaLead_Id]?.mobile ?? row.Present_Mobile ?? ''}
                            leadId={row.MetaLead_Id}
                            field="mobile"
                            disabled={!canUpdate || savingLeadId === row.MetaLead_Id}
                            onDraftChange={updateRowDraftTextField}
                          />
                        ) : (
                          row.Present_Mobile || '—'
                        )}
                      </td>
                      <td style={getSpreadsheetColStyle('email')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} border border-slate-100 text-slate-500 text-[11px]`}>
                        {viewMode !== 'regular' ? (
                          <SpreadsheetTextCell
                            value={rowDrafts[row.MetaLead_Id]?.email ?? row.Email ?? ''}
                            leadId={row.MetaLead_Id}
                            field="email"
                            disabled={!canUpdate || savingLeadId === row.MetaLead_Id}
                            onDraftChange={updateRowDraftTextField}
                          />
                        ) : (
                          <span className="truncate block max-w-[160px]">{row.Email || '—'}</span>
                        )}
                      </td>
                      <td style={getSpreadsheetColStyle('date')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} whitespace-nowrap border border-slate-100`}>
                        <div className="text-slate-500 text-[11px]">{formatDate(row.Inquiry_Dt)}</div>
                        {viewMode === 'regular' && (() => { const a = leadAge(row.Inquiry_Dt); return a.label !== '—' ? <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${a.cls}`}>{a.label} ago</span> : null; })()}
                      </td>
                      {viewMode !== 'regular' && (
                        <td style={getSpreadsheetColStyle('age')} className="py-1.5 px-2 border border-slate-100 text-[11px] text-slate-600 whitespace-nowrap">
                          {(() => { const a = leadAge(row.Inquiry_Dt); return a.label !== '—' ? `${a.label} ago` : '—'; })()}
                        </td>
                      )}
                      <td style={getSpreadsheetColStyle('status')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} text-center border border-slate-100`}>
                        {viewMode !== 'regular' ? (
                          <SpreadsheetStatusCell
                            value={rowDrafts[row.MetaLead_Id]?.statusId ?? null}
                            leadId={row.MetaLead_Id}
                            disabled={!canUpdate || savingLeadId === row.MetaLead_Id}
                            statusOptions={filters.statusOptions}
                            onDraftChange={updateRowDraftStatusField}
                          />
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${statusPill(row.Status_id, row.StatusLabel)}`}>
                            {row.StatusLabel}
                          </span>
                        )}
                      </td>
                      {viewMode !== 'regular' && (
                        <td style={getSpreadsheetColStyle('questions')} className="py-1 px-1.5 border border-slate-100 text-[10px] text-slate-600 min-w-[220px] max-w-[280px]">
                          <SpreadsheetDiscussionCell
                            value={rowDrafts[row.MetaLead_Id]?.discussion ?? toBulletEditorValue(row.Discussion)}
                            leadId={row.MetaLead_Id}
                            disabled={!canUpdate || savingLeadId === row.MetaLead_Id}
                            onDraftChange={updateRowDraftTextField}
                          />
                        </td>
                      )}
                      <td style={getSpreadsheetColStyle('actions')} className={`${viewMode !== 'regular' ? 'py-1.5 px-2' : 'py-2 px-3'} text-center border border-slate-100`}>
                        <div className="flex items-center justify-center gap-1">
                          {viewMode !== 'regular' && (
                            <button
                              type="button"
                              onClick={() => void saveExcelRow(row)}
                              disabled={!canUpdate || !row.MetaLead_Id || savingLeadId === row.MetaLead_Id}
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                                canUpdate && row.MetaLead_Id
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
                              }`}
                            >
                              {savingLeadId === row.MetaLead_Id ? 'Saving…' : 'Save'}
                            </button>
                          )}
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
                  {isSpreadsheetView && virtualWindow.bottomSpacer > 0 && (
                    <tr>
                      <td colSpan={12} className="border-0 p-0">
                        <div style={{ height: `${virtualWindow.bottomSpacer}px` }} />
                      </td>
                    </tr>
                  )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50">
              <div className="text-xs text-slate-400">
                Showing <span className="font-semibold text-slate-600">{fromRow.toLocaleString()}–{toRow.toLocaleString()}</span> of <span className="font-semibold text-slate-600">{pagination.total.toLocaleString()}</span> leads
                <span className="ml-2 text-slate-300">•</span>
                <span className="ml-2 text-slate-500">{viewMode === 'sheet' ? 'Spreadsheet mode (1000 rows/page)' : viewMode === 'excel' ? 'Excel view (500 rows/page)' : 'Standard view (100 rows/page)'}</span>
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
