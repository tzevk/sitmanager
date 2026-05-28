'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { GhostBtn, PageHeader } from '@/components/ui/PageHeader';
import { useResourcePermissions } from '@/lib/permissions-context';

interface MetaLeadDetail {
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

type Tab = 'overview' | 'meta' | 'fields' | 'utm' | 'followups';

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

function statusPill(id: number | null, label: string) {
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
    try {
      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(lead.MetaLead_Id)}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim(), nextDate: newNextDate || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save note');
      setFollowUps(data.entries ?? []);
      setNewNote('');
      setNewNextDate('');
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
    { id: 'meta',       label: 'Meta Context' },
    { id: 'fields',     label: 'Captured Fields' },
    { id: 'utm',        label: 'UTM Data' },
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
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusPill(draft.statusId ?? lead.Status_id, lead.StatusLabel)}`}>
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
                  </div>
                )}

                {/* Meta Context */}
                {activeTab === 'meta' && (
                  <div className="divide-y divide-slate-100">
                    <KvRow label="Campaign"    value={lead.MetaCampaignName} />
                    <KvRow label="Campaign ID"  value={lead.MetaCampaignId} />
                    <KvRow label="Form"         value={lead.MetaFormName} />
                    <KvRow label="Form ID"      value={lead.MetaFormId} />
                    <KvRow label="Page"         value={lead.MetaPageName} />
                    <KvRow label="Page ID"      value={lead.MetaPageId} />
                    <KvRow label="Ad"           value={lead.MetaAdName} />
                    <KvRow label="Ad ID"        value={lead.MetaAdId} />
                    <KvRow label="Ad Set"       value={lead.MetaAdsetName} />
                    <KvRow label="Ad Set ID"    value={lead.MetaAdsetId} />
                    <KvRow label="Synced At"    value={formatDate(lead.SyncedAt)} />
                    <KvRow label="Notified At"  value={formatDate(lead.NotificationsSentAt)} />
                  </div>
                )}

                {/* Captured Fields */}
                {activeTab === 'fields' && (
                  <div className="p-4">
                    {editableFieldEntries.length === 0 ? (
                      <div className="py-8 text-sm text-slate-400 text-center">No captured fields</div>
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
                )}

                {/* UTM Data */}
                {activeTab === 'utm' && (
                  <div className="p-4">
                    {utmEntries.length === 0 ? (
                      <div className="py-8 text-sm text-slate-400 text-center">No UTM data</div>
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
                )}

                {/* Follow Ups */}
                {activeTab === 'followups' && (
                  <div className="divide-y divide-slate-100">
                    {/* Add follow-up */}
                    {canUpdate && (
                      <div className="p-4 space-y-3 bg-slate-50/60">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Log Follow Up</p>
                        <div className="flex gap-3 items-start">
                          <div className="flex-1">
                            <textarea
                              value={newNote}
                              onChange={(e) => setNewNote(e.target.value)}
                              placeholder="What was discussed? Any outcome or next steps…"
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
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{entry.note}</p>
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
