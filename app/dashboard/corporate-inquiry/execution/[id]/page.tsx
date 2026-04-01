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
  FullName?: string | null;
  CompanyName?: string | null;
  Email?: string | null;
  Mobile?: string | null;
  Phone?: string | null;
  Course_Id?: string | null;
  Place?: string | null;

  Idate?: string | null;
  CompanyType?: string | null;
  CompanyAuthority?: string | null;
  Designation?: string | null;
  TrainingMode?: string | null;
  Participants_Fresher?: number | string | null;
  Participants_Experienced?: number | string | null;
  TrainingLocation?: string | null;
  business?: string | null;
  Remark?: string | null;

  InquiryStatus?: string | null;

  TrainingNumber?: string | null;
  TrainingDate?: string | null;
  TrainerName?: string | null;
  NumberOfDays?: number | null;
  TotalStudents?: number | null;
  TrainingCoordinator?: string | null;

  DiscussionOutcome?: 'Awarded' | 'Regretted' | 'On Hold' | null;

  Discussion?: string | null;
  FollowUp?: string | null;

  ConfirmDate?: string | null;
  PerformanceEvaluation_PreTest?: string | null;
  PerformanceEvaluation_Assessment?: string | null;
  PerformanceEvaluation_FinalExam?: string | null;
  PerformanceEvaluation_TrainingMaterial?: string | null;
  PerformanceEvaluation_Attendance?: string | null;
  TrainingFeedbackObtained?: string | null;
  SitCertIssuedOnPerformanceOnAttendance?: string | null;
};

type MeetingDetailsItem = {
  meetingDate: string;
  attendeeClient: string;
  attendeeSIT: string;
  meetingAgenda: string;
};

type FollowUpItem = {
  date: string;
  nextDate?: string;
  remarks: string;
};

type EvalKey = 'pre_test' | 'assessment' | 'final_test' | 'training_material' | 'attendance';

type EvalItem = {
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

function parseEvalItem(value: string | null | undefined): EvalItem {
  if (!value) return { completed: false, remarks: '' };
  try {
    const parsed = JSON.parse(value) as Partial<EvalItem>;
    return {
      completed: Boolean(parsed?.completed),
      remarks: typeof parsed?.remarks === 'string' ? parsed.remarks : '',
    };
  } catch {
    return { completed: false, remarks: String(value) };
  }
}

const defaultEval = (): Record<EvalKey, EvalItem> => ({
  pre_test: { completed: false, remarks: '' },
  assessment: { completed: false, remarks: '' },
  final_test: { completed: false, remarks: '' },
  training_material: { completed: false, remarks: '' },
  attendance: { completed: false, remarks: '' },
});

function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|,/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseFollowUpJson(raw: string | null | undefined): { meetingDetails: MeetingDetailsItem[]; followUps: FollowUpItem[] } {
  if (!raw || !raw.trim()) return { meetingDetails: [], followUps: [] };
  let obj: any = null;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { meetingDetails: [], followUps: [] };
  }

  const meetingDetailsRaw = obj && Array.isArray(obj.meetingDetails) ? obj.meetingDetails : [];
  let meetingDetails: MeetingDetailsItem[] = meetingDetailsRaw
    .map((rec: any) => ({
      meetingDate: typeof rec?.meetingDate === 'string' ? rec.meetingDate : '',
      attendeeClient: typeof rec?.attendeeClient === 'string' ? rec.attendeeClient : '',
      attendeeSIT:
        typeof rec?.attendeeSIT === 'string'
          ? rec.attendeeSIT
          : typeof rec?.attendeeSit === 'string'
            ? rec.attendeeSit
            : '',
      meetingAgenda: typeof rec?.meetingAgenda === 'string' ? rec.meetingAgenda : '',
    }))
    .filter((x: MeetingDetailsItem) => Boolean(x.meetingDate || x.attendeeClient || x.attendeeSIT || x.meetingAgenda));

  if (
    meetingDetails.length === 0 &&
    (typeof obj?.meetingDate === 'string' || typeof obj?.attendeeClient === 'string' || typeof obj?.attendeeSIT === 'string' || typeof obj?.meetingAgenda === 'string')
  ) {
    meetingDetails = [
      {
        meetingDate: typeof obj?.meetingDate === 'string' ? obj.meetingDate : '',
        attendeeClient: typeof obj?.attendeeClient === 'string' ? obj.attendeeClient : '',
        attendeeSIT:
          typeof obj?.attendeeSIT === 'string'
            ? obj.attendeeSIT
            : typeof obj?.attendeeSit === 'string'
              ? obj.attendeeSit
              : '',
        meetingAgenda: typeof obj?.meetingAgenda === 'string' ? obj.meetingAgenda : '',
      },
    ].filter((x) => Boolean(x.meetingDate || x.attendeeClient || x.attendeeSIT || x.meetingAgenda));
  }

  const followUpsRaw =
    obj && Array.isArray(obj.followUps)
      ? obj.followUps
      : obj && Array.isArray(obj.meetings)
        ? obj.meetings
        : [];

  const followUps: FollowUpItem[] = followUpsRaw
    .map((rec: any) => ({
      date: typeof rec?.date === 'string' ? rec.date : '',
      nextDate: typeof rec?.nextDate === 'string' ? rec.nextDate : undefined,
      remarks: typeof rec?.remarks === 'string' ? rec.remarks : '',
    }))
    .filter((x: FollowUpItem) => Boolean(x.date || x.nextDate || x.remarks));

  return { meetingDetails, followUps };
}

export default function TrainingExecutionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const inquiryId = useMemo(() => Number(id), [id]);

  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [activeTab, setActiveTab] = useState<'inquiry' | 'discussion' | 'execution' | 'feedback' | 'certificate'>('inquiry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetailsItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);

  const [executionForm, setExecutionForm] = useState({
    TrainingNumber: '',
    TrainerName: '',
    NumberOfDays: '',
    TotalStudents: '',
    TrainingCoordinator: '',
  });
  const [evaluation, setEvaluation] = useState<Record<EvalKey, EvalItem>>(defaultEval());
  const [feedback, setFeedback] = useState('');
  const [certificate, setCertificate] = useState<'Yes' | 'No' | ''>('');
  const [confirmDate, setConfirmDate] = useState('');

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

        const parsedFU = parseFollowUpJson(r.FollowUp);
        setMeetingDetails(parsedFU.meetingDetails);
        setFollowUps(parsedFU.followUps);

        setExecutionForm({
          TrainingNumber: r.TrainingNumber || '',
          TrainerName: r.TrainerName || '',
          NumberOfDays: r.NumberOfDays === null || r.NumberOfDays === undefined ? '' : String(r.NumberOfDays),
          TotalStudents: r.TotalStudents === null || r.TotalStudents === undefined ? '' : String(r.TotalStudents),
          TrainingCoordinator: r.TrainingCoordinator || '',
        });

        setEvaluation({
          pre_test: parseEvalItem(r.PerformanceEvaluation_PreTest),
          assessment: parseEvalItem(r.PerformanceEvaluation_Assessment),
          final_test: parseEvalItem(r.PerformanceEvaluation_FinalExam),
          training_material: parseEvalItem(r.PerformanceEvaluation_TrainingMaterial),
          attendance: parseEvalItem(r.PerformanceEvaluation_Attendance),
        });

        setFeedback(r.TrainingFeedbackObtained || '');
        const certRaw = (r.SitCertIssuedOnPerformanceOnAttendance || '').trim();
        setCertificate(certRaw === 'Yes' || certRaw === 'No' ? certRaw : '');
        setConfirmDate(toDateInput(r.ConfirmDate));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load inquiry');
      } finally {
        setLoading(false);
      }
    })();
  }, [inquiryId]);

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
          InquiryStatus: inquiry?.InquiryStatus || 'Final',

          TrainingNumber: executionForm.TrainingNumber,
          TrainerName: executionForm.TrainerName,
          NumberOfDays: executionForm.NumberOfDays,
          TotalStudents: executionForm.TotalStudents,
          TrainingCoordinator: executionForm.TrainingCoordinator,

          PerformanceEvaluation_PreTest: JSON.stringify(evaluation.pre_test),
          PerformanceEvaluation_Assessment: JSON.stringify(evaluation.assessment),
          PerformanceEvaluation_FinalExam: JSON.stringify(evaluation.final_test),
          PerformanceEvaluation_TrainingMaterial: JSON.stringify(evaluation.training_material),
          PerformanceEvaluation_Attendance: JSON.stringify(evaluation.attendance),

          TrainingFeedbackObtained: feedback,
          SitCertIssuedOnPerformanceOnAttendance: certificate,
          ConfirmDate: confirmDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess('Training execution saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to update training execution." />;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/corporate-inquiry/execution')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Training Execution</h2>
            <p className="text-xs text-white/70">
              Corporate Inquiry #{inquiryId}{inquiry?.CompanyName ? ` • ${inquiry.CompanyName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inquiryId}`)}
              className="px-4 py-2 rounded-lg bg-white text-[#2E3093] text-sm font-semibold hover:bg-white/90 transition-colors"
              title="Inquiry details"
            >
              Inquiry Details
            </button>
            <button
              onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inquiryId}?tab=discussion`)}
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors"
              title="Under discussion"
            >
              Under Discussion
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-5 bg-gray-50/80">
          {([
            ['inquiry', 'Inquiry Details'],
            ['discussion', 'Under Discussion Details'],
            ['execution', 'Execution Details'],
            ['feedback', 'Training Feedback'],
            ['certificate', 'SIT Certificate'],
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
              <div>
                <label className={labelCls}>Enquiry Date</label>
                <input className={inputCls} value={toDateInput(inquiry?.Idate) || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <input className={inputCls} value={inquiry?.CompanyName || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Coordinator</label>
                <input className={inputCls} value={inquiry?.FullName || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Training Programme</label>
                <input className={inputCls} value={inquiry?.Course_Id || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Company Location</label>
                <input className={inputCls} value={inquiry?.Place || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Company Type</label>
                <input className={inputCls} value={inquiry?.CompanyType || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Company Authority</label>
                <input className={inputCls} value={inquiry?.CompanyAuthority || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Designation</label>
                <input className={inputCls} value={inquiry?.Designation || ''} disabled />
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
                <label className={labelCls}>Training Mode</label>
                <input className={inputCls} value={inquiry?.TrainingMode || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Participants (Fresher)</label>
                <input className={inputCls} value={inquiry?.Participants_Fresher === null || inquiry?.Participants_Fresher === undefined ? '' : String(inquiry.Participants_Fresher)} disabled />
              </div>
              <div>
                <label className={labelCls}>Participants (Experienced)</label>
                <input className={inputCls} value={inquiry?.Participants_Experienced === null || inquiry?.Participants_Experienced === undefined ? '' : String(inquiry.Participants_Experienced)} disabled />
              </div>
              <div>
                <label className={labelCls}>Training Location</label>
                <input className={inputCls} value={inquiry?.TrainingLocation || ''} disabled />
              </div>

              <div className="md:col-span-3">
                <label className={labelCls}>Disciplines</label>
                <textarea className={textareaCls} rows={3} value={(inquiry?.business || '').trim()} disabled />
              </div>
              <div className="md:col-span-3">
                <label className={labelCls}>Remarks</label>
                <textarea className={textareaCls} rows={3} value={(inquiry?.Remark || '').trim()} disabled />
              </div>
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
              <div>
                <label className={labelCls}>Trainer Name</label>
                <input className={inputCls} value={inquiry?.TrainerName || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Number Of Days</label>
                <input className={inputCls} value={inquiry?.NumberOfDays === null || inquiry?.NumberOfDays === undefined ? '' : String(inquiry.NumberOfDays)} disabled />
              </div>
              <div>
                <label className={labelCls}>Total Students</label>
                <input className={inputCls} value={inquiry?.TotalStudents === null || inquiry?.TotalStudents === undefined ? '' : String(inquiry.TotalStudents)} disabled />
              </div>
              <div>
                <label className={labelCls}>Training Co-ordinator</label>
                <input className={inputCls} value={inquiry?.TrainingCoordinator || ''} disabled />
              </div>
              <div>
                <label className={labelCls}>Discussion Outcome</label>
                <input className={inputCls} value={inquiry?.DiscussionOutcome || ''} disabled />
              </div>
              </div>

              <div>
                <label className={labelCls}>Minutes of Meeting</label>
                <textarea className={textareaCls} rows={5} value={(inquiry?.Discussion || '').trim()} disabled />
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Meeting Date</th>
                      <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Attendee (Client)</th>
                      <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Attendee (SIT)</th>
                      <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Meeting Agenda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {meetingDetails.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-gray-500" colSpan={4}>
                          No meeting details
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Follow Up Date</th>
                      <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Next Follow Up Date</th>
                      <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wider text-gray-400">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {followUps.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-gray-500" colSpan={3}>
                          No follow ups
                        </td>
                      </tr>
                    ) : (
                      followUps.map((f, idx) => (
                        <tr
                          key={`${f.date}-${idx}`}
                          className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                        >
                          <td className="px-3 py-2 text-gray-900">{toDateInput(f.date) || '—'}</td>
                          <td className="px-3 py-2 text-gray-900">{toDateInput(f.nextDate) || '—'}</td>
                          <td className="px-3 py-2 text-gray-900 whitespace-pre-wrap">{(f.remarks || '').trim() || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'execution' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                <div>
                  <label className={labelCls}>Trainer Name</label>
                  <input className={inputCls} value={executionForm.TrainerName} onChange={(e) => setExecutionForm((f) => ({ ...f, TrainerName: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Number Of Days</label>
                  <input type="number" min={0} className={inputCls} value={executionForm.NumberOfDays} onChange={(e) => setExecutionForm((f) => ({ ...f, NumberOfDays: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Total Students</label>
                  <input type="number" min={0} className={inputCls} value={executionForm.TotalStudents} onChange={(e) => setExecutionForm((f) => ({ ...f, TotalStudents: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Training Co-ordinator</label>
                  <input className={inputCls} value={executionForm.TrainingCoordinator} onChange={(e) => setExecutionForm((f) => ({ ...f, TrainingCoordinator: e.target.value }))} />
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">Performance Evaluation</h3>
                  <p className="text-xs text-gray-500">Pre Test, Assessment, Final Test, Training Material, Attendance</p>
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
                      {([
                        { key: 'pre_test', label: 'Pre Test' },
                        { key: 'assessment', label: 'Assessment' },
                        { key: 'final_test', label: 'Final Test' },
                        { key: 'training_material', label: 'Training Material' },
                        { key: 'attendance', label: 'Attendance' },
                      ] as const).map(({ key, label }, idx) => (
                        <tr key={key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="py-2 px-4 text-gray-700">{label}</td>
                          <td className="py-2 px-4">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={evaluation[key].completed}
                                onChange={(e) => setEvaluation((ev) => ({ ...ev, [key]: { ...ev[key], completed: e.target.checked } }))}
                              />
                              Completed
                            </label>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              className={inputCls}
                              value={evaluation[key].remarks}
                              onChange={(e) => setEvaluation((ev) => ({ ...ev, [key]: { ...ev[key], remarks: e.target.value } }))}
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
              <label className={labelCls}>Feedback</label>
              <textarea className={textareaCls} rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Training feedback" />
            </div>
          )}

          {activeTab === 'certificate' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
              <div>
                <label className={labelCls}>Confirm Certificate</label>
                <select
                  className={selectCls}
                  value={certificate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCertificate(v === 'Yes' || v === 'No' ? v : '');
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Confirm Date</label>
                <input type="date" className={inputCls} value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex justify-end mt-5 gap-2">
            <button
              onClick={() => router.push('/dashboard/corporate-inquiry/execution')}
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
