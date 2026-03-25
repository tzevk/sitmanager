'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';

type Inquiry = {
  Id: number;
  Idate?: string | null;
  Course_Id?: string | null;
  FullName?: string | null;
  Designation?: string | null;
  Mobile?: string | null;
  Phone?: string | null;
  Email?: string | null;
  CompanyName?: string | null;
  Place?: string | null;
  CompanyType?: string | null;
  CompanyAuthority?: string | null;
  InquiryStatus?: string | null;
  TrainingMode?: string | null;
  Participants_Fresher?: number | null;
  Participants_Experienced?: number | null;
  TrainingLocation?: string | null;
  business?: string | null;
  Remark?: string | null;

  Discussion?: string | null;
  FollowUp?: string | null;
  InitialFollowUpDate?: string | null;
  NextFollowUpDate?: string | null;

  TrainingNumber?: string | null;
  TrainingDate?: string | null;
  TrainerName?: string | null;
  NumberOfDays?: number | null;
  TotalStudents?: number | null;
  TrainingCoordinator?: string | null;

  DiscussionOutcome?: 'Awarded' | 'Regretted' | 'On Hold' | null;
};

type FollowUpItem = {
  date: string;
  remark: string;
};

type MeetingItem = {
  date: string;
  remark: string;
};

const toDateInput = (v: string | null | undefined) => {
  if (!v) return '';
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

function parseFollowUpJson(raw: string | null | undefined): {
  initialDate: string;
  nextDate: string;
  meetings: MeetingItem[];
  items: FollowUpItem[];
} {
  if (!raw) return { initialDate: '', nextDate: '', meetings: [], items: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    const parsedObj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;

    const rawItems = parsedObj && Array.isArray(parsedObj.items) ? parsedObj.items : [];
    const items: FollowUpItem[] = rawItems
      .map((it: unknown) => {
        const obj = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
        return {
          date: typeof obj.date === 'string' ? obj.date : '',
          remark: typeof obj.remark === 'string' ? obj.remark : '',
        };
      })
      .filter((it) => Boolean(it.date || it.remark));

    const rawMeetings = parsedObj && Array.isArray(parsedObj.meetings) ? parsedObj.meetings : [];
    let meetings: MeetingItem[] = rawMeetings
      .map((it: unknown) => {
        const obj = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
        return {
          date: typeof obj.date === 'string' ? obj.date : '',
          remark: typeof obj.remark === 'string' ? obj.remark : '',
        };
      })
      .filter((it) => Boolean(it.date || it.remark));

    const initialDate = parsedObj && typeof parsedObj.initialDate === 'string' ? parsedObj.initialDate : '';
    if (initialDate && !meetings.some((m) => toDateInput(m.date) === toDateInput(initialDate))) {
      meetings = [{ date: initialDate, remark: '' }, ...meetings];
    }

    return {
      initialDate,
      nextDate: parsedObj && typeof parsedObj.nextDate === 'string' ? parsedObj.nextDate : '',
      meetings,
      items,
    };
  } catch {
    return { initialDate: '', nextDate: '', meetings: [], items: [] };
  }
}

export default function ConvertInquiryPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const inquiryId = useMemo(() => Number(id), [id]);

  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [form, setForm] = useState({
    TrainingNumber: '',
    TrainingDate: '',
    TrainerName: '',
    NumberOfDays: '',
    TotalStudents: '',
    TrainingCoordinator: '',
    DiscussionOutcome: '' as '' | 'Awarded' | 'Regretted' | 'On Hold',
  });

  const [activeTab, setActiveTab] = useState<'meeting' | 'followups' | 'discussion'>('meeting');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [discussionText, setDiscussionText] = useState('');
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpItem>({ date: '', remark: '' });
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [meetingDraft, setMeetingDraft] = useState<MeetingItem>({ date: '', remark: '' });

  useEffect(() => {
    if (!inquiryId) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admission-activity/corporate-inquiry/${inquiryId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load inquiry');
        const r = data.inquiry as Inquiry;
        setInquiry(r);

        const parsedFollowUp = parseFollowUpJson(r.FollowUp);
        setNextFollowUpDate(toDateInput(r.NextFollowUpDate) || toDateInput(parsedFollowUp.nextDate));
        setFollowUps(parsedFollowUp.items);
        setMeetings(parsedFollowUp.meetings);
        setDiscussionText(typeof r.Discussion === 'string' ? r.Discussion : '');

        setForm({
          TrainingNumber: r.TrainingNumber || '',
          TrainingDate: toDateInput(r.TrainingDate),
          TrainerName: r.TrainerName || '',
          NumberOfDays: r.NumberOfDays === null || r.NumberOfDays === undefined ? '' : String(r.NumberOfDays),
          TotalStudents: r.TotalStudents === null || r.TotalStudents === undefined ? '' : String(r.TotalStudents),
          TrainingCoordinator: r.TrainingCoordinator || '',
          DiscussionOutcome: r.DiscussionOutcome === 'Awarded' || r.DiscussionOutcome === 'Regretted' || r.DiscussionOutcome === 'On Hold' ? r.DiscussionOutcome : '',
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load inquiry');
      } finally {
        setLoading(false);
      }
    })();
  }, [inquiryId]);

  const latestMeetingDate = useMemo(() => {
    if (meetings.length === 0) return '';
    return meetings[meetings.length - 1]?.date || '';
  }, [meetings]);

  const buildFollowUpJson = () =>
    JSON.stringify({
      initialDate: latestMeetingDate || '',
      nextDate: nextFollowUpDate || '',
      meetings,
      items: followUps,
    });

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!inquiryId) {
      setError('Invalid inquiry id');
      return;
    }

    const payload = {
      Id: inquiryId,
      InquiryStatus: 'UnderDiscussion',
      TrainingNumber: form.TrainingNumber,
      TrainingDate: form.TrainingDate,
      TrainerName: form.TrainerName,
      NumberOfDays: form.NumberOfDays,
      TotalStudents: form.TotalStudents,
      TrainingCoordinator: form.TrainingCoordinator,
      DiscussionOutcome: form.DiscussionOutcome || null,

      Discussion: discussionText,
      InitialFollowUpDate: latestMeetingDate,
      NextFollowUpDate: nextFollowUpDate,
      FollowUp: buildFollowUpJson(),
    };

    try {
      setSaving(true);
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess('Training discussion saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    setError('');
    setSuccess('');

    if (!inquiryId) {
      setError('Invalid inquiry id');
      return;
    }

    const payload = {
      Id: inquiryId,
      InquiryStatus: 'Final',
      TrainingNumber: form.TrainingNumber,
      TrainingDate: form.TrainingDate,
      TrainerName: form.TrainerName,
      NumberOfDays: form.NumberOfDays,
      TotalStudents: form.TotalStudents,
      TrainingCoordinator: form.TrainingCoordinator,
      DiscussionOutcome: form.DiscussionOutcome || null,

      Discussion: discussionText,
      InitialFollowUpDate: latestMeetingDate,
      NextFollowUpDate: nextFollowUpDate,
      FollowUp: buildFollowUpJson(),
    };

    try {
      setSaving(true);
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Convert failed');
      router.push(`/dashboard/corporate-inquiry/final/${inquiryId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Convert failed');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to convert/update corporate inquiries." />;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/corporate-inquiry/convert')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Training Discussion</h2>
            <p className="text-xs text-white/70">
              Corporate Inquiry #{inquiryId}{inquiry?.CompanyName ? ` • ${inquiry.CompanyName}` : ''}
            </p>
          </div>
          <button
            onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inquiryId}`)}
            className="px-4 py-2 rounded-lg bg-white text-[#2E3093] text-sm font-semibold hover:bg-white/90 transition-colors"
            title="Go to inquiry details"
          >
            Inquiry Details
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">{success}</div>
      )}

      {/* Inquiry Information */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="text-sm font-bold text-gray-800">Inquiry Information</div>
          <div className="text-xs text-gray-500">All details from the inquiry</div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <div className={labelCls}>Enquiry Date</div>
              <div className="text-sm text-gray-800">{toDateInput(inquiry?.Idate) || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Training Programme</div>
              <div className="text-sm text-gray-800">{inquiry?.Course_Id || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Company</div>
              <div className="text-sm text-gray-800">{inquiry?.CompanyName || '—'}</div>
            </div>

            <div>
              <div className={labelCls}>Company Location</div>
              <div className="text-sm text-gray-800">{inquiry?.Place || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Company Type</div>
              <div className="text-sm text-gray-800">{inquiry?.CompanyType || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Company Authority</div>
              <div className="text-sm text-gray-800">{inquiry?.CompanyAuthority || '—'}</div>
            </div>

            <div>
              <div className={labelCls}>Coordinator</div>
              <div className="text-sm text-gray-800">{inquiry?.FullName || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Designation</div>
              <div className="text-sm text-gray-800">{inquiry?.Designation || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Mobile / Phone</div>
              <div className="text-sm text-gray-800">{inquiry?.Mobile || inquiry?.Phone || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Email</div>
              <div className="text-sm text-gray-800">{inquiry?.Email || '—'}</div>
            </div>

            <div>
              <div className={labelCls}>Training Mode</div>
              <div className="text-sm text-gray-800">{inquiry?.TrainingMode || '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Participants (Fresher)</div>
              <div className="text-sm text-gray-800">{inquiry?.Participants_Fresher ?? '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Participants (Experienced)</div>
              <div className="text-sm text-gray-800">{inquiry?.Participants_Experienced ?? '—'}</div>
            </div>
            <div>
              <div className={labelCls}>Training Location</div>
              <div className="text-sm text-gray-800">{inquiry?.TrainingLocation || '—'}</div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <div className={labelCls}>Disciplines</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{(inquiry?.business || '').trim() || '—'}</div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className={labelCls}>Remarks</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{(inquiry?.Remark || '').trim() || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting / Follow Ups / Discussion */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="text-sm font-bold text-gray-800">Meeting Details</div>
          <div className="text-xs text-gray-500">Add meeting, follow ups and discussion notes</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
            {([
              { key: 'meeting', label: 'Add Meeting' },
              { key: 'followups', label: 'Add Follow Ups' },
              { key: 'discussion', label: 'Add Discussion' },
            ] as const).map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={
                    `px-3 py-1.5 text-xs font-semibold transition-colors border-r border-gray-300 last:border-r-0 ` +
                    (active
                      ? 'bg-[#2E3093] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50')
                  }
                  aria-pressed={active}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'meeting' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className={labelCls}>Meeting Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={meetingDraft.date}
                    onChange={(e) => setMeetingDraft((d) => ({ ...d, date: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-7">
                  <label className={labelCls}>Meeting Remark</label>
                  <input
                    className={inputCls}
                    value={meetingDraft.remark}
                    onChange={(e) => setMeetingDraft((d) => ({ ...d, remark: e.target.value }))}
                    placeholder="Remark"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!meetingDraft.date && !meetingDraft.remark) return;
                      setMeetings((prev) => [...prev, meetingDraft]);
                      setMeetingDraft({ date: '', remark: '' });
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60"
                    disabled={saving}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Next Follow Up Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                  />
                </div>
                <div>
                  <div className={labelCls}>Latest Meeting Date</div>
                  <div className="text-sm text-gray-800">{toDateInput(latestMeetingDate) || '—'}</div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Remark</th>
                      <th className="px-3 py-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {meetings.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-gray-500" colSpan={3}>
                          No meetings yet
                        </td>
                      </tr>
                    ) : (
                      meetings.map((m, idx) => (
                        <tr key={`${m.date}-${idx}`} className="bg-white">
                          <td className="px-3 py-2 text-gray-900">{toDateInput(m.date) || '—'}</td>
                          <td className="px-3 py-2 text-gray-900">{(m.remark || '').trim() || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setMeetings((prev) => prev.filter((_, i) => i !== idx))}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className={labelCls}>Follow Up Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={followUpDraft.date}
                    onChange={(e) => setFollowUpDraft((d) => ({ ...d, date: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-7">
                  <label className={labelCls}>Remark</label>
                  <input
                    className={inputCls}
                    value={followUpDraft.remark}
                    onChange={(e) => setFollowUpDraft((d) => ({ ...d, remark: e.target.value }))}
                    placeholder="Remark"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!followUpDraft.date && !followUpDraft.remark) return;
                      setFollowUps((prev) => [...prev, followUpDraft]);
                      setFollowUpDraft({ date: '', remark: '' });
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Remark</th>
                      <th className="px-3 py-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {followUps.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-gray-500" colSpan={3}>
                          No follow ups yet
                        </td>
                      </tr>
                    ) : (
                      followUps.map((fu, idx) => (
                        <tr key={`${fu.date}-${idx}`} className="bg-white">
                          <td className="px-3 py-2 text-gray-900">{toDateInput(fu.date) || '—'}</td>
                          <td className="px-3 py-2 text-gray-900">{(fu.remark || '').trim() || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setFollowUps((prev) => prev.filter((_, i) => i !== idx))}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'discussion' && (
            <div>
              <label className={labelCls}>Discussion</label>
              <textarea
                className={inputCls + ' min-h-[140px]'}
                value={discussionText}
                onChange={(e) => setDiscussionText(e.target.value)}
                placeholder="Enter discussion notes"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
            <div className="md:col-span-3">
              <label className={labelCls}>Discussion Outcome</label>
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                {([
                  { key: 'Awarded', label: 'Awarded' },
                  { key: 'Regretted', label: 'Regretted' },
                  { key: 'On Hold', label: 'On Hold' },
                ] as const).map((opt) => {
                  const active = form.DiscussionOutcome === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, DiscussionOutcome: opt.key }))}
                      className={
                        `px-3 py-1.5 text-xs font-semibold transition-colors border-r border-gray-300 last:border-r-0 ` +
                        (active
                          ? 'bg-[#2E3093] text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50')
                      }
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelCls}>Training Number</label>
              <input
                className={inputCls}
                value={form.TrainingNumber}
                onChange={(e) => setForm((f) => ({ ...f, TrainingNumber: e.target.value }))}
                placeholder="Training number"
              />
            </div>

            <div>
              <label className={labelCls}>Training Date</label>
              <input
                type="date"
                className={inputCls}
                value={form.TrainingDate}
                onChange={(e) => setForm((f) => ({ ...f, TrainingDate: e.target.value }))}
              />
            </div>

            <div>
              <label className={labelCls}>Trainer Name</label>
              <input
                className={inputCls}
                value={form.TrainerName}
                onChange={(e) => setForm((f) => ({ ...f, TrainerName: e.target.value }))}
                placeholder="Trainer name"
              />
            </div>

            <div>
              <label className={labelCls}>Number Of Days</label>
              <input
                type="number"
                className={inputCls}
                value={form.NumberOfDays}
                onChange={(e) => setForm((f) => ({ ...f, NumberOfDays: e.target.value }))}
                placeholder="0"
                min={0}
              />
            </div>

            <div>
              <label className={labelCls}>Total Students</label>
              <input
                type="number"
                className={inputCls}
                value={form.TotalStudents}
                onChange={(e) => setForm((f) => ({ ...f, TotalStudents: e.target.value }))}
                placeholder="0"
                min={0}
              />
            </div>

            <div>
              <label className={labelCls}>Training Co-ordinator</label>
              <input
                className={inputCls}
                value={form.TrainingCoordinator}
                onChange={(e) => setForm((f) => ({ ...f, TrainingCoordinator: e.target.value }))}
                placeholder="Training co-ordinator"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4 gap-2">
            <button
              onClick={() => router.push('/dashboard/corporate-inquiry/convert')}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleConvert}
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60"
              disabled={saving}
              title="Convert to Training Execution"
            >
              {saving ? 'Converting…' : 'Convert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
