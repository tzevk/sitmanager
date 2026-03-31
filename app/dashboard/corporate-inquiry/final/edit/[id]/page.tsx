'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

  ConfirmDate?: string | null;
  PerformanceEvaluation?: string | null;
  TrainingFeedback?: string | null;
  SitCertification?: string | null;
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

type MeetingDetailsItem = {
  meetingDate: string;
  attendeeClient: string;
  attendeeSIT: string;
  meetingAgenda: string;
};

type PerformanceRow = {
  key: 'pre_test' | 'assessment' | 'final_exam' | 'training_material' | 'attendance';
  label: string;
  completed: boolean;
  remarks: string;
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

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const defaultPerformanceRows = (): PerformanceRow[] => ([
  { key: 'pre_test', label: 'Pre Test', completed: false, remarks: '' },
  { key: 'assessment', label: 'Assessment', completed: false, remarks: '' },
  { key: 'final_exam', label: 'Final Exam', completed: false, remarks: '' },
  { key: 'training_material', label: 'Training Material', completed: false, remarks: '' },
  { key: 'attendance', label: 'Attendance', completed: false, remarks: '' },
]);

type FollowUpJsonData = {
  meetingDetails?: MeetingDetailsItem[];
  meetings?: MeetingItem[];
  followUps?: MeetingItem[];
  contacts?: ContactDetailItem[];
  // legacy fields
  initialDate?: string;
  meetingDate?: string;
  attendeeClient?: string;
  attendeeSIT?: string;
  attendeeSit?: string;
  meetingAgenda?: string;
  agenda?: string;
};


function parseFollowUpJson(raw: string | null | undefined) {
  const fallback = {
    meetingDetails: [],
    meetings: [],
    contacts: [],
  };
  if (!raw) return fallback;

  try {
    const parsed = safeJsonParse<FollowUpJsonData>(raw, {});

    const rawMeetingDetails = parsed.meetingDetails ?? [];
    let loadedMeetingDetails: MeetingDetailsItem[] = rawMeetingDetails
      .map((it: any) => ({
        meetingDate: toDateInput(it.meetingDate),
        attendeeClient: it.attendeeClient || '',
        attendeeSIT: it.attendeeSIT || it.attendeeSit || '',
        meetingAgenda: it.meetingAgenda || it.agenda || '',
      }))
      .filter((x: any) => x.meetingDate || x.attendeeClient || x.attendeeSIT || x.meetingAgenda);

    if (loadedMeetingDetails.length === 0 && (parsed.meetingDate || parsed.attendeeClient || parsed.attendeeSIT || parsed.meetingAgenda)) {
      loadedMeetingDetails = [{
        meetingDate: toDateInput(parsed.meetingDate),
        attendeeClient: parsed.attendeeClient || '',
        attendeeSIT: parsed.attendeeSIT || parsed.attendeeSit || '',
        meetingAgenda: parsed.meetingAgenda || parsed.agenda || '',
      }];
    }

    const rawMeetings = parsed.meetings ?? parsed.followUps ?? [];
    let meetings: MeetingItem[] = rawMeetings
      .map((it: any) => ({
        date: it.date || '',
        nextDate: it.nextDate || it.nextFollowUpDate || it.next_follow_up_date || '',
        remark: it.remark || '',
      }))
      .filter((it: any) => it.date || it.nextDate || it.remark);

    if (parsed.initialDate && !meetings.some(m => toDateInput(m.date) === toDateInput(parsed.initialDate))) {
      meetings = [{ date: parsed.initialDate, remark: '' }, ...meetings];
    }

    const contacts: ContactDetailItem[] = parsed.contacts ?? [];

    return { meetingDetails: loadedMeetingDetails, meetings, contacts };
  } catch {
    return fallback;
  }
}


export default function CorporateInquiryEditPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const inquiryId = useMemo(() => Number(id), [id]);

  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [activeTab, setActiveTab] = useState<'inquiry' | 'discussion' | 'schedule' | 'feedback'>('inquiry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);

  // --- State from 'convert' page ---
  const [form, setForm] = useState({
    TrainingNumber: '',
    TrainingDate: '',
    TrainerName: '',
    NumberOfDays: '',
    TotalStudents: '',
    TrainingCoordinator: '',
    DiscussionOutcome: '' as '' | 'Awarded' | 'Regretted' | 'On Hold',
  });
  const [minutesOfMeeting, setMinutesOfMeeting] = useState('');
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetailsItem[]>([]);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDetailsItem>({ meetingDate: '', attendeeClient: '', attendeeSIT: '', meetingAgenda: '' });
  const [editingMeetingIndex, setEditingMeetingIndex] = useState<number | null>(null);
  const [followUps, setFollowUps] = useState<MeetingItem[]>([]);
  const [followUpDraft, setFollowUpDraft] = useState<MeetingItem>({ date: '', nextDate: '', remark: '' });
  const [editingFollowUpIndex, setEditingFollowUpIndex] = useState<number | null>(null);
  const [contacts, setContacts] = useState<ContactDetailItem[]>([]);
  const [contactDraft, setContactDraft] = useState<ContactDetailItem>({ fullName: '', email: '', phoneNumber: '', alternateNumber: '', jobTitle: '', industry: '', location: '' });
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);

  // --- State from 'final' page ---
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
  const [intakeLink, setIntakeLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [studentIntakes, setStudentIntakes] = useState<{ id: number; studentName: string; phoneNumber: string; createdAt: string; rollNumber?: string | null; }[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [assigningRolls, setAssigningRolls] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadStudentIntakes = async (inqId: number) => {
    setStudentLoading(true);
    try {
      const res = await fetch(`/api/admission-activity/corporate-inquiry/student-intakes?inquiryId=${inqId}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load students');
      setStudentIntakes((data.intakes || []).map((r: any) => ({
        id: r.Id,
        studentName: r.studentName,
        phoneNumber: r.phoneNumber,
        createdAt: r.createdAt,
        rollNumber: r.rollNumber,
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load students');
    } finally {
      setStudentLoading(false);
    }
  };

  const handleGenerateIntakeLink = async () => {
    setGeneratingLink(true);
    setCopied(false);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry/student-intake-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not generate link');
      setIntakeLink(data.link);
      setSuccess('Student intake link ready');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not generate link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyIntakeLink = async () => {
    if (!intakeLink) return;
    try {
      await navigator.clipboard.writeText(intakeLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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

        // Load data for 'convert' part
        const parsedFollowUp = parseFollowUpJson(r.FollowUp);
        setMeetingDetails(parsedFollowUp.meetingDetails);
        setFollowUps(parsedFollowUp.meetings);
        setContacts(parsedFollowUp.contacts || []);
        setMinutesOfMeeting(r.Discussion || '');

        setForm({
          TrainingNumber: r.TrainingNumber || '',
          TrainingDate: toDateInput(r.TrainingDate),
          TrainerName: r.TrainerName || '',
          NumberOfDays: r.NumberOfDays === null || r.NumberOfDays === undefined ? '' : String(r.NumberOfDays),
          TotalStudents: r.TotalStudents === null || r.TotalStudents === undefined ? '' : String(r.TotalStudents),
          TrainingCoordinator: r.TrainingCoordinator || '',
          DiscussionOutcome: r.DiscussionOutcome === 'Awarded' || r.DiscussionOutcome === 'Regretted' || r.DiscussionOutcome === 'On Hold' ? r.DiscussionOutcome : '',
        });

        // Load data for 'final' part
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

        const parsedPerf = safeJsonParse<Partial<PerformanceRow>[]>(r.PerformanceEvaluation, []);
        const defaults = defaultPerformanceRows();
        const mergedPerf = defaults.map(d => {
          const found = parsedPerf.find(p => p.key === d.key);
          return { ...d, completed: !!found?.completed, remarks: String(found?.remarks || '') };
        });
        setPerformanceRows(mergedPerf);

        setTrainingFeedback(r.TrainingFeedback || '');
        const cert = r.SitCertification;
        setSitCertification(cert === 'Yes' || cert === 'No' ? cert : '');

        await loadStudentIntakes(inquiryId);

      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load inquiry');
      } finally {
        setLoading(false);
      }
    })();
  }, [inquiryId]);

  const buildFollowUpJson = () =>
    JSON.stringify({
      meetingDetails,
      meetings: followUps,
      followUps: followUps, // alias
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
          // 'convert' fields
          Discussion: minutesOfMeeting,
          FollowUp: buildFollowUpJson(),
          DiscussionOutcome: form.DiscussionOutcome || null,
          // 'final' fields (some overlap with convert, scheduleForm is more editable)
          TrainingNumber: scheduleForm.TrainingNumber,
          TrainingDate: scheduleForm.TrainingDate,
          TrainerName: scheduleForm.TrainerName,
          NumberOfDays: scheduleForm.NumberOfDays,
          TotalStudents: scheduleForm.TotalStudents,
          TrainingCoordinator: scheduleForm.TrainingCoordinator,
          ConfirmDate: scheduleForm.ConfirmDate,
          PerformanceEvaluation: JSON.stringify(performanceRows),
          TrainingFeedback: trainingFeedback,
          SitCertification: sitCertification,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess('Saved successfully');
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
            onClick={() => router.back()}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Edit Training Execution</h2>
            <p className="text-xs text-white/70">
              Corporate Inquiry #{inquiryId}{inquiry?.CompanyName ? ` • ${inquiry.CompanyName}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-5 bg-gray-50/80">
          {([
            ['inquiry', 'Inquiry Details'],
            ['discussion', 'Discussion & Follow-ups'],
            ['schedule', 'Schedule & Performance'],
            ['feedback', 'Feedback & Certification'],
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
          )}

          {activeTab === 'discussion' && (
            <div className="space-y-6">
              {/* Minutes of Meeting and Discussion Outcome */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Discussion Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Minutes of Meeting</label>
                    <textarea
                      className={textareaCls + ' min-h-[120px]'}
                      value={minutesOfMeeting}
                      onChange={(e) => setMinutesOfMeeting(e.target.value)}
                      placeholder="Minutes of meeting"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Discussion Outcome</label>
                    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                      {(['Awarded', 'Regretted', 'On Hold'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, DiscussionOutcome: opt }))}
                          className={`px-3 py-1.5 text-xs font-semibold transition-colors border-r border-gray-300 last:border-r-0 ${form.DiscussionOutcome === opt ? 'bg-[#2E3093] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Meeting Details */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Meeting Details</h3>
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
              </div>

              {/* Follow Ups */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Follow Ups</h3>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-[1_1_130px]">
                      <label className={labelCls}>Follow Up Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={followUpDraft.date}
                        onChange={(e) => setFollowUpDraft((d) => ({ ...d, date: e.target.value }))}
                      />
                    </div>
                    <div className="flex-[1_1_130px]">
                      <label className={labelCls}>Next Follow Up Date</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={followUpDraft.nextDate || ''}
                        onChange={(e) => setFollowUpDraft((d) => ({ ...d, nextDate: e.target.value }))}
                      />
                    </div>
                    <div className="flex-[3_1_300px]">
                      <label className={labelCls}>Follow Up Remarks</label>
                      <input
                        className={inputCls}
                        value={followUpDraft.remark}
                        onChange={(e) => setFollowUpDraft((d) => ({ ...d, remark: e.target.value }))}
                        placeholder="Remark"
                      />
                    </div>
                    <div className="flex-none flex items-center gap-2">
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
                        className="h-[30px] px-4 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold shadow hover:shadow-md transition-all disabled:opacity-60 whitespace-nowrap"
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
                          className="h-[30px] px-4 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 whitespace-nowrap"
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
              </div>

              {/* Contact Details */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Contact Details</h3>
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
                          <th className="px-3 py-2 text-left font-semibold">Full Name</th>
                          <th className="px-3 py-2 text-left font-semibold">Email</th>
                          <th className="px-3 py-2 text-left font-semibold">Phone</th>
                          <th className="px-3 py-2 text-left font-semibold">Job Title</th>
                          <th className="px-3 py-2 text-left font-semibold">Industry</th>
                          <th className="px-3 py-2 text-left font-semibold">Location</th>
                          <th className="px-3 py-2 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {contacts.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-gray-500" colSpan={7}>
                              No contacts yet
                            </td>
                          </tr>
                        ) : (
                          contacts.map((c, idx) => (
                            <tr key={`${c.email}-${idx}`} className="bg-white">
                              <td className="px-3 py-2 text-gray-900">{c.fullName}</td>
                              <td className="px-3 py-2 text-gray-900">{c.email}</td>
                              <td className="px-3 py-2 text-gray-900">{c.phoneNumber}{c.alternateNumber ? `, ${c.alternateNumber}`: ''}</td>
                              <td className="px-3 py-2 text-gray-900">{c.jobTitle}</td>
                              <td className="px-3 py-2 text-gray-900">{c.industry}</td>
                              <td className="px-3 py-2 text-gray-900">{c.location}</td>
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
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">Schedule</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500">Company: {inquiry?.CompanyName || '-'}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateIntakeLink}
                        disabled={generatingLink}
                        className="px-3 py-1.5 rounded-lg border border-[#2E3093]/40 text-[#2E3093] text-xs font-semibold hover:bg-[#2E3093]/5 disabled:opacity-60"
                      >
                        {generatingLink ? 'Generating…' : 'Generate Intake Link'}
                      </button>
                      {intakeLink && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-600 truncate max-w-[180px]" title={intakeLink}>{intakeLink}</span>
                          <button
                            type="button"
                            onClick={handleCopyIntakeLink}
                            className="px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
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
                  <div className="flex items-center gap-2 text-[11px] text-gray-600">
                    <span>Roll format: YY + SIT code + CT + seq</span>
                    <button
                      type="button"
                      disabled={studentLoading || assigningRolls || studentIntakes.length === 0}
                      onClick={async () => {
                        setAssigningRolls(true);
                        setError('');
                        setSuccess('');
                        try {
                          const res = await fetch('/api/admission-activity/corporate-inquiry/student-intakes', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ inquiryId, sitCode: scheduleForm.SitCorporateProgramCode || '000' }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.success) throw new Error(data.error || 'Failed to allot');
                          await loadStudentIntakes(inquiryId);
                          setSuccess('Roll numbers allotted');
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : 'Failed to allot roll numbers');
                        } finally {
                          setAssigningRolls(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-md border border-[#2E3093]/40 text-[#2E3093] font-semibold hover:bg-[#2E3093]/5 disabled:opacity-50"
                    >
                      {assigningRolls ? 'Allotting…' : 'Allot Roll Numbers'}
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-800">Students (intake submissions)</h4>
                    {studentLoading && <span className="text-[11px] text-gray-500">Loading…</span>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400">
                        <tr>
                          <th className="text-left py-2 px-4 font-semibold">Name</th>
                          <th className="text-left py-2 px-4 font-semibold">Phone</th>
                          <th className="text-left py-2 px-4 font-semibold">Roll Number</th>
                          <th className="text-left py-2 px-4 font-semibold">Submitted</th>
                          <th className="text-right py-2 px-4 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentIntakes.length === 0 ? (
                          <tr>
                            <td className="py-3 px-4 text-gray-500" colSpan={4}>No students yet. Share the intake link to collect submissions.</td>
                          </tr>
                        ) : (
                          studentIntakes.map((s, idx) => (
                            <tr key={s.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                              <td className="py-2 px-4 text-gray-900">{s.studentName || '—'}</td>
                              <td className="py-2 px-4 text-gray-900">{s.phoneNumber || '—'}</td>
                              <td className="py-2 px-4 text-gray-900">{s.rollNumber || '—'}</td>
                              <td className="py-2 px-4 text-gray-900">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                              <td className="py-2 px-4 text-right">
                                <button
                                  type="button"
                                  disabled={deletingId === s.id}
                                  onClick={async () => {
                                    if (!s.id) return;
                                    setDeletingId(s.id);
                                    setError('');
                                    setSuccess('');
                                    try {
                                      const res = await fetch('/api/admission-activity/corporate-inquiry/student-intakes', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ intakeId: s.id }),
                                      });
                                      const data = await res.json();
                                      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
                                      await loadStudentIntakes(inquiryId);
                                      setSuccess('Student entry deleted');
                                    } catch (e: unknown) {
                                      setError(e instanceof Error ? e.message : 'Failed to delete');
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-md border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                                >
                                  {deletingId === s.id ? 'Deleting…' : 'Delete'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">Performance Evaluation</h3>
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
            <div className="space-y-4">
               <div>
                <label className={labelCls}>Training Feedback</label>
                <textarea className={textareaCls} rows={5} value={trainingFeedback} onChange={(e) => setTrainingFeedback(e.target.value)} placeholder="Training feedback" />
              </div>
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
            </div>
          )}
        </div>

        <div className="flex justify-end items-center p-4 border-t border-gray-200 bg-gray-50 gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
