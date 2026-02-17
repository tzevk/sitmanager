'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
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
  discussion: string;
  created_by: number;
  created_date: string;
}

const today = () => new Date().toISOString().slice(0, 10);

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

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function AddInquiryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId') ? parseInt(searchParams.get('editId')!) : null;

  /* tab state */
  const [activeTab, setActiveTab] = useState<'personal' | 'discussion'>('personal');

  /* options */
  const [opts, setOpts] = useState<FormOptions | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);

  /* form fields — personal */
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
  const [discussionLoading, setDiscussionLoading] = useState(false);

  /* ui state */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* ---- load options on mount ---- */
  useEffect(() => {
    fetch('/api/inquiry/options')
      .then((r) => r.json())
      .then(setOpts)
      .catch(console.error);
  }, []);

  /* ---- load existing inquiry for edit mode ---- */
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

  /* ---- load batches when course/category change ---- */
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

  /* ---- load discussions for edit mode ---- */
  const fetchDiscussions = useCallback(async () => {
    if (!editId) return;
    setDiscussionLoading(true);
    try {
      const res = await fetch(`/api/inquiry/discussions?inquiryId=${editId}`);
      const data = await res.json();
      setDiscussions(data.discussions ?? []);
    } catch { /* ignore */ }
    setDiscussionLoading(false);
  }, [editId]);

  useEffect(() => {
    if (editId) fetchDiscussions();
  }, [editId, fetchDiscussions]);

  /* ---- save inquiry ---- */
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

  /* ---- add discussion ---- */
  const handleAddDiscussion = async () => {
    if (!newDiscussion.trim() || !editId) return;
    setDiscussionLoading(true);
    try {
      const res = await fetch('/api/inquiry/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, discussion: newDiscussion }),
      });
      if (!res.ok) throw new Error('Failed');
      setNewDiscussion('');
      fetchDiscussions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add discussion');
    }
    setDiscussionLoading(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/inquiry')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">
              {editId ? 'Edit Inquiry' : 'Add New Inquiry'}
            </h2>
            <p className="text-xs text-white/70">Admission Activity &gt; Inquiry &gt; {editId ? 'Edit' : 'Add'}</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 bg-gray-50/80">
          <button
            onClick={() => setActiveTab('personal')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'personal'
                ? 'border-[#2E3093] text-[#2E3093] bg-white -mb-px rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Personal Details
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'discussion'
                ? 'border-[#2E3093] text-[#2E3093] bg-white -mb-px rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Add Discussion
          </button>
        </div>

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

          {/* ============ TAB 1 — Personal Details ============ */}
          {activeTab === 'personal' && (
            <div className="space-y-3">

              {/* Section: Personal Details */}
              <SectionCard
                title="Personal Details"
                icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  {/* Name */}
                  <div>
                    <label className={labelCls}>
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className={inputCls}
                    />
                  </div>
                  {/* Gender */}
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      {opts?.genders.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  {/* DOB */}
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
                  </div>
                  {/* Mobile */}
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
                  {/* WhatsApp */}
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
                  {/* Email */}
                  <div>
                    <label className={labelCls}>
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className={inputCls}
                    />
                  </div>
                  {/* Nationality */}
                  <div>
                    <label className={labelCls}>
                      Nationality <span className="text-red-400">*</span>
                    </label>
                    <input
                      list="nat-list"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      placeholder="Type or select"
                      className={inputCls}
                    />
                    <datalist id="nat-list">
                      {opts?.nationalities.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                  {/* Country */}
                  <div>
                    <label className={labelCls}>
                      Country <span className="text-red-400">*</span>
                    </label>
                    <input
                      list="country-list"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Type or select"
                      className={inputCls}
                    />
                    <datalist id="country-list">
                      {opts?.countries.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  {/* Discussion */}
                  <div className="col-span-2 md:col-span-3 lg:col-span-4">
                    <label className={labelCls}>Discussion</label>
                    <textarea
                      value={discussion}
                      onChange={(e) => setDiscussion(e.target.value)}
                      placeholder="Any notes about this inquiry..."
                      rows={2}
                      className={textareaCls}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Section: Inquiry Details */}
              <SectionCard
                title="Inquiry Details"
                icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  {/* Inquiry Date */}
                  <div>
                    <label className={labelCls}>Inquiry Date</label>
                    <input
                      type="date"
                      value={inquiryDate}
                      onChange={(e) => setInquiryDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {/* Mode of Inquiry */}
                  <div>
                    <label className={labelCls}>Mode of Inquiry</label>
                    <select value={inquiryMode} onChange={(e) => setInquiryMode(e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      {opts?.inquiryModes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  {/* How they know */}
                  <div>
                    <label className={labelCls}>How they know about SIT</label>
                    <select value={inquiryType} onChange={(e) => setInquiryType(e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      {opts?.inquiryTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </SectionCard>

              {/* Section: Training Programme & Batch Details */}
              <SectionCard
                title="Training Programme & Batch Details"
                icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  {/* Course */}
                  <div>
                    <label className={labelCls}>Selected Training Programme</label>
                    <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setBatchCode(''); }} className={selectCls}>
                      <option value="">— Select Course —</option>
                      {opts?.courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Category */}
                  <div>
                    <label className={labelCls}>Category</label>
                    <select value={category} onChange={(e) => { setCategory(e.target.value); setBatchCode(''); }} className={selectCls}>
                      <option value="">— Select Category —</option>
                      {opts?.categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {/* Batch */}
                  <div>
                    <label className={labelCls}>Batch</label>
                    <select value={batchCode} onChange={(e) => setBatchCode(e.target.value)} className={selectCls}>
                      <option value="">— Select Batch —</option>
                      {batches.map((b) => (
                        <option key={b.Batch_Id} value={b.Batch_code}>
                          {b.Batch_code} — {b.Category} ({b.SDate ? new Date(b.SDate).toLocaleDateString() : '—'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </SectionCard>

              {/* Section: Education Qualification & Work */}
              <SectionCard
                title="Education Qualification & Work"
                icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
                  {/* Qualification */}
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
                      {opts?.qualifications.map((q) => (
                        <option key={q} value={q} />
                      ))}
                    </datalist>
                  </div>
                  {/* Discipline */}
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
                      {opts?.disciplines.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </div>
                  {/* Percentage */}
                  <div>
                    <label className={labelCls}>
                      Percentage <span className="text-red-400">*</span>
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

              {/* Section: Status Details */}
              <SectionCard
                title="Status Details"
                icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2 items-end">
                  {/* Date */}
                  <div>
                    <label className={labelCls}>Date</label>
                    <input
                      type="date"
                      value={statusDate}
                      onChange={(e) => setStatusDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {/* Set Status */}
                  <div>
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
                {/* Action buttons — grouped */}
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
                    {editId ? 'Update Inquiry' : 'Save Inquiry'}
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 bg-[#2A6BB5] hover:bg-[#2360A0] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md hover:shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Admission Form
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/inquiry')}
                    className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-all shadow-sm"
                  >
                    Cancel
                  </button>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ============ TAB 2 — Add Discussion ============ */}
          {activeTab === 'discussion' && (
            <div className="space-y-3">
              {!editId ? (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-[#2E3093]/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[#2E3093]/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">Save the inquiry first to add discussions.</p>
                  <p className="text-xs text-gray-400 mt-1">Discussions can be added after creating the inquiry record.</p>
                </div>
              ) : (
                <>
                  {/* Add new discussion */}
                  <SectionCard
                    title="New Discussion"
                    icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
                  >
                    <textarea
                      value={newDiscussion}
                      onChange={(e) => setNewDiscussion(e.target.value)}
                      placeholder="Type your discussion notes..."
                      rows={3}
                      className={textareaCls}
                    />
                    <button
                      onClick={handleAddDiscussion}
                      disabled={discussionLoading || !newDiscussion.trim()}
                      className="mt-3 flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      {discussionLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      Add Discussion
                    </button>
                  </SectionCard>

                  {/* Discussion history */}
                  <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
                      <h4 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                        Discussion History
                        <span className="ml-auto text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{discussions.length}</span>
                      </h4>
                    </div>
                    <div className="px-3 py-2">
                      {discussions.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No discussions yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {discussions.map((d, i) => (
                            <div
                              key={d.id}
                              className="flex gap-3"
                            >
                              <div className="flex flex-col items-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#2E3093] mt-1.5 shrink-0" />
                                {i < discussions.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                              </div>
                              <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <p className="text-sm text-gray-800">{d.discussion}</p>
                                <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
                                  {d.date
                                    ? new Date(d.date).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                    : '—'}
                                </p>
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
        </div>

      </div>
    </div>
  );
}
