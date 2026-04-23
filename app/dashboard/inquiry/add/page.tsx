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

function fmtDate(value?: string | Date | null): string {
  if (!value) return '—';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '—';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(value.getUTCDate()).padStart(2,'0')} ${months[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
  }
  const raw = String(value).trim();
  if (!raw || raw === '0000-00-00') return '—';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${iso[3]} ${months[parseInt(iso[2],10)-1]} ${iso[1]}`;
  }
  const leg = raw.match(/^(\d{2})[-\/.](\d{2})[-\/.](\d{4})/);
  if (leg) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${leg[1]} ${months[parseInt(leg[2],10)-1]} ${leg[3]}`;
  }
  return '—';
}

const ctrl = 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';
const lbl  = 'block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5';

export default function AddInquiryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId') ? parseInt(searchParams.get('editId')!) : null;
  const { canCreate, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');

  const [activeTab, setActiveTab] = useState<'personal' | 'discussion'>('personal');
  const [opts, setOpts] = useState<FormOptions | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [nationality, setNationality] = useState('');
  const [country, setCountry] = useState('');
  const [notes, setNotes] = useState('');
  const [statusId, setStatusId] = useState<number>(1);
  const [inquiryDate, setInquiryDate] = useState(today());
  const [inquiryMode, setInquiryMode] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [courseId, setCourseId] = useState('');
  const [category, setCategory] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [qualification, setQualification] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [percentage, setPercentage] = useState('');

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [newDiscussion, setNewDiscussion] = useState('');
  const [newNextDate, setNewNextDate] = useState(today());
  const [discLoading, setDiscLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showMailModal, setShowMailModal] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [mailSubject, setMailSubject] = useState('Your SIT Admission Form Link');
  const [mailBody, setMailBody] = useState('');

  const admissionFormUrl = editId
    ? (typeof window !== 'undefined' ? `${window.location.origin}/admission/${editId}` : `/admission/${editId}`)
    : '';

  useEffect(() => {
    fetch('/api/inquiry/options').then(r => r.json()).then(setOpts).catch(console.error);
  }, []);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/inquiry?id=${editId}`).then(r => r.json()).then(data => {
      const d = data.inquiry;
      if (!d) return;
      setName(d.Student_Name || '');
      setGender(d.Sex || '');
      setDob(d.DOB ? String(d.DOB).slice(0,10) : '');
      setMobile(d.Present_Mobile || '');
      setWhatsapp(d.Present_Mobile2 || '');
      setEmail(d.Email || '');
      setNationality(d.Nationality || '');
      setCountry(d.Present_Country || '');
      setNotes(d.Discussion || '');
      setStatusId(d.Status_id ?? 1);
      setInquiryDate(d.Inquiry_Dt ? String(d.Inquiry_Dt).slice(0,10) : today());
      setInquiryMode(d.Inquiry_From || '');
      setInquiryType(d.Inquiry_Type || '');
      setCourseId(d.Course_Id ? String(d.Course_Id) : '');
      setCategory(d.Batch_Category_id || '');
      setBatchCode(d.Batch_Code || '');
      setQualification(d.Qualification || '');
      setDiscipline(d.Discipline || '');
      setPercentage(d.Percentage != null ? String(d.Percentage) : '');
    }).catch(console.error);
  }, [editId]);

  useEffect(() => {
    if (!courseId && !category) { setBatches([]); return; }
    const p = new URLSearchParams();
    if (courseId) p.set('courseId', courseId);
    if (category) p.set('category', category);
    fetch(`/api/inquiry/batches?${p}`).then(r => r.json()).then(d => setBatches(d.batches ?? [])).catch(console.error);
  }, [courseId, category]);

  const fetchDiscussions = useCallback(async () => {
    if (!editId) return;
    setDiscLoading(true);
    try {
      const res = await fetch(`/api/inquiry/discussions?inquiryId=${editId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setDiscussions(data.discussions ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load discussions');
    }
    setDiscLoading(false);
  }, [editId]);

  useEffect(() => { if (editId) fetchDiscussions(); }, [editId, fetchDiscussions]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/inquiry', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editId ? { Student_Id: editId } : {}),
          Student_Name: name, Sex: gender || null, DOB: dob || null,
          Present_Mobile: mobile || null, Present_Mobile2: whatsapp || null,
          Email: email || null, Nationality: nationality || null, Present_Country: country || null,
          Discussion: notes || null, Status_id: statusId,
          Inquiry_Dt: inquiryDate || today(), Inquiry_From: inquiryMode || null,
          Inquiry_Type: inquiryType || null, Course_Id: courseId ? parseInt(courseId) : null,
          Batch_Category_id: category || null, Batch_Code: batchCode || null,
          Qualification: qualification || null, Discipline: discipline || null,
          Percentage: percentage ? parseFloat(percentage) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      router.push('/dashboard/inquiry');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleAddDiscussion = async () => {
    if (!newDiscussion.trim() || !newNextDate || !editId) return;
    setDiscLoading(true);
    try {
      const res = await fetch('/api/inquiry/discussions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, discussion: newDiscussion, nextFollowUpDate: newNextDate }),
      });
      if (!res.ok) throw new Error('Failed');
      setNewDiscussion(''); setNewNextDate(today()); fetchDiscussions();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    setDiscLoading(false);
  };

  const openMailModal = () => {
    if (!editId) { alert('Save the inquiry first.'); return; }
    if (!email.trim()) { alert('No email found. Add email and save first.'); return; }
    setMailSubject('Your SIT Admission Form Link');
    setMailBody([`Dear ${name.trim() || 'Student'},`,'','Thank you for your interest in SIT.','Please complete your admission form using the link below:',admissionFormUrl,'','Regards,','SIT Admissions Team'].join('\n'));
    setShowMailModal(true);
  };

  const sendMail = async () => {
    if (!editId) return;
    setSendingMail(true);
    try {
      const prev = await fetch('/api/inquiry/send-admission-form', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, toEmail: email.trim(), studentName: name, previewOnly: true }),
      });
      const pd = await prev.json();
      if (!prev.ok) throw new Error(pd?.error || 'Failed');
      if (!window.confirm([`To: ${email.trim()}`,`Subject: ${mailSubject}`,`Link: ${admissionFormUrl}`,'','Click OK to send.'].join('\n'))) return;
      const res = await fetch('/api/inquiry/send-admission-form', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, toEmail: email.trim(), studentName: name, subject: mailSubject, body: mailBody }),
      });
      const sd = await res.json();
      if (!res.ok) throw new Error(sd?.error || 'Failed');
      alert('Email sent'); setShowMailModal(false);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setSendingMail(false); }
  };

  if (permLoading) return <PermissionLoading />;
  if (editId && !canUpdate) return <AccessDenied message="You do not have permission to edit inquiries." />;
  if (!editId && !canCreate) return <AccessDenied message="You do not have permission to create inquiries." />;

  return (
    <div className="flex flex-col gap-1.5">

      {/* Header — title left, actions right */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-2 flex items-center gap-3 relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <button onClick={() => router.push('/dashboard/inquiry')} className="relative z-10 p-1 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="relative z-10 flex-1 min-w-0">
          <span className="text-sm font-black text-white tracking-tight">{editId ? 'Edit Inquiry' : 'Add Inquiry'}</span>
          <span className="ml-2 text-[10px] text-white/40">Inquiry › {editId ? 'Edit' : 'Add'}</span>
        </div>
        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          {error && <span className="text-[10px] text-red-300 font-semibold max-w-[160px] truncate">{error}</span>}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 bg-white text-[#2E3093] px-3 py-1 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-60">
            {saving
              ? <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
              : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            {editId ? 'Update' : 'Save'}
          </button>
          {editId && (
            <button onClick={openMailModal}
              className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Mail
            </button>
          )}
          <button onClick={() => router.push('/dashboard/inquiry')}
            className="px-3 py-1 text-xs font-semibold text-white/70 hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl">
        {(['personal', 'discussion'] as const).map(tab => (
          <button key={tab}
            onClick={() => { if (tab === 'discussion' && !editId) return; setActiveTab(tab); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
              activeTab === tab ? 'border-[#2E3093] text-[#2E3093]' : 'border-transparent text-slate-400 hover:text-slate-600'
            } ${tab === 'discussion' && !editId ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {tab === 'personal' ? 'Personal Details' : 'Discussion'}
            {tab === 'discussion' && discussions.length > 0 && (
              <span className="bg-[#2E3093] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{discussions.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Personal Tab ===== */}
      {activeTab === 'personal' && (
        <div className="bg-white rounded-b-xl border border-slate-200 border-t-0 px-4 py-3">
          <div className="grid grid-cols-4 gap-x-3 gap-y-2">

            {/* Personal */}
            <div className="col-span-2">
              <label className={lbl}>Name <span className="text-red-400 normal-case">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={ctrl} />
            </div>
            <div>
              <label className={lbl}>Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.genders.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Date of Birth</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={ctrl} />
            </div>

            <div>
              <label className={lbl}>Mobile</label>
              <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile" className={ctrl} />
            </div>
            <div>
              <label className={lbl}>WhatsApp</label>
              <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp" className={ctrl} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={ctrl} />
            </div>

            <div>
              <label className={lbl}>Nationality</label>
              <input list="nat-list" value={nationality} onChange={e => setNationality(e.target.value)} placeholder="Type or select" className={ctrl} />
              <datalist id="nat-list">{opts?.nationalities.map(n => <option key={n} value={n} />)}</datalist>
            </div>
            <div>
              <label className={lbl}>Country</label>
              <input list="country-list" value={country} onChange={e => setCountry(e.target.value)} placeholder="Type or select" className={ctrl} />
              <datalist id="country-list">{opts?.countries.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" rows={1} className={`${ctrl} resize-none`} />
            </div>

            {/* Inquiry Details */}
            <div className="col-span-4 border-t border-slate-100 mt-0.5" />
            <div>
              <label className={lbl}>Inquiry Date</label>
              <input type="date" value={inquiryDate} onChange={e => setInquiryDate(e.target.value)} className={ctrl} />
            </div>
            <div>
              <label className={lbl}>Mode</label>
              <select value={inquiryMode} onChange={e => setInquiryMode(e.target.value)} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.inquiryModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>How They Know About SIT</label>
              <select value={inquiryType} onChange={e => setInquiryType(e.target.value)} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.inquiryTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Training */}
            <div className="col-span-4 border-t border-slate-100 mt-0.5" />
            <div className="col-span-2">
              <label className={lbl}>Course</label>
              <select value={courseId} onChange={e => { setCourseId(e.target.value); setBatchCode(''); }} className={ctrl}>
                <option value="">— Select Course —</option>
                {opts?.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Category</label>
              <select value={category} onChange={e => { setCategory(e.target.value); setBatchCode(''); }} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Batch</label>
              <select value={batchCode} onChange={e => setBatchCode(e.target.value)} className={ctrl}>
                <option value="">— Select Batch —</option>
                {batches.map(b => (
                  <option key={b.Batch_Id} value={b.Batch_code}>
                    {toBatchNumber(b.Batch_code)} — {b.Category} ({b.SDate ? new Date(b.SDate).toLocaleDateString() : '—'})
                  </option>
                ))}
              </select>
            </div>

            {/* Education + Status on same row */}
            <div className="col-span-4 border-t border-slate-100 mt-0.5" />
            <div>
              <label className={lbl}>Qualification</label>
              <input list="qual-list" value={qualification} onChange={e => setQualification(e.target.value)} placeholder="Type or select" className={ctrl} />
              <datalist id="qual-list">{opts?.qualifications.map(q => <option key={q} value={q} />)}</datalist>
            </div>
            <div>
              <label className={lbl}>Discipline</label>
              <input list="disc-list" value={discipline} onChange={e => setDiscipline(e.target.value)} placeholder="Type or select" className={ctrl} />
              <datalist id="disc-list">{opts?.disciplines.map(d => <option key={d} value={d} />)}</datalist>
            </div>
            <div>
              <label className={lbl}>Percentage</label>
              <input type="number" step="0.01" min="0" max="100" value={percentage} onChange={e => setPercentage(e.target.value)} placeholder="e.g. 85.50" className={ctrl} />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select value={statusId} onChange={e => setStatusId(parseInt(e.target.value))} className={ctrl}>
                {opts?.statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ===== Discussion Tab ===== */}
      {activeTab === 'discussion' && (
        <div className="flex flex-col gap-1.5">
          {!editId ? (
            <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center py-10 text-center px-6">
              <p className="text-xs font-bold text-slate-500">Save the inquiry first to add discussions.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="grid grid-cols-4 gap-x-3 gap-y-2">
                  <div>
                    <label className={lbl}>Next Follow-Up Date</label>
                    <input type="date" value={newNextDate} onChange={e => setNewNextDate(e.target.value)} className={ctrl} />
                  </div>
                  <div className="col-span-3">
                    <label className={lbl}>Discussion Notes</label>
                    <textarea value={newDiscussion} onChange={e => setNewDiscussion(e.target.value)} placeholder="Discussion notes…" rows={1} className={`${ctrl} resize-none`} />
                  </div>
                </div>
                <button onClick={handleAddDiscussion} disabled={discLoading || !newDiscussion.trim() || !newNextDate}
                  className="mt-2 flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                  {discLoading
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
                  Add
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">History</span>
                  <span className="text-[10px] text-slate-400">{discussions.length}</span>
                </div>
                {discussions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No discussions yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {discussions.map((d, i) => (
                      <div key={d.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1.5">
                          <div className="w-2 h-2 rounded-full bg-[#2E3093] shrink-0" />
                          {i < discussions.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 mb-1">
                          <p className="text-xs text-slate-800">{d.discussion}</p>
                          <div className="flex gap-4 mt-1">
                            <span className="text-[10px] text-slate-400">Date: <span className="text-slate-600 font-medium">{fmtDate(d.date)}</span></span>
                            <span className="text-[10px] text-slate-400">Follow-up: <span className="text-[#2E3093] font-medium">{fmtDate(d.nextdate)}</span></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Mail Modal */}
      {showMailModal && editId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Admission Form Mail</h3>
              <button onClick={() => setShowMailModal(false)} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>To</label>
                  <input value={email.trim()} readOnly className={`${ctrl} opacity-60`} />
                </div>
                <div>
                  <label className={lbl}>Admission Form Link</label>
                  <input value={admissionFormUrl} readOnly className={`${ctrl} opacity-60`} />
                </div>
              </div>
              <div>
                <label className={lbl}>Subject</label>
                <input value={mailSubject} onChange={e => setMailSubject(e.target.value)} className={ctrl} />
              </div>
              <div>
                <label className={lbl}>Body</label>
                <textarea value={mailBody} onChange={e => setMailBody(e.target.value)} rows={8} className={`${ctrl} resize-none`} />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 flex-wrap">
              <button onClick={async () => { await navigator.clipboard.writeText(admissionFormUrl); alert('Link copied'); }}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-colors">Copy Link</button>
              <button onClick={async () => { await navigator.clipboard.writeText(mailBody); alert('Body copied'); }}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-colors">Copy Body</button>
              <button onClick={() => window.open(`/admission/${editId}`, '_blank', 'noopener,noreferrer')}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">Open Form</button>
              <button onClick={sendMail} disabled={sendingMail}
                className="px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors disabled:opacity-60">
                {sendingMail ? 'Sending…' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
