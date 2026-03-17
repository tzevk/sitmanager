'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

const TABS = [
  { id: 'personal', title: 'Personal Info', icon: 'fa-user' },
  { id: 'academic', title: 'Academic Details', icon: 'fa-graduation-cap' },
  { id: 'occupational', title: 'Occupational Info', icon: 'fa-briefcase' },
  { id: 'training', title: 'Training Details', icon: 'fa-chalkboard-teacher' },
  { id: 'documents', title: 'Documents', icon: 'fa-file-alt' },
];

interface KTDetail {
  subjectName: string;
  year: string;
  semester: string;
  clearedYear: string;
  marks: string;
  marksheetFile: File | null;
}

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

export default function EditOnlineAdmissionPage() {
  const router = useRouter();
  const params = useParams();
  const admissionId = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('online_admission');
  
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [academicSubTab, setAcademicSubTab] = useState<'ssc' | 'hsc' | 'diploma' | 'graduation' | 'postgrad'>('ssc');

  // Form state
  const [formData, setFormData] = useState({
    // Personal Details
    firstName: '',
    middleName: '',
    lastName: '',
    shortName: '',
    dob: '',
    gender: '',
    nationality: 'Indian',
    email: '',
    mobile: '',
    telephone: '',
    familyContact: '',
    
    // Address Details
    presentAddress: '',
    presentCity: '',
    presentPin: '',
    permanentAddress: '',
    permanentState: '',
    permanentCountry: 'India',
    
    // Education Details - SSC
    ssc_board: '',
    ssc_schoolName: '',
    ssc_yearOfPassing: '',
    ssc_percentage: '',
    ssc_ktCount: '0',
    ssc_ktDetails: [] as KTDetail[],
    
    // HSC
    hsc_board: '',
    hsc_collegeName: '',
    hsc_stream: '',
    hsc_yearOfPassing: '',
    hsc_percentage: '',
    hsc_ktCount: '0',
    hsc_ktDetails: [] as KTDetail[],
    
    // Diploma
    diploma_degree: '',
    diploma_specialization: '',
    diploma_institute: '',
    diploma_yearOfPassing: '',
    diploma_percentage: '',
    diploma_ktCount: '0',
    diploma_ktDetails: [] as KTDetail[],
    
    // Graduation
    grad_degree: '',
    grad_specialization: '',
    grad_university: '',
    grad_yearOfPassing: '',
    grad_percentage: '',
    grad_ktCount: '0',
    grad_ktDetails: [] as KTDetail[],
    
    // Post Graduation
    postgrad_degree: '',
    postgrad_specialization: '',
    postgrad_university: '',
    postgrad_yearOfPassing: '',
    postgrad_percentage: '',
    postgrad_ktCount: '0',
    postgrad_ktDetails: [] as KTDetail[],
    
    educationRemark: '',
    
    // Occupational Details
    occupationalStatus: '',
    jobOrganisation: '',
    jobDescription: '',
    jobDesignation: '',
    workingFromYears: '',
    workingFromMonths: '',
    totalOccupationYears: '',
    selfEmploymentDetails: '',
    
    // Training Details
    trainingCategory: '',
    batchCode: '',
    idProofType: '',
  });

  useEffect(() => {
    fetchAdmissionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  const fetchAdmissionData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/online-admission/${admissionId}`);
      if (!res.ok) throw new Error('Failed to fetch admission data');
      
      const data = await res.json();
      
      // Map API data to form state
      setFormData({
        firstName: data.firstName || '',
        middleName: data.middleName || '',
        lastName: data.lastName || '',
        shortName: data.shortName || '',
        dob: data.dob || '',
        gender: data.gender || '',
        nationality: data.nationality || 'Indian',
        email: data.email || '',
        mobile: data.mobile || '',
        telephone: data.telephone || '',
        familyContact: data.familyContact || '',
        presentAddress: data.presentAddress || '',
        presentCity: data.presentCity || '',
        presentPin: data.presentPin || '',
        permanentAddress: data.permanentAddress || '',
        permanentState: data.permanentState || '',
        permanentCountry: data.permanentCountry || 'India',
        ssc_board: data.ssc_board || '',
        ssc_schoolName: data.ssc_schoolName || '',
        ssc_yearOfPassing: data.ssc_yearOfPassing || '',
        ssc_percentage: data.ssc_percentage || '',
        ssc_ktCount: data.ssc_ktCount || '0',
        ssc_ktDetails: data.ssc_ktDetails || [],
        hsc_board: data.hsc_board || '',
        hsc_collegeName: data.hsc_collegeName || '',
        hsc_stream: data.hsc_stream || '',
        hsc_yearOfPassing: data.hsc_yearOfPassing || '',
        hsc_percentage: data.hsc_percentage || '',
        hsc_ktCount: data.hsc_ktCount || '0',
        hsc_ktDetails: data.hsc_ktDetails || [],
        diploma_degree: data.diploma_degree || '',
        diploma_specialization: data.diploma_specialization || '',
        diploma_institute: data.diploma_institute || '',
        diploma_yearOfPassing: data.diploma_yearOfPassing || '',
        diploma_percentage: data.diploma_percentage || '',
        diploma_ktCount: data.diploma_ktCount || '0',
        diploma_ktDetails: data.diploma_ktDetails || [],
        grad_degree: data.grad_degree || '',
        grad_specialization: data.grad_specialization || '',
        grad_university: data.grad_university || '',
        grad_yearOfPassing: data.grad_yearOfPassing || '',
        grad_percentage: data.grad_percentage || '',
        grad_ktCount: data.grad_ktCount || '0',
        grad_ktDetails: data.grad_ktDetails || [],
        postgrad_degree: data.postgrad_degree || '',
        postgrad_specialization: data.postgrad_specialization || '',
        postgrad_university: data.postgrad_university || '',
        postgrad_yearOfPassing: data.postgrad_yearOfPassing || '',
        postgrad_percentage: data.postgrad_percentage || '',
        postgrad_ktCount: data.postgrad_ktCount || '0',
        postgrad_ktDetails: data.postgrad_ktDetails || [],
        educationRemark: data.educationRemark || '',
        occupationalStatus: data.occupationalStatus || '',
        jobOrganisation: data.jobOrganisation || '',
        jobDescription: data.jobDescription || '',
        jobDesignation: data.jobDesignation || '',
        workingFromYears: data.workingFromYears || '',
        workingFromMonths: data.workingFromMonths || '',
        totalOccupationYears: data.totalOccupationYears || '',
        selfEmploymentDetails: data.selfEmploymentDetails || '',
        trainingCategory: data.trainingCategory || '',
        batchCode: data.batchCode || '',
        idProofType: data.idProofType || '',
      });
    } catch (err) {
      console.error('Error fetching admission data:', err);
      alert('Failed to load admission data');
      router.push('/dashboard/online-admission');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/online-admission/${admissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Admission updated successfully!');
        router.push('/dashboard/online-admission');
      } else {
        alert(data.error || 'Failed to update admission');
      }
    } catch (err) {
      console.error('Update error:', err);
      alert('An error occurred while updating');
    } finally {
      setSubmitting(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied />;

  /* Shared label/input classes — matching Inquiry Form */
  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
  const inputCls =
    'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const selectCls =
    'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
  const textareaCls =
    'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

  return (
    <div className="space-y-3">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/online-admission')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Edit Online Admission</h2>
            <p className="text-xs text-white/70">Online Admissions &gt; Edit</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 bg-gray-50/80 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#2E3093] text-[#2E3093] bg-white -mb-px rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-3 py-2 bg-gray-50/40">

          {/* ── Personal Info Tab ── */}
          {activeTab === 'personal' && (
            <div className="space-y-3">
              <SectionCard
                title="Basic Information"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={labelCls}>First Name <span className="text-red-400">*</span></label>
                    <input type="text" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Middle Name</label>
                    <input type="text" value={formData.middleName} onChange={(e) => handleChange('middleName', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name <span className="text-red-400">*</span></label>
                    <input type="text" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth <span className="text-red-400">*</span></label>
                    <input type="date" value={formData.dob} onChange={(e) => handleChange('dob', e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Gender <span className="text-red-400">*</span></label>
                    <select value={formData.gender} onChange={(e) => handleChange('gender', e.target.value)} className={selectCls} required>
                      <option value="">— Select —</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Nationality</label>
                    <input type="text" value={formData.nationality} onChange={(e) => handleChange('nationality', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Contact Information"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={labelCls}>Email <span className="text-red-400">*</span></label>
                    <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Mobile <span className="text-red-400">*</span></label>
                    <input type="tel" value={formData.mobile} onChange={(e) => handleChange('mobile', e.target.value)} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Telephone</label>
                    <input type="tel" value={formData.telephone} onChange={(e) => handleChange('telephone', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Address Details"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Present Address</label>
                    <textarea value={formData.presentAddress} onChange={(e) => handleChange('presentAddress', e.target.value)} rows={3} className={textareaCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Permanent Address</label>
                    <textarea value={formData.permanentAddress} onChange={(e) => handleChange('permanentAddress', e.target.value)} rows={3} className={textareaCls} />
                  </div>
                  <div>
                    <label className={labelCls}>City</label>
                    <input type="text" value={formData.presentCity} onChange={(e) => handleChange('presentCity', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>PIN Code</label>
                    <input type="text" value={formData.presentPin} onChange={(e) => handleChange('presentPin', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── Academic Tab ── */}
          {activeTab === 'academic' && (
            <div className="space-y-3">
              {/* Sub-tab navigation */}
              <div className="flex gap-2 flex-wrap pb-1">
                {[
                  { id: 'ssc', label: 'SSC (10th)' },
                  { id: 'hsc', label: 'HSC (12th)' },
                  { id: 'diploma', label: 'Diploma' },
                  { id: 'graduation', label: 'Graduation' },
                  { id: 'postgrad', label: 'Post-Grad' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAcademicSubTab(tab.id as typeof academicSubTab)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors rounded ${
                      academicSubTab === tab.id
                        ? 'bg-[#2E3093] text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {academicSubTab === 'ssc' && (
                <SectionCard
                  title="10th / SSC Education"
                  icon={
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                    <div>
                      <label className={labelCls}>Board <span className="text-red-400">*</span></label>
                      <select value={formData.ssc_board} onChange={(e) => handleChange('ssc_board', e.target.value)} className={selectCls}>
                        <option value="">— Select —</option>
                        <option>CBSE</option>
                        <option>ICSE</option>
                        <option>State Board</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>School Name <span className="text-red-400">*</span></label>
                      <input type="text" value={formData.ssc_schoolName} onChange={(e) => handleChange('ssc_schoolName', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Year of Passing</label>
                      <input type="number" value={formData.ssc_yearOfPassing} onChange={(e) => handleChange('ssc_yearOfPassing', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Percentage / CGPA</label>
                      <input type="text" value={formData.ssc_percentage} onChange={(e) => handleChange('ssc_percentage', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </SectionCard>
              )}

              {academicSubTab === 'hsc' && (
                <SectionCard
                  title="12th / HSC Education"
                  icon={
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                    <div>
                      <label className={labelCls}>Board</label>
                      <select value={formData.hsc_board} onChange={(e) => handleChange('hsc_board', e.target.value)} className={selectCls}>
                        <option value="">— Select —</option>
                        <option>CBSE</option>
                        <option>ICSE</option>
                        <option>State Board</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>College Name</label>
                      <input type="text" value={formData.hsc_collegeName} onChange={(e) => handleChange('hsc_collegeName', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Stream</label>
                      <select value={formData.hsc_stream} onChange={(e) => handleChange('hsc_stream', e.target.value)} className={selectCls}>
                        <option value="">— Select —</option>
                        <option>Science</option>
                        <option>Commerce</option>
                        <option>Arts</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Year of Passing</label>
                      <input type="number" value={formData.hsc_yearOfPassing} onChange={(e) => handleChange('hsc_yearOfPassing', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Percentage / CGPA</label>
                      <input type="text" value={formData.hsc_percentage} onChange={(e) => handleChange('hsc_percentage', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </SectionCard>
              )}

              {academicSubTab === 'diploma' && (
                <SectionCard
                  title="Diploma Education"
                  icon={
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                    <div>
                      <label className={labelCls}>Degree</label>
                      <input type="text" value={formData.diploma_degree} onChange={(e) => handleChange('diploma_degree', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Specialization</label>
                      <input type="text" value={formData.diploma_specialization} onChange={(e) => handleChange('diploma_specialization', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Institute</label>
                      <input type="text" value={formData.diploma_institute} onChange={(e) => handleChange('diploma_institute', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Year of Passing</label>
                      <input type="number" value={formData.diploma_yearOfPassing} onChange={(e) => handleChange('diploma_yearOfPassing', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Percentage / CGPA</label>
                      <input type="text" value={formData.diploma_percentage} onChange={(e) => handleChange('diploma_percentage', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </SectionCard>
              )}

              {academicSubTab === 'graduation' && (
                <SectionCard
                  title="Graduation"
                  icon={
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7" />
                    </svg>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                    <div>
                      <label className={labelCls}>Degree</label>
                      <input type="text" value={formData.grad_degree} onChange={(e) => handleChange('grad_degree', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Specialization</label>
                      <input type="text" value={formData.grad_specialization} onChange={(e) => handleChange('grad_specialization', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>University</label>
                      <input type="text" value={formData.grad_university} onChange={(e) => handleChange('grad_university', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Year of Passing</label>
                      <input type="number" value={formData.grad_yearOfPassing} onChange={(e) => handleChange('grad_yearOfPassing', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Percentage / CGPA</label>
                      <input type="text" value={formData.grad_percentage} onChange={(e) => handleChange('grad_percentage', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </SectionCard>
              )}

              {academicSubTab === 'postgrad' && (
                <SectionCard
                  title="Post-Graduation"
                  icon={
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                    <div>
                      <label className={labelCls}>Degree</label>
                      <input type="text" value={formData.postgrad_degree} onChange={(e) => handleChange('postgrad_degree', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Specialization</label>
                      <input type="text" value={formData.postgrad_specialization} onChange={(e) => handleChange('postgrad_specialization', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>University</label>
                      <input type="text" value={formData.postgrad_university} onChange={(e) => handleChange('postgrad_university', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Year of Passing</label>
                      <input type="number" value={formData.postgrad_yearOfPassing} onChange={(e) => handleChange('postgrad_yearOfPassing', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Percentage / CGPA</label>
                      <input type="text" value={formData.postgrad_percentage} onChange={(e) => handleChange('postgrad_percentage', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── Occupational Tab ── */}
          {activeTab === 'occupational' && (
            <div className="space-y-3">
              <SectionCard
                title="Occupational Information"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={labelCls}>Occupational Status</label>
                    <select value={formData.occupationalStatus} onChange={(e) => handleChange('occupationalStatus', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      <option>Employed</option>
                      <option>Self-Employed</option>
                      <option>Unemployed</option>
                      <option>Student</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Organization</label>
                    <input type="text" value={formData.jobOrganisation} onChange={(e) => handleChange('jobOrganisation', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Designation</label>
                    <input type="text" value={formData.jobDesignation} onChange={(e) => handleChange('jobDesignation', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Total Experience (Years)</label>
                    <input type="text" value={formData.totalOccupationYears} onChange={(e) => handleChange('totalOccupationYears', e.target.value)} className={inputCls} />
                  </div>
                  <div className="col-span-2 md:col-span-3 lg:col-span-4">
                    <label className={labelCls}>Job Description</label>
                    <textarea value={formData.jobDescription} onChange={(e) => handleChange('jobDescription', e.target.value)} rows={3} className={textareaCls} />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── Training Tab ── */}
          {activeTab === 'training' && (
            <div className="space-y-3">
              <SectionCard
                title="Training Programme Details"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={labelCls}>Training Category</label>
                    <input type="text" value={formData.trainingCategory} onChange={(e) => handleChange('trainingCategory', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Batch Code</label>
                    <input type="text" value={formData.batchCode} onChange={(e) => handleChange('batchCode', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── Documents Tab ── */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              <SectionCard
                title="Document Management"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                }
              >
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5 flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700">Document upload functionality will be available soon. For now, you can update other admission details.</p>
                </div>
              </SectionCard>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Update Admission
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/online-admission')}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-all shadow-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
