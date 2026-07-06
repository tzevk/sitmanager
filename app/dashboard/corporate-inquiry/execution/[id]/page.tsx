'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { GhostBtn, PageHeader } from '@/components/ui/PageHeader';

const labelCls = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';
const inputCls = 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors disabled:bg-slate-50 disabled:text-slate-500';
const textareaCls = `${inputCls} resize-none`;

type Inquiry = {
  Id: number;
  CompanyName?: string | null;
  FullName?: string | null;
  Email?: string | null;
  Mobile?: string | null;
  Phone?: string | null;
  Course_Id?: string | null;
  Place?: string | null;
  TrainingLocation?: string | null;
  TrainingMode?: string | null;
  InquiryStatus?: string | null;
  TrainingNumber?: string | null;
  TrainerName?: string | null;
  NumberOfDays?: number | null;
  TotalStudents?: number | null;
  TrainingCoordinator?: string | null;
  ConfirmDate?: string | null;
  PerformanceEvaluation_PreTest?: string | null;
  PerformanceEvaluation_Assessment?: string | null;
  PerformanceEvaluation_FinalExam?: string | null;
  PerformanceEvaluation_TrainingMaterial?: string | null;
  PerformanceEvaluation_Attendance?: string | null;
  TrainingFeedbackObtained?: string | null;
  SitCertIssuedOnPerformanceOnAttendance?: string | null;
};

type EvalKey = 'pre_test' | 'assessment' | 'final_test' | 'training_material' | 'attendance';

type EvalItem = {
  completed: boolean;
  remarks: string;
};

const evalItems: { key: EvalKey; label: string }[] = [
  { key: 'pre_test', label: 'Pre Test' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'final_test', label: 'Final Test' },
  { key: 'training_material', label: 'Training Material' },
  { key: 'attendance', label: 'Attendance' },
];

const defaultEval = (): Record<EvalKey, EvalItem> => ({
  pre_test: { completed: false, remarks: '' },
  assessment: { completed: false, remarks: '' },
  final_test: { completed: false, remarks: '' },
  training_material: { completed: false, remarks: '' },
  attendance: { completed: false, remarks: '' },
});

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

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

function SummaryItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-slate-700">{value?.trim() || '-'}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#2E3093]">{title}</h3>
      {children}
    </section>
  );
}

export default function TrainingExecutionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const inquiryId = useMemo(() => Number(id), [id]);
  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
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

    let cancelled = false;
    async function loadInquiry() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admission-activity/corporate-inquiry/${inquiryId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load inquiry');

        const next = data.inquiry as Inquiry;
        if (cancelled) return;
        setInquiry(next);
        setExecutionForm({
          TrainingNumber: next.TrainingNumber || '',
          TrainerName: next.TrainerName || '',
          NumberOfDays: next.NumberOfDays == null ? '' : String(next.NumberOfDays),
          TotalStudents: next.TotalStudents == null ? '' : String(next.TotalStudents),
          TrainingCoordinator: next.TrainingCoordinator || '',
        });
        setEvaluation({
          pre_test: parseEvalItem(next.PerformanceEvaluation_PreTest),
          assessment: parseEvalItem(next.PerformanceEvaluation_Assessment),
          final_test: parseEvalItem(next.PerformanceEvaluation_FinalExam),
          training_material: parseEvalItem(next.PerformanceEvaluation_TrainingMaterial),
          attendance: parseEvalItem(next.PerformanceEvaluation_Attendance),
        });
        setFeedback(next.TrainingFeedbackObtained || '');
        const certRaw = (next.SitCertIssuedOnPerformanceOnAttendance || '').trim();
        setCertificate(certRaw === 'Yes' || certRaw === 'No' ? certRaw : '');
        setConfirmDate(toDateInput(next.ConfirmDate));
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load inquiry');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInquiry();
    return () => { cancelled = true; };
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      setSuccess('Training execution saved');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to update training execution." />;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <PageHeader
        title="Training Execution"
        breadcrumbs={[{ label: 'Corporate Training' }, { label: 'Execution' }]}
        meta={`Inquiry #${inquiryId}`}
        action={(
          <>
            <GhostBtn onClick={() => router.push('/dashboard/corporate-inquiry/execution')}>Back</GhostBtn>
            <GhostBtn onClick={() => router.push(`/dashboard/corporate-inquiry/edit/${inquiryId}`)}>Inquiry Details</GhostBtn>
          </>
        )}
      />

      {(error || success) && (
        <div className="space-y-2">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{success}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <SummaryItem label="Company" value={inquiry?.CompanyName} />
        <SummaryItem label="Training" value={inquiry?.Course_Id} />
        <SummaryItem label="Location" value={inquiry?.TrainingLocation || inquiry?.Place} />
        <SummaryItem label="Contact" value={inquiry?.FullName || inquiry?.Mobile || inquiry?.Phone || inquiry?.Email} />
      </div>

      <Section title="Execution Details">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className={labelCls}>Trainer Name</label>
            <input className={inputCls} value={executionForm.TrainerName} onChange={(e) => setExecutionForm((form) => ({ ...form, TrainerName: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Number Of Days</label>
            <input type="number" min={0} className={inputCls} value={executionForm.NumberOfDays} onChange={(e) => setExecutionForm((form) => ({ ...form, NumberOfDays: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Total Students</label>
            <input type="number" min={0} className={inputCls} value={executionForm.TotalStudents} onChange={(e) => setExecutionForm((form) => ({ ...form, TotalStudents: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Training Co-ordinator</label>
            <input className={inputCls} value={executionForm.TrainingCoordinator} onChange={(e) => setExecutionForm((form) => ({ ...form, TrainingCoordinator: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Training Number</label>
            <input className={inputCls} value={executionForm.TrainingNumber} onChange={(e) => setExecutionForm((form) => ({ ...form, TrainingNumber: e.target.value }))} />
          </div>
        </div>
      </Section>

      <Section title="Performance Evaluation">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
          {evalItems.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={evaluation[key].completed}
                  onChange={(e) => setEvaluation((items) => ({ ...items, [key]: { ...items[key], completed: e.target.checked } }))}
                />
                {label}
              </label>
              <input
                className={`${inputCls} mt-2`}
                value={evaluation[key].remarks}
                onChange={(e) => setEvaluation((items) => ({ ...items, [key]: { ...items[key], remarks: e.target.value } }))}
                placeholder="Remarks"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Feedback And Certificate">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className={labelCls}>Feedback</label>
            <textarea className={textareaCls} rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Training feedback" />
          </div>
          <div>
            <label className={labelCls}>Certificate Issued</label>
            <select
              className={inputCls}
              value={certificate}
              onChange={(e) => {
                const value = e.target.value;
                setCertificate(value === 'Yes' || value === 'No' ? value : '');
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
      </Section>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => router.push('/dashboard/corporate-inquiry/execution')}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[#2E3093] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#252880] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Execution'}
        </button>
      </div>
    </div>
  );
}