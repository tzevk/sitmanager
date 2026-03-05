/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ---- shared classes (consultancy style) ---- */
const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const tblSelectCls =
  'bg-white border border-gray-300 rounded-md px-1.5 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const tblInputCls =
  'bg-white border border-gray-300 rounded-md px-1.5 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors w-full min-w-[90px]';

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-3 py-1.5 border-b border-gray-200">
        <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[#2E3093]/10 flex items-center justify-center">{icon}</span>
          {title}
        </h3>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

interface Course { Course_Id: number; Course_Name: string; }
interface Company { Const_Id: number; Comp_Name: string; }
interface Batch { Batch_Id: number; Batch_Code: string; }
interface Student { Student_Id: number; Student_Name: string; Batch_Code: string; }

interface StudentRow {
  _key: string;
  Id?: number;
  Student_Id: number | null;
  Student_Name: string;
  Student_Code: string;
  Sended: string;
  Result: string;
  Placement: string;
  PlacedBy: string;
  Placement_Type: string;
  Placement_Block: string;
  Placement_BlockReason: string;
  BlockReason_Remark: string;
  Remark: string;
}

const emptyStudentRow = (): StudentRow => ({
  _key: Math.random().toString(36).slice(2),
  Student_Id: null,
  Student_Name: '',
  Student_Code: '',
  Sended: 'No',
  Result: 'No',
  Placement: 'No',
  PlacedBy: '',
  Placement_Type: '',
  Placement_Block: 'No',
  Placement_BlockReason: '',
  BlockReason_Remark: '',
  Remark: '',
});

export default function EditCVShortlistedPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { canUpdate, loading: permLoading } = useResourcePermissions('cv_shortlisted');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [form, setForm] = useState({
    TDate: '',
    Company_Id: '',
    CompanyName: '',
    Course_id: '',
    Batch_Id: '',
    Batch_Code: '',
  });

  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);

  // Fetch dropdown options
  useEffect(() => {
    fetch('/api/admission-activity/cv-shortlisted')
      .then((res) => res.json())
      .then((data) => {
        setCourses(data.courses || []);
        setCompanies(data.companies || []);
      })
      .catch(() => {});
  }, []);

  // Fetch existing record
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/admission-activity/cv-shortlisted?id=${id}`);
        const data = await res.json();
        if (data.record) {
          const r = data.record;
          setForm({
            TDate: r.TDate || '',
            Company_Id: String(r.Company_Id || ''),
            CompanyName: r.CompanyName || '',
            Course_id: String(r.Course_id || ''),
            Batch_Id: String(r.Batch_Id || ''),
            Batch_Code: r.Batch_Code || '',
          });

          // Load batches for the course
          if (r.Course_id) {
            const bRes = await fetch(`/api/admission-activity/cv-shortlisted/students?courseId=${r.Course_id}`);
            const bData = await bRes.json();
            setBatches(bData.batches || []);
          }

          // Load students for the batch
          if (r.Batch_Code) {
            const sRes = await fetch(`/api/admission-activity/cv-shortlisted/students?batchCode=${r.Batch_Code}`);
            const sData = await sRes.json();
            setStudents(sData.students || []);
          }

          // Set children
          if (data.children && data.children.length > 0) {
            setStudentRows(
              data.children.map((c: any) => ({
                _key: Math.random().toString(36).slice(2),
                Id: c.Id,
                Student_Id: c.Student_Id,
                Student_Name: c.Student_Name || '',
                Student_Code: c.Student_Code ? String(c.Student_Code) : '',
                Sended: c.Sended || 'No',
                Result: c.Result || 'No',
                Placement: c.Placement || 'No',
                PlacedBy: c.PlacedBy || '',
                Placement_Type: c.Placement_Type || '',
                Placement_Block: c.Placement_Block || 'No',
                Placement_BlockReason: c.Placement_BlockReason || '',
                BlockReason_Remark: c.BlockReason_Remark || '',
                Remark: c.Remark || '',
              }))
            );
          }
        }
      } catch (err) {
        console.error('Error fetching record:', err);
      } finally {
        setFetching(false);
      }
    })();
  }, [id]);

  const fetchBatches = useCallback(async (courseId: string) => {
    if (!courseId) { setBatches([]); return; }
    setLoadingBatches(true);
    try {
      const res = await fetch(`/api/admission-activity/cv-shortlisted/students?courseId=${courseId}`);
      const data = await res.json();
      setBatches(data.batches || []);
    } catch { setBatches([]); }
    finally { setLoadingBatches(false); }
  }, []);

  const fetchStudents = useCallback(async (batchCode: string) => {
    if (!batchCode) { setStudents([]); return; }
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/admission-activity/cv-shortlisted/students?batchCode=${batchCode}`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch { setStudents([]); }
    finally { setLoadingStudents(false); }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'Company_Id') {
        const comp = companies.find((c) => String(c.Const_Id) === value);
        updated.CompanyName = comp?.Comp_Name || '';
      }
      if (name === 'Course_id') {
        updated.Batch_Id = '';
        updated.Batch_Code = '';
        setBatches([]);
        setStudents([]);
        fetchBatches(value);
      }
      if (name === 'Batch_Id') {
        const batch = batches.find((b) => String(b.Batch_Id) === value);
        updated.Batch_Code = batch?.Batch_Code || '';
        setStudents([]);
        if (batch) fetchStudents(batch.Batch_Code);
      }
      return updated;
    });
  };

  const handleAddStudents = () => {
    const existingIds = new Set(studentRows.map((r) => r.Student_Id));
    const newStudents = students.filter((s) => !existingIds.has(s.Student_Id));
    if (newStudents.length === 0) {
      alert('No more students available to add from this batch.');
      return;
    }
    const newRows: StudentRow[] = newStudents.map((s) => ({
      ...emptyStudentRow(),
      Student_Id: s.Student_Id,
      Student_Name: s.Student_Name,
    }));
    setStudentRows((prev) => [...prev, ...newRows]);
  };

  const handleStudentRowChange = (key: string, field: keyof StudentRow, value: string) => {
    setStudentRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  };

  const handleRemoveStudent = (key: string) => {
    setStudentRows((prev) => prev.filter((r) => r._key !== key));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.TDate || !form.Company_Id || !form.Course_id || !form.Batch_Id) {
      alert('Please fill all required fields: Date, Company, Course and Batch.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admission-activity/cv-shortlisted', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(id),
          CompanyName: form.CompanyName,
          TDate: form.TDate,
          Course_id: Number(form.Course_id),
          Batch_Id: Number(form.Batch_Id),
          Company_Id: Number(form.Company_Id),
          students: studentRows.map((r) => ({
            Id: r.Id || undefined,
            Student_Id: r.Student_Id,
            Student_Name: r.Student_Name,
            Student_Code: r.Student_Code || null,
            Result: r.Result,
            Placement: r.Placement,
            Sended: r.Sended,
            Remark: r.Remark,
            PlacedBy: r.PlacedBy,
            Placement_Type: r.Placement_Type,
            Placement_Block: r.Placement_Block,
            Placement_BlockReason: r.Placement_BlockReason,
            BlockReason_Remark: r.BlockReason_Remark,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/dashboard/cv-shortlisted');
      } else {
        alert(data.error || 'Failed to update');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit CV Shortlisted records." />;

  if (fetching) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading record...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/cv-shortlisted')}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-white/70 mb-0.5">
                <span>Dashboard</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                <span>Placement</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                <span>CV Shortlisted</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                <span className="text-white font-medium">Edit</span>
              </div>
              <h1 className="text-lg font-bold text-white">Edit CV Shortlisted</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Details Section */}
          <SectionCard
            title="CV Shortlisted Details"
            icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
              {/* Date */}
              <div>
                <label className={labelCls}>Date <span className="text-red-500">*</span></label>
                <input type="date" name="TDate" value={form.TDate} onChange={handleChange} className={inputCls} required />
              </div>

              {/* Company */}
              <div>
                <label className={labelCls}>Company Name <span className="text-red-500">*</span></label>
                <select name="Company_Id" value={form.Company_Id} onChange={handleChange} className={selectCls} required>
                  <option value="">--Select Company--</option>
                  {companies.map((c) => (
                    <option key={c.Const_Id} value={c.Const_Id}>{c.Comp_Name}</option>
                  ))}
                </select>
              </div>

              {/* Course */}
              <div>
                <label className={labelCls}>Course Name <span className="text-red-500">*</span></label>
                <select name="Course_id" value={form.Course_id} onChange={handleChange} className={selectCls} required>
                  <option value="">--Select Course--</option>
                  {courses.map((c) => (
                    <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                  ))}
                </select>
              </div>

              {/* Batch Code */}
              <div>
                <label className={labelCls}>Batch Code <span className="text-red-500">*</span></label>
                <select name="Batch_Id" value={form.Batch_Id} onChange={handleChange} className={selectCls} required disabled={loadingBatches || !form.Course_id}>
                  <option value="">--Select Batch Code--</option>
                  {batches.map((b) => (
                    <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_Code}</option>
                  ))}
                </select>
                {loadingBatches && <p className="text-[10px] text-gray-400 mt-0.5">Loading batches...</p>}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <button type="button" onClick={handleAddStudents} disabled={!form.Batch_Id || loadingStudents}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-semibold text-xs shadow hover:shadow-md transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add more Students
              </button>
              <button type="submit" disabled={loading}
                className="flex items-center gap-1.5 px-5 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-md font-semibold text-xs shadow hover:shadow-md transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                {loading ? 'Saving...' : 'Save'}
              </button>
              {loadingStudents && <span className="text-xs text-gray-400">Loading students...</span>}
            </div>
          </SectionCard>

          {/* Students Table */}
          {studentRows.length > 0 && (
            <SectionCard
              title="Students"
              icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
            >
              <div className="overflow-x-auto -mx-3">
                <table className="dashboard-table w-full text-xs">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10">
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Batch Code</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Student Name</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">CV Sent</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Interviewed</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Placement</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Placed By</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Placement Type</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Block Placement</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Block Reason</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Reason Remark</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Remark</th>
                      <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentRows.map((row) => (
                      <tr key={row._key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-1.5 text-gray-600">{form.Batch_Code || '-'}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900 whitespace-nowrap">{row.Student_Name}</td>
                        <td className="px-3 py-1.5 text-center">
                          <select value={row.Sended} onChange={(e) => handleStudentRowChange(row._key, 'Sended', e.target.value)} className={tblSelectCls}>
                            <option value="No">No</option><option value="Yes">Yes</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <select value={row.Result} onChange={(e) => handleStudentRowChange(row._key, 'Result', e.target.value)} className={tblSelectCls}>
                            <option value="No">No</option><option value="Yes">Yes</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <select value={row.Placement} onChange={(e) => handleStudentRowChange(row._key, 'Placement', e.target.value)} className={tblSelectCls}>
                            <option value="No">No</option><option value="Yes">Yes</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <select value={row.PlacedBy} onChange={(e) => handleStudentRowChange(row._key, 'PlacedBy', e.target.value)} className={tblSelectCls + ' min-w-[80px]'}>
                            <option value="">--</option><option value="SIT">SIT</option><option value="Self">Self</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <select value={row.Placement_Type} onChange={(e) => handleStudentRowChange(row._key, 'Placement_Type', e.target.value)} className={tblSelectCls + ' min-w-[90px]'}>
                            <option value="">--</option><option value="Permanent">Permanent</option><option value="Temporary">Temporary</option><option value="Contract">Contract</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <select value={row.Placement_Block} onChange={(e) => handleStudentRowChange(row._key, 'Placement_Block', e.target.value)} className={tblSelectCls}>
                            <option value="No">No</option><option value="Yes">Yes</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="text" value={row.Placement_BlockReason} onChange={(e) => handleStudentRowChange(row._key, 'Placement_BlockReason', e.target.value)} className={tblInputCls} placeholder="Reason" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="text" value={row.BlockReason_Remark} onChange={(e) => handleStudentRowChange(row._key, 'BlockReason_Remark', e.target.value)} className={tblInputCls} placeholder="Reason Remark" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="text" value={row.Remark} onChange={(e) => handleStudentRowChange(row._key, 'Remark', e.target.value)} className={tblInputCls} placeholder="Remark" />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button type="button" onClick={() => handleRemoveStudent(row._key)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </form>
      </div>
    </div>
  );
}
