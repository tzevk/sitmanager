'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface Course { Course_Id: number; Course_Name: string }
interface Batch  { Batch_Id: number; Batch_code: string; Course_Id: number }
interface Status { id: number; label: string }
interface BatchCategoryOption { label: string }
interface Discussion {
  id: number;
  date: string;
  discussion: string;
  created_by: number;
  created_date: string;
}
interface PlacementRow {
  id: number;
  CompanyName: string | null;
  ShortlistDate: string | null;
  Batch_Code: string | null;
  Course_Name: string | null;
  Status: string | null;
  InterviewDate: string | null;
  Result: string | null;
}

const TABS = [
  { id: 'personal',     label: 'Personal Info' },
  { id: 'academic',     label: 'Academic Qualification' },
  { id: 'company',      label: 'Company Information' },
  { id: 'discussion',   label: 'Discussion' },
  { id: 'placement',    label: 'Placement' },
  { id: 'documents',    label: 'Documents' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/* ------------------------------------------------------------------ */
/*  SectionCard                                                         */
/* ------------------------------------------------------------------ */
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const { canUpdate, loading: permLoading } = useResourcePermissions('student');

  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]          = useState('');

  /* dropdown options */
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [batches,  setBatches]  = useState<Batch[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [batchCategories, setBatchCategories] = useState<BatchCategoryOption[]>([]);

  const INQUIRY_MODES = ['Walk-in', 'Phone', 'Mail', 'Website', 'Reference', 'Consultancy', 'Advertisement', 'Social Media', 'Personal', 'Other'];

  /* discussion */
  const [discussions,   setDiscussions]   = useState<Discussion[]>([]);
  const [newDiscussion, setNewDiscussion] = useState('');
  const [discLoading,   setDiscLoading]   = useState(false);

  /* placement */
  const [placement, setPlacement] = useState<PlacementRow[]>([]);

  /* photo */
  const [photo, setPhoto] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState(false);

  /* ---- form ---- */
  const [form, setForm] = useState({
    /* Personal */
    FName: '', MName: '', LName: '', Student_Name: '',
    DOB: '', Sex: '', Nationality: 'Indian',
    Email: '', Present_Mobile: '', Telephone: '',
    Present_Address: '', Present_City: '', Present_State: '',
    Present_Pin: '', Present_Country: 'India',
    Permanent_Address: '', Permanent_State: '', Permanent_Country: 'India',
    /* Academic */
    Qualification: '', Discipline: '', Percentage: '',
    Course_Id: '', Batch_code: '', Batch_Category_id: '',
    /* Company / Occupational */
    OccupationalStatus: '', Organisation: '', Designation: '',
    JobDescription: '', WorkingSince: '', TotalExperience: '',
    /* Inquiry meta */
    Inquiry_From: '', Inquiry_Type: '', Inquiry_Dt: '',
    /* Status */
    Status_id: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ------------------------------------------------------------------ */
  /*  Fetch student data                                                  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/admission-activity/student/${studentId}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load student');

        const s = data.student;
        setForm({
          FName:            s.FName            || '',
          MName:            s.MName            || '',
          LName:            s.LName            || '',
          Student_Name:     s.Student_Name     || '',
          DOB:              s.DOB ? String(s.DOB).slice(0, 10) : '',
          Sex:              s.Sex              || '',
          Nationality:      s.Nationality      || 'Indian',
          Email:            s.Email            || '',
          Present_Mobile:   s.Present_Mobile   || '',
          Telephone:        s.Present_Mobile2  || s.Telephone || '',
          Present_Address:  s.Present_Address  || '',
          Present_City:     s.Present_City     || '',
          Present_State:    s.Present_State    || '',
          Present_Pin:      s.Present_Pin != null ? String(s.Present_Pin) : '',
          Present_Country:  s.Present_Country  || 'India',
          Permanent_Address: s.Permanent_Address || '',
          Permanent_State:  s.Permanent_State  || '',
          Permanent_Country: s.Permanent_Country || 'India',
          Qualification:    s.Qualification    || '',
          Discipline:       s.Discipline       || '',
          Percentage:       s.Percentage != null ? String(s.Percentage) : '',
          Course_Id:        s.Course_Id        ? String(s.Course_Id) : '',
          Batch_code:       s.Batch_Code       || s.Batch_code || '',
          Batch_Category_id: s.Batch_Category_id != null ? String(s.Batch_Category_id) : '',
          OccupationalStatus: s.OccupationalStatus || '',
          Organisation:     s.Organisation     || '',
          Designation:      s.Designation      || '',
          JobDescription:   s.JobDescription   || '',
          WorkingSince:     s.WorkingSince ? String(s.WorkingSince).slice(0, 10) : '',
          TotalExperience:  s.TotalExperience  != null ? String(s.TotalExperience) : '',
          Inquiry_From:     s.Inquiry_From     || '',
          Inquiry_Type:     s.Inquiry_Type     || '',
          Inquiry_Dt:       s.Inquiry_Dt ? String(s.Inquiry_Dt).slice(0, 10) : '',
          Status_id:        s.Status_id != null ? String(s.Status_id) : '',
        });

        setCourses(data.courses           ?? []);
        setBatches(data.batches           ?? []);
        setStatuses(data.statuses         ?? []);
        setBatchCategories(data.batchCategories ?? []);
        setDiscussions(data.discussions ?? []);
        setPlacement(data.placement    ?? []);
        // Photo — accept common column name variants from student_master
        setPhoto(s.Photo || s.Student_Photo || s.PhotoPath || s.Photo_Path || '');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load student');
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  /* ------------------------------------------------------------------ */
  /*  Fetch discussions                                                   */
  /* ------------------------------------------------------------------ */
  const fetchDiscussions = useCallback(async () => {
    if (!studentId) return;
    setDiscLoading(true);
    try {
      const res  = await fetch(`/api/admission-activity/student/${studentId}/discussions`);
      const data = await res.json();
      setDiscussions(data.discussions ?? []);
    } catch { /* silent */ }
    setDiscLoading(false);
  }, [studentId]);

  /* ------------------------------------------------------------------ */
  /*  Save                                                                */
  /* ------------------------------------------------------------------ */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res  = await fetch(`/api/admission-activity/student/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      router.push('/dashboard/student');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Add discussion                                                      */
  /* ------------------------------------------------------------------ */
  const handleAddDiscussion = async () => {
    if (!newDiscussion.trim()) return;
    setDiscLoading(true);
    try {
      const res = await fetch(`/api/admission-activity/student/${studentId}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discussion: newDiscussion }),
      });
      if (!res.ok) throw new Error('Failed to add discussion');
      setNewDiscussion('');
      fetchDiscussions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add discussion');
    }
    setDiscLoading(false);
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied />;

  /* Shared CSS — identical to inquiry / edit online admission */
  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
  const inputCls =
    'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const selectCls =
    'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
  const textareaCls =
    'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

  const filteredBatches = form.Course_Id
    ? batches.filter((b) => String(b.Course_Id) === form.Course_Id)
    : batches;

  return (
    <div className="space-y-3">
      {/* ── Gradient header ── */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/student')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">
              Edit Student
              {form.Student_Name && (
                <span className="ml-2 text-white/80 font-normal text-sm">— {form.Student_Name}</span>
              )}
            </h2>
            <p className="text-xs text-white/70">Students &gt; Edit &gt; #{studentId}</p>
          </div>
        </div>
      </div>

      {/* ── Card ── */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Body */}
        <div className="px-3 py-2 bg-gray-50/40">

          {/* ════════════ PERSONAL INFO ════════════ */}
          {activeTab === 'personal' && (
            <div className="space-y-3">

              {/* Photo card */}
              <SectionCard
                title="Student Photo"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              >
                <div className="flex items-start gap-4 py-1">
                  {/* Preview */}
                  <div className="shrink-0">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.startsWith('http') || photo.startsWith('/') ? photo : `/uploads/students/${photo}`}
                        alt="Student photo"
                        className="w-24 h-24 rounded-lg object-cover border border-gray-200 shadow-sm"
                        onError={() => setPhoto('')}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span className="text-[10px] text-gray-400">No photo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload */}
                  <div className="flex-1 space-y-2">
                    <p className="text-[11px] text-gray-500">Upload a passport-size photo (JPEG / PNG, max 2 MB).</p>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2E3093]/10 hover:bg-[#2E3093]/20 text-[#2E3093] text-xs font-semibold transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      {photoUploading ? 'Uploading…' : 'Choose Photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={photoUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            setError('Photo must be smaller than 2 MB');
                            return;
                          }
                          setPhotoUploading(true);
                          try {
                            const fd = new FormData();
                            fd.append('photo', file);
                            fd.append('studentId', studentId);
                            const res = await fetch(`/api/admission-activity/student/${studentId}/photo`, {
                              method: 'POST',
                              body: fd,
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Upload failed');
                            setPhoto(data.photoUrl ?? data.photo ?? '');
                          } catch (err: unknown) {
                            setError(err instanceof Error ? err.message : 'Photo upload failed');
                          } finally {
                            setPhotoUploading(false);
                          }
                        }}
                      />
                    </label>
                    {photo && (
                      <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{photo}</p>
                    )}
                  </div>
                </div>
              </SectionCard>

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
                    <input type="text" value={form.FName} onChange={(e) => set('FName', e.target.value)} className={inputCls} placeholder="First name" required />
                  </div>
                  <div>
                    <label className={labelCls}>Middle Name</label>
                    <input type="text" value={form.MName} onChange={(e) => set('MName', e.target.value)} className={inputCls} placeholder="Middle name" />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name <span className="text-red-400">*</span></label>
                    <input type="text" value={form.LName} onChange={(e) => set('LName', e.target.value)} className={inputCls} placeholder="Last name" required />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" value={form.DOB} onChange={(e) => set('DOB', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select value={form.Sex} onChange={(e) => set('Sex', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Nationality</label>
                    <input type="text" value={form.Nationality} onChange={(e) => set('Nationality', e.target.value)} className={inputCls} placeholder="Nationality" />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={form.Status_id} onChange={(e) => set('Status_id', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
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
                    <input type="email" value={form.Email} onChange={(e) => set('Email', e.target.value)} className={inputCls} placeholder="Email address" />
                  </div>
                  <div>
                    <label className={labelCls}>Mobile <span className="text-red-400">*</span></label>
                    <input type="tel" value={form.Present_Mobile} onChange={(e) => set('Present_Mobile', e.target.value)} className={inputCls} placeholder="Mobile number" />
                  </div>
                  <div>
                    <label className={labelCls}>Telephone</label>
                    <input type="tel" value={form.Telephone} onChange={(e) => set('Telephone', e.target.value)} className={inputCls} placeholder="Landline" />
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
                    <textarea value={form.Present_Address} onChange={(e) => set('Present_Address', e.target.value)} rows={3} className={textareaCls} placeholder="Present address" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Permanent Address</label>
                    <textarea value={form.Permanent_Address} onChange={(e) => set('Permanent_Address', e.target.value)} rows={3} className={textareaCls} placeholder="Permanent address" />
                  </div>
                  <div>
                    <label className={labelCls}>City</label>
                    <input type="text" value={form.Present_City} onChange={(e) => set('Present_City', e.target.value)} className={inputCls} placeholder="City" />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <input type="text" value={form.Present_State} onChange={(e) => set('Present_State', e.target.value)} className={inputCls} placeholder="State" />
                  </div>
                  <div>
                    <label className={labelCls}>PIN Code</label>
                    <input type="text" value={form.Present_Pin} onChange={(e) => set('Present_Pin', e.target.value)} className={inputCls} placeholder="PIN" />
                  </div>
                  <div>
                    <label className={labelCls}>Country</label>
                    <input type="text" value={form.Present_Country} onChange={(e) => set('Present_Country', e.target.value)} className={inputCls} placeholder="Country" />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ════════════ ACADEMIC QUALIFICATION ════════════ */}
          {activeTab === 'academic' && (
            <div className="space-y-3">
              <SectionCard
                title="Education & Enrolment"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={labelCls}>Qualification / Degree</label>
                    <input type="text" value={form.Qualification} onChange={(e) => set('Qualification', e.target.value)} className={inputCls} placeholder="e.g. B.E., MBA" />
                  </div>
                  <div>
                    <label className={labelCls}>Discipline / Stream</label>
                    <input type="text" value={form.Discipline} onChange={(e) => set('Discipline', e.target.value)} className={inputCls} placeholder="e.g. Computer Science" />
                  </div>
                  <div>
                    <label className={labelCls}>Percentage / CGPA</label>
                    <input type="text" value={form.Percentage} onChange={(e) => set('Percentage', e.target.value)} className={inputCls} placeholder="e.g. 72.5" />
                  </div>
                  <div>
                    <label className={labelCls}>Enrolled Course</label>
                    <select
                      value={form.Course_Id}
                      onChange={(e) => { set('Course_Id', e.target.value); set('Batch_code', ''); }}
                      className={selectCls}
                    >
                      <option value="">— Select Course —</option>
                      {courses.map((c) => (
                        <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Batch</label>
                    <select value={form.Batch_code} onChange={(e) => set('Batch_code', e.target.value)} className={selectCls}>
                      <option value="">— Select Batch —</option>
                      {filteredBatches.map((b) => (
                        <option key={b.Batch_Id} value={b.Batch_code}>{b.Batch_code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Batch Category</label>
                    <select value={form.Batch_Category_id} onChange={(e) => set('Batch_Category_id', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      {batchCategories.map((bc) => (
                        <option key={bc.label} value={bc.label}>{bc.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ════════════ COMPANY INFORMATION ════════════ */}
          {activeTab === 'company' && (
            <div className="space-y-3">
              <SectionCard
                title="Occupational / Company Details"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={labelCls}>Occupational Status</label>
                    <select value={form.OccupationalStatus} onChange={(e) => set('OccupationalStatus', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      <option>Employed</option>
                      <option>Self-Employed</option>
                      <option>Unemployed</option>
                      <option>Student</option>
                      <option>Fresher</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Organisation</label>
                    <input type="text" value={form.Organisation} onChange={(e) => set('Organisation', e.target.value)} className={inputCls} placeholder="Company name" />
                  </div>
                  <div>
                    <label className={labelCls}>Designation</label>
                    <input type="text" value={form.Designation} onChange={(e) => set('Designation', e.target.value)} className={inputCls} placeholder="Job title" />
                  </div>
                  <div>
                    <label className={labelCls}>Working Since</label>
                    <input type="date" value={form.WorkingSince} onChange={(e) => set('WorkingSince', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Total Experience (yrs)</label>
                    <input type="text" value={form.TotalExperience} onChange={(e) => set('TotalExperience', e.target.value)} className={inputCls} placeholder="e.g. 3.5" />
                  </div>
                  <div className="col-span-2 md:col-span-3 lg:col-span-4">
                    <label className={labelCls}>Job Description</label>
                    <textarea value={form.JobDescription} onChange={(e) => set('JobDescription', e.target.value)} rows={3} className={textareaCls} placeholder="Brief description of current role..." />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Inquiry Source"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={labelCls}>Inquiry Date</label>
                    <input type="date" value={form.Inquiry_Dt} onChange={(e) => set('Inquiry_Dt', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Inquiry From (Mode)</label>
                    <select value={form.Inquiry_From} onChange={(e) => set('Inquiry_From', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      {INQUIRY_MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Inquiry Type</label>
                    <select value={form.Inquiry_Type} onChange={(e) => set('Inquiry_Type', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      <option value="Walk-in">Walk-in</option>
                      <option value="Reference">Reference</option>
                      <option value="Online">Online</option>
                      <option value="Consultancy">Consultancy</option>
                      <option value="Advertisement">Advertisement</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ════════════ DISCUSSION ════════════ */}
          {activeTab === 'discussion' && (
            <div className="space-y-3">
              {/* Add new */}
              <SectionCard
                title="New Discussion"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                <textarea
                  value={newDiscussion}
                  onChange={(e) => setNewDiscussion(e.target.value)}
                  placeholder="Type your notes here..."
                  rows={3}
                  className={textareaCls}
                />
                <button
                  type="button"
                  onClick={handleAddDiscussion}
                  disabled={discLoading || !newDiscussion.trim()}
                  className="mt-2 flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {discLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  Add Note
                </button>
              </SectionCard>

              {/* History */}
              <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
                  <h4 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    Discussion History
                    <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {discussions.length}
                    </span>
                  </h4>
                </div>
                <div className="px-3 py-2">
                  {discussions.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">No discussions yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {discussions.map((d, i) => (
                        <div key={d.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#2E3093] mt-1.5 shrink-0" />
                            {i < discussions.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                          </div>
                          <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <p className="text-xs text-gray-800">{d.discussion}</p>
                            <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
                              {d.date
                                ? new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════ PLACEMENT ════════════ */}
          {activeTab === 'placement' && (
            <div className="space-y-3">
              <SectionCard
                title="Placement History"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                }
              >
                {placement.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#2E3093]/10 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-[#2E3093]/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-gray-500">No placement records found.</p>
                    <p className="text-[11px] text-gray-400 mt-1">This student has not been shortlisted by any company yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                          <th className="text-left py-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Batch</th>
                          <th className="text-left py-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Course</th>
                          <th className="text-left py-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Shortlist Date</th>
                          <th className="text-left py-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Interview Date</th>
                          <th className="text-left py-2 px-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {placement.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-2 px-2 font-medium text-gray-900">{p.CompanyName || '—'}</td>
                            <td className="py-2 px-2 text-gray-600">{p.Batch_Code || '—'}</td>
                            <td className="py-2 px-2 text-gray-600">{p.Course_Name || '—'}</td>
                            <td className="py-2 px-2 text-gray-600">
                              {p.ShortlistDate
                                ? new Date(p.ShortlistDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                            </td>
                            <td className="py-2 px-2 text-gray-600">
                              {p.InterviewDate
                                ? new Date(p.InterviewDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                            </td>
                            <td className="py-2 px-2">
                              {p.Result ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  p.Result.toLowerCase().includes('select') || p.Result.toLowerCase().includes('place')
                                    ? 'bg-green-100 text-green-700'
                                    : p.Result.toLowerCase().includes('reject')
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {p.Result}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ════════════ DOCUMENTS ════════════ */}
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
                  <p className="text-xs text-blue-700">
                    Document upload functionality will be available soon. For now, you can update other student details.
                  </p>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── Action buttons (shown on all tabs except discussion / placement / documents) ── */}
          {activeTab !== 'discussion' && activeTab !== 'placement' && activeTab !== 'documents' && (
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
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/student')}
                className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-all shadow-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
