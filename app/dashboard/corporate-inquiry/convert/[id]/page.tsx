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

  TrainingNumber?: string | null;
  TrainingDate?: string | null;
  TrainerName?: string | null;
  NumberOfDays?: number | null;
  TotalStudents?: number | null;
  TrainingCoordinator?: string | null;

  DiscussionOutcome?: 'Awarded' | 'Regretted' | 'On Hold' | null;
};

type MeetingItem = {
  date: string;
  nextDate?: string;
  remark: string;
};

type ContactDetailItem = {
  fullName: string;
  email: string;
  phoneNumber: string;
  alternateNumber: string;
  jobTitle: string;
  industry: string;
  location: string;
};

type FollowUpData = {
  meetingDate: string;
  attendeeClient: string;
  attendeeSIT: string;
  meetingAgenda: string;
  meetings: MeetingItem[];
  contacts?: ContactDetailItem[];
};

type MeetingDetailsItem = {
  meetingDate: string;
  attendeeClient: string;
  attendeeSIT: string;
  meetingAgenda: string;
};

const toDateInput = (v: string | null | undefined) => {
  if (!v) return '';
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const splitList = (raw: string | null | undefined) => {
  const s = String(raw ?? '');
  return s
    .split(/\r?\n|,/g)
    .map((x) => x.trim())
    .filter(Boolean);
};

function parseFollowUpJson(raw: string | null | undefined): FollowUpData {
  if (!raw)
    return {
      meetingDate: '',
      attendeeClient: '',
      attendeeSIT: '',
      meetingAgenda: '',
      meetings: [],
    };
  try {
    const parsed: unknown = JSON.parse(raw);
    const parsedObj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;

    const rawMeetings =
      parsedObj && Array.isArray(parsedObj.meetings)
        ? parsedObj.meetings
        : parsedObj && Array.isArray(parsedObj.followUps)
          ? parsedObj.followUps
          : [];
    let meetings: MeetingItem[] = rawMeetings
      .map((it: unknown) => {
        const obj = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
        return {
          date: typeof obj.date === 'string' ? obj.date : '',
          nextDate:
            typeof obj.nextDate === 'string'
              ? obj.nextDate
              : typeof obj.nextFollowUpDate === 'string'
                ? obj.nextFollowUpDate
                : typeof obj.next_follow_up_date === 'string'
                  ? obj.next_follow_up_date
                  : '',
          remark: typeof obj.remark === 'string' ? obj.remark : '',
        };
      })
      .filter((it) => Boolean(it.date || it.nextDate || it.remark));

    const initialDate = parsedObj && typeof parsedObj.initialDate === 'string' ? parsedObj.initialDate : '';
    const meetingDate =
      parsedObj && typeof parsedObj.meetingDate === 'string'
        ? parsedObj.meetingDate
        : initialDate;

    const attendeeClient = parsedObj && typeof parsedObj.attendeeClient === 'string' ? parsedObj.attendeeClient : '';
    const attendeeSIT =
      parsedObj && (typeof parsedObj.attendeeSIT === 'string' || typeof parsedObj.attendeeSit === 'string')
        ? String((parsedObj.attendeeSIT ?? parsedObj.attendeeSit) as string)
        : '';
    const meetingAgenda =
      parsedObj && (typeof parsedObj.meetingAgenda === 'string' || typeof parsedObj.agenda === 'string')
        ? String((parsedObj.meetingAgenda ?? parsedObj.agenda) as string)
        : '';

    // Legacy safety: some older data used initialDate as a meeting marker.
    if (initialDate && !meetings.some((m) => toDateInput(m.date) === toDateInput(initialDate))) {
      meetings = [{ date: initialDate, remark: '' }, ...meetings];
    }

    const contacts: ContactDetailItem[] =
      parsedObj && Array.isArray(parsedObj.contacts) ? parsedObj.contacts : [];

    return {
      meetingDate: toDateInput(meetingDate),
      attendeeClient,
      attendeeSIT,
      meetingAgenda,
      meetings,
      contacts,
    };
  } catch {
    return {
      meetingDate: '',
      attendeeClient: '',
      attendeeSIT: '',
      meetingAgenda: '',
      meetings: [],
      contacts: [],
    };
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

  const [activeTab, setActiveTab] = useState<'inquiry' | 'meeting' | 'discussion' | 'followups' | 'contacts'>('inquiry');
  const [minutesOfMeeting, setMinutesOfMeeting] = useState('');

  const [meetingDetails, setMeetingDetails] = useState<MeetingDetailsItem[]>([]);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDetailsItem>({
    meetingDate: '',
    attendeeClient: '',
    attendeeSIT: '',
    meetingAgenda: '',
  });
  const [editingMeetingIndex, setEditingMeetingIndex] = useState<number | null>(null);

  const [followUps, setFollowUps] = useState<MeetingItem[]>([]);
  const [followUpDraft, setFollowUpDraft] = useState<MeetingItem>({ date: '', nextDate: '', remark: '' });
  const [editingFollowUpIndex, setEditingFollowUpIndex] = useState<number | null>(null);

  const [contacts, setContacts] = useState<ContactDetailItem[]>([]);
  const [contactDraft, setContactDraft] = useState<ContactDetailItem>({
    fullName: '',
    email: '',
    phoneNumber: '',
    alternateNumber: '',
    jobTitle: '',
    industry: '',
    location: '',
  });
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);

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
        setFollowUps(parsedFollowUp.meetings);
        if (parsedFollowUp.contacts) {
          setContacts(parsedFollowUp.contacts);
        }

        // Meeting details: support both the new list format and legacy single-row keys.
        let loadedMeetingDetails: MeetingDetailsItem[] = [];
        try {
          const parsed: unknown = r.FollowUp ? JSON.parse(r.FollowUp) : null;
          const obj = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
          const rawMeetingDetails = obj && Array.isArray(obj.meetingDetails) ? obj.meetingDetails : [];
          loadedMeetingDetails = rawMeetingDetails
            .map((it: unknown) => {
              const rec = typeof it === 'object' && it !== null ? (it as Record<string, unknown>) : {};
              const md = typeof rec.meetingDate === 'string' ? toDateInput(rec.meetingDate) : '';
              return {
                meetingDate: md,
                attendeeClient: typeof rec.attendeeClient === 'string' ? rec.attendeeClient : '',
                attendeeSIT:
                  typeof rec.attendeeSIT === 'string'
                    ? rec.attendeeSIT
                    : typeof rec.attendeeSit === 'string'
                      ? (rec.attendeeSit as string)
                      : '',
                meetingAgenda:
                  typeof rec.meetingAgenda === 'string'
                    ? rec.meetingAgenda
                    : typeof rec.agenda === 'string'
                      ? (rec.agenda as string)
                      : '',
              };
            })
            .filter((x) => Boolean(x.meetingDate || x.attendeeClient || x.attendeeSIT || x.meetingAgenda));
        } catch {
          // ignore
        }

        if (loadedMeetingDetails.length === 0 && (parsedFollowUp.meetingDate || parsedFollowUp.attendeeClient || parsedFollowUp.attendeeSIT || parsedFollowUp.meetingAgenda)) {
          loadedMeetingDetails = [
            {
              meetingDate: parsedFollowUp.meetingDate,
              attendeeClient: parsedFollowUp.attendeeClient,
              attendeeSIT: parsedFollowUp.attendeeSIT,
              meetingAgenda: parsedFollowUp.meetingAgenda,
            },
          ];
        }
        setMeetingDetails(loadedMeetingDetails);
        setMeetingDraft({
          meetingDate: '',
          attendeeClient: '',
          attendeeSIT: '',
          meetingAgenda: '',
        });
        setEditingMeetingIndex(null);
        setMinutesOfMeeting(typeof r.Discussion === 'string' ? r.Discussion : '');
        setFollowUpDraft({ date: '', nextDate: '', remark: '' });
        setEditingFollowUpIndex(null);
        setContactDraft({
          fullName: '', email: '', phoneNumber: '', alternateNumber: '',
          jobTitle: '', industry: '', location: ''
        });
        setEditingContactIndex(null);

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

  const buildFollowUpJson = () =>
    JSON.stringify({
      // Keep these keys for backward compatibility with existing readers.
      initialDate: (meetingDetails[meetingDetails.length - 1]?.meetingDate || '') as string,
      meetingDate: (meetingDetails[meetingDetails.length - 1]?.meetingDate || '') as string,
      attendeeClient: (meetingDetails[meetingDetails.length - 1]?.attendeeClient || '') as string,
      attendeeSIT: (meetingDetails[meetingDetails.length - 1]?.attendeeSIT || '') as string,
      meetingAgenda: (meetingDetails[meetingDetails.length - 1]?.meetingAgenda || '') as string,
      meetingDetails,
      meetings: followUps,
      // Optional alias to make the intent obvious for future code.
      followUps: followUps,
      contacts,
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

      Discussion: minutesOfMeeting,
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

      Discussion: minutesOfMeeting,
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

      {/* Tabbed: Inquiry Information / Meeting Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-bold text-gray-800">Training Discussion</div>
            <div className="text-xs text-gray-500">Inquiry information and meeting details</div>
          </div>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
            {([
              { key: 'inquiry', label: 'Inquiry Information' },
              { key: 'meeting', label: 'Meeting Details' },
              { key: 'discussion', label: 'Discussion' },
              { key: 'followups', label: 'Follow Ups' },
              { key: 'contacts', label: 'Contact Details' },
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
        </div>

        {activeTab === 'inquiry' && (
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
        )}

        {activeTab === 'meeting' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3">
                <label className={labelCls}>Meeting Date</label>
                <input
                  type="date"
                  className={inputCls + ' h-[38px]'}
                  value={meetingDraft.meetingDate}
                  onChange={(e) => setMeetingDraft((d) => ({ ...d, meetingDate: e.target.value }))}
                />
              </div>

              <div className="md:col-span-7">
                <label className={labelCls}>Meeting Agenda</label>
                <textarea
                  rows={1}
                  className={inputCls + ' h-[38px] resize-none'}
                  value={meetingDraft.meetingAgenda}
                  onChange={(e) => setMeetingDraft((d) => ({ ...d, meetingAgenda: e.target.value }))}
                  placeholder="Meeting agenda"
                />
              </div>

              <div className="md:col-span-2 flex flex-col justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const hasAny =
                      Boolean(meetingDraft.meetingDate) ||
                      Boolean(meetingDraft.meetingAgenda?.trim()) ||
                      Boolean(meetingDraft.attendeeClient?.trim()) ||
                      Boolean(meetingDraft.attendeeSIT?.trim());
                    if (!hasAny) return;
                    setMeetingDetails((prev) => {
                      if (editingMeetingIndex === null) return [...prev, meetingDraft];
                      return prev.map((it, idx) => (idx === editingMeetingIndex ? meetingDraft : it));
                    });
                    setMeetingDraft({ meetingDate: '', attendeeClient: '', attendeeSIT: '', meetingAgenda: '' });
                    setEditingMeetingIndex(null);
                  }}
                  className="w-full h-[38px] px-4 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60"
                  disabled={saving}
                >
                  {editingMeetingIndex === null ? 'Add' : 'Update'}
                </button>

                {editingMeetingIndex !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setMeetingDraft({ meetingDate: '', attendeeClient: '', attendeeSIT: '', meetingAgenda: '' });
                      setEditingMeetingIndex(null);
                    }}
                    className="w-full h-[38px] px-4 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="md:col-span-12">
                <div className={labelCls}>Attendee</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={labelCls}>Client</div>
                    <textarea
                      className={inputCls + ' min-h-[70px]'}
                      value={meetingDraft.attendeeClient}
                      onChange={(e) => setMeetingDraft((d) => ({ ...d, attendeeClient: e.target.value }))}
                      placeholder="Client attendees (one per line)"
                    />
                  </div>
                  <div>
                    <div className={labelCls}>SIT</div>
                    <textarea
                      className={inputCls + ' min-h-[70px]'}
                      value={meetingDraft.attendeeSIT}
                      onChange={(e) => setMeetingDraft((d) => ({ ...d, attendeeSIT: e.target.value }))}
                      placeholder="SIT attendees (one per line)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-700">
                  <tr className="border-b border-gray-100">
                    <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Meeting Date</th>
                    <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Attendee (Client)</th>
                    <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Attendee (SIT)</th>
                    <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Meeting Agenda</th>
                    <th className="px-3 py-3 text-right font-semibold text-[11px] uppercase tracking-wider text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {meetingDetails.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-gray-500" colSpan={5}>
                        No meeting details yet
                      </td>
                    </tr>
                  ) : (
                    meetingDetails.map((m, idx) => (
                      <tr
                        key={`${m.meetingDate}-${idx}`}
                        className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="px-3 py-2 text-gray-900">{toDateInput(m.meetingDate) || '—'}</td>
                        <td className="px-3 py-2 text-gray-900">
                          {splitList(m.attendeeClient).length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <ul className="list-disc pl-4 space-y-0.5">
                              {splitList(m.attendeeClient).map((x, i) => (
                                <li key={i} className="text-gray-900">
                                  {x}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {splitList(m.attendeeSIT).length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <ul className="list-disc pl-4 space-y-0.5">
                              {splitList(m.attendeeSIT).map((x, i) => (
                                <li key={i} className="text-gray-900">
                                  {x}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-900 whitespace-pre-wrap">{(m.meetingAgenda || '').trim() || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMeetingIndex(idx);
                                setMeetingDraft({ ...m });
                              }}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMeetingDetails((prev) => prev.filter((_, i) => i !== idx));
                                if (editingMeetingIndex === idx) {
                                  setMeetingDraft({ meetingDate: '', attendeeClient: '', attendeeSIT: '', meetingAgenda: '' });
                                  setEditingMeetingIndex(null);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
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
          <div className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Minutes of Meeting</label>
              <textarea
                className={inputCls + ' min-h-[140px]'}
                value={minutesOfMeeting}
                onChange={(e) => setMinutesOfMeeting(e.target.value)}
                placeholder="Minutes of meeting"
              />
            </div>

            <div>
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
          </div>
        )}

        {activeTab === 'followups' && (
          <div className="p-5 space-y-3">
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
              <div className="md:col-span-3">
                <label className={labelCls}>Next Follow Up Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={followUpDraft.nextDate || ''}
                  onChange={(e) => setFollowUpDraft((d) => ({ ...d, nextDate: e.target.value }))}
                />
              </div>
              <div className="md:col-span-4">
                <label className={labelCls}>Follow Up Remarks</label>
                <input
                  className={inputCls}
                  value={followUpDraft.remark}
                  onChange={(e) => setFollowUpDraft((d) => ({ ...d, remark: e.target.value }))}
                  placeholder="Remark"
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const hasAny = Boolean(followUpDraft.date) || Boolean(followUpDraft.nextDate) || Boolean(followUpDraft.remark?.trim());
                    if (!hasAny) return;
                    setFollowUps((prev) => {
                      if (editingFollowUpIndex === null) return [...prev, followUpDraft];
                      return prev.map((it, idx) => (idx === editingFollowUpIndex ? followUpDraft : it));
                    });
                    setFollowUpDraft({ date: '', nextDate: '', remark: '' });
                    setEditingFollowUpIndex(null);
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60"
                  disabled={saving}
                >
                  {editingFollowUpIndex === null ? 'Add' : 'Update'}
                </button>

                {editingFollowUpIndex !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setFollowUpDraft({ date: '', nextDate: '', remark: '' });
                      setEditingFollowUpIndex(null);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Next Follow Up Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Remark</th>
                    <th className="px-3 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {followUps.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-gray-500" colSpan={4}>
                        No follow ups yet
                      </td>
                    </tr>
                  ) : (
                    followUps.map((m, idx) => (
                      <tr key={`${m.date}-${m.nextDate || ''}-${idx}`} className="bg-white">
                        <td className="px-3 py-2 text-gray-900">{toDateInput(m.date) || '—'}</td>
                        <td className="px-3 py-2 text-gray-900">{toDateInput(m.nextDate) || '—'}</td>
                        <td className="px-3 py-2 text-gray-900">{(m.remark || '').trim() || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFollowUpIndex(idx);
                                setFollowUpDraft({
                                  date: m.date || '',
                                  nextDate: m.nextDate || '',
                                  remark: m.remark || '',
                                });
                              }}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFollowUps((prev) => prev.filter((_, i) => i !== idx));
                                if (editingFollowUpIndex === idx) {
                                  setFollowUpDraft({ date: '', nextDate: '', remark: '' });
                                  setEditingFollowUpIndex(null);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-[1_1_130px]">
                <label className={labelCls}>Full Name</label>
                <input
                  className={inputCls}
                  value={contactDraft.fullName}
                  onChange={(e) => setContactDraft((d) => ({ ...d, fullName: e.target.value }))}
                />
              </div>
              <div className="flex-[1_1_130px]">
                <label className={labelCls}>Email Address</label>
                <input
                  type="email"
                  className={inputCls}
                  value={contactDraft.email}
                  onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div className="flex-[1_1_110px]">
                <label className={labelCls}>Phone Number</label>
                <input
                  className={inputCls}
                  value={contactDraft.phoneNumber}
                  onChange={(e) => setContactDraft((d) => ({ ...d, phoneNumber: e.target.value }))}
                />
              </div>
              <div className="flex-[1_1_110px]">
                <label className={labelCls}>Alternate Number</label>
                <input
                  className={inputCls}
                  value={contactDraft.alternateNumber}
                  onChange={(e) => setContactDraft((d) => ({ ...d, alternateNumber: e.target.value }))}
                />
              </div>
              <div className="flex-[1_1_130px]">
                <label className={labelCls}>Job Title</label>
                <input
                  className={inputCls}
                  value={contactDraft.jobTitle}
                  onChange={(e) => setContactDraft((d) => ({ ...d, jobTitle: e.target.value }))}
                />
              </div>
              <div className="flex-[1_1_100px]">
                <label className={labelCls}>Industry</label>
                <input
                  className={inputCls}
                  value={contactDraft.industry}
                  placeholder="e.g. Tech"
                  onChange={(e) => setContactDraft((d) => ({ ...d, industry: e.target.value }))}
                />
              </div>
              <div className="flex-[1_1_100px]">
                <label className={labelCls}>Location</label>
                <input
                  className={inputCls}
                  value={contactDraft.location}
                  placeholder="City, State"
                  onChange={(e) => setContactDraft((d) => ({ ...d, location: e.target.value }))}
                />
              </div>
              
              <div className="flex-none flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const hasAny = Boolean(contactDraft.fullName?.trim()) || Boolean(contactDraft.email?.trim());
                    if (!hasAny) return;
                    setContacts((prev) => {
                      if (editingContactIndex === null) return [...prev, contactDraft];
                      return prev.map((it, idx) => (idx === editingContactIndex ? contactDraft : it));
                    });
                    setContactDraft({
                      fullName: '', email: '', phoneNumber: '', alternateNumber: '',
                      jobTitle: '', industry: '', location: ''
                    });
                    setEditingContactIndex(null);
                  }}
                  className="h-[30px] px-3 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold shadow hover:shadow-md transition-all disabled:opacity-60 whitespace-nowrap"
                  disabled={saving}
                >
                  {editingContactIndex === null ? 'Add' : 'Update'}
                </button>

                {editingContactIndex !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setContactDraft({
                        fullName: '', email: '', phoneNumber: '', alternateNumber: '',
                        jobTitle: '', industry: '', location: ''
                      });
                      setEditingContactIndex(null);
                    }}
                    className="h-[30px] px-3 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 whitespace-nowrap"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Job Title</th>
                    <th className="px-3 py-2 text-left font-semibold">Contact Info</th>
                    <th className="px-3 py-2 text-left font-semibold">Details</th>
                    <th className="px-3 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-gray-500 text-center" colSpan={5}>
                        No contacts added yet
                      </td>
                    </tr>
                  ) : (
                    contacts.map((c, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-3 py-2 text-gray-900">
                          <div className="font-semibold">{c.fullName || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-900">{c.jobTitle || '—'}</td>
                        <td className="px-3 py-2 text-gray-900">
                          <div>E: {c.email || '—'}</div>
                          <div>P: {c.phoneNumber || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          <div>Industry: {c.industry || '—'}</div>
                          <div>Location: {c.location || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContactIndex(idx);
                                setContactDraft({ ...c });
                              }}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setContacts((prev) => prev.filter((_, i) => i !== idx));
                                if (editingContactIndex === idx) {
                                  setContactDraft({
                                    fullName: '', email: '', phoneNumber: '', alternateNumber: '',
                                    jobTitle: '', industry: '', location: ''
                                  });
                                  setEditingContactIndex(null);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5">
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
