'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { toBatchNumber } from '@/lib/batch-display';

interface FormOptions {
  courses: { id: number; name: string }[];
  categories: string[];
  qualifications: string[];
  disciplines: string[];
  nationalities: string[];
  countries: string[];
  statuses: { id: number; label: string }[];
  genders: string[];
  inquiryModes: string[];
  inquiryTypes: string[];
}

interface Batch {
  Batch_Id: number;
  Batch_code: string;
  Course_Id: number;
  Category: string;
  SDate: string;
}

interface Discussion {
  id: number;
  date: string;
  nextdate?: string | null;
  discussion: string;
  created_by: number;
  created_date: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function formatDisplayDate(value?: string | Date | null): string {
  if (!value) return '—';

  // MySQL2 sometimes returns DATE columns as JS Date objects
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '—';
    const d = value.getUTCDate(), mo = value.getUTCMonth(), y = value.getUTCFullYear();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d).padStart(2,'0')} ${months[mo]} ${y}`;
  }

  const raw = String(value).trim();
  if (!raw || raw === '0000-00-00') return '—';

  // ISO or YYYY-MM-DD — parse as UTC to avoid timezone day-shift
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${iso[3]} ${months[parseInt(iso[2], 10) - 1]} ${iso[1]}`;
  }

  // Legacy DD-MM-YYYY or DD/MM/YYYY
  const legacy = raw.match(/^(\d{2})[-\/.](\d{2})[-\/.](\d{4})/);
  if (legacy) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${legacy[1]} ${months[parseInt(legacy[2], 10) - 1]} ${legacy[3]}`;
  }

  return '—';
}

/* ---- design tokens matching the listing page ---- */
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5';
const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium';
const selectCls =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] transition-all font-medium';
const textareaCls =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 focus:border-[#2E3093] placeholder:text-slate-400 transition-all font-medium resize-none';

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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#2E3093]/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export default function AddInquiryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId') ? parseInt(searchParams.get('editId')!) : null;

  const { canCreate, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');

  const [activeTab, setActiveTab] = useState<'personal' | 'discussion'>('personal');

  const [opts, setOpts] = useState<FormOptions | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);

  /* personal fields */
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [country, setCountry] = useState('');
  const [discussion, setDiscussion] = useState('');

  /* status */
  const [statusDate, setStatusDate] = useState(today());
  const [statusId, setStatusId] = useState<number>(1);

  /* inquiry details */
  const [inquiryDate, setInquiryDate] = useState(today());
  const [inquiryMode, setInquiryMode] = useState('');
  const [inquiryType, setInquiryType] = useState('');

  /* training programme */
  const [courseId, setCourseId] = useState('');
  const [category, setCategory] = useState('');
  const [batchCode, setBatchCode] = useState('');

  /* education */
  const [qualification, setQualification] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [percentage, setPercentage] = useState('');

  /* discussion tab */
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [newDiscussion, setNewDiscussion] = useState('');
  const [newNextFollowUpDate, setNewNextFollowUpDate] = useState(today());
  const [discussionLoading, setDiscussionLoading] = useState(false);

  /* ui */
  const [saving, setSaving] = useState(false);
  const [showAdmissionMailModal, setShowAdmissionMailModal] = useState(false);
  const [sendingAdmissionMail, setSendingAdmissionMail] = useState(false);
  const [mailSubject, setMailSubject] = useState('Your SIT Admission Form Link');
  const [mailBody, setMailBody] = useState('');
  const [error, setError] = useState('');
  const admissionFormUrl = editId
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/admission/${editId}`
      : `/admission/${editId}`
    : '';

  useEffect(() => {
    fetch('/api/inquiry/options')
      .then((r) => r.json())
      .then(setOpts)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/inquiry?id=${editId}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data.inquiry;
        if (!d) return;
        setName(d.Student_Name || '');
        setGender(d.Sex || '');
        setDob(d.DOB ? String(d.DOB).slice(0, 10) : '');
        setMobile(d.Present_Mobile || '');
        setWhatsapp(d.Present_Mobile2 || '');
        setEmail(d.Email || '');
        setNationality(d.Nationality || '');
        setCountry(d.Present_Country || '');
        setDiscussion(d.Discussion || '');
        setStatusId(d.Status_id ?? 1);
        setInquiryDate(d.Inquiry_Dt ? String(d.Inquiry_Dt).slice(0, 10) : today());
        setInquiryMode(d.Inquiry_From || '');
        setInquiryType(d.Inquiry_Type || '');
        setCourseId(d.Course_Id ? String(d.Course_Id) : '');
        setCategory(d.Batch_Category_id || '');
        setBatchCode(d.Batch_Code || '');
        setQualification(d.Qualification || '');
        setDiscipline(d.Discipline || '');
        setPercentage(d.Percentage != null ? String(d.Percentage) : '');
      })
      .catch(console.error);
  }, [editId]);

  useEffect(() => {
    if (!courseId && !category) { setBatches([]); return; }
    const params = new URLSearchParams();
    if (courseId) params.set('courseId', courseId);
    if (category) params.set('category', category);
    fetch(`/api/inquiry/batches?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setBatches(d.batches ?? []))
      .catch(console.error);
  }, [courseId, category]);

  const fetchDiscussions = useCallback(async () => {
    if (!editId) return;
    setDiscussionLoading(true);
    try {
      const res = await fetch(`/api/inquiry/discussions?inquiryId=${editId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load discussions');
      setDiscussions(data.discussions ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load discussions');
      setDiscussions([]);
    }
    setDiscussionLoading(false);
  }, [editId]);

  useEffect(() => {
    if (editId) fetchDiscussions();
  }, [editId, fetchDiscussions]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...(editId ? { Student_Id: editId } : {}),
        Student_Name: name,
        Sex: gender || null,
        DOB: dob || null,
        Present_Mobile: mobile || null,
        Present_Mobile2: whatsapp || null,
        Email: email || null,
        Nationality: nationality || null,
        Present_Country: country || null,
        Discussion: discussion || null,
        Status_id: statusId,
        Inquiry_Dt: inquiryDate || today(),
        Inquiry_From: inquiryMode || null,
        Inquiry_Type: inquiryType || null,
        Course_Id: courseId ? parseInt(courseId) : null,
        Batch_Category_id: category || null,
        Batch_Code: batchCode || null,
        Qualification: qualification || null,
        Discipline: discipline || null,
        Percentage: percentage ? parseFloat(percentage) : null,
      };

      const res = await fetch('/api/inquiry', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      router.push('/dashboard/inquiry');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDiscussion = async () => {
    if (!newDiscussion.trim() || !newNextFollowUpDate || !editId) return;
    setDiscussionLoading(true);
    try {
      const res = await fetch('/api/inquiry/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: editId,
          discussion: newDiscussion,
          nextFollowUpDate: newNextFollowUpDate,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setNewDiscussion('');
      setNewNextFollowUpDate(today());
      fetchDiscussions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add discussion');
    }
    setDiscussionLoading(false);
  };

  const handleSendAdmissionForm = async () => {
    if (!editId) {
      alert('Please save the inquiry first before preparing admission form mail body');
      return;
    }
    if (!email.trim()) {
      alert('No email address found for this inquiry. Please add email and save first.');
      return;
    }
    const studentName = name.trim() || 'Student';
    setMailSubject('Your SIT Admission Form Link');
    setMailBody(
      [
        `Dear ${studentName},`,
        '',
        'Thank you for your interest in SIT.',
        'Please complete your admission form using the link below:',
        admissionFormUrl,
        '',
        'Regards,',
        'SIT Admissions Team',
      ].join('\n')
    );
    setShowAdmissionMailModal(true);
  };

  const handleConfirmSendAdmissionMail = async () => {
    if (!editId) return;
    const recipient = email.trim();
    if (!recipient) {
      alert('No email address found for this inquiry. Please add email and save first.');
      return;
    }
    setSendingAdmissionMail(true);
    try {
      const previewRes = await fetch('/api/inquiry/send-admission-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, toEmail: recipient, studentName: name, previewOnly: true }),
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData?.error || 'Failed to load mail preview');

      const approved = window.confirm(
        [
          'Please verify before sending:',
          '',
          `To: ${recipient}`,
          `Subject: ${mailSubject || previewData.preview?.subject || 'Your SIT Admission Form Link'}`,
          `Admission Form Link: ${admissionFormUrl}`,
          '',
          'Click OK to send this email now.',
        ].join('\n'),
      );
      if (!approved) return;

      const sendRes = await fetch('/api/inquiry/send-admission-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, toEmail: recipient, studentName: name, subject: mailSubject, body: mailBody }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData?.error || 'Failed to send admission form email');

      alert('Admission form email sent successfully');
      setShowAdmissionMailModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send admission form email');
    } finally {
      setSendingAdmissionMail(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (editId && !canUpdate) return <AccessDenied message="You do not have permission to edit inquiries." />;
  if (!editId && !canCreate) return <AccessDenied message="You do not have permission to create inquiries." />;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-2xl px-8 py-6 shadow-[0_10px_30px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="flex items-center gap-4 relative z-10">
          <button
            onClick={() => router.push('/dashboard/inquiry')}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {editId ? 'Edit Inquiry' : 'Add New Inquiry'}
            </h2>
            <p className="text-[14px] text-white/80 font-medium mt-1">
              Admission Activity › Inquiry › {editId ? 'Edit' : 'Add'}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium flex items-center gap-2.5">
          <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'personal'
              ? 'border-[#2E3093] text-[#2E3093]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Personal Details
        </button>
        <button
          onClick={() => { if (editId) setActiveTab('discussion'); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'discussion'
              ? 'border-[#2E3093] text-[#2E3093]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          } ${!editId ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Discussion
          {editId && discussions.length > 0 && (
            <span className="bg-[#2E3093] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {discussions.length}
            </span>
          )}
        </button>
      </div>

      {/* ===== Personal Details Tab ===== */}
      {activeTab === 'personal' && (
        <div className="space-y-5">

          {/* Personal Details */}
          <SectionCard
            title="Personal Details"
            icon={
              <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Name <span className="text-red-400 normal-case tracking-normal">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
                  <option value="">— Select —</option>
                  {opts?.genders.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mobile</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Mobile number"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>WhatsApp Number</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp number"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Email <span className="text-red-400 normal-case tracking-normal">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nationality</label>
                <input
                  list="nat-list"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="Type or select"
                  className={inputCls}
                />
                <datalist id="nat-list">
                  {opts?.nationalities.map((n) => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input
                  list="country-list"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Type or select"
                  className={inputCls}
                />
                <datalist id="country-list">
                  {opts?.countries.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className={labelCls}>General Notes</label>
                <textarea
                  value={discussion}
                  onChange={(e) => setDiscussion(e.target.value)}
                  placeholder="Any notes about this inquiry..."
                  rows={3}
                  className={textareaCls}
                />
              </div>
            </div>
          </SectionCard>

          {/* Inquiry Details */}
          <SectionCard
            title="Inquiry Details"
            icon={
              <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-4">
              <div>
                <label className={labelCls}>Inquiry Date</label>
                <input
                  type="date"
                  value={inquiryDate}
                  onChange={(e) => setInquiryDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Mode of Inquiry</label>
                <select value={inquiryMode} onChange={(e) => setInquiryMode(e.target.value)} className={selectCls}>
                  <option value="">— Select —</option>
                  {opts?.inquiryModes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>How They Know About SIT</label>
                <select value={inquiryType} onChange={(e) => setInquiryType(e.target.value)} className={selectCls}>
                  <option value="">— Select —</option>
                  {opts?.inquiryTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </SectionCard>

          {/* Training Programme & Batch */}
          <SectionCard
            title="Training Programme & Batch"
            icon={
              <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-4">
              <div>
                <label className={labelCls}>Training Programme</label>
                <select
                  value={courseId}
                  onChange={(e) => { setCourseId(e.target.value); setBatchCode(''); }}
                  className={selectCls}
                >
                  <option value="">— Select Course —</option>
                  {opts?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setBatchCode(''); }}
                  className={selectCls}
                >
                  <option value="">— Select Category —</option>
                  {opts?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Batch</label>
                <select value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className={selectCls}>
                  <option value="">— Select Batch —</option>
                  {batches.map((b) => (
                    <option key={b.Batch_Id} value={b.Batch_code}>
                      {toBatchNumber(b.Batch_code)} — {b.Category} ({b.SDate ? new Date(b.SDate).toLocaleDateString() : '—'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>

          {/* Education & Qualification */}
          <SectionCard
            title="Education & Qualification"
            icon={
              <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-4">
              <div>
                <label className={labelCls}>Qualification</label>
                <input
                  list="qual-list"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="Type or select"
                  className={inputCls}
                />
                <datalist id="qual-list">
                  {opts?.qualifications.map((q) => <option key={q} value={q} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Discipline</label>
                <input
                  list="disc-list"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  placeholder="Type or select"
                  className={inputCls}
                />
                <datalist id="disc-list">
                  {opts?.disciplines.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>
                  Percentage <span className="text-red-400 normal-case tracking-normal">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="e.g. 85.50"
                  className={inputCls}
                />
              </div>
            </div>
          </SectionCard>

          {/* Status */}
          <SectionCard
            title="Status"
            icon={
              <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-5 gap-y-4">
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Set Status</label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(parseInt(e.target.value))}
                  className={selectCls}
                >
                  {opts?.statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>

          {/* Action bar */}
          <div className="flex items-center gap-3 flex-wrap pb-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {editId ? 'Update Inquiry' : 'Save Inquiry'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={handleSendAdmissionForm}
                className="flex items-center gap-2 bg-[#2A6BB5] hover:bg-[#2360A0] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Admission Form Mail
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard/inquiry')}
              className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-sm hover:-translate-y-0.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ===== Discussion Tab ===== */}
      {activeTab === 'discussion' && (
        <div className="space-y-5">
          {!editId ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-[#2E3093]/10 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-[#2E3093]/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-600">Save the inquiry first to add discussions.</p>
              <p className="text-xs text-slate-400 mt-1.5">Discussions can be added after creating the inquiry record.</p>
            </div>
          ) : (
            <>
              <SectionCard
                title="New Discussion"
                icon={
                  <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                <div className="space-y-4">
                  <div className="max-w-xs">
                    <label className={labelCls}>Next Follow Up Date</label>
                    <input
                      type="date"
                      value={newNextFollowUpDate}
                      onChange={(e) => setNewNextFollowUpDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Discussion Notes</label>
                    <textarea
                      value={newDiscussion}
                      onChange={(e) => setNewDiscussion(e.target.value)}
                      placeholder="Type your discussion notes..."
                      rows={4}
                      className={textareaCls}
                    />
                  </div>
                  <button
                    onClick={handleAddDiscussion}
                    disabled={discussionLoading || !newDiscussion.trim() || !newNextFollowUpDate}
                    className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {discussionLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    Add Discussion
                  </button>
                </div>
              </SectionCard>

              {/* Discussion history */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#2E3093]/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 flex-1">Discussion History</h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {discussions.length}
                  </span>
                </div>
                <div className="px-6 py-5">
                  {discussions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">No discussions recorded yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {discussions.map((d, i) => (
                        <div key={d.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#2E3093] mt-2 shrink-0" />
                            {i < discussions.length - 1 && (
                              <div className="w-px flex-1 bg-slate-200 mt-1.5" />
                            )}
                          </div>
                          <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200 mb-1">
                            <p className="text-sm text-slate-800 font-medium leading-relaxed">{d.discussion}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                Date:{' '}
                                <span className="text-slate-600 normal-case tracking-normal font-semibold">
                                  {formatDisplayDate(d.date)}
                                </span>
                              </span>
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                Follow Up:{' '}
                                <span className="text-[#2E3093] normal-case tracking-normal font-semibold">
                                  {formatDisplayDate(d.nextdate)}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Admission Mail Modal */}
      {showAdmissionMailModal && editId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Admission Form Mail</h3>
                <p className="text-[12px] text-white/75 mt-0.5">Review and send via configured mail provider.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdmissionMailModal(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>To</label>
                  <input value={email.trim()} readOnly className={inputCls + ' opacity-70'} />
                </div>
                <div>
                  <label className={labelCls}>Admission Form Link</label>
                  <input value={admissionFormUrl} readOnly className={inputCls + ' opacity-70'} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Subject</label>
                <input
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Mail Body</label>
                <textarea
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  rows={10}
                  className={textareaCls}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 flex-wrap">
              <button
                type="button"
                onClick={async () => { await navigator.clipboard.writeText(admissionFormUrl); alert('Admission form link copied'); }}
                className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-700 hover:bg-white transition-colors"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={async () => { await navigator.clipboard.writeText(mailBody); alert('Mail body copied'); }}
                className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-700 hover:bg-white transition-colors"
              >
                Copy Body
              </button>
              <button
                type="button"
                onClick={() => window.open(`/admission/${editId}`, '_blank', 'noopener,noreferrer')}
                className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
              >
                Open Form
              </button>
              <button
                type="button"
                onClick={handleConfirmSendAdmissionMail}
                disabled={sendingAdmissionMail}
                className="px-4 py-2 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-xl transition-colors disabled:opacity-60"
              >
                {sendingAdmissionMail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
