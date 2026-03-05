'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

export default function AddBatchPage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('batch');

  /* Dropdown options */
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  /* Form state – mirrors the edit page's formData */
  const [formData, setFormData] = useState({
    Course_Id: '',
    Batch_code: '',
    Category: '',
    Min_Qualification: '',
    SDate: '',
    Admission_Date: '',
    Max_Students: '',
    Training_Coordinator: '',
    Documents_Required: '',
    CourseName: '',
    Course_description: '',
    Passing_Criteria: '',
    EDate: '',
    Duration: '',
    NoStudent: '',
    Timings: '',
    Comments: '',
    // Fees Structure fields
    INR_Basic: '',
    INR_ServiceTax: '',
    INR_Total: '',
    Dollar_Basic: '',
    Dollar_ServiceTax: '',
    Dollar_Total: '',
    Actual_Fees_Payment: '',
    Fees_Full_Payment: '',
    Fees_Installment_Payment: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* ---- Fetch courses ---- */
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/masters/course?limit=1000');
        const json = await res.json();
        setCourses(json.rows || []);
      } catch { /* ignore */ }
    };
    fetchCourses();
  }, []);

  /* ---- Fetch categories ---- */
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/masters/batch-category?limit=100');
        const data = await res.json();
        const cats = (data.rows || []).map((r: { batch: string }) => r.batch).filter(Boolean);
        setCategories(cats);
      } catch { /* ignore */ }
    };
    fetchCategories();
  }, []);

  /* ---- Generic change handler ---- */
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /* ---- Save ---- */
  const handleSave = async () => {
    if (!formData.Course_Id) { setError('Course Name is required'); return; }
    if (!formData.Min_Qualification.trim()) { setError('Eligibility is required'); return; }
    if (!formData.Max_Students.trim()) { setError('Target Student is required'); return; }
    if (!formData.Documents_Required.trim()) { setError('Documents Required is required'); return; }
    if (!formData.Passing_Criteria.trim()) { setError('Passing Criteria is required'); return; }
    if (!formData.Course_description.trim()) { setError('Brief Description of Course is required'); return; }

    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/masters/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Course_Id: formData.Course_Id ? Number(formData.Course_Id) : null,
          Batch_code: formData.Batch_code,
          Category: formData.Category,
          Min_Qualification: formData.Min_Qualification,
          SDate: formData.SDate || null,
          Admission_Date: formData.Admission_Date || null,
          Max_Students: formData.Max_Students,
          Training_Coordinator: formData.Training_Coordinator,
          Documents_Required: formData.Documents_Required,
          CourseName: formData.CourseName,
          Course_description: formData.Course_description,
          Passing_Criteria: formData.Passing_Criteria,
          EDate: formData.EDate || null,
          Duration: formData.Duration,
          NoStudent: formData.NoStudent ? Number(formData.NoStudent) : null,
          Timings: formData.Timings,
          Comments: formData.Comments,
          INR_Basic: formData.INR_Basic ? Number(formData.INR_Basic) : null,
          INR_ServiceTax: formData.INR_ServiceTax ? Number(formData.INR_ServiceTax) : null,
          INR_Total: formData.INR_Total ? Number(formData.INR_Total) : null,
          Dollar_Basic: formData.Dollar_Basic ? Number(formData.Dollar_Basic) : null,
          Dollar_ServiceTax: formData.Dollar_ServiceTax ? Number(formData.Dollar_ServiceTax) : null,
          Dollar_Total: formData.Dollar_Total ? Number(formData.Dollar_Total) : null,
          Actual_Fees_Payment: formData.Actual_Fees_Payment ? Number(formData.Actual_Fees_Payment) : null,
          Fees_Full_Payment: formData.Fees_Full_Payment ? Number(formData.Fees_Full_Payment) : null,
          Fees_Installment_Payment: formData.Fees_Installment_Payment ? Number(formData.Fees_Installment_Payment) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      router.push('/dashboard/masters/batch');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
    } finally {
      setSaving(false);
    }
  };

  /* ---- Shared styles ---- */
  const labelCls = 'block text-[10px] font-semibold text-gray-600 mb-0.5';
  const inputCls = 'max-w-[280px] w-full bg-white border-[1.5px] border-gray-300 rounded px-2 py-2 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400';
  const selectCls = 'max-w-[280px] w-full bg-white border-[1.5px] border-gray-300 rounded px-2 py-2 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]';

  /* ---- Permission guard ---- */
  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to create batches." />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/masters/batch')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Add New Batch</h2>
            <p className="text-xs text-white/70">Masters &gt; Batch &gt; Add</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Body */}
        <div className="px-3 py-2 bg-gray-50/40">
          <div className="space-y-4">

            {/* ---- Section: Batch Details ---- */}
            <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
                <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  </span>
                  Batch Details
                </h3>
              </div>
              <div className="px-3 py-2">
                <div className="grid grid-cols-4 gap-2">
                  {/* Column 1-3 */}
                  <div className="col-span-3 space-y-2">
                    {/* Row 1 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>Course Name <span className="text-red-500">*</span></label>
                        <select
                          value={formData.Course_Id}
                          onChange={(e) => handleChange('Course_Id', e.target.value)}
                          className={selectCls}
                        >
                          <option value="">Select Course</option>
                          {courses.map(c => (
                            <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Batch Code</label>
                        <input type="text" value={formData.Batch_code} onChange={(e) => handleChange('Batch_code', e.target.value)} className={inputCls} placeholder="Batch Code" />
                      </div>
                      <div>
                        <label className={labelCls}>Batch Category</label>
                        <select value={formData.Category} onChange={(e) => handleChange('Category', e.target.value)} className={selectCls}>
                          <option value="">Select Category</option>
                          {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>Eligibility <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.Min_Qualification} onChange={(e) => handleChange('Min_Qualification', e.target.value)} className={inputCls} placeholder="Eligibility" />
                      </div>
                      <div>
                        <label className={labelCls}>Duration From</label>
                        <input type="date" value={formData.SDate} onChange={(e) => handleChange('SDate', e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Last Date of Admission</label>
                        <input type="date" value={formData.Admission_Date} onChange={(e) => handleChange('Admission_Date', e.target.value)} className={inputCls} />
                      </div>
                    </div>

                    {/* Row 3 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>Target Student <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.Max_Students} onChange={(e) => handleChange('Max_Students', e.target.value)} className={inputCls} placeholder="Target Student" />
                      </div>
                      <div>
                        <label className={labelCls}>Training Coordinator</label>
                        <input type="text" value={formData.Training_Coordinator} onChange={(e) => handleChange('Training_Coordinator', e.target.value)} className={inputCls} placeholder="Training Coordinator" />
                      </div>
                      <div>
                        <label className={labelCls}>Documents required <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.Documents_Required} onChange={(e) => handleChange('Documents_Required', e.target.value)} className={inputCls} placeholder="Documents required" />
                      </div>
                    </div>

                    {/* Row 4 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>Course Name (if changed)</label>
                        <input type="text" value={formData.CourseName} onChange={(e) => handleChange('CourseName', e.target.value)} className={inputCls} placeholder="Course Name" />
                      </div>
                      <div>
                        <label className={labelCls}>Duration</label>
                        <input type="text" value={formData.Duration} onChange={(e) => handleChange('Duration', e.target.value)} className={inputCls} placeholder="Duration" />
                      </div>
                      <div>
                        <label className={labelCls}>Passing Criteria <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.Passing_Criteria} onChange={(e) => handleChange('Passing_Criteria', e.target.value)} className={inputCls} placeholder="0.6" />
                      </div>
                    </div>

                    {/* Row 5 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>To (End Date)</label>
                        <input type="date" value={formData.EDate} onChange={(e) => handleChange('EDate', e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Actual Students</label>
                        <input type="number" value={formData.NoStudent} onChange={(e) => handleChange('NoStudent', e.target.value)} className={inputCls} placeholder="Actual Students" />
                      </div>
                      <div>
                        <label className={labelCls}>Timings</label>
                        <input type="text" value={formData.Timings} onChange={(e) => handleChange('Timings', e.target.value)} className={inputCls} placeholder="Timings" />
                      </div>
                    </div>
                  </div>

                  {/* Column 4 */}
                  <div className="col-span-1 space-y-2">
                    <div>
                      <label className={labelCls}>Comments</label>
                      <textarea value={formData.Comments} onChange={(e) => handleChange('Comments', e.target.value)} className={inputCls + ' resize-none h-[100px] text-xs'} placeholder="Comments" />
                    </div>
                    <div>
                      <label className={labelCls}>Brief <span className="text-red-500">*</span></label>
                      <textarea value={formData.Course_description} onChange={(e) => handleChange('Course_description', e.target.value)} className={inputCls + ' resize-none h-[100px] text-xs'} placeholder="Brief Description" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Section: Fees Structure ---- */}
            <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
                <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  Fees Structure
                </h3>
              </div>
              <div className="px-3 py-2">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className={labelCls}>Basic (INR)</label>
                    <input type="number" value={formData.INR_Basic} onChange={(e) => handleChange('INR_Basic', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Service Tax (INR)</label>
                    <input type="number" value={formData.INR_ServiceTax} onChange={(e) => handleChange('INR_ServiceTax', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Total (INR)</label>
                    <input type="number" value={formData.INR_Total} onChange={(e) => handleChange('INR_Total', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Full Payment Fees</label>
                    <input type="number" value={formData.Fees_Full_Payment} onChange={(e) => handleChange('Fees_Full_Payment', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Basic (Dollar)</label>
                    <input type="number" value={formData.Dollar_Basic} onChange={(e) => handleChange('Dollar_Basic', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Service Tax (Dollar)</label>
                    <input type="number" value={formData.Dollar_ServiceTax} onChange={(e) => handleChange('Dollar_ServiceTax', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Total (Dollar)</label>
                    <input type="number" value={formData.Dollar_Total} onChange={(e) => handleChange('Dollar_Total', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Installment Payment Fees</label>
                    <input type="number" value={formData.Fees_Installment_Payment} onChange={(e) => handleChange('Fees_Installment_Payment', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                  <div>
                    <label className={labelCls}>Actual Fees Payment</label>
                    <input type="number" value={formData.Actual_Fees_Payment} onChange={(e) => handleChange('Actual_Fees_Payment', e.target.value)} className={inputCls} placeholder="Amount" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4 pb-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Batch'}
            </button>
            <button
              onClick={() => router.push('/dashboard/masters/batch')}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
