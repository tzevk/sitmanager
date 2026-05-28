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
    if ([7, 10, 27].includes(id)) return 'bg-emerald-100 text-emerald-700';
    if ([1, 2, 3].includes(id)) return 'bg-blue-100 text-blue-700';
    if ([5, 24].includes(id)) return 'bg-orange-100 text-orange-700';
    if ([4, 15, 25].includes(id)) return 'bg-amber-100 text-amber-700';
    if ([6, 9, 19, 29, 34].includes(id)) return 'bg-red-100 text-red-600';
    if ([8, 33].includes(id)) return 'bg-gray-100 text-gray-500';
  }
  return 'bg-gray-100 text-gray-500';
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#2E3093]/10 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KvGrid({ entries }: { entries: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <div key={entry.label}>
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{entry.label}</div>
          <div className="mt-1 text-sm text-slate-700 break-words">{entry.value || '—'}</div>
        </div>
      ))}
    </div>
  );
}

const ctrl = 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

export default function MetaLeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const router = useRouter();
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');
  const [lead, setLead] = useState<MetaLeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [draft, setDraft] = useState<{
    studentName: string;
    courseName: string;
    mobile: string;
    email: string;
    fields: Record<string, string | null>;
    utm: Record<string, string | null>;
  }>({
    studentName: '',
    courseName: '',
    mobile: '',
    email: '',
    fields: {},
    utm: {},
  });

  useEffect(() => {
    const leadId = params?.leadId ? decodeURIComponent(params.leadId) : '';
    if (!leadId) {
      setError('Missing Meta lead id');
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadLead() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(leadId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load Meta lead');
        if (!cancelled) {
          const nextLead = data.lead ?? null;
          setLead(nextLead);
          setDraft({
            studentName: nextLead?.Student_Name || '',
            courseName: nextLead?.CourseName || '',
            mobile: nextLead?.Present_Mobile || '',
            email: nextLead?.Email || '',
            fields: { ...(nextLead?.Fields || {}) },
            utm: { ...(nextLead?.UTM || {}) },
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setLead(null);
          setError(err instanceof Error ? err.message : 'Failed to load Meta lead');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLead();
    return () => { cancelled = true; };
  }, [params?.leadId]);

  const fieldEntries = useMemo(
    () => Object.entries(lead?.Fields || {}).sort(([a], [b]) => a.localeCompare(b)),
    [lead]
  );
  const utmEntries = useMemo(
    () => Object.entries(draft.utm || {}).sort(([a], [b]) => a.localeCompare(b)),
    [draft.utm]
  );
  const editableFieldEntries = useMemo(
    () => Object.entries(draft.fields || {}).sort(([a], [b]) => a.localeCompare(b)),
    [draft.fields]
  );

  async function handleSave() {
    const leadId = lead?.MetaLead_Id || params?.leadId;
    if (!leadId || !canUpdate) return;

    setSaving(true);
    setSaveMessage('');
    setError('');
    try {
      const res = await fetch(`/api/meta-ads/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: draft.studentName,
          courseName: draft.courseName,
          mobile: draft.mobile,
          email: draft.email,
          fields: draft.fields,
          utm: draft.utm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save Meta lead');
      const nextLead = data.lead ?? null;
      setLead(nextLead);
      setDraft({
        studentName: nextLead?.Student_Name || '',
        courseName: nextLead?.CourseName || '',
        mobile: nextLead?.Present_Mobile || '',
        email: nextLead?.Email || '',
        fields: { ...(nextLead?.Fields || {}) },
        utm: { ...(nextLead?.UTM || {}) },
      });
      setSaveMessage('Changes saved');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save Meta lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view Meta leads." /> : (
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
                {canUpdate ? (
                  <GhostBtn onClick={handleSave}>{saving ? 'Saving…' : 'Save Changes'}</GhostBtn>
                ) : null}
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
            <div className="rounded-xl border border-[#2E3093]/10 bg-white p-8 text-sm text-slate-400">Loading…</div>
          ) : error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>
          ) : !lead ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-400">Meta lead not found.</div>
          ) : (
            <>
              {saveMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{saveMessage}</div>
              ) : null}
              <InfoCard title="Overview">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Status</div>
                    <div className="mt-1"><span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold ${statusPill(lead.Status_id, lead.StatusLabel)}`}>{lead.StatusLabel}</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Lead Date</div>
                    <div className="mt-1 text-sm text-slate-700">{formatDate(lead.Inquiry_Dt)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Inquiry Link</div>
                    <div className="mt-1 text-sm text-slate-700">{lead.Student_Id > 0 ? `Inquiry #${lead.Student_Id}` : 'Not linked yet'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Name</div>
                    <input value={draft.studentName} onChange={(e) => setDraft((current) => ({ ...current, studentName: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Training</div>
                    <input value={draft.courseName} onChange={(e) => setDraft((current) => ({ ...current, courseName: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Mobile</div>
                    <input value={draft.mobile} onChange={(e) => setDraft((current) => ({ ...current, mobile: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Email</div>
                    <input value={draft.email} onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))} className={ctrl} disabled={!canUpdate || saving} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Source</div>
                    <div className="mt-1 text-sm text-slate-700">{lead.Inquiry_Type || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Contact Source</div>
                    <div className="mt-1 text-sm text-slate-700">{lead.Inquiry_From || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Duplicate Of</div>
                    <div className="mt-1 text-sm text-slate-700">{lead.DuplicateOfInquiryId ? `Inquiry #${lead.DuplicateOfInquiryId}` : '—'}</div>
                  </div>
                </div>
                {(lead.LeadTags || []).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {lead.LeadTags.map((tag) => (
                      <span key={tag} className="px-2 py-1 rounded-full bg-[#EEF3FF] text-[#2E3093] text-[11px] font-semibold">{tag}</span>
                    ))}
                  </div>
                )}
              </InfoCard>

              <InfoCard title="Meta Context">
                <KvGrid entries={[
                  { label: 'Campaign', value: lead.MetaCampaignName || '—' },
                  { label: 'Campaign Id', value: lead.MetaCampaignId || '—' },
                  { label: 'Form', value: lead.MetaFormName || '—' },
                  { label: 'Form Id', value: lead.MetaFormId || '—' },
                  { label: 'Page', value: lead.MetaPageName || '—' },
                  { label: 'Page Id', value: lead.MetaPageId || '—' },
                  { label: 'Ad', value: lead.MetaAdName || '—' },
                  { label: 'Ad Id', value: lead.MetaAdId || '—' },
                  { label: 'Adset', value: lead.MetaAdsetName || '—' },
                  { label: 'Adset Id', value: lead.MetaAdsetId || '—' },
                  { label: 'Synced At', value: formatDate(lead.SyncedAt) },
                  { label: 'Notifications Sent', value: formatDate(lead.NotificationsSentAt) },
                ]} />
              </InfoCard>

              <InfoCard title="CRM Notes">
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{lead.Discussion || '—'}</div>
                {lead.LastError ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{lead.LastError}</div>
                ) : null}
              </InfoCard>

              <InfoCard title="Captured Fields">
                {editableFieldEntries.length === 0 ? (
                  <div className="text-sm text-slate-400">No lead fields stored.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {editableFieldEntries.map(([label, value]) => (
                      <div key={label}>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</div>
                        <input
                          value={value || ''}
                          onChange={(e) => setDraft((current) => ({ ...current, fields: { ...current.fields, [label]: e.target.value || null } }))}
                          className={ctrl}
                          disabled={!canUpdate || saving}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>

              <InfoCard title="UTM Data">
                {utmEntries.length === 0 ? (
                  <div className="text-sm text-slate-400">No UTM data stored.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {utmEntries.map(([label, value]) => (
                      <div key={label}>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</div>
                        <input
                          value={value || ''}
                          onChange={(e) => setDraft((current) => ({ ...current, utm: { ...current.utm, [label]: e.target.value || null } }))}
                          className={ctrl}
                          disabled={!canUpdate || saving}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </InfoCard>
            </>
          )}
        </>
      )}
    </div>
  );
}