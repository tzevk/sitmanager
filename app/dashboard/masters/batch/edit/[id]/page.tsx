'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Assignment {
  id: number;
  assignmentname: string;
  subjects: string | null;
  marks: string | null;
  assignmentdate: string | null;
  created_date: string | null;
}

interface UnitTest {
  id: number;
  subject: string | null;
  utdate: string | null;
  duration: string | null;
  marks: string | null;
  created_date: string | null;
}

interface Discipline {
  id: number;
  subject: string | null;
  date: string | null;
  marks: string | null;
  created_date: string | null;
}

interface Feedback {
  id: number;
  subject: string | null;
  date: string | null;
  created_date: string | null;
}

interface Convocation {
  id: number;
  faculty_name: string | null;
  guest_name: string | null;
  guest_mobile: string | null;
  email: string | null;
  guest_designation: string | null;
  created_date: string | null;
}

interface Faculty {
  Faculty_Id: number;
  Faculty_Name: string;
}

interface StandardLecture {
  id: number;
  lecture_no: number | null;
  subject: string | null;
  subject_topic: string | null;
  date: string | null;
  starttime: string | null;
  endtime: string | null;
  assignment: string | null;
  assignment_date: string | null;
  faculty_name: string | null;
  class_room: string | null;
  documents: string | null;
  unit_test: string | null;
  publish: string | null;
}

interface Lecture {
  id: number;
  lecture_no: number | null;
  subject: string | null;
  subject_topic: string | null;
  date: string | null;
  starttime: string | null;
  endtime: string | null;
  assignment: string | null;
  assignment_date: string | null;
  faculty_id: string | null;
  faculty_name_display: string | null;
  class_room: string | null;
  documents: string | null;
  unit_test: string | null;
  publish: string | null;
  duration: string | null;
  marks: string | null;
  lectureday: string | null;
  module: string | null;
  planned: string | null;
  department: string | null;
  practicetest: string | null;
  lecturecontent: string | null;
  status: string | null;
}

interface FinalExam {
  id: number;
  subject: string | null;
  exam_date: string | null;
  max_marks: number | null;
  duration: string | null;
}

interface BatchData {
  Batch_Id: number;
  Course_Id: number | null;
  Course_Name: string | null;
  Batch_code: string | null;
  Category: string | null;
  Timings: string | null;
  SDate: string | null;
  EDate: string | null;
  Admission_Date: string | null;
  ActualDate: string | null;
  Duration: string | null;
  Training_Coordinator: string | null;
  Min_Qualification: string | null;
  Documents_Required: string | null;
  Passing_Criteria: string | null;
  Fees_Full_Payment: number | null;
  Fees_Installment_Payment: number | null;
  Actual_Fees_Payment: number | null;
  No_of_Lectures: string | null;
  Max_Students: string | null;
  Course_description: string | null;
  Corporate: string | null;
  ConvocationDate: string | null;
  Convocationday: string | null;
  AttendWtg: number | null;
  AssignWtg: number | null;
  ExamWtg: number | null;
  UnitTestWtg: number | null;
  FullAttendWtg: number | null;
  INR_Basic: number | null;
  INR_ServiceTax: number | null;
  INR_Total: number | null;
  Dollar_Basic: number | null;
  Dollar_ServiceTax: number | null;
  Dollar_Total: number | null;
  TaxRate: number | null;
  Site_Visit_Dt: string | null;
  Site_company: string | null;
  Site_Place: string | null;
  Contact_Person: string | null;
  Designation: string | null;
  Telephone: string | null;
  Comments: string | null;
  LateMarkLimit: number | null;
  CourseName: string | null;
  NoStudent: number | null;
  Attachment: string | null;
}

const TABS = [
  { id: 'batch-details', label: 'Batch Details' },
  { id: 'standard-lecture-plan', label: 'Standard Lecture Plan' },
  { id: 'lecture-plan', label: 'Lecture Plan' },
  { id: 'unit-test-details', label: 'Unit Test Details' },
  { id: 'final-exam-details', label: 'Final Exam Details' },
  { id: 'assignment-details', label: 'Assignment Details' },
  { id: 'discipline-moc', label: 'DISCIPLINE / MOC Details' },
  { id: 'fees-structure', label: 'Fees Structure' },
  { id: 'feedback-details', label: 'FeedBack Details' },
  { id: 'convocation-details', label: 'Convocation Details' },
  { id: 'site-visit', label: 'Site Visit' },
];

/* Shared styles - compact */
const labelCls = 'block text-[10px] font-semibold text-gray-600 mb-0.5';
const inputCls = 'max-w-[280px] w-full bg-white border-[1.5px] border-gray-300 rounded px-2 py-2 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400';
const selectCls = 'max-w-[280px] w-full bg-white border-[1.5px] border-gray-300 rounded px-2 py-2 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093]';

/* Format date for input */
const formatDateForInput = (d: string | null) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export default function EditBatchPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('batch');

  const [activeTab, setActiveTab] = useState('batch-details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [batchData, setBatchData] = useState<BatchData | null>(null);

  /* Dropdown options */
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  /* Assignment Details state */
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    assignmentname: '',
    subjects: '',
    marks: '',
    assignmentdate: '',
  });

  /* Unit Test Details state */
  const [unittests, setUnittests] = useState<UnitTest[]>([]);
  const [unittestSearch, setUnittestSearch] = useState('');
  const [loadingUnittests, setLoadingUnittests] = useState(false);
  const [showAddUnittestModal, setShowAddUnittestModal] = useState(false);
  const [savingUnittest, setSavingUnittest] = useState(false);
  const [newUnittest, setNewUnittest] = useState({
    subject: '',
    utdate: '',
    duration: '',
    marks: '',
  });

  /* Discipline/MOC Details state */
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [disciplineSearch, setDisciplineSearch] = useState('');
  const [loadingDisciplines, setLoadingDisciplines] = useState(false);
  const [showAddDisciplineModal, setShowAddDisciplineModal] = useState(false);
  const [savingDiscipline, setSavingDiscipline] = useState(false);
  const [newDiscipline, setNewDiscipline] = useState({
    subject: '',
    date: '',
    marks: '',
  });

  /* Feedback Details state */
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [showAddFeedbackModal, setShowAddFeedbackModal] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    subject: '',
    date: '',
  });

  /* Convocation Details state */
  const [convocations, setConvocations] = useState<Convocation[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [convocationSearch, setConvocationSearch] = useState('');
  const [loadingConvocation, setLoadingConvocation] = useState(false);
  const [showAddConvocationModal, setShowAddConvocationModal] = useState(false);
  const [savingConvocation, setSavingConvocation] = useState(false);
  const [convocationDate, setConvocationDate] = useState('');
  const [convocationDay, setConvocationDay] = useState('');
  const [newConvocation, setNewConvocation] = useState({
    faculty_name: '',
    guest_name: '',
    guest_mobile: '',
    email: '',
    guest_designation: '',
  });

  /* Site Visit / Consultancy state */
  const [consultancyCompanies, setConsultancyCompanies] = useState<{
    Const_Id: number;
    Comp_Name: string;
    Contact_Person: string | null;
    Designation: string | null;
    Address: string | null;
    City: string | null;
    State: string | null;
    Pin: string | null;
    Tel: string | null;
  }[]>([]);

  /* Standard Lecture Plan state */
  const [standardLectures, setStandardLectures] = useState<StandardLecture[]>([]);
  const [sLectureSearch, setSLectureSearch] = useState('');
  const [loadingSLectures, setLoadingSLectures] = useState(false);
  const [showEditSLectureModal, setShowEditSLectureModal] = useState(false);
  const [editingSLectureId, setEditingSLectureId] = useState<number | null>(null);
  const [savingSLecture, setSavingSLecture] = useState(false);
  const [editSLecture, setEditSLecture] = useState({
    lecture_no: '',
    subject: '',
    subject_topic: '',
    date: '',
    starttime: '',
    endtime: '',
    assignment: '',
    assignment_date: '',
    faculty_name: '',
    class_room: '',
    documents: '',
    unit_test: '',
    publish: 'No',
  });

  const handleEditSLecture = (l: StandardLecture) => {
    setEditingSLectureId(l.id);
    setEditSLecture({
      lecture_no: l.lecture_no?.toString() || '',
      subject: l.subject || '',
      subject_topic: l.subject_topic || '',
      date: l.date || '',
      starttime: l.starttime || '',
      endtime: l.endtime || '',
      assignment: l.assignment || '',
      assignment_date: l.assignment_date || '',
      faculty_name: l.faculty_name || '',
      class_room: l.class_room || '',
      documents: l.documents || '',
      unit_test: l.unit_test || '',
      publish: l.publish || 'No',
    });
    setShowEditSLectureModal(true);
  };

  /* Final Exam Details state */
  const [finalExams, setFinalExams] = useState<FinalExam[]>([]);
  const [finalExamSearch, setFinalExamSearch] = useState('');
  const [loadingFinalExams, setLoadingFinalExams] = useState(false);
  const [showAddFinalExamModal, setShowAddFinalExamModal] = useState(false);
  const [savingFinalExam, setSavingFinalExam] = useState(false);
  const [newFinalExam, setNewFinalExam] = useState({
    subject: '',
    exam_date: '',
    max_marks: '',
    duration: '',
  });

  /* Lecture Plan state */
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lectureSearch, setLectureSearch] = useState('');
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [showAddLectureModal, setShowAddLectureModal] = useState(false);
  const [showEditLectureModal, setShowEditLectureModal] = useState(false);
  const [editingLectureId, setEditingLectureId] = useState<number | null>(null);
  const [savingLecture, setSavingLecture] = useState(false);
  const [newLecture, setNewLecture] = useState({
    lecture_no: '',
    subject: '',
    subject_topic: '',
    date: '',
    starttime: '',
    endtime: '',
    assignment: '',
    assignment_date: '',
    faculty_id: '',
    class_room: '',
    documents: '',
    unit_test: '',
    publish: 'No',
  });
  const [editLecture, setEditLecture] = useState({
    lecture_no: '',
    subject: '',
    subject_topic: '',
    date: '',
    starttime: '',
    endtime: '',
    assignment: '',
    assignment_date: '',
    faculty_id: '',
    class_room: '',
    documents: '',
    unit_test: '',
    publish: 'No',
  });

  const handleEditLecture = (l: Lecture) => {
    setEditingLectureId(l.id);
    setEditLecture({
      lecture_no: l.lecture_no?.toString() || '',
      subject: l.subject || '',
      subject_topic: l.subject_topic || '',
      date: l.date || '',
      starttime: l.starttime || '',
      endtime: l.endtime || '',
      assignment: l.assignment || '',
      assignment_date: l.assignment_date || '',
      faculty_id: l.faculty_id || '',
      class_room: l.class_room || '',
      documents: l.documents || '',
      unit_test: l.unit_test || '',
      publish: l.publish || 'No',
    });
    setShowEditLectureModal(true);
  };

  /* Batch Details form state */
  const [formData, setFormData] = useState({
    Course_Id: '',
    Batch_code: '',
    Category: '',
    Min_Qualification: '',
    SDate: '',
    Admission_Date: '',
    Max_Students: '',
    Training_Coordinator: '',
    Documents_Required: '',
    CourseName: '',
    Course_description: '',
    Passing_Criteria: '',
    EDate: '',
    Duration: '',
    NoStudent: '',
    Timings: '',
    Comments: '',
    // Fees Structure fields
    INR_Basic: '',
    INR_ServiceTax: '',
    INR_Total: '',
    Dollar_Basic: '',
    Dollar_ServiceTax: '',
    Dollar_Total: '',
    Actual_Fees_Payment: '',
    Fees_Full_Payment: '',
    Fees_Installment_Payment: '',
    // Site Visit fields
    Site_company: '',
    Contact_Person: '',
    Designation: '',
    Telephone: '',
    Site_Visit_Dt: '',
    Site_Place: '',
  });

  /* Fetch courses */
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/masters/course?limit=1000');
        const json = await res.json();
        setCourses(json.rows || []);
      } catch { /* ignore */ }
    };
    fetchCourses();
  }, []);

  /* Fetch categories */
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/masters/batch-category?limit=100');
        const json = await res.json();
        const cats = (json.rows || []).map((r: { batch: string }) => r.batch).filter(Boolean);
        setCategories(cats);
      } catch { /* ignore */ }
    };
    fetchCategories();
  }, []);

  /* Fetch consultancy companies */
  useEffect(() => {
    const fetchConsultancyCompanies = async () => {
      try {
        const res = await fetch('/api/masters/consultancy');
        const json = await res.json();
        setConsultancyCompanies(json.rows || []);
      } catch { /* ignore */ }
    };
    fetchConsultancyCompanies();
  }, []);

  /* Fetch assignments for this batch */
  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/assignments`);
      const json = await res.json();
      setAssignments(json.assignments || []);
    } catch { /* ignore */ }
    setLoadingAssignments(false);
  };

  useEffect(() => {
    if (activeTab === 'assignment-details' && batchId) {
      const doFetch = async () => {
        setLoadingAssignments(true);
        try {
          const res = await fetch(`/api/masters/batch/${batchId}/assignments`);
          const json = await res.json();
          setAssignments(json.assignments || []);
        } catch { /* ignore */ }
        setLoadingAssignments(false);
      };
      doFetch();
    }
  }, [activeTab, batchId]);

  /* Fetch unit tests for this batch */
  const fetchUnittests = async () => {
    setLoadingUnittests(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/unittests`);
      const json = await res.json();
      setUnittests(json.unittests || []);
    } catch { /* ignore */ }
    setLoadingUnittests(false);
  };

  useEffect(() => {
    if (activeTab === 'unit-test-details' && batchId) {
      const doFetch = async () => {
        setLoadingUnittests(true);
        try {
          const res = await fetch(`/api/masters/batch/${batchId}/unittests`);
          const json = await res.json();
          setUnittests(json.unittests || []);
        } catch { /* ignore */ }
        setLoadingUnittests(false);
      };
      doFetch();
    }
  }, [activeTab, batchId]);

  /* Fetch disciplines for this batch */
  const fetchDisciplines = async () => {
    setLoadingDisciplines(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/disciplines`);
      const json = await res.json();
      setDisciplines(json.disciplines || []);
    } catch { /* ignore */ }
    setLoadingDisciplines(false);
  };

  useEffect(() => {
    if (activeTab === 'discipline-moc' && batchId) {
      const doFetch = async () => {
        setLoadingDisciplines(true);
        try {
          const res = await fetch(`/api/masters/batch/${batchId}/disciplines`);
          const json = await res.json();
          setDisciplines(json.disciplines || []);
        } catch { /* ignore */ }
        setLoadingDisciplines(false);
      };
      doFetch();
    }
  }, [activeTab, batchId]);

  /* Fetch feedbacks for this batch */
  const fetchFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/feedbacks`);
      const json = await res.json();
      setFeedbacks(json.feedbacks || []);
    } catch { /* ignore */ }
    setLoadingFeedbacks(false);
  };

  useEffect(() => {
    if (activeTab === 'feedback-details' && batchId) {
      const doFetch = async () => {
        setLoadingFeedbacks(true);
        try {
          const res = await fetch(`/api/masters/batch/${batchId}/feedbacks`);
          const json = await res.json();
          setFeedbacks(json.feedbacks || []);
        } catch { /* ignore */ }
        setLoadingFeedbacks(false);
      };
      doFetch();
    }
  }, [activeTab, batchId]);

  /* Fetch standard lectures for this batch */
  const fetchStandardLectures = async () => {
    setLoadingSLectures(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/slectures`);
      const json = await res.json();
      setStandardLectures(json.lectures || []);
    } catch { /* ignore */ }
    setLoadingSLectures(false);
  };

  useEffect(() => {
    if (activeTab === 'standard-lecture-plan' && batchId) {
      const doFetch = async () => {
        setLoadingSLectures(true);
        try {
          const res = await fetch(`/api/masters/batch/${batchId}/slectures`);
          const json = await res.json();
          setStandardLectures(json.lectures || []);
          setFacultyList(json.facultyList || []);
        } catch { /* ignore */ }
        setLoadingSLectures(false);
      };
      doFetch();
    }
  }, [activeTab, batchId]);

  /* Fetch lectures for this batch */
  const fetchLectures = async () => {
    setLoadingLectures(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/lectures`);
      const json = await res.json();
      setLectures(json.lectures || []);
      setFacultyList(json.facultyList || []);
    } catch { /* ignore */ }
    setLoadingLectures(false);
  };

  useEffect(() => {
    if (activeTab === 'lecture-plan' && batchId) {
      fetchLectures();
    }
  }, [activeTab, batchId]);

  /* Fetch final exams for this batch */
  const fetchFinalExams = async () => {
    setLoadingFinalExams(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/finalexams`);
      const json = await res.json();
      setFinalExams(json.finalexams || []);
    } catch { /* ignore */ }
    setLoadingFinalExams(false);
  };

  useEffect(() => {
    if (activeTab === 'final-exam-details' && batchId) {
      fetchFinalExams();
    }
  }, [activeTab, batchId]);

  /* Fetch convocation for this batch */
  const fetchConvocation = async () => {
    setLoadingConvocation(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/convocation`);
      const json = await res.json();
      setConvocations(json.convocations || []);
      setFacultyList(json.facultyList || []);
      setConvocationDate(formatDateForInput(json.convocationDate));
      setConvocationDay(json.convocationDay || '');
    } catch { /* ignore */ }
    setLoadingConvocation(false);
  };

  useEffect(() => {
    if (activeTab === 'convocation-details' && batchId) {
      const doFetch = async () => {
        setLoadingConvocation(true);
        try {
          const res = await fetch(`/api/masters/batch/${batchId}/convocation`);
          const json = await res.json();
          setConvocations(json.convocations || []);
          setFacultyList(json.facultyList || []);
          setConvocationDate(formatDateForInput(json.convocationDate));
          setConvocationDay(json.convocationDay || '');
        } catch { /* ignore */ }
        setLoadingConvocation(false);
      };
      doFetch();
    }
  }, [activeTab, batchId]);

  /* Fetch batch data */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/masters/batch/${batchId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setBatchData(json.data);
        
        // Populate form
        const d = json.data;
        setFormData({
          Course_Id: d.Course_Id?.toString() || '',
          Batch_code: d.Batch_code || '',
          Category: d.Category || '',
          Min_Qualification: d.Min_Qualification || '',
          SDate: formatDateForInput(d.SDate),
          Admission_Date: formatDateForInput(d.Admission_Date),
          Max_Students: d.Max_Students || '',
          Training_Coordinator: d.Training_Coordinator || '',
          Documents_Required: d.Documents_Required || '',
          CourseName: d.CourseName || '',
          Course_description: d.Course_description || '',
          Passing_Criteria: d.Passing_Criteria || '',
          EDate: formatDateForInput(d.EDate),
          Duration: d.Duration || '',
          NoStudent: d.NoStudent?.toString() || '',
          Timings: d.Timings || '',
          Comments: d.Comments || '',
          // Fees Structure fields
          INR_Basic: d.INR_Basic?.toString() || '',
          INR_ServiceTax: d.INR_ServiceTax?.toString() || '',
          INR_Total: d.INR_Total?.toString() || '',
          Dollar_Basic: d.Dollar_Basic?.toString() || '',
          Dollar_ServiceTax: d.Dollar_ServiceTax?.toString() || '',
          Dollar_Total: d.Dollar_Total?.toString() || '',
          Actual_Fees_Payment: d.Actual_Fees_Payment?.toString() || '',
          Fees_Full_Payment: d.Fees_Full_Payment?.toString() || '',
          Fees_Installment_Payment: d.Fees_Installment_Payment?.toString() || '',
          // Site Visit fields
          Site_company: d.Site_company || '',
          Contact_Person: d.Contact_Person || '',
          Designation: d.Designation || '',
          Telephone: d.Telephone || '',
          Site_Visit_Dt: formatDateForInput(d.Site_Visit_Dt),
          Site_Place: d.Site_Place || '',
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (batchId) {
      fetchData();
    }
  }, [batchId]);

  /* Form change handler */
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /* Save handler */
  const handleSave = async () => {
    // Validation
    if (!formData.Course_Id) {
      setError('Course Name is required');
      return;
    }
    if (!formData.Min_Qualification.trim()) {
      setError('Eligibility is required');
      return;
    }
    if (!formData.Max_Students.trim()) {
      setError('Target Student is required');
      return;
    }
    if (!formData.Documents_Required.trim()) {
      setError('Documents required is required');
      return;
    }
    if (!formData.Passing_Criteria.trim()) {
      setError('Passing Criteria is required');
      return;
    }
    if (!formData.Course_description.trim()) {
      setError('Brief Description of Course is required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/masters/batch/${batchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Course_Id: formData.Course_Id ? Number(formData.Course_Id) : null,
          Batch_code: formData.Batch_code,
          Category: formData.Category,
          Min_Qualification: formData.Min_Qualification,
          SDate: formData.SDate || null,
          Admission_Date: formData.Admission_Date || null,
          Max_Students: formData.Max_Students,
          Training_Coordinator: formData.Training_Coordinator,
          Documents_Required: formData.Documents_Required,
          CourseName: formData.CourseName,
          Course_description: formData.Course_description,
          Passing_Criteria: formData.Passing_Criteria,
          EDate: formData.EDate || null,
          Duration: formData.Duration,
          NoStudent: formData.NoStudent ? Number(formData.NoStudent) : null,
          Timings: formData.Timings,
          Comments: formData.Comments,
          // Fees Structure fields
          INR_Basic: formData.INR_Basic ? Number(formData.INR_Basic) : null,
          INR_ServiceTax: formData.INR_ServiceTax ? Number(formData.INR_ServiceTax) : null,
          INR_Total: formData.INR_Total ? Number(formData.INR_Total) : null,
          Dollar_Basic: formData.Dollar_Basic ? Number(formData.Dollar_Basic) : null,
          Dollar_ServiceTax: formData.Dollar_ServiceTax ? Number(formData.Dollar_ServiceTax) : null,
          Dollar_Total: formData.Dollar_Total ? Number(formData.Dollar_Total) : null,
          Actual_Fees_Payment: formData.Actual_Fees_Payment ? Number(formData.Actual_Fees_Payment) : null,
          Fees_Full_Payment: formData.Fees_Full_Payment ? Number(formData.Fees_Full_Payment) : null,
          Fees_Installment_Payment: formData.Fees_Installment_Payment ? Number(formData.Fees_Installment_Payment) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');

      // Refresh data
      const refreshRes = await fetch(`/api/masters/batch/${batchId}`);
      const refreshJson = await refreshRes.json();
      setBatchData(refreshJson.data);

      alert('Saved successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /* Tab Content: Batch Details */
  const BatchDetailsTab = () => (
    <div className="grid grid-cols-4 gap-2">
      {/* Column 1-3: Form fields in rows */}
      <div className="col-span-3 space-y-2">
        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Course Name <span className="text-red-500">*</span></label>
            <select
              value={formData.Course_Id}
              onChange={(e) => handleChange('Course_Id', e.target.value)}
              className={selectCls}
            >
              <option value="">Select Course</option>
              {courses.map(c => (
                <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Batch Code</label>
            <input
              type="text"
              value={formData.Batch_code}
              onChange={(e) => handleChange('Batch_code', e.target.value)}
              className={inputCls}
              placeholder="Batch Code"
            />
          </div>
          <div>
            <label className={labelCls}>Batch Category</label>
            <select
              value={formData.Category}
              onChange={(e) => handleChange('Category', e.target.value)}
              className={selectCls}
            >
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Eligibility <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.Min_Qualification}
              onChange={(e) => handleChange('Min_Qualification', e.target.value)}
              className={inputCls}
              placeholder="Eligibility"
            />
          </div>
          <div>
            <label className={labelCls}>Duration From</label>
            <input
              type="date"
              value={formData.SDate}
              onChange={(e) => handleChange('SDate', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Last Date of Admission</label>
            <input
              type="date"
              value={formData.Admission_Date}
              onChange={(e) => handleChange('Admission_Date', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Target Student <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.Max_Students}
              onChange={(e) => handleChange('Max_Students', e.target.value)}
              className={inputCls}
              placeholder="Target Student"
            />
          </div>
          <div>
            <label className={labelCls}>Training Coordinator</label>
            <input
              type="text"
              value={formData.Training_Coordinator}
              onChange={(e) => handleChange('Training_Coordinator', e.target.value)}
              className={inputCls}
              placeholder="Training Coordinator"
            />
          </div>
          <div>
            <label className={labelCls}>Documents required <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.Documents_Required}
              onChange={(e) => handleChange('Documents_Required', e.target.value)}
              className={inputCls}
              placeholder="Documents required"
            />
          </div>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Course Name (if changed)</label>
            <input
              type="text"
              value={formData.CourseName}
              onChange={(e) => handleChange('CourseName', e.target.value)}
              className={inputCls}
              placeholder="Course Name"
            />
          </div>
          <div>
            <label className={labelCls}>Duration</label>
            <input
              type="text"
              value={formData.Duration}
              onChange={(e) => handleChange('Duration', e.target.value)}
              className={inputCls}
              placeholder="Duration"
            />
          </div>
          <div>
            <label className={labelCls}>Passing Criteria <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.Passing_Criteria}
              onChange={(e) => handleChange('Passing_Criteria', e.target.value)}
              className={inputCls}
              placeholder="0.6"
            />
          </div>
        </div>

        {/* Row 5 */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>To (End Date)</label>
            <input
              type="date"
              value={formData.EDate}
              onChange={(e) => handleChange('EDate', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Actual Students</label>
            <input
              type="number"
              value={formData.NoStudent}
              onChange={(e) => handleChange('NoStudent', e.target.value)}
              className={inputCls}
              placeholder="Actual Students"
            />
          </div>
          <div>
            <label className={labelCls}>Timings</label>
            <input
              type="text"
              value={formData.Timings}
              onChange={(e) => handleChange('Timings', e.target.value)}
              className={inputCls}
              placeholder="Timings"
            />
          </div>
        </div>
      </div>

      {/* Column 4: Comments & Brief stacked vertically */}
      <div className="col-span-1 space-y-2">
        <div>
          <label className={labelCls}>Comments</label>
          <textarea
            value={formData.Comments}
            onChange={(e) => handleChange('Comments', e.target.value)}
            className={inputCls + ' resize-none h-[100px] text-xs'}
            placeholder="Comments"
          />
        </div>
        <div>
          <label className={labelCls}>Brief <span className="text-red-500">*</span></label>
          <textarea
            value={formData.Course_description}
            onChange={(e) => handleChange('Course_description', e.target.value)}
            className={inputCls + ' resize-none h-[100px] text-xs'}
            placeholder="Brief Description"
          />
        </div>
      </div>
    </div>
  );

  /* Tab Content: Fees Structure */
  const FeesStructureTab = () => (
    <div className="grid grid-cols-4 gap-2">
      {/* INR Section */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Basic (INR)</label>
        <input
          type="number"
          value={formData.INR_Basic}
          onChange={(e) => handleChange('INR_Basic', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Service Tax (INR)</label>
        <input
          type="number"
          value={formData.INR_ServiceTax}
          onChange={(e) => handleChange('INR_ServiceTax', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Total (INR)</label>
        <input
          type="number"
          value={formData.INR_Total}
          onChange={(e) => handleChange('INR_Total', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Basic ($)</label>
        <input
          type="number"
          value={formData.Dollar_Basic}
          onChange={(e) => handleChange('Dollar_Basic', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Service Tax ($)</label>
        <input
          type="number"
          value={formData.Dollar_ServiceTax}
          onChange={(e) => handleChange('Dollar_ServiceTax', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Total ($)</label>
        <input
          type="number"
          value={formData.Dollar_Total}
          onChange={(e) => handleChange('Dollar_Total', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Actual Fees</label>
        <input
          type="number"
          value={formData.Actual_Fees_Payment}
          onChange={(e) => handleChange('Actual_Fees_Payment', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Full Payment *</label>
        <input
          type="number"
          value={formData.Fees_Full_Payment}
          onChange={(e) => handleChange('Fees_Full_Payment', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Installment *</label>
        <input
          type="number"
          value={formData.Fees_Installment_Payment}
          onChange={(e) => handleChange('Fees_Installment_Payment', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
          placeholder="Amount"
        />
      </div>
    </div>
  );

  /* Tab Content: Assignment Details */
  const filteredAssignments = assignments.filter(a =>
    a.assignmentname?.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
    a.subjects?.toLowerCase().includes(assignmentSearch.toLowerCase())
  );

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/assignments?assignmentId=${assignmentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAssignments();
      }
    } catch { /* ignore */ }
  };

  const handleExportAssignments = () => {
    const headers = ['Id', 'Assignment Name', 'Subject', 'Marks', 'Date'];
    const rows = filteredAssignments.map(a => [
      a.id,
      a.assignmentname || '',
      a.subjects || '',
      a.marks || '',
      a.assignmentdate || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assignments-batch-${batchId}.csv`;
    link.click();
  };

  const handleSaveAssignment = async () => {
    if (!newAssignment.assignmentname.trim()) return;
    setSavingAssignment(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAssignment),
      });
      if (res.ok) {
        setShowAddAssignmentModal(false);
        setNewAssignment({ assignmentname: '', subjects: '', marks: '', assignmentdate: '' });
        fetchAssignments();
      }
    } catch { /* ignore */ }
    setSavingAssignment(false);
  };

  const AssignmentDetailsTab = () => (
    <div className="space-y-2">
      {/* Add Assignment Modal */}
      {showAddAssignmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Add Assignment</h3>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Assignment Name</label>
                <input
                  type="text"
                  value={newAssignment.assignmentname}
                  onChange={(e) => setNewAssignment({ ...newAssignment, assignmentname: e.target.value })}
                  className={inputCls}
                  placeholder="Name"
                />
              </div>
              <div>
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={newAssignment.subjects}
                  onChange={(e) => setNewAssignment({ ...newAssignment, subjects: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>Marks</label>
                <input
                  type="number"
                  value={newAssignment.marks}
                  onChange={(e) => setNewAssignment({ ...newAssignment, marks: e.target.value })}
                  className={inputCls}
                  placeholder="Marks"
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={newAssignment.assignmentdate}
                  onChange={(e) => setNewAssignment({ ...newAssignment, assignmentdate: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowAddAssignmentModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignment}
                disabled={!newAssignment.assignmentname.trim() || savingAssignment}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingAssignment ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Add, Export, Search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAddAssignmentModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-[#2E3093] text-white text-xs font-medium rounded h-7"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <button
          onClick={handleExportAssignments}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded h-7 hover:bg-gray-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={assignmentSearch}
            onChange={(e) => setAssignmentSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="dashboard-table w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-10">Id</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Name</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Subject</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Marks</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-20">Date</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Act</th>
            </tr>
          </thead>
          <tbody>
            {loadingAssignments ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-gray-400">
                  No records found. Click &quot;Add&quot; to create.
                </td>
              </tr>
            ) : (
              filteredAssignments.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-700">{a.id}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium truncate">{a.assignmentname || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate">{a.subjects || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{a.marks || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{a.assignmentdate || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(a.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* Tab Content: Unit Test Details */
  const filteredUnittests = unittests.filter(u =>
    u.subject?.toLowerCase().includes(unittestSearch.toLowerCase())
  );

  const handleDeleteUnittest = async (unittestId: number) => {
    if (!confirm('Are you sure you want to delete this unit test?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/unittests?unittestId=${unittestId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchUnittests();
      }
    } catch { /* ignore */ }
  };

  const handleExportUnittests = () => {
    const headers = ['Id', 'Subject', 'TestDate', 'Duration', 'Marks'];
    const rows = filteredUnittests.map(u => [
      u.id,
      u.subject || '',
      u.utdate || '',
      u.duration || '',
      u.marks || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `unittests-batch-${batchId}.csv`;
    link.click();
  };

  const handleSaveUnittest = async () => {
    if (!newUnittest.subject.trim()) return;
    setSavingUnittest(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/unittests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUnittest),
      });
      if (res.ok) {
        setShowAddUnittestModal(false);
        setNewUnittest({ subject: '', utdate: '', duration: '', marks: '' });
        fetchUnittests();
      }
    } catch { /* ignore */ }
    setSavingUnittest(false);
  };

  const UnitTestDetailsTab = () => (
    <div className="space-y-2">
      {/* Add Unit Test Modal */}
      {showAddUnittestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Add Unit Test</h3>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={newUnittest.subject}
                  onChange={(e) => setNewUnittest({ ...newUnittest, subject: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>TestDate</label>
                <input
                  type="date"
                  value={newUnittest.utdate}
                  onChange={(e) => setNewUnittest({ ...newUnittest, utdate: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Duration</label>
                <input
                  type="text"
                  value={newUnittest.duration}
                  onChange={(e) => setNewUnittest({ ...newUnittest, duration: e.target.value })}
                  className={inputCls}
                  placeholder="Duration"
                />
              </div>
              <div>
                <label className={labelCls}>Marks</label>
                <input
                  type="number"
                  value={newUnittest.marks}
                  onChange={(e) => setNewUnittest({ ...newUnittest, marks: e.target.value })}
                  className={inputCls}
                  placeholder="Marks"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowAddUnittestModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUnittest}
                disabled={!newUnittest.subject.trim() || savingUnittest}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingUnittest ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Add, Export, Search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAddUnittestModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-[#2E3093] text-white text-xs font-medium rounded h-7"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <button
          onClick={handleExportUnittests}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded h-7 hover:bg-gray-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={unittestSearch}
            onChange={(e) => setUnittestSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="dashboard-table w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-10">Id</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Subject</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-20">TestDate</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-16">Duration</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Marks</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Act</th>
            </tr>
          </thead>
          <tbody>
            {loadingUnittests ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredUnittests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-gray-400">
                  No records found. Click &quot;Add&quot; to create.
                </td>
              </tr>
            ) : (
              filteredUnittests.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-700">{u.id}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium truncate">{u.subject || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{u.utdate || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{u.duration || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{u.marks || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteUnittest(u.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* Tab Content: Discipline/MOC Details */
  const filteredDisciplines = disciplines.filter(d =>
    d.subject?.toLowerCase().includes(disciplineSearch.toLowerCase())
  );

  const handleDeleteDiscipline = async (disciplineId: number) => {
    if (!confirm('Are you sure you want to delete this discipline/MOC?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/disciplines?disciplineId=${disciplineId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchDisciplines();
      }
    } catch { /* ignore */ }
  };

  const handleExportDisciplines = () => {
    const headers = ['Id', 'Subject', 'Date', 'Marks'];
    const rows = filteredDisciplines.map(d => [
      d.id,
      d.subject || '',
      d.date || '',
      d.marks || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `disciplines-batch-${batchId}.csv`;
    link.click();
  };

  const handleSaveDiscipline = async () => {
    if (!newDiscipline.subject.trim()) return;
    setSavingDiscipline(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/disciplines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDiscipline),
      });
      if (res.ok) {
        setShowAddDisciplineModal(false);
        setNewDiscipline({ subject: '', date: '', marks: '' });
        fetchDisciplines();
      }
    } catch { /* ignore */ }
    setSavingDiscipline(false);
  };

  const DisciplineMocTab = () => (
    <div className="space-y-2">
      {/* Add Discipline Modal */}
      {showAddDisciplineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Add Discipline/MOC</h3>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={newDiscipline.subject}
                  onChange={(e) => setNewDiscipline({ ...newDiscipline, subject: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={newDiscipline.date}
                  onChange={(e) => setNewDiscipline({ ...newDiscipline, date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Marks</label>
                <input
                  type="number"
                  step="0.01"
                  value={newDiscipline.marks}
                  onChange={(e) => setNewDiscipline({ ...newDiscipline, marks: e.target.value })}
                  className={inputCls}
                  placeholder="Marks"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowAddDisciplineModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDiscipline}
                disabled={!newDiscipline.subject.trim() || savingDiscipline}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingDiscipline ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Add, Export, Search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAddDisciplineModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-[#2E3093] text-white text-xs font-medium rounded h-7"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <button
          onClick={handleExportDisciplines}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded h-7 hover:bg-gray-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={disciplineSearch}
            onChange={(e) => setDisciplineSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="dashboard-table w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-10">Id</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Subject</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-20">Date</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Marks</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Act</th>
            </tr>
          </thead>
          <tbody>
            {loadingDisciplines ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredDisciplines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-gray-400">
                  No records found. Click &quot;Add&quot; to create.
                </td>
              </tr>
            ) : (
              filteredDisciplines.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-700">{d.id}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium truncate">{d.subject || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{d.date || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{d.marks || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteDiscipline(d.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* Tab Content: Feedback Details */
  const filteredFeedbacks = feedbacks.filter(f =>
    f.subject?.toLowerCase().includes(feedbackSearch.toLowerCase())
  );

  const handleDeleteFeedback = async (feedbackId: number) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/feedbacks?feedbackId=${feedbackId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchFeedbacks();
      }
    } catch { /* ignore */ }
  };

  const handleExportFeedbacks = () => {
    const headers = ['Id', 'Subject', 'Date'];
    const rows = filteredFeedbacks.map(f => [
      f.id,
      f.subject || '',
      f.date || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedbacks-batch-${batchId}.csv`;
    link.click();
  };

  const handleSaveFeedback = async () => {
    if (!newFeedback.subject.trim()) return;
    setSavingFeedback(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeedback),
      });
      if (res.ok) {
        setShowAddFeedbackModal(false);
        setNewFeedback({ subject: '', date: '' });
        fetchFeedbacks();
      }
    } catch { /* ignore */ }
    setSavingFeedback(false);
  };

  const FeedbackDetailsTab = () => (
    <div className="space-y-2">
      {/* Add Feedback Modal */}
      {showAddFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Add Feedback</h3>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={newFeedback.subject}
                  onChange={(e) => setNewFeedback({ ...newFeedback, subject: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={newFeedback.date}
                  onChange={(e) => setNewFeedback({ ...newFeedback, date: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowAddFeedbackModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFeedback}
                disabled={!newFeedback.subject.trim() || savingFeedback}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingFeedback ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Add, Export, Search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAddFeedbackModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-[#2E3093] text-white text-xs font-medium rounded h-7"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <button
          onClick={handleExportFeedbacks}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded h-7 hover:bg-gray-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={feedbackSearch}
            onChange={(e) => setFeedbackSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="dashboard-table w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-10">Id</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Subject</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-20">Date</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Act</th>
            </tr>
          </thead>
          <tbody>
            {loadingFeedbacks ? (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredFeedbacks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-center text-gray-400">
                  No records found. Click &quot;Add&quot; to create.
                </td>
              </tr>
            ) : (
              filteredFeedbacks.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-700">{f.id}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium truncate">{f.subject || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{f.date || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteFeedback(f.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* Standard Lecture Plan Tab */
  const filteredSLectures = standardLectures.filter(l =>
    l.subject?.toLowerCase().includes(sLectureSearch.toLowerCase()) ||
    l.subject_topic?.toLowerCase().includes(sLectureSearch.toLowerCase())
  );

  const handleDeleteSLecture = async (lectureId: number) => {
    if (!confirm('Are you sure you want to delete this lecture?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/slectures?lectureId=${lectureId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchStandardLectures();
      }
    } catch { /* ignore */ }
  };

  const handleExportSLectures = () => {
    const headers = ['Id', 'LectureNo', 'Subject', 'SubjectTopics', 'Date', 'StartTime', 'EndTime', 'Assignment', 'AssignmentDate', 'FacultyName', 'ClassRoom', 'Documents', 'UnitTest', 'Publish'];
    const rows = filteredSLectures.map(l => [
      l.id,
      l.lecture_no || '',
      l.subject || '',
      l.subject_topic || '',
      l.date || '',
      l.starttime || '',
      l.endtime || '',
      l.assignment || '',
      l.assignment_date || '',
      l.faculty_name || '',
      l.class_room || '',
      l.documents || '',
      l.unit_test || '',
      l.publish || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `standard-lectures-batch-${batchId}.csv`;
    link.click();
  };

  const handleSaveSLecture = async () => {
    if (!editSLecture.subject.trim() || !editingSLectureId) return;
    setSavingSLecture(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/slectures`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingSLectureId, ...editSLecture }),
      });
      if (res.ok) {
        setShowEditSLectureModal(false);
        setEditingSLectureId(null);
        setEditSLecture({
          lecture_no: '',
          subject: '',
          subject_topic: '',
          date: '',
          starttime: '',
          endtime: '',
          assignment: '',
          assignment_date: '',
          faculty_name: '',
          class_room: '',
          documents: '',
          unit_test: '',
          publish: 'No',
        });
        fetchStandardLectures();
      }
    } catch { /* ignore */ }
    setSavingSLecture(false);
  };

  const StandardLecturePlanTab = () => (
    <div className="space-y-2">
      {/* Edit Lecture Modal */}
      {showEditSLectureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Edit Standard Lecture</h3>
            </div>
            <div className="p-3 grid grid-cols-4 gap-2">
              <div>
                <label className={labelCls}>Lecture No</label>
                <input
                  type="number"
                  value={editSLecture.lecture_no}
                  onChange={(e) => setEditSLecture({ ...editSLecture, lecture_no: e.target.value })}
                  className={inputCls}
                  placeholder="No"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={editSLecture.subject}
                  onChange={(e) => setEditSLecture({ ...editSLecture, subject: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={editSLecture.date}
                  onChange={(e) => setEditSLecture({ ...editSLecture, date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Subject Topics</label>
                <input
                  type="text"
                  value={editSLecture.subject_topic}
                  onChange={(e) => setEditSLecture({ ...editSLecture, subject_topic: e.target.value })}
                  className={inputCls}
                  placeholder="Topics"
                />
              </div>
              <div>
                <label className={labelCls}>Start Time</label>
                <input
                  type="time"
                  value={editSLecture.starttime}
                  onChange={(e) => setEditSLecture({ ...editSLecture, starttime: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>End Time</label>
                <input
                  type="time"
                  value={editSLecture.endtime}
                  onChange={(e) => setEditSLecture({ ...editSLecture, endtime: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Assignment</label>
                <input
                  type="text"
                  value={editSLecture.assignment}
                  onChange={(e) => setEditSLecture({ ...editSLecture, assignment: e.target.value })}
                  className={inputCls}
                  placeholder="Assignment"
                />
              </div>
              <div>
                <label className={labelCls}>Assignment Date</label>
                <input
                  type="date"
                  value={editSLecture.assignment_date}
                  onChange={(e) => setEditSLecture({ ...editSLecture, assignment_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Faculty Name</label>
                <select
                  value={editSLecture.faculty_name}
                  onChange={(e) => setEditSLecture({ ...editSLecture, faculty_name: e.target.value })}
                  className={selectCls}
                >
                  <option value="">Select Faculty</option>
                  {facultyList.map(f => (
                    <option key={f.Faculty_Id} value={f.Faculty_Name}>{f.Faculty_Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Class Room</label>
                <input
                  type="text"
                  value={editSLecture.class_room}
                  onChange={(e) => setEditSLecture({ ...editSLecture, class_room: e.target.value })}
                  className={inputCls}
                  placeholder="Room"
                />
              </div>
              <div>
                <label className={labelCls}>Documents</label>
                <input
                  type="text"
                  value={editSLecture.documents}
                  onChange={(e) => setEditSLecture({ ...editSLecture, documents: e.target.value })}
                  className={inputCls}
                  placeholder="Documents"
                />
              </div>
              <div>
                <label className={labelCls}>Unit Test</label>
                <input
                  type="text"
                  value={editSLecture.unit_test}
                  onChange={(e) => setEditSLecture({ ...editSLecture, unit_test: e.target.value })}
                  className={inputCls}
                  placeholder="Unit Test"
                />
              </div>
              <div>
                <label className={labelCls}>Publish</label>
                <select
                  value={editSLecture.publish}
                  onChange={(e) => setEditSLecture({ ...editSLecture, publish: e.target.value })}
                  className={selectCls}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowEditSLectureModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSLecture}
                disabled={!editSLecture.subject.trim() || savingSLecture}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingSLecture ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Export, Search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleExportSLectures}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded h-7 hover:bg-gray-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={sLectureSearch}
            onChange={(e) => setSLectureSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded overflow-hidden overflow-x-auto">
        <table className="dashboard-table w-full text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Id</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Lec#</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Subject</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Topics</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Date</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Start</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">End</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Assign</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">AssignDt</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Faculty</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Room</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Docs</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">UT</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Pub</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Act</th>
            </tr>
          </thead>
          <tbody>
            {loadingSLectures ? (
              <tr>
                <td colSpan={15} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredSLectures.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-2 py-4 text-center text-gray-400">
                  No lecture plan found. Lectures are auto-loaded from previous batch of same course.
                </td>
              </tr>
            ) : (
              filteredSLectures.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-700">{l.id}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.lecture_no || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium truncate max-w-[100px]">{l.subject || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate max-w-[100px]">{l.subject_topic || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.date || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.starttime || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.endtime || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate max-w-[60px]">{l.assignment || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.assignment_date || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate max-w-[80px]">{l.faculty_name || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.class_room || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.documents || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.unit_test || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.publish || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button 
                        onClick={() => handleEditSLecture(l)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded" 
                        title="Edit"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteSLecture(l.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* Final Exam Details Tab - Table with Add Modal */
  const handleSaveFinalExam = async () => {
    if (!newFinalExam.subject.trim()) return;
    setSavingFinalExam(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/finalexams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFinalExam),
      });
      if (res.ok) {
        setShowAddFinalExamModal(false);
        setNewFinalExam({
          subject: '',
          exam_date: '',
          max_marks: '',
          duration: '',
        });
        fetchFinalExams();
      }
    } catch { /* ignore */ }
    setSavingFinalExam(false);
  };

  const handleDeleteFinalExam = async (examId: number) => {
    if (!confirm('Are you sure you want to delete this final exam?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/finalexams?examId=${examId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchFinalExams();
      }
    } catch { /* ignore */ }
  };

  const handleExportFinalExams = () => {
    const headers = ['Id', 'Subject', 'Exam Date', 'Max Marks', 'Duration'];
    const rows = finalExams.map((e) => [
      e.id,
      e.subject || '',
      e.exam_date || '',
      e.max_marks || '',
      e.duration || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `final-exams-batch-${batchId}.csv`;
    link.click();
  };

  const filteredFinalExams = finalExams.filter((e) => {
    const search = finalExamSearch.toLowerCase();
    return (
      (e.subject?.toLowerCase().includes(search) || false) ||
      (e.duration?.toLowerCase().includes(search) || false)
    );
  });

  const FinalExamDetailsTab = () => (
    <div className="space-y-2">
      {/* Add Final Exam Modal */}
      {showAddFinalExamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Add Final Exam</h3>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={newFinalExam.subject}
                  onChange={(e) => setNewFinalExam({ ...newFinalExam, subject: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>Exam Date</label>
                <input
                  type="date"
                  value={newFinalExam.exam_date}
                  onChange={(e) => setNewFinalExam({ ...newFinalExam, exam_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Max Marks</label>
                <input
                  type="number"
                  value={newFinalExam.max_marks}
                  onChange={(e) => setNewFinalExam({ ...newFinalExam, max_marks: e.target.value })}
                  className={inputCls}
                  placeholder="Marks"
                />
              </div>
              <div>
                <label className={labelCls}>Duration</label>
                <input
                  type="text"
                  value={newFinalExam.duration}
                  onChange={(e) => setNewFinalExam({ ...newFinalExam, duration: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. 2 hours"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowAddFinalExamModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFinalExam}
                disabled={!newFinalExam.subject.trim() || savingFinalExam}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingFinalExam ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Add, Export, Search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAddFinalExamModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-[#2E3093] text-white text-xs font-medium rounded h-7"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <button
          onClick={handleExportFinalExams}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded h-7 hover:bg-gray-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={finalExamSearch}
            onChange={(e) => setFinalExamSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="dashboard-table w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Subject</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-24">Exam Date</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-20">Max Marks</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-20">Duration</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingFinalExams ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredFinalExams.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-gray-400">
                  No records found. Click &quot;Add&quot; to create.
                </td>
              </tr>
            ) : (
              filteredFinalExams.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-900 font-medium">{e.subject || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{e.exam_date || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{e.max_marks ?? '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{e.duration || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteFinalExam(e.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* Lecture Plan handlers */
  const filteredLectures = lectures.filter((l) =>
    l.subject?.toLowerCase().includes(lectureSearch.toLowerCase()) ||
    l.subject_topic?.toLowerCase().includes(lectureSearch.toLowerCase())
  );

  const handleDeleteLecture = async (lectureId: number) => {
    if (!confirm('Are you sure you want to delete this lecture?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/lectures?lectureId=${lectureId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchLectures();
      }
    } catch { /* ignore */ }
  };

  const handleExportLectures = () => {
    const headers = ['Id', 'LectureNo', 'Subject', 'SubjectTopics', 'Date', 'StartTime', 'EndTime', 'Assignment', 'AssignmentDate', 'FacultyName', 'ClassRoom', 'Documents', 'UnitTest', 'Publish'];
    const rows = filteredLectures.map(l => [
      l.id,
      l.lecture_no || '',
      l.subject || '',
      l.subject_topic || '',
      l.date || '',
      l.starttime || '',
      l.endtime || '',
      l.assignment || '',
      l.assignment_date || '',
      l.faculty_name_display || '',
      l.class_room || '',
      l.documents || '',
      l.unit_test || '',
      l.publish || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lectures-batch-${batchId}.csv`;
    link.click();
  };

  const handleSaveLecture = async () => {
    if (!newLecture.subject.trim()) return;
    setSavingLecture(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/lectures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLecture),
      });
      if (res.ok) {
        setShowAddLectureModal(false);
        setNewLecture({
          lecture_no: '',
          subject: '',
          subject_topic: '',
          date: '',
          starttime: '',
          endtime: '',
          assignment: '',
          assignment_date: '',
          faculty_id: '',
          class_room: '',
          documents: '',
          unit_test: '',
          publish: 'No',
        });
        fetchLectures();
      }
    } catch { /* ignore */ }
    setSavingLecture(false);
  };

  const handleUpdateLecture = async () => {
    if (!editLecture.subject.trim() || !editingLectureId) return;
    setSavingLecture(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/lectures`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingLectureId, ...editLecture }),
      });
      if (res.ok) {
        setShowEditLectureModal(false);
        setEditingLectureId(null);
        setEditLecture({
          lecture_no: '',
          subject: '',
          subject_topic: '',
          date: '',
          starttime: '',
          endtime: '',
          assignment: '',
          assignment_date: '',
          faculty_id: '',
          class_room: '',
          documents: '',
          unit_test: '',
          publish: 'No',
        });
        fetchLectures();
      }
    } catch { /* ignore */ }
    setSavingLecture(false);
  };

  const LecturePlanTab = () => (
    <div className="space-y-2">
      {/* Add Lecture Modal */}
      {showAddLectureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Add Lecture</h3>
            </div>
            <div className="p-3 grid grid-cols-4 gap-2">
              <div>
                <label className={labelCls}>Lecture No</label>
                <input
                  type="number"
                  value={newLecture.lecture_no}
                  onChange={(e) => setNewLecture({ ...newLecture, lecture_no: e.target.value })}
                  className={inputCls}
                  placeholder="No"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={newLecture.subject}
                  onChange={(e) => setNewLecture({ ...newLecture, subject: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={newLecture.date}
                  onChange={(e) => setNewLecture({ ...newLecture, date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Subject Topics</label>
                <input
                  type="text"
                  value={newLecture.subject_topic}
                  onChange={(e) => setNewLecture({ ...newLecture, subject_topic: e.target.value })}
                  className={inputCls}
                  placeholder="Topics"
                />
              </div>
              <div>
                <label className={labelCls}>Start Time</label>
                <input
                  type="time"
                  value={newLecture.starttime}
                  onChange={(e) => setNewLecture({ ...newLecture, starttime: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>End Time</label>
                <input
                  type="time"
                  value={newLecture.endtime}
                  onChange={(e) => setNewLecture({ ...newLecture, endtime: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Assignment</label>
                <input
                  type="text"
                  value={newLecture.assignment}
                  onChange={(e) => setNewLecture({ ...newLecture, assignment: e.target.value })}
                  className={inputCls}
                  placeholder="Assignment"
                />
              </div>
              <div>
                <label className={labelCls}>Assignment Date</label>
                <input
                  type="date"
                  value={newLecture.assignment_date}
                  onChange={(e) => setNewLecture({ ...newLecture, assignment_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Faculty Name</label>
                <select
                  value={newLecture.faculty_id}
                  onChange={(e) => setNewLecture({ ...newLecture, faculty_id: e.target.value })}
                  className={selectCls}
                >
                  <option value="">Select Faculty</option>
                  {facultyList.map(f => (
                    <option key={f.Faculty_Id} value={f.Faculty_Id.toString()}>{f.Faculty_Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Class Room</label>
                <input
                  type="text"
                  value={newLecture.class_room}
                  onChange={(e) => setNewLecture({ ...newLecture, class_room: e.target.value })}
                  className={inputCls}
                  placeholder="Room"
                />
              </div>
              <div>
                <label className={labelCls}>Documents</label>
                <input
                  type="text"
                  value={newLecture.documents}
                  onChange={(e) => setNewLecture({ ...newLecture, documents: e.target.value })}
                  className={inputCls}
                  placeholder="Documents"
                />
              </div>
              <div>
                <label className={labelCls}>Unit Test</label>
                <input
                  type="text"
                  value={newLecture.unit_test}
                  onChange={(e) => setNewLecture({ ...newLecture, unit_test: e.target.value })}
                  className={inputCls}
                  placeholder="Unit Test"
                />
              </div>
              <div>
                <label className={labelCls}>Publish</label>
                <select
                  value={newLecture.publish}
                  onChange={(e) => setNewLecture({ ...newLecture, publish: e.target.value })}
                  className={selectCls}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowAddLectureModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLecture}
                disabled={!newLecture.subject.trim() || savingLecture}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingLecture ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lecture Modal */}
      {showEditLectureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-3 py-2">
              <h3 className="text-xs font-bold text-white">Edit Lecture</h3>
            </div>
            <div className="p-3 grid grid-cols-4 gap-2">
              <div>
                <label className={labelCls}>Lecture No</label>
                <input
                  type="number"
                  value={editLecture.lecture_no}
                  onChange={(e) => setEditLecture({ ...editLecture, lecture_no: e.target.value })}
                  className={inputCls}
                  placeholder="No"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Subject</label>
                <input
                  type="text"
                  value={editLecture.subject}
                  onChange={(e) => setEditLecture({ ...editLecture, subject: e.target.value })}
                  className={inputCls}
                  placeholder="Subject"
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={editLecture.date}
                  onChange={(e) => setEditLecture({ ...editLecture, date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Subject Topics</label>
                <input
                  type="text"
                  value={editLecture.subject_topic}
                  onChange={(e) => setEditLecture({ ...editLecture, subject_topic: e.target.value })}
                  className={inputCls}
                  placeholder="Topics"
                />
              </div>
              <div>
                <label className={labelCls}>Start Time</label>
                <input
                  type="time"
                  value={editLecture.starttime}
                  onChange={(e) => setEditLecture({ ...editLecture, starttime: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>End Time</label>
                <input
                  type="time"
                  value={editLecture.endtime}
                  onChange={(e) => setEditLecture({ ...editLecture, endtime: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Assignment</label>
                <input
                  type="text"
                  value={editLecture.assignment}
                  onChange={(e) => setEditLecture({ ...editLecture, assignment: e.target.value })}
                  className={inputCls}
                  placeholder="Assignment"
                />
              </div>
              <div>
                <label className={labelCls}>Assignment Date</label>
                <input
                  type="date"
                  value={editLecture.assignment_date}
                  onChange={(e) => setEditLecture({ ...editLecture, assignment_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Faculty Name</label>
                <select
                  value={editLecture.faculty_id}
                  onChange={(e) => setEditLecture({ ...editLecture, faculty_id: e.target.value })}
                  className={selectCls}
                >
                  <option value="">Select Faculty</option>
                  {facultyList.map(f => (
                    <option key={f.Faculty_Id} value={f.Faculty_Id.toString()}>{f.Faculty_Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Class Room</label>
                <input
                  type="text"
                  value={editLecture.class_room}
                  onChange={(e) => setEditLecture({ ...editLecture, class_room: e.target.value })}
                  className={inputCls}
                  placeholder="Room"
                />
              </div>
              <div>
                <label className={labelCls}>Documents</label>
                <input
                  type="text"
                  value={editLecture.documents}
                  onChange={(e) => setEditLecture({ ...editLecture, documents: e.target.value })}
                  className={inputCls}
                  placeholder="Documents"
                />
              </div>
              <div>
                <label className={labelCls}>Unit Test</label>
                <input
                  type="text"
                  value={editLecture.unit_test}
                  onChange={(e) => setEditLecture({ ...editLecture, unit_test: e.target.value })}
                  className={inputCls}
                  placeholder="Unit Test"
                />
              </div>
              <div>
                <label className={labelCls}>Publish</label>
                <select
                  value={editLecture.publish}
                  onChange={(e) => setEditLecture({ ...editLecture, publish: e.target.value })}
                  className={selectCls}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
              <button
                onClick={() => setShowEditLectureModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateLecture}
                disabled={!editLecture.subject.trim() || savingLecture}
                className="px-3 py-1 bg-[#2E3093] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                {savingLecture ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Add, Export, Search */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowAddLectureModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-[#2E3093] text-white text-xs font-medium rounded h-7"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <button
          onClick={handleExportLectures}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-600 text-xs font-medium rounded h-7 hover:bg-gray-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={lectureSearch}
            onChange={(e) => setLectureSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded overflow-hidden overflow-x-auto">
        <table className="dashboard-table w-full text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Id</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Lec#</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Subject</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Topics</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Date</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Start</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">End</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Assign</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">AssignDt</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Faculty</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Room</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Docs</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">UT</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Pub</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b whitespace-nowrap">Act</th>
            </tr>
          </thead>
          <tbody>
            {loadingLectures ? (
              <tr>
                <td colSpan={15} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredLectures.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-2 py-4 text-center text-gray-400">
                  No records found. Click &quot;Add&quot; to create.
                </td>
              </tr>
            ) : (
              filteredLectures.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-700">{l.id}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.lecture_no || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium truncate max-w-[100px]">{l.subject || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate max-w-[100px]">{l.subject_topic || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.date || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.starttime || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.endtime || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate max-w-[60px]">{l.assignment || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{l.assignment_date || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate max-w-[80px]">{l.faculty_name_display || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.class_room || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.documents || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.unit_test || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.publish || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button 
                        onClick={() => handleEditLecture(l)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded" 
                        title="Edit"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteLecture(l.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* Convocation Details Tab - Table with Add Modal */
  const handleAddConvocation = async () => {
    if (!newConvocation.faculty_name.trim() && !newConvocation.guest_name.trim()) {
      alert('Please fill at least Faculty Name or Guest Name');
      return;
    }
    setSavingConvocation(true);
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/convocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConvocation),
      });
      if (res.ok) {
        setShowAddConvocationModal(false);
        setNewConvocation({
          faculty_name: '',
          guest_name: '',
          guest_mobile: '',
          email: '',
          guest_designation: '',
        });
        await fetchConvocation();
      } else {
        alert('Failed to add convocation record');
      }
    } catch {
      alert('Error adding convocation record');
    }
    setSavingConvocation(false);
  };

  const handleDeleteConvocation = async (convocationId: number) => {
    if (!confirm('Are you sure you want to delete this convocation record?')) return;
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/convocation?convocationId=${convocationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchConvocation();
      } else {
        alert('Failed to delete convocation');
      }
    } catch {
      alert('Error deleting convocation');
    }
  };

  const handleSaveConvocationDate = async () => {
    try {
      const res = await fetch(`/api/masters/batch/${batchId}/convocation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ convocation_date: convocationDate, convocation_day: convocationDay }),
      });
      if (res.ok) {
        alert('Convocation date saved!');
      }
    } catch {
      alert('Error saving convocation date');
    }
  };

  const filteredConvocations = convocations.filter((c) => {
    const search = convocationSearch.toLowerCase();
    return (
      (c.faculty_name?.toLowerCase().includes(search) || false) ||
      (c.guest_name?.toLowerCase().includes(search) || false) ||
      (c.email?.toLowerCase().includes(search) || false) ||
      (c.guest_designation?.toLowerCase().includes(search) || false)
    );
  });

  const ConvocationDetailsTab = () => (
    <div className="space-y-2">
      {/* Top Row: Date/Day + Toolbar combined */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Conv. Date</label>
            <input
              type="date"
              value={convocationDate}
              onChange={(e) => setConvocationDate(e.target.value)}
              className="w-28 bg-white border border-gray-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Conv. Day</label>
            <input
              type="text"
              value={convocationDay}
              onChange={(e) => setConvocationDay(e.target.value)}
              className="w-20 bg-white border border-gray-300 rounded px-2 py-1 text-xs"
              placeholder="Day"
            />
          </div>
          <button
            onClick={handleSaveConvocationDate}
            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium h-7"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Save
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowAddConvocationModal(true)}
          className="flex items-center gap-1 bg-[#2E3093] hover:bg-[#252780] text-white px-2 py-1 rounded text-xs font-medium h-7"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
        <button className="flex items-center gap-1 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-2 py-1 rounded text-xs font-medium h-7">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export
        </button>
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={convocationSearch}
            onChange={(e) => setConvocationSearch(e.target.value)}
            className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-xs h-7"
          />
          <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Compact Table */}
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="dashboard-table w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5">
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-10">Id</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Faculty</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Guest</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-24">Mobile</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b">Email</th>
              <th className="text-left px-2 py-1.5 font-semibold text-[#2E3093] border-b w-20">Desig.</th>
              <th className="text-center px-2 py-1.5 font-semibold text-[#2E3093] border-b w-14">Act</th>
            </tr>
          </thead>
          <tbody>
            {loadingConvocation ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredConvocations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-gray-400">
                  No records found. Click &quot;Add&quot; to create one.
                </td>
              </tr>
            ) : (
              filteredConvocations.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-700">{c.id}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium truncate">{c.faculty_name || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate">{c.guest_name || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate">{c.guest_mobile || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate">{c.email || '-'}</td>
                  <td className="px-2 py-1.5 text-gray-700 truncate">{c.guest_designation || '-'}</td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteConvocation(c.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Convocation Modal */}
      {showAddConvocationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800">Add Convocation Record</h3>
              <button
                onClick={() => setShowAddConvocationModal(false)}
                className="p-0.5 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Faculty Name</label>
                <select
                  value={newConvocation.faculty_name}
                  onChange={(e) => setNewConvocation(prev => ({ ...prev, faculty_name: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="">-- Select --</option>
                  {facultyList.map((f) => (
                    <option key={f.Faculty_Id} value={f.Faculty_Name}>
                      {f.Faculty_Name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Guest Name</label>
                <input
                  type="text"
                  value={newConvocation.guest_name}
                  onChange={(e) => setNewConvocation(prev => ({ ...prev, guest_name: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                  placeholder="Guest name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Guest Mobile</label>
                <input
                  type="text"
                  value={newConvocation.guest_mobile}
                  onChange={(e) => setNewConvocation(prev => ({ ...prev, guest_mobile: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                  placeholder="Mobile number"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Email</label>
                <input
                  type="email"
                  value={newConvocation.email}
                  onChange={(e) => setNewConvocation(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                  placeholder="Email"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Designation</label>
                <input
                  type="text"
                  value={newConvocation.guest_designation}
                  onChange={(e) => setNewConvocation(prev => ({ ...prev, guest_designation: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                  placeholder="Designation"
                />
              </div>
            </div>
            <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddConvocationModal(false)}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddConvocation}
                disabled={savingConvocation}
                className="flex items-center gap-1 bg-[#2E3093] hover:bg-[#252780] text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
              >
                {savingConvocation ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )}
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* Site Visit Tab */
  const handleCompanySelect = (companyName: string) => {
    handleChange('Site_company', companyName);
    const company = consultancyCompanies.find(c => c.Comp_Name === companyName);
    if (company) {
      handleChange('Contact_Person', company.Contact_Person || '');
      handleChange('Designation', company.Designation || '');
      handleChange('Telephone', company.Tel || '');
      const addressParts = [company.Address, company.City, company.State, company.Pin].filter(Boolean);
      handleChange('Site_Place', addressParts.join(', '));
    } else {
      handleChange('Contact_Person', '');
      handleChange('Designation', '');
      handleChange('Telephone', '');
      handleChange('Site_Place', '');
    }
  };

  const SiteVisitTab = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {/* Company Dropdown */}
        <div>
          <label className={labelCls}>Company <span className="text-red-500">*</span></label>
          <select
            value={formData.Site_company}
            onChange={(e) => handleCompanySelect(e.target.value)}
            className={selectCls}
          >
            <option value="">Select Company</option>
            {consultancyCompanies.map(c => (
              <option key={c.Const_Id} value={c.Comp_Name}>{c.Comp_Name}</option>
            ))}
          </select>
        </div>
        {/* Contact Person */}
        <div>
          <label className={labelCls}>Contact Person</label>
          <input
            type="text"
            value={formData.Contact_Person}
            onChange={(e) => handleChange('Contact_Person', e.target.value)}
            className={inputCls}
            placeholder="Contact Person"
          />
        </div>
        {/* Designation */}
        <div>
          <label className={labelCls}>Designation</label>
          <input
            type="text"
            value={formData.Designation}
            onChange={(e) => handleChange('Designation', e.target.value)}
            className={inputCls}
            placeholder="Designation"
          />
        </div>
        {/* Phone */}
        <div>
          <label className={labelCls}>Phone</label>
          <input
            type="text"
            value={formData.Telephone}
            onChange={(e) => handleChange('Telephone', e.target.value)}
            className={inputCls}
            placeholder="Phone"
          />
        </div>
        {/* Visit Date */}
        <div>
          <label className={labelCls}>Visit Date</label>
          <input
            type="date"
            value={formData.Site_Visit_Dt}
            onChange={(e) => handleChange('Site_Visit_Dt', e.target.value)}
            className={inputCls}
          />
        </div>
        {/* Address - spans the remaining column */}
        <div>
          <label className={labelCls}>Address</label>
          <input
            type="text"
            value={formData.Site_Place}
            onChange={(e) => handleChange('Site_Place', e.target.value)}
            className={inputCls}
            placeholder="Address"
          />
        </div>
      </div>
    </div>
  );

  /* Tab Placeholder for other tabs */
  const TabPlaceholder = ({ name }: { name: string }) => (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <div className="text-center">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs mt-1">Form content will be added here</p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    if (!batchData) return null;

    switch (activeTab) {
      case 'batch-details':
        return <BatchDetailsTab />;
      case 'fees-structure':
        return <FeesStructureTab />;
      case 'assignment-details':
        return <AssignmentDetailsTab />;
      case 'unit-test-details':
        return <UnitTestDetailsTab />;
      case 'discipline-moc':
        return <DisciplineMocTab />;
      case 'feedback-details':
        return <FeedbackDetailsTab />;
      case 'standard-lecture-plan':
        return <StandardLecturePlanTab />;
      case 'lecture-plan':
        return <LecturePlanTab />;
      case 'convocation-details':
        return <ConvocationDetailsTab />;
      case 'site-visit':
        return <SiteVisitTab />;
      case 'final-exam-details':
        return <FinalExamDetailsTab />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit batches." />;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/masters/batch')}
            className="p-1 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">Edit Batch</h2>
            <p className="text-xs text-white/70">
              Masters &gt; Batch &gt; Edit &gt; {batchData?.Batch_code || batchId}
            </p>
          </div>
          {batchData && (
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{batchData.Course_Name}</p>
              <p className="text-xs text-white/70">{batchData.Category}</p>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Main Card with Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-gray-50/50">
          <div className="flex overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-[10px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#2E3093] text-[#2E3093] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-3">
          {renderTabContent()}
        </div>

        {/* Footer Actions */}
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/30 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            Save
          </button>
          <button
            onClick={() => router.push('/dashboard/masters/batch')}
            className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
