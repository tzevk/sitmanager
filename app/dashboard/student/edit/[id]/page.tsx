'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { StudentTransferBadge } from '../../../../../components/ui/StudentTransferBadge';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface Course { Course_Id: number; Course_Name: string }
interface Batch  { Batch_Id: number; Batch_code: string; Course_Id: number }
interface Status { id: number; label: string }
interface BatchCategoryOption { id: number; label: string }
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
interface DocumentRow {
  id: number;
  doc_name: string;
  upload_image: string;
}

function buildStudentDocumentUrl(studentId: string, uploadImage: string): string {
  const safePath = String(uploadImage || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/api/student-documents/${encodeURIComponent(studentId)}/${safePath}`;
}

function formatDocumentLabel(docName: string, uploadImage: string): string {
  const raw = (docName || uploadImage || '')
    .replace(/^oa:/i, '')
    .replace(/_file$/i, '')
    .replace(/_/g, ' ')
    .trim();
  return raw.replace(/\b\w/g, (char) => char.toUpperCase()) || 'Document';
}

/* Structured academic ("Education & Enrolment") — mirrors the admission form */
interface KtDetail { subjectName: string; year: string; semester: string; clearedYear: string; marks: string }
type EduLevel = 'ssc' | 'hsc' | 'diploma' | 'grad' | 'postgrad';
const emptyEducation = {
  ssc_board: '', ssc_schoolName: '', ssc_yearOfPassing: '', ssc_percentage: '', ssc_ktCount: '0', ssc_ktDetails: [] as KtDetail[],
  hsc_board: '', hsc_collegeName: '', hsc_stream: '', hsc_yearOfPassing: '', hsc_percentage: '', hsc_ktCount: '0', hsc_ktDetails: [] as KtDetail[],
  diploma_degree: '', diploma_specialization: '', diploma_institute: '', diploma_yearOfPassing: '', diploma_percentage: '', diploma_ktCount: '0', diploma_ktDetails: [] as KtDetail[],
  grad_degree: '', grad_specialization: '', grad_university: '', grad_yearOfPassing: '', grad_percentage: '', grad_ktCount: '0', grad_ktDetails: [] as KtDetail[],
  postgrad_degree: '', postgrad_specialization: '', postgrad_university: '', postgrad_yearOfPassing: '', postgrad_percentage: '', postgrad_ktCount: '0', postgrad_ktDetails: [] as KtDetail[],
  educationRemark: '',
};
type EducationState = typeof emptyEducation;

const TABS = [
  { id: 'personal',     label: 'Personal Info' },
  { id: 'academic',     label: 'Academic Qualification' },
  { id: 'company',      label: 'Company Information' },
  { id: 'transfer',     label: 'Transfer / Cancel' },
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
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-4 py-2 border-b border-slate-200">
        <h3 className="text-[12px] font-black text-[#2E3093] flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
            {icon}
          </span>
          {title}
        </h3>
      </div>
      <div className="px-4 py-3">{children}</div>
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
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [discLoading, setDiscLoading] = useState(false);
  const [discError, setDiscError] = useState('');

  /* placement */
  const [placement, setPlacement] = useState<PlacementRow[]>([]);

  /* fees */
  const [fees, setFees] = useState<{ total: number; paid: number; balance: number }>({ total: 0, paid: 0, balance: 0 });

  /* documents */
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  /* sidebar stats */
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');

  /* ---- form ---- */
  const [form, setForm] = useState({
    /* Personal */
    FName: '', MName: '', LName: '', Student_Name: '',
    DOB: '', Sex: '', Nationality: 'Indian',
    Email: '', Present_Mobile: '', Telephone: '',
    Present_Address: '', Present_City: '', Present_State: '',
    Present_Pin: '', Present_Country: 'India',
    Permanent_Address: '', Permanent_City: '', Permanent_Pin: '',
    Permanent_State: '', Permanent_Country: 'India',
    /* Academic */
    Qualification: '', Discipline: '', Percentage: '',
    Course_Id: '', Batch_code: '', Batch_Category_id: '',
    /* Company / Occupational */
    OccupationalStatus: '', Organisation: '', Designation: '',
    JobDescription: '', WorkingSince: '', TotalExperience: '',
    /* Inquiry meta */
    Inquiry_From: '', Inquiry_Type: '', Inquiry_Dt: '',
    /* Status */
    Status_id: '', Status_date: '',
    /* Transfer / move-to */
    Transfered: '', Moved_To_Course_Id: '', Moved_To_Batch_Code: '',
    /* Admission */
    Admission_Dt: '',
    /* Student portal / referral */
    Login_Password: '', Refered_By: '',
    /* Placement */
    SitPerformance: '', PlacementRemark: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ---- structured academic ("Education & Enrolment") ---- */
  const emptyKt = (): KtDetail => ({ subjectName: '', year: '', semester: '', clearedYear: '', marks: '' });
  const [education, setEducation] = useState<EducationState>(emptyEducation);
  const [academicSubTab, setAcademicSubTab] = useState<EduLevel | 'graduation'>('ssc');

  const setEdu = (field: keyof EducationState, value: string) =>
    setEducation((prev) => ({ ...prev, [field]: value }));

  const setKtCount = (level: EduLevel, countStr: string) => {
    const count = Math.max(0, parseInt(countStr) || 0);
    setEducation((prev) => {
      const existing = (prev[`${level}_ktDetails`] as KtDetail[]) || [];
      const next = Array.from({ length: count }, (_, i) => existing[i] ?? emptyKt());
      return { ...prev, [`${level}_ktCount`]: String(count), [`${level}_ktDetails`]: next };
    });
  };

  const setKtDetail = (level: EduLevel, index: number, field: keyof KtDetail, value: string) => {
    setEducation((prev) => {
      const arr = [...((prev[`${level}_ktDetails`] as KtDetail[]) || [])];
      arr[index] = { ...(arr[index] ?? emptyKt()), [field]: value };
      return { ...prev, [`${level}_ktDetails`]: arr };
    });
  };

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
          Permanent_City:   s.Permanent_City   || '',
          Permanent_Pin:    s.Permanent_Pin != null ? String(s.Permanent_Pin) : '',
          Permanent_State:  s.Permanent_State  || '',
          Permanent_Country: s.Permanent_Country || 'India',
          Qualification:    s.Qualification    || '',
          Discipline:       s.Discipline       || '',
          Percentage:       s.Percentage != null ? String(s.Percentage) : '',
          Course_Id:        s.Course_Id        ? String(s.Course_Id) : '',
          Batch_code:       s.Batch_Code       || s.Batch_code || '',
          Batch_Category_id: s.Batch_Category_id != null ? String(s.Batch_Category_id) : '',
          OccupationalStatus: s.OccupationalStatus || s.Occupation || '',
          Organisation:     s.Organisation     || s.Company || '',
          Designation:      s.Designation      || '',
          JobDescription:   s.JobDescription   || '',
          WorkingSince:     s.WorkingSince ? String(s.WorkingSince).slice(0, 10) : '',
          TotalExperience:  s.TotalExperience  != null ? String(s.TotalExperience) : '',
          Inquiry_From:     s.Inquiry_From     || '',
          Inquiry_Type:     s.Inquiry_Type     || '',
          Inquiry_Dt:       s.Inquiry_Dt ? String(s.Inquiry_Dt).slice(0, 10) : '',
          Status_id:        s.Status_id != null ? String(s.Status_id) : '',
          Status_date:      s.Status_date ? String(s.Status_date).slice(0, 10) : '',
          Transfered:       s.Transfered || '',
          Moved_To_Course_Id: s.Moved_To_Course_Id != null ? String(s.Moved_To_Course_Id) : '',
          Moved_To_Batch_Code: s.Moved_To_Batch_Code || '',
          Admission_Dt:     s.Admission_Dt ? String(s.Admission_Dt).slice(0, 10) : '',
          Login_Password:   s.Login_Password   || '',
          Refered_By:       s.Refered_By       || '',
          SitPerformance:   s.SitPerformance != null && String(s.SitPerformance) !== 'NULL' ? String(s.SitPerformance) : '',
          PlacementRemark:  s.PlacementRemark && s.PlacementRemark !== 'NULL' ? s.PlacementRemark : '',
        });

        setBatchStartDate(s.Batch_StartDate ? String(s.Batch_StartDate).slice(0, 10) : '');
        setBatchEndDate(s.Batch_EndDate ? String(s.Batch_EndDate).slice(0, 10) : '');

        // Structured academic data (admission payload)
        const e = (data.education ?? {}) as Record<string, unknown>;
        const nextEdu = { ...emptyEducation } as Record<string, unknown>;
        (Object.keys(emptyEducation) as Array<keyof EducationState>).forEach((k) => {
          const v = e[k];
          if (k.endsWith('_ktDetails')) {
            const arr = Array.isArray(v) ? (v as KtDetail[]) : [];
            nextEdu[k] = arr.map((d) => ({ ...emptyKt(), ...d }));
          } else if (k.endsWith('_ktCount')) {
            nextEdu[k] = v ? String(v) : '0';
          } else {
            nextEdu[k] = v != null ? String(v) : '';
          }
        });
        // Keep each level's KT count in sync with the number of detail rows.
        (['ssc', 'hsc', 'diploma', 'grad', 'postgrad'] as EduLevel[]).forEach((lvl) => {
          const details = nextEdu[`${lvl}_ktDetails`] as KtDetail[];
          if (details.length) nextEdu[`${lvl}_ktCount`] = String(details.length);
        });
        setEducation(nextEdu as EducationState);

        setCourses(data.courses           ?? []);
        setBatches(data.batches           ?? []);
        setStatuses(data.statuses         ?? []);
        setBatchCategories(data.batchCategories ?? []);
        setDiscussions(data.discussions ?? []);
        setPlacement(data.placement    ?? []);
        setFees(data.fees ?? { total: 0, paid: 0, balance: 0 });
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
    setDiscError('');
    try {
      const res  = await fetch(`/api/admission-activity/student/${studentId}/discussions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDiscussions(data.discussions ?? []);
    } catch (e: unknown) {
      setDiscError(e instanceof Error ? e.message : 'Failed to load discussions');
    }
    setDiscLoading(false);
  }, [studentId]);

  // Refresh discussions whenever the Discussion tab is opened
  useEffect(() => {
    if (activeTab === 'discussion' && studentId) {
      fetchDiscussions();
    }
  }, [activeTab, studentId, fetchDiscussions]);

  /* ------------------------------------------------------------------ */
  /*  Fetch documents (lazy — only when the Documents tab is opened)      */
  /* ------------------------------------------------------------------ */
  const fetchDocuments = useCallback(async () => {
    if (!studentId) return;
    setDocsLoading(true);
    setDocsError('');
    try {
      const res  = await fetch(`/api/admission-activity/student/${studentId}/documents`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDocuments(data.documents ?? []);
      setDocsLoaded(true);
    } catch (e: unknown) {
      setDocsError(e instanceof Error ? e.message : 'Failed to load documents');
    }
    setDocsLoading(false);
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'documents' && studentId && !docsLoaded) {
      fetchDocuments();
    }
  }, [activeTab, studentId, docsLoaded, fetchDocuments]);

  /* ------------------------------------------------------------------ */
  /*  Upload document                                                     */
  /* ------------------------------------------------------------------ */
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('doc_name', uploadDocName || uploadFile.name.replace(/\.[^.]+$/, ''));
      const res = await fetch(`/api/admission-activity/student/${studentId}/documents`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setDocuments((prev) => [...prev, data.document]);
      setUploadFile(null);
      setUploadDocName('');
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Save                                                                */
  /* ------------------------------------------------------------------ */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const transfered = String(form.Transfered).trim().toLowerCase() === 'yes';
      if (transfered && (!form.Moved_To_Course_Id || !form.Moved_To_Batch_Code)) {
        throw new Error('Select both moved-to training programme and batch before saving the transfer.');
      }
      const res  = await fetch(`/api/admission-activity/student/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, education }),
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

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied />;

  /* Shared CSS — compact style */
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1';
  const inputCls =
    'w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium';
  const selectCls =
    'w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/10 focus:border-[#2E3093] transition-all font-medium';
  const textareaCls =
    'w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium resize-none';

  /* Academic option lists — mirror the admission form */
  const BOARD_OPTS = ['CBSE', 'ICSE', 'State Board', 'Other'];
  const HSC_STREAM_OPTS = ['Science', 'Commerce', 'Arts', 'Vocational'];
  const DIPLOMA_DEGREE_OPTS = ['Diploma', 'I.T.I.', 'Mech. Draughtsman', 'Civil Draughtsman', 'Piping Draftsman', 'Electronics', 'Electrical', 'OTHERS'];
  const GRAD_DEGREE_OPTS = ['B.SC', 'B.E.', 'B.TECH', 'B.COM', 'B.A.', 'BBA', 'BCA', 'OTHERS'];
  const PG_DEGREE_OPTS = ['M.E.', 'M.TECH', 'M.SC', 'MBA', 'M.COM', 'M.A.', 'MCA', 'PHD', 'OTHERS'];
  const SPECIALIZATION_OPTS = ['Mechanical', 'Chemical', 'Computers', 'Production', 'Electronics & Tele-Communication', 'Eletrical', 'Civil', 'Instrumentation', 'Petrochemical', 'Industrial', 'Automobile', 'Fabrication', 'N.C.T.V.T.', 'M.C.V.C', 'Refrigeration & Airconditioning', 'Electrical & Electronics', 'Fitter'];
  const KT_SEM_MAX: Record<EduLevel, number> = { ssc: 2, hsc: 2, diploma: 6, grad: 8, postgrad: 4 };

  /* KT / backlog editor for one education level */
  const renderKt = (level: EduLevel) => {
    const count = parseInt(String(education[`${level}_ktCount`])) || 0;
    const details = (education[`${level}_ktDetails`] as KtDetail[]) || [];
    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
          <div>
            <label className={labelCls}>KT / Backlog Subjects</label>
            <select className={selectCls} value={String(count)} onChange={(e) => setKtCount(level, e.target.value)}>
              <option value="0">No KT</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} Subject{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
        </div>
        {count > 0 && details.map((kt, i) => (
          <div key={i} className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-bold text-slate-600 mb-2">KT Subject {i + 1}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2">
              <div className="col-span-2 lg:col-span-1">
                <label className={labelCls}>Subject</label>
                <input className={inputCls} value={kt.subjectName} onChange={(e) => setKtDetail(level, i, 'subjectName', e.target.value)} placeholder="Subject name" />
              </div>
              <div>
                <label className={labelCls}>Year</label>
                <input type="number" className={inputCls} value={kt.year} onChange={(e) => setKtDetail(level, i, 'year', e.target.value)} placeholder="YYYY" />
              </div>
              <div>
                <label className={labelCls}>Semester</label>
                <select className={selectCls} value={kt.semester} onChange={(e) => setKtDetail(level, i, 'semester', e.target.value)}>
                  <option value="">—</option>
                  {Array.from({ length: KT_SEM_MAX[level] }, (_, s) => s + 1).map((s) => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Cleared Year</label>
                <input type="number" className={inputCls} value={kt.clearedYear} onChange={(e) => setKtDetail(level, i, 'clearedYear', e.target.value)} placeholder="YYYY" />
              </div>
              <div>
                <label className={labelCls}>Marks</label>
                <input type="number" className={inputCls} value={kt.marks} onChange={(e) => setKtDetail(level, i, 'marks', e.target.value)} placeholder="If cleared" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const eduSubTabs: { id: EduLevel | 'graduation'; label: string }[] = [
    { id: 'ssc', label: 'SSC (10th)' },
    { id: 'hsc', label: 'HSC (12th)' },
    { id: 'diploma', label: 'Diploma' },
    { id: 'graduation', label: 'Graduation' },
    { id: 'postgrad', label: 'Post-Graduation' },
  ];

  const filteredBatches = form.Course_Id
    ? batches.filter((b) => String(b.Course_Id) === form.Course_Id)
    : batches;

  const movedToBatches = form.Moved_To_Course_Id
    ? batches.filter((b) => String(b.Course_Id) === form.Moved_To_Course_Id)
    : batches;

  const isTransferred = String(form.Transfered).trim().toLowerCase() === 'yes';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-6 py-4 shadow-[0_6px_20px_rgba(46,48,147,0.15)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="flex items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={() => router.push('/dashboard/student')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Edit Student
              {form.Student_Name && (
                <span className="ml-2 text-white/80 font-semibold text-sm">— {form.Student_Name}</span>
              )}
            </h2>
            <p className="text-[11px] text-white/70 font-medium">Students &gt; Edit &gt; #{studentId}</p>
          </div>
        </div>
      </div>

      {/* ── Card ── */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-4 bg-slate-50/80 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#2E3093] text-[#2E3093] bg-white -mb-px rounded-t-md'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
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
        <div className="px-4 py-4 bg-slate-50/40">

          {/* ==== PERSONAL INFO ==== */}
          {activeTab === 'personal' && (
            <div className="space-y-4">

              {/* ── 3-column grid matching old system layout ── */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_200px] gap-4 items-start">

                {/* ── Column 1: Student Details ── */}
                <SectionCard
                  title="Student Details"
                  icon={
                    <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                >
                  <div className="flex flex-col gap-3">
                    {/* B.M. ID */}
                    <div>
                      <label className={labelCls}>B.M. ID</label>
                      <input value={studentId} readOnly className={`${inputCls} bg-slate-100 cursor-default`} />
                    </div>

                    {/* Name parts */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className={labelCls}>First <span className="text-red-400">*</span></label>
                        <input type="text" value={form.FName} onChange={(e) => set('FName', e.target.value)} className={inputCls} placeholder="First" required />
                      </div>
                      <div>
                        <label className={labelCls}>Middle</label>
                        <input type="text" value={form.MName} onChange={(e) => set('MName', e.target.value)} className={inputCls} placeholder="Middle" />
                      </div>
                      <div>
                        <label className={labelCls}>Last <span className="text-red-400">*</span></label>
                        <input type="text" value={form.LName} onChange={(e) => set('LName', e.target.value)} className={inputCls} placeholder="Last" required />
                      </div>
                    </div>

                    {/* Gender + Nationality */}
                    <div className="grid grid-cols-2 gap-2">
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
                        <input type="text" value={form.Nationality} onChange={(e) => set('Nationality', e.target.value)} className={inputCls} />
                      </div>
                    </div>

                    {/* DOB */}
                    <div>
                      <label className={labelCls}>Date of Birth</label>
                      <input type="date" value={form.DOB} onChange={(e) => set('DOB', e.target.value)} className={inputCls} />
                    </div>

                    {/* Portal Password */}
                    <div>
                      <label className={labelCls}>Portal Password</label>
                      <input type="text" value={form.Login_Password} onChange={(e) => set('Login_Password', e.target.value)} className={inputCls} placeholder="Student portal login password" />
                    </div>

                    {/* Email */}
                    <div>
                      <label className={labelCls}>Email <span className="text-red-400">*</span></label>
                      <input type="email" value={form.Email} onChange={(e) => set('Email', e.target.value)} className={inputCls} placeholder="Email address" />
                    </div>

                    {/* Batch Code (read-only display) */}
                    <div>
                      <label className={labelCls}>Batch Code</label>
                      <input value={form.Batch_code} readOnly className={`${inputCls} bg-slate-100 cursor-default`} />
                    </div>

                    {/* How they know SIT */}
                    <div>
                      <label className={labelCls}>How They Know SIT</label>
                      <select value={form.Inquiry_From} onChange={(e) => set('Inquiry_From', e.target.value)} className={selectCls}>
                        <option value="">— Select —</option>
                        {INQUIRY_MODES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Referred By */}
                    <div>
                      <label className={labelCls}>Referred By</label>
                      <input type="text" value={form.Refered_By} onChange={(e) => set('Refered_By', e.target.value)} className={inputCls} placeholder="Referral name" />
                    </div>
                  </div>
                </SectionCard>

                {/* ── Column 2: Training + Online Admission + Status + Permanent Address ── */}
                <div className="space-y-3">

                  {/* Training Programme & Batch Detail */}
                  <SectionCard
                    title="Training Programme & Batch Detail"
                    icon={
                      <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      </svg>
                    }
                  >
                    <div className="space-y-2">
                      <div>
                        <label className={labelCls}>Training Programme</label>
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
                      <div className="grid grid-cols-2 gap-2">
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
                          <label className={labelCls}>Category</label>
                          <select value={form.Batch_Category_id} onChange={(e) => set('Batch_Category_id', e.target.value)} className={selectCls}>
                            <option value="">— Select —</option>
                            {batchCategories.map((bc) => (
                              <option key={bc.id} value={bc.id}>{bc.label}</option>
                            ))}
                          </select>
                        </div>
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

                  {/* Admission Dates */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-4 py-2 border-b border-slate-200">
                      <h3 className="text-[12px] font-black text-[#2E3093] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </span>
                        Dates
                      </h3>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Admission Date</label>
                        <input type="date" value={form.Admission_Dt} onChange={(e) => set('Admission_Dt', e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Inquiry Date</label>
                        <input type="date" value={form.Inquiry_Dt} onChange={(e) => set('Inquiry_Dt', e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  </div>

                  {/* Status + Status Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Status</label>
                      <select value={form.Status_id} onChange={(e) => set('Status_id', e.target.value)} className={selectCls}>
                        <option value="">— Select —</option>
                        {statuses.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Status Date</label>
                      <input type="date" value={form.Status_date} onChange={(e) => set('Status_date', e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  {/* Permanent Address */}
                  <SectionCard
                    title="Permanent Address"
                    icon={
                      <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    }
                  >
                    <div className="space-y-2">
                      <div>
                        <label className={labelCls}>Address</label>
                        <textarea value={form.Permanent_Address} onChange={(e) => set('Permanent_Address', e.target.value)} rows={3} className={textareaCls} placeholder="Permanent address" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>City</label>
                          <input type="text" value={form.Permanent_City} onChange={(e) => set('Permanent_City', e.target.value)} className={inputCls} placeholder="City" />
                        </div>
                        <div>
                          <label className={labelCls}>PIN Code</label>
                          <input type="text" value={form.Permanent_Pin} onChange={(e) => set('Permanent_Pin', e.target.value)} className={inputCls} placeholder="PIN" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>State</label>
                          <input type="text" value={form.Permanent_State} onChange={(e) => set('Permanent_State', e.target.value)} className={inputCls} placeholder="State" />
                        </div>
                        <div>
                          <label className={labelCls}>Country</label>
                          <input type="text" value={form.Permanent_Country} onChange={(e) => set('Permanent_Country', e.target.value)} className={inputCls} placeholder="Country" />
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>

                {/* ── Column 3: Student Info Sidebar (read-only) ── */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-4 py-3 border-b border-slate-200">
                    <h3 className="text-[13px] font-black text-[#2E3093] flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#2E3093]/10 flex items-center justify-center">
                        <svg className="w-3 h-3 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </span>
                      Student Info
                    </h3>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {/* Fees */}
                    <p className="text-[10px] font-black text-[#2E3093] uppercase tracking-widest mb-1">Fees</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Total Fees</span>
                      <span className="text-[11px] font-bold text-slate-700 font-mono">{fees.total ? `₹${fees.total.toLocaleString('en-IN')}` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Paid</span>
                      <span className="text-[11px] font-bold text-green-700 font-mono">{`₹${(fees.paid || 0).toLocaleString('en-IN')}`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Balance Fees</span>
                      <span className={`text-[11px] font-bold font-mono ${fees.balance > 0 ? 'text-red-600' : 'text-slate-700'}`}>{`₹${(fees.balance || 0).toLocaleString('en-IN')}`}</span>
                    </div>

                    <div className="border-t border-slate-200 pt-2.5 mt-1">
                      <p className="text-[10px] font-black text-[#2E3093] uppercase tracking-widest mb-2">Performance</p>
                      <div className="space-y-1.5">
                        {[
                          { label: 'Assignment Avg',  value: '—' },
                          { label: 'Unit Test Avg',   value: '—' },
                          { label: 'Final Exam',      value: '—' },
                          { label: 'Attendance (%)',  value: '—' },
                          { label: 'Final Total',     value: '—' },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-medium">{item.label}</span>
                            <span className="text-[11px] font-bold text-slate-700">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-2.5 mt-1">
                      <p className="text-[10px] font-black text-[#2E3093] uppercase tracking-widest mb-2">Batch Details</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Batch Start</span>
                          <span className="text-[11px] font-semibold text-slate-700">{batchStartDate || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Batch End</span>
                          <span className="text-[11px] font-semibold text-slate-700">{batchEndDate || '—'}</span>
                        </div>
                        <StudentTransferBadge
                          transferred={form.Transfered}
                          movedToCourseName={courses.find((c) => String(c.Course_Id) === form.Moved_To_Course_Id)?.Course_Name}
                          movedToBatchCode={form.Moved_To_Batch_Code}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Full-width: Present Address ── */}
              <SectionCard
                title="Present Address"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-2">
                  <div className="col-span-2 md:col-span-4 lg:col-span-6">
                    <label className={labelCls}>Address</label>
                    <textarea value={form.Present_Address} onChange={(e) => set('Present_Address', e.target.value)} rows={2} className={textareaCls} placeholder="Present address" />
                  </div>
                  <div>
                    <label className={labelCls}>City</label>
                    <input type="text" value={form.Present_City} onChange={(e) => set('Present_City', e.target.value)} className={inputCls} placeholder="City" />
                  </div>
                  <div>
                    <label className={labelCls}>PIN Code</label>
                    <input type="text" value={form.Present_Pin} onChange={(e) => set('Present_Pin', e.target.value)} className={inputCls} placeholder="PIN" />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <input type="text" value={form.Present_State} onChange={(e) => set('Present_State', e.target.value)} className={inputCls} placeholder="State" />
                  </div>
                  <div>
                    <label className={labelCls}>Country</label>
                    <input type="text" value={form.Present_Country} onChange={(e) => set('Present_Country', e.target.value)} className={inputCls} placeholder="Country" />
                  </div>
                  <div>
                    <label className={labelCls}>Mobile <span className="text-red-400">*</span></label>
                    <input type="tel" value={form.Present_Mobile} onChange={(e) => set('Present_Mobile', e.target.value)} className={inputCls} placeholder="Mobile" />
                  </div>
                  <div>
                    <label className={labelCls}>Telephone</label>
                    <input type="tel" value={form.Telephone} onChange={(e) => set('Telephone', e.target.value)} className={inputCls} placeholder="Landline" />
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ==== ACADEMIC QUALIFICATION ==== */}
          {activeTab === 'academic' && (
            <div className="space-y-3">
              {/* ── Enrolment ── */}
              <SectionCard
                title="Enrolment"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
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
                        <option key={bc.id} value={bc.id}>{bc.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </SectionCard>

              {/* ── Education (admission-form style) ── */}
              <SectionCard
                title="Education"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                }
              >
                {/* Sub-tab nav */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {eduSubTabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAcademicSubTab(t.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                        academicSubTab === t.id
                          ? 'text-white bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-[#2A6BB5] shadow-sm'
                          : 'text-slate-600 bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* SSC */}
                {academicSubTab === 'ssc' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                      <div>
                        <label className={labelCls}>Board</label>
                        <select className={selectCls} value={education.ssc_board} onChange={(e) => setEdu('ssc_board', e.target.value)}>
                          <option value="">Select</option>
                          {BOARD_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>School Name</label>
                        <input className={inputCls} value={education.ssc_schoolName} onChange={(e) => setEdu('ssc_schoolName', e.target.value)} placeholder="School name" />
                      </div>
                      <div>
                        <label className={labelCls}>Year of Passing</label>
                        <input type="number" className={inputCls} value={education.ssc_yearOfPassing} onChange={(e) => setEdu('ssc_yearOfPassing', e.target.value)} placeholder="YYYY" />
                      </div>
                      <div>
                        <label className={labelCls}>Percentage / CGPA</label>
                        <input className={inputCls} value={education.ssc_percentage} onChange={(e) => setEdu('ssc_percentage', e.target.value)} placeholder="e.g. 85%" />
                      </div>
                    </div>
                    {renderKt('ssc')}
                  </div>
                )}

                {/* HSC */}
                {academicSubTab === 'hsc' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                      <div>
                        <label className={labelCls}>Board</label>
                        <select className={selectCls} value={education.hsc_board} onChange={(e) => setEdu('hsc_board', e.target.value)}>
                          <option value="">Select</option>
                          {BOARD_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>College / Jr. College</label>
                        <input className={inputCls} value={education.hsc_collegeName} onChange={(e) => setEdu('hsc_collegeName', e.target.value)} placeholder="College name" />
                      </div>
                      <div>
                        <label className={labelCls}>Stream</label>
                        <select className={selectCls} value={education.hsc_stream} onChange={(e) => setEdu('hsc_stream', e.target.value)}>
                          <option value="">Select</option>
                          {HSC_STREAM_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Year of Passing</label>
                        <input type="number" className={inputCls} value={education.hsc_yearOfPassing} onChange={(e) => setEdu('hsc_yearOfPassing', e.target.value)} placeholder="YYYY" />
                      </div>
                      <div>
                        <label className={labelCls}>Percentage / CGPA</label>
                        <input className={inputCls} value={education.hsc_percentage} onChange={(e) => setEdu('hsc_percentage', e.target.value)} placeholder="e.g. 75%" />
                      </div>
                    </div>
                    {renderKt('hsc')}
                  </div>
                )}

                {/* Diploma */}
                {academicSubTab === 'diploma' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                      <div>
                        <label className={labelCls}>Diploma Degree</label>
                        <select className={selectCls} value={education.diploma_degree} onChange={(e) => setEdu('diploma_degree', e.target.value)}>
                          <option value="">Select</option>
                          {DIPLOMA_DEGREE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Specialization</label>
                        <select className={selectCls} value={education.diploma_specialization} onChange={(e) => setEdu('diploma_specialization', e.target.value)}>
                          <option value="">Select</option>
                          {SPECIALIZATION_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Year of Passing</label>
                        <input type="number" className={inputCls} value={education.diploma_yearOfPassing} onChange={(e) => setEdu('diploma_yearOfPassing', e.target.value)} placeholder="YYYY" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Institute Name</label>
                        <input className={inputCls} value={education.diploma_institute} onChange={(e) => setEdu('diploma_institute', e.target.value)} placeholder="Institute name" />
                      </div>
                      <div>
                        <label className={labelCls}>Percentage / CGPA</label>
                        <input className={inputCls} value={education.diploma_percentage} onChange={(e) => setEdu('diploma_percentage', e.target.value)} placeholder="e.g. 70%" />
                      </div>
                    </div>
                    {renderKt('diploma')}
                  </div>
                )}

                {/* Graduation */}
                {academicSubTab === 'graduation' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                      <div>
                        <label className={labelCls}>Graduation Degree</label>
                        <select className={selectCls} value={education.grad_degree} onChange={(e) => setEdu('grad_degree', e.target.value)}>
                          <option value="">Select</option>
                          {GRAD_DEGREE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Specialization</label>
                        <select className={selectCls} value={education.grad_specialization} onChange={(e) => setEdu('grad_specialization', e.target.value)}>
                          <option value="">Select</option>
                          {SPECIALIZATION_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Year of Passing</label>
                        <input type="number" className={inputCls} value={education.grad_yearOfPassing} onChange={(e) => setEdu('grad_yearOfPassing', e.target.value)} placeholder="YYYY" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>University</label>
                        <input className={inputCls} value={education.grad_university} onChange={(e) => setEdu('grad_university', e.target.value)} placeholder="University name" />
                      </div>
                      <div>
                        <label className={labelCls}>Percentage / CGPA</label>
                        <input className={inputCls} value={education.grad_percentage} onChange={(e) => setEdu('grad_percentage', e.target.value)} placeholder="e.g. 65%" />
                      </div>
                    </div>
                    {renderKt('grad')}
                  </div>
                )}

                {/* Post-Graduation */}
                {academicSubTab === 'postgrad' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                      <div>
                        <label className={labelCls}>PG Degree</label>
                        <select className={selectCls} value={education.postgrad_degree} onChange={(e) => setEdu('postgrad_degree', e.target.value)}>
                          <option value="">Select</option>
                          {PG_DEGREE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Specialization</label>
                        <select className={selectCls} value={education.postgrad_specialization} onChange={(e) => setEdu('postgrad_specialization', e.target.value)}>
                          <option value="">Select</option>
                          {SPECIALIZATION_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Year of Passing</label>
                        <input type="number" className={inputCls} value={education.postgrad_yearOfPassing} onChange={(e) => setEdu('postgrad_yearOfPassing', e.target.value)} placeholder="YYYY" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>University</label>
                        <input className={inputCls} value={education.postgrad_university} onChange={(e) => setEdu('postgrad_university', e.target.value)} placeholder="University name" />
                      </div>
                      <div>
                        <label className={labelCls}>Percentage / CGPA</label>
                        <input className={inputCls} value={education.postgrad_percentage} onChange={(e) => setEdu('postgrad_percentage', e.target.value)} placeholder="e.g. 70%" />
                      </div>
                    </div>
                    {renderKt('postgrad')}
                  </div>
                )}

                {/* Additional remark */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <label className={labelCls}>Additional Remarks</label>
                  <textarea rows={2} className={textareaCls} value={education.educationRemark} onChange={(e) => setEdu('educationRemark', e.target.value)} placeholder="Any additional information about educational qualifications" />
                </div>
              </SectionCard>
            </div>
          )}

          {/* ==== COMPANY INFORMATION ==== */}
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

          {/* ==== TRANSFER / CANCEL ==== */}
          {activeTab === 'transfer' && (
            <div className="space-y-3">
              <SectionCard
                title="Batch Transfer Flow"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Transferred</label>
                    <select
                      value={form.Transfered}
                      onChange={(e) => {
                        const next = e.target.value;
                        set('Transfered', next);
                        if (next !== 'Yes') {
                          set('Moved_To_Course_Id', '');
                          set('Moved_To_Batch_Code', '');
                        }
                      }}
                      className={selectCls}
                    >
                      <option value="">— Select —</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Moved To Training Programme</label>
                    <select
                      value={form.Moved_To_Course_Id}
                      onChange={(e) => {
                        set('Moved_To_Course_Id', e.target.value);
                        set('Moved_To_Batch_Code', '');
                      }}
                      className={selectCls}
                      disabled={!isTransferred}
                    >
                      <option value="">— Select Course —</option>
                      {courses.map((c) => (
                        <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Moved To Batch</label>
                    <select
                      value={form.Moved_To_Batch_Code}
                      onChange={(e) => set('Moved_To_Batch_Code', e.target.value)}
                      className={selectCls}
                      disabled={!isTransferred || !form.Moved_To_Course_Id}
                    >
                      <option value="">— Select Batch —</option>
                      {movedToBatches.map((b) => (
                        <option key={b.Batch_Id} value={b.Batch_code}>{b.Batch_code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <StudentTransferBadge
                      transferred={form.Transfered}
                      movedToCourseName={courses.find((c) => String(c.Course_Id) === form.Moved_To_Course_Id)?.Course_Name}
                      movedToBatchCode={form.Moved_To_Batch_Code}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Cancel Flow"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={form.Status_id} onChange={(e) => set('Status_id', e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Status Date</label>
                    <input type="date" value={form.Status_date} onChange={(e) => set('Status_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cancelStatus = statuses.find((s) => s.label.toLowerCase().includes('cancel'));
                      if (cancelStatus) set('Status_id', String(cancelStatus.id));
                      set('Status_date', new Date().toISOString().slice(0, 10));
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  >
                    Mark As Cancelled
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      set('Status_id', '');
                      set('Status_date', '');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                  >
                    Clear Status
                  </button>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ==== DISCUSSION ==== */}
          {activeTab === 'discussion' && (
            <div className="space-y-3">
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
                  {discLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : discError ? (
                    <p className="text-xs text-red-500 text-center py-6">{discError}</p>
                  ) : discussions.length === 0 ? (
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

          {/* ==== PLACEMENT ==== */}
          {activeTab === 'placement' && (
            <div className="space-y-3">
              <SectionCard
                title="Placement Details"
                icon={
                  <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>SIT Performance (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.SitPerformance}
                      onChange={(e) => set('SitPerformance', e.target.value)}
                      className={inputCls}
                      placeholder="e.g. 85.50"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Placement Remark</label>
                    <textarea
                      value={form.PlacementRemark}
                      onChange={(e) => set('PlacementRemark', e.target.value)}
                      rows={3}
                      className={textareaCls}
                      placeholder="Placement status, notes…"
                    />
                  </div>
                </div>
              </SectionCard>

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

          {/* ==== DOCUMENTS ==== */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              {/* Upload panel */}
              <SectionCard
                title="Upload Document"
                icon={
                  <svg className="w-3 h-3 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                }
              >
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[180px]">
                    <label className={labelCls}>Document Label</label>
                    <input
                      type="text"
                      value={uploadDocName}
                      onChange={(e) => setUploadDocName(e.target.value)}
                      placeholder="e.g. Marksheet, Aadhar Card"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className={labelCls}>File (PDF / JPG / PNG / WebP · max 5 MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#2E3093]/10 file:text-[#2E3093] hover:file:bg-[#2E3093]/20 cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!uploadFile || uploading}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold disabled:opacity-40 hover:bg-[#252780] transition-colors"
                  >
                    {uploading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
                {uploadError && (
                  <p className="mt-2 text-xs text-red-600 font-medium">{uploadError}</p>
                )}
              </SectionCard>

              {/* Document list */}
              <SectionCard
                title={`Documents (${documents.length})`}
                icon={
                  <svg className="w-3 h-3 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                }
              >
                {docsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : docsError ? (
                  <p className="text-xs text-red-500 text-center py-8">{docsError}</p>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <svg className="w-10 h-10 text-slate-200 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-slate-500 font-semibold">No documents uploaded yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Use the Upload panel above to add documents.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {documents.map((doc) => {
                      const fileUrl = buildStudentDocumentUrl(studentId, doc.upload_image);
                      const ext = doc.upload_image.split('.').pop()?.toLowerCase() ?? '';
                      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
                      const isPdf = ext === 'pdf';
                      const label = formatDocumentLabel(doc.doc_name, doc.upload_image);
                      return (
                        <a
                          key={doc.id}
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-200 bg-white hover:border-[#2E3093]/40 hover:bg-[#2E3093]/5 transition-all"
                        >
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={fileUrl}
                              alt={label}
                              loading="lazy"
                              className="w-full h-16 object-cover rounded-md border border-slate-100"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-16 rounded-md bg-slate-100 flex items-center justify-center">
                              {isPdf ? (
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>
                          )}
                          <span className="text-[11px] font-semibold text-slate-600 group-hover:text-[#2E3093] text-center leading-tight line-clamp-2">
                            {label}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">{ext}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ── Action buttons (shown on all tabs except discussion / placement / documents) ── */}
          {activeTab !== 'discussion' && activeTab !== 'placement' && activeTab !== 'documents' && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/student')}
                className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
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
