'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const textareaCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

type Inquiry = {
  Id: number;
  Idate?: string | null;
  FullName?: string | null;
  Designation?: string | null;
  CompanyName?: string | null;
  Place?: string | null;
  CompanyType?: string | null;
  CompanyAuthority?: string | null;
  Email?: string | null;
  Mobile?: string | null;
  Phone?: string | null;
  TrainingMode?: string | null;
  Participants_Fresher?: number | null;
  Participants_Experienced?: number | null;
  TrainingLocation?: string | null;
  business?: string | null;
  Remark?: string | null;
  Course_Id?: string | null;

  InquiryStatus?: string | null;

  Discussion?: string | null;
  FollowUp?: string | null;
  DiscussionOutcome?: 'Awarded' | 'Regretted' | 'On Hold' | null;

  TrainingNumber?: string | null;
  TrainingDate?: string | null;
  TrainerName?: string | null;
  NumberOfDays?: number | null;
  TotalStudents?: number | null;
  TrainingCoordinator?: string | null;

  ConfirmDate?: string | null;
  PerformanceEvaluation?: string | null;
  TrainingFeedback?: string | null;
  SitCertification?: string | null;
};

type PerformanceRow = {
  key: 'pre_test' | 'assessment' | 'final_exam' | 'training_material' | 'attendance';
  label: string;
  completed: boolean;
  remarks: string;
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
  discussion: string;
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
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
};

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

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

const defaultPerformanceRows = (): PerformanceRow[] => ([
  { key: 'pre_test', label: 'Pre Test', completed: false, remarks: '' },
  { key: 'assessment', label: 'Assessment', completed: false, remarks: '' },
  { key: 'final_exam', label: 'Final Exam', completed: false, remarks: '' },
  { key: 'training_material', label: 'Training Material', completed: false, remarks: '' },
  { key: 'attendance', label: 'Attendance', completed: false, remarks: '' },
]);

export default function CorporateInquiryFinalPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const inquiryId = useMemo(() => Number(id), [id]);
  const searchParams = useSearchParams();

  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const defaultTab = useMemo(() => {
    const t = searchParams.get('tab');
    return t === 'discussion' || t === 'schedule' || t === 'feedback' || t === 'certification' ? t : 'inquiry';
  }, [searchParams]);
  const defaultDiscussionTab = useMemo(() => {
    const t = searchParams.get('dtab');
    return t === 'meeting' || t === 'discussion' || t === 'contacts' ? t : 'meeting';
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<'inquiry' | 'discussion' | 'schedule' | 'feedback' | 'certification'>(defaultTab);
  const [discussionTab, setDiscussionTab] = useState<'meeting' | 'discussion' | 'contacts'>(defaultDiscussionTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    TrainingNumber: '',
    TrainingDate: '',
    TrainerName: '',
    NumberOfDays: '',
    TotalStudents: '',
    TrainingCoordinator: '',
    ConfirmDate: '',
    DocumentType: 'P/O',
    DocumentNumber: '',
    SitCorporateProgramCode: '',
  });
  const [performanceRows, setPerformanceRows] = useState<PerformanceRow[]>(defaultPerformanceRows());
  const [trainingFeedback, setTrainingFeedback] = useState('');
  const [sitCertification, setSitCertification] = useState<'Yes' | 'No' | ''>('');
  const [studentEntry, setStudentEntry] = useState({
    studentId: '',
    studentName: '',
    studentNumber: '',
    rollNumber: '',
  });
  const [nextRollNumber, setNextRollNumber] = useState(179);
  const [minutesOfMeeting, setMinutesOfMeeting] = useState('');
  const [discussionOutcome, setDiscussionOutcome] = useState<'' | 'Awarded' | 'Regretted' | 'On Hold'>('');
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetailsItem[]>([]);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDetailsItem>({
    meetingDate: '',
    attendeeClient: '',
    attendeeSIT: '',
    meetingAgenda: '',
  });
  const [editingMeetingIndex, setEditingMeetingIndex] = useState<number | null>(null);
  const [followUps, setFollowUps] = useState<MeetingItem[]>([]);
  const [contacts, setContacts] = useState<ContactDetailItem[]>([]);
  const [contactDraft, setContactDraft] = useState<ContactDetailItem>({
    fullName: '',
    email: '',
    phoneNumber: '',
    alternateNumber: '',
    jobTitle: '',
    industry: '',
    discussion: '',
  });
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);

  const formatRollNumber = (seq: number) => {
    const year = new Date().getFullYear().toString().slice(-2);
    const code = scheduleForm.SitCorporateProgramCode || '000';
    return `${year}${code}CT${seq}`;
  };

  const handleAllotRollNumber = () => {
    const roll = formatRollNumber(nextRollNumber);
    setStudentEntry((s) => ({ ...s, rollNumber: roll }));
    setNextRollNumber((n) => n + 1);
  };

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

        setScheduleForm({
          TrainingNumber: r.TrainingNumber || '',
          TrainingDate: toDateInput(r.TrainingDate),
          TrainerName: r.TrainerName || '',
          NumberOfDays: r.NumberOfDays === null || r.NumberOfDays === undefined ? '' : String(r.NumberOfDays),
          TotalStudents: r.TotalStudents === null || r.TotalStudents === undefined ? '' : String(r.TotalStudents),
          TrainingCoordinator: r.TrainingCoordinator || '',
          ConfirmDate: toDateInput(r.ConfirmDate),
          DocumentType: 'P/O',
          DocumentNumber: '',
          SitCorporateProgramCode: '',
        });

        const parsedFollowUp = parseFollowUpJson(r.FollowUp);
        setFollowUps(parsedFollowUp.meetings);
        if (parsedFollowUp.contacts) {
          setContacts(parsedFollowUp.contacts);
        }

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
        setContactDraft({
          fullName: '',
          email: '',
          phoneNumber: '',
          alternateNumber: '',
          jobTitle: '',
          industry: '',
          discussion: '',
        });
        setEditingContactIndex(null);
        setDiscussionOutcome(r.DiscussionOutcome === 'Awarded' || r.DiscussionOutcome === 'Regretted' || r.DiscussionOutcome === 'On Hold' ? r.DiscussionOutcome : '');

        const parsed = safeJsonParse<Partial<PerformanceRow>[]>(r.PerformanceEvaluation, []);
        const defaults = defaultPerformanceRows();
        const merged = defaults.map(d => {
          const found = parsed.find(p => p.key === d.key);
          return {
            ...d,
            completed: Boolean(found?.completed ?? d.completed),
            remarks: String(found?.remarks ?? d.remarks),
          };
        });
        setPerformanceRows(merged);

        setTrainingFeedback(r.TrainingFeedback || '');
        const cert = r.SitCertification;
        setSitCertification(cert === 'Yes' || cert === 'No' ? cert : '');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load inquiry');
      } finally {
        setLoading(false);
      }
    })();
  }, [inquiryId]);

  const buildFollowUpJson = () =>
    JSON.stringify({
      initialDate: (meetingDetails[meetingDetails.length - 1]?.meetingDate || '') as string,
      meetingDate: (meetingDetails[meetingDetails.length - 1]?.meetingDate || '') as string,
      attendeeClient: (meetingDetails[meetingDetails.length - 1]?.attendeeClient || '') as string,
      attendeeSIT: (meetingDetails[meetingDetails.length - 1]?.attendeeSIT || '') as string,
      meetingAgenda: (meetingDetails[meetingDetails.length - 1]?.meetingAgenda || '') as string,
      meetingDetails,
      meetings: followUps,
      followUps,
      contacts,
    });

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Id: inquiryId,
          InquiryStatus: 'Final',
          TrainingNumber: scheduleForm.TrainingNumber,
          TrainingDate: scheduleForm.TrainingDate,
          TrainerName: scheduleForm.TrainerName,
          NumberOfDays: scheduleForm.NumberOfDays,
          TotalStudents: scheduleForm.TotalStudents,
          TrainingCoordinator: scheduleForm.TrainingCoordinator,
          ConfirmDate: scheduleForm.ConfirmDate,
          Discussion: minutesOfMeeting,
          DiscussionOutcome: discussionOutcome || null,
          FollowUp: buildFollowUpJson(),
          PerformanceEvaluation: JSON.stringify(performanceRows),
          TrainingFeedback: trainingFeedback,
          SitCertification: sitCertification,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess('Final phase saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to update corporate inquiries." />;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/corporate-inquiry')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Final Phase</h2>
            <p className="text-xs text-white/70">
              Corporate Inquiry #{inquiryId}{inquiry?.CompanyName ? ` • ${inquiry.CompanyName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inquiryId}`)}
              className="px-4 py-2 rounded-lg bg-white text-[#2E3093] text-sm font-semibold hover:bg-white/90 transition-colors"
              title="Inquiry details"
            >
              Inquiry Details
            </button>
            <button
              onClick={() => {
                setActiveTab('discussion');
                setDiscussionTab('meeting');
              }}
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
              title="Under discussion"
            >
              Under Discussion
            </button>
            <button
              onClick={() => router.push(`/dashboard/corporate-inquiry/final/edit/${inquiryId}`)}
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
              title="Edit execution"
            >
              Edit Execution
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-5 bg-gray-50/80">
          {([
            ['inquiry', 'Inquiry'],
            ['discussion', 'Training Discussion'],
            ['schedule', 'Schedule Plan'],
            ['feedback', 'Training Feedback'],
            ['certification', 'SIT Certification'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === key
                  ? 'border-[#2E3093] text-[#2E3093] bg-white -mb-px rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(error || success) && (
          <div className="p-4">
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">{success}</div>}
          </div>
        )}

        <div className="p-5">
          {activeTab === 'inquiry' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-gray-800">Inquiry Details</div>
                <button
                  onClick={() => router.push(`/dashboard/corporate-inquiry/final/edit/${inquiryId}`)}
                  className="px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#252779] transition-colors"
                >
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                <div>
                  <label className={labelCls}>Company</label>
                  <input className={inputCls} value={inquiry?.CompanyName || ''} disabled />
                </div>
                <div>
                  <label className={labelCls}>Inquirer</label>
                  <input className={inputCls} value={inquiry?.FullName || ''} disabled />
                </div>
                <div>
                  <label className={labelCls}>Course</label>
                  <input className={inputCls} value={inquiry?.Course_Id || ''} disabled />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} value={inquiry?.Email || ''} disabled />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={inquiry?.Mobile || inquiry?.Phone || ''} disabled />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <input className={inputCls} value={inquiry?.InquiryStatus || ''} disabled />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-bold text-gray-800">Training Discussion</div>
                  <div className="text-xs text-gray-500">Inquiry details, meetings, discussion, contacts</div>
                </div>
                <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                  {([
                    { key: 'meeting', label: 'Meeting Details' },
                    { key: 'discussion', label: 'Discussion' },
                    { key: 'contacts', label: 'Contact Details' },
                  ] as const).map((t) => {
                    const active = discussionTab === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setDiscussionTab(t.key)}
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

              {discussionTab === 'meeting' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-[1_1_130px]">
                      <label className={labelCls}>Meeting Date</label>
                      <input
                        type="date"
                        className={inputCls + ' h-[38px]'}
                        value={meetingDraft.meetingDate}
                        onChange={(e) => setMeetingDraft((d) => ({ ...d, meetingDate: e.target.value }))}
                      />
                    </div>

                    <div className="flex-[3_1_300px]">
                      <label className={labelCls}>Meeting Agenda</label>
                      <textarea
                        rows={1}
                        className={inputCls + ' h-[38px] resize-none'}
                        value={meetingDraft.meetingAgenda}
                        onChange={(e) => setMeetingDraft((d) => ({ ...d, meetingAgenda: e.target.value }))}
                        placeholder="Meeting agenda"
                      />
                    </div>

                    <div className="flex-none flex items-center gap-2">
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
                        className="h-[30px] px-3 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold shadow hover:shadow-md transition-all disabled:opacity-60 whitespace-nowrap"
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
                          className="h-[30px] px-3 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60 whitespace-nowrap"
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div className="w-full mt-2">
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

              {discussionTab === 'discussion' && (
                <div className="space-y-4">
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
                        const active = discussionOutcome === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setDiscussionOutcome(opt.key)}
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

              {discussionTab === 'contacts' && (
                <div className="space-y-3">
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
                      <label className={labelCls}>Discussion</label>
                      <input
                        className={inputCls}
                        value={contactDraft.discussion}
                        placeholder="Discussion"
                        onChange={(e) => setContactDraft((d) => ({ ...d, discussion: e.target.value }))}
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
                            jobTitle: '', industry: '', discussion: ''
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
                              jobTitle: '', industry: '', discussion: ''
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
                          <th className="px-3 py-2 text-left font-semibold">Discussion</th>
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
                                <div>Discussion: {c.discussion || '—'}</div>
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
                                          jobTitle: '', industry: '', discussion: ''
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
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">Schedule</h3>
                  <span className="text-[11px] text-gray-500">Company: {inquiry?.CompanyName || '-'}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                  <div>
                    <label className={labelCls}>P/O • S/O • W/O</label>
                    <select
                      className={selectCls}
                      value={scheduleForm.DocumentType}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, DocumentType: e.target.value }))}
                    >
                      <option value="P/O">P/O</option>
                      <option value="S/O">S/O</option>
                      <option value="W/O">W/O</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Number</label>
                    <input
                      className={inputCls}
                      value={scheduleForm.DocumentNumber}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, DocumentNumber: e.target.value }))}
                      placeholder="Enter number"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Training Programme Code</label>
                    <input
                      className={inputCls}
                      value={scheduleForm.TrainingNumber}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, TrainingNumber: e.target.value }))}
                      placeholder="Programme code"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>SIT Corporate Training Programme Code</label>
                    <input
                      className={inputCls}
                      value={scheduleForm.SitCorporateProgramCode}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, SitCorporateProgramCode: e.target.value }))}
                      placeholder="SIT code"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Training Duration (days)</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={scheduleForm.NumberOfDays}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, NumberOfDays: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Total Students</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={scheduleForm.TotalStudents}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, TotalStudents: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Trainer Name</label>
                    <input
                      className={inputCls}
                      value={scheduleForm.TrainerName}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, TrainerName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Training Co-ordinator</label>
                    <input
                      className={inputCls}
                      value={scheduleForm.TrainingCoordinator}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, TrainingCoordinator: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={scheduleForm.ConfirmDate}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, ConfirmDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">Performance</h3>
                  <span className="text-[11px] text-gray-500">Roll format: YY + SIT code + CT + seq (starting at 179)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-2">
                  <div>
                    <label className={labelCls}>Student ID</label>
                    <input
                      className={inputCls}
                      value={studentEntry.studentId}
                      onChange={(e) => setStudentEntry((s) => ({ ...s, studentId: e.target.value }))}
                      placeholder="Enter student ID"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Student Name</label>
                    <input
                      className={inputCls}
                      value={studentEntry.studentName}
                      onChange={(e) => setStudentEntry((s) => ({ ...s, studentName: e.target.value }))}
                      placeholder="Enter student name"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Student Number</label>
                    <input
                      className={inputCls}
                      value={studentEntry.studentNumber}
                      onChange={(e) => setStudentEntry((s) => ({ ...s, studentNumber: e.target.value }))}
                      placeholder="Enter student number"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Roll Number</label>
                    <input className={inputCls} value={studentEntry.rollNumber} disabled placeholder="Auto when allotted" />
                  </div>
                  <div className="md:col-span-4 flex items-center justify-end">
                    <button
                      onClick={handleAllotRollNumber}
                      className="px-4 py-2 rounded-lg bg-[#2E3093] text-white text-xs font-semibold hover:bg-[#252779]"
                    >
                      Allot Roll Number
                    </button>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">Performance Evaluation</h3>
                  <p className="text-xs text-gray-500">Pre Test, Assessment, Final Exam, Training Material, Attendance</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-white border-b border-gray-100">
                        <th className="text-left py-2 px-4 font-semibold">Item</th>
                        <th className="text-left py-2 px-4 font-semibold">Completed</th>
                        <th className="text-left py-2 px-4 font-semibold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceRows.map((row, idx) => (
                        <tr key={row.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="py-2 px-4 text-gray-700">{row.label}</td>
                          <td className="py-2 px-4">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={row.completed}
                                onChange={(e) => setPerformanceRows((rows) => rows.map(r => r.key === row.key ? { ...r, completed: e.target.checked } : r))}
                              />
                              Completed
                            </label>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              className={inputCls}
                              value={row.remarks}
                              onChange={(e) => setPerformanceRows((rows) => rows.map(r => r.key === row.key ? { ...r, remarks: e.target.value } : r))}
                              placeholder="Remarks"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'feedback' && (
            <div>
              <label className={labelCls}>Training Feedback</label>
              <textarea className={textareaCls} rows={5} value={trainingFeedback} onChange={(e) => setTrainingFeedback(e.target.value)} placeholder="Training feedback" />
            </div>
          )}

          {activeTab === 'certification' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
              <div>
                <label className={labelCls}>SIT Certification</label>
                <select
                  className={selectCls}
                  value={sitCertification}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSitCertification(v === 'Yes' || v === 'No' ? v : '');
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-5 gap-2">
            <button
              onClick={() => router.push(`/dashboard/corporate-inquiry/final/edit/${inquiryId}`)}
              className="px-4 py-2 rounded-lg border border-[#2E3093]/40 text-[#2E3093] text-sm font-semibold hover:bg-[#2E3093]/5"
            >
              Edit Execution
            </button>
            <button
              onClick={() => router.push('/dashboard/corporate-inquiry')}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
