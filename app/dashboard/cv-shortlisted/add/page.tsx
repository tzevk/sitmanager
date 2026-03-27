'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Batch_Id: number | null;
  Batch_Code: string;
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
  Batch_Id: null,
  Batch_Code: '',
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

export default function AddCVShortlistedPage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('cv_shortlisted');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Student picker modal state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [modalBatchId, setModalBatchId] = useState('');
  const [modalStudentsByBatchCode, setModalStudentsByBatchCode] = useState<Record<string, Student[]>>({});
  const [modalSelectedByBatchCode, setModalSelectedByBatchCode] = useState<Record<string, Record<number, boolean>>>({});
  const [modalLoadingBatchCode, setModalLoadingBatchCode] = useState<string | null>(null);

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

  // Fetch batches when course changes
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

  const batchById = useMemo(() => {
    const map = new Map<string, Batch>();
    for (const b of batches) map.set(String(b.Batch_Id), b);
    return map;
  }, [batches]);

  const selectedBatchCodes = useMemo(() => {
    const codes = Array.from(new Set(studentRows.map((r) => r.Batch_Code).filter(Boolean)));
    return codes;
  }, [studentRows]);

  const fetchStudentsForBatchCode = useCallback(async (batchCode: string): Promise<Student[]> => {
    if (!batchCode) return [];
    const res = await fetch(`/api/admission-activity/cv-shortlisted/students?batchCode=${encodeURIComponent(batchCode)}`);
    const data = await res.json();
    return data.students || [];
  }, []);

  const ensureModalStudentsLoaded = useCallback(
    async (batchCode: string) => {
      if (!batchCode) return;
      if (modalStudentsByBatchCode[batchCode]) return;
      setModalLoadingBatchCode(batchCode);
      try {
        const list = await fetchStudentsForBatchCode(batchCode);
        setModalStudentsByBatchCode((prev) => ({ ...prev, [batchCode]: list }));
      } finally {
        setModalLoadingBatchCode((prev) => (prev === batchCode ? null : prev));
      }
    },
    [fetchStudentsForBatchCode, modalStudentsByBatchCode]
  );

  useEffect(() => {
    if (!showStudentModal) return;
    if (!modalBatchId && batches.length > 0) {
      setModalBatchId(String(batches[0].Batch_Id));
    }
  }, [batches, modalBatchId, showStudentModal]);

  useEffect(() => {
    if (!showStudentModal) return;
    const batchCode = batchById.get(modalBatchId)?.Batch_Code || '';
    if (!batchCode) return;
    ensureModalStudentsLoaded(batchCode);
  }, [batchById, ensureModalStudentsLoaded, modalBatchId, showStudentModal]);

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
        setStudentRows([]);
        setModalStudentsByBatchCode({});
        setModalSelectedByBatchCode({});
        setModalBatchId('');
        fetchBatches(value);
      }
      if (name === 'Batch_Id') {
        const batch = batches.find((b) => String(b.Batch_Id) === value);
        updated.Batch_Code = batch?.Batch_Code || '';
      }
      return updated;
    });
  };

  const openStudentModal = async () => {
    if (!form.Course_id) {
      alert('Please select Training first.');
      return;
    }

    if (!batches.length && !loadingBatches) {
      fetchBatches(form.Course_id);
    }

    setModalBatchId(form.Batch_Id || '');
    setShowStudentModal(true);
  };

  const toggleModalStudent = (batchCode: string, studentId: number, checked: boolean) => {
    setModalSelectedByBatchCode((prev) => {
      const nextForBatch = { ...(prev[batchCode] || {}) };
      if (checked) nextForBatch[studentId] = true;
      else delete nextForBatch[studentId];
      return { ...prev, [batchCode]: nextForBatch };
    });
  };

  const setModalSelectAll = (batchCode: string, studentIds: number[], checked: boolean) => {
    setModalSelectedByBatchCode((prev) => {
      if (!checked) {
        const next = { ...prev };
        delete next[batchCode];
        return next;
      }
      const nextForBatch: Record<number, boolean> = {};
      for (const id of studentIds) nextForBatch[id] = true;
      return { ...prev, [batchCode]: nextForBatch };
    });
  };

  const addSelectedStudentsFromModal = () => {
    const existingIds = new Set(studentRows.map((r) => r.Student_Id).filter((x) => x != null));
    const rowsToAdd: StudentRow[] = [];

    for (const [batchCode, selectedMap] of Object.entries(modalSelectedByBatchCode)) {
      const studentList = modalStudentsByBatchCode[batchCode] || [];
      if (!studentList.length) continue;
      const batch = batches.find((b) => b.Batch_Code === batchCode);
      const batchId = batch?.Batch_Id ?? null;

      for (const s of studentList) {
        if (!selectedMap?.[s.Student_Id]) continue;
        if (existingIds.has(s.Student_Id)) continue;
        existingIds.add(s.Student_Id);
        rowsToAdd.push({
          ...emptyStudentRow(),
          Batch_Id: batchId,
          Batch_Code: batchCode,
          Student_Id: s.Student_Id,
          Student_Name: s.Student_Name,
        });
      }
    }

    if (rowsToAdd.length === 0) {
      alert('No new students selected to add.');
      return;
    }

    setStudentRows((prev) => [...prev, ...rowsToAdd]);
    setModalSelectedByBatchCode({});
    setShowStudentModal(false);
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
    if (!form.TDate || !form.Company_Id || !form.Course_id) {
      alert('Please fill all required fields: Date, Company and Training.');
      return;
    }

    const batchIdsFromRows = Array.from(
      new Set(studentRows.map((r) => r.Batch_Id).filter((x): x is number => typeof x === 'number'))
    );

    if (studentRows.length === 0 && !form.Batch_Id) {
      alert('Please select a Batch Code or add students.');
      return;
    }

    setLoading(true);
    try {
      // If rows span multiple batches, create one parent record per batch (backend expects a single Batch_Id per record)
      const batchesToCreate = batchIdsFromRows.length
        ? batchIdsFromRows
        : [Number(form.Batch_Id)];

      for (const batchId of batchesToCreate) {
        const studentsForBatch = batchIdsFromRows.length
          ? studentRows.filter((r) => r.Batch_Id === batchId)
          : studentRows;

        const res = await fetch('/api/admission-activity/cv-shortlisted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            CompanyName: form.CompanyName,
            TDate: form.TDate,
            Course_id: Number(form.Course_id),
            Batch_Id: batchId,
            Company_Id: Number(form.Company_Id),
            students: studentsForBatch.map((r) => ({
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
        if (!data.success) {
          alert(data.error || 'Failed to save');
          setLoading(false);
          return;
        }
      }

      router.push('/dashboard/cv-shortlisted');
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to add CV Shortlisted records." />;

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
                <span className="text-white font-medium">Add</span>
              </div>
              <h1 className="text-lg font-bold text-white">Add CV Shortlisted</h1>
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
            <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
              <div className="grid grid-cols-[160px_14px_1fr] items-center border-b border-gray-200">
                <div className="px-3 py-2 text-xs font-semibold text-gray-600 text-center">Date <span className="text-red-500">*</span></div>
                <div className="px-2 py-2 text-xs font-semibold text-gray-600 text-center">:</div>
                <div className="px-3 py-2">
                  <input type="date" name="TDate" value={form.TDate} onChange={handleChange} className={inputCls} required />
                </div>
              </div>

              <div className="grid grid-cols-[160px_14px_1fr] items-center border-b border-gray-200">
                <div className="px-3 py-2 text-xs font-semibold text-gray-600 text-center">Company Name <span className="text-red-500">*</span></div>
                <div className="px-2 py-2 text-xs font-semibold text-gray-600 text-center">:</div>
                <div className="px-3 py-2">
                  <select name="Company_Id" value={form.Company_Id} onChange={handleChange} className={selectCls} required>
                    <option value="">--Select Company--</option>
                    {companies.map((c) => (
                      <option key={c.Const_Id} value={c.Const_Id}>{c.Comp_Name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-[160px_14px_1fr] items-center border-b border-gray-200">
                <div className="px-3 py-2 text-xs font-semibold text-gray-600 text-center">Training Name <span className="text-red-500">*</span></div>
                <div className="px-2 py-2 text-xs font-semibold text-gray-600 text-center">:</div>
                <div className="px-3 py-2">
                  <select name="Course_id" value={form.Course_id} onChange={handleChange} className={selectCls} required>
                    <option value="">--Select Training--</option>
                    {courses.map((c) => (
                      <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-[160px_14px_1fr] items-center">
                <div className="px-3 py-2 text-xs font-semibold text-gray-600 text-center">Batch Code <span className="text-red-500">*</span></div>
                <div className="px-2 py-2 text-xs font-semibold text-gray-600 text-center">:</div>
                <div className="px-3 py-2 space-y-1">
                  <select
                    name="Batch_Id"
                    value={form.Batch_Id}
                    onChange={handleChange}
                    className={selectCls}
                    required={studentRows.length === 0}
                    disabled={loadingBatches || !form.Course_id}
                  >
                    <option value="">--Select Batch Code--</option>
                    {batches.map((b) => (
                      <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_Code}</option>
                    ))}
                  </select>
                  {loadingBatches && <p className="text-[10px] text-gray-400">Loading batches...</p>}
                  {selectedBatchCodes.length > 0 && (
                    <p className="text-[10px] text-gray-500">Selected: {selectedBatchCodes.join(', ')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <button type="button" onClick={openStudentModal} disabled={!form.Course_id || loadingBatches}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-semibold text-xs shadow hover:shadow-md transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add more Students
              </button>
              <button type="submit" disabled={loading}
                className="flex items-center gap-1.5 px-5 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-md font-semibold text-xs shadow hover:shadow-md transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                {loading ? 'Saving...' : 'Save'}
              </button>
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
                      <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Batch ID</th>
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
                        <td className="px-3 py-1.5 text-gray-600">{row.Batch_Id ?? '-'}</td>
                        <td className="px-3 py-1.5 text-gray-600">{row.Batch_Code || '-'}</td>
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

      {/* Student Picker Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowStudentModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Add Students</h3>
                  <p className="text-xs text-gray-400">Select one or more students (you can switch batches).</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3 overflow-y-auto max-h-[calc(90vh-132px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Batch Code</label>
                  <select
                    value={modalBatchId}
                    onChange={async (e) => {
                      const nextId = e.target.value;
                      setModalBatchId(nextId);
                      const batchCode = batchById.get(nextId)?.Batch_Code || '';
                      if (batchCode) await ensureModalStudentsLoaded(batchCode);
                    }}
                    className={selectCls}
                    disabled={loadingBatches}
                  >
                    <option value="">--Select Batch Code--</option>
                    {batches.map((b) => (
                      <option key={b.Batch_Id} value={b.Batch_Id}>{b.Batch_Code}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="text-[10px] text-gray-400">Selected students</div>
                    <div className="text-xs font-semibold text-gray-700">
                      {Object.values(modalSelectedByBatchCode).reduce((sum, m) => sum + Object.keys(m || {}).length, 0)}
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const activeBatchCode = batchById.get(modalBatchId)?.Batch_Code || '';
                const list = activeBatchCode ? modalStudentsByBatchCode[activeBatchCode] || [] : [];
                const selectedMap = activeBatchCode ? modalSelectedByBatchCode[activeBatchCode] || {} : {};
                const allIds = list.map((s) => s.Student_Id);
                const selectedCount = Object.keys(selectedMap).length;
                const allChecked = list.length > 0 && selectedCount === list.length;

                if (!modalBatchId) {
                  return <div className="text-xs text-gray-500">Select a batch to view students.</div>;
                }

                return (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 border-b border-gray-200">
                      <label className="flex items-center gap-2 text-xs font-semibold text-[#2E3093]">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={(e) => setModalSelectAll(activeBatchCode, allIds, e.target.checked)}
                          className="h-4 w-4"
                        />
                        Select all in {activeBatchCode}
                      </label>
                      {modalLoadingBatchCode === activeBatchCode && (
                        <span className="text-xs text-gray-400">Loading students...</span>
                      )}
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto">
                      {list.length === 0 && modalLoadingBatchCode !== activeBatchCode && (
                        <div className="px-4 py-6 text-center text-xs text-gray-500">No students found for this batch.</div>
                      )}

                      {list.map((s) => (
                        <label key={s.Student_Id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={!!selectedMap[s.Student_Id]}
                            onChange={(e) => toggleModalStudent(activeBatchCode, s.Student_Id, e.target.checked)}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="text-xs font-medium text-gray-900">{s.Student_Name}</div>
                            <div className="text-[10px] text-gray-400">ID: {s.Student_Id}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addSelectedStudentsFromModal}
                className="px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-xs font-semibold transition-colors"
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
