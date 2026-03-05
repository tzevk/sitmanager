'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

/* ---- shared classes ---- */
const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
const selectCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] transition-colors';
const textareaCls =
  'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

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

interface Branch {
  Contact_Person: string;
  Designation: string;
  Branch_Address: string;
  City: string;
  Telephone: string;
  Mobile: string;
  email: string;
}

interface FollowUp {
  Followup_Id?: number;
  Followup_Date: string;
  Contact_Person: string;
  Designation: string;
  Mobile: string;
  email: string;
  Purpose: string;
  Course: string;
  Direct_Line: string;
  Remarks: string;
  added_by_name?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyBranch = (): Branch => ({
  Contact_Person: '', Designation: '', Branch_Address: '', City: '', Telephone: '', Mobile: '', email: '',
});

export default function AddConsultancyPage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('consultancy');
  const [activeTab, setActiveTab] = useState<'details' | 'branches' | 'followups'>('details');

  /* courses for dropdowns */
  const [courses, setCourses] = useState<{ Course_Id: number; Course_Name: string }[]>([]);

  /* ---- consultancy details ---- */
  const [form, setForm] = useState({
    Comp_Name: '', Designation: '', City: '', State: '', Tel: '', Fax: '', Mobile: '',
    Date_Added: today(), Industry: '', Remark: '', Contact_Person: '', Address: '', Pin: '',
    Country: '', EMail: '', Purpose: '', Website: '', Company_Status: '',
    Course_Id1: '', Course_Id2: '', Course_Id3: '', Course_Id4: '', Course_Id5: '', Course_Id6: '',
  });

  /* ---- branches ---- */
  const [branches, setBranches] = useState<Branch[]>([emptyBranch()]);
  const [savedBranches, setSavedBranches] = useState<(Branch & { Branch_Id: number })[]>([]);
  const [branchSearch, setBranchSearch] = useState('');

  /* ---- follow ups ---- */
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [followupSearch, setFollowupSearch] = useState('');
  const [followupForm, setFollowupForm] = useState<FollowUp>({
    Followup_Date: today(), Contact_Person: '', Designation: '', Mobile: '', email: '',
    Purpose: '', Course: '', Direct_Line: '', Remarks: '',
  });

  /* ---- state ---- */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [consultancyId, setConsultancyId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/masters/course?limit=100')
      .then(r => r.json())
      .then(d => setCourses(d.rows ?? []))
      .catch(() => {});
  }, []);

  const handleChange = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  /* ---- Save consultancy details ---- */
  const handleSaveDetails = async () => {
    if (!form.Comp_Name.trim()) { setError('Consultancy name is required'); return; }
    if (!form.Address.trim()) { setError('Address is required'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/masters/consultancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setConsultancyId(data.insertId);
      router.push(`/dashboard/masters/consultancy/edit/${data.insertId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  /* ---- Branch helpers ---- */
  const addBranchRow = () => setBranches(b => [...b, emptyBranch()]);
  const updateBranch = (idx: number, field: keyof Branch, value: string) => {
    setBranches(b => b.map((br, i) => i === idx ? { ...br, [field]: value } : br));
  };
  const removeBranchRow = (idx: number) => setBranches(b => b.filter((_, i) => i !== idx));

  const handleSaveBranches = async () => {
    if (!consultancyId) { setError('Please save consultancy details first'); return; }
    const validBranches = branches.filter(b => b.Contact_Person || b.Branch_Address || b.City);
    if (validBranches.length === 0) { setError('Add at least one branch with data'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/masters/consultancy/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ constId: consultancyId, branches: validBranches }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setBranches([emptyBranch()]);
      fetchBranches();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const fetchBranches = useCallback(async () => {
    if (!consultancyId) return;
    try {
      const params = new URLSearchParams({ constId: String(consultancyId) });
      if (branchSearch) params.set('search', branchSearch);
      const res = await fetch(`/api/masters/consultancy/branches?${params}`);
      const data = await res.json();
      setSavedBranches(data.rows ?? []);
    } catch { /* ignore */ }
  }, [consultancyId, branchSearch]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleDeleteBranch = async (id: number) => {
    if (!confirm('Delete this branch?')) return;
    await fetch(`/api/masters/consultancy/branches?id=${id}`, { method: 'DELETE' });
    fetchBranches();
  };

  /* ---- Follow up helpers ---- */
  const fetchFollowups = useCallback(async () => {
    if (!consultancyId) return;
    try {
      const params = new URLSearchParams({ constId: String(consultancyId) });
      if (followupSearch) params.set('search', followupSearch);
      const res = await fetch(`/api/masters/consultancy/followups?${params}`);
      const data = await res.json();
      setFollowups(data.rows ?? []);
    } catch { /* ignore */ }
  }, [consultancyId, followupSearch]);

  useEffect(() => { fetchFollowups(); }, [fetchFollowups]);

  const handleAddFollowup = async () => {
    if (!consultancyId) { setError('Please save consultancy details first'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/masters/consultancy/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ constId: consultancyId, ...followupForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setFollowupForm({ Followup_Date: today(), Contact_Person: '', Designation: '', Mobile: '', email: '', Purpose: '', Course: '', Direct_Line: '', Remarks: '' });
      fetchFollowups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDeleteFollowup = async (id: number) => {
    if (!confirm('Delete this follow-up?')) return;
    await fetch(`/api/masters/consultancy/followups?id=${id}`, { method: 'DELETE' });
    fetchFollowups();
  };

  const handleExportBranches = () => {
    const headers = ['Contact Person', 'Designation', 'Branch Address', 'City', 'Telephone', 'Mobile', 'Email'];
    const csvRows = savedBranches.map(b => [b.Contact_Person||'', b.Designation||'', b.Branch_Address||'', b.City||'', b.Telephone||'', b.Mobile||'', b.email||'']);
    const csv = [headers.join(','), ...csvRows.map(r => r.map((v: string) => `"${v.replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'branches.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFollowups = () => {
    const headers = ['Date', 'Contact Person', 'Designation', 'Mobile', 'Email', 'Purpose', 'Course', 'Direct Line', 'Remarks', 'Added By'];
    const csvRows = followups.map(f => [f.Followup_Date||'', f.Contact_Person||'', f.Designation||'', f.Mobile||'', f.email||'', f.Purpose||'', f.Course||'', f.Direct_Line||'', f.Remarks||'', f.added_by_name||'']);
    const csv = [headers.join(','), ...csvRows.map(r => r.map((v: string) => `"${v.replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'followups.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to create consultancies." />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/masters/consultancy')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Add Consultancy Master</h2>
            <p className="text-xs text-white/70">Placement &gt; Consultancy Master &gt; Add</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 bg-gray-50/80">
          {(['details', 'branches', 'followups'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === tab
                  ? 'border-[#2E3093] text-[#2E3093] bg-white -mb-px rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'details' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              {tab === 'branches' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}
              {tab === 'followups' && <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>}
              {tab === 'details' ? 'Consultancy Details' : tab === 'branches' ? 'Branches' : 'Follow Ups'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="p-5">
          {/* =============== CONSULTANCY DETAILS TAB =============== */}
          {activeTab === 'details' && (
            <SectionCard title="Consultancy Information" icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 mt-1">
                <div>
                  <label className={labelCls}>Consultancy <span className="text-red-500">*</span></label>
                  <input className={inputCls} value={form.Comp_Name} onChange={e => handleChange('Comp_Name', e.target.value)} placeholder="Consultancy" />
                </div>
                <div>
                  <label className={labelCls}>Designation</label>
                  <input className={inputCls} value={form.Designation} onChange={e => handleChange('Designation', e.target.value)} placeholder="Designation" />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} value={form.City} onChange={e => handleChange('City', e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input className={inputCls} value={form.State} onChange={e => handleChange('State', e.target.value)} placeholder="State" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={form.Tel} onChange={e => handleChange('Tel', e.target.value)} placeholder="Phone" />
                </div>
                <div>
                  <label className={labelCls}>Fax</label>
                  <input className={inputCls} value={form.Fax} onChange={e => handleChange('Fax', e.target.value)} placeholder="Fax" />
                </div>
                <div>
                  <label className={labelCls}>Mobile Nu.</label>
                  <input className={inputCls} value={form.Mobile} onChange={e => handleChange('Mobile', e.target.value)} placeholder="Mobile Nu." />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" className={inputCls} value={form.Date_Added} onChange={e => handleChange('Date_Added', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Industry</label>
                  <select className={selectCls} value={form.Industry} onChange={e => handleChange('Industry', e.target.value)}>
                    <option value="">Select...</option>
                    <option value="IT">IT</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Education">Education</option>
                    <option value="Retail">Retail</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Comment</label>
                  <textarea className={textareaCls} rows={2} value={form.Remark} onChange={e => handleChange('Remark', e.target.value)} placeholder="Comment" />
                </div>
                <div>
                  <label className={labelCls}>Contact Person</label>
                  <input className={inputCls} value={form.Contact_Person} onChange={e => handleChange('Contact_Person', e.target.value)} placeholder="Contact Person" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Address <span className="text-red-500">*</span></label>
                  <input className={inputCls} value={form.Address} onChange={e => handleChange('Address', e.target.value)} placeholder="Address" />
                </div>
                <div>
                  <label className={labelCls}>Pin Code</label>
                  <input className={inputCls} value={form.Pin} onChange={e => handleChange('Pin', e.target.value)} placeholder="Pin Code" />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input className={inputCls} value={form.Country} onChange={e => handleChange('Country', e.target.value)} placeholder="Country" />
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input type="email" className={inputCls} value={form.EMail} onChange={e => handleChange('EMail', e.target.value)} placeholder="E-mail" />
                </div>
                <div>
                  <label className={labelCls}>Purpose</label>
                  <select className={selectCls} value={form.Purpose} onChange={e => handleChange('Purpose', e.target.value)}>
                    <option value="">--Select Purpose--</option>
                    <option value="Placement">Placement</option>
                    <option value="Training">Training</option>
                    <option value="Internship">Internship</option>
                    <option value="Recruitment">Recruitment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <input className={inputCls} value={form.Website} onChange={e => handleChange('Website', e.target.value)} placeholder="Website" />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={selectCls} value={form.Company_Status} onChange={e => handleChange('Company_Status', e.target.value)}>
                    <option value="">--Select--</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Prospect">Prospect</option>
                  </select>
                </div>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <div key={n}>
                    <label className={labelCls}>Course {n}</label>
                    <select className={selectCls} value={form[`Course_Id${n}` as keyof typeof form]} onChange={e => handleChange(`Course_Id${n}`, e.target.value)}>
                      <option value="">--Select Course {n}--</option>
                      {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={handleSaveDetails} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-60">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  Submit
                </button>
              </div>
            </SectionCard>
          )}

          {/* =============== BRANCHES TAB =============== */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              {!consultancyId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                  Please save consultancy details first before adding branches.
                </div>
              )}

              {/* Add Branch Form */}
              <SectionCard title="Add Branches" icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}>
                {branches.map((branch, idx) => (
                  <div key={idx} className={`grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-2 ${idx > 0 ? 'mt-3 pt-3 border-t border-gray-200' : 'mt-1'}`}>
                    <div>
                      <label className={labelCls}>Contact Person</label>
                      <input className={inputCls} value={branch.Contact_Person} onChange={e => updateBranch(idx, 'Contact_Person', e.target.value)} placeholder="Contact Person" />
                    </div>
                    <div>
                      <label className={labelCls}>Designation</label>
                      <input className={inputCls} value={branch.Designation} onChange={e => updateBranch(idx, 'Designation', e.target.value)} placeholder="Designation" />
                    </div>
                    <div>
                      <label className={labelCls}>Branch Address</label>
                      <input className={inputCls} value={branch.Branch_Address} onChange={e => updateBranch(idx, 'Branch_Address', e.target.value)} placeholder="Branch Address" />
                    </div>
                    <div>
                      <label className={labelCls}>City</label>
                      <input className={inputCls} value={branch.City} onChange={e => updateBranch(idx, 'City', e.target.value)} placeholder="City" />
                    </div>
                    <div>
                      <label className={labelCls}>Telephone</label>
                      <input className={inputCls} value={branch.Telephone} onChange={e => updateBranch(idx, 'Telephone', e.target.value)} placeholder="Telephone" />
                    </div>
                    <div>
                      <label className={labelCls}>Mobile</label>
                      <input className={inputCls} value={branch.Mobile} onChange={e => updateBranch(idx, 'Mobile', e.target.value)} placeholder="Mobile" />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input className={inputCls} value={branch.email} onChange={e => updateBranch(idx, 'email', e.target.value)} placeholder="Email" />
                    </div>
                    <div className="flex items-end">
                      {branches.length > 1 && (
                        <button onClick={() => removeBranchRow(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={addBranchRow} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[#2E3093] text-[#2E3093] hover:bg-[#2E3093]/5 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Add More
                  </button>
                  <button onClick={handleSaveBranches} disabled={saving || !consultancyId}
                    className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-60">
                    {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                    Save
                  </button>
                  <button onClick={() => router.push('/dashboard/masters/consultancy')} className="px-4 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                    Close
                  </button>
                </div>
              </SectionCard>

              {/* Saved Branches Table */}
              {consultancyId && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                    <button onClick={handleExportBranches} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                      Export
                    </button>
                    <div className="flex-1" />
                    <div className="relative">
                      <input type="text" placeholder="Search…" value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)}
                        className="w-40 pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                      <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    </div>
                  </div>
                  <div className="overflow-auto max-h-64">
                    <table className="dashboard-table w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10">
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Contact Person</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Designation</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Branch Address</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">City</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Telephone</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Mobile</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Email</th>
                          <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedBranches.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-xs">No branches yet</td></tr>
                        ) : savedBranches.map(b => (
                          <tr key={b.Branch_Id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{b.Contact_Person || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{b.Designation || '-'}</td>
                            <td className="px-3 py-2 text-gray-700 truncate max-w-[150px]">{b.Branch_Address || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{b.City || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{b.Telephone || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{b.Mobile || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{b.email || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => handleDeleteBranch(b.Branch_Id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============== FOLLOW UPS TAB =============== */}
          {activeTab === 'followups' && (
            <div className="space-y-4">
              {!consultancyId && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                  Please save consultancy details first before adding follow-ups.
                </div>
              )}

              {/* Add Follow Up Form */}
              <SectionCard title="View Consultancy Info" icon={<svg className="w-3.5 h-3.5 text-[#2E3093]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 mt-1">
                  <div>
                    <label className={labelCls}>Date</label>
                    <input type="date" className={inputCls} value={followupForm.Followup_Date} onChange={e => setFollowupForm(f => ({ ...f, Followup_Date: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Contact Person</label>
                    <input className={inputCls} value={followupForm.Contact_Person} onChange={e => setFollowupForm(f => ({ ...f, Contact_Person: e.target.value }))} placeholder="Contact Person" />
                  </div>
                  <div>
                    <label className={labelCls}>Designation</label>
                    <input className={inputCls} value={followupForm.Designation} onChange={e => setFollowupForm(f => ({ ...f, Designation: e.target.value }))} placeholder="Designation" />
                  </div>
                  <div>
                    <label className={labelCls}>Mobile</label>
                    <input className={inputCls} value={followupForm.Mobile} onChange={e => setFollowupForm(f => ({ ...f, Mobile: e.target.value }))} placeholder="Mobile" />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input className={inputCls} value={followupForm.email} onChange={e => setFollowupForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                  </div>
                  <div>
                    <label className={labelCls}>Purpose</label>
                    <input className={inputCls} value={followupForm.Purpose} onChange={e => setFollowupForm(f => ({ ...f, Purpose: e.target.value }))} placeholder="Purpose" />
                  </div>
                  <div>
                    <label className={labelCls}>Course</label>
                    <select className={selectCls} value={followupForm.Course} onChange={e => setFollowupForm(f => ({ ...f, Course: e.target.value }))}>
                      <option value="">--Select--</option>
                      {courses.map(c => <option key={c.Course_Id} value={c.Course_Name}>{c.Course_Name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Direct Line</label>
                    <input className={inputCls} value={followupForm.Direct_Line} onChange={e => setFollowupForm(f => ({ ...f, Direct_Line: e.target.value }))} placeholder="Direct Line" />
                  </div>
                  <div>
                    <label className={labelCls}>Remarks</label>
                    <textarea className={textareaCls} rows={1} value={followupForm.Remarks} onChange={e => setFollowupForm(f => ({ ...f, Remarks: e.target.value }))} placeholder="Remarks" />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button onClick={handleAddFollowup} disabled={saving || !consultancyId}
                    className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-60">
                    {saving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
                    Add +
                  </button>
                </div>
              </SectionCard>

              {/* Follow Ups Table */}
              {consultancyId && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                    <button onClick={handleExportFollowups} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                      Export
                    </button>
                    <div className="flex-1" />
                    <div className="relative">
                      <input type="text" placeholder="Search…" value={followupSearch} onChange={(e) => setFollowupSearch(e.target.value)}
                        className="w-40 pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                      <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                    </div>
                  </div>
                  <div className="overflow-auto max-h-72">
                    <table className="dashboard-table w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="bg-gradient-to-r from-[#2E3093]/10 to-[#2A6BB5]/10">
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Date</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Contact Person</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Designation</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Mobile</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Email</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Purpose</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Course</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Direct Line</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Remarks</th>
                          <th className="text-left px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Added By</th>
                          <th className="text-center px-3 py-2 font-semibold text-[#2E3093] border-b whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {followups.length === 0 ? (
                          <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-400 text-xs">No follow-ups yet</td></tr>
                        ) : followups.map(f => (
                          <tr key={f.Followup_Id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{f.Followup_Date ? new Date(f.Followup_Date).toLocaleDateString('en-GB') : '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.Contact_Person || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.Designation || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.Mobile || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.email || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.Purpose || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.Course || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.Direct_Line || '-'}</td>
                            <td className="px-3 py-2 text-gray-700 truncate max-w-[120px]">{f.Remarks || '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{f.added_by_name || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => handleDeleteFollowup(f.Followup_Id!)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
