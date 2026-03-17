/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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

interface InquiryFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editId?: number | null;          // Student_Id for edit mode
}

const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function InquiryForm({ open, onClose, onSaved, editId }: InquiryFormProps) {
  const router = useRouter();
  
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
    if (!open) return;
    fetch('/api/inquiry/options')
      .then((r) => r.json())
      .then(setOpts)
      .catch(console.error);
  }, [open]);

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
    if (open && editId) fetchDiscussions();
  }, [open, editId, fetchDiscussions]);

  /* ---- reset form on close ---- */
  useEffect(() => {
    if (!open) {
      setActiveTab('personal');
      setName(''); setGender(''); setDob(''); setMobile(''); setWhatsapp('');
      setEmail(''); setNationality(''); setCountry(''); setDiscussion('');
      setStatusDate(today()); setStatusId(1);
      setInquiryDate(today()); setInquiryMode(''); setInquiryType('');
      setCourseId(''); setCategory(''); setBatchCode('');
      setQualification(''); setDiscipline(''); setPercentage('');
      setDiscussions([]); setNewDiscussion('');
      setError('');
    }
  }, [open]);

  /* ---- save inquiry ---- */
  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    }
    setDiscussionLoading(false);
  };

  if (!open) return null;

  /* ---- shared label/input classes ---- */
  const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
  const inputCls =
    'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300';
  const selectCls =
    'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-600';

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8">
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {editId ? 'Edit Inquiry' : 'Add New Inquiry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'personal'
                ? 'border-[#2E3093] text-[#2E3093]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Personal Details
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'discussion'
                ? 'border-[#2E3093] text-[#2E3093]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Add Discussion
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 max-h-[calc(100vh-260px)] overflow-y-auto">

          {/* ============ TAB 1 — Personal Details ============ */}
          {activeTab === 'personal' && (
            <div className="space-y-6">

              {/* Section: Personal Details */}
              <section>
                <h3 className="text-sm font-bold text-[#2E3093] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="lg:col-span-3">
                    <label className={labelCls}>Discussion</label>
                    <textarea
                      value={discussion}
                      onChange={(e) => setDiscussion(e.target.value)}
                      placeholder="Any notes about this inquiry..."
                      rows={3}
                      className={inputCls + ' resize-none'}
                    />
                  </div>
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* Section: Status Details */}
              <section>
                <h3 className="text-sm font-bold text-[#2E3093] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Status Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5 items-end">
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
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editId) {
                          window.open(`/admission/${editId}`, '_blank');
                        } else {
                          alert('Please save the inquiry first before sending admission form');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#2A6BB5] hover:bg-[#2360A0] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Admission Form
                    </button>
                  </div>
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* Section: Inquiry Details */}
              <section>
                <h3 className="text-sm font-bold text-[#2E3093] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Inquiry Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
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
              </section>

              <hr className="border-gray-100" />

              {/* Section: Training Programme & Batch Details */}
              <section>
                <h3 className="text-sm font-bold text-[#2E3093] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Training Programme & Batch Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
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
              </section>

              <hr className="border-gray-100" />

              {/* Section: Education Qualification & Work */}
              <section>
                <h3 className="text-sm font-bold text-[#2E3093] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                  </svg>
                  Education Qualification & Work
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1.5">
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
              </section>
            </div>
          )}

          {/* ============ TAB 2 — Add Discussion ============ */}
          {activeTab === 'discussion' && (
            <div className="space-y-5">
              {!editId ? (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm font-medium">Save the inquiry first to add discussions.</p>
                </div>
              ) : (
                <>
                  {/* Add new discussion */}
                  <div>
                    <label className={labelCls}>New Discussion</label>
                    <textarea
                      value={newDiscussion}
                      onChange={(e) => setNewDiscussion(e.target.value)}
                      placeholder="Type your discussion notes..."
                      rows={4}
                      className={inputCls + ' resize-none'}
                    />
                    <button
                      onClick={handleAddDiscussion}
                      disabled={discussionLoading || !newDiscussion.trim()}
                      className="mt-2 flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
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
                  </div>

                  {/* Discussion history */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Discussion History ({discussions.length})
                    </h4>
                    {discussions.length === 0 ? (
                      <p className="text-sm text-gray-300 text-center py-6">No discussions yet.</p>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {discussions.map((d) => (
                          <div
                            key={d.id}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                          >
                            <p className="text-sm text-gray-700">{d.discussion}</p>
                            <p className="text-[11px] text-gray-400 mt-1.5">
                              {d.date
                                ? new Date(d.date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#2E3093] hover:bg-[#252780] rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {editId ? 'Update Inquiry' : 'Save Inquiry'}
          </button>
        </div>
      </div>
    </div>
  );
}
