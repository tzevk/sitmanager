'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { FaSave, FaTimes } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

export default function EditCorporateInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({
    Id: 0,
    Fname: '',
    MName: '',
    Lname: '',
    CompanyName: '',
    Designation: '',
    Address: '',
    City: '',
    State: '',
    Country: '',
    Pin: '',
    Phone: '',
    Mobile: '',
    Email: '',
    Course_Id: '',
    Place: '',
    business: '',
    Remark: '',
  });

  useEffect(() => {
    // Fetch inquiry data
    fetch(`/api/admission-activity/corporate-inquiry/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.inquiry) {
          setForm({
            Id: data.inquiry.Id || 0,
            Fname: data.inquiry.Fname || '',
            MName: data.inquiry.MName || '',
            Lname: data.inquiry.Lname || '',
            CompanyName: data.inquiry.CompanyName || '',
            Designation: data.inquiry.Designation || '',
            Address: data.inquiry.Address || '',
            City: data.inquiry.City || '',
            State: data.inquiry.State || '',
            Country: data.inquiry.Country || '',
            Pin: data.inquiry.Pin || '',
            Phone: data.inquiry.Phone || '',
            Mobile: data.inquiry.Mobile || '',
            Email: data.inquiry.Email || '',
            Course_Id: data.inquiry.Course_Id || '',
            Place: data.inquiry.Place || '',
            business: data.inquiry.business || '',
            Remark: data.inquiry.Remark || '',
          });
          setCourses(data.courses || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        alert('Failed to load inquiry');
        setLoading(false);
      });
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/dashboard/corporate-inquiry');
      } else {
        alert(data.error || 'Failed to update inquiry');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'max-w-[220px] w-full px-2 py-1.5 border-2 border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-xs';
  const labelClass = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit corporate inquiries." />;

  if (loading) {
    return (
      <div className="space-y-4 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Edit Corporate Inquiry</h2>
              <p className="text-sm text-gray-400">Update inquiry details below</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/corporate-inquiry')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-sm shadow-sm transition"
            >
              <FaTimes className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Personal Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Personal Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
            <div>
              <label className={labelClass}>First Name</label>
              <input
                type="text"
                name="Fname"
                value={form.Fname}
                onChange={handleChange}
                className={inputClass}
                placeholder="First Name"
              />
            </div>
            <div>
              <label className={labelClass}>Middle Name</label>
              <input
                type="text"
                name="MName"
                value={form.MName}
                onChange={handleChange}
                className={inputClass}
                placeholder="Middle Name"
              />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input
                type="text"
                name="Lname"
                value={form.Lname}
                onChange={handleChange}
                className={inputClass}
                placeholder="Last Name"
              />
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Company Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
            <div>
              <label className={labelClass}>Company Name</label>
              <input
                type="text"
                name="CompanyName"
                value={form.CompanyName}
                onChange={handleChange}
                className={inputClass}
                placeholder="Company Name"
              />
            </div>
            <div>
              <label className={labelClass}>Designation</label>
              <input
                type="text"
                name="Designation"
                value={form.Designation}
                onChange={handleChange}
                className={inputClass}
                placeholder="Designation"
              />
            </div>
            <div>
              <label className={labelClass}>Business</label>
              <input
                type="text"
                name="business"
                value={form.business}
                onChange={handleChange}
                className={inputClass}
                placeholder="Type of Business"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Contact Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                name="Email"
                value={form.Email}
                onChange={handleChange}
                className={inputClass}
                placeholder="Email"
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="text"
                name="Phone"
                value={form.Phone}
                onChange={handleChange}
                className={inputClass}
                placeholder="Phone"
              />
            </div>
            <div>
              <label className={labelClass}>Mobile</label>
              <input
                type="text"
                name="Mobile"
                value={form.Mobile}
                onChange={handleChange}
                className={inputClass}
                placeholder="Mobile"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Address</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
            <div className="md:col-span-3">
              <label className={labelClass}>Address</label>
              <input
                type="text"
                name="Address"
                value={form.Address}
                onChange={handleChange}
                className={inputClass}
                placeholder="Address"
              />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                name="City"
                value={form.City}
                onChange={handleChange}
                className={inputClass}
                placeholder="City"
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input
                type="text"
                name="State"
                value={form.State}
                onChange={handleChange}
                className={inputClass}
                placeholder="State"
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                type="text"
                name="Country"
                value={form.Country}
                onChange={handleChange}
                className={inputClass}
                placeholder="Country"
              />
            </div>
            <div>
              <label className={labelClass}>Pin Code</label>
              <input
                type="text"
                name="Pin"
                value={form.Pin}
                onChange={handleChange}
                className={inputClass}
                placeholder="Pin Code"
              />
            </div>
            <div>
              <label className={labelClass}>Place</label>
              <input
                type="text"
                name="Place"
                value={form.Place}
                onChange={handleChange}
                className={inputClass}
                placeholder="Place"
              />
            </div>
          </div>
        </div>

        {/* Course & Remarks */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Course & Remarks</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-1.5">
            <div>
              <label className={labelClass}>Course</label>
              <select
                name="Course_Id"
                value={form.Course_Id}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.Course_Id} value={c.Course_Name}>
                    {c.Course_Name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Remark</label>
              <textarea
                name="Remark"
                value={form.Remark}
                onChange={handleChange}
                className={inputClass}
                rows={2}
                placeholder="Remarks"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#2A6BB5] hover:bg-[#2360A0] text-white rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <FaSave /> {saving ? 'Saving...' : 'Update Inquiry'}
          </button>
        </div>
      </form>
    </div>
  );
}
