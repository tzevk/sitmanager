'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { GhostBtn, PageHeader } from '@/components/ui/PageHeader';
import { useResourcePermissions } from '@/lib/permissions-context';

interface MetaLeadDetail {
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
  MetaCampaignName: string | null;
  MetaCampaignId: string | null;
  MetaFormName: string | null;
  MetaFormId: string | null;
  MetaPageName: string | null;
  MetaPageId: string | null;
  MetaAdName: string | null;
  MetaAdId: string | null;
  MetaAdsetName: string | null;
  MetaAdsetId: string | null;
  LeadTags: string[];
  IsDuplicateLead: boolean;
  DuplicateOfInquiryId: number | null;
  LastError: string | null;
  NotificationsSentAt: string | null;
  SyncedAt: string | null;
  CreatedAt: string | null;
  UTM: Record<string, string | null>;
  Fields: Record<string, string | null>;
  Payload: unknown;
}

// Admission intake workflow stages
const WORKFLOW_STAGES = [
  { id: 19, label: 'New Inquiry' },
  { id: 1,  label: 'Follow Up'  },
  { id: 2,  label: 'Interested' },
  { id: 3,  label: 'Confirmed'  },
  { id: 23, label: 'Docs Pending' },
  { id: 8,  label: 'Admitted'   },
] as const;

// All available statuses for the dropdown
const ALL_STATUSES: { id: number; label: string }[] = [
  { id: 0,  label: 'New Inquiry' },
  { id: 19, label: 'Online Inquiry' },
  { id: 1,  label: 'Follow Up' },
  { id: 13, label: 'Walk In' },
  { id: 40, label: 'Counselling Done' },
  { id: 34, label: 'Assessment Done' },
  { id: 2,  label: 'Interested' },
  { id: 3,  label: 'Confirmed' },
  { id: 23, label: 'Document Pending' },
  { id: 24, label: 'Fees Pending' },
  { id: 8,  label: 'Admitted' },
  { id: 12, label: 'Prospective' },
  { id: 15, label: 'Re-inquiry' },
  { id: 10, label: 'On Hold' },
  { id: 4,  label: 'Not Interested' },
  { id: 9,  label: 'Left' },
  { id: 27, label: 'Duplicate' },
  { id: 35, label: 'Refund' },
];

type Tab = 'overview' | 'followups';

interface FollowUpEntry {
  id: number;
  date: string | null;
  nextDate: string | null;
  note: string;
  createdAt: string | null;
}

const TAG_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-pink-100 text-pink-700 border-pink-200',
];

function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const raw = String(value).trim();
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function statusPill(id: number | null) {
  if (id != null) {
    if ([7, 10, 27].includes(id)) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    if ([1, 2, 3].includes(id)) return 'bg-blue-100 text-blue-700 border border-blue-200';
    if ([5, 24].includes(id)) return 'bg-orange-100 text-orange-700 border border-orange-200';
    if ([4, 15, 25].includes(id)) return 'bg-amber-100 text-amber-700 border border-amber-200';
    if ([6, 9, 19, 29, 34].includes(id)) return 'bg-red-100 text-red-600 border border-red-200';
    if ([8, 33].includes(id)) return 'bg-gray-100 text-gray-500 border border-gray-200';
  }
  return 'bg-gray-100 text-gray-500 border border-gray-200';
}

const ctrl = 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors disabled:bg-slate-50 disabled:text-slate-400';

function KvRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start border-b border-slate-100 last:border-0 py-2.5 px-4 gap-4">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 break-words flex-1">{value || '—'}</span>
    </div>
  );
}

export default function MetaLeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const router = useRouter();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');
  const [lead, setLead] = useState<MetaLeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [followUps, setFollowUps] = useState<FollowUpEntry[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newNextDate, setNewNextDate] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [followUpType, setFollowUpType] = useState<'Note' | 'Call' | 'WhatsApp' | 'Email'>('Note');
  const [callOutcome, setCallOutcome] = useState<'Connected' | 'No Answer' | 'Busy' | 'Wrong Number'>('Connected');

  const [draft, setDraft] = useState<{
    studentName: string;
    courseName: string;
    mobile: string;
    email: string;
    statusId: number | null;
    fields: Record<string, string | null>;
    utm: Record<string, string | null>;
  }>({
    studentName: '', courseName: '', mobile: '', email: '',
    statusId: null, fields: {}, utm: {},
  });

  useEffect(() => {
    const leadId = params?.leadId ? decodeURIComponent(params.leadId) : '';
    if (!leadId) { setError('Missing Meta lead id'); setLoading(false); return; }

    let cancelled = false;
    async function loadLead() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(leadId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load Meta lead');
        if (!cancelled) {
          const next = data.lead ?? null;
          setLead(next);
          setDraft({
            studentName: next?.Student_Name || '',
            courseName: next?.CourseName || '',
            mobile: next?.Present_Mobile || '',
            email: next?.Email || '',
            statusId: next?.Status_id ?? null,
            fields: { ...(next?.Fields || {}) },
            utm: { ...(next?.UTM || {}) },
          });
        }
      } catch (err: unknown) {
        if (!cancelled) { setLead(null); setError(err instanceof Error ? err.message : 'Failed to load Meta lead'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLead();
    return () => { cancelled = true; };
  }, [params?.leadId]);

  useEffect(() => {
    const leadId = params?.leadId ? decodeURIComponent(params.leadId) : '';
    if (!leadId || activeTab !== 'followups') return;
    let cancelled = false;
    setFollowUpsLoading(true);
    fetch(`/api/meta-ads/leads/${encodeURIComponent(leadId)}/discussions`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setFollowUps(data.entries ?? []); })
      .catch(() => { if (!cancelled) setFollowUps([]); })
      .finally(() => { if (!cancelled) setFollowUpsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, params?.leadId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#followups' || hash === '#follow-ups') {
        setActiveTab('followups');
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const editableFieldEntries = useMemo(
    () => Object.entries(draft.fields || {}).sort(([a], [b]) => a.localeCompare(b)),
    [draft.fields]
  );
  const utmEntries = useMemo(
    () => Object.entries(draft.utm || {}).sort(([a], [b]) => a.localeCompare(b)),
    [draft.utm]
  );

  async function handleSave() {
    const leadId = lead?.MetaLead_Id || params?.leadId;
    if (!leadId || !canUpdate) return;
    setSaving(true); setSaveMessage(''); setError('');
    try {
      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: draft.studentName,
          courseName: draft.courseName,
          mobile: draft.mobile,
          email: draft.email,
          statusId: draft.statusId,
          fields: draft.fields,
          utm: draft.utm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save Meta lead');
      const next = data.lead ?? null;
      setLead(next);
      setDraft({
        studentName: next?.Student_Name || '',
        courseName: next?.CourseName || '',
        mobile: next?.Present_Mobile || '',
        email: next?.Email || '',
        statusId: next?.Status_id ?? null,
        fields: { ...(next?.Fields || {}) },
        utm: { ...(next?.UTM || {}) },
      });
      setSaveMessage('Changes saved');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Meta lead');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusClick(statusId: number) {
    if (!canUpdate || !lead) return;
    setDraft((d) => ({ ...d, statusId }));
    const leadId = lead.MetaLead_Id;
    try {
      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update status');
      const next = data.lead ?? null;
      setLead(next);
      setDraft((d) => ({ ...d, statusId: next?.Status_id ?? null }));
      setSaveMessage('Status updated');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !lead || !canUpdate) return;
    setSavingNote(true);
    const prefix = followUpType === 'Call'
      ? `[Call · ${callOutcome}] `
      : followUpType !== 'Note'
      ? `[${followUpType}] `
      : '';
    const fullNote = prefix + newNote.trim();
    try {
      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(lead.MetaLead_Id)}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: fullNote, nextDate: newNextDate || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save note');
      setFollowUps(data.entries ?? []);
      setNewNote('');
      setNewNextDate('');
      setFollowUpType('Note');
      setCallOutcome('Connected');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  }

  const currentStageIndex = WORKFLOW_STAGES.findIndex((s) => s.id === (draft.statusId ?? lead?.Status_id));

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview' },
    { id: 'followups',  label: `Follow Ups${followUps.length ? ` (${followUps.length})` : ''}` },
  ];

  return (
    <div className="space-y-5">
      {permLoading ? <PermissionLoading /> : !canView ? (
        <AccessDenied message="You do not have permission to view Meta leads." />
      ) : (
        <>
          <PageHeader
            title={lead?.Student_Name || 'Meta Lead Details'}
            breadcrumbs={[
              { label: 'Admission Activity' },
              { label: 'Meta Leads', href: '/dashboard/meta-leads' },
              { label: 'Lead Details' },
            ]}
            meta={lead?.MetaLead_Id || params?.leadId || ''}
            action={
              <>
                {canUpdate && (
                  <GhostBtn onClick={handleSave}>{saving ? 'Saving…' : 'Save Changes'}</GhostBtn>
                )}
                {lead?.Student_Id ? (
                  <GhostBtn href={`/dashboard/inquiry/add?editId=${lead.Student_Id}&returnTo=${encodeURIComponent(`/dashboard/meta-leads/${lead.MetaLead_Id}`)}`}>
                    Edit Inquiry
                  </GhostBtn>
                ) : null}
                <GhostBtn onClick={() => router.push('/dashboard/meta-leads')}>Back To Leads</GhostBtn>
              </>
            }
          />

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8">
              <div className="space-y-3">
                {[1,2,3].map((i) => <div key={i} className="h-5 bg-slate-50 rounded animate-pulse" />)}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>
          ) : !lead ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-400">Meta lead not found.</div>
          ) : (
            <>
              {saveMessage && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {saveMessage}
                </div>
              )}

              {/* Workflow pipeline */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Lead Workflow</p>
                    <h3 className="text-sm font-bold text-slate-800">Current Stage</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusPill(draft.statusId ?? lead.Status_id)}`}>
                      {ALL_STATUSES.find((s) => s.id === (draft.statusId ?? lead.Status_id))?.label ?? lead.StatusLabel}
                    </span>
                    {canUpdate && (
                      <select
                        value={draft.statusId ?? lead.Status_id ?? ''}
                        onChange={(e) => handleStatusClick(Number(e.target.value))}
                        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      >
                        <option value="" disabled>Change status…</option>
                        {ALL_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                {/* Pipeline track */}
                <div className="px-6 py-4 overflow-x-auto">
                  <div className="flex items-center min-w-max gap-0">
                    {WORKFLOW_STAGES.map((stage, i) => {
                      const isDone = currentStageIndex >= 0 && i < currentStageIndex;
                      const isCurrent = i === currentStageIndex;
                      const isLast = i === WORKFLOW_STAGES.length - 1;
                      return (
                        <div key={stage.id} className="flex items-center">
                          <button
                            onClick={() => canUpdate && handleStatusClick(stage.id)}
                            disabled={!canUpdate}
                            title={stage.label}
                            className={`flex flex-col items-center gap-1.5 group transition-all ${canUpdate ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                              isCurrent
                                ? 'border-[#2E3093] bg-[#2E3093] text-white shadow-md shadow-[#2E3093]/20'
                                : isDone
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-200 bg-white text-slate-300 group-hover:border-[#2E3093]/40'
                            }`}>
                              {isDone ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <span className="text-[10px] font-bold">{i + 1}</span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold whitespace-nowrap transition-colors ${
                              isCurrent ? 'text-[#2E3093]' : isDone ? 'text-emerald-600' : 'text-slate-400'
                            }`}>{stage.label}</span>
                          </button>
                          {!isLast && (
                            <div className={`w-12 h-0.5 mx-1 mb-5 transition-colors ${isDone || isCurrent ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 flex">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-[#2E3093] text-[#2E3093] bg-[#2E3093]/3'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Overview */}
                {activeTab === 'overview' && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100">
                      <div className="p-4 space-y-3 md:border-r border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Lead Info</p>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Name</label>
                          <input value={draft.studentName} onChange={(e) => setDraft((d) => ({ ...d, studentName: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Training</label>
                          <input value={draft.courseName} onChange={(e) => setDraft((d) => ({ ...d, courseName: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mobile</label>
                          <input value={draft.mobile} onChange={(e) => setDraft((d) => ({ ...d, mobile: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Email</label>
                          <input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Details</p>
                        <div className="space-y-1.5 text-sm">
                          <KvRow label="Lead Date" value={formatDate(lead.Inquiry_Dt)} />
                          <KvRow label="Inquiry #" value={lead.Student_Id > 0 ? `#${lead.Student_Id}` : 'Not linked'} />
                          <KvRow label="Student Master #" value={lead.StudentMaster_Id > 0 ? `#${lead.StudentMaster_Id}` : 'Not linked'} />
                          <KvRow label="Source" value={lead.Inquiry_Type} />
                          <KvRow label="Contact Source" value={lead.Inquiry_From} />
                          <KvRow label="Duplicate Of" value={lead.DuplicateOfInquiryId ? `Inquiry #${lead.DuplicateOfInquiryId}` : null} />
                        </div>
                        {(lead.LeadTags || []).length > 0 && (
                          <div className="pt-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Tags</p>
                            <div className="flex flex-wrap gap-1.5">
                              {lead.LeadTags.map((tag) => (
                                <span key={tag} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tagColor(tag)}`}>{tag}</span>
                              ))}
                              {lead.IsDuplicateLead && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-100 text-amber-700 border-amber-200">Duplicate</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {lead.LastError && (
                      <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{lead.LastError}</div>
                    )}
                    <div className="border-t border-slate-100 p-4 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Meta Context</p>
                        <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                          <KvRow label="Campaign" value={lead.MetaCampaignName} />
                          <KvRow label="Campaign ID" value={lead.MetaCampaignId} />
                          <KvRow label="Form" value={lead.MetaFormName} />
                          <KvRow label="Form ID" value={lead.MetaFormId} />
                          <KvRow label="Page" value={lead.MetaPageName} />
                          <KvRow label="Page ID" value={lead.MetaPageId} />
                          <KvRow label="Ad" value={lead.MetaAdName} />
                          <KvRow label="Ad ID" value={lead.MetaAdId} />
                          <KvRow label="Ad Set" value={lead.MetaAdsetName} />
                          <KvRow label="Ad Set ID" value={lead.MetaAdsetId} />
                          <KvRow label="Synced At" value={formatDate(lead.SyncedAt)} />
                          <KvRow label="Notified At" value={formatDate(lead.NotificationsSentAt)} />
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Captured Fields</p>
                        {editableFieldEntries.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-sm text-slate-400 text-center">No captured fields</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {editableFieldEntries.map(([label, value]) => (
                              <div key={label} className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
                                <input
                                  value={value || ''}
                                  onChange={(e) => setDraft((d) => ({ ...d, fields: { ...d.fields, [label]: e.target.value || null } }))}
                                  className={ctrl}
                                  disabled={!canUpdate || saving}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">UTM Data</p>
                        {utmEntries.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-sm text-slate-400 text-center">No UTM data</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {utmEntries.map(([label, value]) => (
                              <div key={label} className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
                                <input
                                  value={value || ''}
                                  onChange={(e) => setDraft((d) => ({ ...d, utm: { ...d.utm, [label]: e.target.value || null } }))}
                                  className={ctrl}
                                  disabled={!canUpdate || saving}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Follow Ups */}
                {activeTab === 'followups' && (
                  <div className="divide-y divide-slate-100">
                    {/* Add follow-up */}
                    {canUpdate && (
                      <div className="p-4 space-y-3 bg-slate-50/60">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Log Follow Up</p>

                        {/* Type selector */}
                        <div className="flex gap-1.5 flex-wrap">
                          {(['Note','Call','WhatsApp','Email'] as const).map(t => {
                            const icons: Record<string, React.ReactNode> = {
                              Note: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
                              Call: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>,
                              WhatsApp: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
                              Email: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
                            };
                            const active = followUpType === t;
                            return (
                              <button key={t} type="button" onClick={() => setFollowUpType(t)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  active ? 'bg-[#2E3093] text-white border-[#2E3093]' : 'bg-white text-slate-500 border-slate-200 hover:border-[#2E3093]/30'
                                }`}>
                                {icons[t]}{t}
                              </button>
                            );
                          })}
                        </div>

                        {/* Call outcome (only when type=Call) */}
                        {followUpType === 'Call' && (
                          <div className="flex gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 self-center">Outcome:</span>
                            {(['Connected','No Answer','Busy','Wrong Number'] as const).map(o => (
                              <button key={o} type="button" onClick={() => setCallOutcome(o)}
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                                  callOutcome === o
                                    ? o === 'Connected' ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                    : 'bg-amber-100 text-amber-700 border-amber-300'
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                }`}>
                                {o}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-3 items-start">
                          <div className="flex-1">
                            <textarea
                              value={newNote}
                              onChange={(e) => setNewNote(e.target.value)}
                              placeholder={
                                followUpType === 'Call' ? 'What was discussed on the call?'
                                : followUpType === 'WhatsApp' ? 'What message did you send?'
                                : followUpType === 'Email' ? 'What was the email about?'
                                : 'What was discussed? Any outcome or next steps…'
                              }
                              rows={3}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 resize-none transition-colors"
                            />
                          </div>
                          <div className="shrink-0 space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-wide text-slate-400 block">Next Follow Up</label>
                            <input
                              type="date"
                              value={newNextDate}
                              onChange={(e) => setNewNextDate(e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] transition-colors w-[150px]"
                            />
                            <button
                              onClick={handleAddNote}
                              disabled={savingNote || !newNote.trim()}
                              className="w-full px-3 py-2 rounded-lg bg-[#2E3093] text-white text-xs font-bold hover:bg-[#252880] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {savingNote ? 'Saving…' : 'Log Note'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Follow-up history */}
                    <div>
                      {followUpsLoading ? (
                        <div className="p-4 space-y-3">
                          {[1,2,3].map((i) => <div key={i} className="h-16 bg-slate-50 rounded-lg animate-pulse" />)}
                        </div>
                      ) : followUps.length === 0 ? (
                        <div className="py-10 text-center">
                          <div className="text-slate-300 text-2xl mb-2">○</div>
                          <div className="text-sm text-slate-400">No follow-ups logged yet</div>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {followUps.map((entry) => {
                            const isOverdue = entry.nextDate && new Date(entry.nextDate) < new Date();
                            const isDueToday = entry.nextDate && entry.nextDate === new Date().toISOString().slice(0, 10);

                            // Parse type tag from note prefix
                            let noteType: 'Note' | 'Call' | 'WhatsApp' | 'Email' = 'Note';
                            let noteOutcome: string | null = null;
                            let cleanNote = entry.note;
                            const callMatch = entry.note.match(/^\[Call · ([^\]]+)\] /);
                            if (callMatch) {
                              noteType = 'Call'; noteOutcome = callMatch[1];
                              cleanNote = entry.note.slice(callMatch[0].length);
                            } else if (entry.note.startsWith('[WhatsApp] ')) {
                              noteType = 'WhatsApp'; cleanNote = entry.note.slice('[WhatsApp] '.length);
                            } else if (entry.note.startsWith('[Email] ')) {
                              noteType = 'Email'; cleanNote = entry.note.slice('[Email] '.length);
                            }

                            const typeConfig: Record<string, { icon: React.ReactNode; bg: string; text: string; label: string }> = {
                              Note:      { icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>, bg: 'bg-slate-100', text: 'text-slate-500', label: 'Note' },
                              Call:      { icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>, bg: noteOutcome === 'Connected' ? 'bg-emerald-100' : 'bg-amber-100', text: noteOutcome === 'Connected' ? 'text-emerald-700' : 'text-amber-700', label: noteOutcome ? `Call · ${noteOutcome}` : 'Call' },
                              WhatsApp:  { icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, bg: 'bg-green-100', text: 'text-green-700', label: 'WhatsApp' },
                              Email:     { icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>, bg: 'bg-blue-100', text: 'text-blue-700', label: 'Email' },
                            };
                            const tc = typeConfig[noteType];

                            return (
                              <div key={entry.id} className="px-4 py-3.5 flex gap-4">
                                {/* Date column */}
                                <div className="shrink-0 text-center w-14">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                                    {entry.date ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                                  </div>
                                  <div className="text-[10px] text-slate-300">
                                    {entry.date ? new Date(entry.date + 'T00:00:00').getFullYear() : ''}
                                  </div>
                                </div>
                                {/* Divider */}
                                <div className="w-px bg-slate-200 shrink-0" />
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tc.bg} ${tc.text}`}>
                                      {tc.icon}{tc.label}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{cleanNote}</p>
                                  {entry.nextDate && (
                                    <div className="mt-2 inline-flex items-center gap-1.5">
                                      <svg className="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                                      <span className={`text-[11px] font-semibold ${
                                        isOverdue ? 'text-red-600' : isDueToday ? 'text-orange-600' : 'text-slate-500'
                                      }`}>
                                        Next: {new Date(entry.nextDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        {isDueToday && ' · Today'}
                                        {isOverdue && !isDueToday && ' · Overdue'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
