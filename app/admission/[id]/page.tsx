'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';

const STEPS = [
  { id: 1, title: 'Personal Info', icon: 'fa-user', description: 'Basic personal details' },
  { id: 2, title: 'Academic', icon: 'fa-graduation-cap', description: 'Educational background and documents' },
  { id: 3, title: 'Occupational Info', icon: 'fa-briefcase', description: 'Current occupational status' },
  { id: 4, title: 'Training', icon: 'fa-chalkboard-teacher', description: 'Training programme details' },
  { id: 5, title: 'Medical History', icon: 'fa-notes-medical', description: 'Medical background declaration' },
  { id: 6, title: 'Terms & Conditions', icon: 'fa-scroll', description: 'Read & accept terms' },
  { id: 7, title: 'Mode of Payment', icon: 'fa-credit-card', description: 'Select your payment method' },
];

const STEP_GUIDANCE: Record<number, { focus: string; tip: string }> = {
  1: {
    focus: 'Enter the student’s core identity and contact details first. Address fields can be completed in the same pass.',
    tip: 'If the present and permanent address are the same, use the toggle to avoid repeating the full address.',
  },
  2: {
    focus: 'Add the education records the student has completed and upload the matching documents in the same tab.',
    tip: 'Keep only the applicable qualification sections filled so the review team sees a clean academic trail.',
  },
  3: {
    focus: 'Capture the current occupation exactly as it should appear in the student master and counselling records.',
    tip: 'Experienced-candidate consent is shown here only when the work profile requires it.',
  },
  4: {
    focus: 'Choose programme, category, and batch in order so fee and consent checks resolve correctly.',
    tip: 'Once a batch is selected, the linked fee details are pulled automatically from the current database.',
  },
  5: {
    focus: 'Confirm the medical declaration before reviewing the admission terms.',
    tip: 'If there is medical history, add a clear note so the review team has the required context.',
  },
  6: {
    focus: 'Review the declarations and accept the Terms & Conditions before moving on to payment.',
    tip: 'Read and acknowledge each section — payment unlocks only after the terms are accepted.',
  },
  7: {
    focus: 'Pick the payment mode and complete payment to finish the application.',
    tip: 'This is the final step — submit the application once payment is done.',
  },
};

const stepEnterStyle = { animation: 'stepEnter 320ms ease-out' };


// One Time Membership Fee - Sitians Alumni Association — mandatory for every training course
const ALUMNI_MEMBERSHIP_FEE = 899;

type PaymentSubMethod = '' | 'razorpay' | 'qr' | 'neft';

const NEFT_BANK_DETAILS = {
  bank: 'Axis Bank Ltd.',
  address: 'City Survey No. 841 to 846, "Florence" Florence CHS. LTD. Vakola, Mumbai - 400 055',
  accountNumber: '911020002988600',
  ifsCode: 'UTIB0001244',
};

// Training Program Eligibility Map (based on educational background)
const COURSE_ELIGIBILITY: { [key: string]: string[] } = {
  'Piping Engineering': ['Mechanical', 'Production', 'Chemical', 'Petrochemical'],
  'Mechanical Design of Process Equipment': ['Mechanical', 'Production'],
  'Air Conditioning System Design (HVAC)': ['Mechanical', 'Production'],
  'MEP (Mechanical Electrical and Plumbing)': ['Mechanical', 'Production', 'Eletrical', 'Electrical'],
  'Rotating Equipment': ['Mechanical', 'Production'],
  'Offshore Engineering': ['Mechanical', 'Production', 'Chemical', 'Petrochemical'],
  'Process Engineering': ['Chemical', 'Petrochemical'],
  'Electrical System Design': ['Eletrical', 'Electrical'],
  'Structural Engineering': ['Civil'],
  'Process Instrumentation and Control': ['Instrumentation', 'Electronics & Tele-Communication'],
  'Piping Design and Drafting': ['I.T.I.', 'Diploma', 'Mech. Draughtsman'],
  'HVAC Design and Drafting': ['I.T.I.', 'Diploma', 'Mech. Draughtsman'],
  'Engineering Design and Drafting': ['I.T.I.', 'Diploma', 'HSC', 'H.S.C.', 'Arts', 'Commerce', 'Science'],
};



export default function PublicAdmissionFormPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params.id as string;
  const isPreviewTermsMode = searchParams.get('previewTerms') === '1';
  const forcedStep = Number(searchParams.get('step') || '0');
  const resetDraftToken = searchParams.get('resetDraft') || '';

  const [submitted, setSubmitted] = useState(false);
  const [submittedStudentId, setSubmittedStudentId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Razorpay payment state
  const [razorpayPaid, setRazorpayPaid] = useState(false);
  const [razorpayPaymentId, setRazorpayPaymentId] = useState('');
  const [razorpayOrderId, setRazorpayOrderId] = useState('');
  const [razorpaySignature, setRazorpaySignature] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [payAtOfficeVerified, setPayAtOfficeVerified] = useState(false);
  const [upiTransferConfirmed, setUpiTransferConfirmed] = useState(false);
  const [upiTransferReference, setUpiTransferReference] = useState('');
  const [neftTransactionNumber, setNeftTransactionNumber] = useState('');
  const [paymentSubMethod, setPaymentSubMethod] = useState<PaymentSubMethod>('');
  const [showPayAtOfficeModal, setShowPayAtOfficeModal] = useState(false);
  const [payAtOfficePassword, setPayAtOfficePassword] = useState('');
  const [payAtOfficeVerifying, setPayAtOfficeVerifying] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showAddUniversityModal, setShowAddUniversityModal] = useState(false);
  const [newUniversityData, setNewUniversityData] = useState({ name: '', country: '', city: '', fieldType: 'grad' });
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [consentChecks, setConsentChecks] = useState<boolean[]>(Array(5).fill(false));
  const [consentData, setConsentData] = useState({ eligibility: '', qualification: '', candidateRemark: '' });
  const [experiencedConsentAcknowledged, setExperiencedConsentAcknowledged] = useState(false);
  const [consentType, setConsentType] = useState<'student' | 'experienced'>('student');
  const allConsentChecked = consentChecks.every(Boolean);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [sectionChecks, setSectionChecks] = useState<boolean[]>(Array(15).fill(false));
  const toggleSection = (idx: number) => setSectionChecks(prev => prev.map((v, i) => i === idx ? !v : v));
  const checkedCount = sectionChecks.filter(Boolean).length;
  const allSectionsChecked = checkedCount === 15;
  const [academicTab, setAcademicTab] = useState<'ssc' | 'hsc' | 'diploma' | 'graduation' | 'postgrad'>('ssc');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [manualSaving, setManualSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKey = `sit_admission_draft_${studentId}`;

  useEffect(() => {
    if (!isPreviewTermsMode) return;
    if (forcedStep >= 1 && forcedStep <= 7) {
      setCurrentStep(forcedStep);
    }
  }, [isPreviewTermsMode, forcedStep]);

  // Training programme cascade
  const [courses, setCourses] = useState<{ Course_Id: number; Course_Name: string }[]>([]);
  const [batchCategories, setBatchCategories] = useState<string[]>([]);
  const [availableBatches, setAvailableBatches] = useState<{ batchCode: string; timings: string | null; totalFees: number | null; feesFullPayment: number | null; feesInstallment: number | null }[]>([]);
  const [batchFees, setBatchFees] = useState<number | null>(null);
  const [batchFeesFullPayment, setBatchFeesFullPayment] = useState<number | null>(null);
  const [batchFeesInstallment, setBatchFeesInstallment] = useState<number | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [formData, setFormData] = useState({
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
    presentFlat: '',
    presentBuilding: '',
    presentStreet: '',
    presentArea: '',
    presentLandmark: '',
    presentCity: '',
    presentDistrict: '',
    presentState: '',
    presentPin: '',
    presentCountry: 'India',
    permanentFlat: '',
    permanentBuilding: '',
    permanentStreet: '',
    permanentArea: '',
    permanentLandmark: '',
    permanentCity: '',
    permanentDistrict: '',
    permanentState: '',
    permanentPin: '',
    permanentCountry: 'India',
    sameAsPresent: false,
    photoFile: null as File | null,
    ssc_board: '',
    ssc_schoolName: '',
    ssc_yearOfPassing: '',
    ssc_percentage: '',
    ssc_marksheetFile: null as File | null,
    hsc_board: '',
    hsc_collegeName: '',
    hsc_stream: '',
    hsc_yearOfPassing: '',
    hsc_percentage: '',
    hsc_marksheetFile: null as File | null,
    
    diploma_degree: '',
    diploma_specialization: '',
    diploma_institute: '',
    diploma_yearOfPassing: '',
    diploma_percentage: '',
    diploma_marksheetFile: null as File | null,
    
    grad_degree: '',
    grad_specialization: '',
    grad_university: '',
    grad_yearOfPassing: '',
    grad_percentage: '',
    grad_marksheetFile: null as File | null,
    
    postgrad_degree: '',
    postgrad_specialization: '',
    postgrad_university: '',
    postgrad_yearOfPassing: '',
    postgrad_percentage: '',
    postgrad_marksheetFile: null as File | null,
    
    // KT Details - Per Education Level
    ssc_ktCount: '0',
    ssc_ktDetails: [] as Array<{
      subjectName: string;
      year: string;
      semester: string;
      clearedYear: string;
      marks: string;
      marksheetFile: File | null;
    }>,
    
    hsc_ktCount: '0',
    hsc_ktDetails: [] as Array<{
      subjectName: string;
      year: string;
      semester: string;
      clearedYear: string;
      marks: string;
      marksheetFile: File | null;
    }>,
    
    diploma_ktCount: '0',
    diploma_ktDetails: [] as Array<{
      subjectName: string;
      year: string;
      semester: string;
      clearedYear: string;
      marks: string;
      marksheetFile: File | null;
    }>,
    
    grad_ktCount: '0',
    grad_ktDetails: [] as Array<{
      subjectName: string;
      year: string;
      semester: string;
      clearedYear: string;
      marks: string;
      marksheetFile: File | null;
    }>,
    
    postgrad_ktCount: '0',
    postgrad_ktDetails: [] as Array<{
      subjectName: string;
      year: string;
      semester: string;
      clearedYear: string;
      marks: string;
      marksheetFile: File | null;
    }>,
    
    educationRemark: '',
    occupationalStatus: '',
    jobOrganisation: '',
    jobDescription: '',
    jobDesignation: '',
    workingFromYears: '',
    workingFromMonths: '',
    totalOccupationYears: '',
    selfEmploymentDetails: '',
    // Medical history — '', 'yes' or 'no'; description only when 'yes'
    hasMedicalHistory: '',
    medicalHistoryDescription: '',
    trainingProgrammeId: '',
    trainingProgrammeName: '',
    trainingCategory: '',
    batchCode: '',
    modeOfPayment: '',
    termsAgreed: false,
  });

  useEffect(() => {
    fetchStudentData();
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (formData.modeOfPayment !== 'Loan') return;
    setFormData((prev) => ({ ...prev, modeOfPayment: '' }));
  }, [formData.modeOfPayment]);

  // Restore draft from localStorage/server after server data loads
  useEffect(() => {
    if (loading) return;
    type DraftProgress = {
      currentStep?: number;
      completedSteps?: unknown[];
      sectionChecks?: unknown[];
      consentChecks?: unknown[];
      consentAcknowledged?: boolean;
      experiencedConsentAcknowledged?: boolean;
      razorpayPaid?: boolean;
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
      razorpaySignature?: string;
      payAtOfficeVerified?: boolean;
      upiTransferConfirmed?: boolean;
      upiTransferReference?: string;
      neftTransactionNumber?: string;
      paymentSubMethod?: PaymentSubMethod;
      consentData?: {
        eligibility?: string;
        qualification?: string;
        candidateRemark?: string;
      };
      autosavedAt?: string;
    };

    type DraftPayload = Partial<typeof formData> & {
      __draftProgress?: DraftProgress;
    };

    const normalizeDateForInput = (v: unknown) => {
      if (!v && v !== 0) return '';
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split('/');
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      const dt = new Date(s);
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
      return '';
    };

    const restoreDraft = async () => {
      let localData: DraftPayload | null = null;
      let localSavedAt = 0;
      let localProgress: DraftProgress | null = null;

      try {
        if (resetDraftToken) {
          localStorage.removeItem(draftKey);
        }
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { data?: DraftPayload; progress?: DraftProgress; savedAt?: number };
          localData = parsed?.data ?? null;
          localProgress = parsed?.progress ?? null;
          localSavedAt = Number(parsed?.savedAt || 0);
        }
      } catch {
        localData = null;
      }

      let serverData: DraftPayload | null = null;
      let serverProgress: DraftProgress | null = null;
      let serverSavedAt = 0;
      try {
        const res = await fetch(`/api/online-admission/${encodeURIComponent(studentId)}?draft=1`);
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (res.ok && data?.draft && typeof data.draft === 'object') {
          serverData = data.draft as DraftPayload;
          serverProgress = (data.draftMeta as DraftProgress | null) ?? ((serverData as DraftPayload).__draftProgress ?? null);
          // A finally-submitted form has no __draftProgress; fall back to its
          // submittedAt timestamp so it still wins over a stale/absent local draft.
          const submittedAt = (serverData as { submittedAt?: unknown }).submittedAt;
          serverSavedAt = serverProgress?.autosavedAt
            ? Date.parse(String(serverProgress.autosavedAt))
            : (submittedAt ? Date.parse(String(submittedAt)) : 0);
        }
      } catch {
        serverData = null;
      }

      // Prefer whichever source is newer, but always fall back to the one that
      // exists — so a submitted form (server data, no local draft) still pre-fills.
      const useServer = serverData ? (!localData || serverSavedAt >= localSavedAt) : false;
      const bestData = useServer ? serverData : localData;
      const bestProgress = useServer ? serverProgress : localProgress;
      if (!bestData) return;

      const dataWithoutMeta = Object.fromEntries(
        Object.entries(bestData).filter(([k]) => k !== '__draftProgress')
      ) as Partial<typeof formData>;
      const patched = { ...dataWithoutMeta, dob: normalizeDateForInput(bestData.dob) };
      setFormData(prev => ({ ...prev, ...patched }));
      if (bestProgress && Number.isFinite(Number(bestProgress.currentStep))) {
        const s = Number(bestProgress.currentStep);
        if (s >= 1 && s <= 7) setCurrentStep(s);
      }
      if (Array.isArray(bestProgress?.completedSteps)) {
        setCompletedSteps(bestProgress.completedSteps.filter((n: unknown) => Number.isFinite(Number(n))).map((n: unknown) => Number(n)));
      }
      if (Array.isArray(bestProgress?.sectionChecks) && bestProgress.sectionChecks.length === 15) {
        setSectionChecks(bestProgress.sectionChecks.map(Boolean));
      }
      if (Array.isArray(bestProgress?.consentChecks) && bestProgress.consentChecks.length === 5) {
        setConsentChecks(bestProgress.consentChecks.map(Boolean));
      }
      if (typeof bestProgress?.consentAcknowledged === 'boolean') {
        setConsentAcknowledged(bestProgress.consentAcknowledged);
      }
      if (typeof bestProgress?.experiencedConsentAcknowledged === 'boolean') {
        setExperiencedConsentAcknowledged(bestProgress.experiencedConsentAcknowledged);
      }
      if (typeof bestProgress?.razorpayPaid === 'boolean') {
        setRazorpayPaid(bestProgress.razorpayPaid);
      }
      if (typeof bestProgress?.razorpayPaymentId === 'string') {
        setRazorpayPaymentId(bestProgress.razorpayPaymentId);
      }
      if (typeof bestProgress?.razorpayOrderId === 'string') {
        setRazorpayOrderId(bestProgress.razorpayOrderId);
      }
      if (typeof bestProgress?.razorpaySignature === 'string') {
        setRazorpaySignature(bestProgress.razorpaySignature);
      }
      if (typeof bestProgress?.payAtOfficeVerified === 'boolean') {
        setPayAtOfficeVerified(bestProgress.payAtOfficeVerified);
      }
      if (typeof bestProgress?.upiTransferConfirmed === 'boolean') {
        setUpiTransferConfirmed(bestProgress.upiTransferConfirmed);
      }
      if (typeof bestProgress?.upiTransferReference === 'string') {
        setUpiTransferReference(bestProgress.upiTransferReference);
      }
      if (typeof bestProgress?.neftTransactionNumber === 'string') {
        setNeftTransactionNumber(bestProgress.neftTransactionNumber);
      }
      if (bestProgress?.paymentSubMethod === 'razorpay' || bestProgress?.paymentSubMethod === 'qr' || bestProgress?.paymentSubMethod === 'neft') {
        setPaymentSubMethod(bestProgress.paymentSubMethod);
      }
      if (bestProgress?.consentData && typeof bestProgress.consentData === 'object') {
        setConsentData(prev => ({
          ...prev,
          eligibility: typeof bestProgress.consentData?.eligibility === 'string' ? bestProgress.consentData.eligibility : prev.eligibility,
          qualification: typeof bestProgress.consentData?.qualification === 'string' ? bestProgress.consentData.qualification : prev.qualification,
          candidateRemark: typeof bestProgress.consentData?.candidateRemark === 'string' ? bestProgress.consentData.candidateRemark : prev.candidateRemark,
        }));
      }
    };

    void restoreDraft();
  }, [loading, draftKey, studentId, resetDraftToken]);

  const persistDraftNow = useCallback(async (): Promise<boolean> => {
    try {
      setAutoSaveStatus('saving');

      // Strip File objects — they can't be serialised
      const serialisable = {
        ...formData,
        photoFile: null,
        ssc_marksheetFile: null,
        hsc_marksheetFile: null,
        diploma_marksheetFile: null,
        grad_marksheetFile: null,
        postgrad_marksheetFile: null,
        ssc_ktDetails:      formData.ssc_ktDetails.map(d => ({ ...d, marksheetFile: null })),
        hsc_ktDetails:      formData.hsc_ktDetails.map(d => ({ ...d, marksheetFile: null })),
        diploma_ktDetails:  formData.diploma_ktDetails.map(d => ({ ...d, marksheetFile: null })),
        grad_ktDetails:     formData.grad_ktDetails.map(d => ({ ...d, marksheetFile: null })),
        postgrad_ktDetails: formData.postgrad_ktDetails.map(d => ({ ...d, marksheetFile: null })),
      };

      const progress = {
        currentStep,
        completedSteps,
        sectionChecks,
        consentChecks,
        termsAgreed: formData.termsAgreed,
        consentAcknowledged,
        experiencedConsentAcknowledged,
        razorpayPaid,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
        payAtOfficeVerified,
        upiTransferConfirmed,
        upiTransferReference,
        neftTransactionNumber,
        paymentSubMethod,
        consentData,
      };

      localStorage.setItem(draftKey, JSON.stringify({ data: serialisable, progress, savedAt: Date.now() }));

      const res = await fetch(`/api/online-admission/${encodeURIComponent(studentId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            ...serialisable,
            __draftProgress: {
              ...progress,
              source: 'public-admission-form',
            },
          },
        }),
      });

      if (!res.ok) {
        setAutoSaveStatus('idle');
        return false;
      }

      setAutoSaveStatus('saved');
      return true;
    } catch {
      setAutoSaveStatus('idle');
      return false;
    }
  }, [
    completedSteps,
    consentAcknowledged,
    consentData,
    consentChecks,
    currentStep,
    draftKey,
    experiencedConsentAcknowledged,
    formData,
    payAtOfficeVerified,
    paymentSubMethod,
    neftTransactionNumber,
    upiTransferConfirmed,
    upiTransferReference,
    razorpayOrderId,
    razorpayPaid,
    razorpayPaymentId,
    razorpaySignature,
    sectionChecks,
    studentId,
  ]);

  // Debounced auto-save to localStorage + server whenever form data/state changes
  const saveDraft = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void persistDraftNow();
    }, 1500);
  }, [persistDraftNow]);

  const handleManualSaveDraft = async () => {
    if (manualSaving) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setManualSaving(true);
    const ok = await persistDraftNow();
    setManualSaving(false);
    if (!ok) {
      alert('Could not save draft right now. Please check your internet connection and try again.');
    }
  };

  useEffect(() => {
    if (loading || submitted) return;
    saveDraft();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [formData, loading, submitted, saveDraft]);

  // Load Razorpay checkout.js once on mount
  useEffect(() => {
    if (document.getElementById('razorpay-checkout-js')) return;
    const script = document.createElement('script');
    script.id  = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleRazorpayPayment = async () => {
    if (!formData.modeOfPayment) {
      alert('Please select a payment mode first');
      return;
    }
    const baseFees = batchFees ?? 0;
    if (baseFees <= 0) {
      alert('Fee amount is not available. Please ensure a batch is selected in Step 4.');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).Razorpay === 'undefined') {
      alert('Payment gateway is still loading. Please wait a moment and try again.');
      return;
    }

    const amountPaise = calculateAdmissionPayableAmount() * 100;

    setPaymentLoading(true);
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId:     studentId,
          amountPaise,
          modeOfPayment: formData.modeOfPayment,
          studentName:   [formData.firstName, formData.lastName].filter(Boolean).join(' '),
          email:         formData.email,
        }),
      });
      const order = await res.json();
      if (!res.ok) { alert(order.error || 'Could not create payment order'); setPaymentLoading(false); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key:         order.keyId,
        amount:      order.amount,
        currency:    order.currency,
        name:        'Suvidya Institute of Technology Pvt. Ltd.',
        description: `${formData.modeOfPayment} — ${formData.trainingProgrammeName || 'Training Programme'}`,
        order_id:    order.orderId,
        prefill: {
          name:    [formData.firstName, formData.lastName].filter(Boolean).join(' '),
          email:   formData.email,
          contact: formData.mobile,
        },
        theme:   { color: '#2E3093' },
        handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setRazorpayPaid(true);
          setRazorpayPaymentId(response.razorpay_payment_id);
          setRazorpayOrderId(response.razorpay_order_id);
          setRazorpaySignature(response.razorpay_signature);
          setPaymentLoading(false);
        },
        modal: { ondismiss: () => setPaymentLoading(false) },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rzp.on('payment.failed', (resp: any) => {
        alert(`Payment failed: ${resp.error?.description || 'Please try again.'}`);
        setPaymentLoading(false);
      });
      rzp.open();
    } catch {
      alert('Network error. Please try again.');
      setPaymentLoading(false);
    }
  };

  const handlePayAtOfficeOverride = async () => {
    if (!payAtOfficePassword.trim()) {
      alert('Please enter override password');
      return;
    }
    setPayAtOfficeVerifying(true);
    try {
      const res = await fetch('/api/public/pay-at-office-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: payAtOfficePassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.error || 'Invalid override password');
        return;
      }

      setPayAtOfficeVerified(true);
      setPayAtOfficePassword('');
      setShowPayAtOfficeModal(false);
      setFormData(prev => ({ ...prev, modeOfPayment: 'Pay at Office' }));
      setRazorpayPaid(false);
      setRazorpayPaymentId('');
      setRazorpayOrderId('');
      setRazorpaySignature('');
    } catch {
      alert('Could not verify override password. Please try again.');
    } finally {
      setPayAtOfficeVerifying(false);
    }
  };

  // Sync batch fees whenever batch selection or available batches change
  useEffect(() => {
    if (!formData.batchCode) {
      setBatchFees(null);
      setBatchFeesFullPayment(null);
      setBatchFeesInstallment(null);
      return;
    }
    // Try from already-loaded batch list first
    if (availableBatches.length > 0) {
      const batch = availableBatches.find(b => b.batchCode === formData.batchCode);
      if (batch) {
        setBatchFees(batch.totalFees ? parseFloat(String(batch.totalFees)) : null);
        setBatchFeesFullPayment(batch.feesFullPayment ? parseFloat(String(batch.feesFullPayment)) : null);
        setBatchFeesInstallment(batch.feesInstallment ? parseFloat(String(batch.feesInstallment)) : null);
        return;
      }
    }
    // Otherwise fetch directly by batch code
    (async () => {
      try {
        const res = await fetch(`/api/public/batches?batchCode=${encodeURIComponent(formData.batchCode)}`);
        const data = await res.json();
        if (data.success) {
          setBatchFees(data.totalFees != null ? parseFloat(String(data.totalFees)) : null);
          setBatchFeesFullPayment(data.feesFullPayment != null ? parseFloat(String(data.feesFullPayment)) : null);
          setBatchFeesInstallment(data.feesInstallment != null ? parseFloat(String(data.feesInstallment)) : null);
        }
      } catch { /* non-fatal */ }
    })();
  }, [formData.batchCode, availableBatches]);

  // Auto-calculate total occupation years from working years and months
  useEffect(() => {
    const years = parseInt(formData.workingFromYears) || 0;
    const months = parseInt(formData.workingFromMonths) || 0;
    const totalYears = years + (months / 12);
    const roundedTotal = Math.floor(totalYears * 10) / 10; // Round to 1 decimal
    
    if (formData.totalOccupationYears !== String(roundedTotal)) {
      setFormData(prev => ({ ...prev, totalOccupationYears: String(roundedTotal) }));
    }
  }, [formData.workingFromYears, formData.workingFromMonths, formData.totalOccupationYears]);

  // Whenever trainingProgrammeId changes, ensure categories are loaded
  useEffect(() => {
    if (!formData.trainingProgrammeId || batchCategories.length > 0) return;
    setLoadingCategories(true);
    fetch(`/api/public/batches?courseId=${formData.trainingProgrammeId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setBatchCategories(d.categories); })
      .catch(() => { /* non-fatal */ })
      .finally(() => setLoadingCategories(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.trainingProgrammeId]);

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const res = await fetch('/api/public/courses');
      const data = await res.json();
      if (data.success) setCourses(data.courses);
    } catch {
      // non-fatal
    } finally {
      setLoadingCourses(false);
    }
  };

  // Check if student meets eligibility for selected training program
  const checkEligibility = (): boolean => {
    if (!formData.trainingProgrammeName || formData.occupationalStatus !== 'Student') return true;
    
    const eligibleBackgrounds = COURSE_ELIGIBILITY[formData.trainingProgrammeName];
    if (!eligibleBackgrounds) return true; // No restrictions if course not in map
    
    // Check graduation degree and specialization
    const gradDegree = formData.grad_degree?.toUpperCase() || '';
    const gradSpec = formData.grad_specialization || '';
    const hscStream = formData.hsc_stream || '';
    
    // Check if any eligible background matches
    return eligibleBackgrounds.some(bg => 
      gradDegree.includes(bg.toUpperCase()) || 
      gradSpec.includes(bg) || 
      hscStream.includes(bg)
    );
  };

  const requiresStudentConsent = () => formData.occupationalStatus === 'Student' && !checkEligibility();
  const requiresExperiencedConsent = () => formData.occupationalStatus === 'Employee' && (parseFloat(formData.totalOccupationYears) || 0) >= 10;

  const calculateAdmissionPayableAmount = () => {
    const baseFees = batchFees ?? 0;
    const installmentTotal = batchFeesInstallment ?? baseFees;
    const isPipingEngineeringFulltimeMode =
      /piping\s+engineering/i.test(formData.trainingProgrammeName || '') &&
      /full.?time/i.test(formData.trainingCategory || '');
    const isEngineeringDesignDraftingFulltimeMode =
      /engineering\s+design.*drafting/i.test(formData.trainingProgrammeName || '') &&
      /full.?time/i.test(formData.trainingCategory || '');
    const isLoanAdmission15000Mode = (
      (/engineering\s+design.*drafting/i.test(formData.trainingProgrammeName || '') && /full.?time/i.test(formData.trainingCategory || '')) ||
      /piping\s+design.*drafting/i.test(formData.trainingProgrammeName || '')
    );
    const isProcessWeekendMode = /process\s+engineering/i.test(formData.trainingProgrammeName || '') && /weekend/i.test(formData.trainingCategory || '');
    const payableTuition = formData.modeOfPayment === 'Full Payment'
      ? Math.round(baseFees * 0.95)
      : formData.modeOfPayment === '3-Installment Plan'
      ? (isProcessWeekendMode ? 15000 : 25000)
      : formData.modeOfPayment === '2-Payment Plan'
      ? 15000
      : formData.modeOfPayment === '6-Installment Plan'
      ? 15000
      : formData.modeOfPayment === 'Loan (0% Interest)'
      ? (isPipingEngineeringFulltimeMode ? 12000 : ((isEngineeringDesignDraftingFulltimeMode || isLoanAdmission15000Mode || isProcessWeekendMode) ? 15000 : 12000))
      : Math.round(installmentTotal / 2);

    return payableTuition + (formData.modeOfPayment ? ALUMNI_MEMBERSHIP_FEE : 0);
  };

  // Tracks the programme|category combo we've already fetched batches for, so the
  // centralized loader below runs once per combo and never loops on empty results.
  const loadedBatchKeyRef = useRef<string>('');

  const loadBatchesForCategory = useCallback(async (courseId: string, category: string) => {
    if (!courseId || !category) return;
    setLoadingBatches(true);
    try {
      const res = await fetch(`/api/public/batches?courseId=${courseId}&category=${encodeURIComponent(category)}`);
      const data = await res.json();
      if (data.success) setAvailableBatches(data.batches);
    } catch {
      // non-fatal
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  // Single source of truth for loading the batch-code list: whenever a programme and
  // category are both selected, fetch the matching batches — regardless of HOW the
  // category got set (dropdown, restored draft, or the hydrate effect). This fixes
  // "Select Batch Code" staying empty when the category wasn't picked via its onChange.
  useEffect(() => {
    const { trainingProgrammeId, trainingCategory } = formData;
    if (!trainingProgrammeId || !trainingCategory) {
      loadedBatchKeyRef.current = '';
      return;
    }
    const key = `${trainingProgrammeId}|${trainingCategory}`;
    if (loadedBatchKeyRef.current === key) return;
    loadedBatchKeyRef.current = key;
    void loadBatchesForCategory(trainingProgrammeId, trainingCategory);
  }, [formData.trainingProgrammeId, formData.trainingCategory, loadBatchesForCategory]);

  const handleProgrammeChange = async (courseId: string) => {
    const course = courses.find((c) => String(c.Course_Id) === courseId);
    setFormData(prev => ({
      ...prev,
      trainingProgrammeId: courseId,
      trainingProgrammeName: course?.Course_Name || '',
      trainingCategory: '',
      batchCode: '',
    }));
    setBatchCategories([]);
    setAvailableBatches([]);
    setBatchFees(null);
    setBatchFeesFullPayment(null);
    setBatchFeesInstallment(null);
    if (!courseId) return;
    setLoadingCategories(true);
    try {
      const res = await fetch(`/api/public/batches?courseId=${courseId}`);
      const data = await res.json();
      if (data.success) setBatchCategories(data.categories);
    } catch {
      // non-fatal
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({ ...prev, trainingCategory: category, batchCode: '' }));
    setAvailableBatches([]);
    setBatchFees(null);
    setBatchFeesFullPayment(null);
    setBatchFeesInstallment(null);
    // Batches are loaded by the centralized effect that watches programme + category.
  };

  useEffect(() => {
    if (!formData.trainingProgrammeId || !formData.batchCode || formData.trainingCategory) return;

    let cancelled = false;

    const hydrateBatchSelection = async () => {
      try {
        const res = await fetch(`/api/public/batches?batchCode=${encodeURIComponent(formData.batchCode)}`);
        const data = await res.json();
        if (!data.success || cancelled) return;

        const resolvedCategory = typeof data.category === 'string' ? data.category.trim() : '';
        if (!resolvedCategory) return;

        // Set the category; the centralized effect loads its batches.
        setFormData(prev => (prev.trainingCategory === resolvedCategory ? prev : { ...prev, trainingCategory: resolvedCategory }));
      } catch {
        // non-fatal
      }
    };

    void hydrateBatchSelection();
    return () => {
      cancelled = true;
    };
  }, [formData.batchCode, formData.trainingCategory, formData.trainingProgrammeId]);

  const fetchStudentData = async () => {
    try {
      const res = await fetch(`/api/public/inquiry?id=${studentId}`);
      const data = await res.json();
      if (data.inquiry) {
        const nameParts = (data.inquiry.Student_Name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

        // DOB is already normalised to YYYY-MM-DD by the public API
        const dob = data.inquiry.DOB ? String(data.inquiry.DOB).slice(0, 10) : '';

        setFormData(prev => ({
          ...prev,
          firstName,
          middleName,
          lastName,
          email: data.inquiry.Email || '',
          mobile: data.inquiry.Present_Mobile || '',
          telephone: data.inquiry.Present_Mobile2 || '',
          dob,
          gender: data.inquiry.Sex || '',
          nationality: data.inquiry.Nationality || 'Indian',
          presentCountry: data.inquiry.Present_Country || 'India',
          batchCode: data.inquiry.Batch_Code || '',
          trainingProgrammeId: data.inquiry.Course_Id ? String(data.inquiry.Course_Id) : '',
          trainingProgrammeName: data.inquiry.CourseName || '',
          grad_degree: data.inquiry.Qualification || '',
          grad_specialization: data.inquiry.Discipline || '',
          grad_percentage: data.inquiry.Percentage ? String(data.inquiry.Percentage) : '',
        }));

        // Pre-fetch categories for the pre-filled course so the dropdown is ready
        if (data.inquiry.Course_Id) {
          try {
            const catRes = await fetch(`/api/public/batches?courseId=${data.inquiry.Course_Id}`);
            const catData = await catRes.json();
            if (catData.success) setBatchCategories(catData.categories);
          } catch { /* non-fatal */ }
        }
      }
    } catch {
      // Pre-fill not critical — student can fill in manually
    } finally {
      setLoading(false);
    }
  };

  const handleAddUniversity = () => {
    if (!newUniversityData.name.trim()) {
      alert('Please enter university name');
      return;
    }
    const fieldName = newUniversityData.fieldType === 'grad' ? 'grad_university' : 'postgrad_university';
    setFormData(prev => ({ ...prev, [fieldName]: newUniversityData.name }));
    setShowAddUniversityModal(false);
    setNewUniversityData({ name: '', country: '', city: '', fieldType: 'grad' });
  };

  const handleChange = (field: string, value: string | boolean | File | null | undefined) => {
    if (value === undefined) return;
    
    // Initialize KT details array when KT subject count changes for any education level
    if (field.endsWith('_ktCount') && typeof value === 'string') {
      const count = parseInt(value) || 0;
      const detailsField = field.replace('_ktCount', '_ktDetails') as keyof typeof formData;
      const currentDetails = formData[detailsField] as { subjectName: string; year: string; semester: string; clearedYear: string; marks: string; marksheetFile: File | null }[];
      
      const newKtDetails = Array.from({ length: count }, (_, i) =>
        currentDetails[i] || {
          subjectName: '', year: '', semester: '', clearedYear: '', marks: '', marksheetFile: null,
        }
      );
      setFormData(prev => ({ ...prev, [field]: value, [detailsField]: newKtDetails }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    if (field === 'modeOfPayment') {
      setPaymentSubMethod('');
      setUpiTransferConfirmed(false);
      setUpiTransferReference('');
      setNeftTransactionNumber('');
      setRazorpayPaid(false);
      setRazorpayPaymentId('');
      setRazorpayOrderId('');
      setRazorpaySignature('');
    }
  };

  const handleKtDetailChange = (level: 'ssc' | 'hsc' | 'diploma' | 'grad' | 'postgrad', index: number, field: string, value: string | File | null) => {
    const detailsField = `${level}_ktDetails` as keyof typeof formData;
    setFormData(prev => {
      const currentDetails = prev[detailsField] as { subjectName: string; year: string; semester: string; clearedYear: string; marks: string; marksheetFile: File | null }[];
      const newKtDetails = [...currentDetails];
      newKtDetails[index] = { ...newKtDetails[index], [field]: value };
      return { ...prev, [detailsField]: newKtDetails };
    });
  };

  const handleSameAddress = (checked: boolean) => {
    handleChange('sameAsPresent', checked);
    if (checked) {
      setFormData(prev => ({
        ...prev,
        permanentFlat:     prev.presentFlat,
        permanentBuilding: prev.presentBuilding,
        permanentStreet:   prev.presentStreet,
        permanentArea:     prev.presentArea,
        permanentLandmark: prev.presentLandmark,
        permanentCity:     prev.presentCity,
        permanentDistrict: prev.presentDistrict,
        permanentState:    prev.presentState,
        permanentPin:      prev.presentPin,
        permanentCountry:  prev.presentCountry,
      }));
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.dob || !formData.gender || !formData.email || !formData.mobile) {
          alert('Please fill all required fields in Personal Info');
          return false;
        }
        break;
      case 2:
        break;
      case 3:
        if (requiresExperiencedConsent() && !experiencedConsentAcknowledged) {
          setConsentType('experienced');
          setShowConsentModal(true);
          alert('Please complete the experienced candidate consent form before proceeding.');
          return false;
        }
        break;
      case 4:
        if (!formData.trainingProgrammeId || !formData.trainingProgrammeName) {
          alert('Please select a Training Programme');
          return false;
        }
        if (!formData.trainingCategory && !formData.batchCode) {
          alert('Please select a Training Category');
          return false;
        }
        if (!formData.batchCode) {
          alert('Please select a Batch');
          return false;
        }
        if (requiresStudentConsent() && !consentAcknowledged) {
          setConsentType('student');
          setShowConsentModal(true);
          alert('Please complete the consent form before proceeding.');
          return false;
        }
        break;
      case 5:
        if (formData.hasMedicalHistory !== 'yes' && formData.hasMedicalHistory !== 'no') {
          alert('Please indicate whether you have any medical history');
          return false;
        }
        if (formData.hasMedicalHistory === 'yes' && !formData.medicalHistoryDescription.trim()) {
          alert('Please describe your medical history');
          return false;
        }
        break;
      case 6:
        if (!allSectionsChecked) {
          alert('Please read and acknowledge all sections of the Terms & Conditions');
          return false;
        }
        if (!formData.termsAgreed) {
          alert('Please accept the Terms & Conditions declaration');
          return false;
        }
        break;
      case 7:
        if (!formData.modeOfPayment) {
          alert('Please select a fee plan');
          return false;
        }
        if (formData.modeOfPayment === 'Pay at Office' && !payAtOfficeVerified) {
          alert('Pay at Office requires password override approval.');
          return false;
        }
        if (formData.modeOfPayment !== 'Pay at Office' && !paymentSubMethod) {
          alert('Please select how you would like to pay — Pay Online, Pay by QR, or Pay by NEFT.');
          return false;
        }
        if (paymentSubMethod === 'qr' && !upiTransferConfirmed) {
          alert('Please confirm your QR payment before proceeding.');
          return false;
        }
        if (paymentSubMethod === 'razorpay' && !razorpayPaid) {
          alert('Please complete the online payment before proceeding.');
          return false;
        }
        if (paymentSubMethod === 'neft' && !neftTransactionNumber.trim()) {
          alert('Please enter the NEFT transaction number before proceeding.');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = (step: number) => {
    if (step > currentStep && !validateStep(currentStep)) return;
    if (step > currentStep && !completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    setCurrentStep(step);
  };

  const jumpToStep = (step: number) => {
    // Step 7 (Payment) is locked until steps 1–6 are all completed
    if (!isPreviewTermsMode && step === 7 && ![1, 2, 3, 4, 5, 6].every((s) => completedSteps.includes(s))) return;
    setCurrentStep(step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.dob || !formData.gender || !formData.email || !formData.mobile) {
      alert('Please complete Step 1: Fill all required fields in Personal Info');
      setCurrentStep(1);
      return;
    }
    if (!formData.trainingProgrammeId || !formData.batchCode) {
      alert('Please complete Step 4: Select a Training Programme and Batch');
      setCurrentStep(4);
      return;
    }
    if (requiresExperiencedConsent() && !experiencedConsentAcknowledged) {
      alert('Please complete the experienced candidate consent form in Step 3 before submitting.');
      setConsentType('experienced');
      setCurrentStep(3);
      setShowConsentModal(true);
      return;
    }
    if (requiresStudentConsent() && !consentAcknowledged) {
      alert('Please complete the required consent form in Step 4 before submitting.');
      setConsentType('student');
      setCurrentStep(4);
      setShowConsentModal(true);
      return;
    }
    if (formData.hasMedicalHistory !== 'yes' && formData.hasMedicalHistory !== 'no') {
      alert('Please complete Step 5: Indicate whether you have any medical history');
      setCurrentStep(5);
      return;
    }
    if (formData.hasMedicalHistory === 'yes' && !formData.medicalHistoryDescription.trim()) {
      alert('Please complete Step 5: Describe your medical history');
      setCurrentStep(5);
      return;
    }
    if (!allSectionsChecked || !formData.termsAgreed) {
      alert('Please complete Step 6: Read and accept the Terms & Conditions');
      setCurrentStep(6);
      return;
    }
    if (!formData.modeOfPayment) {
      alert('Please complete Step 7: Select a fee plan');
      setCurrentStep(7);
      return;
    }
    if (formData.modeOfPayment === 'Pay at Office' && !payAtOfficeVerified) {
      alert('Please complete Pay at Office override verification in Step 7.');
      setCurrentStep(7);
      return;
    }
    if (formData.modeOfPayment !== 'Pay at Office' && !paymentSubMethod) {
      alert('Please select a payment method (Pay Online, Pay by QR, or Pay by NEFT) in Step 7.');
      setCurrentStep(7);
      return;
    }
    if (paymentSubMethod === 'qr' && !upiTransferConfirmed) {
      alert('Please confirm your QR payment in Step 7 before submitting.');
      setCurrentStep(7);
      return;
    }
    if (paymentSubMethod === 'razorpay' && !razorpayPaid) {
      alert('Please complete the online payment in Step 7 before submitting.');
      setCurrentStep(7);
      return;
    }
    if (paymentSubMethod === 'neft' && !neftTransactionNumber.trim()) {
      alert('Please enter the NEFT transaction number in Step 7 before submitting.');
      setCurrentStep(7);
      return;
    }

    setSubmitting(true);
    try {
      const payableAmount = calculateAdmissionPayableAmount();
      const submitData = {
        inquiryId: studentId, // Inquiry ID from URL
        Student_Id: parseInt(studentId),
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        shortName: formData.shortName,
        dob: formData.dob,
        gender: formData.gender,
        nationality: formData.nationality,
        email: formData.email,
        mobile: formData.mobile,
        telephone: formData.telephone,
        familyContact: formData.familyContact,
        presentFlat: formData.presentFlat,
        presentBuilding: formData.presentBuilding,
        presentStreet: formData.presentStreet,
        presentArea: formData.presentArea,
        presentLandmark: formData.presentLandmark,
        presentAddress: [formData.presentFlat, formData.presentBuilding, formData.presentStreet, formData.presentArea, formData.presentLandmark, formData.presentDistrict].filter(Boolean).join(', '),
        presentCity: formData.presentCity,
        presentDistrict: formData.presentDistrict,
        presentState: formData.presentState,
        presentPin: formData.presentPin,
        presentCountry: formData.presentCountry,
        permanentFlat: formData.permanentFlat,
        permanentBuilding: formData.permanentBuilding,
        permanentStreet: formData.permanentStreet,
        permanentArea: formData.permanentArea,
        permanentLandmark: formData.permanentLandmark,
        permanentAddress: [formData.permanentFlat, formData.permanentBuilding, formData.permanentStreet, formData.permanentArea, formData.permanentLandmark, formData.permanentDistrict].filter(Boolean).join(', '),
        permanentCity: formData.permanentCity,
        permanentDistrict: formData.permanentDistrict,
        permanentState: formData.permanentState,
        permanentPin: formData.permanentPin,
        permanentCountry: formData.permanentCountry,
        ssc_board: formData.ssc_board,
        ssc_schoolName: formData.ssc_schoolName,
        ssc_yearOfPassing: formData.ssc_yearOfPassing,
        ssc_percentage: formData.ssc_percentage,
        hsc_board: formData.hsc_board,
        hsc_collegeName: formData.hsc_collegeName,
        hsc_stream: formData.hsc_stream,
        hsc_yearOfPassing: formData.hsc_yearOfPassing,
        hsc_percentage: formData.hsc_percentage,
        grad_degree: formData.grad_degree,
        grad_specialization: formData.grad_specialization,
        grad_university: formData.grad_university,
        grad_yearOfPassing: formData.grad_yearOfPassing,
        grad_percentage: formData.grad_percentage,
        postgrad_degree: formData.postgrad_degree,
        postgrad_specialization: formData.postgrad_specialization,
        postgrad_university: formData.postgrad_university,
        postgrad_yearOfPassing: formData.postgrad_yearOfPassing,
        postgrad_percentage: formData.postgrad_percentage,
        diploma_degree: formData.diploma_degree,
        diploma_specialization: formData.diploma_specialization,
        diploma_institute: formData.diploma_institute,
        diploma_yearOfPassing: formData.diploma_yearOfPassing,
        diploma_percentage: formData.diploma_percentage,
        ssc_ktCount: formData.ssc_ktCount,
        ssc_ktDetails: formData.ssc_ktDetails,
        hsc_ktCount: formData.hsc_ktCount,
        hsc_ktDetails: formData.hsc_ktDetails,
        diploma_ktCount: formData.diploma_ktCount,
        diploma_ktDetails: formData.diploma_ktDetails,
        grad_ktCount: formData.grad_ktCount,
        grad_ktDetails: formData.grad_ktDetails,
        postgrad_ktCount: formData.postgrad_ktCount,
        postgrad_ktDetails: formData.postgrad_ktDetails,
        educationRemark: formData.educationRemark,
        occupationalStatus: formData.occupationalStatus,
        jobOrganisation: formData.jobOrganisation,
        jobDescription: formData.jobDescription,
        jobDesignation: formData.jobDesignation,
        workingFromYears: formData.workingFromYears,
        workingFromMonths: formData.workingFromMonths,
        totalOccupationYears: formData.totalOccupationYears,
        selfEmploymentDetails: formData.selfEmploymentDetails,
        medicalHistory: formData.hasMedicalHistory === 'yes',
        medicalHistoryDetails: formData.hasMedicalHistory === 'yes' ? formData.medicalHistoryDescription.trim() : '',
        trainingProgrammeId: formData.trainingProgrammeId,
        trainingProgrammeName: formData.trainingProgrammeName,
        trainingCategory: formData.trainingCategory,
        batchCode: formData.batchCode,
        modeOfPayment: formData.modeOfPayment,
        paymentSubMethod: paymentSubMethod || null,
        payAtOfficeOverrideUsed: formData.modeOfPayment === 'Pay at Office' ? payAtOfficeVerified : false,
        upiTransferConfirmed: paymentSubMethod === 'qr' ? upiTransferConfirmed : false,
        upiTransferReference: paymentSubMethod === 'qr' ? (upiTransferReference.trim() || null) : null,
        upiAmount: paymentSubMethod === 'qr' && upiTransferConfirmed ? payableAmount : null,
        neftTransactionNumber: paymentSubMethod === 'neft' ? neftTransactionNumber.trim() : null,
        neftAmount: paymentSubMethod === 'neft' ? payableAmount : null,
        neftBankDetails: paymentSubMethod === 'neft' ? NEFT_BANK_DETAILS : null,
        sameAsPresent: formData.sameAsPresent,
        consentAcknowledged: consentAcknowledged,
        experiencedConsentAcknowledged: experiencedConsentAcknowledged,
        consentChecks: consentChecks,
        consentData: consentData,
        termsAgreed: formData.termsAgreed,
        // Razorpay payment details (populated if student paid online)
        razorpayPaid,
        razorpayPaymentId:  razorpayPaymentId  || null,
        razorpayOrderId:    razorpayOrderId    || null,
        razorpaySignature:  razorpaySignature  || null,
        razorpayAmount:     razorpayPaid ? payableAmount : null,
      };

      const requestBody = new FormData();
      requestBody.append('payload', JSON.stringify(submitData));

      const appendFile = (field: string, file: File | null) => {
        if (file) requestBody.append(field, file);
      };

      appendFile('photoFile', formData.photoFile);
      appendFile('ssc_marksheetFile', formData.ssc_marksheetFile);
      appendFile('hsc_marksheetFile', formData.hsc_marksheetFile);
      appendFile('diploma_marksheetFile', formData.diploma_marksheetFile);
      appendFile('grad_marksheetFile', formData.grad_marksheetFile);
      appendFile('postgrad_marksheetFile', formData.postgrad_marksheetFile);

      const appendKtFiles = (
        level: 'ssc' | 'hsc' | 'diploma' | 'grad' | 'postgrad',
        details: Array<{ marksheetFile: File | null }>
      ) => {
        details.forEach((detail, index) => {
          if (detail.marksheetFile) {
            requestBody.append(`${level}_ktDetails.${index}.marksheetFile`, detail.marksheetFile);
          }
        });
      };

      appendKtFiles('ssc', formData.ssc_ktDetails);
      appendKtFiles('hsc', formData.hsc_ktDetails);
      appendKtFiles('diploma', formData.diploma_ktDetails);
      appendKtFiles('grad', formData.grad_ktDetails);
      appendKtFiles('postgrad', formData.postgrad_ktDetails);

      const res = await fetch('/api/online-admission', {
        method: 'POST',
        body: requestBody,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        setSubmittedStudentId(data.inquiryId ?? data.studentId ?? null);
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(data.error || 'Failed to submit form. Please try again.');
      }
    } catch {
      alert('An error occurred while submitting the form. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    // TODO: Implement email sending functionality
    alert('Email sending functionality will be implemented soon');
  };

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-spinner fa-spin text-white text-3xl"></i>
          </div>
          <p className="text-white text-lg font-semibold">Loading your form&hellip;</p>
          <p className="text-white/70 text-sm mt-1">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] shadow-lg">
          <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
            <Image src="/sit.png" alt="SIT Logo" width={44} height={44} className="rounded-lg bg-white/10 p-0.5" style={{ width: 'auto', height: 'auto' }} />
            <div>
              <div className="text-white font-bold text-base">Suvidya Institute of Technology</div>
              <div className="text-white/70 text-xs">Online Admission Form</div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-xl border border-green-100 max-w-lg w-full p-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <i className="fas fa-check text-white text-3xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Your admission form has been successfully submitted. Our team will review your application and contact you at <span className="font-semibold text-[#2E3093]">{formData.email}</span> with further instructions.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-[#2E3093] mb-2 flex items-center gap-2">
                <i className="fas fa-info-circle"></i>
                What happens next?
              </p>
              <ul className="text-xs text-gray-600 space-y-1.5">
                <li className="flex items-start gap-2"><i className="fas fa-check-circle text-green-500 mt-0.5"></i>Your application is under review</li>
                <li className="flex items-start gap-2"><i className="fas fa-check-circle text-green-500 mt-0.5"></i>You will receive a confirmation email shortly</li>
                <li className="flex items-start gap-2"><i className="fas fa-check-circle text-green-500 mt-0.5"></i>Our admissions team will contact you within 2–3 business days</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500">
              Application ID: <span className="font-mono font-semibold text-gray-700">#{submittedStudentId ?? studentId}</span>
            </p>
          </div>
        </div>

        <footer className="bg-[#2E3093] text-white text-center py-4">
          <p className="text-xs text-white/70">© {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] shadow-lg flex-shrink-0 z-30">
        <div className="max-w-full mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <div className="bg-white rounded-lg sm:rounded-xl p-1 sm:p-1.5 shadow-md flex-shrink-0 -my-2 sm:-my-3">
              <Image src="/sit.png" alt="SIT Logo" width={48} height={48} className="block sm:hidden rounded-md" style={{ width: 'auto', height: 'auto' }} />
              <Image src="/sit.png" alt="SIT Logo" width={72} height={72} className="hidden sm:block rounded-lg" style={{ width: 'auto', height: 'auto' }} />
            </div>
            <div className="min-w-0">
              <div className="text-white font-extrabold text-sm sm:text-lg leading-tight tracking-tight truncate">Suvidya Institute of Technology</div>
              <div className="text-[#FAE452] text-[10px] sm:text-xs font-semibold mt-0.5 flex items-center gap-1.5">
                <i className="fas fa-file-alt text-[8px] sm:text-[10px]"></i>
                Online Admission Form
              </div>
              <div className="sm:hidden mt-1 flex items-center gap-2 text-[10px] text-white/85">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2 py-0.5 font-semibold">
                  <i className={`fas ${STEPS[currentStep - 1]?.icon ?? ''} text-[9px]`}></i>
                  {STEPS[currentStep - 1].title}
                </span>
                <span className="font-semibold text-white/70">{currentStep}/{STEPS.length}</span>
              </div>
              <div className="sm:hidden mt-1 flex gap-1">
                {STEPS.map((step) => {
                  const isLocked = !isPreviewTermsMode && step.id === 7 && ![1, 2, 3, 4, 5, 6].every((s) => completedSteps.includes(s));
                  const isCompleted = step.id < currentStep || completedSteps.includes(step.id);
                  const isCurrent = step.id === currentStep;
                  return (
                    <button
                      key={step.id}
                      onClick={() => jumpToStep(step.id)}
                      disabled={isLocked}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        isLocked
                          ? 'bg-white/20 cursor-not-allowed'
                          : isCompleted
                          ? 'bg-[#FAE452]'
                          : isCurrent
                          ? 'bg-white'
                          : 'bg-white/30'
                      }`}
                      aria-label={`Go to ${step.title}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Auto-save indicator */}
            {autoSaveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 sm:px-2.5">
                <div className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                <span className="text-white/70 text-[11px] font-medium hidden sm:inline">Saving…</span>
              </div>
            )}
            {autoSaveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 sm:px-2.5">
                <svg className="w-3 h-3 text-[#FAE452]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/80 text-[11px] font-medium hidden sm:inline">Draft saved</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
              <i className="fas fa-hashtag text-white/60 text-xs"></i>
              <span className="text-white text-xs font-semibold">Application #{studentId}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile step indicator ── */}
      <div className="hidden lg:hidden bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-full mx-auto px-3 py-2.5">
          {/* Current step info */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-lg flex items-center justify-center">
                <i className={`fas ${STEPS[currentStep - 1]?.icon ?? ''} text-white text-[10px]`}></i>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-800 leading-tight">{STEPS[currentStep - 1].title}</div>
                <div className="text-[10px] text-gray-500 leading-tight">{STEPS[currentStep - 1].description}</div>
              </div>
            </div>
            <div className="bg-[#2E3093]/10 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-[#2E3093]">{currentStep}/{STEPS.length}</span>
            </div>
          </div>
          {/* Step dots */}
          <div className="flex gap-1">
            {STEPS.map((step) => {
              const isLocked = !isPreviewTermsMode && step.id === 7 && ![1, 2, 3, 4, 5, 6].every((s) => completedSteps.includes(s));
              const isCompleted = step.id < currentStep || completedSteps.includes(step.id);
              const isCurrent = step.id === currentStep;
              return (
                <button
                  key={step.id}
                  onClick={() => jumpToStep(step.id)}
                  disabled={isLocked}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    isLocked
                      ? 'bg-gray-200 cursor-not-allowed'
                      : isCompleted
                      ? 'bg-green-500'
                      : isCurrent
                      ? 'bg-gradient-to-r from-[#2E3093] to-[#2A6BB5]'
                      : 'bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto">
        <div className="h-full w-full px-2 sm:px-4 py-2 sm:py-4 bg-gray-50">
        <div className="flex gap-2 sm:gap-4 h-full">

          {/* Sidebar (desktop only) */}
          <aside className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 h-full overflow-y-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-4 py-3">
                <h2 className="text-white font-bold text-base flex items-center gap-2">
                  <i className="fas fa-clipboard-list"></i>
                  Admission Form
                </h2>
                <p className="text-white/80 text-xs mt-0.5">Complete all sections</p>
              </div>

              <nav className="p-2">
                {STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = completedSteps.includes(step.id);
                  const isLocked = !isPreviewTermsMode && step.id === 7 && ![1, 2, 3, 4, 5, 6].every((s) => completedSteps.includes(s));
                  return (
                    <button
                      key={step.id}
                      onClick={() => jumpToStep(step.id)}
                      disabled={isLocked}
                      title={isLocked ? 'Complete all previous steps to unlock' : undefined}
                      className={`w-full text-left px-3 py-2 rounded-lg mb-1.5 transition-all ${
                        isLocked
                          ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                          : isActive
                          ? 'bg-[#2E3093] text-white shadow-md'
                          : isCompleted
                          ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isLocked ? 'bg-gray-200 text-gray-400' : isActive ? 'bg-white/20' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {isLocked ? (
                            <i className="fas fa-lock text-sm"></i>
                          ) : isCompleted ? (
                            <i className="fas fa-check text-sm"></i>
                          ) : (
                            <i className={`fas ${step.icon} text-sm`}></i>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-xs ${isActive ? 'text-white' : ''}`}>{step.title}</div>
                          <div className={`text-xs mt-0 ${isActive ? 'text-white/80' : isCompleted ? 'text-green-600' : isLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                            {isLocked ? 'Complete steps 1–5 to unlock' : step.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Progress</span>
                  <span className="font-semibold">{completedSteps.length}/{STEPS.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                  <div
                    className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(completedSteps.length / STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="mt-3 flex-1 bg-amber-50 border border-amber-200 rounded-lg overflow-hidden flex flex-col">
              <div className="bg-amber-100 border-b border-amber-200 px-3 py-2 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-amber-600 text-xs flex-shrink-0"></i>
                <span className="text-xs font-bold text-amber-800">Important Notes</span>
              </div>
              <ul className="p-3 space-y-2">
                {[
                  { icon: 'fa-asterisk', text: 'Fields marked with * are mandatory.' },
                  { icon: 'fa-save', text: 'Draft progress is saved on this device while you fill the form.' },
                  { icon: 'fa-file-upload', text: 'Keep photo and academic documents ready in PDF, JPG, PNG, or WebP up to 5 MB each.' },
                  { icon: 'fa-id-card', text: 'Enter the student name exactly as it should appear on the ID proof and student master.' },
                  { icon: 'fa-map-marked-alt', text: 'Use the same-address toggle to speed up address entry when both addresses match.' },
                  { icon: 'fa-check-double', text: 'Confirm the selected programme, category, and batch before moving to payment.' },
                  { icon: 'fa-lock', text: 'Changes after submission need admin follow-up, so use the final step as your review screen.' },
                ].map((note, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <i className={`fas ${note.icon} text-amber-500 text-xs mt-0.5 flex-shrink-0 w-3`}></i>
                    <span className="text-xs text-amber-900 leading-tight">{note.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main form card */}
          <main className="flex-1 min-w-0 h-full">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] border border-gray-200 overflow-hidden h-full flex flex-col">
              {/* Step header */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-3 sm:px-7 py-3 sm:py-5 border-b border-gray-200">
                <div className="hidden sm:flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-3 rounded-2xl bg-[radial-gradient(circle_at_top_left,_rgba(46,48,147,0.08),_transparent_55%),linear-gradient(135deg,_#ffffff,_#f8fbff)] px-4 py-3 ring-1 ring-[#2E3093]/10 shadow-[0_12px_30px_rgba(46,48,147,0.08)]">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] text-white shadow-md">
                        <i className={`fas ${STEPS[currentStep - 1]?.icon ?? ''} text-base`}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h1 className="text-xl font-black tracking-tight text-[#2E3093] truncate">{STEPS[currentStep - 1].title}</h1>
                          <span className="rounded-full bg-[#2E3093]/8 px-2.5 py-1 text-[11px] font-bold text-[#2E3093]">Step {currentStep}/{STEPS.length}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{STEPS[currentStep - 1].description}</p>
                      </div>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-3"><span className="text-red-500 font-bold">*</span> indicates a mandatory field.</p>
                  </div>
                  <div className="min-w-[220px] rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-slate-100 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      <span>Progress</span>
                      <span className="text-[#2E3093]">{completedSteps.length}/{STEPS.length}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#2E3093] via-[#2A6BB5] to-[#4bb7ff] transition-all duration-500"
                        style={{ width: `${Math.max((completedSteps.length / STEPS.length) * 100, (currentStep / STEPS.length) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">{STEP_GUIDANCE[currentStep]?.tip ?? STEP_GUIDANCE[7].tip}</p>
                  </div>
                </div>
                <div className="hidden sm:flex gap-1 sm:gap-1.5 mt-2">
                  {STEPS.map((step) => (
                    <div
                      key={step.id}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        step.id < currentStep || completedSteps.includes(step.id)
                          ? 'bg-green-500'
                          : step.id === currentStep
                          ? 'bg-[#2E3093]'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="sm:hidden rounded-2xl border border-[#2E3093]/10 bg-[radial-gradient(circle_at_top_left,_rgba(46,48,147,0.08),_transparent_55%),linear-gradient(135deg,_#ffffff,_#f8fbff)] p-3 shadow-[0_10px_30px_rgba(46,48,147,0.08)]">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] text-white shadow-md">
                      <i className={`fas ${STEPS[currentStep - 1]?.icon ?? ''} text-sm`}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black tracking-tight text-[#2E3093] truncate">{STEPS[currentStep - 1].title}</p>
                        <span className="rounded-full bg-[#2E3093]/8 px-2 py-1 text-[10px] font-bold text-[#2E3093]">Step {currentStep}/{STEPS.length}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{STEPS[currentStep - 1].description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                    <i className="fas fa-lightbulb mt-0.5 text-[11px] text-amber-600"></i>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Helpful Note</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">{STEP_GUIDANCE[currentStep]?.tip ?? STEP_GUIDANCE[7].tip}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500"><span className="text-red-500 font-bold">*</span> Mandatory fields need to be completed before continuing.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-2.5 sm:px-6 py-2.5 sm:py-4 mobile-form-stage">

                  {/* ── STEP 1: Personal Info ── */}
                  {currentStep === 1 && (
                    <div className="space-y-4 sm:space-y-5" style={stepEnterStyle}>
                      {/* Basic Information */}
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-id-card text-[#2A6BB5]"></i>
                          Basic Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} placeholder="Enter first name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Middle Name</label>
                            <input type="text" value={formData.middleName} onChange={(e) => handleChange('middleName', e.target.value)} placeholder="Enter middle name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last Name <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} placeholder="Enter last name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Short Name (For ID Card)</label>
                            <input type="text" value={formData.shortName} onChange={(e) => handleChange('shortName', e.target.value)} placeholder="e.g. Alex J." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
                            <div className="flex">
                              <input
                                type="date"
                                value={formData.dob || ''}
                                onChange={(e) => handleChange('dob', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Gender <span className="text-red-500">*</span></label>
                            <div className="flex gap-6 pt-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="gender" value="Male" checked={formData.gender === 'Male'} onChange={(e) => handleChange('gender', e.target.value)} className="w-4 h-4 text-[#2E3093]" />
                                <span>Male</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="gender" value="Female" checked={formData.gender === 'Female'} onChange={(e) => handleChange('gender', e.target.value)} className="w-4 h-4 text-[#2E3093]" />
                                <span>Female</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-phone-alt text-[#2A6BB5]"></i>
                          Contact Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nationality <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.nationality} onChange={(e) => handleChange('nationality', e.target.value)} placeholder="Indian" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                            <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="email@domain.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mobile Number <span className="text-red-500">*</span></label>
                            <input type="tel" value={formData.mobile} onChange={(e) => handleChange('mobile', e.target.value)} placeholder="+91-XXXXXXXXXX" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Telephone Number</label>
                            <input type="tel" value={formData.telephone} onChange={(e) => handleChange('telephone', e.target.value)} placeholder="Telephone number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Family Contact Number</label>
                            <input type="tel" value={formData.familyContact} onChange={(e) => handleChange('familyContact', e.target.value)} placeholder="Emergency contact" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                          </div>
                        </div>
                      </div>

                      {/* Address Details */}
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-map-marker-alt text-[#2A6BB5]"></i>
                          Address Details
                        </h3>

                        {/* Present Address */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 overflow-hidden mb-4">
                          <div className="px-4 py-2.5 bg-blue-100 border-b border-blue-200 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-[#2A6BB5] flex items-center justify-center">
                              <i className="fas fa-home text-white text-[9px]"></i>
                            </div>
                            <span className="text-sm font-bold text-[#2A6BB5]">Present / Current Address</span>
                          </div>
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Flat / House No.</label>
                              <input type="text" value={formData.presentFlat} onChange={(e) => handleChange('presentFlat', e.target.value)} placeholder="e.g. 304-B" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Building / Society Name</label>
                              <input type="text" value={formData.presentBuilding} onChange={(e) => handleChange('presentBuilding', e.target.value)} placeholder="e.g. Shanti Niwas" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Street / Road</label>
                              <input type="text" value={formData.presentStreet} onChange={(e) => handleChange('presentStreet', e.target.value)} placeholder="e.g. MG Road" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Area / Colony / Locality</label>
                              <input type="text" value={formData.presentArea} onChange={(e) => handleChange('presentArea', e.target.value)} placeholder="e.g. Bandra West" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Landmark</label>
                              <input type="text" value={formData.presentLandmark} onChange={(e) => handleChange('presentLandmark', e.target.value)} placeholder="e.g. Near City Mall" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">City / Town</label>
                              <input type="text" value={formData.presentCity} onChange={(e) => handleChange('presentCity', e.target.value)} placeholder="e.g. Mumbai" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">District</label>
                              <input type="text" value={formData.presentDistrict} onChange={(e) => handleChange('presentDistrict', e.target.value)} placeholder="e.g. Mumbai Suburban" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">State</label>
                              <select value={formData.presentState} onChange={(e) => handleChange('presentState', e.target.value)} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                <option value="">— Select State —</option>
                                {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">PIN Code</label>
                              <input type="text" inputMode="numeric" maxLength={6} value={formData.presentPin} onChange={(e) => handleChange('presentPin', e.target.value.replace(/\D/g, ''))} placeholder="6-digit PIN" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all font-mono tracking-widest" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Country</label>
                              <input type="text" value={formData.presentCountry} onChange={(e) => handleChange('presentCountry', e.target.value)} placeholder="Country" className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                          </div>
                        </div>

                        {/* Same address toggle */}
                        <label htmlFor="sameAddress" className="flex items-center gap-3 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 select-none">
                          <input type="checkbox" id="sameAddress" checked={formData.sameAsPresent} onChange={(e) => handleSameAddress(e.target.checked)} className="w-4 h-4 text-[#2E3093] rounded flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Permanent address is same as present address</p>
                            <p className="text-xs text-gray-500 mt-0.5">All fields will be copied automatically</p>
                          </div>
                        </label>

                        {/* Permanent Address */}
                        <div className={`rounded-xl border overflow-hidden transition-opacity ${formData.sameAsPresent ? 'border-gray-200 bg-gray-50/60 opacity-60 pointer-events-none' : 'border-green-200 bg-green-50/60'}`}>
                          <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${formData.sameAsPresent ? 'bg-gray-100 border-gray-200' : 'bg-green-100 border-green-200'}`}>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${formData.sameAsPresent ? 'bg-gray-400' : 'bg-green-600'}`}>
                              <i className="fas fa-map-pin text-white text-[9px]"></i>
                            </div>
                            <span className={`text-sm font-bold ${formData.sameAsPresent ? 'text-gray-500' : 'text-green-700'}`}>Permanent / Native Address</span>
                          </div>
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Flat / House No.</label>
                              <input type="text" value={formData.permanentFlat} onChange={(e) => handleChange('permanentFlat', e.target.value)} placeholder="e.g. 304-B" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Building / Society Name</label>
                              <input type="text" value={formData.permanentBuilding} onChange={(e) => handleChange('permanentBuilding', e.target.value)} placeholder="e.g. Shanti Niwas" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Street / Road</label>
                              <input type="text" value={formData.permanentStreet} onChange={(e) => handleChange('permanentStreet', e.target.value)} placeholder="e.g. MG Road" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Area / Colony / Locality</label>
                              <input type="text" value={formData.permanentArea} onChange={(e) => handleChange('permanentArea', e.target.value)} placeholder="e.g. Bandra West" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Landmark</label>
                              <input type="text" value={formData.permanentLandmark} onChange={(e) => handleChange('permanentLandmark', e.target.value)} placeholder="e.g. Near City Mall" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">City / Town</label>
                              <input type="text" value={formData.permanentCity} onChange={(e) => handleChange('permanentCity', e.target.value)} placeholder="e.g. Pune" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">District</label>
                              <input type="text" value={formData.permanentDistrict} onChange={(e) => handleChange('permanentDistrict', e.target.value)} placeholder="e.g. Pune" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">State</label>
                              <select value={formData.permanentState} onChange={(e) => handleChange('permanentState', e.target.value)} disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400">
                                <option value="">— Select State —</option>
                                {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">PIN Code</label>
                              <input type="text" inputMode="numeric" maxLength={6} value={formData.permanentPin} onChange={(e) => handleChange('permanentPin', e.target.value.replace(/\D/g, ''))} placeholder="6-digit PIN" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400 font-mono tracking-widest" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Country</label>
                              <input type="text" value={formData.permanentCountry} onChange={(e) => handleChange('permanentCountry', e.target.value)} placeholder="Country" disabled={formData.sameAsPresent} className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-100 disabled:text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Photo Upload */}
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-camera text-[#2A6BB5]"></i>
                          Photograph
                        </h3>
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex flex-col md:flex-row gap-4 items-start">
                            <div className="flex-shrink-0">
                              {formData.photoFile ? (
                                <div className="relative w-32 h-40 border-2 border-[#2A6BB5] rounded-lg overflow-hidden shadow-md">
                                  <img src={URL.createObjectURL(formData.photoFile)} alt="Preview" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => handleChange('photoFile', null)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all"
                                  >
                                    <i className="fas fa-times text-xs"></i>
                                  </button>
                                </div>
                              ) : (
                                <div className="w-32 h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-white">
                                  <i className="fas fa-user text-4xl text-gray-300 mb-2"></i>
                                  <span className="text-xs text-gray-400">No photo</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Upload Passport Size Photo</label>
                              <input
                                type="file"
                                onChange={(e) => handleChange('photoFile', e.target.files?.[0] || null)}
                                accept=".jpg,.jpeg,.png"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all"
                              />
                              {formData.photoFile && (
                                <span className="text-xs text-green-600 flex items-center gap-1 mt-2">
                                  <i className="fas fa-check-circle"></i>
                                  {formData.photoFile.name}
                                </span>
                              )}
                              <div className="mt-3 bg-white border border-blue-200 rounded-lg p-3">
                                <p className="text-xs font-semibold text-gray-800 mb-2">Photo Requirements:</p>
                                <ul className="text-xs text-gray-600 space-y-1">
                                  <li className="flex items-start gap-2">
                                    <i className="fas fa-check text-green-500 mt-0.5"></i>
                                    <span>Passport size photograph (recent)</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <i className="fas fa-check text-green-500 mt-0.5"></i>
                                    <span>Plain background (white/light colored)</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <i className="fas fa-check text-green-500 mt-0.5"></i>
                                    <span>JPG or PNG format, maximum 5MB</span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <i className="fas fa-check text-green-500 mt-0.5"></i>
                                    <span>Clear, front-facing, formal attire</span>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 2: Academic ── */}
                  {currentStep === 2 && (
                    <div className="space-y-4 sm:space-y-5" style={stepEnterStyle}>
                      {/* Tab Navigation */}
                      <div className="border-b border-gray-200 sm:border-b-gray-300 pb-2 sm:pb-0">
                        <div className="-mx-2.5 px-2.5 sm:mx-0 sm:px-0 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none]">
                          <div className="flex w-max min-w-full gap-2 sm:gap-3 pb-1 sm:pb-0 -mb-px pr-2 sm:pr-0">
                          <button
                            type="button"
                            onClick={() => setAcademicTab('ssc')}
                            className={`snap-center sm:snap-none px-3.5 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 rounded-full border shadow-sm ${
                              academicTab === 'ssc'
                                ? 'text-white bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-[#2A6BB5] shadow-[0_10px_24px_rgba(46,48,147,0.22)]'
                                : 'text-gray-600 bg-white border-gray-200 hover:text-[#2A6BB5] hover:border-gray-300 hover:shadow-md'
                            }`}
                          >
                            <i className="fas fa-school mr-1 sm:mr-2"></i>
                            <span className="hidden sm:inline">SSC (10th)</span><span className="sm:hidden">SSC</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('hsc')}
                            className={`snap-center sm:snap-none px-3.5 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 rounded-full border shadow-sm ${
                              academicTab === 'hsc'
                                ? 'text-white bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-[#2A6BB5] shadow-[0_10px_24px_rgba(46,48,147,0.22)]'
                                : 'text-gray-600 bg-white border-gray-200 hover:text-[#2A6BB5] hover:border-gray-300 hover:shadow-md'
                            }`}
                          >
                            <i className="fas fa-graduation-cap mr-1 sm:mr-2"></i>
                            <span className="hidden sm:inline">HSC (12th)</span><span className="sm:hidden">HSC</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('diploma')}
                            className={`snap-center sm:snap-none px-3.5 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 rounded-full border shadow-sm ${
                              academicTab === 'diploma'
                                ? 'text-white bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-[#2A6BB5] shadow-[0_10px_24px_rgba(46,48,147,0.22)]'
                                : 'text-gray-600 bg-white border-gray-200 hover:text-[#2A6BB5] hover:border-gray-300 hover:shadow-md'
                            }`}
                          >
                            <i className="fas fa-certificate mr-1 sm:mr-2"></i>
                            Diploma
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('graduation')}
                            className={`snap-center sm:snap-none px-3.5 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 rounded-full border shadow-sm ${
                              academicTab === 'graduation'
                                ? 'text-white bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-[#2A6BB5] shadow-[0_10px_24px_rgba(46,48,147,0.22)]'
                                : 'text-gray-600 bg-white border-gray-200 hover:text-[#2A6BB5] hover:border-gray-300 hover:shadow-md'
                            }`}
                          >
                            <i className="fas fa-user-graduate mr-1 sm:mr-2"></i>
                            <span className="hidden sm:inline">Graduation</span><span className="sm:hidden">Grad</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('postgrad')}
                            className={`snap-center sm:snap-none px-3.5 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 rounded-full border shadow-sm ${
                              academicTab === 'postgrad'
                                ? 'text-white bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-[#2A6BB5] shadow-[0_10px_24px_rgba(46,48,147,0.22)]'
                                : 'text-gray-600 bg-white border-gray-200 hover:text-[#2A6BB5] hover:border-gray-300 hover:shadow-md'
                            }`}
                          >
                            <i className="fas fa-award mr-1 sm:mr-2"></i>
                            <span className="hidden sm:inline">Post-Graduation</span><span className="sm:hidden">PG</span>
                          </button>
                          </div>
                        </div>
                      </div>

                      {/* SSC Tab */}
                      {academicTab === 'ssc' && (
                        <div className="space-y-4 sm:space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-school text-[#2A6BB5]"></i>
                              10th / SSC Education
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Board</label>
                                <select value={formData.ssc_board} onChange={(e) => handleChange('ssc_board', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Select Board</option>
                                  <option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">School Name</label>
                                <input type="text" value={formData.ssc_schoolName} onChange={(e) => handleChange('ssc_schoolName', e.target.value)} placeholder="Enter school name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year of Passing</label>
                                <input type="number" value={formData.ssc_yearOfPassing} onChange={(e) => handleChange('ssc_yearOfPassing', e.target.value)} placeholder="YYYY" min="1990" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Percentage / CGPA</label>
                                <input type="text" value={formData.ssc_percentage} onChange={(e) => handleChange('ssc_percentage', e.target.value)} placeholder="e.g. 85% or 8.5 CGPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  <i className="fas fa-file-upload text-[#2A6BB5] mr-1"></i>
                                  Upload SSC Marksheet / Certificate
                                </label>
                                <input
                                  type="file"
                                  onChange={(e) => handleChange('ssc_marksheetFile', e.target.files?.[0] || null)}
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all"
                                />
                                {formData.ssc_marksheetFile && (
                                  <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                    <i className="fas fa-check-circle"></i>
                                    {formData.ssc_marksheetFile.name}
                                  </span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                              </div>
                            </div>
                          </div>

                          {/* SSC KT Section */}
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                              KT / Backlog Details (SSC)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of KT Subjects (if any)</label>
                                <select value={formData.ssc_ktCount} onChange={(e) => handleChange('ssc_ktCount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="0">No KT</option>
                                  <option value="1">1 Subject</option><option value="2">2 Subjects</option>
                                  <option value="3">3 Subjects</option><option value="4">4 Subjects</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {parseInt(formData.ssc_ktCount) > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-700 mb-3">SSC KT Subject Details</h4>
                              <div className="space-y-4">
                                {formData.ssc_ktDetails.map((kt, index) => (
                                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                      <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{index + 1}</span>
                                      KT Subject {index + 1}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Name</label>
                                        <input type="text" value={kt.subjectName} onChange={(e) => handleKtDetailChange('ssc', index, 'subjectName', e.target.value)} placeholder="Enter subject name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year</label>
                                        <input type="number" value={kt.year} onChange={(e) => handleKtDetailChange('ssc', index, 'year', e.target.value)} placeholder="YYYY" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semester</label>
                                        <select value={kt.semester} onChange={(e) => handleKtDetailChange('ssc', index, 'semester', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                          <option value="">Select Semester</option>
                                          {[1,2].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cleared Year</label>
                                        <input type="number" value={kt.clearedYear} onChange={(e) => handleKtDetailChange('ssc', index, 'clearedYear', e.target.value)} placeholder="YYYY (if cleared)" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marks Obtained</label>
                                        <input type="number" value={kt.marks} onChange={(e) => handleKtDetailChange('ssc', index, 'marks', e.target.value)} placeholder="If cleared" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marksheet Upload</label>
                                        <input type="file" onChange={(e) => handleKtDetailChange('ssc', index, 'marksheetFile', e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all" />
                                        {kt.marksheetFile && <span className="text-xs text-green-600 flex items-center gap-1 mt-1"><i className="fas fa-check-circle"></i>{kt.marksheetFile.name}</span>}
                                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* HSC Tab */}
                      {academicTab === 'hsc' && (
                        <div className="space-y-4 sm:space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-graduation-cap text-[#2A6BB5]"></i>
                              12th / HSC / Higher Secondary Education
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Board</label>
                                <select value={formData.hsc_board} onChange={(e) => handleChange('hsc_board', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Select</option>
                                  <option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">College / Junior College Name</label>
                                <input type="text" value={formData.hsc_collegeName} onChange={(e) => handleChange('hsc_collegeName', e.target.value)} placeholder="Enter college name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Stream</label>
                                <select value={formData.hsc_stream} onChange={(e) => handleChange('hsc_stream', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Select</option>
                                  <option>Science</option><option>Commerce</option><option>Arts</option><option>Vocational</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year of Passing</label>
                                <input type="number" value={formData.hsc_yearOfPassing} onChange={(e) => handleChange('hsc_yearOfPassing', e.target.value)} placeholder="YYYY" min="1990" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Percentage / CGPA</label>
                                <input type="text" value={formData.hsc_percentage} onChange={(e) => handleChange('hsc_percentage', e.target.value)} placeholder="e.g. 75% or 7.5 CGPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  <i className="fas fa-file-upload text-[#2A6BB5] mr-1"></i>
                                  Upload HSC Marksheet / Certificate
                                </label>
                                <input
                                  type="file"
                                  onChange={(e) => handleChange('hsc_marksheetFile', e.target.files?.[0] || null)}
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all"
                                />
                                {formData.hsc_marksheetFile && (
                                  <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                    <i className="fas fa-check-circle"></i>
                                    {formData.hsc_marksheetFile.name}
                                  </span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                              KT / Backlog Details (HSC)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of KT Subjects (if any)</label>
                                <select value={formData.hsc_ktCount} onChange={(e) => handleChange('hsc_ktCount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="0">No KT</option>
                                  {[1,2,3,4].map(n => <option key={n} value={n}>{n} Subject{n>1?'s':''}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>

                          {parseInt(formData.hsc_ktCount) > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-700 mb-3">HSC KT Subject Details</h4>
                              <div className="space-y-4">
                                {formData.hsc_ktDetails.map((kt, index) => (
                                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                      <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{index + 1}</span>
                                      KT Subject {index + 1}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Name</label>
                                        <input type="text" value={kt.subjectName} onChange={(e) => handleKtDetailChange('hsc', index, 'subjectName', e.target.value)} placeholder="Enter subject name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year</label>
                                        <input type="number" value={kt.year} onChange={(e) => handleKtDetailChange('hsc', index, 'year', e.target.value)} placeholder="YYYY" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semester</label>
                                        <select value={kt.semester} onChange={(e) => handleKtDetailChange('hsc', index, 'semester', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                          <option value="">Select Semester</option>
                                          {[1,2].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cleared Year</label>
                                        <input type="number" value={kt.clearedYear} onChange={(e) => handleKtDetailChange('hsc', index, 'clearedYear', e.target.value)} placeholder="YYYY (if cleared)" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marks Obtained</label>
                                        <input type="number" value={kt.marks} onChange={(e) => handleKtDetailChange('hsc', index, 'marks', e.target.value)} placeholder="If cleared" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marksheet Upload</label>
                                        <input type="file" onChange={(e) => handleKtDetailChange('hsc', index, 'marksheetFile', e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all" />
                                        {kt.marksheetFile && <span className="text-xs text-green-600 flex items-center gap-1 mt-1"><i className="fas fa-check-circle"></i>{kt.marksheetFile.name}</span>}
                                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Diploma Tab */}
                      {academicTab === 'diploma' && (
                        <div className="space-y-4 sm:space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-certificate text-[#2A6BB5]"></i>
                              Diploma Education
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Diploma Degree</label>
                                <select value={formData.diploma_degree} onChange={(e) => handleChange('diploma_degree', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Please select</option>
                                  <option>Diploma</option><option>I.T.I.</option><option>Mech. Draughtsman</option><option>Civil Draughtsman</option><option>Piping Draftsman</option><option>Electronics</option><option>Electrical</option><option>OTHERS</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Specialization</label>
                                <select value={formData.diploma_specialization} onChange={(e) => handleChange('diploma_specialization', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Please select</option>
                                  <option>Mechanical</option><option>Chemical</option><option>Computers</option><option>Production</option><option>Electronics & Tele-Communication</option><option>Eletrical</option><option>Civil</option><option>Instrumentation</option><option>Petrochemical</option><option>Industrial</option><option>Automobile</option><option>Fabrication</option><option>N.C.T.V.T.</option><option>M.C.V.C</option><option>Refrigeration & Airconditioning</option><option>Electrical & Electronics</option><option>Fitter</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year of Passing</label>
                                <input type="number" value={formData.diploma_yearOfPassing} onChange={(e) => handleChange('diploma_yearOfPassing', e.target.value)} placeholder="YYYY" min="1990" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Institute Name</label>
                                <input type="text" value={formData.diploma_institute} onChange={(e) => handleChange('diploma_institute', e.target.value)} placeholder="Enter institute name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Percentage / CGPA</label>
                                <input type="text" value={formData.diploma_percentage} onChange={(e) => handleChange('diploma_percentage', e.target.value)} placeholder="e.g. 70% or 7.0 CGPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  <i className="fas fa-file-upload text-[#2A6BB5] mr-1"></i>
                                  Upload Diploma Marksheet / Certificate
                                </label>
                                <input
                                  type="file"
                                  onChange={(e) => handleChange('diploma_marksheetFile', e.target.files?.[0] || null)}
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all"
                                />
                                {formData.diploma_marksheetFile && (
                                  <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                    <i className="fas fa-check-circle"></i>
                                    {formData.diploma_marksheetFile.name}
                                  </span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                              KT / Backlog Details (Diploma)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of KT Subjects (if any)</label>
                                <select value={formData.diploma_ktCount} onChange={(e) => handleChange('diploma_ktCount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="0">No KT</option>
                                  {[1,2,3,4].map(n => <option key={n} value={n}>{n} Subject{n>1?'s':''}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>

                          {parseInt(formData.diploma_ktCount) > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-700 mb-3">Diploma KT Subject Details</h4>
                              <div className="space-y-4">
                                {formData.diploma_ktDetails.map((kt, index) => (
                                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                      <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{index + 1}</span>
                                      KT Subject {index + 1}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Name</label>
                                        <input type="text" value={kt.subjectName} onChange={(e) => handleKtDetailChange('diploma', index, 'subjectName', e.target.value)} placeholder="Enter subject name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year</label>
                                        <input type="number" value={kt.year} onChange={(e) => handleKtDetailChange('diploma', index, 'year', e.target.value)} placeholder="YYYY" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semester</label>
                                        <select value={kt.semester} onChange={(e) => handleKtDetailChange('diploma', index, 'semester', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                          <option value="">Select Semester</option>
                                          {[1,2,3,4,5,6].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cleared Year</label>
                                        <input type="number" value={kt.clearedYear} onChange={(e) => handleKtDetailChange('diploma', index, 'clearedYear', e.target.value)} placeholder="YYYY (if cleared)" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marks Obtained</label>
                                        <input type="number" value={kt.marks} onChange={(e) => handleKtDetailChange('diploma', index, 'marks', e.target.value)} placeholder="If cleared" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marksheet Upload</label>
                                        <input type="file" onChange={(e) => handleKtDetailChange('diploma', index, 'marksheetFile', e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all" />
                                        {kt.marksheetFile && <span className="text-xs text-green-600 flex items-center gap-1 mt-1"><i className="fas fa-check-circle"></i>{kt.marksheetFile.name}</span>}
                                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Graduation Tab */}
                      {academicTab === 'graduation' && (
                        <div className="space-y-4 sm:space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-user-graduate text-[#2A6BB5]"></i>
                              Graduation
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Graduation Degree</label>
                                <select value={formData.grad_degree} onChange={(e) => handleChange('grad_degree', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Please select</option>
                                  <option>B.SC</option><option>B.E.</option><option>B.TECH</option><option>B.COM</option><option>B.A.</option><option>BBA</option><option>BCA</option><option>OTHERS</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Specialization</label>
                                <select value={formData.grad_specialization} onChange={(e) => handleChange('grad_specialization', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Please select</option>
                                  <option>Mechanical</option><option>Chemical</option><option>Computers</option><option>Production</option><option>Electronics & Tele-Communication</option><option>Eletrical</option><option>Civil</option><option>Instrumentation</option><option>Petrochemical</option><option>Industrial</option><option>Automobile</option><option>Fabrication</option><option>N.C.T.V.T.</option><option>M.C.V.C</option><option>Refrigeration & Airconditioning</option><option>Electrical & Electronics</option><option>Fitter</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year of Passing</label>
                                <input type="number" value={formData.grad_yearOfPassing} onChange={(e) => handleChange('grad_yearOfPassing', e.target.value)} placeholder="YYYY" min="1990" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">University</label>
                                <input type="text" value={formData.grad_university} onChange={(e) => handleChange('grad_university', e.target.value)} placeholder="Enter university name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Percentage / CGPA</label>
                                <input type="text" value={formData.grad_percentage} onChange={(e) => handleChange('grad_percentage', e.target.value)} placeholder="e.g. 65% or 6.5 CGPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  <i className="fas fa-file-upload text-[#2A6BB5] mr-1"></i>
                                  Upload Graduation Marksheet / Certificate
                                </label>
                                <input
                                  type="file"
                                  onChange={(e) => handleChange('grad_marksheetFile', e.target.files?.[0] || null)}
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all"
                                />
                                {formData.grad_marksheetFile && (
                                  <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                    <i className="fas fa-check-circle"></i>
                                    {formData.grad_marksheetFile.name}
                                  </span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                              KT / Backlog Details (Graduation)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of KT Subjects (if any)</label>
                                <select value={formData.grad_ktCount} onChange={(e) => handleChange('grad_ktCount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="0">No KT</option>
                                  {[1,2,3,4].map(n => <option key={n} value={n}>{n} Subject{n>1?'s':''}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>

                          {parseInt(formData.grad_ktCount) > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-700 mb-3">Graduation KT Subject Details</h4>
                              <div className="space-y-4">
                                {formData.grad_ktDetails.map((kt, index) => (
                                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                      <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{index + 1}</span>
                                      KT Subject {index + 1}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Name</label>
                                        <input type="text" value={kt.subjectName} onChange={(e) => handleKtDetailChange('grad', index, 'subjectName', e.target.value)} placeholder="Enter subject name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year</label>
                                        <input type="number" value={kt.year} onChange={(e) => handleKtDetailChange('grad', index, 'year', e.target.value)} placeholder="YYYY" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semester</label>
                                        <select value={kt.semester} onChange={(e) => handleKtDetailChange('grad', index, 'semester', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                          <option value="">Select Semester</option>
                                          {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cleared Year</label>
                                        <input type="number" value={kt.clearedYear} onChange={(e) => handleKtDetailChange('grad', index, 'clearedYear', e.target.value)} placeholder="YYYY (if cleared)" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marks Obtained</label>
                                        <input type="number" value={kt.marks} onChange={(e) => handleKtDetailChange('grad', index, 'marks', e.target.value)} placeholder="If cleared" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marksheet Upload</label>
                                        <input type="file" onChange={(e) => handleKtDetailChange('grad', index, 'marksheetFile', e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all" />
                                        {kt.marksheetFile && <span className="text-xs text-green-600 flex items-center gap-1 mt-1"><i className="fas fa-check-circle"></i>{kt.marksheetFile.name}</span>}
                                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Post-Graduation Tab */}
                      {academicTab === 'postgrad' && (
                        <div className="space-y-4 sm:space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-award text-[#2A6BB5]"></i>
                              Post-Graduation
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Post-Graduation Degree</label>
                                <select value={formData.postgrad_degree} onChange={(e) => handleChange('postgrad_degree', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Please select</option>
                                  <option>M.E.</option><option>M.TECH</option><option>M.SC</option><option>MBA</option><option>M.COM</option><option>M.A.</option><option>MCA</option><option>PHD</option><option>OTHERS</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Specialization</label>
                                <select value={formData.postgrad_specialization} onChange={(e) => handleChange('postgrad_specialization', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="">Please select</option>
                                  <option>Mechanical</option><option>Chemical</option><option>Computers</option><option>Production</option><option>Electronics & Tele-Communication</option><option>Eletrical</option><option>Civil</option><option>Instrumentation</option><option>Petrochemical</option><option>Industrial</option><option>Automobile</option><option>Fabrication</option><option>N.C.T.V.T.</option><option>M.C.V.C</option><option>Refrigeration & Airconditioning</option><option>Electrical & Electronics</option><option>Fitter</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year of Passing</label>
                                <input type="number" value={formData.postgrad_yearOfPassing} onChange={(e) => handleChange('postgrad_yearOfPassing', e.target.value)} placeholder="YYYY" min="1990" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">University</label>
                                <input type="text" value={formData.postgrad_university} onChange={(e) => handleChange('postgrad_university', e.target.value)} placeholder="Enter university name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Percentage / CGPA</label>
                                <input type="text" value={formData.postgrad_percentage} onChange={(e) => handleChange('postgrad_percentage', e.target.value)} placeholder="e.g. 70% or 7.0 CGPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                              </div>
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  <i className="fas fa-file-upload text-[#2A6BB5] mr-1"></i>
                                  Upload Post-Graduation Marksheet / Certificate
                                </label>
                                <input
                                  type="file"
                                  onChange={(e) => handleChange('postgrad_marksheetFile', e.target.files?.[0] || null)}
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all"
                                />
                                {formData.postgrad_marksheetFile && (
                                  <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                    <i className="fas fa-check-circle"></i>
                                    {formData.postgrad_marksheetFile.name}
                                  </span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                              KT / Backlog Details (Post-Graduation)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of KT Subjects (if any)</label>
                                <select value={formData.postgrad_ktCount} onChange={(e) => handleChange('postgrad_ktCount', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                  <option value="0">No KT</option>
                                  {[1,2,3,4].map(n => <option key={n} value={n}>{n} Subject{n>1?'s':''}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>

                          {parseInt(formData.postgrad_ktCount) > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-700 mb-3">Post-Graduation KT Subject Details</h4>
                              <div className="space-y-4">
                                {formData.postgrad_ktDetails.map((kt, index) => (
                                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                      <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">{index + 1}</span>
                                      KT Subject {index + 1}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      <div className="lg:col-span-3">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Name</label>
                                        <input type="text" value={kt.subjectName} onChange={(e) => handleKtDetailChange('postgrad', index, 'subjectName', e.target.value)} placeholder="Enter subject name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year</label>
                                        <input type="number" value={kt.year} onChange={(e) => handleKtDetailChange('postgrad', index, 'year', e.target.value)} placeholder="YYYY" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semester</label>
                                        <select value={kt.semester} onChange={(e) => handleKtDetailChange('postgrad', index, 'semester', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                                          <option value="">Select Semester</option>
                                          {[1,2,3,4].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cleared Year</label>
                                        <input type="number" value={kt.clearedYear} onChange={(e) => handleKtDetailChange('postgrad', index, 'clearedYear', e.target.value)} placeholder="YYYY (if cleared)" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marks Obtained</label>
                                        <input type="number" value={kt.marks} onChange={(e) => handleKtDetailChange('postgrad', index, 'marks', e.target.value)} placeholder="If cleared" min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div className="lg:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Marksheet Upload</label>
                                        <input type="file" onChange={(e) => handleKtDetailChange('postgrad', index, 'marksheetFile', e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] transition-all" />
                                        {kt.marksheetFile && <span className="text-xs text-green-600 flex items-center gap-1 mt-1"><i className="fas fa-check-circle"></i>{kt.marksheetFile.name}</span>}
                                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG (max 5MB)</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Additional Remarks */}
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-comment-alt text-[#2A6BB5]"></i>
                          Additional Remarks
                        </h3>
                        <textarea value={formData.educationRemark} onChange={(e) => handleChange('educationRemark', e.target.value)} rows={3} placeholder="Any additional information about your educational qualifications" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none" />
                      </div>
                    </div>
                  )}

                  {/* ── STEP 3: Occupational Information ── */}
                  {currentStep === 3 && (
                    <div className="space-y-4 sm:space-y-5" style={stepEnterStyle}>
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-briefcase text-[#2A6BB5]"></i>
                          Occupational Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Current Occupational Status</label>
                            <select value={formData.occupationalStatus} onChange={(e) => handleChange('occupationalStatus', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                              <option value="">Select Occupational Status</option>
                              <option>Student</option><option>Employee</option><option>Self Employee</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {formData.occupationalStatus === 'Employee' && (
                        <div>
                          <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                            <i className="fas fa-building text-[#2A6BB5]"></i>
                            Current Job Data Information
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Job Organisation</label>
                              <input type="text" value={formData.jobOrganisation} onChange={(e) => handleChange('jobOrganisation', e.target.value)} placeholder="Enter organization name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Designation</label>
                              <input type="text" value={formData.jobDesignation} onChange={(e) => handleChange('jobDesignation', e.target.value)} placeholder="e.g., Software Engineer" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Work Experience</label>
                              <div className="grid grid-cols-3 gap-2">
                                <input type="number" value={formData.workingFromYears} onChange={(e) => handleChange('workingFromYears', e.target.value)} placeholder="Years" min="0" max="50" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                <input type="number" value={formData.workingFromMonths} onChange={(e) => handleChange('workingFromMonths', e.target.value)} placeholder="Months" min="0" max="11" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                <div className="relative">
                                  <input type="text" value={formData.totalOccupationYears ? `${formData.totalOccupationYears} yrs` : ''} readOnly placeholder="Total (auto)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
                                  {parseFloat(formData.totalOccupationYears) >= 10 && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                                      <i className="fas fa-exclamation text-white text-xs"></i>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Enter years and months in current job — Total calculated automatically</p>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Job Description</label>
                              <textarea value={formData.jobDescription} onChange={(e) => handleChange('jobDescription', e.target.value)} placeholder="Briefly describe your job role and responsibilities" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none" />
                            </div>
                          </div>

                        </div>
                      )}

                      {formData.occupationalStatus === 'Self Employee' && (
                        <div>
                          <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                            <i className="fas fa-user-tie text-[#2A6BB5]"></i>
                            Self Employment Details
                          </h3>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Business Details</label>
                              <textarea value={formData.selfEmploymentDetails} onChange={(e) => handleChange('selfEmploymentDetails', e.target.value)} placeholder="Describe your business, profession, or freelance work" rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none" />
                            </div>
                          </div>
                        </div>
                      )}

                      {requiresExperiencedConsent() && (
                        <div className={`mt-5 rounded-xl border-2 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3 ${
                          experiencedConsentAcknowledged ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'
                        }`}>
                          <div className="flex items-start gap-3 flex-1">
                            <i className={`fas ${
                              experiencedConsentAcknowledged ? 'fa-check-circle text-green-500' : 'fa-briefcase text-blue-500'
                            } text-lg flex-shrink-0 mt-0.5`}></i>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold ${experiencedConsentAcknowledged ? 'text-green-800' : 'text-blue-800'}`}>
                                {experiencedConsentAcknowledged ? 'Experienced Candidate Consent Acknowledged' : 'Experienced Candidate Consent Form Required'}
                              </p>
                              <p className={`text-xs mt-0.5 ${experiencedConsentAcknowledged ? 'text-green-700' : 'text-blue-700'}`}>
                                {experiencedConsentAcknowledged
                                  ? 'You have reviewed and accepted all consent declarations for experienced candidates.'
                                  : 'You have 10+ years of work experience. Please complete the consent form before continuing to training and payment.'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setConsentType('experienced'); setShowConsentModal(true); }}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all w-full sm:w-auto text-center ${
                              experiencedConsentAcknowledged
                                ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            {experiencedConsentAcknowledged ? 'Review' : 'Fill Consent Form'}
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* ── STEP 4: Training ── */}
                  {currentStep === 4 && (
                    <div className="space-y-4 sm:space-y-5" style={stepEnterStyle}>
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-chalkboard-teacher text-[#2A6BB5]"></i>
                          Training Programme Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* 1. Training Programme */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              Training Programme <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <select
                                value={formData.trainingProgrammeId}
                                onChange={(e) => handleProgrammeChange(e.target.value)}
                                disabled={loadingCourses}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-50"
                              >
                                <option value="">Please select</option>
                                {courses.map((c) => (
                                  <option key={c.Course_Id} value={String(c.Course_Id)}>{c.Course_Name}</option>
                                ))}
                              </select>
                              {loadingCourses && <div className="absolute right-8 top-1/2 -translate-y-1/2"><i className="fas fa-spinner fa-spin text-[#2A6BB5] text-xs"></i></div>}
                            </div>
                          </div>

                          {/* 2. Category */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              Select Category <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <select
                                value={formData.trainingCategory}
                                onChange={(e) => handleCategoryChange(e.target.value)}
                                disabled={!formData.trainingProgrammeId || loadingCategories}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-50"
                              >
                                <option value="">Select category</option>
                                {batchCategories.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              {loadingCategories && <div className="absolute right-8 top-1/2 -translate-y-1/2"><i className="fas fa-spinner fa-spin text-[#2A6BB5] text-xs"></i></div>}
                            </div>
                          </div>

                          {/* 3. Batch Code */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              Select Batch Code <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <select
                                value={formData.batchCode}
                                onChange={(e) => {
                                  handleChange('batchCode', e.target.value);
                                  const batch = availableBatches.find(b => b.batchCode === e.target.value);
                                  setBatchFees(batch?.totalFees != null ? parseFloat(String(batch.totalFees)) : null);
                                  setBatchFeesFullPayment(batch?.feesFullPayment != null ? parseFloat(String(batch.feesFullPayment)) : null);
                                  setBatchFeesInstallment(batch?.feesInstallment != null ? parseFloat(String(batch.feesInstallment)) : null);
                                }}
                                disabled={(!formData.trainingCategory && !formData.batchCode) || loadingBatches}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-50"
                              >
                                <option value="">Select batch code</option>
                                {formData.batchCode && !availableBatches.find(b => b.batchCode === formData.batchCode) && (
                                  <option value={formData.batchCode}>{formData.batchCode.toUpperCase()}</option>
                                )}
                                {availableBatches.map((b) => (
                                  <option key={b.batchCode} value={b.batchCode}>
                                    {b.batchCode.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                              {loadingBatches && <div className="absolute right-8 top-1/2 -translate-y-1/2"><i className="fas fa-spinner fa-spin text-[#2A6BB5] text-xs"></i></div>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Consent Form Banner — triggers when Student doesn't meet course eligibility */}
                      {requiresStudentConsent() && (
                        <div className={`mt-5 rounded-xl border-2 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3 ${
                          consentAcknowledged ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'
                        }`}>
                          <div className="flex items-start gap-3 flex-1">
                            <i className={`fas ${
                              consentAcknowledged ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-orange-500'
                            } text-lg flex-shrink-0 mt-0.5`}></i>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold ${consentAcknowledged ? 'text-green-800' : 'text-orange-800'}`}>
                                {consentAcknowledged ? 'Consent Form Acknowledged' : 'Educational Consent Form Required'}
                              </p>
                              <p className={`text-xs mt-0.5 ${consentAcknowledged ? 'text-green-700' : 'text-orange-700'}`}>
                                {consentAcknowledged
                                  ? 'You have reviewed and accepted all consent declarations.'
                                  : 'Your educational background does not match the selected training program eligibility. Please complete the consent form.'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setConsentType('student'); setShowConsentModal(true); }}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all w-full sm:w-auto text-center ${
                              consentAcknowledged
                                ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {consentAcknowledged ? 'Review' : 'Fill Consent Form'}
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* ── STEP 5: Mode of Payment ── */}
                  {currentStep === 7 && (() => {
                    const baseFees = batchFees ?? 0;
                    const hasFees = baseFees > 0;
                    const fullPayAmount = Math.round(baseFees * 0.95);
                    const discount = Math.max(baseFees - fullPayAmount, 0);
                    const installmentPlanTotal = batchFeesInstallment ?? baseFees;
                    const firstInstallmentAmount = Math.round(installmentPlanTotal / 2);
                    const secondInstallmentAmount = Math.max(installmentPlanTotal - firstInstallmentAmount, 0);
                    const fmt = (n: number) => n.toLocaleString('en-IN');
                    const isPipingFulltime =
                      /piping\s+engineering/i.test(formData.trainingProgrammeName || '') &&
                      /full.?time/i.test(formData.trainingCategory || '');
                    const isPipingEngineeringFulltime =
                      /piping\s+engineering/i.test(formData.trainingProgrammeName || '') &&
                      /full.?time/i.test(formData.trainingCategory || '');
                    const isEngineeringDesignDraftingFulltime =
                      /engineering\s+design.*drafting/i.test(formData.trainingProgrammeName || '') &&
                      /full.?time/i.test(formData.trainingCategory || '');
                    const isPipingWeekend =
                      /piping\s+engineering/i.test(formData.trainingProgrammeName || '') &&
                      /weekend/i.test(formData.trainingCategory || '');
                    const isEDDFulltime =
                      /engineering\s+design.*drafting/i.test(formData.trainingProgrammeName || '') &&
                      /full.?time/i.test(formData.trainingCategory || '');
                    const isPDD = /piping\s+design.*drafting/i.test(formData.trainingProgrammeName || '');
                    const isProcessWeekend = /process\s+engineering/i.test(formData.trainingProgrammeName || '') && /weekend/i.test(formData.trainingCategory || '');
                    const is75kPlan = isPipingWeekend || isEDDFulltime || isPDD;
                    const payableNow =
                      (formData.modeOfPayment === 'Full Payment'
                        ? fullPayAmount
                        : formData.modeOfPayment === '3-Installment Plan'
                        ? (isProcessWeekend ? 15000 : 25000)
                        : formData.modeOfPayment === '2-Payment Plan'
                        ? 15000
                        : formData.modeOfPayment === '6-Installment Plan'
                        ? 15000
                        : formData.modeOfPayment === 'Loan (0% Interest)'
                        ? (isPipingEngineeringFulltime ? 12000 : ((isEngineeringDesignDraftingFulltime || isProcessWeekend || is75kPlan) ? 15000 : 12000))
                        : firstInstallmentAmount) + (formData.modeOfPayment ? ALUMNI_MEMBERSHIP_FEE : 0);

                    return (
                    <div className="space-y-4 sm:space-y-5" style={stepEnterStyle}>
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-1 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-credit-card text-[#2A6BB5]"></i>
                          Mode of Payment
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Please select your preferred mode of payment for the training programme fees.</p>
                      </div>

                      {/* Fees indicator */}
                      {hasFees ? (
                        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl p-4 text-white flex items-center justify-between">
                          <div>
                            <p className="text-xs text-white/70 font-medium">Total Fees — {formData.batchCode}</p>
                            <p className="text-2xl font-extrabold mt-0.5">&#8377;{fmt(baseFees)}</p>
                            <p className="text-[11px] text-white/70 mt-1">+ &#8377;{ALUMNI_MEMBERSHIP_FEE} One Time Membership Fee (Sitians Alumni Association) — included at admission</p>
                          </div>
                          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
                            <i className="fas fa-rupee-sign text-xl text-[#FAE452]"></i>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                          <i className="fas fa-exclamation-triangle text-amber-500 flex-shrink-0"></i>
                          <div>
                            <p className="text-sm font-semibold text-amber-800">Fees Not Available</p>
                            <p className="text-xs text-amber-700 mt-0.5">Please select a Training Programme and Batch Code in Step 4 to view applicable fees.</p>
                          </div>
                        </div>
                      )}

                      {/* Payment Options */}
                      <div className="space-y-3">
                        {/* Option 1: Full Payment with 5% discount */}
                        {(() => {
                          const isSelected = formData.modeOfPayment === 'Full Payment';
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange('modeOfPayment', 'Full Payment')}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-money-bill-wave text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-bold ${isSelected ? 'text-emerald-800' : 'text-gray-800'}`}>Full Payment</span>
                                    {discount > 0 && <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{baseFees > 0 ? Math.round((discount / baseFees) * 100) : 0}% OFF</span>}
                                  </div>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`}>
                                    Pay &#8377;{fmt(fullPayAmount + ALUMNI_MEMBERSHIP_FEE)} in one go <span className="line-through text-gray-400">&#8377;{fmt(baseFees)}</span> — save &#8377;{fmt(discount)}
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 ml-[52px] bg-emerald-100/50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-emerald-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-emerald-400"></i>Tuition Fee</span>
                                    <span className="font-bold text-emerald-800">&#8377;{fmt(baseFees)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-emerald-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-emerald-400"></i>Discount (5% on Tuition Fee)</span>
                                    <span className="font-bold text-emerald-800">-&#8377;{fmt(discount)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-emerald-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-emerald-400"></i>One Time Membership Fee (Sitians Alumni Association)</span>
                                    <span className="font-bold text-emerald-800">&#8377;{fmt(ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="border-t border-emerald-200 pt-2 flex items-center justify-between text-xs">
                                    <span className="text-emerald-800 font-bold">Total (pay now)</span>
                                    <span className="font-extrabold text-emerald-900">&#8377;{fmt(fullPayAmount + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })()}

                        {/* Process Engineering Weekend only: 2-Payment Plan */}
                        {isProcessWeekend && (() => {
                          const isSelected = formData.modeOfPayment === '2-Payment Plan';
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange('modeOfPayment', '2-Payment Plan')}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-hand-holding-usd text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-bold ${isSelected ? 'text-teal-800' : 'text-gray-800'}`}>2-Payment Plan</span>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-teal-600' : 'text-gray-500'}`}>
                                    &#8377;{fmt(15000 + ALUMNI_MEMBERSHIP_FEE)} at admission + &#8377;35,000 on first day of batch
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-teal-500 bg-teal-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 ml-[52px] bg-teal-100/50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-teal-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-teal-400"></i>Tuition Fee</span>
                                    <span className="font-bold text-teal-800">&#8377;50,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-teal-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-teal-400"></i>One Time Membership Fee (Sitians Alumni Association)</span>
                                    <span className="font-bold text-teal-800">&#8377;{fmt(ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-teal-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-teal-400"></i>At Admission (pay now)</span>
                                    <span className="font-bold text-teal-800">&#8377;{fmt(15000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-teal-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-teal-400"></i>On first day of batch starting</span>
                                    <span className="font-bold text-teal-800">&#8377;35,000</span>
                                  </div>
                                  <div className="border-t border-teal-200 pt-2 flex items-center justify-between text-xs">
                                    <span className="text-teal-800 font-bold">Total</span>
                                    <span className="font-extrabold text-teal-900">&#8377;{fmt(50000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-start gap-1.5 pt-1">
                                    <i className="fas fa-exclamation-circle text-teal-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                                    <p className="text-[10px] text-teal-700">Delay charges of &#8377;2,500 apply if the second payment is not made on time.</p>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })()}

                        {/* Option 2/3: Installment Plan */}
                        {isProcessWeekend ? (() => {
                          const isSelected = formData.modeOfPayment === '3-Installment Plan';
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange('modeOfPayment', '3-Installment Plan')}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-calendar-check text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-bold ${isSelected ? 'text-violet-800' : 'text-gray-800'}`}>3-Installment Plan</span>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-violet-600' : 'text-gray-500'}`}>
                                    &#8377;{fmt(15000 + ALUMNI_MEMBERSHIP_FEE)} at admission + &#8377;17,500 × 2 — total &#8377;{fmt(50000 + ALUMNI_MEMBERSHIP_FEE)}
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-violet-500 bg-violet-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 ml-[52px] bg-violet-100/50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>Tuition Fee</span>
                                    <span className="font-bold text-violet-800">&#8377;50,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>One Time Membership Fee (Sitians Alumni Association)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>At Admission (pay now)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(15000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>1st Instalment (30 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;17,500</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>2nd Instalment (60 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;17,500</span>
                                  </div>
                                  <div className="border-t border-violet-200 pt-2 flex items-center justify-between text-xs">
                                    <span className="text-violet-800 font-bold">Total</span>
                                    <span className="font-extrabold text-violet-900">&#8377;{fmt(50000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-start gap-1.5 pt-1">
                                    <i className="fas fa-exclamation-circle text-violet-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                                    <p className="text-[10px] text-violet-700">Delay charges of &#8377;2,500 apply per instalment if payment is not made on time.</p>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })() : is75kPlan ? (() => {
                          const isSelected = formData.modeOfPayment === '6-Installment Plan';
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange('modeOfPayment', '6-Installment Plan')}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-calendar-check text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-bold ${isSelected ? 'text-violet-800' : 'text-gray-800'}`}>6-Installment Plan</span>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-violet-600' : 'text-gray-500'}`}>
                                    &#8377;{fmt(15000 + ALUMNI_MEMBERSHIP_FEE)} at admission + &#8377;12,000 × 5 — total &#8377;{fmt(75000 + ALUMNI_MEMBERSHIP_FEE)}
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-violet-500 bg-violet-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 ml-[52px] bg-violet-100/50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>Tuition Fee</span>
                                    <span className="font-bold text-violet-800">&#8377;75,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>One Time Membership Fee (Sitians Alumni Association)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>At Admission (pay now)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(15000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>1st Instalment (30 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;12,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>2nd Instalment (60 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;12,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>3rd Instalment (90 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;12,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>4th Instalment (120 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;12,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>5th Instalment (150 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;12,000</span>
                                  </div>
                                  <div className="border-t border-violet-200 pt-2 flex items-center justify-between text-xs">
                                    <span className="text-violet-800 font-bold">Total</span>
                                    <span className="font-extrabold text-violet-900">&#8377;{fmt(75000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-start gap-1.5 pt-1">
                                    <i className="fas fa-exclamation-circle text-violet-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                                    <p className="text-[10px] text-violet-700">Delay charges of &#8377;2,500 apply per instalment if payment is not made on time.</p>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })() : isPipingFulltime ? (() => {
                          const isSelected = formData.modeOfPayment === '3-Installment Plan';
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange('modeOfPayment', '3-Installment Plan')}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-calendar-check text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-bold ${isSelected ? 'text-violet-800' : 'text-gray-800'}`}>3-Installment Plan</span>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-violet-600' : 'text-gray-500'}`}>
                                    &#8377;{fmt(25000 + ALUMNI_MEMBERSHIP_FEE)} at admission + &#8377;43,500 × 2 — total &#8377;{fmt(112000 + ALUMNI_MEMBERSHIP_FEE)}
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-violet-500 bg-violet-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 ml-[52px] bg-violet-100/50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>Tuition Fee</span>
                                    <span className="font-bold text-violet-800">&#8377;1,12,000</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>One Time Membership Fee (Sitians Alumni Association)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>At Admission (pay now)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(25000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>1st Instalment (30 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;43,500</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>2nd Instalment (60 days from batch start)</span>
                                    <span className="font-bold text-violet-800">&#8377;43,500</span>
                                  </div>
                                  <div className="border-t border-violet-200 pt-2 flex items-center justify-between text-xs">
                                    <span className="text-violet-800 font-bold">Total</span>
                                    <span className="font-extrabold text-violet-900">&#8377;{fmt(112000 + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-start gap-1.5 pt-1">
                                    <i className="fas fa-exclamation-circle text-violet-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                                    <p className="text-[10px] text-violet-700">Delay charges of &#8377;2,500 apply per instalment if payment is not made on time.</p>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })() : null}

                        {/* Pay in 2 Installments — available for ALL training programmes */}
                        {(() => {
                          const isSelected = formData.modeOfPayment === '50% Installment';
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange('modeOfPayment', '50% Installment')}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-calendar-check text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm font-bold ${isSelected ? 'text-violet-800' : 'text-gray-800'}`}>Pay in 2 Installments</span>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-violet-600' : 'text-gray-500'}`}>
                                    Pay &#8377;{fmt(firstInstallmentAmount + ALUMNI_MEMBERSHIP_FEE)} now + &#8377;{fmt(secondInstallmentAmount)} later — total &#8377;{fmt(installmentPlanTotal + ALUMNI_MEMBERSHIP_FEE)}
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-violet-500 bg-violet-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 ml-[52px] bg-violet-100/50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>Tuition Fee</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(installmentPlanTotal)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>One Time Membership Fee (Sitians Alumni Association)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>1st Installment (now)</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(firstInstallmentAmount + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-violet-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-violet-400"></i>2nd Installment</span>
                                    <span className="font-bold text-violet-800">&#8377;{fmt(secondInstallmentAmount)}</span>
                                  </div>
                                  <div className="border-t border-violet-200 pt-2 flex items-center justify-between text-xs">
                                    <span className="text-violet-800 font-bold">Total</span>
                                    <span className="font-extrabold text-violet-900">&#8377;{fmt(installmentPlanTotal + ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })()}

                        {/* Pay by QR sub-method choice — shown after any fee plan is selected (not Pay at Office) */}
                        {formData.modeOfPayment && formData.modeOfPayment !== 'Pay at Office' && (
                          <div className="mt-1 rounded-xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <i className="fas fa-credit-card text-slate-400"></i>
                              How would you like to pay?
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Pay Online (Razorpay) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentSubMethod('razorpay');
                                  setUpiTransferConfirmed(false);
                                  setUpiTransferReference('');
                                  setNeftTransactionNumber('');
                                }}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                  paymentSubMethod === 'razorpay'
                                    ? 'border-[#2E3093] bg-[#2E3093]/5 ring-2 ring-[#2E3093]/20'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${paymentSubMethod === 'razorpay' ? 'bg-[#2E3093]/10 text-[#2E3093]' : 'bg-gray-100 text-gray-400'}`}>
                                  <i className="fas fa-credit-card text-base"></i>
                                </div>
                                <div className="text-center">
                                  <div className={`text-xs font-bold ${paymentSubMethod === 'razorpay' ? 'text-[#2E3093]' : 'text-gray-700'}`}>Pay Online</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">Card / Net Banking / UPI</div>
                                </div>
                                {paymentSubMethod === 'razorpay' && <div className="w-4 h-4 rounded-full bg-[#2E3093] flex items-center justify-center"><i className="fas fa-check text-white text-[8px]"></i></div>}
                              </button>

                              {/* Pay by QR */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentSubMethod('qr');
                                  setRazorpayPaid(false);
                                  setRazorpayPaymentId('');
                                  setRazorpayOrderId('');
                                  setRazorpaySignature('');
                                  setNeftTransactionNumber('');
                                }}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                  paymentSubMethod === 'qr'
                                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${paymentSubMethod === 'qr' ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-400'}`}>
                                  <i className="fas fa-qrcode text-base"></i>
                                </div>
                                <div className="text-center">
                                  <div className={`text-xs font-bold ${paymentSubMethod === 'qr' ? 'text-sky-900' : 'text-gray-700'}`}>Pay by QR</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">Scan &amp; pay via UPI app</div>
                                </div>
                                {paymentSubMethod === 'qr' && <div className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center"><i className="fas fa-check text-white text-[8px]"></i></div>}
                              </button>

                              {/* Pay by NEFT */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentSubMethod('neft');
                                  setRazorpayPaid(false);
                                  setRazorpayPaymentId('');
                                  setRazorpayOrderId('');
                                  setRazorpaySignature('');
                                  setUpiTransferConfirmed(false);
                                  setUpiTransferReference('');
                                }}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                  paymentSubMethod === 'neft'
                                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${paymentSubMethod === 'neft' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                                  <i className="fas fa-university text-base"></i>
                                </div>
                                <div className="text-center">
                                  <div className={`text-xs font-bold ${paymentSubMethod === 'neft' ? 'text-emerald-900' : 'text-gray-700'}`}>Pay by NEFT</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">Bank transfer</div>
                                </div>
                                {paymentSubMethod === 'neft' && <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><i className="fas fa-check text-white text-[8px]"></i></div>}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Option 3/4: Loan (Piping / EDD / PDD / Process Weekend) */}
                        {(isPipingFulltime || is75kPlan || isProcessWeekend) && (() => {
                          const isSelected = formData.modeOfPayment === 'Loan (0% Interest)';
                          const loanAdmissionBase = isPipingEngineeringFulltime ? 12000 : ((isEngineeringDesignDraftingFulltime || isProcessWeekend || is75kPlan) ? 15000 : 12000);
                          const loanAdmission = loanAdmissionBase + ALUMNI_MEMBERSHIP_FEE;
                          const loanAmount = isProcessWeekend ? 35000 : is75kPlan ? 60000 : 100000;
                          const loanTuitionFee = loanAdmissionBase + loanAmount;
                          const loanTotal = loanAdmission + loanAmount;
                          const fmtLoan = (n: number) => n.toLocaleString('en-IN');
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange('modeOfPayment', 'Loan (0% Interest)')}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-university text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-bold ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>0% Interest Loan</span>
                                    <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">0% Interest</span>
                                  </div>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                                    Pay &#8377;{fmtLoan(loanAdmission)} at admission + &#8377;{fmtLoan(loanAmount)} via financial institution loan
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 ml-[52px] bg-blue-100/50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-blue-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-blue-400"></i>Tuition Fee</span>
                                    <span className="font-bold text-blue-800">&#8377;{fmtLoan(loanTuitionFee)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-blue-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-blue-400"></i>One Time Membership Fee (Sitians Alumni Association)</span>
                                    <span className="font-bold text-blue-800">&#8377;{fmtLoan(ALUMNI_MEMBERSHIP_FEE)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-blue-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-blue-400"></i>At Admission (pay now)</span>
                                    <span className="font-bold text-blue-800">&#8377;{fmtLoan(loanAdmission)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-blue-700 font-medium flex items-center gap-1.5"><i className="fas fa-circle text-[6px] text-blue-400"></i>Loan (via financial institution)</span>
                                    <span className="font-bold text-blue-800">&#8377;{fmtLoan(loanAmount)}</span>
                                  </div>
                                  <div className="border-t border-blue-200 pt-2 flex items-center justify-between text-xs">
                                    <span className="text-blue-800 font-bold">Total</span>
                                    <span className="font-extrabold text-blue-900">&#8377;{fmtLoan(loanTotal)}</span>
                                  </div>
                                  <div className="flex items-start gap-1.5 pt-1">
                                    <i className="fas fa-info-circle text-blue-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                                    <p className="text-[10px] text-blue-700">Includes &#8377;{ALUMNI_MEMBERSHIP_FEE} One Time Membership Fee (Sitians Alumni Association). Loan approval is subject to the financial institution. If the loan is not approved, the student must pay the remaining fees independently. No refund will be made if the student leaves the batch during the training programme.</p>
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })()}

                        {/* Option: Pay at Office (Password Override) */}
                        {(() => {
                          const isSelected = formData.modeOfPayment === 'Pay at Office';
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (payAtOfficeVerified) {
                                  setFormData(prev => ({ ...prev, modeOfPayment: 'Pay at Office' }));
                                  setRazorpayPaid(false);
                                  setRazorpayPaymentId('');
                                  setRazorpayOrderId('');
                                  setRazorpaySignature('');
                                  setUpiTransferConfirmed(false);
                                  setUpiTransferReference('');
                                  setNeftTransactionNumber('');
                                } else {
                                  setShowPayAtOfficeModal(true);
                                }
                              }}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                                isSelected
                                  ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 shadow-md'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  <i className="fas fa-building text-lg"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-bold ${isSelected ? 'text-amber-900' : 'text-gray-800'}`}>Pay at Office</span>
                                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">Override</span>
                                  </div>
                                  <div className={`text-xs mt-0.5 ${isSelected ? 'text-amber-700' : 'text-gray-500'}`}>
                                    Offline payment at office counter. Requires password approval.
                                  </div>
                                  {!payAtOfficeVerified && (
                                    <div className="text-[10px] mt-1 text-amber-700">Click to enter override password.</div>
                                  )}
                                  {payAtOfficeVerified && (
                                    <div className="text-[10px] mt-1 text-green-700 font-semibold">Override verified.</div>
                                  )}
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'border-amber-500 bg-amber-50' : 'border-gray-300'
                                }`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                                </div>
                              </div>
                            </button>
                          );
                        })()}
                      </div>

                      {/* Selected summary */}
                      {formData.modeOfPayment && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                          <i className="fas fa-check-circle text-green-500 text-lg flex-shrink-0"></i>
                          <div>
                            <p className="text-sm font-semibold text-green-800">Payment Method Selected</p>
                            <p className="text-xs text-green-700 mt-0.5">
                              You have selected <span className="font-bold">{formData.modeOfPayment}</span>
                              {formData.modeOfPayment === 'Full Payment' && <> — you pay <span className="font-bold">&#8377;{fmt(payableNow)}</span> (5% discount applied on Tuition Fee, plus &#8377;{ALUMNI_MEMBERSHIP_FEE} Membership Fee)</>}
                              {formData.modeOfPayment === '50% Installment' && <> — &#8377;{fmt(payableNow)} now + &#8377;{fmt(secondInstallmentAmount)} later</>}
                              {formData.modeOfPayment === '3-Installment Plan' && <> — {isProcessWeekend ? `₹${fmt(payableNow)} now + ₹17,500 × 2 instalments` : `₹${fmt(payableNow)} now + ₹43,500 × 2 instalments`}</>}
                              {formData.modeOfPayment === '2-Payment Plan' && <> — &#8377;{fmt(payableNow)} now + &#8377;35,000 on first day of batch</>}
                              {formData.modeOfPayment === '6-Installment Plan' && <> — &#8377;{fmt(payableNow)} now + &#8377;12,000 × 5 instalments</>}
                              {formData.modeOfPayment === 'Loan (0% Interest)' && <> — &#8377;{fmt(payableNow)} at admission + &#8377;{isProcessWeekend ? '35,000' : is75kPlan ? '60,000' : '1,00,000'} loan via financial institution</>}
                              {paymentSubMethod === 'qr' && <> — pay &#8377;{fmt(payableNow)} via QR code / UPI.</>}
                              {paymentSubMethod === 'neft' && <> — pay &#8377;{fmt(payableNow)} by NEFT.</>}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Pay by NEFT */}
                      {paymentSubMethod === 'neft' && (
                        <div className="rounded-xl p-4 space-y-3 border-2 border-emerald-300 bg-emerald-50">
                          <p className="text-xs font-semibold text-emerald-900 flex items-center gap-2">
                            <i className="fas fa-university"></i>
                            Pay by NEFT — transfer &#8377;{fmt(payableNow)}
                          </p>
                          <div className="rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-700 space-y-1.5">
                            <p><span className="font-semibold text-slate-900">Bank -</span> {NEFT_BANK_DETAILS.bank}</p>
                            <p><span className="font-semibold text-slate-900">Add. -</span> {NEFT_BANK_DETAILS.address}</p>
                            <p><span className="font-semibold text-slate-900">A/c No.</span> {NEFT_BANK_DETAILS.accountNumber}</p>
                            <p><span className="font-semibold text-slate-900">IFS CODE :</span> {NEFT_BANK_DETAILS.ifsCode}.</p>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">NEFT Transaction Number <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              value={neftTransactionNumber}
                              onChange={(e) => setNeftTransactionNumber(e.target.value)}
                              placeholder="Enter NEFT transaction number"
                              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              required={paymentSubMethod === 'neft'}
                            />
                          </div>
                        </div>
                      )}

                      {/* Pay by QR confirmation */}
                      {paymentSubMethod === 'qr' && (
                        <div className={`rounded-xl p-4 space-y-3 border-2 ${upiTransferConfirmed ? 'border-emerald-400 bg-emerald-50' : 'border-sky-300 bg-sky-50'}`}>
                          <p className="text-xs font-semibold text-sky-900 flex items-center gap-2">
                            <i className="fas fa-qrcode"></i>
                            Pay by QR — scan &amp; transfer &#8377;{fmt(payableNow)}
                          </p>
                          <p className="text-xs text-slate-700">
                            Scan the QR code below from any UPI app and transfer the amount shown above.
                          </p>
                          <div className="rounded-xl border border-sky-200 bg-white p-3 flex flex-col items-center gap-3">
                            <Image
                              src="/phot.jpg"
                              alt="Direct UPI Transfer QR"
                              width={260}
                              height={330}
                              className="rounded-lg border border-slate-200"
                            />
                            <p className="text-[11px] text-slate-600 text-center">
                              Account Ref: 037326012440007 | 54972698
                            </p>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">UPI Reference / UTR (optional)</label>
                            <input
                              type="text"
                              value={upiTransferReference}
                              onChange={(e) => setUpiTransferReference(e.target.value)}
                              placeholder="Enter UTR or transaction reference"
                              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-200"
                            />
                          </div>
                          <label className="flex items-start gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={upiTransferConfirmed}
                              onChange={(e) => setUpiTransferConfirmed(e.target.checked)}
                              className="mt-0.5"
                            />
                            I confirm that I have completed the Direct UPI transfer for this admission.
                          </label>
                        </div>
                      )}

                      {/* ── Razorpay payment ── */}
                      {paymentSubMethod === 'razorpay' && (
                        <div className={`rounded-xl p-4 space-y-3 border-2 ${razorpayPaid ? 'border-emerald-400 bg-emerald-50' : 'border-[#2E3093] bg-[#2E3093]/5'}`}>
                          {razorpayPaid ? (
                            <div className="flex items-center gap-3">
                              <i className="fas fa-check-circle text-emerald-600 text-2xl flex-shrink-0"></i>
                              <div>
                                <p className="text-sm font-bold text-emerald-800">Payment Confirmed!</p>

                            {formData.modeOfPayment === 'Pay at Office' && (
                              <div className={`rounded-xl p-4 space-y-2 border-2 ${payAtOfficeVerified ? 'border-emerald-400 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                                <p className={`text-xs font-semibold flex items-center gap-2 ${payAtOfficeVerified ? 'text-emerald-800' : 'text-amber-800'}`}>
                                  <i className={`fas ${payAtOfficeVerified ? 'fa-check-circle' : 'fa-shield-alt'}`}></i>
                                  {payAtOfficeVerified ? 'Pay at Office override approved' : 'Override approval required'}
                                </p>
                                <p className="text-xs text-gray-700">
                                  {payAtOfficeVerified
                                    ? 'This application can proceed without online payment. Fees will be collected at office.'
                                    : 'Enter the override password to allow offline payment and continue to Terms & Conditions.'}
                                </p>
                                {!payAtOfficeVerified && (
                                  <button
                                    type="button"
                                    onClick={() => setShowPayAtOfficeModal(true)}
                                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all"
                                  >
                                    Enter Override Password
                                  </button>
                                )}
                              </div>
                            )}
                                <p className="text-xs text-emerald-700 mt-0.5">
                                  &#8377;{fmt(payableNow)} paid successfully.
                                </p>
                                <p className="text-[11px] text-emerald-600 font-mono mt-0.5">Ref: {razorpayPaymentId}</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-semibold text-[#2E3093] flex items-center gap-2">
                                <i className="fas fa-exclamation-circle"></i>
                                Payment required to proceed
                              </p>
                              <p className="text-xs text-gray-600">
                                You must pay online before submitting your application.
                              </p>
                              <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                Convenience charges to be borne by the user.
                              </p>
                              {!hasFees && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Please select a batch in Step 4 first — fee amount is not yet available.
                                </p>
                              )}
                              {hasFees && (
                                <button
                                  type="button"
                                  onClick={handleRazorpayPayment}
                                  disabled={paymentLoading}
                                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm bg-[#2E3093] text-white hover:bg-[#252780] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
                                >
                                  {paymentLoading ? (
                                    <><i className="fas fa-spinner fa-spin"></i> Opening Payment…</>
                                  ) : (
                                    <>
                                      <i className="fas fa-lock"></i>
                                      Pay &#8377;{fmt(payableNow)} with Razorpay
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* ── STEP 5: Medical History ── */}
                  {currentStep === 5 && (
                    <div className="space-y-4 sm:space-y-5" style={stepEnterStyle}>
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-1 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-notes-medical text-[#2A6BB5]"></i>
                          Medical History
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Do you have any medical history (existing condition, allergy, ongoing treatment, etc.) we should be aware of?</p>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
                        <label className="block text-sm font-semibold text-gray-700">
                          Any medical history? <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {(['yes', 'no'] as const).map((opt) => (
                            <label
                              key={opt}
                              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                                formData.hasMedicalHistory === opt
                                  ? 'border-[#2E3093] bg-[#2E3093]/5 text-[#2E3093] font-semibold'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="hasMedicalHistory"
                                value={opt}
                                checked={formData.hasMedicalHistory === opt}
                                onChange={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    hasMedicalHistory: opt,
                                    // Clear the description if the answer is switched to "No"
                                    medicalHistoryDescription: opt === 'no' ? '' : prev.medicalHistoryDescription,
                                  }))
                                }
                                className="accent-[#2E3093]"
                              />
                              {opt === 'yes' ? 'Yes' : 'No'}
                            </label>
                          ))}
                        </div>

                        {formData.hasMedicalHistory === 'yes' && (
                          <div style={stepEnterStyle}>
                            <label htmlFor="medicalHistoryDescription" className="block text-sm font-semibold text-gray-700 mb-1.5">
                              Please describe <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              id="medicalHistoryDescription"
                              rows={4}
                              value={formData.medicalHistoryDescription}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, medicalHistoryDescription: e.target.value }))
                              }
                              placeholder="Describe the condition, allergy, medication or treatment, and any precautions we should take."
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-y"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── STEP 6: Terms & Conditions ── */}
                  {currentStep === 6 && (
                    <div className="space-y-4 sm:space-y-5" style={stepEnterStyle}>
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-1 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-scroll text-[#2A6BB5]"></i>
                          Terms &amp; Conditions
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Please read the complete Terms &amp; Conditions and acknowledge each section before submitting your application.</p>
                      </div>

                      {/* Progress indicator */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-[#2E3093] flex items-center gap-2">
                            <i className="fas fa-tasks"></i>
                            Sections Acknowledged
                          </span>
                          <span className={`text-sm font-bold ${allSectionsChecked ? 'text-green-600' : 'text-[#2E3093]'}`}>
                            {sectionChecks.filter(Boolean).length} / {sectionChecks.length}
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${allSectionsChecked ? 'bg-green-500' : 'bg-[#2E3093]'}`}
                            style={{ width: `${(sectionChecks.filter(Boolean).length / sectionChecks.length) * 100}%` }}
                          />
                        </div>
                        {!allSectionsChecked && (
                          <p className="text-xs text-blue-700 mt-2 flex items-center gap-1.5">
                            <i className="fas fa-info-circle"></i>
                            Read the full Terms &amp; Conditions and acknowledge all sections to proceed.
                          </p>
                        )}
                      </div>

                      {/* Read T&C button */}
                      <button
                        type="button"
                        onClick={() => setShowPdfModal(true)}
                        className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                          allSectionsChecked
                            ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                            : 'bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-transparent text-white hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        {allSectionsChecked ? (
                          <><i className="fas fa-check-circle text-lg"></i> Terms &amp; Conditions Read &amp; Acknowledged</>
                        ) : (
                          <><i className="fas fa-book-open text-lg"></i> Read Terms &amp; Conditions <span className="font-normal text-white/70 text-xs">(required)</span></>
                        )}
                      </button>

                      {/* Declaration checkbox — locked until all sections acknowledged */}
                      <div className={`border-2 rounded-xl p-5 transition-all ${allSectionsChecked ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200 opacity-70'}`}>
                        {!allSectionsChecked && (
                          <div className="flex items-center gap-3 mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                            <i className="fas fa-lock text-orange-400 text-sm flex-shrink-0"></i>
                            <p className="text-xs text-orange-700 font-medium">
                              You must read and acknowledge all sections above before you can accept the declaration.
                            </p>
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            id="terms"
                            checked={formData.termsAgreed}
                            disabled={!allSectionsChecked}
                            onChange={(e) => handleChange('termsAgreed', e.target.checked)}
                            className={`w-5 h-5 mt-0.5 rounded flex-shrink-0 accent-[#2E3093] ${allSectionsChecked ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                          />
                          <label htmlFor="terms" className={`text-sm flex-1 ${!allSectionsChecked ? 'opacity-50' : ''}`}>
                            <span className="font-semibold text-gray-800">I Accept the Terms and Conditions <span className="text-red-500">*</span></span>
                            <p className="text-gray-600 mt-1 leading-relaxed">
                              I hereby declare that all the information provided by me is true and correct to the best of my knowledge.
                              I understand that any false information may result in the cancellation of my admission.
                              I agree to abide by all the rules and regulations of the institute.
                            </p>
                          </label>
                        </div>
                      </div>

                      {allSectionsChecked && formData.termsAgreed && (
                        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                          <i className="fas fa-check-circle text-green-500 text-xl flex-shrink-0"></i>
                          <div>
                            <p className="text-sm font-semibold text-green-800">Ready to Submit</p>
                            <p className="text-xs text-green-700 mt-0.5">All sections acknowledged and declaration accepted. Click &quot;Submit Application&quot; below.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Navigation buttons */}
                <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 sm:px-6 py-2 sm:py-3 shadow-lg">
                  <div className="flex justify-between items-center gap-2 sm:gap-3">
                    <div>
                      {currentStep === 1 ? (
                        <div className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
                          <i className="fas fa-lock"></i>
                          <span className="hidden sm:inline">Your information is secure</span>
                          <span className="sm:hidden">Secure</span>
                        </div>
                      ) : (
                        <button type="button" onClick={() => nextStep(currentStep - 1)} className="px-3 sm:px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-50 transition-all">
                          <i className="fas fa-arrow-left mr-1 sm:mr-2"></i><span className="hidden sm:inline">Back</span><span className="sm:hidden">Back</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => { void handleManualSaveDraft(); }}
                        disabled={manualSaving || submitting}
                        className="px-3 sm:px-4 py-2 bg-white border border-[#2A6BB5]/30 text-[#2E3093] rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#2A6BB5]/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Save current progress for this admission link"
                      >
                        {manualSaving || autoSaveStatus === 'saving'
                          ? <><i className="fas fa-spinner fa-spin mr-1.5"></i><span className="hidden sm:inline">Saving...</span><span className="sm:hidden">Saving</span></>
                          : <><i className="fas fa-save mr-1.5"></i><span className="hidden sm:inline">Save Draft</span><span className="sm:hidden">Save</span></>}
                      </button>

                      {currentStep < 7 ? (
                        <button
                          type="button"
                          onClick={() => nextStep(currentStep + 1)}
                          disabled={currentStep === 6 && (!allSectionsChecked || !formData.termsAgreed)}
                          title={currentStep === 6 && (!allSectionsChecked || !formData.termsAgreed) ? 'Read and accept the Terms & Conditions to continue' : undefined}
                          className="px-4 sm:px-6 py-2 bg-gradient-to-r from-[#FAE452] to-[#FDD835] text-[#2E3093] rounded-lg font-bold text-xs sm:text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                        >
                          <span className="hidden sm:inline">Continue</span><span className="sm:hidden">Next</span> <i className="fas fa-arrow-right ml-1 sm:ml-2"></i>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={submitting || !formData.modeOfPayment || (formData.modeOfPayment === 'Pay at Office' ? !payAtOfficeVerified : paymentSubMethod === 'razorpay' ? !razorpayPaid : paymentSubMethod === 'qr' ? !upiTransferConfirmed : paymentSubMethod === 'neft' ? !neftTransactionNumber.trim() : true)}
                          title={(!formData.modeOfPayment || (formData.modeOfPayment === 'Pay at Office' ? !payAtOfficeVerified : paymentSubMethod === 'razorpay' ? !razorpayPaid : paymentSubMethod === 'qr' ? !upiTransferConfirmed : paymentSubMethod === 'neft' ? !neftTransactionNumber.trim() : true)) ? (formData.modeOfPayment === 'Pay at Office' ? 'Enter override password to submit' : 'Complete payment details to submit') : undefined}
                          className="px-4 sm:px-6 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg font-bold text-xs sm:text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                          {submitting ? (
                            <><i className="fas fa-spinner fa-spin mr-1 sm:mr-2"></i><span className="hidden sm:inline">Submitting...</span><span className="sm:hidden">Wait...</span></>
                          ) : (
                            <><i className="fas fa-check-circle mr-1 sm:mr-2"></i><span className="hidden sm:inline">Submit Application</span><span className="sm:hidden">Submit</span></>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </main>
        </div>
        </div>
      </div>


      {/* ── Footer ── */}
      <footer className="flex-shrink-0 bg-[#2E3093] border-t border-[#2A6BB5]/30">
        <div className="max-w-full mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center text-center justify-center gap-1 sm:gap-4">
          <span className="text-white/70 text-[10px] sm:text-xs">© {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.</span>
          <span className="hidden sm:block text-white/40 text-xs">Secure Online Admission Portal</span>
        </div>
      </footer>

      {/* Terms & Conditions Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl" style={{maxHeight:'90vh'}}>

          {/* Modal Header */}
          <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-t-2xl px-6 py-4 flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-scroll text-[#FAE452] text-base"></i>
                </div>
                <div>
                  <div className="text-white font-bold text-base leading-tight">Terms &amp; Conditions</div>
                  <div className="text-white/70 text-xs mt-0.5">Suvidya Institute of Technology Pvt. Ltd. — Please read and acknowledge each section</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="text-white/70 hover:text-white hover:bg-white/20 transition-all rounded-xl w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/80 text-xs font-medium">{checkedCount} of 15 sections acknowledged</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ allSectionsChecked ? 'bg-green-400 text-green-900' : 'bg-white/20 text-white'}`}>{allSectionsChecked ? '✓ All Done' : `${checkedCount}/15`}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{width:`${(checkedCount/15)*100}%`, background: allSectionsChecked ? '#4ade80' : '#FAE452'}}
                />
              </div>
            </div>
          </div>

          {/* Scrollable Content — with watermark */}
          <div className="flex-1 overflow-y-auto bg-gray-50 relative">

            {/* Watermark */}
            <div className="pointer-events-none select-none fixed inset-0 flex items-center justify-center z-0" style={{zIndex:0}}>
              <Image src="/sit.png" alt="" width={600} height={600} className="opacity-[0.025] object-contain" style={{ maxWidth: '80vw', maxHeight: '80vh', width: 'auto', height: 'auto' }} />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3 text-sm">

              {/* Section helper */}
              {([
                {
                  idx: 0, title: 'Admission / Enrollment', icon: 'fa-user-check',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Admission is online only through our website (<a href="http://www.suvidya.ac.in" target="_blank" rel="noreferrer" className="text-[#2A6BB5] underline font-medium">www.suvidya.ac.in</a>).</li>
                      <li>Candidates without any relevant qualification but having relevant design experience of more than 5 years shall be given admission on submission of experience letter (from the employer) / declaration.</li>
                      <li>Admission shall be confirmed only after verification of all required documents and receipt of fees.</li>
                    </ol>
                  )
                },
                {
                  idx: 1, title: 'Confirmation of Admission', icon: 'fa-envelope-open-text',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>A confirmation email will be sent to participant on receipt of full payment and successfully completed registration form one week prior to attending the Training Programme.</li>
                      <li>Pre-Training Assignment with the details of the training program will be shared to the participant once the Admission is confirmed.</li>
                      <li>For Out station Students – Once the Admission is confirmed, Participant to confirm their accommodation and Inform SIT well in advance. If required SIT shall support for the Accommodation.</li>
                      <li>Out station Participants to reach Mumbai 1 or 2 days before the batch starts.</li>
                      <li>100% fees in advance have to be done before commencement of the batch.</li>
                    </ol>
                  )
                },
                {
                  idx: 2, title: 'Payment', icon: 'fa-credit-card',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>100% fees in advance through online transfer.</li>
                      <li>Demand Draft/NEFT of any bank in favor of &apos;Suvidya Institute of Technology Pvt. Ltd.&apos; payable at Mumbai.</li>
                      <li>Penalty of Rs 500/- will be charged towards bank charges in case of Cheque returned.</li>
                      <li>Payment may be made thru NEFT transfer, accounts details are as under:
                        <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2 sm:p-3 text-xs space-y-1.5">
                          {[['Bank account name','Suvidya Institute of Technology Pvt. Ltd.'],['Bank Name','Axis Bank Ltd.'],['Branch Address','Vakola, Mumbai (MH), City Survey No. 841 to 846, Florence Lorenace Chs. Ltd. Mumbai 400055.'],['IFSC code for NEFT','UTIB0001244'],['MICR Code','400211082'],['Bank Account No.','911020002988600']].map(([k,v])=>(
                            <div key={k} className="flex flex-col sm:flex-row sm:gap-2"><span className="font-semibold text-gray-700 sm:w-36 sm:flex-shrink-0">{k}</span><span className="text-gray-600"><span className="hidden sm:inline">: </span>{v}</span></div>
                          ))}
                        </div>
                      </li>
                    </ol>
                  )
                },
                {
                  idx: 3, title: 'Offline / Inhouse Lectures', icon: 'fa-chalkboard-teacher',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Lectures will be conducted in SIT premises.</li>
                      <li>Learners should reach the Institute 15 mins before the lecture time.</li>
                      <li>Dress code will be applicable (Sky blue color shirt / black or blue navy pant).</li>
                    </ol>
                  )
                },
                {
                  idx: 4, title: 'Online Lectures', icon: 'fa-video',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Google Meet / Zoom App to be installed in your mobile phone or laptop.</li>
                      <li>Meeting link / ID &amp; password for the lecture will be shared on WhatsApp / E-mail well in advance.</li>
                      <li>Before joining the session, you need to update your proper name.</li>
                      <li>Participants should join the session 10 Minutes before the actual time.</li>
                      <li>Participants are free to ask or share any queries related to the topic on the same day.</li>
                      <li>The video camera must be on during the whole session.</li>
                      <li>International candidates are requested to log in as per the Indian Standard time.</li>
                    </ol>
                  )
                },
                {
                  idx: 5, title: 'Admission Transfer', icon: 'fa-exchange-alt',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Admission transfer fees:<ul className="list-[lower-alpha] ml-5 mt-1 space-y-1"><li>Up to last day of admission: Nil</li><li>After the last date of admission &amp; one day prior to start of Training: 10% of Total fees</li><li>On the first day of Training and onwards: 20% of Total fees</li></ul></li>
                      <li>Admissions are strictly non-transferable in any other name and for any other Training Program.</li>
                      <li>Admission will be transferred only on receipt of Admission Transfer-Cancellation Form.</li>
                      <li>Transfer will be allowed only up to two consecutive batches.</li>
                      <li>In case of transfer it is compulsory to attend the new batch from day one; unit test, assignment, attendance of previous batch will not be considered.</li>
                    </ol>
                  )
                },
                {
                  idx: 6, title: 'Admission Cancellation', icon: 'fa-ban',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Admission Cancellation charges:<ul className="list-[lower-alpha] ml-5 mt-1 space-y-1"><li>Up to last date of admission: 30% of the Total fees.</li><li>After last date &amp; one day prior to start: 50% of the Total fees.</li><li>On the first day of commencement: No Refunds.</li></ul></li>
                      <li>Admission will be cancelled only on receipt of Admission Transfer-Cancellation Form.</li>
                      <li>Admission shall be cancelled where students fail to attend first three lectures or fail to inform for absenteeism.</li>
                    </ol>
                  )
                },
                {
                  idx: 7, title: 'Final Examination', icon: 'fa-file-alt',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Students only with and above 75% attendance will be eligible for the final examination.</li>
                      <li>Students unable to appear for the examination shall inform the Training Co-ordinator.</li>
                      <li>Grade is based on average score. <span className="font-semibold text-gray-700">Weightage: Unit Test – 35%, Assignment – 15%, Final Exam – 50%</span></li>
                      <li>1% marks will be deducted for each un-disciplined behavior.</li>
                      <li>Criteria of Grade:
                        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs bg-white border border-gray-200 rounded-lg p-2">
                          {[['A+','90–100%'],['A','80–89.99%'],['B+','70–79.99%'],['B','60–69.99%'],['C','50–59.99%'],['No Cert.','≤49.99%']].map(([g,r])=>(
                            <div key={g} className="flex items-center gap-1"><span className="font-bold text-[#2E3093]">{g}</span><span className="text-gray-500">{r}</span></div>
                          ))}
                        </div>
                      </li>
                    </ol>
                  )
                },
                {
                  idx: 8, title: 'Issue of Certificate', icon: 'fa-certificate',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Graduate Engineers will be awarded &apos;Post Graduate Diploma&apos; and Diploma holders with &apos;Post Diploma&apos; certificate.</li>
                      <li>For all drafting training programme &apos;Diploma&apos; certificate will be awarded.</li>
                      <li>For all software training &quot;Training in __(software name)&quot; certificate will be awarded.</li>
                      <li>Candidates without qualification but with 5+ years design experience shall be awarded &apos;Diploma&apos;.</li>
                      <li>Students shall collect certificates within one month of convocation.</li>
                      <li>Certificate may be issued in absence of student only on submission of authority letter.</li>
                      <li>Duplicate certificate stamped &apos;Duplicate&apos; may be issued on payment of Rs 1000/-.</li>
                    </ol>
                  )
                },
                {
                  idx: 9, title: 'Participants Feedback', icon: 'fa-comment-dots',
                  content: (
                    <p className="text-gray-600">SIT would love to hear your questions, concerns, requirements, and feedback about our Services through mail or sending a recorded video on <a href="mailto:enquiry@suvidya.ac.in" className="text-[#2A6BB5] underline font-medium">enquiry@suvidya.ac.in</a>.</p>
                  )
                },
                {
                  idx: 10, title: 'General Rules & Regulations', icon: 'fa-gavel',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Students are required to complete the Training Program and appear for examination of the same batch.</li>
                      <li>Any change in mobile number, email ID or postal address should be informed immediately.</li>
                      <li>Full day lectures will be arranged looking at the need &amp; requirement, with advance information to all.</li>
                      <li>All disputes / legal issues will be resolved after discussion with both parties.</li>
                      <li>All disputes / legal issues will be subject to Mumbai jurisdiction.</li>
                      <li>From time to time, we may update these Terms to clarify our practices.</li>
                      <li>One full day absent will be marked for 3 late joining of sessions.</li>
                      <li>Lectures will not be repeated once already conducted.</li>
                      <li>Repeaters must confirm &amp; pay the applicable re-exam fees two weeks before the examination date.</li>
                      <li>Students shall be allowed for re-exam only for next 2 attempts.</li>
                      <li>Students failing in the 3rd attempt may apply for re-admission.</li>
                      <li>Students appearing for re-exam will be entitled for &quot;C&quot; grade only.</li>
                      <li>Stationery required: Scientific Calculator, Pen (Blue, Red, Green), Highlighter (Yellow), Pencil 0.5mm and Eraser.</li>
                      <li>SIT shall provide training material during session in form of handouts wherever necessary.</li>
                      <li>Additional charges of Rs 500 will be charged for additional copy of the training manual.</li>
                      <li>With regards to any problem in attendance please contact Training Co-Ordinator immediately.</li>
                      <li>Certificate of appreciation will be issued for 100% attendance with 3% grace marks.</li>
                    </ol>
                  )
                },
                {
                  idx: 11, title: 'International Candidates', icon: 'fa-globe-asia',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>100% fees in advance through wire transfer only.</li>
                      <li>During ongoing training, candidates are forbidden from taking admission elsewhere for any other course.</li>
                      <li>Candidates to handover original passport to SIT for security purpose; returned on last day of the programme.</li>
                      <li>If any special remarks on VISA document, candidate has to visit the Indian Embassy in Mumbai (If Required).</li>
                      <li>Refund subject to Admission Cancellation conditions will be remitted through bank.</li>
                      <li>&quot;Medium of Training / Instructions&quot; will be in English; candidate required to be thorough in English.</li>
                    </ol>
                  )
                },
                {
                  idx: 12, title: 'Placement Assistance', icon: 'fa-briefcase',
                  content: (
                    <p className="text-gray-600">100% &apos;Placement Assistance&apos; will be provided only for Indian Students which will be as per company requirements and market conditions.</p>
                  )
                },
                {
                  idx: 13, title: 'Code of Conduct', icon: 'fa-user-shield',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Students are required to be highly punctual and regular in attending the lectures.</li>
                      <li>Expected to follow formal wear as training will be with VIDEO on as and when required.</li>
                      <li>Students to maintain utmost discipline &amp; utter silence during the Training.</li>
                      <li>Students to be polite with SIT staff and all fellow students and shall avoid needless arguments.</li>
                      <li>During visit to SIT, wearing the Identity Card and following rules in premises are mandatory.</li>
                    </ol>
                  )
                },
                {
                  idx: 14, title: 'Copyrights', icon: 'fa-copyright',
                  content: (
                    <ol className="list-decimal ml-5 space-y-1.5 text-gray-600">
                      <li>Copyright &copy; 2017 SIT. All Rights Reserved.</li>
                      <li>You will not copy the training Manuals / Contents / Materials in any way whatsoever, distribute, download, display, reproduce, modify, edit, alter, enhance, broadcast or tamper with in any way.</li>
                      <li>You will not remove any copyright, trademark or intellectual property notices from the original material without our express written consent.</li>
                      <li>Unauthorized use of any contents may give rise to a claim for damages and/or be a criminal offence.</li>
                      <li>Study material is for reference only. We don&apos;t sell our study material for Correspondence / Distance or Commercial Purposes.</li>
                    </ol>
                  )
                },
              ] as { idx: number; title: string; icon: string; content: React.ReactNode }[]).map(({ idx, title, icon, content }) => (
                <div
                  key={idx}
                  className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${
                    sectionChecks[idx]
                      ? 'border-green-400 bg-white shadow-sm shadow-green-100'
                      : 'border-gray-200 bg-white hover:border-[#2A6BB5]/40'
                  }`}
                >
                  {/* Section Header */}
                  <div className={`flex items-center gap-3 px-4 py-3 ${ sectionChecks[idx] ? 'bg-green-50 border-b border-green-200' : 'bg-gray-50 border-b border-gray-200'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${ sectionChecks[idx] ? 'bg-green-500 text-white' : 'bg-[#2E3093] text-white'}`}>
                      {sectionChecks[idx] ? <i className="fas fa-check text-xs"></i> : idx + 1}
                    </div>
                    <div className={`flex items-center gap-2 flex-1 min-w-0`}>
                      <i className={`fas ${icon} text-xs flex-shrink-0 ${ sectionChecks[idx] ? 'text-green-600' : 'text-[#2A6BB5]'}`}></i>
                      <span className={`font-bold text-sm truncate ${ sectionChecks[idx] ? 'text-green-800' : 'text-[#2E3093]'}`}>{title}</span>
                    </div>
                    <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer select-none">
                      <span className={`text-xs font-medium hidden sm:block ${ sectionChecks[idx] ? 'text-green-700' : 'text-gray-400'}`}>
                        {sectionChecks[idx] ? 'Acknowledged' : 'Acknowledge'}
                      </span>
                      <div
                        onClick={() => toggleSection(idx)}
                        className={`w-10 h-5 rounded-full transition-all duration-200 flex items-center px-0.5 cursor-pointer ${
                          sectionChecks[idx] ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                      </div>
                    </label>
                  </div>
                  {/* Section Body */}
                  <div className="px-4 py-3 leading-relaxed">
                    {content}
                  </div>
                </div>
              ))}

              {/* Declaration */}
              <div className={`mt-2 rounded-xl border-2 overflow-hidden transition-all duration-300 ${ allSectionsChecked ? 'border-[#2E3093] bg-white shadow-lg' : 'border-gray-300 bg-gray-100 opacity-60'}`}>
                <div className={`px-5 py-3 border-b flex items-center gap-3 ${ allSectionsChecked ? 'bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] border-[#2E3093]' : 'bg-gray-200 border-gray-300'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ allSectionsChecked ? 'bg-[#FAE452]' : 'bg-gray-400'}`}>
                    <i className={`fas fa-pen-nib text-xs ${ allSectionsChecked ? 'text-[#2E3093]' : 'text-white'}`}></i>
                  </div>
                  <span className={`font-bold text-sm ${ allSectionsChecked ? 'text-white' : 'text-gray-500'}`}>Declaration &amp; Final Acceptance</span>
                  {!allSectionsChecked && <span className="ml-auto text-xs text-gray-500 font-medium">Acknowledge all {15 - checkedCount} remaining section(s) to unlock</span>}
                  {allSectionsChecked && <span className="ml-auto text-xs text-green-300 font-medium"><i className="fas fa-lock-open mr-1"></i>Unlocked</span>}
                </div>
                <div className={`px-5 py-4 ${ allSectionsChecked ? '' : 'pointer-events-none'}`}>
                  <p className={`text-sm leading-relaxed mb-4 ${ allSectionsChecked ? 'text-gray-700' : 'text-gray-400'}`}>
                    I certify that the information I have provided in the Online admission form is correct to the best of my knowledge and my admission is liable to be cancelled in case of any discrepancy found later on. I have read the above Procedure / Guidelines / Terms &amp; Conditions and I accept and agree for the same.
                  </p>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 cursor-pointer rounded-lg p-3 border transition-all ${
                      allSectionsChecked
                        ? formData.termsAgreed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:border-[#2A6BB5]/50 hover:bg-blue-50/30'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formData.termsAgreed}
                        disabled={!allSectionsChecked}
                        onChange={(e) => handleChange('termsAgreed', e.target.checked)}
                        className="w-5 h-5 mt-0.5 flex-shrink-0 accent-[#2E3093] cursor-pointer"
                      />
                      <span className={`text-sm leading-relaxed ${ allSectionsChecked ? 'text-gray-800' : 'text-gray-400'}`}>
                        I have read and understood all the above Guidelines / Terms &amp; Conditions and I agree to abide by the same. <span className="text-red-500 font-bold">*</span>
                      </span>
                    </label>
                    <label className={`flex items-start gap-3 cursor-pointer rounded-lg p-3 border transition-all ${
                      allSectionsChecked
                        ? formData.termsAgreed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:border-[#2A6BB5]/50 hover:bg-blue-50/30'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formData.termsAgreed}
                        disabled={!allSectionsChecked}
                        onChange={(e) => handleChange('termsAgreed', e.target.checked)}
                        className="w-5 h-5 mt-0.5 flex-shrink-0 accent-[#2E3093] cursor-pointer"
                      />
                      <span className={`text-sm leading-relaxed ${ allSectionsChecked ? 'text-gray-800' : 'text-gray-400'}`}>
                        I certify that all information provided in my admission form is true and correct to the best of my knowledge. <span className="text-red-500 font-bold">*</span>
                      </span>
                    </label>
                  </div>
                  {formData.termsAgreed && allSectionsChecked && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2.5 bg-green-50 border-2 border-green-400 rounded-xl px-4 py-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-check text-white text-sm"></i>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-green-800">Declaration Accepted</div>
                          <div className="text-xs text-green-600 mt-0.5">You have acknowledged all sections and accepted the terms.</div>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleSendEmail}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] hover:from-[#252780] hover:to-[#2360A0] text-white px-6 py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                      >
                        <i className="fas fa-paper-plane text-lg"></i>
                        <span>Send Admission Form to Email</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pb-4"></div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-white border-t border-gray-200 px-5 py-3 rounded-b-2xl flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="flex gap-0.5">
                {sectionChecks.map((c, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-all ${ c ? 'bg-green-500' : 'bg-gray-300'}`} />
                ))}
              </div>
              <span className="font-medium">{checkedCount}/15</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="px-5 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg text-sm font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <i className="fas fa-times mr-2"></i>Close
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Add University Modal */}
      {showAddUniversityModal && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-[#2A6BB5]/20 max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#2E3093] flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-full flex items-center justify-center">
                  <i className="fas fa-university text-white text-sm"></i>
                </div>
                Add Custom University
              </h3>
              <button type="button" onClick={() => { setShowAddUniversityModal(false); setNewUniversityData({ name: '', country: '', city: '', fieldType: 'grad' }); }} className="text-gray-400 hover:text-[#2E3093] transition-colors rounded-full hover:bg-gray-100 w-8 h-8 flex items-center justify-center">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">University Name <span className="text-red-500">*</span></label>
                <input type="text" value={newUniversityData.name} onChange={(e) => setNewUniversityData(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter university name" className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/20 transition-all" />
              </div>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-xs text-blue-800 flex items-start gap-2">
                  <i className="fas fa-info-circle mt-0.5 text-[#2A6BB5]"></i>
                  <span>Can&apos;t find your university in the list? No problem! Just enter the name manually and it will be added to your application form.</span>
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-7">
              <button type="button" onClick={() => { setShowAddUniversityModal(false); setNewUniversityData({ name: '', country: '', city: '', fieldType: 'grad' }); }} className="flex-1 px-5 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all border border-gray-300">
                <i className="fas fa-times mr-2"></i>Cancel
              </button>
              <button type="button" onClick={handleAddUniversity} className="flex-1 px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <i className="fas fa-check-circle mr-2"></i>Use This University
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Consent Form Modal ── */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[92vh] flex flex-col transform transition-all animate-scaleIn">
            {/* Enhanced Header with Icon */}
            <div className="bg-gradient-to-br from-[#2E3093] via-[#2A6BB5] to-[#1e5a9e] px-4 sm:px-8 py-4 sm:py-6 rounded-t-2xl sm:rounded-t-3xl flex-shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>
              <div className="relative z-10 flex items-center gap-2 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <i className="fas fa-file-signature text-2xl sm:text-3xl text-white"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-black text-lg sm:text-2xl tracking-tight uppercase mb-1 drop-shadow-lg">Consent Form</h2>
                  <p className="text-white/90 text-xs sm:text-sm font-semibold">
                    {consentType === 'student' 
                      ? '🎓 For Candidates with Different Educational Background'
                      : '💼 For Experienced Candidates (10+ Years Experience)'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-gradient-to-b from-gray-50 to-white">
              {/* Candidate Information Card */}
              <div className="bg-white border-2 border-[#2E3093]/20 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] rounded-lg sm:rounded-xl flex items-center justify-center">
                    <i className="fas fa-user text-white text-sm sm:text-lg"></i>
                  </div>
                  <h3 className="font-black text-[#2E3093] text-base sm:text-lg">Candidate Information</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Name of the Candidate</label>
                    <input readOnly value={[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ')}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-50 to-purple-50 text-[#2E3093] cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Training Name</label>
                    <input readOnly value={formData.trainingProgrammeName || '—'}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-blue-50 text-gray-700 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Batch No.</label>
                    <input readOnly value={formData.batchCode || '—'}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-blue-50 text-gray-700 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Eligibility for the Training</label>
                    <input type="text" value={consentData.eligibility}
                      onChange={(e) => setConsentData(p => ({ ...p, eligibility: e.target.value }))}
                      placeholder="e.g. 10th + 3 yrs experience"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Qualification of the Candidate</label>
                    <input type="text" value={consentData.qualification}
                      onChange={(e) => setConsentData(p => ({ ...p, qualification: e.target.value }))}
                      placeholder="e.g. HSC, Diploma"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/20 transition-all" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Experience of the Candidate (Dept &amp; Company)</label>
                    <input readOnly
                      value={[formData.jobDesignation, formData.jobOrganisation].filter(Boolean).join(' at ') ||
                        (formData.workingFromYears ? `${formData.workingFromYears} yr${parseInt(formData.workingFromYears) !== 1 ? 's' : ''}${formData.workingFromMonths ? ` ${formData.workingFromMonths} month${parseInt(formData.workingFromMonths) !== 1 ? 's' : ''}` : ''}` : '—')}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-blue-50 text-gray-700 cursor-not-allowed" />
                  </div>
                </div>
              </div>

              {/* Consent Declaration Section */}
              <div className="bg-white border-2 border-amber-400/30 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg sm:rounded-xl flex items-center justify-center">
                    <i className="fas fa-exclamation-triangle text-white text-sm sm:text-lg"></i>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-[#2E3093]">Consent Declaration</h3>
                </div>
                <p className="text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4 font-semibold leading-relaxed bg-amber-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <i className="fas fa-hand-point-right text-amber-600 mr-2"></i>
                  I, the undersigned <span className="font-black text-[#2E3093] underline">{[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ') || '…'}</span>, hereby declare and accept the following:
                </p>
                <div className="space-y-2 sm:space-y-3">
                  {[
                    `I am enrolling in the Training Program "${formData.trainingCategory || '…'}" voluntarily and with full understanding of the Training Program structure, objectives, and outcomes.`,
                    'I have been informed of the eligibility criteria and understand that my admission is being considered as an exception based on my interest, motivation, and willingness to learn.',
                    'I take full responsibility for bridging any gaps in foundational knowledge and agree to put in the required effort to understand and complete the Training Program content effectively.',
                    'On account of my educational background, I will be solely responsible for my training, performance, and placement.',
                    'I confirm that I am joining the Training Program with a clear understanding of the above.',
                  ].map((text, i) => (
                    <label key={i} className={`flex items-start gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                      consentChecks[i] 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500 shadow-green-200' 
                        : 'bg-white border-gray-300 hover:border-[#2A6BB5]'
                    }`}>
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                        consentChecks[i] ? 'bg-green-500' : 'bg-gray-200 border-2 border-gray-400'
                      }`}>
                        {consentChecks[i] && <i className="fas fa-check text-white text-xs sm:text-sm font-bold"></i>}
                      </div>
                      <input 
                        type="checkbox" 
                        checked={consentChecks[i]}
                        onChange={(e) => {
                          const updated = [...consentChecks];
                          updated[i] = e.target.checked;
                          setConsentChecks(updated);
                        }}
                        className="hidden" 
                      />
                      <span className={`text-xs sm:text-sm leading-relaxed font-medium ${
                        consentChecks[i] ? 'text-gray-800' : 'text-gray-700'
                      }`}>
                        <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#2E3093] text-white text-[10px] sm:text-xs font-bold mr-1 sm:mr-2">{i + 1}</span>
                        {text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Candidate Remark */}
              <div className="bg-white border-2 border-purple-200 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm">
                <label className="block text-xs sm:text-sm font-black text-[#2E3093] mb-2 sm:mb-3 flex items-center gap-2">
                  <i className="fas fa-comment-dots text-purple-500"></i>
                  Candidate Remark
                </label>
                <textarea value={consentData.candidateRemark}
                  onChange={(e) => setConsentData(p => ({ ...p, candidateRemark: e.target.value }))}
                  placeholder="Any additional remarks or comments"
                  rows={3}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none" />
              </div>

              {/* Department Signatures Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm">
                <p className="text-xs sm:text-sm font-black text-blue-900 mb-2 sm:mb-3 flex items-center gap-2">
                  <i className="fas fa-pen text-blue-600"></i>
                  <span>In Presence of <span className="hidden sm:inline font-semibold text-blue-600">(to be completed by departments)</span></span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  {['CBD Dept', 'Training Dept', 'Placement Dept'].map((dept) => (
                    <div key={dept} className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 border-2 border-blue-200 shadow-sm">
                      <div className="text-xs sm:text-sm font-bold text-blue-800 flex items-center gap-2">
                        <i className="fas fa-pen-nib text-blue-500 text-xs"></i>
                        {dept}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation Message */}
              {!allConsentChecked && (
                <div className="bg-orange-50 border-2 border-orange-400 rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm animate-pulse">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-exclamation-circle text-white text-base sm:text-lg"></i>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-orange-800">
                    Please acknowledge all 5 declarations before confirming.
                  </p>
                </div>
              )}
            </div>

            {/* Enhanced Footer */}
            <div className="flex-shrink-0 border-t-2 border-gray-200 px-3 sm:px-8 py-3 sm:py-5 flex gap-2 sm:gap-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-b-2xl sm:rounded-b-3xl">
              <button 
                type="button" 
                onClick={() => setShowConsentModal(false)}
                className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-white border-2 border-gray-400 text-gray-700 rounded-lg sm:rounded-xl text-sm sm:text-base font-black hover:bg-gray-100 hover:border-gray-500 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <i className="fas fa-times mr-1 sm:mr-2"></i><span className="hidden sm:inline">Close</span><span className="sm:hidden">Close</span>
              </button>
              <button 
                type="button" 
                disabled={!allConsentChecked}
                onClick={() => { 
                  if (consentType === 'student') {
                    setConsentAcknowledged(true);
                  } else {
                    setExperiencedConsentAcknowledged(true);
                  }
                  setShowConsentModal(false); 
                }}
                className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-[#2E3093] via-[#2A6BB5] to-[#1e5a9e] text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-black hover:shadow-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none shadow-lg transform hover:-translate-y-1 hover:scale-105"
              >
                <i className="fas fa-check-double mr-1 sm:mr-2 text-base sm:text-lg"></i><span className="hidden sm:inline">Confirm &amp; Acknowledge</span><span className="sm:hidden">Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay at Office Override Modal */}
      {showPayAtOfficeModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <i className="fas fa-shield-alt"></i>
                <h3 className="text-sm font-bold">Pay at Office Override</h3>
              </div>
              <p className="text-xs text-amber-100 mt-1">Enter authorization password to enable offline payment mode.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Override Password</label>
                <input
                  type="password"
                  value={payAtOfficePassword}
                  onChange={(e) => setPayAtOfficePassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handlePayAtOfficeOverride(); } }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
                  placeholder="Enter password"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPayAtOfficeModal(false);
                    setPayAtOfficePassword('');
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={payAtOfficeVerifying}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handlePayAtOfficeOverride(); }}
                  disabled={payAtOfficeVerifying}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {payAtOfficeVerifying ? 'Verifying...' : 'Verify & Allow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes stepEnter {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 639px) {
          .mobile-form-stage h3 {
            margin-bottom: 0.75rem;
          }

          .mobile-form-stage .rounded-xl.border,
          .mobile-form-stage .rounded-lg.border,
          .mobile-form-stage .rounded-xl.border-2 {
            margin-bottom: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-form-stage [style*='stepEnter'] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
