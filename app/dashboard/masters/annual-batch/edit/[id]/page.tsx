'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface BatchCategory {
  id: number;
  BatchCategory: string;
  Batch_Type: string;
  Prefix: string | null;
  Description: string | null;
}

type BatchDetails = {
  Batch_Id: number;
  Course_Id: number | null;
  Course_Name?: string | null;
  Batch_code: string | null;
  Category: string | null;
  Timings: string | null;
  SDate: string | null;
  ActualDate: string | null;
  Admission_Date: string | null;
  EDate: string | null;
  Duration: string | null;
  Training_Coordinator: string | null;
  INR_Basic: number | null;
  INR_ServiceTax?: number | null;
  INR_Total: number | null;
  Dollar_Basic: number | null;
  Dollar_ServiceTax?: number | null;
  Dollar_Total: number | null;
  CourseName: string | null;
  Course_description: string | null;
  Batch_Category_id: number | null;
  IsActive: number;
};

function formatDateForInput(d: string | null | undefined): string {
  if (!d) return '';
  try {
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function EditAnnualBatchPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('annual_batch');

  /* --- form state --- */
  const [courseId, setCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [description, setDescription] = useState('');

  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [trainingCompletionDate, setTrainingCompletionDate] = useState('');
  const [lastAdmissionDate, setLastAdmissionDate] = useState('');
  const [actualDate, setActualDate] = useState('');

  const [duration, setDuration] = useState('');
  const [timings, setTimings] = useState('');
  const [trainingCoordinator, setTrainingCoordinator] = useState('');

  const [publish, setPublish] = useState<'0' | '1'>('1');

  // Fees
  const [taxRate, setTaxRate] = useState('0');

  const [inrBasic, setInrBasic] = useState('');
  const [inrServiceTax, setInrServiceTax] = useState('');
  const [inrTotal, setInrTotal] = useState('');

  const [dollarBasic, setDollarBasic] = useState('');
  const [dollarServiceTax, setDollarServiceTax] = useState('');
  const [dollarTotal, setDollarTotal] = useState('');

  /* --- dropdown data --- */
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<BatchCategory[]>([]);

  /* --- ui --- */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedCourse = useMemo(() => {
    if (!courseId) return null;
    return courses.find((c) => c.Course_Id === Number(courseId)) ?? null;
  }, [courseId, courses]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [courseRes, catRes] = await Promise.all([
          fetch('/api/masters/course?limit=1000'),
          fetch('/api/masters/annual-batch/categories'),
        ]);
        const courseJson = await courseRes.json();
        const catJson = await catRes.json();
        setCourses(courseJson.rows || []);
        setCategories(Array.isArray(catJson) ? catJson : []);
      } catch {
        /* ignore */
      }
    };
    fetchOptions();
  }, []);

  // Auto-fill course name when course changes (still editable)
  useEffect(() => {
    if (!selectedCourse) return;
    setCourseName((prev) => {
      // If empty or still matches old selected course name, keep auto-updating.
      if (!prev.trim()) return selectedCourse.Course_Name;
      return prev;
    });
  }, [selectedCourse]);

  // Load existing batch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/masters/annual-batch/${batchId}`);
        const json = (await res.json()) as unknown;

        if (!res.ok) {
          const message =
            typeof json === 'object' && json !== null && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
              ? (json as { error: string }).error
              : 'Failed to load batch';
          throw new Error(message);
        }

        const data = json as BatchDetails;

        setCourseId(data.Course_Id ? String(data.Course_Id) : '');
        setCourseName(data.CourseName || data.Course_Name || '');
        setCategoryId(data.Batch_Category_id ? String(data.Batch_Category_id) : '');
        setBatchCode(data.Batch_code || '');
        setDescription(data.Course_description || '');

        setPlannedStartDate(formatDateForInput(data.SDate));
        setTrainingCompletionDate(formatDateForInput(data.EDate));
        setLastAdmissionDate(formatDateForInput(data.Admission_Date));
        setActualDate(formatDateForInput(data.ActualDate));

        setDuration(data.Duration || '');
        setTimings(data.Timings || '');
        setTrainingCoordinator(data.Training_Coordinator || '');

        setPublish(String(data.IsActive ?? 1) === '0' ? '0' : '1');

        // Pricing values (fall back to totals - basic if service tax missing)
        const inrBasicNum = data.INR_Basic ?? null;
        const inrServiceNum = (data.INR_ServiceTax ?? null) ??
          (data.INR_Total != null && inrBasicNum != null ? data.INR_Total - inrBasicNum : null);
        const inrTotalNum = (data.INR_Total ?? null) ??
          (inrBasicNum != null && inrServiceNum != null ? inrBasicNum + inrServiceNum : null);

        const usdBasicNum = data.Dollar_Basic ?? null;
        const usdServiceNum = (data.Dollar_ServiceTax ?? null) ??
          (data.Dollar_Total != null && usdBasicNum != null ? data.Dollar_Total - usdBasicNum : null);
        const usdTotalNum = (data.Dollar_Total ?? null) ??
          (usdBasicNum != null && usdServiceNum != null ? usdBasicNum + usdServiceNum : null);

        setInrBasic(inrBasicNum != null ? String(inrBasicNum) : '');
        setInrServiceTax(inrServiceNum != null ? String(roundMoney(inrServiceNum)) : '0');
        setInrTotal(inrTotalNum != null ? String(roundMoney(inrTotalNum)) : '0');

        setDollarBasic(usdBasicNum != null ? String(usdBasicNum) : '');
        setDollarServiceTax(usdServiceNum != null ? String(roundMoney(usdServiceNum)) : '0');
        setDollarTotal(usdTotalNum != null ? String(roundMoney(usdTotalNum)) : '0');

        // Derive tax rate from INR if possible
        const derivedRate =
          inrBasicNum && inrBasicNum > 0 && inrServiceNum != null
            ? roundMoney((inrServiceNum / inrBasicNum) * 100)
            : 0;
        setTaxRate(String(derivedRate));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load batch');
      } finally {
        setLoading(false);
      }
    };

    if (batchId) fetchData();
  }, [batchId]);

  // Recompute service tax and totals when basic/taxRate changes
  useEffect(() => {
    const rate = toNumberOrNull(taxRate) ?? 0;

    const inrBasicNum = toNumberOrNull(inrBasic) ?? 0;
    const inrService = roundMoney((inrBasicNum * rate) / 100);
    const inrTot = roundMoney(inrBasicNum + inrService);
    setInrServiceTax(String(inrService));
    setInrTotal(String(inrTot));

    const usdBasicNum = toNumberOrNull(dollarBasic) ?? 0;
    const usdService = roundMoney((usdBasicNum * rate) / 100);
    const usdTot = roundMoney(usdBasicNum + usdService);
    setDollarServiceTax(String(usdService));
    setDollarTotal(String(usdTot));
  }, [inrBasic, dollarBasic, taxRate]);

  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
  const inputCls =
    'w-full bg-white border-2 border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const selectCls =
    'w-full bg-white border-2 border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
  const textareaCls =
    'w-full bg-white border-2 border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

  const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
        <h3 className="text-[13px] font-bold text-[#2E3093]">{title}</h3>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );

  const handleSave = async () => {
    if (!courseId) {
      setError('Please select a course');
      return;
    }
    if (!courseName.trim()) {
      setError('Course Name is required');
      return;
    }
    if (!categoryId) {
      setError('Category is required');
      return;
    }
    if (!plannedStartDate) {
      setError('Planned Start Date is required');
      return;
    }
    if (!trainingCompletionDate) {
      setError('Training completion Date is required');
      return;
    }
    if (!lastAdmissionDate) {
      setError('Last Date of Admission is required');
      return;
    }
    if (!duration.trim()) {
      setError('Duration is required');
      return;
    }
    if (!timings.trim()) {
      setError('Timings is required');
      return;
    }

    const selectedCat = categories.find((c) => c.id === Number(categoryId));

    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/masters/annual-batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Batch_Id: Number(batchId),
          Course_Id: Number(courseId),
          Batch_code: batchCode || null,
          Category: selectedCat?.BatchCategory || null,
          Batch_Category_id: Number(categoryId),
          Timings: timings || null,
          SDate: plannedStartDate || null,
          ActualDate: actualDate || null,
          Admission_Date: lastAdmissionDate || null,
          EDate: trainingCompletionDate || null,
          Duration: duration || null,
          Training_Coordinator: trainingCoordinator || null,
          INR_Basic: toNumberOrNull(inrBasic),
          INR_ServiceTax: toNumberOrNull(inrServiceTax),
          INR_Total: toNumberOrNull(inrTotal),
          Dollar_Basic: toNumberOrNull(dollarBasic),
          Dollar_ServiceTax: toNumberOrNull(dollarServiceTax),
          Dollar_Total: toNumberOrNull(dollarTotal),
          CourseName: courseName || null,
          Course_description: description || null,
          IsActive: Number(publish),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      router.push('/dashboard/masters/annual-batch');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit annual batches." />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard/masters/annual-batch')}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-base font-bold text-white">Edit Annual Batch</h2>
              <p className="text-xs text-white/70">Masters &gt; Annual Batch &gt; Edit</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard/masters/annual-batch')}
              className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
              type="button"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-2 rounded-lg bg-[#FAE452] hover:bg-[#f3de4f] text-[#2E3093] text-xs font-bold transition-colors disabled:opacity-70"
              type="button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        <div className="px-3 py-2 bg-gray-50/40">
          <div className="space-y-3">
            <SectionCard title="Batch Details">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={labelCls}>
                    Select Course <span className="text-red-400">*</span>
                  </label>
                  <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectCls}>
                    <option value="">--Select--</option>
                    {courses.map((c) => (
                      <option key={c.Course_Id} value={c.Course_Id}>
                        {c.Course_Name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>
                    Course Name (if changed) <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Course Name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                    <option value="">--Select--</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.BatchCategory}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Batch Code</label>
                  <input
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    placeholder="Batch Code"
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2 md:col-span-3 lg:col-span-4">
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    rows={2}
                    className={textareaCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Planned Start Date <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>
                    Training completion Date <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={trainingCompletionDate} onChange={(e) => setTrainingCompletionDate(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>
                    Last Date of Admission <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={lastAdmissionDate} onChange={(e) => setLastAdmissionDate(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Actual Date</label>
                  <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>
                    Duration <span className="text-red-400">*</span>
                  </label>
                  <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration" className={inputCls} />
                </div>

                <div className="col-span-2 md:col-span-3">
                  <label className={labelCls}>
                    Timings <span className="text-red-400">*</span>
                  </label>
                  <input value={timings} onChange={(e) => setTimings(e.target.value)} placeholder="Timings" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Training Coordinator</label>
                  <input
                    value={trainingCoordinator}
                    onChange={(e) => setTrainingCoordinator(e.target.value)}
                    placeholder="Training Coordinator"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Publish</label>
                  <select value={publish} onChange={(e) => setPublish(e.target.value as '0' | '1')} className={selectCls}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Fees">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={labelCls}>
                    Tax Rate <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label className={labelCls}>Basic (INR)</label>
                  <input
                    value={inrBasic}
                    onChange={(e) => setInrBasic(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label className={labelCls}>Service Tax (INR)</label>
                  <input value={inrServiceTax} readOnly className={inputCls + ' bg-gray-50'} />
                </div>

                <div>
                  <label className={labelCls}>Total (INR)</label>
                  <input value={inrTotal} readOnly className={inputCls + ' bg-gray-50'} />
                </div>

                <div>
                  <label className={labelCls}>Basic ($)</label>
                  <input
                    value={dollarBasic}
                    onChange={(e) => setDollarBasic(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label className={labelCls}>Service Tax ($)</label>
                  <input value={dollarServiceTax} readOnly className={inputCls + ' bg-gray-50'} />
                </div>

                <div>
                  <label className={labelCls}>Total ($)</label>
                  <input value={dollarTotal} readOnly className={inputCls + ' bg-gray-50'} />
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
