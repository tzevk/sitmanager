'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface KTDetail {
  subjectName: string; year: string; semester: string; clearedYear: string; marks: string;
}
interface Course { Course_Id: number; Course_Name: string }
interface BatchInfo { batchCode: string; timings: string | null; totalFees: number | null }
interface PayAtOfficeAudit {
  enabledAt?: string;
  enabledByUserId?: number;
  enabledByName?: string;
  enabledByEmail?: string;
}



type EduTab = 'SSC' | 'HSC' | 'Diploma' | 'Graduation' | 'Post-Grad';
type MainTab = 'personal' | 'academic' | 'occupational' | 'training' | 'payment' | 'terms';

/* ─── Style constants ────────────────────────────────────────────────────── */
const lbl = 'block text-[11px] font-semibold text-gray-500 mb-0.5';
const inp = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
const sel = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const txta = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

/* ─── Indian states list ─────────────────────────────────────────────────── */
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

/* ─── Main tab definitions ───────────────────────────────────────────────── */
const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'personal',     label: 'Personal Info' },
  { id: 'academic',     label: 'Academic' },
  { id: 'occupational', label: 'Occupational' },
  { id: 'training',     label: 'Training' },
  { id: 'payment',      label: 'Payment' },
  { id: 'terms',        label: 'Terms & Consent' },
];

/* ─── Section header icons ───────────────────────────────────────────────── */
const SECTION_ICON_PATHS = {
  camera:     'M3 9a2 2 0 012-2h1.172a2 2 0 001.414-.586l.828-.828A2 2 0 0110 5h4a2 2 0 011.414.586l.828.828A2 2 0 0017.828 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M12 17a4 4 0 100-8 4 4 0 000 8z',
  user:       'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4.418 0-8 1.79-8 4v1h16v-1c0-2.21-3.582-4-8-4z',
  phone:      'M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.687.845a11.037 11.037 0 006.105 6.105l.845-1.687a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  map:        'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  cap:        'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14zm0 0v6',
  briefcase:  'M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a1 1 0 00-1 1v10a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zM9 5h6v2H9V5z',
  training:   'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  card:       'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z',
  shield:     'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  clipboard:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  doc:        'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
} as const;
type SectionIcon = keyof typeof SECTION_ICON_PATHS;

/* ─── Helper components ──────────────────────────────────────────────────── */
function SectionCard({ title, icon, children }: { title: string; icon?: SectionIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
        {icon && (
          <span className="w-6 h-6 shrink-0 rounded-md bg-[#2E3093]/10 text-[#2E3093] flex items-center justify-center">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={SECTION_ICON_PATHS[icon]} />
            </svg>
          </span>
        )}
        <h3 className="text-[13px] font-bold text-[#2E3093]">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/* Small "View" link for a saved marksheet/document, or a muted note when none was uploaded. */
function DocumentViewLink({ label, url }: { label: string; url?: string }) {
  if (!url) {
    return <p className="text-[11px] text-gray-400 italic mt-1">No {label.toLowerCase()} uploaded</p>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-[#2A6BB5] hover:underline font-semibold mt-1"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      View {label}
    </a>
  );
}

/* ─── Mode of Payment options ─────────────────────────────────────────────── */
type PaymentOption = { value: string; label: string; sub: string; icon: 'full' | 'split' | 'loan' | 'office' | 'qr'; tone: 'emerald' | 'violet' | 'rose' | 'amber' | 'sky' };

const PAYMENT_PLAN_OPTIONS: PaymentOption[] = [
  { value: 'Full Payment',        label: 'Full Payment',           sub: 'Full amount in one go — 5% discount applied', icon: 'full',  tone: 'emerald' },
  { value: '2-Payment Plan',      label: '2-Payment Plan',         sub: 'Two scheduled instalments',                   icon: 'split', tone: 'violet' },
  { value: 'Loan (0% Interest)',  label: 'Loan (0% Interest)',     sub: 'Financed via a 0% interest loan partner',     icon: 'loan',  tone: 'rose' },
];

const PAYMENT_CHANNEL_OPTIONS: PaymentOption[] = [
  { value: 'Pay at Office',       label: 'Pay at Office',          sub: 'Staff only — offline collection at office counter', icon: 'office', tone: 'amber' },
  { value: 'Direct UPI Transfer', label: 'Direct UPI Transfer',    sub: 'Institute QR, for all admissions',                  icon: 'qr',     tone: 'sky' },
];

const PAYMENT_MODE_VALUES = [...PAYMENT_PLAN_OPTIONS, ...PAYMENT_CHANNEL_OPTIONS].map(o => o.value);

const PAYMENT_OPTION_ICON_PATHS: Record<PaymentOption['icon'], string> = {
  full:   'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  split:  'M9 7h6m0 10v-3m-3 3v-3m-3 3v-3m9-6H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z',
  loan:   'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z',
  office: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01',
  qr:     'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 4h2m2 0h2m-6-4h2m-2 2v2m4-2v4',
};

const PAYMENT_OPTION_TONE_CLS: Record<PaymentOption['tone'], { border: string; bg: string; icon: string; dot: string }> = {
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', icon: 'text-emerald-600 bg-emerald-100', dot: 'bg-emerald-500' },
  violet:  { border: 'border-violet-500',  bg: 'bg-violet-50',  icon: 'text-violet-600 bg-violet-100',  dot: 'bg-violet-500' },
  rose:    { border: 'border-rose-500',    bg: 'bg-rose-50',    icon: 'text-rose-600 bg-rose-100',      dot: 'bg-rose-500' },
  amber:   { border: 'border-amber-500',   bg: 'bg-amber-50',   icon: 'text-amber-600 bg-amber-100',    dot: 'bg-amber-500' },
  sky:     { border: 'border-sky-500',     bg: 'bg-sky-50',     icon: 'text-sky-600 bg-sky-100',        dot: 'bg-sky-500' },
};

function PaymentOptionCard({ opt, selected, onSelect }: { opt: PaymentOption; selected: boolean; onSelect: () => void }) {
  const t = PAYMENT_OPTION_TONE_CLS[opt.tone];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative text-left p-3.5 rounded-xl border-2 transition-all ${selected ? `${t.border} ${t.bg}` : 'border-gray-200 hover:border-gray-300 bg-white'}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${selected ? t.icon : 'text-gray-400 bg-gray-100'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={PAYMENT_OPTION_ICON_PATHS[opt.icon]} />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-800 leading-tight">{opt.label}</p>
          <p className="text-[10.5px] text-gray-500 mt-0.5 leading-snug">{opt.sub}</p>
        </div>
      </div>
      {selected && (
        <span className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center ${t.dot}`}>
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </button>
  );
}

const PAYMENT_PANEL_TONE_CLS: Record<'amber' | 'sky' | 'emerald', string> = {
  amber:   'border-amber-200 bg-amber-50 text-amber-900',
  sky:     'border-sky-200 bg-sky-50 text-sky-900',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};
const PAYMENT_PANEL_ICON_PATHS: Record<'office' | 'qr' | 'check' | 'bank' | 'card', string> = {
  office: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4',
  qr:     'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6z',
  check:  'M5 13l4 4L19 7',
  bank:   'M3 21h18M5 21V10m14 11V10M3 10l9-6 9 6M6 21v-6m4 6v-6m4 6v-6m4 6v-6',
  card:   'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z',
};

function PaymentDetailPanel({ tone, icon, title, children }: {
  tone: 'amber' | 'sky' | 'emerald';
  icon: 'office' | 'qr' | 'check' | 'bank' | 'card';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border px-3.5 py-3 text-[11px] ${PAYMENT_PANEL_TONE_CLS[tone]}`}>
      <div className="flex items-center gap-1.5 font-bold mb-1">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={PAYMENT_PANEL_ICON_PATHS[icon]} />
        </svg>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function KTTable({ ktCount, ktDetails }: { ktCount: string; ktDetails: KTDetail[] }) {
  const count = Number(ktCount);
  if (!count || !ktDetails.length) return null;
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold text-amber-600 mb-1">
        {count} KT / Backlog subject{count > 1 ? 's' : ''}
      </p>
      <div className="rounded border border-amber-200 bg-amber-50 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[10px] text-amber-700 border-b border-amber-200 bg-amber-100/50">
              {['Subject', 'Year', 'Semester', 'Cleared Year', 'Marks'].map(h => (
                <th key={h} className="text-left px-2 py-1 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ktDetails.map((kt, i) => (
              <tr key={i} className="border-b border-amber-100 last:border-0">
                <td className="px-2 py-1">{kt.subjectName || '—'}</td>
                <td className="px-2 py-1">{kt.year || '—'}</td>
                <td className="px-2 py-1">{kt.semester || '—'}</td>
                <td className="px-2 py-1">{kt.clearedYear || '—'}</td>
                <td className="px-2 py-1">{kt.marks || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusBadge(cat: string) {
  if (cat === 'accepted') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  if (cat === 'closed')   return 'bg-red-100 text-red-700 border-red-300';
  return 'bg-amber-100 text-amber-700 border-amber-300';
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function EditOnlineAdmissionPage() {
  const router = useRouter();
  const { id: studentId } = useParams<{ id: string }>();
  const { canUpdate, loading: permLoading } = useResourcePermissions('online_admission');

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'update' | 'reject' | null>(null);
  const [statusLabel, setStatusLabel]       = useState('');
  const [statusCategory, setStatusCategory] = useState('open');
  const [studentName, setStudentName]       = useState('');
  const [activeTab, setActiveTab]           = useState<MainTab>('personal');
  const [activeEduTab, setActiveEduTab]     = useState<EduTab>('SSC');
  const [photoUrl, setPhotoUrl]             = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [draftProgressMeta, setDraftProgressMeta] = useState<Record<string, unknown> | null>(null);
  const [payAtOfficeAudit, setPayAtOfficeAudit] = useState<PayAtOfficeAudit | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Real Student_Id (only set once the admission is granted) — distinct from the
  // `id` route param above, which is the Inquiry_Id. Photo upload and the
  // post-grant document list both need the real student record, not the inquiry.
  const [realStudentId, setRealStudentId] = useState('');
  // Inquiry-scoped saved uploads (photo + marksheets), used before an admission is
  // granted. Once granted, the same files live on the student's own document row
  // instead, fetched separately into studentDocuments below.
  const [savedAdmissionAssetsDetail, setSavedAdmissionAssetsDetail] =
    useState<Array<{ key: string; isPhoto: boolean; url: string }>>([]);
  const [studentDocuments, setStudentDocuments] =
    useState<Array<{ id: number; doc_name: string; upload_image: string }>>([]);

  // Training cascade
  const [courses, setCourses]                   = useState<Course[]>([]);
  const [batchCategories, setBatchCategories]   = useState<string[]>([]);
  const [availableBatches, setAvailableBatches] = useState<BatchInfo[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingBatches, setLoadingBatches]       = useState(false);
  const cascadeRestoredRef = useRef(false);

  const [formData, setFormData] = useState({
    firstName: '', middleName: '', lastName: '', shortName: '',
    dob: '', gender: '', nationality: 'Indian',
    email: '', mobile: '', telephone: '', familyContact: '',
    presentFlat: '', presentBuilding: '', presentStreet: '',
    presentArea: '', presentLandmark: '', presentCity: '',
    presentDistrict: '', presentState: '', presentPin: '', presentCountry: 'India',
    permanentFlat: '', permanentBuilding: '', permanentStreet: '',
    permanentArea: '', permanentLandmark: '', permanentCity: '',
    permanentDistrict: '', permanentState: '', permanentPin: '', permanentCountry: 'India',
    sameAsPresent: false,
    ssc_board: '', ssc_schoolName: '', ssc_yearOfPassing: '', ssc_percentage: '',
    ssc_ktCount: '0', ssc_ktDetails: [] as KTDetail[],
    hsc_board: '', hsc_collegeName: '', hsc_stream: '', hsc_yearOfPassing: '', hsc_percentage: '',
    hsc_ktCount: '0', hsc_ktDetails: [] as KTDetail[],
    diploma_degree: '', diploma_specialization: '', diploma_institute: '',
    diploma_yearOfPassing: '', diploma_percentage: '',
    diploma_ktCount: '0', diploma_ktDetails: [] as KTDetail[],
    grad_degree: '', grad_specialization: '', grad_university: '',
    grad_yearOfPassing: '', grad_percentage: '',
    grad_ktCount: '0', grad_ktDetails: [] as KTDetail[],
    postgrad_degree: '', postgrad_specialization: '', postgrad_university: '',
    postgrad_yearOfPassing: '', postgrad_percentage: '',
    postgrad_ktCount: '0', postgrad_ktDetails: [] as KTDetail[],
    educationRemark: '',
    qualification: '', discipline: '', percentage: '',
    occupationalStatus: '', jobOrganisation: '', jobDescription: '',
    jobDesignation: '', workingFromYears: '', workingFromMonths: '',
    totalOccupationYears: '', selfEmploymentDetails: '',
    trainingProgrammeId: '', trainingProgrammeName: '',
    trainingCategory: '', batchCode: '',
    idProofType: '',
    modeOfPayment: '',
    upiTransferConfirmed: false, upiTransferReference: '',
    paymentSubMethod: '', neftTransactionNumber: '', neftAmount: null as number | null,
    razorpayPaid: false, razorpayPaymentId: '', razorpayOrderId: '',
    razorpayAmount: null as number | null,
    termsAgreed: false, consentAcknowledged: false,
    experiencedConsentAcknowledged: false,
    consentData: { eligibility: '', qualification: '', candidateRemark: '' },
    consentChecks: [] as boolean[],
  });

  const set = (field: string, value: string | boolean) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (formData.modeOfPayment !== 'Loan') return;
    setFormData((prev) => ({ ...prev, modeOfPayment: '' }));
  }, [formData.modeOfPayment]);

  /* ── Load courses for training cascade ── */
  useEffect(() => {
    fetch('/api/public/courses')
      .then(r => r.json())
      .then(d => { if (d.success) setCourses(d.courses); })
      .catch(() => {});
  }, []);

  /* ── Once granted, saved marksheets/documents move onto the student's own
     record — load that list so "View" links keep working after grant too. ── */
  useEffect(() => {
    if (!realStudentId) { setStudentDocuments([]); return; }
    fetch(`/api/admission-activity/student/${realStudentId}/documents`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.documents)) setStudentDocuments(d.documents); })
      .catch(() => {});
  }, [realStudentId]);

  /* ── Resolve a "View" link for a saved marksheet/document by its key
     (e.g. 'ssc_marksheet') — prefers the post-grant student document, falls
     back to the inquiry-scoped upload for admissions not yet granted. ── */
  const savedAssetUrl = (key: string): string | undefined => {
    const studentDoc = studentDocuments.find(doc => doc.doc_name === `oa:${key}`);
    if (studentDoc && realStudentId) {
      const safePath = String(studentDoc.upload_image || '')
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/');
      return `/api/student-documents/${encodeURIComponent(realStudentId)}/${safePath}`;
    }
    return savedAdmissionAssetsDetail.find(a => a.key === key)?.url;
  };

  /* ── Restore cascade after data + courses ready ── */
  useEffect(() => {
    if (loading || cascadeRestoredRef.current || !courses.length) return;
    cascadeRestoredRef.current = true;

    const progId = formData.trainingProgrammeId ||
      String(courses.find(c => c.Course_Name === formData.trainingProgrammeName)?.Course_Id || '');
    const cat = formData.trainingCategory;
    if (!progId) return;

    if (!formData.trainingProgrammeId) {
      setFormData(prev => ({ ...prev, trainingProgrammeId: progId }));
    }

    const restore = async () => {
      setLoadingCategories(true);
      try {
        const cr = await fetch(`/api/public/batches?courseId=${progId}`);
        const cd = await cr.json();
        if (cd.success) setBatchCategories(cd.categories);
      } finally { setLoadingCategories(false); }

      if (cat) {
        setLoadingBatches(true);
        try {
          const br = await fetch(`/api/public/batches?courseId=${progId}&category=${encodeURIComponent(cat)}`);
          const bd = await br.json();
          if (bd.success) setAvailableBatches(bd.batches || []);
        } finally { setLoadingBatches(false); }
      }
    };
    restore().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, courses]);

  useEffect(() => { fetchData(); }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      setLoading(true);
      cascadeRestoredRef.current = false;
      const res = await fetch(`/api/online-admission/${studentId}`);
      if (!res.ok) throw new Error('Not found');
      const d = await res.json();

      setStatusLabel(d.statusLabel || 'Unknown');
      setStatusCategory(d.statusCategory || 'open');
      setStudentName([d.firstName, d.middleName, d.lastName].filter(Boolean).join(' '));
      setPayAtOfficeAudit(d.payAtOfficeAudit && typeof d.payAtOfficeAudit === 'object' ? d.payAtOfficeAudit : null);

      // `d.photo` is just a boolean flag (whether a photo was ever saved), not a URL —
      // resolve the real, viewable source: once granted, the student has their own
      // photo endpoint; before that, fall back to the inquiry-scoped saved upload.
      const realSid = d.studentId ? String(d.studentId) : '';
      setRealStudentId(realSid);
      const assetDetails: Array<{ key: string; isPhoto: boolean; url: string }> =
        Array.isArray(d.savedAdmissionAssetsDetail) ? d.savedAdmissionAssetsDetail : [];
      setSavedAdmissionAssetsDetail(assetDetails);
      if (realSid && Boolean(d.photo)) {
        setPhotoUrl(`/api/student-photo/${encodeURIComponent(realSid)}`);
      } else if (!realSid) {
        setPhotoUrl(assetDetails.find(a => a.isPhoto)?.url || '');
      } else {
        setPhotoUrl('');
      }

      const nd = (v: unknown) => {
        if (!v && v !== 0) return '';
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
          const [dd, mm, yyyy] = s.split('/');
          return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
        const dt = new Date(s);
        return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
      };

      setFormData({
        firstName: d.firstName || '', middleName: d.middleName || '',
        lastName: d.lastName || '', shortName: d.shortName || '',
        dob: nd(d.dob || d.DOB), gender: d.gender || '',
        nationality: d.nationality || 'Indian',
        email: d.email || '', mobile: d.mobile || '',
        telephone: d.telephone || '', familyContact: d.familyContact || '',
        presentFlat: d.presentFlat || '', presentBuilding: d.presentBuilding || '',
        presentStreet: d.presentStreet || d.presentAddress || '',
        presentArea: d.presentArea || '', presentLandmark: d.presentLandmark || '',
        presentCity: d.presentCity || '', presentDistrict: d.presentDistrict || '',
        presentState: d.presentState || '', presentPin: d.presentPin || '',
        presentCountry: d.presentCountry || 'India',
        permanentFlat: d.permanentFlat || '', permanentBuilding: d.permanentBuilding || '',
        permanentStreet: d.permanentStreet || d.permanentAddress || '',
        permanentArea: d.permanentArea || '', permanentLandmark: d.permanentLandmark || '',
        permanentCity: d.permanentCity || '', permanentDistrict: d.permanentDistrict || '',
        permanentState: d.permanentState || '', permanentPin: d.permanentPin || '',
        permanentCountry: d.permanentCountry || 'India',
        sameAsPresent: Boolean(d.sameAsPresent),
        ssc_board: d.ssc_board || '', ssc_schoolName: d.ssc_schoolName || '',
        ssc_yearOfPassing: d.ssc_yearOfPassing || '', ssc_percentage: d.ssc_percentage || '',
        ssc_ktCount: d.ssc_ktCount || '0', ssc_ktDetails: d.ssc_ktDetails || [],
        hsc_board: d.hsc_board || '', hsc_collegeName: d.hsc_collegeName || '',
        hsc_stream: d.hsc_stream || '', hsc_yearOfPassing: d.hsc_yearOfPassing || '',
        hsc_percentage: d.hsc_percentage || '',
        hsc_ktCount: d.hsc_ktCount || '0', hsc_ktDetails: d.hsc_ktDetails || [],
        diploma_degree: d.diploma_degree || '', diploma_specialization: d.diploma_specialization || '',
        diploma_institute: d.diploma_institute || '',
        diploma_yearOfPassing: d.diploma_yearOfPassing || '', diploma_percentage: d.diploma_percentage || '',
        diploma_ktCount: d.diploma_ktCount || '0', diploma_ktDetails: d.diploma_ktDetails || [],
        grad_degree: d.grad_degree || '', grad_specialization: d.grad_specialization || '',
        grad_university: d.grad_university || '',
        grad_yearOfPassing: d.grad_yearOfPassing || '', grad_percentage: d.grad_percentage || '',
        grad_ktCount: d.grad_ktCount || '0', grad_ktDetails: d.grad_ktDetails || [],
        postgrad_degree: d.postgrad_degree || '', postgrad_specialization: d.postgrad_specialization || '',
        postgrad_university: d.postgrad_university || '',
        postgrad_yearOfPassing: d.postgrad_yearOfPassing || '', postgrad_percentage: d.postgrad_percentage || '',
        postgrad_ktCount: d.postgrad_ktCount || '0', postgrad_ktDetails: d.postgrad_ktDetails || [],
        educationRemark: d.educationRemark || '',
        qualification: d.qualification || '',
        discipline: d.discipline || '',
        percentage: d.percentage ? String(d.percentage) : '',
        occupationalStatus: d.occupationalStatus || '',
        jobOrganisation: d.jobOrganisation || '', jobDescription: d.jobDescription || '',
        jobDesignation: d.jobDesignation || '', workingFromYears: d.workingFromYears || '',
        workingFromMonths: d.workingFromMonths || '',
        totalOccupationYears: d.totalOccupationYears || '',
        selfEmploymentDetails: d.selfEmploymentDetails || '',
        trainingProgrammeId: d.trainingProgrammeId ? String(d.trainingProgrammeId) : '',
        trainingProgrammeName: d.trainingProgrammeName || d.trainingProgram || '',
        trainingCategory: d.trainingCategory || '',
        batchCode: d.batchCode || '',
        idProofType: d.idProofType || '',
        modeOfPayment: d.modeOfPayment || '',
        upiTransferConfirmed: Boolean(d.upiTransferConfirmed),
        upiTransferReference: d.upiTransferReference || '',
        paymentSubMethod: d.paymentSubMethod || '',
        neftTransactionNumber: d.neftTransactionNumber || '',
        neftAmount: d.neftAmount != null ? Number(d.neftAmount) : null,
        razorpayPaid: Boolean(d.razorpayPaid),
        razorpayPaymentId: d.razorpayPaymentId || '',
        razorpayOrderId: d.razorpayOrderId || '',
        razorpayAmount: d.razorpayAmount != null ? Number(d.razorpayAmount) : null,
        termsAgreed: Boolean(d.termsAgreed),
        consentAcknowledged: Boolean(d.consentAcknowledged),
        experiencedConsentAcknowledged: Boolean(d.experiencedConsentAcknowledged),
        consentData: d.consentData || { eligibility: '', qualification: '', candidateRemark: '' },
        consentChecks: Array.isArray(d.consentChecks) ? d.consentChecks : [],
      });
    } catch {
      alert('Failed to load admission data');
      router.push('/dashboard/online-admission');
    } finally {
      setLoading(false);
    }
  };

  /* ── Photo upload ── */
  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    if (!realStudentId) {
      alert('This admission has not been granted yet — a photo can only be replaced once the applicant is a student.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) { alert('Photo must be smaller than 2 MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Only JPEG, PNG and WebP images are allowed'); return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`/api/admission-activity/student/${realStudentId}/photo`, {
        method: 'POST', body: fd,
      });
      const data = await res.json();
      if (res.ok && data.photoUrl) {
        setPhotoUrl(data.photoUrl);
      } else {
        alert(data.error || 'Photo upload failed');
      }
    } catch { alert('Photo upload failed'); }
    finally { setUploadingPhoto(false); }
  };

  /* ── Training cascade handlers ── */
  const handleProgrammeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value;
    const course = courses.find(c => String(c.Course_Id) === courseId);
    setFormData(prev => ({
      ...prev,
      trainingProgrammeId: courseId,
      trainingProgrammeName: course?.Course_Name || '',
      trainingCategory: '', batchCode: '',
    }));
    setBatchCategories([]); setAvailableBatches([]);
    if (!courseId) return;
    setLoadingCategories(true);
    try {
      const r = await fetch(`/api/public/batches?courseId=${courseId}`);
      const d = await r.json();
      if (d.success) setBatchCategories(d.categories);
    } finally { setLoadingCategories(false); }
  };

  const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setFormData(prev => ({ ...prev, trainingCategory: category, batchCode: '' }));
    setAvailableBatches([]);
    if (!category || !formData.trainingProgrammeId) return;
    setLoadingBatches(true);
    try {
      const r = await fetch(`/api/public/batches?courseId=${formData.trainingProgrammeId}&category=${encodeURIComponent(category)}`);
      const d = await r.json();
      if (d.success) setAvailableBatches(d.batches || []);
    } finally { setLoadingBatches(false); }
  };

  /* ── Submit action ── */
  const submitAction = async (action: 'accept' | 'update' | 'reject') => {
    if (action === 'reject' && !confirm('Reject this admission? Status will be set to Cancelled.')) return;
    setActionType(action); setSubmitting(true);
    try {
      // Strip read-only Razorpay fields — never let the admin form overwrite payment records
      const { razorpayPaid, razorpayPaymentId, razorpayOrderId, razorpayAmount, ...editableData } = formData;
      void razorpayPaid; void razorpayPaymentId; void razorpayOrderId; void razorpayAmount;
      const payload = action === 'reject'
        ? { statusAction: 'reject' }
        : { ...editableData, statusAction: action };
      const res = await fetch(`/api/online-admission/${studentId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (action === 'update') { alert('Admission updated successfully!'); await fetchData(); }
        else { router.push('/dashboard/online-admission'); }
      } else {
        alert(data.error || 'Action failed');
      }
    } catch { alert('An error occurred'); }
    finally { setSubmitting(false); setActionType(null); }
  };

  const openProgressModal = async () => {
    setShowProgressModal(true);
    setProgressLoading(true);
    try {
      const res = await fetch(`/api/online-admission/${studentId}?draft=1`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.draftMeta && typeof data.draftMeta === 'object') {
        setDraftProgressMeta(data.draftMeta);
      } else {
        setDraftProgressMeta(null);
      }
    } catch {
      setDraftProgressMeta(null);
    } finally {
      setProgressLoading(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied />;

  const Spinner = () => (
    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );

  /* ── Address block ── */
  const AddressBlock = ({ prefix, label }: { prefix: 'present' | 'permanent'; label?: string }) => {
    const f = formData as unknown as Record<string, string>;
    const p = prefix;
    return (
      <div className="space-y-2">
        {label && <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {[
            [`${p}Flat`, 'Flat / House No.'],
            [`${p}Building`, 'Building / Society'],
            [`${p}Street`, 'Street / Road'],
            [`${p}Area`, 'Area / Colony / Locality'],
            [`${p}Landmark`, 'Landmark'],
            [`${p}City`, 'City / Town'],
            [`${p}District`, 'District'],
          ].map(([field, label]) => (
            <div key={field}>
              <label className={lbl}>{label}</label>
              <input type="text" value={f[field]} onChange={e => set(field, e.target.value)} className={inp} />
            </div>
          ))}
          <div>
            <label className={lbl}>State</label>
            <select value={f[`${p}State`]} onChange={e => set(`${p}State`, e.target.value)} className={sel}>
              <option value="">— Select State —</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>PIN Code</label>
            <input type="text" value={f[`${p}Pin`]} onChange={e => set(`${p}Pin`, e.target.value)} className={inp} maxLength={6} />
          </div>
          <div>
            <label className={lbl}>Country</label>
            <input type="text" value={f[`${p}Country`]} onChange={e => set(`${p}Country`, e.target.value)} className={inp} />
          </div>
        </div>
      </div>
    );
  };

  /* ── Education sub-tabs ── */
  const eduTabs: EduTab[] = ['SSC', 'HSC', 'Diploma', 'Graduation', 'Post-Grad'];
  const eduFilled: Record<EduTab, boolean> = {
    'SSC':        !!(formData.ssc_board || formData.ssc_schoolName || formData.ssc_yearOfPassing),
    'HSC':        !!(formData.hsc_board || formData.hsc_collegeName || formData.hsc_yearOfPassing),
    'Diploma':    !!(formData.diploma_degree || formData.diploma_institute || formData.diploma_yearOfPassing),
    'Graduation': !!(formData.grad_degree || formData.grad_university || formData.grad_yearOfPassing),
    'Post-Grad':  !!(formData.postgrad_degree || formData.postgrad_university || formData.postgrad_yearOfPassing),
  };

  /* ── Tab completion indicators ── */
  const tabFilled: Record<MainTab, boolean> = {
    personal:     !!(formData.firstName && formData.lastName && formData.email && formData.mobile),
    academic:     Object.values(eduFilled).some(Boolean),
    occupational: !!formData.occupationalStatus,
    training:     !!(formData.trainingProgrammeId && formData.batchCode),
    payment:      !!formData.modeOfPayment,
    terms:        formData.termsAgreed,
  };

  const studentStepProgress = [
    {
      id: 1,
      label: 'Personal Info',
      done: Boolean(formData.firstName && formData.lastName && formData.email && formData.mobile && formData.dob),
    },
    {
      id: 2,
      label: 'Academic',
      done: Object.values(eduFilled).some(Boolean),
    },
    {
      id: 3,
      label: 'Occupational',
      done: Boolean(formData.occupationalStatus),
    },
    {
      id: 4,
      label: 'Training',
      done: Boolean(formData.trainingProgrammeId && formData.batchCode),
    },
    {
      id: 5,
      label: 'Payment Mode',
      done: Boolean(formData.modeOfPayment),
    },
    {
      id: 6,
      label: 'Terms & Consent',
      done: Boolean(formData.termsAgreed),
    },
  ];
  const completedStepCount = studentStepProgress.filter((s) => s.done).length;
  const studentProgressPercent = Math.round((completedStepCount / studentStepProgress.length) * 100);
  const lastAutosavedAt = typeof draftProgressMeta?.autosavedAt === 'string' ? draftProgressMeta.autosavedAt : null;
  const studentCurrentStep = Number(draftProgressMeta?.currentStep || 0);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4 pb-28">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/dashboard/online-admission')}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-base font-bold text-white">{studentName || 'Online Admission'}</h2>
              <p className="text-xs text-white/60 mt-0.5">Online Admissions › Review &amp; Edit</p>
            </div>
          </div>
          <span className={`shrink-0 mt-0.5 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusBadge(statusCategory)}`}>
            {statusLabel}
          </span>
        </div>

        {/* Section-completion strip */}
        <div className="mt-3.5 flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${studentProgressPercent}%` }} />
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-white/80">
            {completedStepCount}/{studentStepProgress.length} sections &middot; {studentProgressPercent}%
          </span>
        </div>
      </div>

      {/* ── Main tab bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <div className="flex min-w-max">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#2E3093] text-[#2E3093] bg-[#2E3093]/5'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tabFilled[tab.id] && (
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
                  <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TAB: Personal Info
      ══════════════════════════════════════════════ */}
      {activeTab === 'personal' && (
        <div className="space-y-4">

          {/* Photo */}
          <SectionCard title="Photograph" icon="camera">
            <div className="flex items-start gap-5">
              {/* Photo preview */}
              <div className="shrink-0">
                <div className="w-28 h-32 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center relative">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt="Student photo"
                      fill
                      className="object-cover"
                      sizes="112px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      <span className="text-[10px]">No photo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload controls */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-700">Passport Size Photo</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  JPEG, PNG or WebP · Max 2 MB · Passport size, white background
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                />
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#2E3093]/40 text-[#2E3093] bg-[#2E3093]/5 hover:bg-[#2E3093]/10 transition-colors disabled:opacity-50"
                >
                  {uploadingPhoto ? <Spinner /> : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  )}
                  {uploadingPhoto ? 'Uploading…' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
                {photoUrl && (
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#2A6BB5] hover:underline font-semibold"
                  >
                    View full size
                  </a>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Personal details */}
          <SectionCard title="Personal Details" icon="user">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
              <div>
                <label className={lbl}>First Name <span className="text-red-400">*</span></label>
                <input type="text" value={formData.firstName} onChange={e => set('firstName', e.target.value)} className={inp} required />
              </div>
              <div>
                <label className={lbl}>Middle Name</label>
                <input type="text" value={formData.middleName} onChange={e => set('middleName', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Last Name <span className="text-red-400">*</span></label>
                <input type="text" value={formData.lastName} onChange={e => set('lastName', e.target.value)} className={inp} required />
              </div>
              <div>
                <label className={lbl}>Short Name (ID Card)</label>
                <input type="text" value={formData.shortName} onChange={e => set('shortName', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Date of Birth <span className="text-red-400">*</span></label>
                <input type="date" value={formData.dob} onChange={e => set('dob', e.target.value)} className={inp} required />
              </div>
              <div>
                <label className={lbl}>Gender <span className="text-red-400">*</span></label>
                <select value={formData.gender} onChange={e => set('gender', e.target.value)} className={sel} required>
                  <option value="">— Select —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Nationality</label>
                <input type="text" value={formData.nationality} onChange={e => set('nationality', e.target.value)} className={inp} />
              </div>
            </div>
          </SectionCard>

          {/* Contact */}
          <SectionCard title="Contact Information" icon="phone">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
              <div>
                <label className={lbl}>Email Address <span className="text-red-400">*</span></label>
                <input type="email" value={formData.email} onChange={e => set('email', e.target.value)} className={inp} required />
              </div>
              <div>
                <label className={lbl}>Mobile Number <span className="text-red-400">*</span></label>
                <input type="tel" value={formData.mobile} onChange={e => set('mobile', e.target.value)} className={inp} required />
              </div>
              <div>
                <label className={lbl}>Telephone</label>
                <input type="tel" value={formData.telephone} onChange={e => set('telephone', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Family Contact</label>
                <input type="tel" value={formData.familyContact} onChange={e => set('familyContact', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>ID Proof Type</label>
                <select value={formData.idProofType} onChange={e => set('idProofType', e.target.value)} className={sel}>
                  <option value="">— Select —</option>
                  <option value="Aadhar Card">Aadhar Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving Licence">Driving Licence</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </SectionCard>

          {/* Address */}
          <SectionCard title="Address Details" icon="map">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AddressBlock prefix="present" label="Present Address" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Permanent Address</p>
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.sameAsPresent}
                      onChange={e => {
                        const same = e.target.checked;
                        setFormData(prev => ({
                          ...prev, sameAsPresent: same,
                          ...(same ? {
                            permanentFlat: prev.presentFlat,
                            permanentBuilding: prev.presentBuilding,
                            permanentStreet: prev.presentStreet,
                            permanentArea: prev.presentArea,
                            permanentLandmark: prev.presentLandmark,
                            permanentCity: prev.presentCity,
                            permanentDistrict: prev.presentDistrict,
                            permanentState: prev.presentState,
                            permanentPin: prev.presentPin,
                            permanentCountry: prev.presentCountry,
                          } : {})
                        }));
                      }}
                      className="rounded"
                    />
                    Same as present
                  </label>
                </div>
                <AddressBlock prefix="permanent" />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Academic
      ══════════════════════════════════════════════ */}
      {activeTab === 'academic' && (
        <SectionCard title="Academic Details" icon="cap">
          {/* Sub-tab bar */}
          <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
            {eduTabs.map(tab => (
              <button key={tab} type="button" onClick={() => setActiveEduTab(tab)}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-2 text-[11px] font-semibold transition-colors border-b-2 -mb-px ${
                  activeEduTab === tab
                    ? 'border-[#2E3093] text-[#2E3093]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {eduFilled[tab] && (
                  <span className="w-3 h-3 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
                    <svg className="w-1.5 h-1.5" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* SSC */}
          {activeEduTab === 'SSC' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={lbl}>Board <span className="text-red-400">*</span></label>
                  <select value={formData.ssc_board} onChange={e => set('ssc_board', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>School Name <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.ssc_schoolName} onChange={e => set('ssc_schoolName', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Year of Passing <span className="text-red-400">*</span></label>
                  <input type="number" value={formData.ssc_yearOfPassing} onChange={e => set('ssc_yearOfPassing', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Percentage / CGPA <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.ssc_percentage} onChange={e => set('ssc_percentage', e.target.value)} className={inp} />
                </div>
              </div>
              <DocumentViewLink label="SSC Marksheet" url={savedAssetUrl('ssc_marksheet')} />
              <KTTable ktCount={formData.ssc_ktCount} ktDetails={formData.ssc_ktDetails} />
            </div>
          )}

          {/* HSC */}
          {activeEduTab === 'HSC' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={lbl}>Board</label>
                  <select value={formData.hsc_board} onChange={e => set('hsc_board', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>College / Junior College Name</label>
                  <input type="text" value={formData.hsc_collegeName} onChange={e => set('hsc_collegeName', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Stream</label>
                  <select value={formData.hsc_stream} onChange={e => set('hsc_stream', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>Science</option><option>Commerce</option><option>Arts</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Year of Passing</label>
                  <input type="number" value={formData.hsc_yearOfPassing} onChange={e => set('hsc_yearOfPassing', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Percentage / CGPA</label>
                  <input type="text" value={formData.hsc_percentage} onChange={e => set('hsc_percentage', e.target.value)} className={inp} />
                </div>
              </div>
              <DocumentViewLink label="HSC Marksheet" url={savedAssetUrl('hsc_marksheet')} />
              <KTTable ktCount={formData.hsc_ktCount} ktDetails={formData.hsc_ktDetails} />
            </div>
          )}

          {/* Diploma */}
          {activeEduTab === 'Diploma' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={lbl}>Diploma Degree</label>
                  <select value={formData.diploma_degree} onChange={e => set('diploma_degree', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>Diploma</option><option>I.T.I.</option><option>Mech. Draughtsman</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Specialization</label>
                  <select value={formData.diploma_specialization} onChange={e => set('diploma_specialization', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>Mechanical</option><option>Chemical</option><option>Computers</option>
                    <option>Electrical</option><option>Civil</option><option>Electronics</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Institute Name</label>
                  <input type="text" value={formData.diploma_institute} onChange={e => set('diploma_institute', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Year of Passing</label>
                  <input type="number" value={formData.diploma_yearOfPassing} onChange={e => set('diploma_yearOfPassing', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Percentage / CGPA</label>
                  <input type="text" value={formData.diploma_percentage} onChange={e => set('diploma_percentage', e.target.value)} className={inp} />
                </div>
              </div>
              <DocumentViewLink label="Diploma Marksheet" url={savedAssetUrl('diploma_marksheet')} />
              <KTTable ktCount={formData.diploma_ktCount} ktDetails={formData.diploma_ktDetails} />
            </div>
          )}

          {/* Graduation */}
          {activeEduTab === 'Graduation' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={lbl}>Degree</label>
                  <select value={formData.grad_degree} onChange={e => set('grad_degree', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>B.SC</option><option>B.E.</option><option>B.TECH</option><option>B.COM</option>
                    <option>B.A.</option><option>BBA</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Specialization</label>
                  <select value={formData.grad_specialization} onChange={e => set('grad_specialization', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>Mechanical</option><option>Chemical</option><option>Petrochemical</option>
                    <option>Computers</option><option>Electrical</option><option>Civil</option>
                    <option>Electronics</option><option>Instrumentation</option><option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>University Name</label>
                  <input type="text" value={formData.grad_university} onChange={e => set('grad_university', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Year of Passing</label>
                  <input type="number" value={formData.grad_yearOfPassing} onChange={e => set('grad_yearOfPassing', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Percentage / CGPA</label>
                  <input type="text" value={formData.grad_percentage} onChange={e => set('grad_percentage', e.target.value)} className={inp} />
                </div>
              </div>
              <DocumentViewLink label="Graduation Marksheet" url={savedAssetUrl('graduation_marksheet')} />
              <KTTable ktCount={formData.grad_ktCount} ktDetails={formData.grad_ktDetails} />
            </div>
          )}

          {/* Post-Graduation */}
          {activeEduTab === 'Post-Grad' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label className={lbl}>Degree</label>
                  <select value={formData.postgrad_degree} onChange={e => set('postgrad_degree', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>M.E.</option><option>M.TECH</option><option>M.SC</option>
                    <option>MBA</option><option>M.COM</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Specialization</label>
                  <select value={formData.postgrad_specialization} onChange={e => set('postgrad_specialization', e.target.value)} className={sel}>
                    <option value="">— Select —</option>
                    <option>Mechanical</option><option>Chemical</option><option>Computers</option>
                    <option>Electrical</option><option>Civil</option><option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>University Name</label>
                  <input type="text" value={formData.postgrad_university} onChange={e => set('postgrad_university', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Year of Passing</label>
                  <input type="number" value={formData.postgrad_yearOfPassing} onChange={e => set('postgrad_yearOfPassing', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Percentage / CGPA</label>
                  <input type="text" value={formData.postgrad_percentage} onChange={e => set('postgrad_percentage', e.target.value)} className={inp} />
                </div>
              </div>
              <DocumentViewLink label="Post-Graduation Marksheet" url={savedAssetUrl('postgraduation_marksheet')} />
              <KTTable ktCount={formData.postgrad_ktCount} ktDetails={formData.postgrad_ktDetails} />
            </div>
          )}

          {/* Education remarks */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <label className={lbl}>Education Remarks</label>
            <textarea value={formData.educationRemark} onChange={e => set('educationRemark', e.target.value)} rows={2} className={txta} />
          </div>

          {/* Education Summary — synced to student record on accept */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Education Summary (synced to student on accept)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2">
              <div>
                <label className={lbl}>Highest Qualification</label>
                <select value={formData.qualification} onChange={e => set('qualification', e.target.value)} className={sel}>
                  <option value="">— Select —</option>
                  <option>SSC</option><option>HSC</option><option>Diploma</option>
                  <option>Graduate</option><option>Post Graduate</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Discipline / Stream</label>
                <input type="text" value={formData.discipline} onChange={e => set('discipline', e.target.value)} className={inp} placeholder="e.g. Mechanical, Computers" />
              </div>
              <div>
                <label className={lbl}>Overall Percentage</label>
                <input type="text" value={formData.percentage} onChange={e => set('percentage', e.target.value)} className={inp} placeholder="e.g. 72.5" />
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Occupational
      ══════════════════════════════════════════════ */}
      {activeTab === 'occupational' && (
        <SectionCard title="Occupational Information" icon="briefcase">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
            <div>
              <label className={lbl}>Occupational Status</label>
              <select value={formData.occupationalStatus} onChange={e => set('occupationalStatus', e.target.value)} className={sel}>
                <option value="">— Select —</option>
                <option value="Student">Student</option>
                <option value="Employee">Employee</option>
                <option value="Self Employee">Self Employee</option>
              </select>
            </div>

            {formData.occupationalStatus === 'Employee' && (<>
              <div>
                <label className={lbl}>Job Organisation</label>
                <input type="text" value={formData.jobOrganisation} onChange={e => set('jobOrganisation', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Designation</label>
                <input type="text" value={formData.jobDesignation} onChange={e => set('jobDesignation', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Working From (Years)</label>
                <input type="number" min={0} value={formData.workingFromYears} onChange={e => set('workingFromYears', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Working From (Months)</label>
                <input type="number" min={0} max={11} value={formData.workingFromMonths} onChange={e => set('workingFromMonths', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Total Experience (Years)</label>
                <input type="text" value={formData.totalOccupationYears} readOnly className={`${inp} bg-gray-50`} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={lbl}>Job Description</label>
                <textarea value={formData.jobDescription} onChange={e => set('jobDescription', e.target.value)} rows={3} className={txta} />
              </div>
            </>)}

            {formData.occupationalStatus === 'Self Employee' && (
              <div className="col-span-2 md:col-span-3">
                <label className={lbl}>Business Details</label>
                <textarea value={formData.selfEmploymentDetails} onChange={e => set('selfEmploymentDetails', e.target.value)} rows={3} className={txta} />
              </div>
            )}

            {formData.occupationalStatus && !['Student', 'Employee', 'Self Employee'].includes(formData.occupationalStatus) && (<>
              <div>
                <label className={lbl}>Organisation</label>
                <input type="text" value={formData.jobOrganisation} onChange={e => set('jobOrganisation', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Designation</label>
                <input type="text" value={formData.jobDesignation} onChange={e => set('jobDesignation', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Total Experience (Years)</label>
                <input type="text" value={formData.totalOccupationYears} onChange={e => set('totalOccupationYears', e.target.value)} className={inp} />
              </div>
            </>)}
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Training
      ══════════════════════════════════════════════ */}
      {activeTab === 'training' && (
        <SectionCard title="Training Programme" icon="training">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2">
            <div>
              <label className={lbl}>Training Programme</label>
              <select value={formData.trainingProgrammeId} onChange={handleProgrammeChange} className={sel}>
                <option value="">— Select Programme —</option>
                {courses.map(c => (
                  <option key={c.Course_Id} value={String(c.Course_Id)}>{c.Course_Name}</option>
                ))}
              </select>
              {formData.trainingProgrammeName && !formData.trainingProgrammeId && (
                <p className="text-[11px] text-amber-600 mt-0.5">Saved: {formData.trainingProgrammeName}</p>
              )}
            </div>
            <div>
              <label className={lbl}>
                Category {loadingCategories && <span className="text-[10px] text-gray-400 ml-1">loading…</span>}
              </label>
              <select
                value={formData.trainingCategory}
                onChange={handleCategoryChange}
                disabled={!batchCategories.length}
                className={`${sel} disabled:opacity-50 disabled:bg-gray-50`}
              >
                <option value="">— Select Category —</option>
                {batchCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              {formData.trainingCategory && !batchCategories.includes(formData.trainingCategory) && (
                <p className="text-[11px] text-amber-600 mt-0.5">Saved: {formData.trainingCategory}</p>
              )}
            </div>
            <div>
              <label className={lbl}>
                Batch Code {loadingBatches && <span className="text-[10px] text-gray-400 ml-1">loading…</span>}
              </label>
              <select
                value={formData.batchCode}
                onChange={e => set('batchCode', e.target.value)}
                disabled={!availableBatches.length}
                className={`${sel} disabled:opacity-50 disabled:bg-gray-50`}
              >
                <option value="">— Select Batch —</option>
                {availableBatches.map(b => (
                  <option key={b.batchCode} value={b.batchCode}>
                    {b.batchCode}{b.timings ? ` (${b.timings})` : ''}
                  </option>
                ))}
              </select>
              {formData.batchCode && !availableBatches.find(b => b.batchCode === formData.batchCode) && (
                <p className="text-[11px] text-amber-600 mt-0.5">Saved: {formData.batchCode}</p>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Payment
      ══════════════════════════════════════════════ */}
      {activeTab === 'payment' && (
        <SectionCard title="Mode of Payment" icon="card">
          <p className="text-xs text-gray-500 mb-5">Payment preference selected by the candidate during admission. Pay at Office can only be set here by staff.</p>

          {!formData.modeOfPayment && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 mb-4">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              No payment mode was selected by the candidate.
            </div>
          )}
          {formData.modeOfPayment && !PAYMENT_MODE_VALUES.includes(formData.modeOfPayment) && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 mb-4">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Saved value &ldquo;{formData.modeOfPayment}&rdquo; doesn&apos;t match any option below.
            </div>
          )}

          {/* Payment plan */}
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Payment Plan</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
            {PAYMENT_PLAN_OPTIONS.map(opt => (
              <PaymentOptionCard key={opt.value} opt={opt} selected={formData.modeOfPayment === opt.value} onSelect={() => set('modeOfPayment', opt.value)} />
            ))}
          </div>

          {/* Payment channel */}
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Payment Channel</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PAYMENT_CHANNEL_OPTIONS.map(opt => (
              <PaymentOptionCard key={opt.value} opt={opt} selected={formData.modeOfPayment === opt.value} onSelect={() => set('modeOfPayment', opt.value)} />
            ))}
          </div>

          {/* Payment detail panels — shown when relevant to the saved data */}
          {(formData.modeOfPayment === 'Pay at Office'
            || formData.modeOfPayment === 'Direct UPI Transfer'
            || formData.upiTransferConfirmed || formData.upiTransferReference
            || formData.neftTransactionNumber
            || formData.razorpayPaid || formData.razorpayPaymentId) && (
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Payment Details</p>

              {formData.modeOfPayment === 'Pay at Office' && (
                <PaymentDetailPanel tone="amber" icon="office" title="Pay at Office — Staff Override">
                  {payAtOfficeAudit?.enabledAt ? (
                    <>
                      Enabled by{' '}
                      <span className="font-semibold">{payAtOfficeAudit.enabledByName || `User ${payAtOfficeAudit.enabledByUserId || ''}`.trim()}</span>
                      {payAtOfficeAudit.enabledByEmail ? ` (${payAtOfficeAudit.enabledByEmail})` : ''}
                      {' '}on {new Date(payAtOfficeAudit.enabledAt).toLocaleString('en-IN')}.
                    </>
                  ) : (
                    'Audit will be recorded when you save this update.'
                  )}
                </PaymentDetailPanel>
              )}

              {formData.modeOfPayment === 'Direct UPI Transfer' && (
                <PaymentDetailPanel tone="sky" icon="qr" title="Direct UPI Transfer">
                  <div className="flex items-center gap-3 mt-1.5">
                    <Image
                      src="/phot.jpg"
                      alt="Direct UPI Transfer QR"
                      width={72}
                      height={90}
                      className="rounded border border-slate-200 shrink-0"
                    />
                    <span className="text-[11px]">Account Ref: 037326012440007 | 54972698</span>
                  </div>
                </PaymentDetailPanel>
              )}

              {(formData.upiTransferConfirmed || formData.upiTransferReference) && (
                <PaymentDetailPanel tone="sky" icon="check" title="QR / UPI Payment">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${formData.upiTransferConfirmed ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <span>{formData.upiTransferConfirmed ? 'Student confirmed payment via QR' : 'Payment not yet confirmed'}</span>
                  </div>
                  {formData.upiTransferReference && (
                    <div className="mt-1">
                      <span className="font-semibold">UTR / Reference: </span>
                      <span className="font-mono">{formData.upiTransferReference}</span>
                    </div>
                  )}
                </PaymentDetailPanel>
              )}

              {formData.neftTransactionNumber && (
                <PaymentDetailPanel tone="emerald" icon="bank" title="NEFT Payment">
                  {formData.neftAmount != null && (
                    <div>
                      <span className="font-semibold">Amount: </span>
                      <span>₹{Number(formData.neftAmount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="font-semibold">Transaction Number: </span>
                    <span className="font-mono">{formData.neftTransactionNumber}</span>
                  </div>
                </PaymentDetailPanel>
              )}

              {(formData.razorpayPaid || formData.razorpayPaymentId) && (
                <PaymentDetailPanel tone="emerald" icon="card" title="Online Payment (Razorpay)">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mt-1">
                    <div>
                      <p className="font-semibold text-gray-500 mb-0.5">Status</p>
                      <p className={`font-bold ${formData.razorpayPaid ? 'text-emerald-700' : 'text-amber-600'}`}>
                        {formData.razorpayPaid ? 'Paid' : 'Not confirmed'}
                      </p>
                    </div>
                    {formData.razorpayAmount != null && (
                      <div>
                        <p className="font-semibold text-gray-500 mb-0.5">Amount</p>
                        <p className="font-bold text-gray-800">₹{Number(formData.razorpayAmount).toLocaleString('en-IN')}</p>
                      </div>
                    )}
                    {formData.razorpayPaymentId && (
                      <div className="md:col-span-2">
                        <p className="font-semibold text-gray-500 mb-0.5">Payment ID</p>
                        <p className="font-mono text-gray-700 break-all">{formData.razorpayPaymentId}</p>
                      </div>
                    )}
                    {formData.razorpayOrderId && (
                      <div className="md:col-span-2">
                        <p className="font-semibold text-gray-500 mb-0.5">Order ID</p>
                        <p className="font-mono text-gray-700 break-all">{formData.razorpayOrderId}</p>
                      </div>
                    )}
                  </div>
                </PaymentDetailPanel>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════
          TAB: Terms & Consent
      ══════════════════════════════════════════════ */}
      {activeTab === 'terms' && (
        <div className="space-y-4">
          {/* Summary badges */}
          <SectionCard title="Agreement Status" icon="shield">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { label: 'Terms & Conditions', value: formData.termsAgreed },
                { label: 'Student Eligibility Consent', value: formData.consentAcknowledged },
                { label: 'Experienced Candidate Consent', value: formData.experiencedConsentAcknowledged },
              ].map(item => (
                <div
                  key={item.label}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 ${
                    item.value ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    item.value ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {item.value ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 leading-tight">{item.label}</p>
                    <p className={`text-[10.5px] font-bold mt-1 ${item.value ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {item.value ? 'Agreed' : 'Not agreed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Consent checks */}
          {formData.consentChecks.length > 0 && (
            <SectionCard title="Consent Checklist" icon="clipboard">
              <div className="space-y-1.5">
                {formData.consentChecks.map((checked, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      checked ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-600">Consent item {i + 1}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Consent data */}
          {(formData.consentData?.eligibility || formData.consentData?.qualification || formData.consentData?.candidateRemark) && (
            <SectionCard title="Consent Details" icon="doc">
              <div className="space-y-2">
                {formData.consentData.eligibility && (
                  <div>
                    <p className={lbl}>Eligibility</p>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded px-2.5 py-1.5 border border-gray-200">
                      {formData.consentData.eligibility}
                    </p>
                  </div>
                )}
                {formData.consentData.qualification && (
                  <div>
                    <p className={lbl}>Qualification</p>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded px-2.5 py-1.5 border border-gray-200">
                      {formData.consentData.qualification}
                    </p>
                  </div>
                )}
                {formData.consentData.candidateRemark && (
                  <div>
                    <p className={lbl}>Candidate Remark</p>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded px-2.5 py-1.5 border border-gray-200 italic">
                      &ldquo;{formData.consentData.candidateRemark}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {!formData.termsAgreed && !formData.consentAcknowledged && !formData.experiencedConsentAcknowledged && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-700">No consent or terms agreement was recorded for this candidate.</p>
            </div>
          )}
        </div>
      )}

      {showProgressModal && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Student Progress</h3>
                <p className="text-[11px] text-slate-500">Completion snapshot from latest saved draft</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Overall completion</span>
                  <span className="text-xs font-bold text-[#2E3093]">{completedStepCount}/{studentStepProgress.length} ({studentProgressPercent}%)</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#2E3093] to-[#2A6BB5]" style={{ width: `${studentProgressPercent}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span>Current step: {studentCurrentStep >= 1 && studentCurrentStep <= 6 ? studentCurrentStep : 'Unknown'}</span>
                  <span>•</span>
                  <span>Last autosave: {lastAutosavedAt ? new Date(lastAutosavedAt).toLocaleString('en-IN') : 'Not available'}</span>
                </div>
              </div>

              {progressLoading ? (
                <p className="text-xs text-slate-500">Loading latest draft metadata…</p>
              ) : (
                <div className="space-y-2">
                  {studentStepProgress.map((step) => (
                    <div key={step.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-xs font-medium text-slate-700">Step {step.id}: {step.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {step.done ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg px-4 py-3 flex items-center justify-between gap-3 md:left-64">
        <button
          type="button"
          disabled={submitting}
          onClick={() => submitAction('reject')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all disabled:opacity-50"
        >
          {submitting && actionType === 'reject' ? <Spinner /> : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          Reject
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openProgressModal()}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
          >
            Student Progress
          </button>
          <button type="button" onClick={() => router.push('/dashboard/online-admission')}
            className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submitAction('update')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-white hover:bg-gray-50 text-[#2E3093] border border-[#2E3093]/40 transition-all disabled:opacity-50"
          >
            {submitting && actionType === 'update' ? <Spinner /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            Update
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submitAction('accept')}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            {submitting && actionType === 'accept' ? <Spinner /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
