'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { toBatchNumber } from '@/lib/batch-display';
import { AppointmentDetailModal } from '@/app/dashboard/appointments/_components/shared';

const STATUS_ONLY_SAVE_LABELS = ['new', 'irrelevant', 'contacted (not interested)', 'contacted (not recieved call)'];

// First contact has been made but the conversation is early: DOB, WhatsApp, percentage and the
// training details (course, category, batch, preferred location) can be filled in later.
const FIRST_CONTACT_LABELS = ['contacted (interested)', 'contacted (next batch)', 'contacted - eligible'];

interface FormOptions {
  courses: { id: number; name: string }[];
  categories: string[];
  qualifications: string[];
  disciplines: string[];
  nationalities: string[];
  countries: string[];
  statuses: { id: number; label: string }[];
  statusMaster: { id: number; label: string }[];
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
  meeting_level?: number | null;
  level2_date?: string | null;
  level2_time?: string | null;
  level2_invitee_uri?: string | null;
  level2_account_user_id?: number | null;
  level2_account_name?: string | null;
  discussion: string;
  created_by: number;
  created_date: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const hasText = (v: unknown) => {
  const t = String(v ?? '').trim();
  return t !== '' && t.toUpperCase() !== 'NULL';
};

const NFABTU_COLORS: Record<string, string> = {
  N: 'text-violet-600', F: 'text-blue-600', A: 'text-teal-600',
  B: 'text-green-700', T: 'text-amber-700', U: 'text-red-600',
};

function renderDiscussion(text: string) {
  const lines = text.split('\n').filter(Boolean);
  const isStructured = lines.some(l => /^[NFABTU]: /.test(l));
  if (!isStructured) return <span className="text-slate-700 whitespace-pre-wrap text-[11px]">{text}</span>;
  return (
    <div className="space-y-0.5">
      {lines.map((line, idx) => {
        const m = line.match(/^([NFABTU]): (.*)/);
        if (!m) return <span key={idx} className="text-[11px] text-slate-500 block">{line}</span>;
        const [, key, val] = m;
        return (
          <div key={idx} className="flex items-baseline gap-1 text-[11px]">
            <span className={`font-black w-4 shrink-0 ${NFABTU_COLORS[key] || 'text-slate-500'}`}>{key}</span>
            <span className="text-slate-700">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

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

function fmtDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '—';
    return value.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }
  const raw = String(value).trim();
  if (!raw || raw === '0000-00-00') return '—';
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }
  return raw;
}

const ctrl = 'w-full bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] hover:border-slate-400 placeholder:text-slate-400 transition-colors';
const lbl  = 'block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5';

const contactModeChannels: Record<string, { channel: string; label: string }> = {
  Call: { channel: 'call', label: 'Call' },
  WhatsApp: { channel: 'whatsapp', label: 'WhatsApp' },
  'Walk-In': { channel: 'personal-inquiry', label: 'Walk-In' },
  Email: { channel: 'mail', label: 'Email' },
};

const contactActionButtons = Object.entries(contactModeChannels).map(([mode, item]) => ({ mode, ...item }));

function ContactActionIcon({ channel }: { channel: string }) {
  if (channel === 'call') {
    return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.28 6.72 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.37c0-.51-.34-.96-.83-1.09l-4.42-1.1a1.13 1.13 0 00-1.17.38l-.97 1.18a1.13 1.13 0 01-1.21.33 12.04 12.04 0 01-6.98-6.98 1.13 1.13 0 01.33-1.21l1.18-.97c.34-.28.49-.73.38-1.17l-1.1-4.42a1.13 1.13 0 00-1.09-.83H4.5A2.25 2.25 0 002.25 6.75z" /></svg>;
  }
  if (channel === 'whatsapp') {
    return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.6 18.3L4 19.5l1.25-4.35A8 8 0 1112 20a7.95 7.95 0 01-3.4-.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.2 8.8c.18 3.1 2.85 5.35 5.95 5.95l1.05-1.35-2.05-1.05-.85.55c-.9-.42-1.6-1.13-2.05-2.05l.55-.85L10.75 7.9 9.2 8.8z" /></svg>;
  }
  if (channel === 'personal-inquiry') {
    return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" /></svg>;
  }
  return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.9 5.25a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}

export default function AddInquiryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId') ? parseInt(searchParams.get('editId')!) : null;
  const returnToParam = searchParams.get('returnTo') || '';
  const prefillName = searchParams.get('prefillName') || '';
  const prefillEmail = searchParams.get('prefillEmail') || '';
  const prefillMobile = searchParams.get('prefillMobile') || '';
  const prefillNotes = searchParams.get('prefillNotes') || '';
  const calendlyBookingId = searchParams.get('calendlyBookingId') || '';
  const { canCreate, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');

  const goBackToList = useCallback((pinnedInquiryId?: number) => {
    // searchParams.get() already decodes the query-string value once; decoding again here
    // corrupts any encoded reserved character still inside the nested URL (e.g. an "&" in
    // a training/course name), turning it into a literal delimiter that truncates the
    // next query string when we push it.
    const decoded = returnToParam;
    // Guard against open redirects; only allow returning inside inquiry listing.
    if (decoded.startsWith('/dashboard/inquiry')) {
      const target = new URL(decoded, window.location.origin);
      if (pinnedInquiryId) target.searchParams.set('pinnedInquiryId', String(pinnedInquiryId));
      router.push(`${target.pathname}${target.search}`);
      return;
    }
    router.push(pinnedInquiryId ? `/dashboard/inquiry?pinnedInquiryId=${pinnedInquiryId}` : '/dashboard/inquiry');
  }, [router, returnToParam]);

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
  // The inquiry's own Discussion column as saved (older inquiries and the old
  // software keep their discussion here, not in the follow-up table).
  const [savedDiscussion, setSavedDiscussion] = useState('');
  const [leadTemp, setLeadTemp] = useState<'hot' | 'warm' | 'cold' | ''>('');
  const [statusId, setStatusId] = useState<number>(1);
  const [inquiryDate, setInquiryDate] = useState(today());
  const [inquirySoftwareTime, setInquirySoftwareTime] = useState('');
  const [inquiryMode, setInquiryMode] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [courseId, setCourseId] = useState('');
  const [category, setCategory] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [qualification, setQualification] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [percentage, setPercentage] = useState('');

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  // Structured NFABTU discussion fields
  const [discN, setDiscN] = useState('');
  const [discF, setDiscF] = useState('');
  const [discA, setDiscA] = useState('');
  const [discB, setDiscB] = useState('');
  const [discT, setDiscT] = useState('');
  const [discU, setDiscU] = useState('');
  const [newDiscussion, setNewDiscussion] = useState('');
  const [newNextDate, setNewNextDate] = useState(tomorrow());
  const [showSameDateModal, setShowSameDateModal] = useState(false);
  const [meetingLevel, setMeetingLevel] = useState<'1' | '2' | '3'>('1');
  const [editLevel, setEditLevel] = useState<'1' | '2' | '3'>('1');
  const [editL2Date, setEditL2Date] = useState('');
  const [editL2Account, setEditL2Account] = useState('');
  const [level2Date, setLevel2Date] = useState('');
  const [level2Account, setLevel2Account] = useState('');
  const [l2Modal, setL2Modal] = useState(false);
  const [apptDetailId, setApptDetailId] = useState<number | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [mDate, setMDate] = useState('');
  const [mLink, setMLink] = useState('');
  const [mAccount, setMAccount] = useState('');
  const [mNote, setMNote] = useState('');
  const [mBusy, setMBusy] = useState(false);
  const [mError, setMError] = useState('');
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  const [discLoading, setDiscLoading] = useState(false);
  const [editingDiscId, setEditingDiscId] = useState<number | null>(null);
  const [editingDiscText, setEditingDiscText] = useState('');

  /* discussion-area status (sourced from status_master, saved immediately) */
  const [discStatusId, setDiscStatusId] = useState<number | ''>('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateCheck, setDuplicateCheck] = useState<{
    personName: string | null;
    matches: { Inquiry_Id: number; CourseName: string | null; Inquiry_Dt: string | null; StatusLabel: string | null }[];
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [reminderAt, setReminderAt] = useState<string | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderOption, setReminderOption] = useState<'12' | '24' | '48' | 'custom'>('24');
  const [customHours, setCustomHours] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);
  const [loggingContact, setLoggingContact] = useState<string | null>(null);
  const [contactLogged, setContactLogged] = useState(false);
  const [regeneratingLink, setRegeneratingLink] = useState(false);
  const [mailSubject, setMailSubject] = useState('Your SIT Admission Form Link');
  const [mailBody, setMailBody] = useState('');
  const [regeneratedAdmissionFormUrl, setRegeneratedAdmissionFormUrl] = useState('');

  const admissionFormUrl = editId
    ? (typeof window !== 'undefined' ? `${window.location.origin}/admission/${editId}` : `/admission/${editId}`)
    : '';
  const activeAdmissionFormUrl = regeneratedAdmissionFormUrl || admissionFormUrl;

  useEffect(() => {
    fetch('/api/inquiry/options').then(r => r.json()).then(setOpts).catch(console.error);
  }, []);

  // Pre-populate form from Calendly (only for new inquiries)
  useEffect(() => {
    if (editId) return;
    if (prefillName) setName(prefillName);
    if (prefillEmail) setEmail(prefillEmail);
    if (prefillMobile) { setMobile(prefillMobile); setWhatsapp(prefillMobile); }
    if (prefillNotes) setNotes(prefillNotes);
    if (calendlyBookingId) setInquiryMode('Calendly');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editId || !opts?.statuses?.length) return;
    const newStatus = opts.statuses.find((status) => status.label.toLowerCase() === 'new');
    if (newStatus && !opts.statuses.some((status) => status.id === statusId)) {
      setStatusId(newStatus.id);
    }
  }, [editId, opts, statusId]);

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
      setSavedDiscussion(hasText(d.Discussion) ? String(d.Discussion).trim() : '');
      const loadedStatusId = Number(d.Status_id);
      const fallbackStatusId = opts?.statuses?.find((status) => status.label.toLowerCase() === 'new')?.id ?? 1;
      setStatusId(Number.isInteger(loadedStatusId) && loadedStatusId > 0 ? loadedStatusId : fallbackStatusId);
      setDiscStatusId(Number.isInteger(Number(d.Status_id)) && Number(d.Status_id) > 0 ? Number(d.Status_id) : '');
      setInquiryDate(d.Inquiry_Dt ? String(d.Inquiry_Dt).slice(0,10) : today());
      setInquirySoftwareTime(d.Date_Added ? String(d.Date_Added) : '');
      setInquiryMode(d.Inquiry_From || '');
      setInquiryType(d.Inquiry_Type || '');
      setPreferredLocation(d.Preferred_Location || '');
      setCourseId(d.Course_Id ? String(d.Course_Id) : '');
      setCategory(d.Batch_Category_id || '');
      setBatchCode(d.Batch_Code || '');
      setQualification(d.Qualification || '');
      setDiscipline(d.DisciplineName || d.Discipline || '');
      setPercentage(d.Percentage != null ? String(d.Percentage) : '');
      setReminderAt(d.Reminder_At || null);
      setLeadTemp((d.lead_temperature as 'hot' | 'warm' | 'cold' | '') || '');
    }).catch(console.error);
  }, [editId, opts]);

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
  useEffect(() => {
    fetch('/api/inquiry/staff').then(r => r.json()).then(d => setStaff(d.staff || [])).catch(() => {});
  }, []);

  const firstDiscussionTime = discussions.length > 0 ? discussions[0]?.created_date : null;

  // For these statuses the inquiry is effectively closed out — only the status itself
  // needs to be saved, so Name/Mode/How They Know/Batch are not required.
  const isStatusOnlySave = STATUS_ONLY_SAVE_LABELS.includes(
    opts?.statuses.find(s => s.id === statusId)?.label?.toLowerCase() ?? ''
  );

  const isFirstContact = FIRST_CONTACT_LABELS.includes(
    opts?.statuses.find(s => s.id === statusId)?.label?.toLowerCase() ?? ''
  );
  // True when a field is compulsory on the edit page; false for first-contact statuses.
  const laterDetail = editId != null && !isFirstContact;

  // WhatsApp starts out the same as Mobile and follows it until it is changed to a different number.
  const changeMobile = (value: string) => {
    if (!whatsapp.trim() || whatsapp === mobile) setWhatsapp(value);
    setMobile(value);
  };

  const handleSave = async (skipDuplicateCheck = false) => {
    if (!Number.isInteger(statusId) || statusId <= 0) { setError('Status is required'); return; }
    if (!mobile.trim()) { setError('Mobile is required'); setMissingFields(['Mobile']); return; }
    if (!isStatusOnlySave) {
      if (!name.trim()) { setError('Name is required'); return; }
      if (!inquiryMode.trim()) { setError('Mode is required'); return; }
      if (!inquiryType.trim()) { setError('How They Know About SIT is required'); return; }
      if (!batchCode.trim() && !isFirstContact) { setError('Batch Code is required'); return; }
      // On the edit page every field except Discussion is compulsory.
      if (editId) {
        const missing: [string, string][] = [
          [gender, 'Gender'], [email, 'Email'],
          [nationality, 'Nationality'], [country, 'Country'], [leadTemp, 'Lead Temperature'], [inquiryDate, 'Inquiry Date'],
          [qualification, 'Qualification'], [discipline, 'Discipline'],
          ...(isFirstContact ? [] : [
            [dob, 'Date of Birth'], [preferredLocation, 'Preferred Location'],
            [courseId, 'Course'], [category, 'Category'], [percentage, 'Percentage'],
          ] as [string, string][]),
        ];
        const empty = missing.filter(([v]) => !String(v ?? '').trim()).map(([, label]) => label);
        if (empty.length) { setError(`${empty[0]} is required`); setMissingFields(empty); return; }
      }
    }
    setError('');

    if (!editId && !skipDuplicateCheck && (mobile.trim() || email.trim())) {
      setCheckingDuplicate(true);
      try {
        const p = new URLSearchParams();
        if (mobile.trim()) p.set('mobile', mobile.trim());
        if (email.trim()) p.set('email', email.trim());
        const res = await fetch(`/api/inquiry/check-person?${p}`);
        const data = await res.json();
        if (res.ok && data.matches?.length > 0) {
          setDuplicateCheck({ personName: data.personName, matches: data.matches });
          setCheckingDuplicate(false);
          return;
        }
      } catch {
        // Best-effort check — fall through to save if it fails.
      }
      setCheckingDuplicate(false);
    }

    setSaving(true);
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
          Inquiry_Type: inquiryType || null, Preferred_Location: preferredLocation || null,
          Course_Id: courseId ? parseInt(courseId) : null,
          Batch_Category_id: category || null, Batch_Code: batchCode || null,
          Qualification: qualification || null, Discipline: discipline || null,
          Percentage: percentage ? parseFloat(percentage) : null,
          lead_temperature: leadTemp || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (!editId && calendlyBookingId && data.Student_Id) {
        fetch('/api/calendly/webhook', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: parseInt(calendlyBookingId), inquiry_id: data.Student_Id }),
        }).catch(() => {});
      }
      goBackToList(editId ? undefined : Number(data.Student_Id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const buildStructuredDiscussion = () => {
    const parts: string[] = [];
    if (discN.trim()) parts.push(`N: ${discN.trim()}`);
    if (discF.trim()) parts.push(`F: ${discF.trim()}`);
    if (discA.trim()) parts.push(`A: ${discA.trim()}`);
    if (discB.trim()) parts.push(`B: ${discB.trim()}`);
    if (discT.trim()) parts.push(`T: ${discT.trim()}`);
    if (discU.trim()) parts.push(`U: ${discU.trim()}`);
    return parts.join('\n');
  };

  // NFABTU only for inquiries with no discussion anywhere — not in the
  // follow-up history and not in the inquiry's own Discussion field.
  const isFirstDiscussion = discussions.length === 0 && !savedDiscussion;
  // Level 1 always uses the NFABTU structure, on any entry.
  const canAddDiscussion = meetingLevel === '1'
    ? [discN, discF, discA, discB, discT, discU].some(v => v.trim())
    : Boolean(newDiscussion.trim());
  const levelOk = meetingLevel !== '2' || Boolean(level2Date && level2Account);
  useEffect(() => { setMeetingLevel(isFirstDiscussion ? '1' : '3'); }, [isFirstDiscussion]);

  const openL2Modal = () => { setMDate(''); setMLink(''); setMAccount(''); setMNote(''); setMError(''); setL2Modal(true); };

  const openCalendlyLink = async (date?: string) => {
    if (!editId) return;
    try {
      const res = await fetch(`/api/inquiry/level2-link?inquiryId=${editId}${date ? `&date=${date}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build the Calendly link');
      if (data.kind === 'appointment') setApptDetailId(data.appointmentId);
      else window.open(data.url, '_blank', 'noopener');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleCreateL2 = async () => {
    if (!editId) return;
    if (!mDate || !mAccount) { setMError('Meeting date and account name are required'); return; }
    const accountName = staff.find(u => String(u.id) === mAccount)?.name || '';
    const text = [
      `Level 2 meeting planned for ${fmtDate(mDate)}`,
      accountName && `Account: ${accountName}`,
      mNote.trim() && `Notes: ${mNote.trim()}`,
    ].filter(Boolean).join('\n');
    setMBusy(true); setMError('');
    try {
      const res = await fetch('/api/inquiry/discussions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: editId, discussion: text, nextFollowUpDate: mDate === today() ? null : mDate,
          meetingLevel: 2, level2Date: mDate, level2AccountId: Number(mAccount),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the Level 2 meeting');
      if (!data.calendlyUrl) throw new Error('Calendly did not return a link — the meeting was not created');
      fetchDiscussions();
      setMLink(data.calendlyUrl); window.open(data.calendlyUrl, '_blank', 'noopener');
    } catch (err: unknown) { setMError(err instanceof Error ? err.message : 'Failed'); }
    setMBusy(false);
  };

  const handleAddDiscussion = async () => {
    const finalText = meetingLevel === '1' ? buildStructuredDiscussion() : newDiscussion.trim();
    if (!finalText || !newNextDate || !editId || !levelOk) return;
    if (newNextDate === today()) { setShowSameDateModal(true); return; }
    setDiscLoading(true);
    try {
      const res = await fetch('/api/inquiry/discussions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: editId, discussion: finalText, nextFollowUpDate: newNextDate,
          meetingLevel: Number(meetingLevel), level2Date, level2AccountId: Number(level2Account) || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
      setDiscN(''); setDiscF(''); setDiscA(''); setDiscB(''); setDiscT(''); setDiscU('');
      setNewDiscussion(''); setNewNextDate(tomorrow()); setMeetingLevel('3'); setLevel2Date(''); setLevel2Account(''); fetchDiscussions();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    setDiscLoading(false);
  };

  const logContactAction = async (action: { mode: string; channel: string; label: string }) => {
    if (!editId) return;
    setLoggingContact(action.channel);
    setContactLogged(false);
    setError('');
    try {
      const res = await fetch('/api/inquiry/contact-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, channel: action.channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to log action');
      setInquiryMode(action.mode);
      setContactLogged(true);
      setTimeout(() => setContactLogged(false), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log action');
    } finally {
      setLoggingContact(null);
    }
  };

  const handleDiscStatusChange = async (value: number) => {
    if (!editId || !Number.isInteger(value) || value <= 0) return;
    const prev = discStatusId;
    setDiscStatusId(value);
    setStatusSaving(true);
    setStatusSaved(false);
    setError('');
    try {
      const res = await fetch('/api/inquiry', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Student_Id: editId, Status_id: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update status');
      setStatusId(value);
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 2000);
    } catch (err: unknown) {
      setDiscStatusId(prev);
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const startEditDisc = (d: Discussion) => {
    setEditingDiscId(d.id); setEditingDiscText(d.discussion);
    setEditLevel(d.meeting_level === 2 ? '2' : d.meeting_level === 3 ? '3' : d.meeting_level === 1 ? '1' : (discussions[0]?.id === d.id ? '1' : '3'));
    setEditL2Date(d.level2_date || '');
    setEditL2Account(d.level2_account_user_id ? String(d.level2_account_user_id) : '');
  };

  const handleSaveEditDisc = async (id: number) => {
    if (!editingDiscText.trim()) return;
    const current = discussions.find(x => x.id === id);
    const levelEditable = true;
    if (levelEditable && editLevel === '2' && (!editL2Date || !editL2Account)) { setError('Level 2 needs a meeting date and an account name'); return; }
    try {
      const res = await fetch('/api/inquiry/discussions', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, discussion: editingDiscText,
          ...(levelEditable ? { meetingLevel: Number(editLevel), level2Date: editL2Date, level2AccountId: Number(editL2Account) || undefined } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to update');
      setEditingDiscId(null); setEditingDiscText(''); fetchDiscussions();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleDeleteDisc = async (id: number) => {
    if (!confirm('Delete this discussion entry?')) return;
    try {
      const res = await fetch(`/api/inquiry/discussions?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchDiscussions();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  };

  const openMailModal = () => {
    if (!editId) { alert('Save the inquiry first.'); return; }
    if (!email.trim()) { alert('No email found. Add email and save first.'); return; }
    setMailSubject('Your SIT Admission Form Link');
    setMailBody([`Dear ${name.trim() || 'Student'},`,'','Thank you for your interest in SIT.','Please complete your admission form using the link below:',activeAdmissionFormUrl,'','Regards,','SIT Admissions Team'].join('\n'));
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
      if (!window.confirm([`To: ${email.trim()}`,`Subject: ${mailSubject}`,`Link: ${activeAdmissionFormUrl}`,'','Click OK to send.'].join('\n'))) return;
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

  const regenerateAdmissionLink = async () => {
    if (!editId) return;
    const ok = window.confirm(
      'Regenerate this admission link?\n\nThis clears the saved online admission form/draft for this inquiry and creates a fresh usable form link.'
    );
    if (!ok) return;

    setRegeneratingLink(true);
    try {
      const res = await fetch('/api/inquiry/regenerate-admission-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to regenerate admission link');
      }

      const freshUrl = String(data.admissionFormUrl || admissionFormUrl);
      setRegeneratedAdmissionFormUrl(freshUrl);
      setMailBody((prev) => prev.includes(activeAdmissionFormUrl) ? prev.replaceAll(activeAdmissionFormUrl, freshUrl) : prev);
      await navigator.clipboard.writeText(freshUrl);
      alert('Admission link regenerated successfully. Fresh link copied to clipboard.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate admission link');
    } finally {
      setRegeneratingLink(false);
    }
  };

  const openReminderModal = () => {
    setReminderOption('24');
    setCustomHours('');
    setShowReminderModal(true);
  };

  const setReminder = async () => {
    if (!editId) return;
    const hours = reminderOption === 'custom' ? parseFloat(customHours) : parseInt(reminderOption, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      alert('Enter a valid number of hours');
      return;
    }
    setSavingReminder(true);
    try {
      const res = await fetch('/api/inquiry/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId: editId, hours }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to set reminder');
      setReminderAt(data.reminderAt);
      setShowReminderModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to set reminder');
    } finally {
      setSavingReminder(false);
    }
  };

  const clearReminder = async () => {
    if (!editId) return;
    setSavingReminder(true);
    try {
      const res = await fetch(`/api/inquiry/reminder?inquiryId=${editId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to clear reminder');
      setReminderAt(null);
      setShowReminderModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to clear reminder');
    } finally {
      setSavingReminder(false);
    }
  };

  const reminderIsDue = Boolean(reminderAt && new Date(reminderAt.includes('T') ? reminderAt : reminderAt.replace(' ', 'T')).getTime() <= Date.now());

  if (permLoading) return <PermissionLoading />;
  if (editId && !canUpdate) return <AccessDenied message="You do not have permission to edit inquiries." />;
  if (!editId && !canCreate) return <AccessDenied message="You do not have permission to create inquiries." />;

  return (
    <div className="flex flex-col gap-1">

      {/* Header — title left, actions right */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-2 flex items-center gap-3 relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <button onClick={() => goBackToList()} className="relative z-10 p-1 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="relative z-10 flex-1 min-w-0">
          <span className="text-sm font-black text-white tracking-tight">{editId ? 'Edit Inquiry' : 'Add Inquiry'}</span>
          <span className="ml-2 text-[10px] text-white/40">Inquiry › {editId ? 'Edit' : 'Add'}</span>
        </div>
        <div className="relative z-10 flex items-center gap-1.5 shrink-0">
          {error && <span title={error} className="text-[10px] text-red-300 font-semibold max-w-[260px] truncate">{error}</span>}
          {editId && contactActionButtons.map((action) => {
            const selected = inquiryMode === action.mode;
            return (
              <button key={action.channel} type="button" onClick={() => logContactAction(action)} disabled={Boolean(loggingContact)}
                title={`Log ${action.label}`} aria-label={`Log ${action.label}`}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-60 ${selected ? 'bg-white text-[#2E3093]' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                {loggingContact === action.channel
                  ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <ContactActionIcon channel={action.channel} />}
              </button>
            );
          })}
          {contactLogged && <span className="text-[10px] font-semibold text-emerald-200">Logged</span>}
          <button onClick={() => handleSave()} disabled={saving || checkingDuplicate}
            className="flex items-center gap-1 bg-white text-[#2E3093] px-3 py-1 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-60">
            {saving || checkingDuplicate
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
          {editId && (
            <button onClick={openReminderModal}
              title={reminderAt ? (reminderIsDue ? 'Reminder due' : `Reminder set for ${new Date(reminderAt.includes('T') ? reminderAt : reminderAt.replace(' ', 'T')).toLocaleString()}`) : 'Set a reminder'}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                reminderIsDue ? 'bg-sky-200 text-sky-900 hover:bg-sky-300' : 'bg-white/15 hover:bg-white/25 text-white'
              }`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M4.5 4.5h13.5l-2.5 3.75 2.5 3.75H4.5" />
              </svg>
              {reminderAt ? (reminderIsDue ? 'Reminder Due' : 'Reminder Set') : 'Reminder'}
            </button>
          )}
          <button onClick={() => goBackToList()}
            className="px-3 py-1 text-xs font-semibold text-white/70 hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
          <div className="grid grid-cols-6 gap-x-2 gap-y-1">

            {/* Personal */}
            <div className="col-span-6 flex items-center gap-2 mt-1 first:mt-0">
              <span className="h-3.5 w-1 rounded-full bg-[#2E3093] shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#2E3093] shrink-0">Personal Details</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Name <span className="text-red-400 normal-case">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={ctrl} />
            </div>
            <div>
              <label className={lbl}>Gender{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.genders?.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Date of Birth{laterDetail && <span className="text-red-400 normal-case"> *</span>}</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={ctrl} />
            </div>

            <div>
              <label className={lbl}>Mobile <span className="text-red-400 normal-case">*</span></label>
              <input type="tel" value={mobile} onChange={e => changeMobile(e.target.value)} placeholder="Mobile" className={ctrl} required />
            </div>
            <div>
              <label className={lbl}>WhatsApp</label>
              <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp" className={ctrl} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Email{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={ctrl} />
            </div>

            <div className="col-span-2">
              <label className={lbl}>Nationality{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <input list="nat-list" value={nationality} onChange={e => setNationality(e.target.value)} placeholder="Type or select" className={ctrl} />
              <datalist id="nat-list">{opts?.nationalities?.map(n => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Country{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <input list="country-list" value={country} onChange={e => setCountry(e.target.value)} placeholder="Type or select" className={ctrl} />
              <datalist id="country-list">{opts?.countries?.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Discussion</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Discussion…" rows={2} className={`${ctrl} resize-y`} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Lead Temperature{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <div className="flex gap-2 mt-0.5">
                {(['hot', 'warm', 'cold'] as const).map(t => {
                  const cfg = {
                    hot: {
                      label: 'Hot', bg: 'bg-red-500', ring: 'ring-red-400', text: 'text-white',
                      icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" /></svg>,
                    },
                    warm: {
                      label: 'Warm', bg: 'bg-amber-400', ring: 'ring-amber-300', text: 'text-amber-900',
                      icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
                    },
                    cold: {
                      label: 'Cold', bg: 'bg-blue-400', ring: 'ring-blue-300', text: 'text-white',
                      icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" /></svg>,
                    },
                  }[t];
                  const active = leadTemp === t;
                  return (
                    <button key={t} type="button"
                      onClick={() => setLeadTemp(active ? '' : t)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${active ? `${cfg.bg} ${cfg.text} border-transparent ring-2 ${cfg.ring} shadow` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                      {cfg.icon}{cfg.label}
                    </button>
                  );
                })}
                {leadTemp && <button type="button" onClick={() => setLeadTemp('')} className="text-[10px] text-slate-400 hover:text-slate-600 px-1">✕ Clear</button>}
              </div>
            </div>

            {/* Inquiry Details */}
            <div className="col-span-6 flex items-center gap-2 mt-1 first:mt-0">
              <span className="h-3.5 w-1 rounded-full bg-[#2E3093] shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#2E3093] shrink-0">Inquiry Details</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
            <div>
              <label className={lbl}>Inquiry Date{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <input type="date" value={inquiryDate} onChange={e => setInquiryDate(e.target.value)} className={ctrl} />
            </div>
            {editId && (
              <div className="col-span-2">
                <label className={lbl}>Inquiry in Software</label>
                <input value={fmtDateTime(inquirySoftwareTime)} readOnly className={`${ctrl} bg-slate-50 text-slate-500`} />
              </div>
            )}
            <div>
              <label className={lbl}>
                Mode
                {!isStatusOnlySave && <span className="text-red-400 normal-case"> *</span>}
              </label>
              <select value={inquiryMode} onChange={e => { setInquiryMode(e.target.value); setContactLogged(false); }} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.inquiryModes?.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Preferred Location{laterDetail && <span className="text-red-400 normal-case"> *</span>}</label>
              <select value={preferredLocation} onChange={e => setPreferredLocation(e.target.value)} className={ctrl}>
                <option value="">— Select —</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Pune">Pune</option>
                <option value="ONLINE">ONLINE</option>
              </select>
            </div>
            <div className={editId ? 'col-span-1' : 'col-span-3'}>
              <label className={lbl}>
                How They Know About SIT
                {!isStatusOnlySave && <span className="text-red-400 normal-case"> *</span>}
              </label>
              <select value={inquiryType} onChange={e => setInquiryType(e.target.value)} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.inquiryTypes?.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Training */}
            <div className="col-span-6 flex items-center gap-2 mt-1 first:mt-0">
              <span className="h-3.5 w-1 rounded-full bg-[#2E3093] shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#2E3093] shrink-0">Training</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Course{laterDetail && <span className="text-red-400 normal-case"> *</span>}</label>
              <select value={courseId} onChange={e => { setCourseId(e.target.value); setBatchCode(''); }} className={ctrl}>
                <option value="">— Select Course —</option>
                {opts?.courses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Category{laterDetail && <span className="text-red-400 normal-case"> *</span>}</label>
              <select value={category} onChange={e => { setCategory(e.target.value); setBatchCode(''); }} className={ctrl}>
                <option value="">— Select —</option>
                {opts?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>
                Batch
                {!isStatusOnlySave && !isFirstContact && <span className="text-red-400 normal-case"> *</span>}
              </label>
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
            <div className="col-span-6 flex items-center gap-2 mt-1 first:mt-0">
              <span className="h-3.5 w-1 rounded-full bg-[#2E3093] shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider text-[#2E3093] shrink-0">Education & Status</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Qualification{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <select value={qualification} onChange={e => setQualification(e.target.value)} className={ctrl}>
                <option value="">— Select Qualification —</option>
                {qualification && !opts?.qualifications?.includes(qualification) && <option value={qualification}>{qualification}</option>}
                {opts?.qualifications?.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Discipline{editId && <span className="text-red-400 normal-case"> *</span>}</label>
              <select value={discipline} onChange={e => setDiscipline(e.target.value)} className={ctrl}>
                <option value="">— Select Discipline —</option>
                {discipline && !opts?.disciplines?.includes(discipline) && <option value={discipline}>{discipline}</option>}
                {opts?.disciplines?.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Percentage{laterDetail && <span className="text-red-400 normal-case"> *</span>}</label>
              <input type="number" step="0.01" min="0" max="100" value={percentage} onChange={e => setPercentage(e.target.value)} placeholder="e.g. 85.50" className={ctrl} />
            </div>
            <div>
              <label className={lbl}>Status <span className="text-red-400 normal-case">*</span></label>
              <select value={statusId} onChange={e => setStatusId(parseInt(e.target.value))} className={ctrl} required>
                {opts?.statuses?.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

      <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
        <div className="flex items-center justify-between mb-2 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Follow-up Discussion</span>
            {editId && (
              <span className="text-[10px] font-semibold text-slate-500 truncate">
                First discussion: {fmtDateTime(firstDiscussionTime)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editId && discussions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="disc-status" className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                <select
                  id="disc-status"
                  value={discStatusId}
                  onChange={e => handleDiscStatusChange(parseInt(e.target.value, 10))}
                  disabled={statusSaving}
                  className={`${ctrl} w-auto py-1`}
                >
                  <option value="" disabled>— Select status —</option>
                  {opts?.statusMaster?.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {statusSaving && <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />}
                {statusSaved && !statusSaving && <span className="text-[10px] font-semibold text-green-600">Saved</span>}
              </div>
            )}
            <span className="text-[10px] text-slate-400">{editId ? discussions.length + (savedDiscussion ? 1 : 0) : 0}</span>
          </div>
        </div>
        {!editId ? (
          <p className="text-xs text-slate-400 py-3 text-center">Save the inquiry first to add follow-up discussions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-100 rounded-lg overflow-hidden">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#2A6BB5]/60 bg-zinc-50 border-b border-zinc-200">
                  <th className="text-left py-2 px-3 font-bold">Current Date</th>
                  <th className="text-left py-2 px-3 font-bold">Next Follow-Up Date</th>
                  <th className="text-left py-2 px-3 font-bold">Meeting Level</th>
                  <th className="text-left py-2 px-3 font-bold w-full">Follow-Up Discussion</th>
                  <th className="text-center py-2 px-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-500 align-top">{fmtDate(today())}</td>
                  <td className="py-2 px-3 min-w-[160px] align-top">
                    <input type="date" value={newNextDate} onChange={e => {
                      if (e.target.value === today()) { setShowSameDateModal(true); return; }
                      setNewNextDate(e.target.value);
                    }} className={ctrl} />
                  </td>
                  <td className="py-2 px-3 min-w-[170px] align-top">
                    <div className="space-y-1">
                        <select value={meetingLevel} onChange={e => setMeetingLevel(e.target.value as '1' | '2' | '3')} className={ctrl}>
                          <option value="1">Level 1 meeting</option>
                          <option value="2">Level 2 meeting</option>
                          <option value="3">Follow up</option>
                        </select>
                        {meetingLevel === '1' && (
                          <button type="button" onClick={openL2Modal} className="w-full rounded-md border border-[#2E3093]/30 bg-white px-2 py-1 text-[10px] font-bold text-[#2E3093] hover:bg-[#2E3093]/5">
                            + Create Level 2 meeting
                          </button>
                        )}
                        {meetingLevel === '2' && (<>
                          <label className="block text-[10px] font-semibold text-slate-500">Level 2 meeting scheduled on</label>
                          <input type="date" min={today()} value={level2Date} onChange={e => setLevel2Date(e.target.value)} className={ctrl} />
                          <label className="block text-[10px] font-semibold text-slate-500">Account name</label>
                          <select value={level2Account} onChange={e => setLevel2Account(e.target.value)} className={ctrl}>
                            <option value="">Select account…</option>
                            {staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </>)}
                    </div>
                  </td>
                  <td className="py-2 px-3 min-w-[340px]">
                    {meetingLevel === '1' ? (
                    <div className="space-y-1">
                      {([
                        { key: 'N', label: 'Name / Background', val: discN, set: setDiscN, color: 'text-violet-600', placeholder: 'Prospect name, experience, location…' },
                        { key: 'F', label: 'Finding / Need', val: discF, set: setDiscF, color: 'text-blue-600', placeholder: 'What they are looking for…' },
                        { key: 'A', label: 'Authority', val: discA, set: setDiscA, color: 'text-teal-600', placeholder: 'own / manager / parent…' },
                        { key: 'B', label: 'Budget', val: discB, set: setDiscB, color: 'text-green-700', placeholder: 'ok / concern / pending…' },
                        { key: 'T', label: 'Training Recommendation', val: discT, set: setDiscT, color: 'text-amber-700', placeholder: 'Course recommended, batch discussed…' },
                        { key: 'U', label: 'Urgency', val: discU, set: setDiscU, color: 'text-red-600', placeholder: 'Current batch / next batch / no urgency…' },
                      ] as const).map(({ key, label, val, set, color, placeholder }) => (
                        <div key={key} className="flex items-start gap-1.5">
                          <span className={`mt-1.5 w-5 text-[11px] font-black shrink-0 ${color}`}>{key}</span>
                          <div className="flex-1 min-w-0">
                            <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder} className={`${ctrl} text-[11px] py-1`} title={label} />
                          </div>
                        </div>
                      ))}
                    </div>
                    ) : (
                      <textarea value={newDiscussion} onChange={e => setNewDiscussion(e.target.value)} placeholder="Follow-up notes…" rows={4} className={`${ctrl} py-2 resize-y leading-relaxed`} />
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button onClick={handleAddDiscussion} disabled={discLoading || !canAddDiscussion || !newNextDate || !levelOk}
                      className="inline-flex items-center gap-1 bg-[#2E3093] text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors disabled:opacity-50">
                      {discLoading
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
                      Add
                    </button>
                  </td>
                </tr>
                {discussions.length === 0 && !savedDiscussion ? (
                  <tr><td colSpan={5} className="py-6 text-center text-xs text-slate-400">No discussions yet.</td></tr>
                ) : discussions.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-b-0 align-top">
                    <td className="py-2 px-3 whitespace-nowrap text-slate-600">{fmtDate(d.date)}</td>
                    <td className="py-2 px-3 whitespace-nowrap text-[#2E3093] font-medium">{fmtDate(d.nextdate)}</td>
                    <td className="py-2 px-3 text-slate-600 align-top">
                      {editingDiscId === d.id ? (
                        <div className="space-y-1 min-w-[160px]">
                          <select value={editLevel} onChange={e => setEditLevel(e.target.value as '1' | '2' | '3')} className={ctrl}>
                            <option value="1">Level 1 meeting</option>
                            <option value="2">Level 2 meeting</option>
                            <option value="3">Follow up</option>
                          </select>
                          {editLevel === '2' && (<>
                            <label className="block text-[10px] font-semibold text-slate-500">Level 2 meeting scheduled on</label>
                            <input type="date" min={today()} value={editL2Date} onChange={e => setEditL2Date(e.target.value)} className={ctrl} />
                            <label className="block text-[10px] font-semibold text-slate-500">Account name</label>
                            <select value={editL2Account} onChange={e => setEditL2Account(e.target.value)} className={ctrl}>
                              <option value="">Select account…</option>
                              {staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </>)}
                        </div>
                      ) : d.meeting_level === 2 ? (
                        <div className="text-[11px] leading-snug">
                          <span className="font-bold text-[#2E3093]">Level 2</span>
                          <div>Planned for {fmtDate(d.level2_date)}</div>
                          <button type="button" onClick={() => openCalendlyLink(d.level2_date || undefined)} className="text-[10px] font-bold text-[#2E3093] underline">View meeting details</button>
                          <div className="text-slate-500">{d.level2_account_name || '—'}</div>
                        </div>
                      ) : d.meeting_level === 3 ? <span className="font-bold text-slate-600 text-[11px]">Follow up</span>
                      : d.meeting_level === 1 ? (
                        <div className="text-[11px] space-y-1">
                          <span className="font-bold text-slate-600">Level 1</span>
                          <button type="button" onClick={openL2Modal} className="block rounded-md border border-[#2E3093]/30 bg-white px-2 py-1 text-[10px] font-bold text-[#2E3093] hover:bg-[#2E3093]/5">+ Create Level 2 meeting</button>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2 px-3 min-w-[420px] w-full">
                      {editingDiscId === d.id ? (
                        <textarea
                          value={editingDiscText}
                          onChange={(e) => setEditingDiscText(e.target.value)}
                          rows={8}
                          className="w-full min-h-[180px] text-xs leading-relaxed border border-slate-300 rounded-md p-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#2E3093]"
                        />
                      ) : (
                        renderDiscussion(d.discussion)
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {editingDiscId === d.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => handleSaveEditDisc(d.id)} className="px-2.5 py-1 text-[10px] font-semibold bg-[#2E3093] text-white rounded hover:bg-[#252780] transition-colors">Save</button>
                          <button onClick={() => { setEditingDiscId(null); setEditingDiscText(''); }} className="px-2.5 py-1 text-[10px] font-semibold bg-white text-slate-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-0.5">
                          <button onClick={() => startEditDisc(d)} title="Edit" className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-[#2E3093] transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteDisc(d.id)} title="Delete discussion" className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-100 bg-white text-[10px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete Discussion
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {savedDiscussion && (
                  <tr className="border-t border-slate-100 align-top bg-amber-50/40">
                    <td className="py-2 px-3 whitespace-nowrap text-slate-600">{fmtDate(inquiryDate)}</td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-400">—</td>
                    <td className="py-2 px-3 text-slate-300">—</td>
                    <td className="py-2 px-3 min-w-[420px] w-full">
                      <span className="mb-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">Inquiry discussion</span>
                      <div>{renderDiscussion(savedDiscussion)}</div>
                    </td>
                    <td className="py-2 px-3 text-center text-[10px] text-slate-400">Edit in the Discussion field above</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Duplicate-person confirmation */}
      {duplicateCheck && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5]">
              <h3 className="text-sm font-bold text-white">Existing Enquiry Found</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                This person{duplicateCheck.personName ? ` (${duplicateCheck.personName})` : ''} has already enquired with us. Do you want to add a new enquiry?
              </p>
              <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {duplicateCheck.matches.map((m) => (
                  <div key={m.Inquiry_Id} className="px-3 py-2 border-b border-slate-100 last:border-b-0 text-xs">
                    <span className="font-semibold text-slate-700">{m.CourseName || 'No course'}</span>
                    <span className="text-slate-400"> — {fmtDate(m.Inquiry_Dt)}{m.StatusLabel ? ` · ${m.StatusLabel}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setDuplicateCheck(null)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setDuplicateCheck(null); handleSave(true); }}
                className="px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors"
              >
                Yes – Add Enquiry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && editId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Set Reminder</h3>
              <button onClick={() => setShowReminderModal(false)} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {reminderAt && (
                <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${reminderIsDue ? 'bg-sky-100 text-sky-900' : 'bg-slate-50 text-slate-600'}`}>
                  {reminderIsDue ? 'Reminder is due — ' : 'Currently set for '}
                  {new Date(reminderAt.includes('T') ? reminderAt : reminderAt.replace(' ', 'T')).toLocaleString()}
                </div>
              )}
              <div>
                <label className={lbl}>Remind me after</label>
                <select value={reminderOption} onChange={e => setReminderOption(e.target.value as typeof reminderOption)} className={ctrl}>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {reminderOption === 'custom' && (
                <div>
                  <label className={lbl}>Hours from now</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={customHours}
                    onChange={e => setCustomHours(e.target.value)}
                    placeholder="e.g. 6"
                    className={ctrl}
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              {reminderAt ? (
                <button onClick={clearReminder} disabled={savingReminder}
                  className="px-3 py-1.5 text-xs font-bold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                  Clear Reminder
                </button>
              ) : <span />}
              <button onClick={setReminder} disabled={savingReminder}
                className="px-3 py-1.5 text-xs font-bold bg-[#2E3093] hover:bg-[#252780] text-white rounded-lg transition-colors disabled:opacity-50">
                {savingReminder ? 'Saving…' : 'Set Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {apptDetailId && <AppointmentDetailModal id={apptDetailId} onClose={() => setApptDetailId(null)} />}

      {/* Missing compulsory fields */}
      {missingFields.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMissingFields([])}>
          <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 bg-amber-500"><h3 className="text-sm font-bold text-white">Inquiry not updated</h3></div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-700">These compulsory fields are empty:</p>
              <ul className="list-disc pl-5 text-sm font-medium text-slate-800 columns-2">
                {missingFields.map(f => <li key={f}>{f}</li>)}
              </ul>
              <div className="flex justify-end"><button onClick={() => setMissingFields([])} className="bg-[#2E3093] text-white px-4 py-1.5 rounded-lg text-xs font-bold">OK</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Create Level 2 meeting */}
      {l2Modal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !mBusy && setL2Modal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5]">
              <h3 className="text-sm font-bold text-white">Create Level 2 meeting</h3>
              <p className="text-[10px] text-white/70">Saves the plan and opens a prefilled Calendly booking link</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-[11px] text-slate-600 space-y-0.5">
                <div><span className="font-semibold text-slate-500">Invitee:</span> {name || '—'}</div>
                <div><span className="font-semibold text-slate-500">Email:</span> {email || <span className="text-red-500">missing — add it and save first</span>}</div>
                <div><span className="font-semibold text-slate-500">Mobile:</span> {mobile || '—'}</div>
                <div><span className="font-semibold text-slate-500">Program:</span> {opts?.courses?.find(c => String(c.id) === courseId)?.name || '—'}</div>
                <div><span className="font-semibold text-slate-500">Event:</span> EPC Career Counselling with SIT</div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={lbl}>Meeting date <span className="text-red-400">*</span></label>
                  <input type="date" min={today()} value={mDate} onChange={e => setMDate(e.target.value)} className={ctrl} />
                </div>
              </div>
              <div>
                <label className={lbl}>Account name <span className="text-red-400">*</span></label>
                <select value={mAccount} onChange={e => setMAccount(e.target.value)} className={ctrl}>
                  <option value="">Select account…</option>
                  {staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea value={mNote} onChange={e => setMNote(e.target.value)} rows={2} className={`${ctrl} resize-y`} />
              </div>
              {mError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{mError}</p>}
              {mLink ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5 text-[11px] text-emerald-800 space-y-1.5">
                  <p className="font-semibold">Saved. Pick the slot on the Calendly page that just opened — the appointment is created once it is booked.</p>
                  <p className="break-all text-emerald-700">{mLink}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => window.open(mLink, '_blank', 'noopener')} className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Open link</button>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(mLink)} className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[10px] font-bold text-emerald-700">Copy link</button>
                  </div>
                </div>
              ) : <p className="text-[10px] text-slate-400">The person is not emailed until a slot is booked in Calendly.</p>}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={mBusy} onClick={() => setL2Modal(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600">{mLink ? 'Close' : 'Cancel'}</button>
                {!mLink && (
                  <button type="button" disabled={mBusy} onClick={handleCreateL2} className="px-4 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-bold disabled:opacity-50">
                    {mBusy ? 'Saving…' : 'Save & open Calendly link'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Same-date warning */}
      {showSameDateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSameDateModal(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 bg-amber-500">
              <h3 className="text-sm font-bold text-white">Invalid follow-up date</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-700">
                The next follow-up date cannot be the same as the current date ({fmtDate(today())}). Please choose a later date.
              </p>
              <div className="flex justify-end">
                <button onClick={() => setShowSameDateModal(false)} className="bg-[#2E3093] text-white px-4 py-1.5 rounded-lg text-xs font-bold">OK</button>
              </div>
            </div>
          </div>
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
                  <input value={activeAdmissionFormUrl} readOnly className={`${ctrl} opacity-60`} />
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
              <button onClick={async () => { await navigator.clipboard.writeText(activeAdmissionFormUrl); alert('Link copied'); }}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-colors">Copy Link</button>
              <button onClick={async () => { await navigator.clipboard.writeText(mailBody); alert('Body copied'); }}
                className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-colors">Copy Body</button>
              <button onClick={regenerateAdmissionLink} disabled={regeneratingLink || sendingMail}
                className="px-3 py-1.5 text-xs font-bold border border-amber-200 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-60">
                {regeneratingLink ? 'Regenerating...' : 'Regenerate Link'}
              </button>
              <button onClick={() => window.open(activeAdmissionFormUrl, '_blank', 'noopener,noreferrer')}
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
