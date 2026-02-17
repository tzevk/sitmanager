'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
const inputCls = 'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';

export default function EditCollegePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    college_name: '',
    university: '',
    contact_person: '',
    designation: '',
    address: '',
    city: '',
    pin: '',
    state: '',
    country: '',
    telephone: '',
    mobile: '',
    email: '',
    website: '',
    remark: '',
    purpose: '',
    course: '',
    batch: '',
    refstudentname: '',
    refmobile: '',
    refemail: '',
    descipline: '',
  });

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/masters/college/${id}`);
      if (res.ok) {
        const data = await res.json();
        setFormData({
          college_name: data.college_name || '',
          university: data.university || '',
          contact_person: data.contact_person || '',
          designation: data.designation || '',
          address: data.address || '',
          city: data.city || '',
          pin: data.pin || '',
          state: data.state || '',
          country: data.country || '',
          telephone: data.telephone || '',
          mobile: data.mobile || '',
          email: data.email || '',
          website: data.website || '',
          remark: data.remark || '',
          purpose: data.purpose || '',
          course: data.course || '',
          batch: data.batch || '',
          refstudentname: data.refstudentname || '',
          refmobile: data.refmobile || '',
          refemail: data.refemail || '',
          descipline: data.descipline || '',
        });
      } else {
        alert('Failed to fetch college data');
        router.push('/dashboard/masters/college');
      }
    } catch {
      alert('Failed to fetch college data');
      router.push('/dashboard/masters/college');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.college_name.trim()) {
      alert('College Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/masters/college', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), ...formData }),
      });
      if (res.ok) {
        router.push('/dashboard/masters/college');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } catch {
      alert('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span>Dashboard</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span>Masters</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <button onClick={() => router.push('/dashboard/masters/college')} className="hover:text-[#2E3093]">
            College
          </button>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-[#2E3093] font-medium">Edit</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Edit College</h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-4 py-2">
          <h3 className="text-xs font-bold text-white tracking-wide">College Details</h3>
        </div>
        <form onSubmit={handleSubmit} className="px-3 py-2">
          <div className="grid grid-cols-4 gap-x-3 gap-y-2">
            {/* Row 1 */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>College Name *</label>
              <input type="text" value={formData.college_name} onChange={(e) => handleChange('college_name', e.target.value)} className={inputCls} placeholder="College Name" required />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>University</label>
              <input type="text" value={formData.university} onChange={(e) => handleChange('university', e.target.value)} className={inputCls} placeholder="University" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Discipline</label>
              <input type="text" value={formData.descipline} onChange={(e) => handleChange('descipline', e.target.value)} className={inputCls} placeholder="Discipline" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Contact Person</label>
              <input type="text" value={formData.contact_person} onChange={(e) => handleChange('contact_person', e.target.value)} className={inputCls} placeholder="Contact Person" />
            </div>

            {/* Row 2 */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Designation</label>
              <input type="text" value={formData.designation} onChange={(e) => handleChange('designation', e.target.value)} className={inputCls} placeholder="Designation" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Purpose</label>
              <input type="text" value={formData.purpose} onChange={(e) => handleChange('purpose', e.target.value)} className={inputCls} placeholder="Purpose" />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <label className={labelCls}>Address</label>
              <input type="text" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} className={inputCls} placeholder="Address" />
            </div>

            {/* Row 3 */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>City</label>
              <input type="text" value={formData.city} onChange={(e) => handleChange('city', e.target.value)} className={inputCls} placeholder="City" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>PIN</label>
              <input type="text" value={formData.pin} onChange={(e) => handleChange('pin', e.target.value)} className={inputCls} placeholder="PIN" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>State</label>
              <input type="text" value={formData.state} onChange={(e) => handleChange('state', e.target.value)} className={inputCls} placeholder="State" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Country</label>
              <input type="text" value={formData.country} onChange={(e) => handleChange('country', e.target.value)} className={inputCls} placeholder="Country" />
            </div>

            {/* Row 4 */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Telephone</label>
              <input type="text" value={formData.telephone} onChange={(e) => handleChange('telephone', e.target.value)} className={inputCls} placeholder="Telephone" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Mobile</label>
              <input type="text" value={formData.mobile} onChange={(e) => handleChange('mobile', e.target.value)} className={inputCls} placeholder="Mobile" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Email</label>
              <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} className={inputCls} placeholder="Email" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Website</label>
              <input type="text" value={formData.website} onChange={(e) => handleChange('website', e.target.value)} className={inputCls} placeholder="Website" />
            </div>

            {/* Row 5 */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Course</label>
              <input type="text" value={formData.course} onChange={(e) => handleChange('course', e.target.value)} className={inputCls} placeholder="Course" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Batch</label>
              <input type="text" value={formData.batch} onChange={(e) => handleChange('batch', e.target.value)} className={inputCls} placeholder="Batch" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Ref. Student</label>
              <input type="text" value={formData.refstudentname} onChange={(e) => handleChange('refstudentname', e.target.value)} className={inputCls} placeholder="Ref. Student" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Ref. Mobile</label>
              <input type="text" value={formData.refmobile} onChange={(e) => handleChange('refmobile', e.target.value)} className={inputCls} placeholder="Ref. Mobile" />
            </div>

            {/* Row 6 */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Ref. Email</label>
              <input type="email" value={formData.refemail} onChange={(e) => handleChange('refemail', e.target.value)} className={inputCls} placeholder="Ref. Email" />
            </div>
            <div className="col-span-4 sm:col-span-3">
              <label className={labelCls}>Remark</label>
              <input type="text" value={formData.remark} onChange={(e) => handleChange('remark', e.target.value)} className={inputCls} placeholder="Remark" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 mt-3 border-t">
            <button
              type="button"
              onClick={() => router.push('/dashboard/masters/college')}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded shadow hover:shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
