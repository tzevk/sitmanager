'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSave, FaTimes } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Consultancy {
  Const_Id: number;
  Comp_Name: string;
  Contact_Person?: string | null;
  Designation?: string | null;
  Mobile?: string | null;
  EMail?: string | null;
}

type Tab = 'details' | 'discussion';

function todayISO(): string {
  // yyyy-mm-dd
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AddCorporateInquiryPage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [consultancies, setConsultancies] = useState<Consultancy[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [companyMode, setCompanyMode] = useState<'master' | 'manual'>('master');
  const [form, setForm] = useState({
    Idate: todayISO(),
    Course_Id: '',
    Consultancy_Id: '',
    CompanyName: '',
    Place: '',
    CompanyType: '' as '' | 'Local' | 'International',
    CompanyAuthority: '',
    FullName: '',
    Designation: '',
    Phone: '',
    Mobile: '',
    Email: '',
    TrainingMode: 'offline' as 'online' | 'offline',
    Participants_Fresher: '',
    Participants_Experienced: '',
    TrainingLocation: '',
    Discussion: '',
  });

  useEffect(() => {
    let alive = true;
    async function loadMeta() {
      try {
        const res = await fetch('/api/admission-activity/corporate-inquiry/meta', { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (!alive) return;
        setCourses(Array.isArray(data?.courses) ? data.courses : []);
        setConsultancies(Array.isArray(data?.consultancies) ? data.consultancies : []);
      } catch {
        // ignore
      }
    }
    loadMeta();
    return () => {
      alive = false;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const companyOptions = useMemo(() => {
    return consultancies
      .slice()
      .sort((a, b) => String(a.Comp_Name || '').localeCompare(String(b.Comp_Name || '')));
  }, [consultancies]);

  function handleCompanyChange(constId: string) {
    const idNum = Number(constId);
    const selected = companyOptions.find((c) => Number(c.Const_Id) === idNum);
    setForm((prev) => {
      const next: typeof prev = {
        ...prev,
        Consultancy_Id: constId,
        CompanyName: selected?.Comp_Name || '',
      };
      if (!prev.CompanyAuthority?.trim() && selected?.Contact_Person) {
        next.CompanyAuthority = selected.Contact_Person;
      }
      return next;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/dashboard/corporate-inquiry');
      } else {
        alert(data.error || 'Failed to add inquiry');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';
  const labelClass = 'block text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1';
  const textareaClass =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm';
  const tabBtn = (isActive: boolean) =>
    isActive
      ? 'px-4 py-2 rounded-lg bg-[#2E3093] text-white text-sm font-semibold shadow-sm'
      : 'px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 shadow-sm';

  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to add corporate inquiries." />;

  return (
    <div className="space-y-3">
      {/* Header Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Add Corporate Inquiry</h2>
              <p className="text-sm text-gray-400">Enter inquiry details below</p>
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={tabBtn(activeTab === 'details')} onClick={() => setActiveTab('details')}>
                Inquiry Details
              </button>
              <button type="button" className={tabBtn(activeTab === 'discussion')} onClick={() => setActiveTab('discussion')}>
                Discussion
              </button>
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'details' && (
              <>
                <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Inquiry Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" name="Idate" value={form.Idate} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Training Programme</label>
                <select name="Course_Id" value={form.Course_Id} onChange={handleChange} className={inputClass}>
                  <option value="">Select Programme</option>
                  {courses.map((c) => (
                    <option key={c.Course_Id} value={String(c.Course_Id)}>
                      {c.Course_Name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Company Name</label>
                <select
                  name="Consultancy_Id"
                  value={form.Consultancy_Id}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__manual__') {
                      setCompanyMode('manual');
                      setForm((prev) => ({ ...prev, Consultancy_Id: '', CompanyName: '' }));
                      return;
                    }
                    setCompanyMode('master');
                    handleCompanyChange(v);
                  }}
                  className={inputClass}
                >
                  <option value="">Select Company</option>
                  <option value="__manual__">Other / Not in list</option>
                  {companyOptions.map((c) => (
                    <option key={c.Const_Id} value={String(c.Const_Id)}>
                      {c.Comp_Name}
                    </option>
                  ))}
                </select>
              </div>

              {companyMode === 'manual' && (
                <div>
                  <label className={labelClass}>Company Name (Manual)</label>
                  <input
                    type="text"
                    name="CompanyName"
                    value={form.CompanyName}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Enter company name"
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Company Location</label>
                <input
                  type="text"
                  name="Place"
                  value={form.Place}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="City / location"
                />
              </div>

              <div>
                <label className={labelClass}>Company Type</label>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                  {(['Local', 'International'] as const).map((opt) => {
                    const active = form.CompanyType === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, CompanyType: opt }))}
                        className={`px-4 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? 'bg-[#2A6BB5] text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelClass}>Company Authority</label>
                <input
                  type="text"
                  name="CompanyAuthority"
                  value={form.CompanyAuthority}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Last contacted person"
                />
              </div>

              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  name="FullName"
                  value={form.FullName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Contact name"
                />
              </div>

              <div>
                <label className={labelClass}>Position</label>
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
                <label className={labelClass}>Email</label>
                <input type="email" name="Email" value={form.Email} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mobile</label>
                <input type="text" name="Mobile" value={form.Mobile} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="text" name="Phone" value={form.Phone} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Training Mode</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="TrainingMode"
                      value="online"
                      checked={form.TrainingMode === 'online'}
                      onChange={handleChange}
                    />
                    Online
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="TrainingMode"
                      value="offline"
                      checked={form.TrainingMode === 'offline'}
                      onChange={handleChange}
                    />
                    Offline
                  </label>
                </div>
              </div>

              <div>
                <label className={labelClass}>Participants (Fresher)</label>
                <input
                  type="number"
                  name="Participants_Fresher"
                  value={form.Participants_Fresher}
                  onChange={handleChange}
                  className={inputClass}
                  min={0}
                />
              </div>
              <div>
                <label className={labelClass}>Participants (Experienced)</label>
                <input
                  type="number"
                  name="Participants_Experienced"
                  value={form.Participants_Experienced}
                  onChange={handleChange}
                  className={inputClass}
                  min={0}
                />
              </div>
              <div>
                <label className={labelClass}>Training Location</label>
                <input
                  type="text"
                  name="TrainingLocation"
                  value={form.TrainingLocation}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Location"
                />
              </div>
            </div>
              </>
            )}

            {activeTab === 'discussion' && (
              <>
                <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Discussion</h2>
                <label className={labelClass}>Discussion Notes</label>
                <textarea
                  name="Discussion"
                  value={form.Discussion}
                  onChange={handleChange}
                  className={textareaClass}
                  rows={8}
                  placeholder="Enter discussion details"
                />
              </>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#2A6BB5] hover:bg-[#2360A0] text-white rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <FaSave /> {loading ? 'Saving...' : 'Save Inquiry'}
          </button>
        </div>
      </form>
    </div>
  );
}
