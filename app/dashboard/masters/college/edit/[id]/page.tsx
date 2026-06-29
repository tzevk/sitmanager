'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

type TabKey = 'college' | 'students' | 'followups';

type StudentDetail = {
  Student_Id: number;
  Student_Name: string;
  Course_Name: string;
  Batch_Code: string;
  Year_Of_Passing: string;
  Mobile: string;
  Email: string;
  Discipline: string;
};

type FollowupDetail = {
  Follow_id: number;
  Followup_Date: string;
  ContactPerson: string;
  Designation: string;
  Mobile: string;
  Email: string;
  Remarks: string;
  Purpose: string;
  DirectLine: string;
  Next_Date: string;
};

const DISCIPLINES = [
  'Mechanical',
  'Electronics & Tele-Communication',
  'Eletrical',
  'Civil',
  'Commerce',
  'Chemical',
  'Computers',
  'Science',
  'Production',
  'Arts',
  'Electronics',
  'Instrumentation',
  'Petrochemical',
  'Industrial',
  'Automobile',
  'Fabrication',
  'N.C.T.V.T.',
  'Chemistry',
  'M.C.V.C',
  'Refrigeration & Airconditioning',
  'Electrical & Electronics',
  'Fitter',
  'IT',
  'test',
];

const STATUS_OPTIONS = [
  'Select',
  'Conducted',
  'Pending',
  'Open',
  'Junk',
  'Closed',
  'On Hold',
  'Follow Up',
  'Accepted Closed',
  'Denied',
  'Duplicate Inquiries',
  'Close',
  'Interested (follow up)',
  'Not Interested',
  'Fees is too high',
  'More Interested in Placements',
  'Will let you know',
  'Not connected',
  'Duplicate enquiry',
  'Not interested  (closed)',
  'Not eligible',
  'Next Batch',
  'Financial Problem',
  'Job assurance',
  'High experience in different field',
  'Fees is high for him',
  'If interested will contact in future',
  'Req Specific Short Term Training',
  'Old enq - Not interested (closed)',
  'Old enq - Next Batch',
  'Old enq - If interested will contact in future',
  'Old enq - Interested (follow up)',
  'Old enq - financial Problem',
  'Old enq - Job assurance',
];

const labelCls = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1';
const inputCls = 'w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400';
const textareaCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 resize-none';

const emptyForm = {
  college_name: '',
  university: '',
  contact_person: '',
  designation: '',
  address: '',
  city: '',
  pin: '',
  state: '',
  country: '',
  telephone: '',
  mobile: '',
  email: '',
  website: '',
  remark: '',
  purpose: '',
  course: '',
  batch: '',
  refstudentname: '',
  refmobile: '',
  refemail: '',
  descipline: '',
  followup_status: '',
  followup_date: '',
};

const emptyFollowup: FollowupDetail = {
  Follow_id: 0,
  Followup_Date: '',
  ContactPerson: '',
  Designation: '',
  Mobile: '',
  Email: '',
  Remarks: '',
  Purpose: '',
  DirectLine: '',
  Next_Date: '',
};

function formatDateForInput(value: unknown) {
  if (!value) return '';
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function normalizeDiscipline(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseDisciplines(value: string) {
  const known = new Map(DISCIPLINES.map((discipline) => [normalizeDiscipline(discipline), discipline]));
  return String(value || '')
    .split(/[,;|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => known.get(normalizeDiscipline(item)) || item);
}

export default function EditCollegePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('college');

  const [activeTab, setActiveTab] = useState<TabKey>('college');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [followups, setFollowups] = useState<FollowupDetail[]>([]);
  const [savingStudentId, setSavingStudentId] = useState<number | null>(null);
  const [savingFollowupId, setSavingFollowupId] = useState<number | null>(null);

  const selectedDisciplines = useMemo(() => parseDisciplines(formData.descipline), [formData.descipline]);
  const selectedDisciplineKeys = useMemo(() => new Set(selectedDisciplines.map(normalizeDiscipline)), [selectedDisciplines]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/masters/college/${id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to fetch college data');
        if (cancelled) return;
        setFormData({
          college_name: data.college_name || data.CollegeName || '',
          university: data.university || '',
          contact_person: data.contact_person || '',
          designation: data.designation || '',
          address: data.address || '',
          city: data.city || '',
          pin: data.pin || '',
          state: data.state || '',
          country: data.country || '',
          telephone: data.telephone || '',
          mobile: data.mobile || '',
          email: data.email || '',
          website: data.website || '',
          remark: data.remark || '',
          purpose: data.purpose || '',
          course: data.course || '',
          batch: data.batch || '',
          refstudentname: data.refstudentname || '',
          refmobile: data.refmobile || '',
          refemail: data.refemail || '',
          descipline: data.descipline || '',
          followup_status: data.followup_status || '',
          followup_date: formatDateForInput(data.followup_date),
        });
        setStudents(Array.isArray(data.students) ? data.students.map((student: StudentDetail) => ({
          Student_Id: Number(student.Student_Id || 0),
          Student_Name: student.Student_Name || '',
          Course_Name: student.Course_Name || '',
          Batch_Code: student.Batch_Code || '',
          Year_Of_Passing: student.Year_Of_Passing || '',
          Mobile: student.Mobile || '',
          Email: student.Email || '',
          Discipline: student.Discipline || '',
        })) : []);
        setFollowups(Array.isArray(data.followups) ? data.followups.map((followup: FollowupDetail) => ({
          Follow_id: Number(followup.Follow_id || 0),
          Followup_Date: formatDateForInput(followup.Followup_Date),
          ContactPerson: followup.ContactPerson || '',
          Designation: followup.Designation || '',
          Mobile: followup.Mobile || '',
          Email: followup.Email || '',
          Remarks: followup.Remarks || '',
          Purpose: followup.Purpose || '',
          DirectLine: followup.DirectLine || '',
          Next_Date: formatDateForInput(followup.Next_Date),
        })) : []);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch college data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (id) fetchData();
    return () => { cancelled = true; };
  }, [id]);

  const handleChange = (field: keyof typeof emptyForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setDiscipline = (discipline: string, checked: boolean) => {
    const next = new Map(selectedDisciplines.map((item) => [normalizeDiscipline(item), item]));
    if (checked) next.set(normalizeDiscipline(discipline), discipline);
    else next.delete(normalizeDiscipline(discipline));
    handleChange('descipline', Array.from(next.values()).join(', '));
  };

  const setAllDisciplines = (checked: boolean) => {
    handleChange('descipline', checked ? DISCIPLINES.join(', ') : '');
  };

  const setStudentDiscipline = (studentId: number, discipline: string, checked: boolean) => {
    setStudents((current) => current.map((student) => {
      if (student.Student_Id !== studentId) return student;
      const currentDisciplines = parseDisciplines(student.Discipline);
      const next = new Map(currentDisciplines.map((item) => [normalizeDiscipline(item), item]));
      if (checked) next.set(normalizeDiscipline(discipline), discipline);
      else next.delete(normalizeDiscipline(discipline));
      return { ...student, Discipline: Array.from(next.values()).join(', ') };
    }));
  };

  const saveStudentDiscipline = async (student: StudentDetail) => {
    setSavingStudentId(student.Student_Id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/masters/college/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-student-discipline', studentId: student.Student_Id, discipline: student.Discipline }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save student discipline');
      setMessage('Student discipline saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save student discipline');
    } finally {
      setSavingStudentId(null);
    }
  };

  const setFollowupField = (index: number, field: keyof FollowupDetail, value: string) => {
    setFollowups((current) => current.map((followup, followupIndex) => (
      followupIndex === index ? { ...followup, [field]: value } : followup
    )));
  };

  const addFollowup = () => {
    setActiveTab('followups');
    setFollowups((current) => [{ ...emptyFollowup }, ...current]);
  };

  const saveFollowup = async (followup: FollowupDetail, index: number) => {
    const savingId = followup.Follow_id || -1 - index;
    setSavingFollowupId(savingId);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/masters/college/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-followup',
          followId: followup.Follow_id,
          date: followup.Followup_Date,
          contactPerson: followup.ContactPerson,
          designation: followup.Designation,
          mobile: followup.Mobile,
          email: followup.Email,
          remarks: followup.Remarks,
          purpose: followup.Purpose,
          directLine: followup.DirectLine,
          nextDate: followup.Next_Date,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save follow up');
      setFollowups((current) => current.map((item, itemIndex) => (
        itemIndex === index ? { ...item, Follow_id: Number(data.followId || item.Follow_id) } : item
      )));
      setMessage('Follow up saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save follow up');
    } finally {
      setSavingFollowupId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.college_name.trim()) {
      setError('College Name is required');
      setActiveTab('college');
      return;
    }
    if (!formData.university.trim()) {
      setError('University is required');
      setActiveTab('college');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/masters/college', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), ...formData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      router.push('/dashboard/reports/college-follow-up');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (permLoading || loading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit colleges." />;

  const tabs: Array<{ id: TabKey; label: string }> = [
    { id: 'college', label: 'College Details' },
    { id: 'students', label: 'Student Details' },
    { id: 'followups', label: 'Follow Up' },
  ];
  const allDisciplinesSelected = DISCIPLINES.every((discipline) => selectedDisciplineKeys.has(normalizeDiscipline(discipline)));

  return (
    <form onSubmit={handleSubmit} className="h-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col gap-3">
      <div className="shrink-0 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-3 shadow-[0_4px_14px_rgba(46,48,147,0.18)] relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-[#FAE452]" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-white tracking-tight leading-none">Edit College Follow Up</h2>
            <p className="text-[11px] text-white/65 mt-1">Reports &gt; College Follow Up &gt; Edit</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => router.push('/dashboard/reports/college-follow-up')} className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold text-white hover:bg-white/25 transition-colors" disabled={submitting}>Close</button>
            <button type="submit" disabled={submitting} className="px-4 py-1.5 rounded-lg bg-[#FAE452] text-xs font-black text-[#2E3093] hover:bg-[#f3de4f] transition-colors disabled:opacity-60">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>

      {error && <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{error}</div>}
      {message && <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</div>}

      <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-1 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === tab.id ? 'bg-[#2E3093] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>{tab.label}</button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        {activeTab === 'college' && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-white px-4 py-3"><h3 className="text-sm font-black text-[#2E3093]">College Details</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
                <div><label className={labelCls}>College Name: *</label><input value={formData.college_name} onChange={(event) => handleChange('college_name', event.target.value)} className={inputCls} required /></div>
                <div><label className={labelCls}>University: *</label><input value={formData.university} onChange={(event) => handleChange('university', event.target.value)} className={inputCls} required /></div>
                <div><label className={labelCls}>Contact Person:</label><input value={formData.contact_person} onChange={(event) => handleChange('contact_person', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Designation:</label><input value={formData.designation} onChange={(event) => handleChange('designation', event.target.value)} className={inputCls} /></div>
                <div className="lg:col-span-2"><label className={labelCls}>Address:</label><textarea value={formData.address} onChange={(event) => handleChange('address', event.target.value)} rows={3} className={textareaCls} /></div>
                <div><label className={labelCls}>City:</label><input value={formData.city} onChange={(event) => handleChange('city', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Pin:</label><input value={formData.pin} onChange={(event) => handleChange('pin', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>State:</label><input value={formData.state} onChange={(event) => handleChange('state', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Phone:</label><input value={formData.telephone} onChange={(event) => handleChange('telephone', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Country:</label><input value={formData.country} onChange={(event) => handleChange('country', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Email:</label><input type="email" value={formData.email} onChange={(event) => handleChange('email', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Mobile:</label><input value={formData.mobile} onChange={(event) => handleChange('mobile', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Website:</label><input value={formData.website} onChange={(event) => handleChange('website', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Purpose:</label><input value={formData.purpose} onChange={(event) => handleChange('purpose', event.target.value)} className={inputCls} /></div>
                <div className="lg:col-span-2"><label className={labelCls}>Remark:</label><textarea value={formData.remark} onChange={(event) => handleChange('remark', event.target.value)} rows={3} className={textareaCls} /></div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-white px-4 py-3"><h3 className="text-sm font-black text-[#2E3093]">Referred By</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 p-4">
                <div><label className={labelCls}>Student Name:</label><input value={formData.refstudentname} onChange={(event) => handleChange('refstudentname', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Mobile:</label><input value={formData.refmobile} onChange={(event) => handleChange('refmobile', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Email Id:</label><input type="email" value={formData.refemail} onChange={(event) => handleChange('refemail', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Course:</label><input value={formData.course} onChange={(event) => handleChange('course', event.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Batch:</label><input value={formData.batch} onChange={(event) => handleChange('batch', event.target.value)} className={inputCls} /></div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-white px-4 py-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-[#2E3093]">Disciplines</h3>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={allDisciplinesSelected} onChange={(event) => setAllDisciplines(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#2E3093]" />Select All</label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-4">
                {DISCIPLINES.map((discipline) => (
                  <label key={discipline} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700">
                    <input type="checkbox" checked={selectedDisciplineKeys.has(normalizeDiscipline(discipline))} onChange={(event) => setDiscipline(discipline, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#2E3093]" />
                    {discipline}
                  </label>
                ))}
              </div>
              {selectedDisciplines.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                  Selected: {selectedDisciplines.join(', ')}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-white px-4 py-3"><h3 className="text-sm font-black text-[#2E3093]">Status</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
                <div className="lg:col-span-2"><label className={labelCls}>Status:</label><select value={formData.followup_status || 'Select'} onChange={(event) => handleChange('followup_status', event.target.value === 'Select' ? '' : event.target.value)} className={inputCls}>{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                <div><label className={labelCls}>Date:</label><input type="date" value={formData.followup_date} onChange={(event) => handleChange('followup_date', event.target.value)} className={inputCls} /></div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'students' && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-white px-4 py-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-[#2E3093]">Student Details</h3>
              <span className="text-[11px] font-bold text-slate-500">{students.length} student{students.length === 1 ? '' : 's'}</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[1180px] text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left py-2 px-3 font-bold w-[210px]">Student Name</th>
                    <th className="text-left py-2 px-3 font-bold w-[170px]">Course Name</th>
                    <th className="text-left py-2 px-3 font-bold w-[120px]">Batch Code</th>
                    <th className="text-left py-2 px-3 font-bold w-[120px]">Year of Passing</th>
                    <th className="text-left py-2 px-3 font-bold w-[130px]">Mobile</th>
                    <th className="text-left py-2 px-3 font-bold w-[180px]">Email</th>
                    <th className="text-left py-2 px-3 font-bold w-[360px]">Discipline</th>
                    <th className="text-center py-2 px-3 font-bold w-[90px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-xs text-slate-400">No students linked to this college.</td></tr>
                  ) : students.map((student) => {
                    const studentDisciplineKeys = new Set(parseDisciplines(student.Discipline).map(normalizeDiscipline));
                    return (
                      <tr key={student.Student_Id} className="border-b border-slate-100 align-top hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-700 break-words">{student.Student_Name || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 break-words">{student.Course_Name || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{student.Batch_Code || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{student.Year_Of_Passing || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{student.Mobile || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 break-all">{student.Email || '-'}</td>
                        <td className="py-2 px-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {DISCIPLINES.map((discipline) => (
                              <label key={`${student.Student_Id}-${discipline}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={studentDisciplineKeys.has(normalizeDiscipline(discipline))}
                                  onChange={(event) => setStudentDiscipline(student.Student_Id, discipline, event.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#2E3093]"
                                />
                                {discipline}
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => saveStudentDiscipline(student)}
                            disabled={savingStudentId === student.Student_Id}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/15 disabled:opacity-60"
                          >
                            {savingStudentId === student.Student_Id ? 'Saving...' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'followups' && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-white px-4 py-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-[#2E3093]">Follow Up</h3>
              <button type="button" onClick={addFollowup} className="px-3 py-1.5 rounded-lg bg-[#2E3093] text-xs font-bold text-white hover:bg-[#24267A] transition-colors">Add Follow Up</button>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[1320px] text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left py-2 px-3 font-bold w-[130px]">Date</th>
                    <th className="text-left py-2 px-3 font-bold w-[170px]">Contact Person</th>
                    <th className="text-left py-2 px-3 font-bold w-[150px]">Designation</th>
                    <th className="text-left py-2 px-3 font-bold w-[130px]">Mobile</th>
                    <th className="text-left py-2 px-3 font-bold w-[190px]">Email</th>
                    <th className="text-left py-2 px-3 font-bold w-[220px]">Remarks</th>
                    <th className="text-left py-2 px-3 font-bold w-[150px]">Purpose</th>
                    <th className="text-left py-2 px-3 font-bold w-[130px]">DirectLine</th>
                    <th className="text-left py-2 px-3 font-bold w-[130px]">Next Date</th>
                    <th className="text-center py-2 px-3 font-bold w-[90px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.length === 0 ? (
                    <tr><td colSpan={10} className="py-10 text-center text-xs text-slate-400">No follow ups found. Use Add Follow Up to create one.</td></tr>
                  ) : followups.map((followup, index) => {
                    const savingId = followup.Follow_id || -1 - index;
                    return (
                      <tr key={`${followup.Follow_id || 'new'}-${index}`} className="border-b border-slate-100 align-top hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3"><input type="date" value={followup.Followup_Date || ''} onChange={(event) => setFollowupField(index, 'Followup_Date', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3"><input value={followup.ContactPerson || ''} onChange={(event) => setFollowupField(index, 'ContactPerson', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3"><input value={followup.Designation || ''} onChange={(event) => setFollowupField(index, 'Designation', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3"><input value={followup.Mobile || ''} onChange={(event) => setFollowupField(index, 'Mobile', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3"><input type="email" value={followup.Email || ''} onChange={(event) => setFollowupField(index, 'Email', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3"><textarea value={followup.Remarks || ''} onChange={(event) => setFollowupField(index, 'Remarks', event.target.value)} rows={2} className={textareaCls} /></td>
                        <td className="py-2 px-3"><input value={followup.Purpose || ''} onChange={(event) => setFollowupField(index, 'Purpose', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3"><input value={followup.DirectLine || ''} onChange={(event) => setFollowupField(index, 'DirectLine', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3"><input type="date" value={followup.Next_Date || ''} onChange={(event) => setFollowupField(index, 'Next_Date', event.target.value)} className={inputCls} /></td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => saveFollowup(followup, index)}
                            disabled={savingFollowupId === savingId}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E3093]/10 text-[#2E3093] text-[11px] font-semibold hover:bg-[#2E3093]/15 disabled:opacity-60"
                          >
                            {savingFollowupId === savingId ? 'Saving...' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </form>
  );
}
