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
  FullName?: string | null;
  CompanyName?: string | null;
  InquiryStatus?: string | null;
  TrainingNumber?: string | null;
  TrainingDate?: string | null;
  TrainerName?: string | null;
  NumberOfDays?: number | null;
  TotalStudents?: number | null;
  TrainingCoordinator?: string | null;
};

const toDateInput = (v: string | null | undefined) => {
  if (!v) return '';
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

export default function ConvertInquiryPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const inquiryId = useMemo(() => Number(id), [id]);

  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');

  const [loading, setLoading] = useState(true);
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
  });

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
        setForm({
          TrainingNumber: r.TrainingNumber || '',
          TrainingDate: toDateInput(r.TrainingDate),
          TrainerName: r.TrainerName || '',
          NumberOfDays: r.NumberOfDays === null || r.NumberOfDays === undefined ? '' : String(r.NumberOfDays),
          TotalStudents: r.TotalStudents === null || r.TotalStudents === undefined ? '' : String(r.TotalStudents),
          TrainingCoordinator: r.TrainingCoordinator || '',
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load inquiry');
      } finally {
        setLoading(false);
      }
    })();
  }, [inquiryId]);

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
    };

    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess('Under discussion saved');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
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
            <h2 className="text-base font-bold text-white">Under Discussion</h2>
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
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
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
