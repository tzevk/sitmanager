'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';

const STEPS = [
  { id: 1, title: 'Personal Info', icon: 'fa-user', description: 'Basic personal details' },
  { id: 2, title: 'Academic', icon: 'fa-graduation-cap', description: 'Educational qualifications' },
  { id: 3, title: 'Occupational Info', icon: 'fa-briefcase', description: 'Current occupational status' },
  { id: 4, title: 'Training', icon: 'fa-chalkboard-teacher', description: 'Training programme details' },
  { id: 5, title: 'Documents', icon: 'fa-cloud-upload-alt', description: 'Upload required documents' },
  { id: 6, title: 'Terms & Conditions', icon: 'fa-scroll', description: 'Read & accept terms' },
];

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
  const studentId = params.id as string;

  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  // Training programme cascade
  const [courses, setCourses] = useState<{ Course_Id: number; Course_Name: string }[]>([]);
  const [batchCategories, setBatchCategories] = useState<string[]>([]);
  const [availableBatches, setAvailableBatches] = useState<{ batchCode: string; timings: string | null }[]>([]);
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
    presentAddress: '',
    presentCity: '',
    presentPin: '',
    permanentAddress: '',
    permanentState: '',
    permanentCountry: 'India',
    sameAsPresent: false,
    ssc_board: '',
    ssc_schoolName: '',
    ssc_yearOfPassing: '',
    ssc_percentage: '',
    hsc_board: '',
    hsc_collegeName: '',
    hsc_stream: '',
    hsc_yearOfPassing: '',
    hsc_percentage: '',
    
    diploma_degree: '',
    diploma_specialization: '',
    diploma_institute: '',
    diploma_yearOfPassing: '',
    diploma_percentage: '',
    
    grad_degree: '',
    grad_specialization: '',
    grad_university: '',
    grad_yearOfPassing: '',
    grad_percentage: '',
    
    postgrad_degree: '',
    postgrad_specialization: '',
    postgrad_university: '',
    postgrad_yearOfPassing: '',
    postgrad_percentage: '',
    
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
    trainingProgrammeId: '',
    trainingProgrammeName: '',
    trainingCategory: '',
    batchCode: '',
    termsAgreed: false,
    photoFile: null as File | null,
    cvFile: null as File | null,
    degreeFile: null as File | null,
    idProofType: 'Aadhar Card',
    idProofFile: null as File | null,
  });

  useEffect(() => {
    fetchStudentData();
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

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

  const handleCategoryChange = async (category: string) => {
    setFormData(prev => ({ ...prev, trainingCategory: category, batchCode: '' }));
    setAvailableBatches([]);
    if (!category || !formData.trainingProgrammeId) return;
    setLoadingBatches(true);
    try {
      const res = await fetch(`/api/public/batches?courseId=${formData.trainingProgrammeId}&category=${encodeURIComponent(category)}`);
      const data = await res.json();
      if (data.success) setAvailableBatches(data.batches);
    } catch {
      // non-fatal
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchStudentData = async () => {
    try {
      const res = await fetch(`/api/inquiry?id=${studentId}`);
      const data = await res.json();
      if (data.inquiry) {
        setFormData(prev => ({
          ...prev,
          email: data.inquiry.Email || '',
          mobile: data.inquiry.Present_Mobile || '',
          dob: data.inquiry.DOB || '',
          gender: data.inquiry.Sex || '',
          nationality: data.inquiry.Nationality || 'Indian',
          batchCode: data.inquiry.Batch_Code || '',
        }));
      }
    } catch {
      // Pre-fill not available; student fills in manually
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
        permanentAddress: prev.presentAddress,
        permanentState: prev.presentCity,
        permanentCountry: 'India',
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
        if (!formData.ssc_board || !formData.ssc_schoolName || !formData.ssc_yearOfPassing || !formData.ssc_percentage) {
          alert('Please fill all required fields in 10th/SSC Education section');
          return false;
        }
        if (!formData.hsc_board || !formData.hsc_collegeName || !formData.hsc_stream || !formData.hsc_yearOfPassing || !formData.hsc_percentage) {
          alert('Please fill all required fields in 12th/HSC Education section');
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
    // Step 6 is locked until steps 1–5 are all completed
    if (step === 6 && ![1, 2, 3, 4, 5].every((s) => completedSteps.includes(s))) return;
    setCurrentStep(step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.dob || !formData.gender || !formData.email || !formData.mobile) {
      alert('Please complete Step 1: Fill all required fields in Personal Info');
      setCurrentStep(1);
      return;
    }
    if (!formData.ssc_board || !formData.ssc_schoolName || !formData.ssc_yearOfPassing || !formData.ssc_percentage) {
      alert('Please complete Step 2: Fill all required fields in 10th/SSC Education section');
      setCurrentStep(2);
      return;
    }
    if (!formData.hsc_board || !formData.hsc_collegeName || !formData.hsc_stream || !formData.hsc_yearOfPassing || !formData.hsc_percentage) {
      alert('Please complete Step 2: Fill all required fields in 12th/HSC Education section');
      setCurrentStep(2);
      return;
    }
    if (!allSectionsChecked || !formData.termsAgreed) {
      alert('Please complete Step 6: Read and accept the Terms & Conditions');
      setCurrentStep(6);
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
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
        presentAddress: formData.presentAddress,
        presentCity: formData.presentCity,
        presentPin: formData.presentPin,
        permanentAddress: formData.permanentAddress,
        permanentState: formData.permanentState,
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
        trainingProgrammeName: formData.trainingProgrammeName,
        trainingCategory: formData.trainingCategory,
        batchCode: formData.batchCode,
        idProofType: formData.idProofType,
      };

      const res = await fetch('/api/admission-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
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
            <Image src="/sit.png" alt="SIT Logo" width={44} height={44} className="rounded-lg bg-white/10 p-0.5" />
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
              Application ID: <span className="font-mono font-semibold text-gray-700">#{studentId}</span>
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
    <div className="fixed inset-0 bg-white flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] shadow-lg flex-shrink-0 z-30">
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-1.5 shadow-md flex-shrink-0 -my-3">
              <Image src="/sit.png" alt="SIT Logo" width={72} height={72} className="rounded-lg block" />
            </div>
            <div>
              <div className="text-white font-extrabold text-lg leading-tight tracking-tight">Suvidya Institute of Technology</div>
              <div className="text-[#FAE452] text-xs font-semibold mt-0.5 flex items-center gap-1.5">
                <i className="fas fa-file-alt text-[10px]"></i>
                Online Admission Form
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
            <i className="fas fa-hashtag text-white/60 text-xs"></i>
            <span className="text-white text-xs font-semibold">Application #{studentId}</span>
          </div>
        </div>
      </header>

      {/* ── Mobile step indicator ── */}
      <div className="lg:hidden bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">Step {currentStep} of {STEPS.length}</span>
            <span className="text-xs text-gray-500">{STEPS[currentStep - 1].title}</span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((step) => {
              const isLocked = step.id === 6 && ![1, 2, 3, 4, 5].every((s) => completedSteps.includes(s));
              return (
                <button
                  key={step.id}
                  onClick={() => jumpToStep(step.id)}
                  disabled={isLocked}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    isLocked
                      ? 'bg-gray-200 cursor-not-allowed'
                      : step.id < currentStep || completedSteps.includes(step.id)
                      ? 'bg-green-500'
                      : step.id === currentStep
                      ? 'bg-[#2E3093]'
                      : 'bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full w-full px-4 py-4 bg-gray-50">
        <div className="flex gap-4 h-full">

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
                  const isLocked = step.id === 6 && ![1, 2, 3, 4, 5].every((s) => completedSteps.includes(s));
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
                            {isLocked ? 'Complete steps 1–5 first' : step.description}
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
                  { icon: 'fa-save', text: 'Progress is not auto-saved. Complete all steps before submitting.' },
                  { icon: 'fa-file-upload', text: 'Documents must be PDF, JPG, or PNG — max 5 MB each.' },
                  { icon: 'fa-check-double', text: 'Review all details carefully before final submission.' },
                  { icon: 'fa-lock', text: 'Submitted forms cannot be edited without admin approval.' },
                  { icon: 'fa-user-shield', text: 'All data is handled as per institute privacy policy.' },
                  { icon: 'fa-id-card', text: 'Ensure your name matches exactly as on official ID proof.' },
                  { icon: 'fa-phone', text: 'Provide an active mobile number — OTPs may be sent for verification.' },
                  { icon: 'fa-envelope', text: 'Use a valid email address; all communications will be sent there.' },
                  { icon: 'fa-graduation-cap', text: 'Academic marksheets must be original or attested copies.' },
                  { icon: 'fa-calendar-alt', text: 'Ensure dates of passing are filled accurately in the education section.' },
                  { icon: 'fa-image', text: 'Passport photo must be recent, clear, and against a white background.' },
                  { icon: 'fa-info-circle', text: 'Incomplete submissions will not be considered for admission.' },
                  { icon: 'fa-clock', text: 'Submit before the batch registration deadline to secure your seat.' },
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
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden h-full flex flex-col">
              {/* Step header */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-[#2E3093] flex items-center gap-2">
                      <i className={`fas ${STEPS[currentStep - 1].icon} text-[#2A6BB5]`}></i>
                      {STEPS[currentStep - 1].title}
                    </h1>
                    <p className="text-xs text-gray-600 mt-0.5">{STEPS[currentStep - 1].description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Step</div>
                    <div className="text-2xl font-bold text-[#2E3093]">
                      {currentStep}<span className="text-base text-gray-400">/{STEPS.length}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
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
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-4">

                  {/* ── STEP 1: Personal Info ── */}
                  {currentStep === 1 && (
                    <div className="space-y-5">
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
                            <input type="text" value={formData.middleName} onChange={(e) => handleChange('middleName', e.target.value)} placeholder="Enter middle name (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
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
                            <input type="date" value={formData.dob} onChange={(e) => handleChange('dob', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
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
                            <input type="tel" value={formData.telephone} onChange={(e) => handleChange('telephone', e.target.value)} placeholder="Optional" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Family Contact Number</label>
                            <input type="tel" value={formData.familyContact} onChange={(e) => handleChange('familyContact', e.target.value)} placeholder="Emergency contact" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                          </div>
                        </div>
                      </div>

                      {/* Address Details */}
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-map-marker-alt text-[#2A6BB5]"></i>
                          Address Details
                        </h3>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5">
                          <h4 className="font-semibold text-gray-800 mb-3">Present Address</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Street Address</label>
                              <textarea value={formData.presentAddress} onChange={(e) => handleChange('presentAddress', e.target.value)} rows={2} placeholder="House No., Building, Street, Area" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">City</label>
                              <input type="text" value={formData.presentCity} onChange={(e) => handleChange('presentCity', e.target.value)} placeholder="City" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Pin Code</label>
                              <input type="text" value={formData.presentPin} onChange={(e) => handleChange('presentPin', e.target.value)} placeholder="XXXXXX" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mb-5 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <input type="checkbox" id="sameAddress" checked={formData.sameAsPresent} onChange={(e) => handleSameAddress(e.target.checked)} className="w-5 h-5 text-[#2E3093] rounded" />
                          <label htmlFor="sameAddress" className="cursor-pointer text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <i className="fas fa-copy text-yellow-600"></i>
                            Permanent address is same as present address
                          </label>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-800 mb-3">Permanent Address</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Street Address</label>
                              <textarea value={formData.permanentAddress} onChange={(e) => handleChange('permanentAddress', e.target.value)} rows={2} placeholder="House No., Building, Street, Area" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none" disabled={formData.sameAsPresent} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">State</label>
                              <input type="text" value={formData.permanentState} onChange={(e) => handleChange('permanentState', e.target.value)} placeholder="State" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" disabled={formData.sameAsPresent} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Country</label>
                              <input type="text" value={formData.permanentCountry} onChange={(e) => handleChange('permanentCountry', e.target.value)} placeholder="Country" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" disabled={formData.sameAsPresent} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 2: Academic ── */}
                  {currentStep === 2 && (
                    <div className="space-y-5">
                      {/* Tab Navigation */}
                      <div className="border-b border-gray-300">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setAcademicTab('ssc')}
                            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                              academicTab === 'ssc'
                                ? 'text-[#2A6BB5] border-[#2A6BB5] bg-blue-50'
                                : 'text-gray-600 border-transparent hover:text-[#2A6BB5] hover:border-gray-300'
                            }`}
                          >
                            <i className="fas fa-school mr-2"></i>
                            SSC (10th)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('hsc')}
                            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                              academicTab === 'hsc'
                                ? 'text-[#2A6BB5] border-[#2A6BB5] bg-blue-50'
                                : 'text-gray-600 border-transparent hover:text-[#2A6BB5] hover:border-gray-300'
                            }`}
                          >
                            <i className="fas fa-graduation-cap mr-2"></i>
                            HSC (12th)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('diploma')}
                            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                              academicTab === 'diploma'
                                ? 'text-[#2A6BB5] border-[#2A6BB5] bg-blue-50'
                                : 'text-gray-600 border-transparent hover:text-[#2A6BB5] hover:border-gray-300'
                            }`}
                          >
                            <i className="fas fa-certificate mr-2"></i>
                            Diploma
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('graduation')}
                            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                              academicTab === 'graduation'
                                ? 'text-[#2A6BB5] border-[#2A6BB5] bg-blue-50'
                                : 'text-gray-600 border-transparent hover:text-[#2A6BB5] hover:border-gray-300'
                            }`}
                          >
                            <i className="fas fa-user-graduate mr-2"></i>
                            Graduation
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcademicTab('postgrad')}
                            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                              academicTab === 'postgrad'
                                ? 'text-[#2A6BB5] border-[#2A6BB5] bg-blue-50'
                                : 'text-gray-600 border-transparent hover:text-[#2A6BB5] hover:border-gray-300'
                            }`}
                          >
                            <i className="fas fa-award mr-2"></i>
                            Post-Graduation
                          </button>
                        </div>
                      </div>

                      {/* SSC Tab */}
                      {academicTab === 'ssc' && (
                        <div className="space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-school text-[#2A6BB5]"></i>
                              10th / SSC Education
                              <span className="text-red-500 ml-1">*</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Board <span className="text-red-500">*</span></label>
                                <select value={formData.ssc_board} onChange={(e) => handleChange('ssc_board', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required>
                                  <option value="">Select Board</option>
                                  <option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">School Name <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.ssc_schoolName} onChange={(e) => handleChange('ssc_schoolName', e.target.value)} placeholder="Enter school name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year of Passing <span className="text-red-500">*</span></label>
                                <input type="number" value={formData.ssc_yearOfPassing} onChange={(e) => handleChange('ssc_yearOfPassing', e.target.value)} placeholder="YYYY" min="1990" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Percentage / CGPA <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.ssc_percentage} onChange={(e) => handleChange('ssc_percentage', e.target.value)} placeholder="e.g. 85% or 8.5 CGPA" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" required />
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
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={kt.subjectName} onChange={(e) => handleKtDetailChange('ssc', index, 'subjectName', e.target.value)} placeholder="Enter subject name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year <span className="text-red-500">*</span></label>
                                        <input type="number" value={kt.year} onChange={(e) => handleKtDetailChange('ssc', index, 'year', e.target.value)} placeholder="YYYY" min="2000" max="2030" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semester <span className="text-red-500">*</span></label>
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
                        <div className="space-y-5">
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
                        <div className="space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-certificate text-[#2A6BB5]"></i>
                              Diploma Education <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
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
                        <div className="space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-user-graduate text-[#2A6BB5]"></i>
                              Graduation <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
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
                        <div className="space-y-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                              <i className="fas fa-award text-[#2A6BB5]"></i>
                              Post-Graduation <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
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
                    <div className="space-y-5">
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

                    </div>
                  )}

                  {/* ── STEP 4: Training ── */}
                  {currentStep === 4 && (
                    <div className="space-y-5">
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
                                onChange={(e) => handleChange('batchCode', e.target.value)}
                                disabled={!formData.trainingCategory || loadingBatches}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all disabled:bg-gray-50"
                              >
                                <option value="">Select batch code</option>
                                {availableBatches.map((b) => (
                                  <option key={b.batchCode} value={b.batchCode}>
                                    {b.batchCode}{b.timings ? ` — ${b.timings}` : ''}
                                  </option>
                                ))}
                              </select>
                              {loadingBatches && <div className="absolute right-8 top-1/2 -translate-y-1/2"><i className="fas fa-spinner fa-spin text-[#2A6BB5] text-xs"></i></div>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Consent Form Banner — triggers when Student doesn't meet course eligibility */}
                      {formData.occupationalStatus === 'Student' && !checkEligibility() && (
                        <div className={`mt-5 rounded-xl border-2 p-4 flex items-start gap-3 ${
                          consentAcknowledged ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'
                        }`}>
                          <i className={`fas ${
                            consentAcknowledged ? 'fa-check-circle text-green-500' : 'fa-exclamation-circle text-orange-500'
                          } text-lg flex-shrink-0 mt-0.5`}></i>
                          <div className="flex-1">
                            <p className={`text-sm font-bold ${consentAcknowledged ? 'text-green-800' : 'text-orange-800'}`}>
                              {consentAcknowledged ? 'Consent Form Acknowledged' : 'Educational Consent Form Required'}
                            </p>
                            <p className={`text-xs mt-0.5 ${consentAcknowledged ? 'text-green-700' : 'text-orange-700'}`}>
                              {consentAcknowledged
                                ? 'You have reviewed and accepted all consent declarations.'
                                : 'Your educational background does not match the selected training program eligibility. Please complete the consent form.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setConsentType('student'); setShowConsentModal(true); }}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              consentAcknowledged
                                ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {consentAcknowledged ? 'Review' : 'Fill Consent Form'}
                          </button>
                        </div>
                      )}

                      {/* Consent Form Banner — triggers when Employee has 10+ years experience */}
                      {formData.occupationalStatus === 'Employee' && parseInt(formData.totalOccupationYears) >= 10 && (
                        <div className={`mt-5 rounded-xl border-2 p-4 flex items-start gap-3 ${
                          experiencedConsentAcknowledged ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'
                        }`}>
                          <i className={`fas ${
                            experiencedConsentAcknowledged ? 'fa-check-circle text-green-500' : 'fa-briefcase text-blue-500'
                          } text-lg flex-shrink-0 mt-0.5`}></i>
                          <div className="flex-1">
                            <p className={`text-sm font-bold ${experiencedConsentAcknowledged ? 'text-green-800' : 'text-blue-800'}`}>
                              {experiencedConsentAcknowledged ? 'Experienced Candidate Consent Acknowledged' : 'Experienced Candidate Consent Form Required'}
                            </p>
                            <p className={`text-xs mt-0.5 ${experiencedConsentAcknowledged ? 'text-green-700' : 'text-blue-700'}`}>
                              {experiencedConsentAcknowledged
                                ? 'You have reviewed and accepted all consent declarations for experienced candidates.'
                                : 'You have 10+ years of work experience. Please complete the consent form for experienced candidates.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setConsentType('experienced'); setShowConsentModal(true); }}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

                  {/* ── STEP 5: Documents ── */}
                  {currentStep === 5 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-file-upload text-[#2A6BB5]"></i>
                          Upload Required Documents
                        </h3>
                        <p className="text-sm text-gray-600 mb-6">Please upload the following documents. Supported formats: PDF, JPG, JPEG, PNG (Max 5MB each)</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Passport Photo */}
                          <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#2A6BB5] hover:bg-[#2A6BB5]/5 transition-all">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                              <i className="fas fa-camera text-xl text-[#2A6BB5]"></i>
                            </div>
                            <label className="block text-xs font-semibold text-gray-800 mb-1.5">Passport Photo</label>
                            <p className="text-xs text-gray-500 mb-3">Recent passport size photo</p>
                            <input type="file" id="photoFile" accept="image/*" onChange={(e) => handleChange('photoFile', e.target.files?.[0])} className="hidden" />
                            <button type="button" onClick={() => document.getElementById('photoFile')?.click()} className="px-4 py-2 bg-[#2A6BB5] text-white rounded-lg transition-all hover:bg-[#2E3093] text-xs font-semibold">
                              <i className="fas fa-upload mr-2"></i>Choose File
                            </button>
                            {formData.photoFile && <div className="mt-3 p-2 bg-green-50 rounded flex items-center justify-center gap-2"><i className="fas fa-check-circle text-green-600"></i><p className="text-xs text-green-700 font-medium truncate">{formData.photoFile.name}</p></div>}
                          </div>
                          {/* CV */}
                          <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#2A6BB5] hover:bg-[#2A6BB5]/5 transition-all">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                              <i className="fas fa-file-alt text-xl text-purple-600"></i>
                            </div>
                            <label className="block text-xs font-semibold text-gray-800 mb-1.5">CV/Resume</label>
                            <p className="text-xs text-gray-500 mb-3">Upload your latest CV</p>
                            <input type="file" id="cvFile" accept=".pdf,.doc,.docx" onChange={(e) => handleChange('cvFile', e.target.files?.[0])} className="hidden" />
                            <button type="button" onClick={() => document.getElementById('cvFile')?.click()} className="px-4 py-2 bg-purple-600 text-white rounded-lg transition-all hover:bg-purple-700 text-xs font-semibold">
                              <i className="fas fa-upload mr-2"></i>Choose File
                            </button>
                            {formData.cvFile && <div className="mt-3 p-2 bg-green-50 rounded flex items-center justify-center gap-2"><i className="fas fa-check-circle text-green-600"></i><p className="text-xs text-green-700 font-medium truncate">{formData.cvFile.name}</p></div>}
                          </div>
                          {/* Degree */}
                          <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#2A6BB5] hover:bg-[#2A6BB5]/5 transition-all">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                              <i className="fas fa-graduation-cap text-xl text-green-600"></i>
                            </div>
                            <label className="block text-xs font-semibold text-gray-800 mb-1.5">Degree Certificate</label>
                            <p className="text-xs text-gray-500 mb-3">Latest degree/marksheet</p>
                            <input type="file" id="degreeFile" accept=".pdf,image/*" onChange={(e) => handleChange('degreeFile', e.target.files?.[0])} className="hidden" />
                            <button type="button" onClick={() => document.getElementById('degreeFile')?.click()} className="px-4 py-2 bg-green-600 text-white rounded-lg transition-all hover:bg-green-700 text-xs font-semibold">
                              <i className="fas fa-upload mr-2"></i>Choose File
                            </button>
                            {formData.degreeFile && <div className="mt-3 p-2 bg-green-50 rounded flex items-center justify-center gap-2"><i className="fas fa-check-circle text-green-600"></i><p className="text-xs text-green-700 font-medium truncate">{formData.degreeFile.name}</p></div>}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                          <i className="fas fa-id-card text-[#2A6BB5]"></i>
                          Identity Proof
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">ID Proof Type</label>
                            <select value={formData.idProofType} onChange={(e) => handleChange('idProofType', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all">
                              <option>Aadhar Card</option><option>Passport</option><option>PAN Card</option>
                              <option>Voter ID</option><option>Driving License</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Upload ID Proof</label>
                            <input type="file" accept=".pdf,image/*" onChange={(e) => handleChange('idProofFile', e.target.files?.[0])} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#2A6BB5] file:text-white hover:file:bg-[#2E3093] file:cursor-pointer" />
                            {formData.idProofFile && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><i className="fas fa-check-circle"></i>File uploaded successfully</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 6: Terms & Conditions ── */}
                  {currentStep === 6 && (
                    <div className="space-y-5">
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
                <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-3 shadow-lg">
                  <div className="flex justify-between items-center gap-3">
                    {currentStep === 1 ? (
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <i className="fas fa-lock"></i>
                        Your information is secure
                      </div>
                    ) : (
                      <button type="button" onClick={() => nextStep(currentStep - 1)} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all">
                        <i className="fas fa-arrow-left mr-2"></i>Back
                      </button>
                    )}

                    {currentStep < 6 ? (
                      <button type="button" onClick={() => nextStep(currentStep + 1)} className="px-6 py-2 bg-gradient-to-r from-[#FAE452] to-[#FDD835] text-[#2E3093] rounded-lg font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        Continue <i className="fas fa-arrow-right ml-2"></i>
                      </button>
                    ) : (
                      <button type="submit" disabled={submitting} className="px-6 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {submitting ? (
                          <><i className="fas fa-spinner fa-spin mr-2"></i>Submitting...</>
                        ) : (
                          <><i className="fas fa-check-circle mr-2"></i>Submit Application</>
                        )}
                      </button>
                    )}
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
        <div className="max-w-full mx-auto px-6 py-2.5 flex items-center text-center justify-center">
          <div className="flex items-center gap-2.5">
            <span className="text-white/70 text-xs">© {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.</span>
          </div>
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
              <Image src="/sit.png" alt="" width={600} height={600} className="opacity-[0.025] object-contain" style={{maxWidth:'80vw',maxHeight:'80vh'}} />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-6 space-y-3 text-sm">

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
                        <div className="mt-2 bg-white border border-gray-200 rounded-lg p-3 text-xs space-y-1.5">
                          {[['Bank account name','Suvidya Institute of Technology Pvt. Ltd.'],['Bank Name','Axis Bank Ltd.'],['Branch Address','Vakola, Mumbai (MH), City Survey No. 841 to 846, Florence Lorenace Chs. Ltd. Mumbai 400055.'],['IFSC code for NEFT','UTIB0001244'],['MICR Code','400211082'],['Bank Account No.','911020002988600']].map(([k,v])=>(
                            <div key={k} className="flex gap-2"><span className="font-semibold text-gray-700 w-36 flex-shrink-0">{k}</span><span className="text-gray-600">: {v}</span></div>
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
                        <div className="mt-1.5 grid grid-cols-3 gap-1 text-xs bg-white border border-gray-200 rounded-lg p-2">
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
                    <div className="mt-4 flex items-center gap-2.5 bg-green-50 border-2 border-green-400 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-check text-white text-sm"></i>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-green-800">Declaration Accepted</div>
                        <div className="text-xs text-green-600 mt-0.5">You have acknowledged all sections and accepted the terms. You may now close this window.</div>
                      </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-6 py-5 rounded-t-2xl flex-shrink-0 text-center">
              <h2 className="text-white font-bold text-lg tracking-widest uppercase">Consent Form</h2>
              <p className="text-white/80 text-xs mt-1">
                {consentType === 'student' 
                  ? 'For Candidates with Different Educational Background'
                  : 'For Experienced Candidates (10+ Years)'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name of the Candidate</label>
                  <input readOnly value={[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Course Name</label>
                  <input readOnly value={formData.trainingProgrammeName || '—'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Batch No.</label>
                  <input readOnly value={formData.batchCode || '—'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Eligibility for the Course</label>
                  <input type="text" value={consentData.eligibility}
                    onChange={(e) => setConsentData(p => ({ ...p, eligibility: e.target.value }))}
                    placeholder="e.g. 10th + 3 yrs experience"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Qualification of the Candidate</label>
                  <input type="text" value={consentData.qualification}
                    onChange={(e) => setConsentData(p => ({ ...p, qualification: e.target.value }))}
                    placeholder="e.g. HSC, Diploma"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Experience of the Candidate (Dept &amp; Company)</label>
                  <input readOnly
                    value={[formData.jobDesignation, formData.jobOrganisation].filter(Boolean).join(' at ') ||
                      (formData.workingFromYears ? `${formData.workingFromYears} yr${parseInt(formData.workingFromYears) !== 1 ? 's' : ''}${formData.workingFromMonths ? ` ${formData.workingFromMonths} month${parseInt(formData.workingFromMonths) !== 1 ? 's' : ''}` : ''}` : '—')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-bold text-[#2E3093] mb-1">Consent Declaration</h3>
                <p className="text-xs text-gray-600 mb-4">
                  I, the undersigned <span className="font-semibold">{[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ') || '…'}</span>, hereby declare and accept the following:
                </p>
                <div className="space-y-3">
                  {[
                    `I am enrolling in the Training Program "${formData.trainingCategory || '…'}" voluntarily and with full understanding of the Training Program structure, objectives, and outcomes.`,
                    'I have been informed of the eligibility criteria and understand that my admission is being considered as an exception based on my interest, motivation, and willingness to learn.',
                    'I take full responsibility for bridging any gaps in foundational knowledge and agree to put in the required effort to understand and complete the Training Program content effectively.',
                    'On account of my educational background, I will be solely responsible for my training, performance, and placement.',
                    'I confirm that I am joining the Training Program with a clear understanding of the above.',
                  ].map((text, i) => (
                    <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      consentChecks[i] ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200 hover:border-[#2A6BB5]/40'
                    }`}>
                      <input type="checkbox" checked={consentChecks[i]}
                        onChange={(e) => {
                          const updated = [...consentChecks];
                          updated[i] = e.target.checked;
                          setConsentChecks(updated);
                        }}
                        className="w-4 h-4 mt-0.5 flex-shrink-0 accent-[#2E3093] cursor-pointer" />
                      <span className="text-xs text-gray-700 leading-relaxed">
                        <span className="font-semibold text-[#2E3093] mr-1">{i + 1}.</span>{text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Candidate Remark</label>
                <textarea value={consentData.candidateRemark}
                  onChange={(e) => setConsentData(p => ({ ...p, candidateRemark: e.target.value }))}
                  placeholder="Any remarks (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none" />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-2">In Presence of <span className="font-normal text-blue-600">(to be completed by departments)</span>:</p>
                <div className="grid grid-cols-3 gap-2">
                  {['CBD Dept', 'Training Dept', 'Placement Dept'].map((dept) => (
                    <div key={dept} className="text-xs text-blue-700 flex items-center gap-1">
                      <i className="fas fa-pen-nib text-blue-400 text-xs"></i> {dept}
                    </div>
                  ))}
                </div>
              </div>

              {!allConsentChecked && (
                <p className="text-xs text-orange-600 flex items-center gap-1.5">
                  <i className="fas fa-exclamation-circle"></i>
                  Please acknowledge all 5 declarations before confirming.
                </p>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 flex gap-3 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={() => setShowConsentModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all">
                <i className="fas fa-times mr-2"></i>Close
              </button>
              <button type="button" disabled={!allConsentChecked}
                onClick={() => { 
                  if (consentType === 'student') {
                    setConsentAcknowledged(true);
                  } else {
                    setExperiencedConsentAcknowledged(true);
                  }
                  setShowConsentModal(false); 
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none">
                <i className="fas fa-check-circle mr-2"></i>Confirm &amp; Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
