'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

const STEPS = [
  { id: 1, title: 'Personal Info', icon: 'fa-user', description: 'Basic personal details' },
  { id: 2, title: 'Academic', icon: 'fa-graduation-cap', description: 'Educational qualifications' },
  { id: 3, title: 'Occupational Info', icon: 'fa-briefcase', description: 'Current occupational status' },
  { id: 4, title: 'Training', icon: 'fa-chalkboard-teacher', description: 'Training programme details' },
  { id: 5, title: 'Documents', icon: 'fa-cloud-upload-alt', description: 'Upload required documents' },
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

export default function AdmissionFormPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { canCreate, loading: permLoading } = useResourcePermissions('online_admission');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [gradUniversitySuggestions, setGradUniversitySuggestions] = useState<string[]>([]);
  const [postgradUniversitySuggestions, setPostgradUniversitySuggestions] = useState<string[]>([]);
  const [searchingGradUniversities, setSearchingGradUniversities] = useState(false);
  const [searchingPostgradUniversities, setSearchingPostgradUniversities] = useState(false);
  const [showAddUniversityModal, setShowAddUniversityModal] = useState(false);
  const [newUniversityData, setNewUniversityData] = useState({ name: '', country: '', city: '', fieldType: 'grad' });
  const [academicTab, setAcademicTab] = useState<'ssc' | 'hsc' | 'diploma' | 'graduation' | 'postgrad'>('ssc');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [consentChecks, setConsentChecks] = useState<boolean[]>(Array(5).fill(false));
  const [consentData, setConsentData] = useState({ eligibility: '', qualification: '', candidateRemark: '' });
  const allConsentChecked = consentChecks.every(Boolean);
  
  // Refs for debouncing university search
  const gradSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const postgradSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    // Personal Details
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
    
    // Address Details
    presentAddress: '',
    presentCity: '',
    presentPin: '',
    permanentAddress: '',
    permanentState: '',
    permanentCountry: 'India',
    sameAsPresent: false,
    
    // Education Details
    // 10th/SSC
    ssc_board: '',
    ssc_schoolName: '',
    ssc_yearOfPassing: '',
    ssc_percentage: '',
    
    // 12th/HSC
    hsc_board: '',
    hsc_collegeName: '',
    hsc_stream: '',
    hsc_yearOfPassing: '',
    hsc_percentage: '',
    
    // Diploma (optional)
    diploma_degree: '',
    diploma_specialization: '',
    diploma_institute: '',
    diploma_yearOfPassing: '',
    diploma_percentage: '',
    
    // Graduation (optional)
    grad_degree: '',
    grad_specialization: '',
    grad_university: '',
    grad_yearOfPassing: '',
    grad_percentage: '',
    
    // Post-Graduation (optional)
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
    
    // Training & Occupational
    occupationalStatus: '',
    
    // Employment Details (for "Employed" status)
    jobOrganisation: '',
    jobDescription: '',
    jobDesignation: '',
    workingFromYears: '',
    workingFromMonths: '',
    totalOccupationYears: '',
    
    // Self Employment Details (for "Self-Employed" status)
    selfEmploymentDetails: '',
    
    trainingCategory: '',
    trainingProgram: '',
    batchCode: '',
    termsAgreed: false,
    
    // Documents
    photoFile: null as File | null,
    cvFile: null as File | null,
    degreeFile: null as File | null,
    idProofType: 'Aadhar Card',
    idProofFile: null as File | null,
  });

  useEffect(() => {
    fetchStudentData();
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

  const fetchStudentData = async () => {
    try {
      const res = await fetch(`/api/inquiry?id=${studentId}`);
      const data = await res.json();
      if (data.inquiry) {
        // Pre-fill form with existing data
        setFormData(prev => ({
          ...prev,
          fullName: data.inquiry.Student_Name || '',
          email: data.inquiry.Email || '',
          mobile: data.inquiry.Present_Mobile || '',
          dob: data.inquiry.DOB || '',
          gender: data.inquiry.Sex || '',
          nationality: data.inquiry.Nationality || 'Indian',
          batchCode: data.inquiry.Batch_Code || '',
        }));
      }
    } catch (err) {
      console.error('Error fetching student data:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchUniversities = async (query: string, fieldType: 'grad' | 'postgrad') => {
    const timeoutRef = fieldType === 'grad' ? gradSearchTimeoutRef : postgradSearchTimeoutRef;
    const setSuggestions = fieldType === 'grad' ? setGradUniversitySuggestions : setPostgradUniversitySuggestions;
    const setSearching = fieldType === 'grad' ? setSearchingGradUniversities : setSearchingPostgradUniversities;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query || query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    // Show searching indicator
    setSearching(true);

    // Debounce the search by 500ms
    timeoutRef.current = setTimeout(async () => {
      try {
        // Use our API route
        const res = await fetch(`/api/search-universities?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.success && data.universities && Array.isArray(data.universities)) {
          // Extract university names with optional country info
          const suggestions = data.universities.map((u: { name: string; country?: string }) => 
            u.country ? `${u.name} (${u.country})` : u.name
          );
          setSuggestions(suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error('Error searching universities:', err);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const handleAddUniversity = () => {
    if (!newUniversityData.name.trim()) {
      alert('Please enter university name');
      return;
    }
    // Simply add the custom university name to the appropriate field
    const fieldName = newUniversityData.fieldType === 'grad' ? 'grad_university' : 'postgrad_university';
    setFormData(prev => ({ ...prev, [fieldName]: newUniversityData.name }));
    setShowAddUniversityModal(false);
    setNewUniversityData({ name: '', country: '', city: '', fieldType: 'grad' });
  };

  // Cleanup search timeouts on unmount
  useEffect(() => {
    const gradTimeout = gradSearchTimeoutRef.current;
    const postgradTimeout = postgradSearchTimeoutRef.current;
    return () => {
      if (gradTimeout) {
        clearTimeout(gradTimeout);
      }
      if (postgradTimeout) {
        clearTimeout(postgradTimeout);
      }
    };
  }, []);

  // Check if student meets eligibility for selected training program
  const checkEligibility = (): boolean => {
    if (!formData.trainingProgram || formData.occupationalStatus !== 'Student') return true;
    
    const eligibleBackgrounds = COURSE_ELIGIBILITY[formData.trainingProgram];
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

  const handleChange = (field: string, value: string | boolean | File | null | undefined) => {
    if (value === undefined) return;
    
    // Initialize KT details array when KT subject count changes for any education level
    if (field.endsWith('_ktCount') && typeof value === 'string') {
      const count = parseInt(value) || 0;
      const detailsField = field.replace('_ktCount', '_ktDetails') as keyof typeof formData;
      const currentDetails = formData[detailsField] as { subjectName: string; year: string; semester: string; clearedYear: string; marks: string; marksheetFile: File | null }[];
      
      const newKtDetails = Array.from({ length: count }, (_, i) => 
        currentDetails[i] || {
          subjectName: '',
          year: '',
          semester: '',
          clearedYear: '',
          marks: '',
          marksheetFile: null,
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
    }
    return true;
  };

  const nextStep = (step: number) => {
    // Validate current step before moving forward
    if (step > currentStep && !validateStep(currentStep)) {
      return;
    }
    
    // Mark current step as completed if moving forward
    if (step > currentStep && !completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    
    setCurrentStep(step);
  };

  const jumpToStep = (step: number) => {
    // Allow jumping to any step at any time
    setCurrentStep(step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all mandatory fields before submission
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
    
    if (!formData.termsAgreed) {
      alert('Please complete Step 5: Agree to terms and conditions');
      setCurrentStep(5);
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        Student_Id: parseInt(studentId),
        inquiryId: studentId,
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
        // Education Details
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
        trainingCategory: formData.trainingCategory,
        batchCode: formData.batchCode,
        idProofType: formData.idProofType,
      };

      const res = await fetch('/api/online-admission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Admission form submitted successfully!');
        router.push('/dashboard/online-admission');
      } else {
        alert(data.error || 'Failed to submit form');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('An error occurred while submitting the form');
    } finally {
      setSubmitting(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied />;

  return (
    <div className="fixed inset-0 top-[100px] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Breadcrumbs */}
      <div className="bg-white border-b border-gray-200 z-20 shadow-sm flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <nav className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-500 hover:text-[#2E3093] transition-colors"
              >
                <i className="fas fa-home mr-1"></i>
                Dashboard
              </button>
              <i className="fas fa-chevron-right text-gray-400 text-xs"></i>
              <button
                onClick={() => router.push('/dashboard/inquiry')}
                className="text-gray-500 hover:text-[#2E3093] transition-colors"
              >
                Inquiries
              </button>
              <i className="fas fa-chevron-right text-gray-400 text-xs"></i>
              <span className="text-[#2E3093] font-semibold">Admission Form</span>
            </nav>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500">
                Student ID: <span className="font-semibold text-gray-700">#{studentId}</span>
              </div>
              <button
                onClick={() => router.push('/dashboard/inquiry')}
                className="text-xs text-gray-600 hover:text-gray-800 transition-colors"
              >
                <i className="fas fa-times mr-1"></i>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-[1400px] mx-auto px-4 py-4">
          <div className="flex gap-4 h-full">
          {/* Side Navigation */}
          <aside className="w-64 flex-shrink-0 h-full overflow-y-auto flex flex-col">
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
                  
                  return (
                    <button
                      key={step.id}
                      onClick={() => jumpToStep(step.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg mb-1.5 transition-all ${
                        isActive
                          ? 'bg-[#2E3093] text-white shadow-md'
                          : isCompleted
                          ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? 'bg-white/20'
                              : isCompleted
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {isCompleted ? (
                            <i className="fas fa-check text-sm"></i>
                          ) : (
                            <i className={`fas ${step.icon} text-sm`}></i>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-xs ${isActive ? 'text-white' : ''}`}>
                            {step.title}
                          </div>
                          <div className={`text-xs mt-0 ${
                            isActive ? 'text-white/80' : isCompleted ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {step.description}
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
                  ></div>
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

          {/* Main Content */}
          <main className="flex-1 min-w-0 h-full">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden h-full flex flex-col">
              {/* Progress Header - Fixed */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-3 border-b border-gray-200 flex-shrink-0">
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
                      {currentStep}
                      <span className="text-base text-gray-400">/{STEPS.length}</span>
                    </div>
                  </div>
                </div>

                {/* Mini Progress Dots */}
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
                    ></div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* STEP 1: Personal Info */}
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleChange('firstName', e.target.value)}
                        placeholder="Enter first name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Middle Name
                      </label>
                      <input
                        type="text"
                        value={formData.middleName}
                        onChange={(e) => handleChange('middleName', e.target.value)}
                        placeholder="Enter middle name (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleChange('lastName', e.target.value)}
                        placeholder="Enter last name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Short Name (For ID Card)
                      </label>
                      <input
                        type="text"
                        value={formData.shortName}
                        onChange={(e) => handleChange('shortName', e.target.value)}
                        placeholder="e.g. Alex J."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Date of Birth <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => handleChange('dob', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-6 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="gender"
                            value="Male"
                            checked={formData.gender === 'Male'}
                            onChange={(e) => handleChange('gender', e.target.value)}
                            className="w-4 h-4 text-[#2E3093]"
                          />
                          <span>Male</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="gender"
                            value="Female"
                            checked={formData.gender === 'Female'}
                            onChange={(e) => handleChange('gender', e.target.value)}
                            className="w-4 h-4 text-[#2E3093]"
                          />
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Nationality <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.nationality}
                        onChange={(e) => handleChange('nationality', e.target.value)}
                        placeholder="Indian"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="email@domain.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={formData.mobile}
                        onChange={(e) => handleChange('mobile', e.target.value)}
                        placeholder="+91-XXXXXXXXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Telephone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.telephone}
                        onChange={(e) => handleChange('telephone', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Family Contact Number
                      </label>
                      <input
                        type="tel"
                        value={formData.familyContact}
                        onChange={(e) => handleChange('familyContact', e.target.value)}
                        placeholder="Emergency contact"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      />
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
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Street Address
                        </label>
                        <textarea
                          value={formData.presentAddress}
                          onChange={(e) => handleChange('presentAddress', e.target.value)}
                          rows={2}
                          placeholder="House No., Building, Street, Area"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">City</label>
                        <input
                          type="text"
                          value={formData.presentCity}
                          onChange={(e) => handleChange('presentCity', e.target.value)}
                          placeholder="City"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Pin Code</label>
                        <input
                          type="text"
                          value={formData.presentPin}
                          onChange={(e) => handleChange('presentPin', e.target.value)}
                          placeholder="XXXXXX"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-5 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <input
                      type="checkbox"
                      id="sameAddress"
                      checked={formData.sameAsPresent}
                      onChange={(e) => handleSameAddress(e.target.checked)}
                      className="w-5 h-5 text-[#2E3093] rounded"
                    />
                    <label htmlFor="sameAddress" className="cursor-pointer text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <i className="fas fa-copy text-yellow-600"></i>
                      Permanent address is same as present address
                    </label>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3">Permanent Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Street Address
                        </label>
                        <textarea
                          value={formData.permanentAddress}
                          onChange={(e) => handleChange('permanentAddress', e.target.value)}
                          rows={2}
                          placeholder="House No., Building, Street, Area"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none"
                          disabled={formData.sameAsPresent}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">State</label>
                        <input
                          type="text"
                          value={formData.permanentState}
                          onChange={(e) => handleChange('permanentState', e.target.value)}
                          placeholder="State"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          disabled={formData.sameAsPresent}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Country</label>
                        <input
                          type="text"
                          value={formData.permanentCountry}
                          onChange={(e) => handleChange('permanentCountry', e.target.value)}
                          placeholder="Country"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          disabled={formData.sameAsPresent}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* STEP 2: Educational Qualifications */}
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

              {/* SSC Tab Content */}
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
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Board <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.ssc_board}
                          onChange={(e) => handleChange('ssc_board', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        >
                          <option value="">Select Board</option>
                          <option value="CBSE">CBSE</option>
                          <option value="ICSE">ICSE</option>
                          <option value="State Board">State Board</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          School Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.ssc_schoolName}
                          onChange={(e) => handleChange('ssc_schoolName', e.target.value)}
                          placeholder="Enter school name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Year of Passing <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={formData.ssc_yearOfPassing}
                          onChange={(e) => handleChange('ssc_yearOfPassing', e.target.value)}
                          placeholder="YYYY"
                          min="1990"
                          max="2030"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Percentage / CGPA <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.ssc_percentage}
                          onChange={(e) => handleChange('ssc_percentage', e.target.value)}
                          placeholder="e.g. 85% or 8.5 CGPA"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        />
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
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Number of KT Subjects (if any)
                        </label>
                        <select
                          value={formData.ssc_ktCount}
                          onChange={(e) => handleChange('ssc_ktCount', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="0">No KT</option>
                          <option value="1">1 Subject</option>
                          <option value="2">2 Subjects</option>
                          <option value="3">3 Subjects</option>
                          <option value="4">4 Subjects</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SSC KT Details */}
                  {parseInt(formData.ssc_ktCount) > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">SSC KT Subject Details</h4>
                      <div className="space-y-4">
                        {formData.ssc_ktDetails.map((kt, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                {index + 1}
                              </span>
                              KT Subject {index + 1}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Subject Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={kt.subjectName}
                                  onChange={(e) => handleKtDetailChange('ssc', index, 'subjectName', e.target.value)}
                                  placeholder="Enter subject name"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Year <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={kt.year}
                                  onChange={(e) => handleKtDetailChange('ssc', index, 'year', e.target.value)}
                                  placeholder="YYYY"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Semester <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={kt.semester}
                                  onChange={(e) => handleKtDetailChange('ssc', index, 'semester', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                >
                                  <option value="">Select Semester</option>
                                  <option value="1">Semester 1</option>
                                  <option value="2">Semester 2</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Cleared Year
                                </label>
                                <input
                                  type="number"
                                  value={kt.clearedYear}
                                  onChange={(e) => handleKtDetailChange('ssc', index, 'clearedYear', e.target.value)}
                                  placeholder="YYYY (if cleared)"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marks Obtained
                                </label>
                                <input
                                  type="number"
                                  value={kt.marks}
                                  onChange={(e) => handleKtDetailChange('ssc', index, 'marks', e.target.value)}
                                  placeholder="If cleared"
                                  min="0"
                                  max="100"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marksheet Upload
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      handleKtDetailChange('ssc', index, 'marksheetFile', file);
                                    }}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                  />
                                  {kt.marksheetFile && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      {kt.marksheetFile.name}
                                    </span>
                                  )}
                                </div>
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

              {/* HSC Tab Content */}
              {academicTab === 'hsc' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-graduation-cap text-[#2A6BB5]"></i>
                      12th / HSC / Higher Secondary Education
                      <span className="text-red-500 ml-1">*</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Board <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.hsc_board}
                          onChange={(e) => handleChange('hsc_board', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        >
                          <option value="">Select Board</option>
                          <option value="CBSE">CBSE</option>
                          <option value="ICSE">ICSE</option>
                          <option value="State Board">State Board</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          College / Junior College Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.hsc_collegeName}
                          onChange={(e) => handleChange('hsc_collegeName', e.target.value)}
                          placeholder="Enter college name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Stream <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.hsc_stream}
                          onChange={(e) => handleChange('hsc_stream', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        >
                          <option value="">Select Stream</option>
                          <option value="Science">Science</option>
                          <option value="Commerce">Commerce</option>
                          <option value="Arts">Arts</option>
                          <option value="Vocational">Vocational</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Year of Passing <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={formData.hsc_yearOfPassing}
                          onChange={(e) => handleChange('hsc_yearOfPassing', e.target.value)}
                          placeholder="YYYY"
                          min="1990"
                          max="2030"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Percentage / CGPA <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.hsc_percentage}
                          onChange={(e) => handleChange('hsc_percentage', e.target.value)}
                          placeholder="e.g. 75% or 7.5 CGPA"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* HSC KT Section */}
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                      KT / Backlog Details (HSC)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Number of KT Subjects (if any)
                        </label>
                        <select
                          value={formData.hsc_ktCount}
                          onChange={(e) => handleChange('hsc_ktCount', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="0">No KT</option>
                          <option value="1">1 Subject</option>
                          <option value="2">2 Subjects</option>
                          <option value="3">3 Subjects</option>
                          <option value="4">4 Subjects</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* HSC KT Details */}
                  {parseInt(formData.hsc_ktCount) > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">HSC KT Subject Details</h4>
                      <div className="space-y-4">
                        {formData.hsc_ktDetails.map((kt, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                {index + 1}
                              </span>
                              KT Subject {index + 1}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Subject Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={kt.subjectName}
                                  onChange={(e) => handleKtDetailChange('hsc', index, 'subjectName', e.target.value)}
                                  placeholder="Enter subject name"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Year <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={kt.year}
                                  onChange={(e) => handleKtDetailChange('hsc', index, 'year', e.target.value)}
                                  placeholder="YYYY"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Semester <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={kt.semester}
                                  onChange={(e) => handleKtDetailChange('hsc', index, 'semester', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                >
                                  <option value="">Select Semester</option>
                                  <option value="1">Semester 1</option>
                                  <option value="2">Semester 2</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Cleared Year
                                </label>
                                <input
                                  type="number"
                                  value={kt.clearedYear}
                                  onChange={(e) => handleKtDetailChange('hsc', index, 'clearedYear', e.target.value)}
                                  placeholder="YYYY (if cleared)"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marks Obtained
                                </label>
                                <input
                                  type="number"
                                  value={kt.marks}
                                  onChange={(e) => handleKtDetailChange('hsc', index, 'marks', e.target.value)}
                                  placeholder="If cleared"
                                  min="0"
                                  max="100"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marksheet Upload
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      handleKtDetailChange('hsc', index, 'marksheetFile', file);
                                    }}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                  />
                                  {kt.marksheetFile && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      {kt.marksheetFile.name}
                                    </span>
                                  )}
                                </div>
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

              {/* Diploma Tab Content */}
              {academicTab === 'diploma' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-certificate text-[#2A6BB5]"></i>
                      Diploma Education
                      <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Diploma Degree
                        </label>
                        <select
                          value={formData.diploma_degree}
                          onChange={(e) => handleChange('diploma_degree', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="">Please select</option>
                          <option value="Diploma">Diploma</option>
                          <option value="I.T.I.">I.T.I.</option>
                          <option value="Mech. Draughtsman">Mech. Draughtsman</option>
                          <option value="Civil Draughtsman">Civil Draughtsman</option>
                          <option value="Piping Draftsman">Piping Draftsman</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Electrical">Electrical</option>
                          <option value="OTHERS">OTHERS</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Specialization
                        </label>
                        <select
                          value={formData.diploma_specialization}
                          onChange={(e) => handleChange('diploma_specialization', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="">Please select</option>
                          <option value="Mechanical">Mechanical</option>
                          <option value="Chemical">Chemical</option>
                          <option value="Computers">Computers</option>
                          <option value="Production">Production</option>
                          <option value="Electronics & Tele-Communication">Electronics & Tele-Communication</option>
                          <option value="Eletrical">Eletrical</option>
                          <option value="Civil">Civil</option>
                          <option value="Instrumentation">Instrumentation</option>
                          <option value="Petrochemical">Petrochemical</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Automobile">Automobile</option>
                          <option value="Fabrication">Fabrication</option>
                          <option value="N.C.T.V.T.">N.C.T.V.T.</option>
                          <option value="M.C.V.C">M.C.V.C</option>
                          <option value="Refrigeration & Airconditioning">Refrigeration & Airconditioning</option>
                          <option value="Electrical & Electronics">Electrical & Electronics</option>
                          <option value="Fitter">Fitter</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Year of Passing
                        </label>
                        <input
                          type="number"
                          value={formData.diploma_yearOfPassing}
                          onChange={(e) => handleChange('diploma_yearOfPassing', e.target.value)}
                          placeholder="YYYY"
                          min="1990"
                          max="2030"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Institute Name
                        </label>
                        <input
                          type="text"
                          value={formData.diploma_institute}
                          onChange={(e) => handleChange('diploma_institute', e.target.value)}
                          placeholder="Enter institute name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Percentage / CGPA
                        </label>
                        <input
                          type="text"
                          value={formData.diploma_percentage}
                          onChange={(e) => handleChange('diploma_percentage', e.target.value)}
                          placeholder="e.g. 70% or 7.0 CGPA"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diploma KT Section */}
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                      KT / Backlog Details (Diploma)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Number of KT Subjects (if any)
                        </label>
                        <select
                          value={formData.diploma_ktCount}
                          onChange={(e) => handleChange('diploma_ktCount', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="0">No KT</option>
                          <option value="1">1 Subject</option>
                          <option value="2">2 Subjects</option>
                          <option value="3">3 Subjects</option>
                          <option value="4">4 Subjects</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Diploma KT Details */}
                  {parseInt(formData.diploma_ktCount) > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">Diploma KT Subject Details</h4>
                      <div className="space-y-4">
                        {formData.diploma_ktDetails.map((kt, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                {index + 1}
                              </span>
                              KT Subject {index + 1}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Subject Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={kt.subjectName}
                                  onChange={(e) => handleKtDetailChange('diploma', index, 'subjectName', e.target.value)}
                                  placeholder="Enter subject name"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Year <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={kt.year}
                                  onChange={(e) => handleKtDetailChange('diploma', index, 'year', e.target.value)}
                                  placeholder="YYYY"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Semester <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={kt.semester}
                                  onChange={(e) => handleKtDetailChange('diploma', index, 'semester', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                >
                                  <option value="">Select Semester</option>
                                  <option value="1">Semester 1</option>
                                  <option value="2">Semester 2</option>
                                  <option value="3">Semester 3</option>
                                  <option value="4">Semester 4</option>
                                  <option value="5">Semester 5</option>
                                  <option value="6">Semester 6</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Cleared Year
                                </label>
                                <input
                                  type="number"
                                  value={kt.clearedYear}
                                  onChange={(e) => handleKtDetailChange('diploma', index, 'clearedYear', e.target.value)}
                                  placeholder="YYYY (if cleared)"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marks Obtained
                                </label>
                                <input
                                  type="number"
                                  value={kt.marks}
                                  onChange={(e) => handleKtDetailChange('diploma', index, 'marks', e.target.value)}
                                  placeholder="If cleared"
                                  min="0"
                                  max="100"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marksheet Upload
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      handleKtDetailChange('diploma', index, 'marksheetFile', file);
                                    }}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                  />
                                  {kt.marksheetFile && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      {kt.marksheetFile.name}
                                    </span>
                                  )}
                                </div>
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

              {/* Graduation Tab Content */}
              {academicTab === 'graduation' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-user-graduate text-[#2A6BB5]"></i>
                      Graduation
                      <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Degree
                        </label>
                        <select
                          value={formData.grad_degree}
                          onChange={(e) => handleChange('grad_degree', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="">Please select</option>
                          <option value="BSC">BSC</option>
                          <option value="B.E.">B.E.</option>
                          <option value="B. TECH">B. TECH</option>
                          <option value="B.A">B.A</option>
                          <option value="B.Com">B.Com</option>
                          <option value="BE">BE</option>
                          <option value="OTHERS">OTHERS</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Specialization / Branch
                        </label>
                        <select
                          value={formData.grad_specialization}
                          onChange={(e) => handleChange('grad_specialization', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="">Please select</option>
                          <option value="Commerce">Commerce</option>
                          <option value="Chemical">Chemical</option>
                          <option value="Computers">Computers</option>
                          <option value="Mechanical">Mechanical</option>
                          <option value="Science">Science</option>
                          <option value="Production">Production</option>
                          <option value="Arts">Arts</option>
                          <option value="Electronics & Tele-Communication">Electronics & Tele-Communication</option>
                          <option value="Eletrical">Eletrical</option>
                          <option value="Civil">Civil</option>
                          <option value="Instrumentation">Instrumentation</option>
                          <option value="Petrochemical">Petrochemical</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Automobile">Automobile</option>
                          <option value="Fabrication">Fabrication</option>
                          <option value="N.C.T.V.T.">N.C.T.V.T.</option>
                          <option value="Chemistry">Chemistry</option>
                          <option value="M.C.V.C">M.C.V.C</option>
                          <option value="Refrigeration & Airconditioning">Refrigeration & Airconditioning</option>
                          <option value="Electrical & Electronics">Electrical & Electronics</option>
                          <option value="Fitter">Fitter</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Year of Passing
                        </label>
                        <input
                          type="number"
                          value={formData.grad_yearOfPassing}
                          onChange={(e) => handleChange('grad_yearOfPassing', e.target.value)}
                          placeholder="YYYY"
                          min="1990"
                          max="2030"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                      <div className="md:col-span-2 relative">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          University / Institute Name
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.grad_university}
                            onChange={(e) => {
                              handleChange('grad_university', e.target.value);
                              searchUniversities(e.target.value, 'grad');
                            }}
                            placeholder="Start typing to search..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          />
                          {searchingGradUniversities && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <i className="fas fa-spinner fa-spin text-[#2A6BB5]"></i>
                            </div>
                          )}
                        </div>
                        {gradUniversitySuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {gradUniversitySuggestions.map((university, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  handleChange('grad_university', university);
                                  setGradUniversitySuggestions([]);
                                }}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                              >
                                {university}
                              </div>
                            ))}
                            <div
                              onClick={() => {
                                setNewUniversityData({ name: formData.grad_university, country: '', city: '', fieldType: 'grad' });
                                setShowAddUniversityModal(true);
                                setGradUniversitySuggestions([]);
                              }}
                              className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm font-semibold text-green-700 flex items-center gap-2 sticky bottom-0 bg-white border-t border-gray-300"
                            >
                              <i className="fas fa-edit"></i>
                              Not in list? Add manually
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Percentage / CGPA
                        </label>
                        <input
                          type="text"
                          value={formData.grad_percentage}
                          onChange={(e) => handleChange('grad_percentage', e.target.value)}
                          placeholder="e.g. 70% or 7.0 CGPA"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Graduation KT Section */}
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                      KT / Backlog Details (Graduation)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Number of KT Subjects (if any)
                        </label>
                        <select
                          value={formData.grad_ktCount}
                          onChange={(e) => handleChange('grad_ktCount', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="0">No KT</option>
                          <option value="1">1 Subject</option>
                          <option value="2">2 Subjects</option>
                          <option value="3">3 Subjects</option>
                          <option value="4">4 Subjects</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Graduation KT Details */}
                  {parseInt(formData.grad_ktCount) > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">Graduation KT Subject Details</h4>
                      <div className="space-y-4">
                        {formData.grad_ktDetails.map((kt, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                {index + 1}
                              </span>
                              KT Subject {index + 1}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Subject Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={kt.subjectName}
                                  onChange={(e) => handleKtDetailChange('grad', index, 'subjectName', e.target.value)}
                                  placeholder="Enter subject name"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Year <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={kt.year}
                                  onChange={(e) => handleKtDetailChange('grad', index, 'year', e.target.value)}
                                  placeholder="YYYY"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Semester <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={kt.semester}
                                  onChange={(e) => handleKtDetailChange('grad', index, 'semester', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                >
                                  <option value="">Select Semester</option>
                                  <option value="1">Semester 1</option>
                                  <option value="2">Semester 2</option>
                                  <option value="3">Semester 3</option>
                                  <option value="4">Semester 4</option>
                                  <option value="5">Semester 5</option>
                                  <option value="6">Semester 6</option>
                                  <option value="7">Semester 7</option>
                                  <option value="8">Semester 8</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Cleared Year
                                </label>
                                <input
                                  type="number"
                                  value={kt.clearedYear}
                                  onChange={(e) => handleKtDetailChange('grad', index, 'clearedYear', e.target.value)}
                                  placeholder="YYYY (if cleared)"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marks Obtained
                                </label>
                                <input
                                  type="number"
                                  value={kt.marks}
                                  onChange={(e) => handleKtDetailChange('grad', index, 'marks', e.target.value)}
                                  placeholder="If cleared"
                                  min="0"
                                  max="100"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marksheet Upload
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      handleKtDetailChange('grad', index, 'marksheetFile', file);
                                    }}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                  />
                                  {kt.marksheetFile && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      {kt.marksheetFile.name}
                                    </span>
                                  )}
                                </div>
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

              {/* Post-Graduation Tab Content */}
              {academicTab === 'postgrad' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-award text-[#2A6BB5]"></i>
                      Post-Graduation
                      <span className="text-xs text-gray-500 font-normal ml-2">(Optional)</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Degree
                        </label>
                        <select
                          value={formData.postgrad_degree}
                          onChange={(e) => handleChange('postgrad_degree', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="">Please select</option>
                          <option value="M.E.">M.E.</option>
                          <option value="M.TECH.">M.TECH.</option>
                          <option value="MBA">MBA</option>
                          <option value="MCA">MCA</option>
                          <option value="MSC">MSC</option>
                          <option value="M.Com">M.Com</option>
                          <option value="M.A">M.A</option>
                          <option value="P.HD.">P.HD.</option>
                          <option value="OTHERS">OTHERS</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Specialization
                        </label>
                        <select
                          value={formData.postgrad_specialization}
                          onChange={(e) => handleChange('postgrad_specialization', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="">Please select</option>
                          <option value="Commerce">Commerce</option>
                          <option value="Chemical">Chemical</option>
                          <option value="Computers">Computers</option>
                          <option value="Mechanical">Mechanical</option>
                          <option value="Science">Science</option>
                          <option value="Production">Production</option>
                          <option value="Arts">Arts</option>
                          <option value="Electronics & Tele-Communication">Electronics & Tele-Communication</option>
                          <option value="Eletrical">Eletrical</option>
                          <option value="Civil">Civil</option>
                          <option value="Instrumentation">Instrumentation</option>
                          <option value="Petrochemical">Petrochemical</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Automobile">Automobile</option>
                          <option value="Fabrication">Fabrication</option>
                          <option value="N.C.T.V.T.">N.C.T.V.T.</option>
                          <option value="Chemistry">Chemistry</option>
                          <option value="M.C.V.C">M.C.V.C</option>
                          <option value="Refrigeration & Airconditioning">Refrigeration & Airconditioning</option>
                          <option value="Electrical & Electronics">Electrical & Electronics</option>
                          <option value="Fitter">Fitter</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Year of Passing
                        </label>
                        <input
                          type="number"
                          value={formData.postgrad_yearOfPassing}
                          onChange={(e) => handleChange('postgrad_yearOfPassing', e.target.value)}
                          placeholder="YYYY"
                          min="1990"
                          max="2030"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                      <div className="md:col-span-2 relative">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          University Name
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.postgrad_university}
                            onChange={(e) => {
                              handleChange('postgrad_university', e.target.value);
                              searchUniversities(e.target.value, 'postgrad');
                            }}
                            placeholder="Start typing to search..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                          />
                          {searchingPostgradUniversities && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <i className="fas fa-spinner fa-spin text-[#2A6BB5]"></i>
                            </div>
                          )}
                        </div>
                        {postgradUniversitySuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {postgradUniversitySuggestions.map((university, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  handleChange('postgrad_university', university);
                                  setPostgradUniversitySuggestions([]);
                                }}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                              >
                                {university}
                              </div>
                            ))}
                            <div
                              onClick={() => {
                                setNewUniversityData({ name: formData.postgrad_university, country: '', city: '', fieldType: 'postgrad' });
                                setShowAddUniversityModal(true);
                                setPostgradUniversitySuggestions([]);
                              }}
                              className="px-3 py-2 hover:bg-green-50 cursor-pointer text-sm font-semibold text-green-700 flex items-center gap-2 sticky bottom-0 bg-white border-t border-gray-300"
                            >
                              <i className="fas fa-edit"></i>
                              Not in list? Add manually
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Percentage / CGPA
                        </label>
                        <input
                          type="text"
                          value={formData.postgrad_percentage}
                          onChange={(e) => handleChange('postgrad_percentage', e.target.value)}
                          placeholder="e.g. 75% or 7.5 CGPA"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Post-Graduation KT Section */}
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-exclamation-triangle text-[#FAE452]"></i>
                      KT / Backlog Details (Post-Graduation)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Number of KT Subjects (if any)
                        </label>
                        <select
                          value={formData.postgrad_ktCount}
                          onChange={(e) => handleChange('postgrad_ktCount', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        >
                          <option value="0">No KT</option>
                          <option value="1">1 Subject</option>
                          <option value="2">2 Subjects</option>
                          <option value="3">3 Subjects</option>
                          <option value="4">4 Subjects</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Post-Graduation KT Details */}
                  {parseInt(formData.postgrad_ktCount) > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">Post-Graduation KT Subject Details</h4>
                      <div className="space-y-4">
                        {formData.postgrad_ktDetails.map((kt, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <span className="bg-[#2E3093] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                {index + 1}
                              </span>
                              KT Subject {index + 1}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div className="lg:col-span-3">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Subject Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={kt.subjectName}
                                  onChange={(e) => handleKtDetailChange('postgrad', index, 'subjectName', e.target.value)}
                                  placeholder="Enter subject name"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Year <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={kt.year}
                                  onChange={(e) => handleKtDetailChange('postgrad', index, 'year', e.target.value)}
                                  placeholder="YYYY"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Semester <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={kt.semester}
                                  onChange={(e) => handleKtDetailChange('postgrad', index, 'semester', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                >
                                  <option value="">Select Semester</option>
                                  <option value="1">Semester 1</option>
                                  <option value="2">Semester 2</option>
                                  <option value="3">Semester 3</option>
                                  <option value="4">Semester 4</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Cleared Year
                                </label>
                                <input
                                  type="number"
                                  value={kt.clearedYear}
                                  onChange={(e) => handleKtDetailChange('postgrad', index, 'clearedYear', e.target.value)}
                                  placeholder="YYYY (if cleared)"
                                  min="2000"
                                  max="2030"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marks Obtained
                                </label>
                                <input
                                  type="number"
                                  value={kt.marks}
                                  onChange={(e) => handleKtDetailChange('postgrad', index, 'marks', e.target.value)}
                                  placeholder="If cleared"
                                  min="0"
                                  max="100"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                />
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Marksheet Upload
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      handleKtDetailChange('postgrad', index, 'marksheetFile', file);
                                    }}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                                  />
                                  {kt.marksheetFile && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      {kt.marksheetFile.name}
                                    </span>
                                  )}
                                </div>
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

              {/* Additional Remarks (appears at bottom of all tabs) */}
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                  <i className="fas fa-comment-alt text-[#2A6BB5]"></i>
                  Additional Remarks
                </h3>
                <textarea
                  value={formData.educationRemark}
                  onChange={(e) => handleChange('educationRemark', e.target.value)}
                  rows={3}
                  placeholder="Any additional information about your educational qualifications"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Occupational Information */}
          {currentStep === 3 && (
            <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                    <i className="fas fa-briefcase text-[#2A6BB5]"></i>
                    Occupational Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Current Occupational Status
                      </label>
                      <select
                        value={formData.occupationalStatus}
                        onChange={(e) => handleChange('occupationalStatus', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      >
                        <option value="">Select Occupational Status</option>
                        <option value="Student">Student</option>
                        <option value="Employee">Employee</option>
                        <option value="Self Employee">Self Employee</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Employment Details - Show if "Employee" is selected */}
                {formData.occupationalStatus === 'Employee' && (
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-building text-[#2A6BB5]"></i>
                      Current Job Data Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Job Organisation <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.jobOrganisation}
                          onChange={(e) => handleChange('jobOrganisation', e.target.value)}
                          placeholder="Enter organization name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Designation <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.jobDesignation}
                          onChange={(e) => handleChange('jobDesignation', e.target.value)}
                          placeholder="e.g., Software Engineer"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Work Experience
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <input
                              type="number"
                              value={formData.workingFromYears}
                              onChange={(e) => handleChange('workingFromYears', e.target.value)}
                              placeholder="Years"
                              min="0"
                              max="50"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={formData.workingFromMonths}
                              onChange={(e) => handleChange('workingFromMonths', e.target.value)}
                              placeholder="Months"
                              min="0"
                              max="11"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.totalOccupationYears ? `${formData.totalOccupationYears} yrs` : ''}
                              readOnly
                              placeholder="Total (auto)"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                            />
                            {parseFloat(formData.totalOccupationYears) >= 10 && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <i className="fas fa-exclamation text-white text-xs"></i>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Enter years and months in current job — Total calculated automatically</p>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Job Description
                        </label>
                        <textarea
                          value={formData.jobDescription}
                          onChange={(e) => handleChange('jobDescription', e.target.value)}
                          placeholder="Briefly describe your job role and responsibilities"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none"
                        />
                      </div>
                    </div>

                  </div>
                )}

                {/* Self Employment Details - Show if "Self Employee" is selected */}
                {formData.occupationalStatus === 'Self Employee' && (
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                      <i className="fas fa-user-tie text-[#2A6BB5]"></i>
                      Self Employment Details
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Business Details <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={formData.selfEmploymentDetails}
                          onChange={(e) => handleChange('selfEmploymentDetails', e.target.value)}
                          placeholder="Describe your business, profession, or freelance work"
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

               
              </div>
          )}

          {/* STEP 4: Training */}
          {currentStep === 4 && (
            <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                    <i className="fas fa-chalkboard-teacher text-[#2A6BB5]"></i>
                    Training Programme Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Training Program <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.trainingProgram}
                        onChange={(e) => handleChange('trainingProgram', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      >
                        <option value="">Select Training Program</option>
                        <optgroup label="For Mechanical / Production Engineers">
                          <option>Piping Engineering</option>
                          <option>Mechanical Design of Process Equipment</option>
                          <option>Air Conditioning System Design (HVAC)</option>
                          <option>MEP (Mechanical Electrical and Plumbing)</option>
                          <option>Rotating Equipment</option>
                          <option>Offshore Engineering</option>
                        </optgroup>
                        <optgroup label="For Chemical / Petrochemical Engineers">
                          <option>Process Engineering</option>
                          <option>Piping Engineering</option>
                          <option>Offshore Engineering</option>
                        </optgroup>
                        <optgroup label="For Electrical Engineers">
                          <option>Electrical System Design</option>
                          <option>MEP (Mechanical Electrical and Plumbing)</option>
                        </optgroup>
                        <optgroup label="For Civil Engineers">
                          <option>Structural Engineering</option>
                        </optgroup>
                        <optgroup label="For Instrumentation / ENTC Engineers">
                          <option>Process Instrumentation and Control</option>
                        </optgroup>
                        <optgroup label="ITI / Mechanical Draftsman">
                          <option>Piping Design and Drafting</option>
                          <option>HVAC Design and Drafting</option>
                          <option>Engineering Design and Drafting</option>
                        </optgroup>
                        <optgroup label="HSC Students (Arts / Commerce / Science)">
                          <option>Engineering Design and Drafting</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Programme Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.trainingCategory}
                        onChange={(e) => handleChange('trainingCategory', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      >
                        <option value="">Select Category</option>
                        <option>Full Time</option>
                        <option>Part Time</option>
                        <option>Weekend Batch</option>
                        <option>Online</option>
                        <option>Hybrid</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Batch Code
                      </label>
                      <input
                        type="text"
                        value={formData.batchCode}
                        onChange={(e) => handleChange('batchCode', e.target.value)}
                        placeholder="Enter batch code"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Consent Form Banner — triggers when Student occupational status doesn't meet course eligibility */}
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
                          ? 'The candidate has reviewed and accepted all consent declarations.'
                          : 'Candidate\'s educational background does not match the selected training program eligibility. Consent form must be completed.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConsentModal(true)}
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

              </div>
          )}

          {/* STEP 5: Documents */}
          {currentStep === 5 && (
            <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                    <i className="fas fa-file-upload text-[#2A6BB5]"></i>
                    Upload Required Documents
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Please upload the following documents. Supported formats: PDF, JPG, JPEG, PNG (Max 5MB each)
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Passport Photo */}
                    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#2A6BB5] hover:bg-[#2A6BB5]/5 transition-all">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <i className="fas fa-camera text-xl text-[#2A6BB5]"></i>
                      </div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                        Passport Photo
                      </label>
                      <p className="text-xs text-gray-500 mb-3">Recent passport size photo</p>
                      <input
                        type="file"
                        id="photoFile"
                        accept="image/*"
                        onChange={(e) => handleChange('photoFile', e.target.files?.[0])}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('photoFile')?.click()}
                        className="px-4 py-2 bg-[#2A6BB5] text-white rounded-lg transition-all hover:bg-[#2E3093] text-xs font-semibold"
                      >
                        <i className="fas fa-upload mr-2"></i>
                        Choose File
                      </button>
                      {formData.photoFile && (
                        <div className="mt-3 p-2 bg-green-50 rounded flex items-center justify-center gap-2">
                          <i className="fas fa-check-circle text-green-600"></i>
                          <p className="text-xs text-green-700 font-medium truncate">{formData.photoFile.name}</p>
                        </div>
                      )}
                    </div>

                    {/* CV/Resume */}
                    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#2A6BB5] hover:bg-[#2A6BB5]/5 transition-all">
                      <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <i className="fas fa-file-alt text-xl text-purple-600"></i>
                      </div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                        CV/Resume
                      </label>
                      <p className="text-xs text-gray-500 mb-3">Upload your latest CV</p>
                      <input
                        type="file"
                        id="cvFile"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleChange('cvFile', e.target.files?.[0])}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('cvFile')?.click()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg transition-all hover:bg-purple-700 text-xs font-semibold"
                      >
                        <i className="fas fa-upload mr-2"></i>
                        Choose File
                      </button>
                      {formData.cvFile && (
                        <div className="mt-3 p-2 bg-green-50 rounded flex items-center justify-center gap-2">
                          <i className="fas fa-check-circle text-green-600"></i>
                          <p className="text-xs text-green-700 font-medium truncate">{formData.cvFile.name}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Degree Certificate */}
                    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#2A6BB5] hover:bg-[#2A6BB5]/5 transition-all">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <i className="fas fa-graduation-cap text-xl text-green-600"></i>
                      </div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                        Degree Certificate
                      </label>
                      <p className="text-xs text-gray-500 mb-3">Latest degree/marksheet</p>
                      <input
                        type="file"
                        id="degreeFile"
                        accept=".pdf,image/*"
                        onChange={(e) => handleChange('degreeFile', e.target.files?.[0])}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('degreeFile')?.click()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg transition-all hover:bg-green-700 text-xs font-semibold"
                      >
                        <i className="fas fa-upload mr-2"></i>
                        Choose File
                      </button>
                      {formData.degreeFile && (
                        <div className="mt-3 p-2 bg-green-50 rounded flex items-center justify-center gap-2">
                          <i className="fas fa-check-circle text-green-600"></i>
                          <p className="text-xs text-green-700 font-medium truncate">{formData.degreeFile.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ID Proof Section */}
                <div>
                  <h3 className="text-base font-bold text-gray-800 mb-3 pb-1.5 border-b border-gray-200 flex items-center gap-2">
                    <i className="fas fa-id-card text-[#2A6BB5]"></i>
                    Identity Proof
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        ID Proof Type
                      </label>
                      <select
                        value={formData.idProofType}
                        onChange={(e) => handleChange('idProofType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all"
                      >
                        <option>Aadhar Card</option>
                        <option>Passport</option>
                        <option>PAN Card</option>
                        <option>Voter ID</option>
                        <option>Driving License</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Upload ID Proof
                      </label>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => handleChange('idProofFile', e.target.files?.[0])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#2A6BB5] file:text-white hover:file:bg-[#2E3093] file:cursor-pointer"
                      />
                      {formData.idProofFile && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <i className="fas fa-check-circle"></i>
                          File uploaded successfully
                        </p>
                      )}
                    </div>

                     <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={formData.termsAgreed}
                      onChange={(e) => handleChange('termsAgreed', e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-[#2E3093] rounded"
                    />
                    <label htmlFor="terms" className="text-sm flex-1">
                      <span className="font-semibold text-gray-800">Terms and Conditions <span className="text-red-500">*</span></span>
                      <p className="text-gray-600 mt-1">
                        I hereby declare that all the information provided by me is true and correct to the best of my knowledge. 
                        I understand that any false information may result in the cancellation of my admission. 
                        I agree to abide by all the rules and regulations of the institute.
                      </p>
                      <a href="#" className="text-[#2A6BB5] hover:underline mt-2 inline-block font-semibold">
                        Read full terms & conditions <i className="fas fa-external-link-alt text-xs ml-1"></i>
                      </a>
                    </label>
                  </div>
                </div>
                  </div>
                </div>
              </div>
          )}
                </div>

                {/* Fixed Navigation Buttons */}
                <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-3 shadow-lg">
                  <div className="flex justify-between items-center gap-3">
                    {currentStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => router.push('/dashboard/inquiry')}
                        className="px-5 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all"
                      >
                        <i className="fas fa-times mr-2"></i>
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => nextStep(currentStep - 1)}
                        className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all"
                      >
                        <i className="fas fa-arrow-left mr-2"></i>
                        Back
                      </button>
                    )}
                    
                    {currentStep < 5 ? (
                      <button
                        type="button"
                        onClick={() => nextStep(currentStep + 1)}
                        className="px-6 py-2 bg-gradient-to-r from-[#FAE452] to-[#FDD835] text-[#2E3093] rounded-lg font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
                      >
                        Continue
                        <i className="fas fa-arrow-right ml-2"></i>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-check-circle mr-2"></i>
                            Submit Application
                          </>
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
              <button
                type="button"
                onClick={() => {
                  setShowAddUniversityModal(false);
                  setNewUniversityData({ name: '', country: '', city: '', fieldType: 'grad' });
                }}
                className="text-gray-400 hover:text-[#2E3093] transition-colors rounded-full hover:bg-gray-100 w-8 h-8 flex items-center justify-center"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  University Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUniversityData.name}
                  onChange={(e) => setNewUniversityData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter university name"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-2 focus:ring-[#2A6BB5]/20 transition-all"
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-xs text-blue-800 flex items-start gap-2">
                  <i className="fas fa-info-circle mt-0.5 text-[#2A6BB5]"></i>
                  <span>Can&apos;t find your university in the list? No problem! Just enter the name manually and it will be added to your application form.</span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-7">
              <button
                type="button"
                onClick={() => {
                  setShowAddUniversityModal(false);
                  setNewUniversityData({ name: '', country: '', city: '', fieldType: 'grad' });
                }}
                className="flex-1 px-5 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-all border border-gray-300"
              >
                <i className="fas fa-times mr-2"></i>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddUniversity}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <i className="fas fa-check-circle mr-2"></i>
                Use This University
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Consent Form Modal ── */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-6 py-5 rounded-t-2xl flex-shrink-0 text-center">
              <h2 className="text-white font-bold text-lg tracking-widest uppercase">Consent Form</h2>
              <p className="text-white/80 text-xs mt-1">For Candidates with Different Educational Background</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Pre-filled read-only + editable fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name of the Candidate</label>
                  <input readOnly value={[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(' ')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Course Name</label>
                  <input readOnly value={formData.trainingProgram || '—'}
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

              {/* Declaration */}
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

              {/* Candidate Remark */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Candidate Remark</label>
                <textarea value={consentData.candidateRemark}
                  onChange={(e) => setConsentData(p => ({ ...p, candidateRemark: e.target.value }))}
                  placeholder="Any remarks from the candidate (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#2A6BB5] focus:ring-1 focus:ring-[#2A6BB5]/10 transition-all resize-none" />
              </div>

              {/* Dept signatures */}
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

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4 flex gap-3 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={() => setShowConsentModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all">
                <i className="fas fa-times mr-2"></i>Close
              </button>
              <button type="button" disabled={!allConsentChecked}
                onClick={() => { setConsentAcknowledged(true); setShowConsentModal(false); }}
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
               