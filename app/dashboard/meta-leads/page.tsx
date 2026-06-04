'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
  City?: string | null;
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
  confidenceScore: number;
  recommendedBudget: number;
  adAngle: string;
  effectivePlanStructured?: {
    objective: 'urgency' | 'conversion' | 'awareness';
    audience: string;
    creativeTheme: string;
    cta: string;
    followUpSlaMinutes: number;
    cplGuardrail: number | null;
    dailyBudget: number;
  };
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
  city: string;
  discussion: string;
  statusId: number | null;
}

type DraftTextField = 'studentName' | 'courseName' | 'mobile' | 'email' | 'city' | 'discussion';

const PAGE_SIZE = 100;

function toBulletEditorValue(raw: string | null | undefined): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const parts = text.includes('\n') ? text.split('\n') : text.split('|');
  return parts.map((p) => p.trim().replace(/^[-*•]\s+/, '')).filter(Boolean).join('\n');
}

function fromBulletEditorValue(raw: string | null | undefined): string | null {
  const lines = String(raw || '').split('\n').map((l) => l.trim().replace(/^[-*•]\s+/, '')).filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

function getCityFromLeadFields(fields: Record<string, string | null> | undefined): string | null {
  if (!fields) return null;
  const rawCity = fields.city ?? fields.location ?? fields.your_location ?? null;
  const city = String(rawCity ?? '').trim();
  return city || null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(String(dateStr).trim());
    if (isNaN(d.getTime())) return '—';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return '—'; }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(String(dateStr).trim());
    if (isNaN(d.getTime())) return '—';
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
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

function confidenceBadge(score: number | null | undefined): { label: string; cls: string } {
  const s = Number.isFinite(score as number) ? (score as number) : 0;
  if (s >= 0.75) return { label: 'High', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
  if (s >= 0.5) return { label: 'Medium', cls: 'bg-amber-100 text-amber-700 border border-amber-200' };
  return { label: 'Low', cls: 'bg-rose-100 text-rose-700 border border-rose-200' };
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

// Maps FALLBACK_STATUSES IDs to semantic color groups.
// Emerald = admitted/positive; Blue = new/inquiry; Orange = interested/hot;
// Amber = follow-up/pending/on-hold; Red = cancelled/lost; Purple = demo/prospective;
// Gray = duplicate; Slate = transfer/misc
function statusColor(id: number | null, label: string): 'emerald' | 'blue' | 'orange' | 'amber' | 'red' | 'purple' | 'gray' | 'slate' {
  if (id != null) {
    // Admitted / positive outcomes
    if ([3, 6, 8, 34, 40].includes(id)) return 'emerald';
    // New / inquiry / online
    if ([0, 13, 15, 19, 26, 29].includes(id)) return 'blue';
    // Interested / hot / batch started
    if ([2, 5].includes(id)) return 'orange';
    // Follow up / on hold / fees pending / document pending
    if ([1, 10, 23, 24].includes(id)) return 'amber';
    // Cancelled / not interested / left / refund
    if ([4, 7, 9, 35].includes(id)) return 'red';
    // Demo / prospective / walk-in demo
    if ([12, 16, 17].includes(id)) return 'purple';
    // Duplicate / neutral
    if ([27].includes(id)) return 'gray';
    // Transfer / need-based / misc
    if ([25, 18, 26, 33].includes(id)) return 'slate';
  }
  const l = label.toLowerCase();
  if (l.includes('admitted') || l.includes('enrolled') || l.includes('confirm') || l.includes('complete')) return 'emerald';
  if (l.includes('not interested') || l.includes('cancel') || l.includes('lost') || l.includes('dropped') || l.includes('dnc')) return 'red';
  if (l.includes('interested') || l.includes('hot')) return 'orange';
  if (l.includes('follow') || l.includes('pending') || l.includes('hold') || l.includes('callback')) return 'amber';
  if (l.includes('demo') || l.includes('prospective') || l.includes('walk')) return 'purple';
  if (l.includes('duplicate')) return 'gray';
  if (l.includes('inquiry') || l.includes('new') || l.includes('online')) return 'blue';
  return 'gray';
}

function statusPill(id: number | null, label: string) {
  const c = statusColor(id, label);
  if (c === 'emerald') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (c === 'blue')    return 'bg-blue-100 text-blue-700 border border-blue-200';
  if (c === 'orange')  return 'bg-orange-100 text-orange-700 border border-orange-200';
  if (c === 'amber')   return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (c === 'red')     return 'bg-red-100 text-red-600 border border-red-200';
  if (c === 'purple')  return 'bg-purple-100 text-purple-700 border border-purple-200';
  if (c === 'slate')   return 'bg-slate-100 text-slate-500 border border-slate-200';
  return 'bg-gray-100 text-gray-500 border border-gray-200';
}

function statusBar(id: number | null, label: string) {
  const c = statusColor(id, label);
  if (c === 'emerald') return 'bg-emerald-400';
  if (c === 'blue')    return 'bg-blue-400';
  if (c === 'orange')  return 'bg-orange-400';
  if (c === 'amber')   return 'bg-amber-400';
  if (c === 'red')     return 'bg-red-400';
  if (c === 'purple')  return 'bg-purple-400';
  if (c === 'slate')   return 'bg-slate-400';
  return 'bg-slate-300';
}

function rowBg(id: number | null, label: string) {
  const c = statusColor(id, label);
  if (c === 'emerald') return 'bg-emerald-50/60 hover:bg-emerald-100/70';
  if (c === 'blue')    return 'bg-blue-50/60 hover:bg-blue-100/70';
  if (c === 'orange')  return 'bg-orange-50/60 hover:bg-orange-100/70';
  if (c === 'amber')   return 'bg-amber-50/60 hover:bg-amber-100/70';
  if (c === 'red')     return 'bg-red-50/60 hover:bg-red-100/70';
  if (c === 'purple')  return 'bg-purple-50/60 hover:bg-purple-100/70';
  if (c === 'slate')   return 'bg-slate-50/60 hover:bg-slate-100/70';
  return 'hover:bg-slate-50/70';
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

function hasLatestFollowUp(r: InquiryRow) { return Boolean(r.Discussion && r.Discussion !== 'NULL' && r.Discussion.trim()); }
function isPendingFollowUp(r: InquiryRow) {
  if (r.Status_id != null && [4, 12, 15].includes(r.Status_id)) return true;
  const l = String(r.StatusLabel || '').toLowerCase();
  return l.includes('follow up') || l.includes('pending') || l.includes('callback');
}

function leadAge(dateStr: string | null): { label: string; cls: string } {
  if (!dateStr) return { label: '—', cls: 'text-slate-300' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { label: '—', cls: 'text-slate-300' };
  const hours = (Date.now() - d.getTime()) / 3600000;
  if (hours < 1) return { label: `${Math.round(hours * 60)}m`, cls: 'bg-emerald-100 text-emerald-700' };
  if (hours < 4) return { label: `${Math.round(hours)}h`, cls: 'bg-emerald-100 text-emerald-700' };
  if (hours < 24) return { label: `${Math.round(hours)}h`, cls: 'bg-amber-100 text-amber-700' };
  const days = Math.floor(hours / 24);
  return { label: `${days}d`, cls: days < 7 ? 'bg-red-100 text-red-600' : 'bg-red-200 text-red-700' };
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
  const colors = ['bg-violet-100 text-violet-700','bg-sky-100 text-sky-700','bg-teal-100 text-teal-700','bg-rose-100 text-rose-700','bg-amber-100 text-amber-700','bg-indigo-100 text-indigo-700'];
  const t = String(name ?? '').trim();
  return t ? colors[t.charCodeAt(0) % colors.length] : colors[0];
}

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors w-full';

// --- Inline editable cell ---
interface InlineCellProps {
  value: string;
  leadId: string;
  field: DraftTextField;
  disabled: boolean;
  placeholder?: string;
  onDraftChange: (leadId: string, field: DraftTextField, value: string) => void;
}
const InlineCell = memo(function InlineCell({ value, leadId, field, disabled, placeholder, onDraftChange }: InlineCellProps) {
  return (
    <input
      value={value}
      onChange={(e) => onDraftChange(leadId, field, e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
});

// --- KPI card ---
function KpiCard({ label, value, accent, loading }: { label: string; value: string; accent?: string; loading?: boolean }) {
  const dot: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', orange: 'bg-orange-500', violet: 'bg-violet-500', rose: 'bg-rose-500', slate: 'bg-slate-400' };
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-2.5">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[accent ?? 'slate'] ?? 'bg-slate-400'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 truncate">{label}</p>
        {loading ? <div className="mt-0.5 h-4 w-12 bg-slate-100 rounded animate-pulse" /> : <p className="text-sm font-bold text-slate-800 leading-tight">{value}</p>}
      </div>
    </div>
  );
}

// --- Follow Up Modal ---
interface FollowUpModalProps {
  row: InquiryRow;
  draft: LeadRowDraft;
  canUpdate: boolean;
  saving: boolean;
  onDraftChange: (leadId: string, field: DraftTextField, value: string) => void;
  onSave: (row: InquiryRow) => void;
  onClose: () => void;
}

function FollowUpModal({ row, draft, canUpdate, saving, onDraftChange, onSave, onClose }: FollowUpModalProps) {
  const bullets = draft.discussion.split('\n').map((l) => l.trim()).filter(Boolean);
  const [newNote, setNewNote] = useState('');

  function addBullet() {
    const note = newNote.trim();
    if (!note) return;
    const today = formatDate(new Date().toISOString());
    const entry = `[${today}] ${note}`;
    const updated = draft.discussion ? `${draft.discussion}\n${entry}` : entry;
    onDraftChange(row.MetaLead_Id, 'discussion', updated);
    setNewNote('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2E3093]/60">Follow Up</p>
            <h3 className="text-sm font-bold text-slate-900">{formatName(row.Student_Name)}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 max-h-[46vh] overflow-y-auto space-y-2">
          {bullets.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No follow-up notes yet. Add one below.</p>
          ) : (
            bullets.map((bullet, i) => {
              const dateMatch = bullet.match(/^\[([^\]]+)\]\s*(.*)/);
              const date = dateMatch?.[1] ?? null;
              const text = dateMatch?.[2] ?? bullet;
              return (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E3093] shrink-0 mt-1.5" />
                  <div className="min-w-0 flex-1">
                    {date && <span className="inline-block mb-1 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">{date}</span>}
                    <p className="text-xs text-slate-700 leading-5">{text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {canUpdate && (
          <div className="border-t border-slate-100 px-5 py-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Add Follow-Up Note</p>
            <div className="flex gap-2">
              <input value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBullet()} placeholder="Type a note — today's date will be added automatically…" className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400" />
              <button type="button" onClick={addBullet} disabled={!newNote.trim()} className="px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#252880] disabled:bg-slate-200 disabled:text-slate-400 transition-colors">Add</button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => { onSave(row); onClose(); }} disabled={saving} className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:bg-slate-200 transition-colors">{saving ? 'Saving…' : 'Save Notes'}</button>
            </div>
          </div>
        )}
        {!canUpdate && (
          <div className="border-t border-slate-100 px-5 py-3 flex justify-end">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Meta Data Modal ---
interface MetaDataModalProps { row: InquiryRow; onClose: () => void; }

function MetaDataModal({ row, onClose }: MetaDataModalProps) {
  const fields = [
    { label: 'Campaign', value: row.MetaCampaignName || '—' },
    { label: 'Form Name', value: row.MetaFormName || '—' },
    { label: 'Source', value: row.Inquiry_From || '—' },
    { label: 'Inquiry Type', value: row.Inquiry_Type || '—' },
    { label: 'Duplicate', value: row.IsDuplicateLead ? 'Yes — duplicate entry detected' : 'No' },
    { label: 'Email Sent', value: row.ApplicantEmailSentAt ? `Sent on ${formatDate(row.ApplicantEmailSentAt)}` : 'Not sent' },
  ];
  const tags = row.LeadTags ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2A6BB5]/60">Form Meta Data</p>
            <h3 className="text-sm font-bold text-slate-900">{formatName(row.Student_Name)}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 pt-0.5">{label}</span>
              <span className="text-xs text-slate-700 leading-5 break-words">{value}</span>
            </div>
          ))}
          {tags.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 pt-0.5">Form Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-[#2E3093]/8 border border-[#2E3093]/20 px-2.5 py-0.5 text-[10px] font-semibold text-[#2E3093]">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {row.MetaLead_Id && (
            <div className="flex items-start gap-3">
              <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 pt-0.5">Lead ID</span>
              <span className="text-[10px] font-mono text-slate-500 break-all">{row.MetaLead_Id}</span>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-5 py-3 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---
export default function MetaLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canView, canCreate, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');

  const [activeTab, setActiveTab] = useState<'analytics' | 'leads'>('analytics');
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<Filters>({ trainings: [], sources: [], statusOptions: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [training, setTraining] = useState('');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [metaPerf, setMetaPerf] = useState<MetaPerformanceSummary | null>(null);
  const [metaPerfError, setMetaPerfError] = useState('');
  const [metaReco, setMetaReco] = useState<MetaBatchRecommendationResponse | null>(null);
  const [metaRecoError, setMetaRecoError] = useState('');
  const [kpiExpanded, setKpiExpanded] = useState(false);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [rowDrafts, setRowDrafts] = useState<Record<string, LeadRowDraft>>({});
  const [convertError, setConvertError] = useState('');
  const [untouchedExpanded, setUntouchedExpanded] = useState(false);
  const [followUpModalLeadId, setFollowUpModalLeadId] = useState<string | null>(null);
  const [metaDataModalLeadId, setMetaDataModalLeadId] = useState<string | null>(null);

  const oauthStatus = searchParams.get('metaOAuth');
  const oauthMessage = searchParams.get('metaOAuthMessage');
  const oauthPages = searchParams.get('metaOAuthPages');
  const oauthUser = searchParams.get('metaOAuthUser');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) p.set('search', search);
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
      setPagination(data.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
      if (data.filters) setFilters({ trainings: data.filters.trainings ?? [], sources: data.filters.sources ?? [], statusOptions: data.filters.statusOptions ?? [] });
    } catch (error) {
      console.error(error);
      setRows([]);
      setPagination({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, duplicatesOnly, page, search, source, status, training]);

  useEffect(() => { fetchData(); }, [fetchData, fetchTrigger]);

  useEffect(() => {
    const nextDrafts: Record<string, LeadRowDraft> = {};
    for (const row of rows) {
      if (!row.MetaLead_Id) continue;
      nextDrafts[row.MetaLead_Id] = {
        studentName: row.Student_Name || '',
        courseName: row.CourseName || '',
        mobile: row.Present_Mobile || '',
        email: row.Email || '',
        city: row.City || '',
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
        if (!cancelled) { setMetaPerf(null); setMetaPerfError(error instanceof Error ? error.message : 'Failed'); }
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
        if (!res.ok) throw new Error(data?.error || 'Failed to load recommendations');
        if (!cancelled) setMetaReco(data);
      } catch (error: unknown) {
        if (!cancelled) { setMetaReco(null); setMetaRecoError(error instanceof Error ? error.message : 'Failed'); }
      }
    }
    fetchRecommendations();
    return () => { cancelled = true; };
  }, []);

  const doSearch = () => { setPage(1); setFetchTrigger((t) => t + 1); };
  const doClear = () => {
    setSearch(''); setSource(''); setStatus(''); setDateFrom(''); setDateTo(''); setTraining(''); setDuplicatesOnly(false);
    setPage(1); setFetchTrigger((t) => t + 1);
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const hdrs = ['Name','Qualification','Mobile','City','Email','Campaign','Form','Tags','Duplicate','Status','Date','Time'];
    const csv = [hdrs.join(',')].concat(rows.map((r) => [
      r.Student_Name, r.CourseName, r.Present_Mobile, r.City, r.Email,
      r.MetaCampaignName, r.MetaFormName, r.LeadTags?.join(' | '),
      r.IsDuplicateLead ? 'Yes' : 'No', r.StatusLabel, formatDate(r.Inquiry_Dt), formatTime(r.Inquiry_Dt),
    ].map(esc).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `meta-leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const buildMetaReturnTo = useCallback(() => {
    const params = searchParams.toString();
    return params ? `/dashboard/meta-leads?${params}` : '/dashboard/meta-leads';
  }, [searchParams]);

  const handleConvertLead = useCallback(async (row: InquiryRow) => {
    if (!row.MetaLead_Id) return;
    const returnTo = encodeURIComponent(buildMetaReturnTo());
    if (row.Student_Id > 0) { router.push(`/dashboard/inquiry/add?editId=${row.Student_Id}&returnTo=${returnTo}`); return; }
    if (!canCreate) { setConvertError('You do not have permission to create inquiries from Meta leads.'); return; }
    setConvertError('');
    setConvertingLeadId(row.MetaLead_Id);
    try {
      const draft = rowDrafts[row.MetaLead_Id];
      if (draft && canUpdate) {
        const patchRes = await fetch(`/api/meta-ads/leads/${encodeURIComponent(row.MetaLead_Id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: draft.studentName,
            courseName: draft.courseName,
            mobile: draft.mobile,
            email: draft.email,
            city: draft.city,
            discussion: fromBulletEditorValue(draft.discussion),
            statusId: draft.statusId,
          }),
        });
        const patchData = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok) throw new Error(patchData?.error || 'Failed to save lead changes before conversion');
      }

      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(row.MetaLead_Id)}/convert`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to convert Meta lead');
      const inquiryId = Number(data?.lead?.Student_Id || 0);
      if (!inquiryId) throw new Error('Meta lead converted but no inquiry id was returned');
      // Update the row in local state immediately so the button switches to "Open Inquiry"
      setRows((prev) => prev.map((r) =>
        r.MetaLead_Id === row.MetaLead_Id ? { ...r, Student_Id: inquiryId } : r
      ));
      // Bust the Next.js router cache so returning to this page fetches fresh data
      router.refresh();
      router.push(`/dashboard/inquiry/add?editId=${inquiryId}&returnTo=${returnTo}`);
    } catch (error: unknown) {
      setConvertError(error instanceof Error ? error.message : 'Failed to convert Meta lead');
    } finally {
      setConvertingLeadId(null);
    }
  }, [buildMetaReturnTo, canCreate, canUpdate, rowDrafts, router]);

  const updateRowDraft = useCallback((leadId: string, patch: Partial<LeadRowDraft>) => {
    setRowDrafts((prev) => {
      const cur = prev[leadId] || { studentName: '', courseName: '', mobile: '', email: '', city: '', discussion: '', statusId: null };
      return { ...prev, [leadId]: { ...cur, ...patch } };
    });
  }, []);

  const updateRowDraftTextField = useCallback((leadId: string, field: DraftTextField, value: string) => {
    updateRowDraft(leadId, { [field]: value });
  }, [updateRowDraft]);

  const updateRowDraftStatus = useCallback((leadId: string, value: number | null) => {
    updateRowDraft(leadId, { statusId: value });
  }, [updateRowDraft]);

  const saveRow = useCallback(async (row: InquiryRow) => {
    if (!row.MetaLead_Id) return;
    if (!canUpdate) {
      setConvertError('You do not have permission to update Meta leads.');
      return;
    }
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
          city: draft.city,
          discussion: fromBulletEditorValue(draft.discussion),
          statusId: draft.statusId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save lead changes');
      const updated = data?.lead as (InquiryRow & { Fields?: Record<string, string | null> }) | undefined;
      if (!updated) throw new Error('Lead updated but response was empty');
      const cityFromFields = getCityFromLeadFields(updated.Fields);
      setRows((prev) => prev.map((item) => {
        if (item.MetaLead_Id !== row.MetaLead_Id) return item;
        return {
          ...item,
          ...updated,
          City: cityFromFields ?? item.City,
        };
      }));
    } catch (error: unknown) {
      setConvertError(error instanceof Error ? error.message : 'Failed to save lead changes');
    } finally {
      setSavingLeadId(null);
    }
  }, [canUpdate, rowDrafts]);

  const allCampaigns = useMemo(() => (metaPerf?.campaigns || []).slice().sort((a, b) => b.leads - a.leads), [metaPerf]);
  const recommendations = useMemo(() => {
    const raw = metaReco?.recommendations;
    return Array.isArray(raw) ? raw : [];
  }, [metaReco]);
  const campaignStats = useMemo(() => {
    const withLeads = allCampaigns.filter((c) => c.costPerLead !== null && c.costPerLead > 0);
    const avgCpl = withLeads.length > 0 ? withLeads.reduce((s, c) => s + c.costPerLead!, 0) / withLeads.length : 0;
    return { avgCpl, maxLeads: allCampaigns[0]?.leads || 1 };
  }, [allCampaigns]);

  const planVsResult = useMemo(() => {
    if (recommendations.length === 0) return null;
    const plannedBudget = recommendations.reduce((s, r) => s + (Number.isFinite(r.recommendedBudget) ? r.recommendedBudget : 0), 0);
    const avgRate = recommendations.reduce((s, r) => s + (Number.isFinite(r.leadToAdmissionRate) ? r.leadToAdmissionRate : 0), 0) / recommendations.length;
    const plannedLeads = recommendations.reduce((s, r) => {
      if (!Number.isFinite(r.recommendedBudget) || !r.estimatedCpl || r.estimatedCpl <= 0) return s;
      return s + r.recommendedBudget / r.estimatedCpl;
    }, 0);
    const actualSpend = metaPerf?.totals.spend ?? 0;
    const actualLeads = metaPerf?.totals.leads ?? 0;
    return {
      plannedBudget, actualSpend, spendDelta: actualSpend - plannedBudget,
      plannedLeads, actualLeads, leadsDelta: actualLeads - plannedLeads,
      plannedAdmissions: plannedLeads * avgRate,
      projectedActualAdmissions: actualLeads * avgRate,
      admissionsDelta: (actualLeads - plannedLeads) * avgRate,
    };
  }, [metaPerf, recommendations]);

  const untouchedRows = useMemo(() => rows.filter((r) => !hasLatestFollowUp(r)).sort((a, b) => (a.Inquiry_Dt ?? '').localeCompare(b.Inquiry_Dt ?? '')), [rows]);
  const perfLoading = !metaPerf && !metaPerfError;
  const fromRow = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const toRow = pagination.total === 0 ? 0 : Math.min(pagination.page * pagination.limit, pagination.total);
  const followUpModalRow = useMemo(() => followUpModalLeadId ? rows.find((r) => r.MetaLead_Id === followUpModalLeadId) ?? null : null, [followUpModalLeadId, rows]);
  const metaDataModalRow = useMemo(() => metaDataModalLeadId ? rows.find((r) => r.MetaLead_Id === metaDataModalLeadId) ?? null : null, [metaDataModalLeadId, rows]);

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

          {/* Tab switcher */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 gap-1 shadow-sm">
            {(['analytics', 'leads'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${activeTab === tab ? 'bg-[#2E3093] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {tab === 'analytics' ? 'Campaign Analytics' : 'Meta Leads'}
                {tab === 'leads' && pagination.total > 0 && (
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${activeTab === 'leads' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{pagination.total}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Campaign Analytics Tab ── */}
          {activeTab === 'analytics' && (
            <div className="space-y-5">
              {/* KPI bar */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button type="button" onClick={() => setKpiExpanded((v) => !v)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors text-left">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 shrink-0">Performance</span>
                  <div className="flex items-center gap-4 flex-1 flex-wrap min-w-0 overflow-hidden">
                    {[
                      { dot: 'bg-blue-500', label: 'Leads', value: pagination.total.toLocaleString() },
                      { dot: 'bg-violet-500', label: 'API Leads', value: perfLoading ? '...' : (metaPerf?.totals.leads ?? 0).toLocaleString() },
                      { dot: 'bg-slate-400', label: 'Reach', value: perfLoading ? '...' : (metaPerf?.totals.reach ?? 0).toLocaleString() },
                      { dot: 'bg-orange-500', label: 'Spend', value: perfLoading ? '...' : `₹${(metaPerf?.totals.spend ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                      { dot: 'bg-emerald-500', label: 'CTR', value: perfLoading ? '...' : `${(metaPerf?.totals.ctr ?? 0).toFixed(2)}%` },
                      { dot: 'bg-rose-500', label: 'CPL', value: perfLoading ? '...' : (metaPerf?.totals.cpl == null ? '—' : `₹${metaPerf.totals.cpl.toFixed(0)}`) },
                    ].map(({ dot, label, value }) => (
                      <span key={label} className="inline-flex items-center gap-1.5 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                        <span className="text-xs font-bold text-slate-700 tabular-nums">{value}</span>
                        <span className="text-[10px] text-slate-400">{label}</span>
                      </span>
                    ))}
                  </div>
                  <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${kpiExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
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

              {/* Campaign Analytics table */}
              <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Meta Ads</p>
                    <h3 className="text-sm font-bold text-slate-800">Campaign Analytics</h3>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {[
                      { dot: 'bg-emerald-500', label: 'Efficient (CPL ≤70% avg)' },
                      { dot: 'bg-blue-400', label: 'On Track' },
                      { dot: 'bg-amber-400', label: 'Monitor' },
                      { dot: 'bg-red-500', label: 'High Cost' },
                      { dot: 'bg-slate-300', label: 'Awareness (no leads)' },
                    ].map(({ dot, label }) => (
                      <span key={label} className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="text-[10px] text-slate-500">{label}</span>
                      </span>
                    ))}
                    <span className="text-[10px] bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-500 font-medium">{allCampaigns.length} campaign{allCampaigns.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  {perfLoading ? (
                    <div className="p-4 space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-9 bg-slate-50 rounded-lg animate-pulse" />)}</div>
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
                          <th className="text-right px-3 py-2.5 font-bold"><span className="block">Unique Reach</span><span className="block text-[9px] normal-case tracking-normal text-slate-300 font-normal">Freq = Imp ÷ Reach</span></th>
                          <th className="text-right px-3 py-2.5 font-bold">Impressions</th>
                          <th className="text-right px-3 py-2.5 font-bold">Clicks</th>
                          <th className="text-right px-3 py-2.5 font-bold">CTR</th>
                          <th className="text-right px-3 py-2.5 font-bold">Spend</th>
                          <th className="text-right px-3 py-2.5 font-bold">Leads</th>
                          <th className="text-right px-3 py-2.5 font-bold">CPL</th>
                          <th className="text-right px-3 py-2.5 font-bold"><span className="block">Prediction</span><span className="block text-[9px] normal-case tracking-normal text-slate-300 font-normal">leads per ₹10k more</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCampaigns.map((c, i) => {
                          const tier = campaignTier(c.costPerLead, campaignStats.avgCpl);
                          const freq = c.reach > 0 ? c.impressions / c.reach : 0;
                          const projected = c.costPerLead && c.costPerLead > 0 ? Math.round(10000 / c.costPerLead) : null;
                          const convRate = c.clicks > 0 ? (c.leads / c.clicks) * 100 : 0;
                          const leadPct = Math.round((c.leads / campaignStats.maxLeads) * 100);
                          return (
                            <tr key={c.campaignId || i} className={`border-b border-slate-100 transition-colors ${tier.bg} hover:brightness-95`}>
                              <td className="px-3 py-2.5 relative">
                                <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${tier.bar} rounded-r`} />
                                <span className="text-[10px] font-bold text-slate-400 tabular-nums">{i + 1}</span>
                              </td>
                              <td className="px-3 py-2.5 min-w-[180px]">
                                <div className="font-semibold text-slate-800 truncate max-w-[220px]" title={c.campaignName || c.campaignId || '—'}>{c.campaignName || c.campaignId || '—'}</div>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <div className="flex-1 h-1 bg-slate-200 rounded-full"><div className={`h-1 ${tier.bar} rounded-full`} style={{ width: `${leadPct}%` }} /></div>
                                  {convRate > 0 && <span className="text-[9px] text-slate-400 whitespace-nowrap tabular-nums">{convRate.toFixed(1)}% conv</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${tier.bg} ${tier.text} ${tier.border}`}>{tier.label}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="tabular-nums font-semibold text-slate-700">{c.reach.toLocaleString()}</div>
                                {freq > 0 && <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${freqTag(freq)}`}>{freq.toFixed(1)}× freq</span>}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{c.impressions.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{c.clicks.toLocaleString()}</td>
                              <td className={`px-3 py-2.5 text-right tabular-nums ${ctrCls(c.ctr)}`}>{c.ctr.toFixed(2)}%</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">₹{c.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#2E3093]">{c.leads}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {c.costPerLead != null ? <span className={`font-semibold ${tier.text}`}>₹{c.costPerLead.toFixed(0)}</span> : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {projected != null ? <><span className="font-bold text-slate-700 tabular-nums">~{projected}</span><span className="text-slate-400 text-[10px]"> leads</span></> : <span className="text-slate-300 text-[10px]">no data</span>}
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
                            <td className="px-3 py-2.5 text-right tabular-nums">{metaPerf.totals.cpl != null ? `₹${metaPerf.totals.cpl.toFixed(0)}` : '—'}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{metaPerf.totals.cpl ? `~${Math.round(10000 / metaPerf.totals.cpl)} leads` : '—'}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center gap-4 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Frequency guide:</span>
                  {[
                    { cls: 'bg-blue-100 text-blue-700', label: '< 1.5× Fresh audience' },
                    { cls: 'bg-emerald-100 text-emerald-700', label: '1.5–2.5× Optimal' },
                    { cls: 'bg-amber-100 text-amber-700', label: '2.5–3.5× Saturating' },
                    { cls: 'bg-red-100 text-red-600', label: '> 3.5× Ad fatigue' },
                  ].map(({ cls, label }) => (
                    <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{label}</span>
                  ))}
                </div>
              </div>

              {/* Meta Planning: Batch Budget Recommendations */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2A6BB5]/60">Meta Planning</p>
                    <h3 className="text-sm font-bold text-slate-800">Batch Budget Recommendations</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">{metaReco?.formula || 'score = (0.35*gap + 0.25*urgency + 0.20*conversion + 0.10*efficiency + 0.10*value) * previous_ads_comparison * batchwise_multiplier'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Source</p>
                    <p className="text-xs font-semibold text-slate-700">{metaReco?.source === 'persisted' ? 'Daily Snapshot' : 'Live Calculation'}</p>
                    {metaReco?.scoreDate && <p className="text-[10px] text-slate-400 mt-0.5">Scored on {formatDate(metaReco.scoreDate)}</p>}
                  </div>
                </div>
                {metaRecoError ? (
                  <div className="m-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">{metaRecoError}</div>
                ) : !metaReco ? (
                  <div className="p-4 space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}</div>
                ) : recommendations.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">No upcoming batches found for recommendation.</div>
                ) : (
                  <>
                    {planVsResult && (
                      <div className="m-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Weekly Plan vs Result</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            { label: 'Budget', main: `Plan ${formatCurrency(planVsResult.plannedBudget)} | Actual ${formatCurrency(planVsResult.actualSpend)}`, sub: `${planVsResult.spendDelta <= 0 ? 'Under plan' : 'Over plan'} ${formatCurrency(Math.abs(planVsResult.spendDelta))}`, ok: planVsResult.spendDelta <= 0 as boolean | null },
                            { label: 'Leads', main: `Plan ${Math.round(planVsResult.plannedLeads)} | Actual ${Math.round(planVsResult.actualLeads)}`, sub: `${planVsResult.leadsDelta >= 0 ? '+' : ''}${Math.round(planVsResult.leadsDelta)} vs plan`, ok: planVsResult.leadsDelta >= 0 as boolean | null },
                            { label: 'Projected Admissions', main: `Plan ${planVsResult.plannedAdmissions.toFixed(1)} | Projected ${planVsResult.projectedActualAdmissions.toFixed(1)}`, sub: `${planVsResult.admissionsDelta >= 0 ? '+' : ''}${planVsResult.admissionsDelta.toFixed(1)} admissions`, ok: planVsResult.admissionsDelta >= 0 as boolean | null },
                            { label: 'Window', main: dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'Now'}` : 'Current rolling window', sub: 'Set date filters for strict weekly comparison.', ok: null as boolean | null },
                          ].map(({ label, main, sub, ok }) => (
                            <div key={label} className="rounded border border-slate-200 bg-white px-2.5 py-2">
                              <p className="text-[10px] text-slate-400 font-semibold uppercase">{label}</p>
                              <p className="text-xs font-bold text-slate-700">{main}</p>
                              <p className={`text-[10px] ${ok === null ? 'text-slate-500' : ok ? 'text-emerald-600' : 'text-rose-600'}`}>{sub}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-bold">Batch</th>
                            <th className="text-left px-3 py-2 font-bold">Course</th>
                            <th className="text-right px-3 py-2 font-bold">Days to Start</th>
                            <th className="text-right px-3 py-2 font-bold">Seats Remaining</th>
                            <th className="text-right px-3 py-2 font-bold">Priority Score</th>
                            <th className="text-center px-3 py-2 font-bold">Confidence</th>
                            <th className="text-right px-3 py-2 font-bold">Budget</th>
                            <th className="text-left px-3 py-2 font-bold min-w-[220px]">Ad Angle</th>
                            <th className="text-left px-3 py-2 font-bold min-w-[300px]">Effective Plan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recommendations.map((rec) => {
                            const planSteps = Array.isArray(rec.effectivePlan) ? rec.effectivePlan : [];
                            return (
                            <tr key={`${rec.scoreDate}-${rec.batchId}`} className="border-b border-slate-100 hover:bg-slate-50/70">
                              <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{rec.batchCode}</td>
                              <td className="px-3 py-2.5 text-slate-600">{rec.courseName}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{rec.daysToStart}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{Math.round(rec.seatGap)} / {Math.round(rec.maxStudents || 0)} <span className="text-[10px] text-slate-400">({formatPercentFromRatio(rec.gapRatio)})</span></td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#2E3093]">{formatPercentFromRatio(rec.priorityScore)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${confidenceBadge(rec.confidenceScore).cls}`}>{confidenceBadge(rec.confidenceScore).label} ({formatPercentFromRatio(rec.confidenceScore)})</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700">{formatCurrency(rec.recommendedBudget)}</td>
                              <td className="px-3 py-2.5 text-slate-600">{rec.adAngle}</td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {rec.effectivePlanStructured && (
                                  <div className="mb-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] leading-4 text-slate-600">
                                    <div><span className="font-semibold text-slate-700">Objective:</span> {rec.effectivePlanStructured.objective}</div>
                                    <div><span className="font-semibold text-slate-700">CTA:</span> {rec.effectivePlanStructured.cta}</div>
                                    <div><span className="font-semibold text-slate-700">SLA:</span> {rec.effectivePlanStructured.followUpSlaMinutes} min</div>
                                  </div>
                                )}
                                {planSteps.length > 0 ? (
                                  <ul className="list-disc pl-4 space-y-1 text-[11px] leading-4">{planSteps.map((step, idx) => <li key={idx}>{step}</li>)}</ul>
                                ) : (
                                  <span className="text-slate-400">Plan will be generated after next score run.</span>
                                )}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Meta Leads Tab ── */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <FilterBar>
                <input type="text" value={search} placeholder="Search name, mobile, email…" onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors flex-1 min-w-[180px]" />
                <select value={source} onChange={(e) => setSource(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors w-[150px]">
                  <option value="">All Sources</option>
                  {filters.sources.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors w-[130px]">
                  <option value="">All Statuses</option>
                  {filters.statusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors w-[130px]" />
                <span className="text-slate-300 text-xs select-none">–</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] transition-colors w-[130px]" />
                <button onClick={doSearch} className="flex items-center gap-1.5 bg-[#2E3093] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#252880] transition-colors shrink-0">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  Search
                </button>
                <button onClick={doClear} className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-zinc-200 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 transition-colors shrink-0">Clear</button>
              </FilterBar>

              {/* Untouched Leads Banner */}
              {!loading && untouchedRows.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setUntouchedExpanded((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-red-100/60 transition-colors">
                    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="font-bold text-red-800 text-sm flex-1">Untouched Leads — No Follow-Up Logged</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-800 tabular-nums">{untouchedRows.length} of {rows.length}</span>
                    <svg className={`w-4 h-4 text-red-500 transition-transform ${untouchedExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
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
                          {untouchedRows.map((ur) => {
                            const age = leadAge(ur.Inquiry_Dt);
                            const wa = waLink(ur.Present_Mobile, ur.Student_Name, ur.CourseName);
                            return (
                              <tr key={ur.MetaLead_Id || ur.Student_Id} className="border-b border-red-100 hover:bg-red-50/60 transition-colors">
                                <td className="py-1.5 px-3 font-semibold text-slate-800">{formatName(ur.Student_Name)}</td>
                                <td className="py-1.5 px-3 font-mono text-slate-600">{ur.Present_Mobile || '—'}</td>
                                <td className="py-1.5 px-3 text-slate-500 max-w-[120px]"><span className="truncate block">{ur.CourseName || '—'}</span></td>
                                <td className="py-1.5 px-3 text-slate-500 max-w-[140px]"><span className="truncate block">{ur.MetaCampaignName || '—'}</span></td>
                                <td className="py-1.5 px-3"><span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusPill(ur.Status_id, ur.StatusLabel)}`}>{ur.StatusLabel}</span></td>
                                <td className="py-1.5 px-3 text-center">{age.label !== '—' && <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${age.cls}`}>{age.label}</span>}</td>
                                <td className="py-1.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
                                    {ur.Present_Mobile && <a href={`tel:${ur.Present_Mobile}`} title="Call" className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></a>}
                                    {ur.MetaLead_Id && <button title="Log follow-up" onClick={() => router.push(`/dashboard/meta-leads/${encodeURIComponent(ur.MetaLead_Id)}#followups`)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-[#2E3093] hover:bg-[#2E3093]/5 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
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
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-800">Meta Leads</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 tabular-nums">{pagination.total.toLocaleString()} total</span>
                      {!loading && untouchedRows.length > 0 && <><span className="text-slate-300 text-[10px]">·</span><span className="text-[11px] font-semibold text-red-500">{untouchedRows.length} untouched</span></>}
                      {!loading && rows.filter((r) => r.IsDuplicateLead).length > 0 && <><span className="text-slate-300 text-[10px]">·</span><span className="text-[11px] font-semibold text-amber-600">{rows.filter((r) => r.IsDuplicateLead).length} dupes</span></>}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums">Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
                </div>

                {convertError && <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{convertError}</div>}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 w-8">#</th>
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 min-w-[90px]">Date</th>
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 min-w-[75px]">Time</th>
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 min-w-[160px]">Full Name</th>
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 min-w-[140px]">Qualification</th>
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 min-w-[120px]">Phone Number</th>
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 min-w-[100px]">City</th>
                        <th className="text-left font-bold border-r border-slate-200 py-2.5 px-3 min-w-[180px]">Email</th>
                        <th className="text-center font-bold border-r border-slate-200 py-2.5 px-3 min-w-[90px]">Follow Up</th>
                        <th className="text-center font-bold border-r border-slate-200 py-2.5 px-3 min-w-[80px]">Meta Data</th>
                        <th className="text-center font-bold border-r border-slate-200 py-2.5 px-3 min-w-[115px]">Status</th>
                        <th className="text-center font-bold py-2.5 px-3 min-w-[170px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>{Array.from({ length: 12 }).map((__, j) => <td key={j} className="py-2.5 px-3 border-b border-slate-100 border-r border-slate-100"><div className="h-3 bg-slate-50 rounded animate-pulse" /></td>)}</tr>
                        ))
                      ) : rows.length === 0 ? (
                        <tr><td colSpan={12} className="py-16 text-center">
                          <div className="text-slate-300 text-2xl mb-2">○</div>
                          <div className="text-xs text-slate-400 font-medium">No Meta leads found</div>
                          <div className="text-xs text-slate-300 mt-1">Try adjusting your filters</div>
                        </td></tr>
                      ) : rows.map((row, index) => {
                        const draft = rowDrafts[row.MetaLead_Id] ?? { studentName: row.Student_Name || '', courseName: row.CourseName || '', mobile: row.Present_Mobile || '', email: row.Email || '', city: row.City || '', discussion: toBulletEditorValue(row.Discussion), statusId: row.Status_id };
                        const sentEmail = Boolean(row.ApplicantEmailSentAt);
                        const bgCls = sentEmail ? 'bg-blue-50/80 hover:bg-blue-100/80' : rowBg(row.Status_id, row.StatusLabel);
                        const hasFollowUp = hasLatestFollowUp(row);
                        const isPending = isPendingFollowUp(row);
                        const age = leadAge(row.Inquiry_Dt);
                        const wa = waLink(row.Present_Mobile, row.Student_Name, row.CourseName);
                        const isSaving = savingLeadId === row.MetaLead_Id;
                        const tdBase = 'py-1.5 px-2 border-b border-r border-slate-100';

                        return (
                          <tr key={`${row.MetaLead_Id}-${index}`} className={`transition-colors group ${bgCls} ${isPending ? '[&>td]:text-purple-700' : hasFollowUp ? '' : '[&>td]:text-red-500'}`}>
                            <td className={`${tdBase} pl-4 relative`}>
                              <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${statusBar(row.Status_id, row.StatusLabel)} rounded-r`} />
                              <span className="font-mono tabular-nums text-[10px] text-slate-400">{(pagination.page - 1) * pagination.limit + index + 1}</span>
                            </td>
                            <td className={`${tdBase} whitespace-nowrap`}>
                              <div className="text-[11px] text-slate-600">{formatDate(row.Inquiry_Dt)}</div>
                              {age.label !== '—' && <span className={`inline-block mt-0.5 px-1 py-0.5 rounded text-[9px] font-bold ${age.cls}`}>{age.label}</span>}
                            </td>
                            <td className={`${tdBase} whitespace-nowrap`}>
                              <span className="text-[11px] text-slate-500">{formatTime(row.Inquiry_Dt)}</span>
                            </td>
                            <td className={tdBase}>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${sentEmail ? 'bg-blue-100 text-blue-700' : avatarColor(row.Student_Name)}`}>{getInitials(row.Student_Name)}</div>
                                <InlineCell value={draft.studentName} leadId={row.MetaLead_Id} field="studentName" disabled={!canUpdate || isSaving} onDraftChange={updateRowDraftTextField} />
                              </div>
                              {row.Student_Id > 0 && <div className="mt-0.5 text-[9px] text-slate-400 pl-6">Inq #{row.Student_Id}</div>}
                            </td>
                            <td className={tdBase}>
                              <InlineCell value={draft.courseName} leadId={row.MetaLead_Id} field="courseName" disabled={!canUpdate || isSaving} placeholder="Course / qualification" onDraftChange={updateRowDraftTextField} />
                            </td>
                            <td className={tdBase}>
                              <InlineCell value={draft.mobile} leadId={row.MetaLead_Id} field="mobile" disabled={!canUpdate || isSaving} onDraftChange={updateRowDraftTextField} />
                            </td>
                            <td className={tdBase}>
                              <InlineCell value={draft.city} leadId={row.MetaLead_Id} field="city" disabled={!canUpdate || isSaving} placeholder="City" onDraftChange={updateRowDraftTextField} />
                            </td>
                            <td className={tdBase}>
                              <InlineCell value={draft.email} leadId={row.MetaLead_Id} field="email" disabled={!canUpdate || isSaving} onDraftChange={updateRowDraftTextField} />
                            </td>
                            <td className={`${tdBase} text-center`}>
                              <button
                                type="button"
                                onClick={() => setFollowUpModalLeadId(row.MetaLead_Id)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors border ${
                                  hasFollowUp
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                {hasFollowUp ? 'View' : 'Add'}
                              </button>
                            </td>
                            <td className={`${tdBase} text-center`}>
                              <button
                                type="button"
                                onClick={() => setMetaDataModalLeadId(row.MetaLead_Id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Info
                              </button>
                            </td>
                            <td className={`${tdBase} text-center`}>
                              <select
                                value={draft.statusId ?? ''}
                                onChange={(e) => updateRowDraftStatus(row.MetaLead_Id, e.target.value ? Number(e.target.value) : null)}
                                disabled={!canUpdate || isSaving}
                                className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] disabled:bg-slate-50 disabled:text-slate-400"
                              >
                                <option value="">— Status</option>
                                {filters.statusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 px-2 border-b border-slate-100 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => void saveRow(row)}
                                  disabled={!canUpdate || !row.MetaLead_Id || isSaving}
                                  className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${canUpdate && row.MetaLead_Id ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                                >{isSaving ? 'Saving…' : 'Save'}</button>
                                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-green-600 hover:bg-green-50 transition-all"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
                                {row.Present_Mobile && <a href={`tel:${row.Present_Mobile}`} title="Call" className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></a>}
                                <button
                                  type="button"
                                  title={row.Student_Id > 0 ? 'Open linked inquiry' : 'Convert to inquiry'}
                                  onClick={() => void handleConvertLead(row)}
                                  disabled={!row.MetaLead_Id || (row.Student_Id > 0 ? !canUpdate : !canCreate) || convertingLeadId === row.MetaLead_Id}
                                  className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${row.MetaLead_Id && (row.Student_Id > 0 ? canUpdate : canCreate) ? 'border border-[#2E3093]/20 bg-[#2E3093]/5 text-[#2E3093] hover:bg-[#2E3093]/10' : 'border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                                >{convertingLeadId === row.MetaLead_Id ? '…' : row.Student_Id > 0 ? 'Open' : 'Convert'}</button>
                                <button
                                  title="Open lead details"
                                  onClick={() => row.MetaLead_Id && router.push(`/dashboard/meta-leads/${encodeURIComponent(row.MetaLead_Id)}`)}
                                  disabled={!canView || !row.MetaLead_Id}
                                  className={`w-6 h-6 rounded flex items-center justify-center transition-all ${canView && row.MetaLead_Id ? 'text-slate-300 hover:text-[#2E3093] hover:bg-[#2E3093]/5' : 'text-slate-200 cursor-not-allowed'}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
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
                    <button type="button" onClick={() => setPage((c) => Math.max(1, c - 1))} disabled={loading || pagination.page <= 1} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${pagination.page > 1 ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-100 bg-white text-slate-300 cursor-not-allowed'}`}>← Prev</button>
                    <span className="min-w-[100px] text-center text-xs font-semibold text-slate-600">Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
                    <button type="button" onClick={() => setPage((c) => Math.min(pagination.totalPages || 1, c + 1))} disabled={loading || pagination.page >= pagination.totalPages} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${pagination.page < pagination.totalPages ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'border-slate-100 bg-white text-slate-300 cursor-not-allowed'}`}>Next →</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modals */}
          {followUpModalLeadId && followUpModalRow && (
            <FollowUpModal
              row={followUpModalRow}
              draft={rowDrafts[followUpModalLeadId] ?? { studentName: followUpModalRow.Student_Name || '', courseName: followUpModalRow.CourseName || '', mobile: followUpModalRow.Present_Mobile || '', email: followUpModalRow.Email || '', city: followUpModalRow.City || '', discussion: toBulletEditorValue(followUpModalRow.Discussion), statusId: followUpModalRow.Status_id }}
              canUpdate={canUpdate}
              saving={savingLeadId === followUpModalLeadId}
              onDraftChange={updateRowDraftTextField}
              onSave={saveRow}
              onClose={() => setFollowUpModalLeadId(null)}
            />
          )}
          {metaDataModalLeadId && metaDataModalRow && (
            <MetaDataModal row={metaDataModalRow} onClose={() => setMetaDataModalLeadId(null)} />
          )}
        </>
      )}
    </div>
  );
}
