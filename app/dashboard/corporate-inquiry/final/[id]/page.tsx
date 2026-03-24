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

  InquiryStatus?: string | null;

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

  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [activeTab, setActiveTab] = useState<'inquiry' | 'discussion' | 'schedule' | 'feedback' | 'certification'>('inquiry');
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
  });
  const [performanceRows, setPerformanceRows] = useState<PerformanceRow[]>(defaultPerformanceRows());
  const [trainingFeedback, setTrainingFeedback] = useState('');
  const [sitCertification, setSitCertification] = useState<'Yes' | 'No' | ''>('');

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
        });

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
            onClick={() => router.push('/dashboard/corporate-inquiry/convert')}
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inquiryId}`)}
              className="px-4 py-2 rounded-lg bg-white text-[#2E3093] text-sm font-semibold hover:bg-white/90 transition-colors"
              title="Inquiry details"
            >
              Inquiry Details
            </button>
            <button
              onClick={() => router.push(`/dashboard/corporate-inquiry/convert/${inquiryId}`)}
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
            ['inquiry', 'Inquiry'],
            ['discussion', 'Under Discussion'],
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
          )}

          {activeTab === 'discussion' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
              <div>
                <label className={labelCls}>Training Number</label>
                <input className={inputCls} value={scheduleForm.TrainingNumber} disabled />
              </div>
              <div>
                <label className={labelCls}>Training Date</label>
                <input className={inputCls} value={scheduleForm.TrainingDate} disabled />
              </div>
              <div>
                <label className={labelCls}>Trainer Name</label>
                <input className={inputCls} value={scheduleForm.TrainerName} disabled />
              </div>
              <div>
                <label className={labelCls}>Number Of Days</label>
                <input className={inputCls} value={scheduleForm.NumberOfDays} disabled />
              </div>
              <div>
                <label className={labelCls}>Total Students</label>
                <input className={inputCls} value={scheduleForm.TotalStudents} disabled />
              </div>
              <div>
                <label className={labelCls}>Training Co-ordinator</label>
                <input className={inputCls} value={scheduleForm.TrainingCoordinator} disabled />
              </div>
              <div className="md:col-span-3">
                <button
                  onClick={() => router.push(`/dashboard/corporate-inquiry/convert/${inquiryId}`)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  Edit Under Discussion
                </button>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                <div>
                  <label className={labelCls}>Training Number</label>
                  <input className={inputCls} value={scheduleForm.TrainingNumber} onChange={(e) => setScheduleForm((f) => ({ ...f, TrainingNumber: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Trainer Name</label>
                  <input className={inputCls} value={scheduleForm.TrainerName} onChange={(e) => setScheduleForm((f) => ({ ...f, TrainerName: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Training Date</label>
                  <input type="date" className={inputCls} value={scheduleForm.TrainingDate} onChange={(e) => setScheduleForm((f) => ({ ...f, TrainingDate: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Number Of Days</label>
                  <input type="number" min={0} className={inputCls} value={scheduleForm.NumberOfDays} onChange={(e) => setScheduleForm((f) => ({ ...f, NumberOfDays: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Total Students</label>
                  <input type="number" min={0} className={inputCls} value={scheduleForm.TotalStudents} onChange={(e) => setScheduleForm((f) => ({ ...f, TotalStudents: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Training Co-ordinator</label>
                  <input className={inputCls} value={scheduleForm.TrainingCoordinator} onChange={(e) => setScheduleForm((f) => ({ ...f, TrainingCoordinator: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Confirm Date</label>
                  <input type="date" className={inputCls} value={scheduleForm.ConfirmDate} onChange={(e) => setScheduleForm((f) => ({ ...f, ConfirmDate: e.target.value }))} />
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
              onClick={() => router.push('/dashboard/corporate-inquiry/convert')}
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
