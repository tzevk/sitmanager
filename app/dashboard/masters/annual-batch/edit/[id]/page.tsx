'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

/* ---- shared classes ---- */
const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const textareaCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
        <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
            {icon}
          </span>
          {title}
        </h3>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

export default function EditAnnualBatchPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('annual_batch');

  /* Inquiry Information */
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [designation, setDesignation] = useState('');
  const [discussion, setDiscussion] = useState('');

  /* Training Programme & Batch Details */
  const [courseId, setCourseId] = useState('');
  const [dateOfInquiry, setDateOfInquiry] = useState('');

  /* Address Details */
  const [state, setState] = useState('');
  const [pin, setPin] = useState('');
  const [city, setCity] = useState('');
  const [place, setPlace] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');

  /* courses dropdown */
  const [courses, setCourses] = useState<Course[]>([]);

  /* ui state */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* format date for input */
  const formatDateForInput = (d: string | null) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/masters/course?limit=1000');
        const json = await res.json();
        setCourses(json.rows || []);
      } catch {
        /* ignore */
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/masters/annual-batch/${batchId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        // Map API response to form fields
        setFirstName(data.FirstName || '');
        setMiddleName(data.MiddleName || '');
        setLastName(data.LastName || '');
        setMobile(data.Mobile || '');
        setPhone(data.Phone || '');
        setEmail(data.Email || '');
        setBusiness(data.Business || '');
        setCompanyName(data.CompanyName || '');
        setDesignation(data.Designation || '');
        setDiscussion(data.Discussion || '');
        setCourseId(data.Course_Id?.toString() || '');
        setDateOfInquiry(formatDateForInput(data.DateOfInquiry));
        setState(data.State || '');
        setPin(data.Pin || '');
        setCity(data.City || '');
        setPlace(data.Place || '');
        setCountry(data.Country || '');
        setAddress(data.Address || '');
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (batchId) {
      fetchData();
    }
  }, [batchId]);

  /* ---- save ---- */
  const handleSave = async () => {
    if (!firstName.trim()) {
      setError('First Name is required');
      return;
    }
    if (!middleName.trim()) {
      setError('Middle Name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last Name is required');
      return;
    }
    if (!mobile.trim()) {
      setError('Mobile is required');
      return;
    }
    if (!email.trim()) {
      setError('Email ID is required');
      return;
    }
    if (!discussion.trim()) {
      setError('Topic Discussed is required');
      return;
    }
    if (!courseId) {
      setError('Course Name is required');
      return;
    }
    if (!dateOfInquiry) {
      setError('Date of Inquiry is required');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/masters/annual-batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Batch_Id: batchId,
          FirstName: firstName,
          MiddleName: middleName,
          LastName: lastName,
          Mobile: mobile,
          Phone: phone || null,
          Email: email,
          Business: business || null,
          CompanyName: companyName || null,
          Designation: designation || null,
          Discussion: discussion,
          Course_Id: courseId,
          DateOfInquiry: dateOfInquiry,
          State: state || null,
          Pin: pin || null,
          City: city || null,
          Place: place || null,
          Country: country || null,
          Address: address || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      router.push('/dashboard/masters/annual-batch');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
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
          <div className="space-y-3">
            {/* Section: Inquiry Information */}
            <SectionCard
              title="Inquiry Information"
              icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                {/* FirstName */}
                <div>
                  <label className={labelCls}>
                    FirstName <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter Fname"
                    className={inputCls}
                  />
                </div>
                {/* MiddleName */}
                <div>
                  <label className={labelCls}>
                    MiddleName <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Enter MName"
                    className={inputCls}
                  />
                </div>
                {/* LastName */}
                <div>
                  <label className={labelCls}>
                    LastName <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter Lname"
                    className={inputCls}
                  />
                </div>
                {/* Mobile */}
                <div>
                  <label className={labelCls}>
                    Mobile <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter Mobile Number"
                    className={inputCls}
                  />
                </div>
                {/* Phone */}
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter Phone Number"
                    className={inputCls}
                  />
                </div>
                {/* Email ID */}
                <div>
                  <label className={labelCls}>
                    Email ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter Email ID"
                    className={inputCls}
                  />
                </div>
                {/* Business */}
                <div>
                  <label className={labelCls}>Business</label>
                  <input
                    type="text"
                    value={business}
                    onChange={(e) => setBusiness(e.target.value)}
                    placeholder="Enter business"
                    className={inputCls}
                  />
                </div>
                {/* Company Name */}
                <div>
                  <label className={labelCls}>Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter CompanyName"
                    className={inputCls}
                  />
                </div>
                {/* Designation */}
                <div>
                  <label className={labelCls}>Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="Enter Designation"
                    className={inputCls}
                  />
                </div>
                {/* Discussion / Topic Discussed */}
                <div className="col-span-2 md:col-span-3 lg:col-span-4">
                  <label className={labelCls}>
                    Discussion / Topic Discussed <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={discussion}
                    onChange={(e) => setDiscussion(e.target.value)}
                    placeholder="Topic Discussed"
                    rows={2}
                    className={textareaCls}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Section: Training Programme & Batch Details */}
            <SectionCard
              title="Training Programme & Batch Details"
              icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                {/* Course Name */}
                <div>
                  <label className={labelCls}>
                    Course Name <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">--Select Course--</option>
                    {courses.map((c) => (
                      <option key={c.Course_Id} value={c.Course_Id}>
                        {c.Course_Name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Date of Inquiry */}
                <div>
                  <label className={labelCls}>
                    Date of Inquiry <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={dateOfInquiry}
                    onChange={(e) => setDateOfInquiry(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Section: Address Details */}
            <SectionCard
              title="Address Details"
              icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                {/* State */}
                <div>
                  <label className={labelCls}>State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Enter State"
                    className={inputCls}
                  />
                </div>
                {/* Pin */}
                <div>
                  <label className={labelCls}>Pin</label>
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter Pin"
                    className={inputCls}
                  />
                </div>
                {/* City */}
                <div>
                  <label className={labelCls}>City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter City"
                    className={inputCls}
                  />
                </div>
                {/* Place */}
                <div>
                  <label className={labelCls}>Place</label>
                  <input
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="Enter Place"
                    className={inputCls}
                  />
                </div>
                {/* Country */}
                <div>
                  <label className={labelCls}>Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Enter Country"
                    className={inputCls}
                  />
                </div>
                {/* Address */}
                <div className="col-span-2 md:col-span-3 lg:col-span-4">
                  <label className={labelCls}>Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter Address"
                    rows={2}
                    className={textareaCls}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Submit
                </button>
                <button
                  onClick={() => router.push('/dashboard/masters/annual-batch')}
                  className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
