'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { FaSave, FaTimes } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course {
  Course_Id: number;
  Course_Name: string;
}

interface Consultancy {
  Const_Id: number;
  Comp_Name: string;
  Contact_Person?: string | null;
  Designation?: string | null;
  Mobile?: string | null;
  EMail?: string | null;
}

type Tab = 'details' | 'discussion' | 'followup';

type FollowUpItem = {
  date: string;
  note: string;
};

function toDateInputValue(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  // Accept yyyy-mm-dd or ISO datetime
  const parts = s.split('T');
  return parts[0] || '';
}

export default function EditCorporateInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { canUpdate, loading: permLoading } = useResourcePermissions('corporate_inquiry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [consultancies, setConsultancies] = useState<Consultancy[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [form, setForm] = useState({
    Id: 0,
    Idate: '',
    Course_Id: '',
    Consultancy_Id: '',
    CompanyName: '',
    CompanyAuthority: '',
    FullName: '',
    Designation: '',
    Phone: '',
    Mobile: '',
    Email: '',
    TrainingMode: 'offline' as 'online' | 'offline',
    Participants_Fresher: '',
    Participants_Experienced: '',
    TrainingLocation: '',
    Discussion: '',
    InitialFollowUpDate: '',
    NextFollowUpDate: '',
  });

  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpItem>({ date: '', note: '' });

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      try {
        const [metaRes, inquiryRes] = await Promise.all([
          fetch('/api/admission-activity/corporate-inquiry/meta', { method: 'GET' }),
          fetch(`/api/admission-activity/corporate-inquiry/${id}`, { method: 'GET' }),
        ]);

        const meta = await metaRes.json().catch(() => ({}));
        const inquiryData = await inquiryRes.json().catch(() => ({}));

        if (!alive) return;

        if (metaRes.ok) {
          setCourses(Array.isArray(meta?.courses) ? meta.courses : []);
          setConsultancies(Array.isArray(meta?.consultancies) ? meta.consultancies : []);
        }

        const inq = inquiryData?.inquiry;
        if (inq) {
          const fullName = String(inq?.FullName || inq?.Fname || '').trim();
          const discussion = String(inq?.Discussion ?? inq?.Remark ?? '').trim();
          const followUpRaw = inq?.FollowUp;
          const consultancyId = String(inq?.Consultancy_Id ?? '').trim();
          const companyName = String(inq?.CompanyName ?? '').trim();

          // Parse follow-up JSON if present.
          let parsedInitial = '';
          let parsedNext = '';
          let parsedItems: FollowUpItem[] = [];
          if (typeof followUpRaw === 'string' && followUpRaw.trim()) {
            try {
              const obj = JSON.parse(followUpRaw);
              parsedInitial = String(obj?.initialDate ?? '').trim();
              parsedNext = String(obj?.nextDate ?? '').trim();
              const items = Array.isArray(obj?.items) ? obj.items : [];
              parsedItems = items
                .map((it: any) => ({ date: String(it?.date ?? '').trim(), note: String(it?.note ?? '').trim() }))
                .filter((it: FollowUpItem) => Boolean(it.date || it.note));
            } catch {
              parsedItems = [{ date: '', note: String(followUpRaw).trim() }].filter((it) => Boolean(it.note));
            }
          }

          setForm((prev) => {
            const next = {
              ...prev,
              Id: Number(inq?.Id) || 0,
              Idate: toDateInputValue(inq?.Idate),
              Course_Id: String(inq?.Course_Id ?? ''),
              Consultancy_Id: consultancyId,
              CompanyName: companyName,
              CompanyAuthority: String(inq?.CompanyAuthority ?? '').trim(),
              FullName: fullName,
              Designation: String(inq?.Designation ?? '').trim(),
              Phone: String(inq?.Phone ?? '').trim(),
              Mobile: String(inq?.Mobile ?? '').trim(),
              Email: String(inq?.Email ?? '').trim(),
              TrainingMode: (String(inq?.TrainingMode ?? 'offline').toLowerCase() === 'online' ? 'online' : 'offline') as
                | 'online'
                | 'offline',
              Participants_Fresher: String(inq?.Participants_Fresher ?? ''),
              Participants_Experienced: String(inq?.Participants_Experienced ?? ''),
              TrainingLocation: String(inq?.TrainingLocation ?? inq?.Place ?? '').trim(),
              Discussion: discussion,
              InitialFollowUpDate: String(inq?.InitialFollowUpDate ?? parsedInitial ?? '').trim(),
              NextFollowUpDate: String(inq?.NextFollowUpDate ?? parsedNext ?? '').trim(),
            };
            return next;
          });

          setFollowUps(parsedItems);

          // If we don't have a consultancy id but we have a company name, try to map it.
          if (!consultancyId && companyName) {
            // We'll map after consultancies load via memo below; no-op here.
          }
        }
      } catch (err) {
        console.error(err);
        alert('Failed to load inquiry');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const companyOptions = useMemo(() => {
    return consultancies
      .slice()
      .sort((a, b) => String(a.Comp_Name || '').localeCompare(String(b.Comp_Name || '')));
  }, [consultancies]);

  useEffect(() => {
    // Backfill consultancy selection by company name if possible.
    if (form.Consultancy_Id || !form.CompanyName || companyOptions.length === 0) return;
    const match = companyOptions.find((c) => String(c.Comp_Name || '').trim() === String(form.CompanyName || '').trim());
    if (!match) return;
    setForm((prev) => ({ ...prev, Consultancy_Id: String(match.Const_Id) }));
  }, [companyOptions, form.CompanyName, form.Consultancy_Id]);

  function handleCompanyChange(constId: string) {
    const idNum = Number(constId);
    const selected = companyOptions.find((c) => Number(c.Const_Id) === idNum);
    setForm((prev) => {
      const next: typeof prev = {
        ...prev,
        Consultancy_Id: constId,
        CompanyName: selected?.Comp_Name || '',
      };
      if (!prev.CompanyAuthority?.trim() && selected?.Contact_Person) {
        next.CompanyAuthority = selected.Contact_Person;
      }
      return next;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        FollowUp: JSON.stringify({
          initialDate: form.InitialFollowUpDate || null,
          nextDate: form.NextFollowUpDate || null,
          items: followUps,
        }),
      };
      const res = await fetch('/api/admission-activity/corporate-inquiry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/dashboard/corporate-inquiry');
      } else {
        alert(data.error || 'Failed to update inquiry');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'max-w-[220px] w-full px-2 py-1.5 border-2 border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-xs';
  const labelClass = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1';
  const tabBtn = (isActive: boolean) =>
    isActive
      ? 'px-3 py-1.5 rounded-lg bg-[#2E3093] text-white text-xs font-semibold'
      : 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700';

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit corporate inquiries." />;

  if (loading) {
    return (
      <div className="space-y-4 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Edit Corporate Inquiry</h2>
              <p className="text-sm text-gray-400">Update inquiry details below</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/corporate-inquiry')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-sm shadow-sm transition"
            >
              <FaTimes className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={tabBtn(activeTab === 'details')} onClick={() => setActiveTab('details')}>
              Inquiry Details
            </button>
            <button type="button" className={tabBtn(activeTab === 'discussion')} onClick={() => setActiveTab('discussion')}>
              Discussion
            </button>
            <button type="button" className={tabBtn(activeTab === 'followup')} onClick={() => setActiveTab('followup')}>
              Follow Up
            </button>
          </div>
        </div>

        {activeTab === 'details' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Inquiry Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2 gap-y-2">
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" name="Idate" value={form.Idate} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Training Programme</label>
                <select name="Course_Id" value={form.Course_Id} onChange={handleChange} className={inputClass}>
                  <option value="">Select Programme</option>
                  {courses.map((c) => (
                    <option key={c.Course_Id} value={String(c.Course_Id)}>
                      {c.Course_Name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Company Name</label>
                <select
                  name="Consultancy_Id"
                  value={form.Consultancy_Id}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select Company</option>
                  {companyOptions.map((c) => (
                    <option key={c.Const_Id} value={String(c.Const_Id)}>
                      {c.Comp_Name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Company Authority</label>
                <input
                  type="text"
                  name="CompanyAuthority"
                  value={form.CompanyAuthority}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Last contacted person"
                />
              </div>

              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  name="FullName"
                  value={form.FullName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Contact name"
                />
              </div>

              <div>
                <label className={labelClass}>Position</label>
                <input
                  type="text"
                  name="Designation"
                  value={form.Designation}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Designation"
                />
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input type="email" name="Email" value={form.Email} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mobile</label>
                <input type="text" name="Mobile" value={form.Mobile} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="text" name="Phone" value={form.Phone} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Training Mode</label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-1 text-xs text-gray-700">
                    <input
                      type="radio"
                      name="TrainingMode"
                      value="online"
                      checked={form.TrainingMode === 'online'}
                      onChange={handleChange}
                    />
                    Online
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-700">
                    <input
                      type="radio"
                      name="TrainingMode"
                      value="offline"
                      checked={form.TrainingMode === 'offline'}
                      onChange={handleChange}
                    />
                    Offline
                  </label>
                </div>
              </div>

              <div>
                <label className={labelClass}>Participants (Fresher)</label>
                <input
                  type="number"
                  name="Participants_Fresher"
                  value={form.Participants_Fresher}
                  onChange={handleChange}
                  className={inputClass}
                  min={0}
                />
              </div>
              <div>
                <label className={labelClass}>Participants (Experienced)</label>
                <input
                  type="number"
                  name="Participants_Experienced"
                  value={form.Participants_Experienced}
                  onChange={handleChange}
                  className={inputClass}
                  min={0}
                />
              </div>

              <div>
                <label className={labelClass}>Training Location</label>
                <input
                  type="text"
                  name="TrainingLocation"
                  value={form.TrainingLocation}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Location"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'discussion' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Discussion</h2>
            <label className={labelClass}>Discussion Notes</label>
            <textarea
              name="Discussion"
              value={form.Discussion}
              onChange={handleChange}
              className={'w-full px-2 py-2 border-2 border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-xs'}
              rows={6}
              placeholder="Enter discussion details"
            />
          </div>
        )}

        {activeTab === 'followup' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-[#2A6BB5] mb-4 uppercase">Follow Up</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Initial Follow Up Date</label>
                <input
                  type="date"
                  name="InitialFollowUpDate"
                  value={form.InitialFollowUpDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Next Follow Up Date</label>
                <input
                  type="date"
                  name="NextFollowUpDate"
                  value={form.NextFollowUpDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="text-[12px] font-bold text-gray-800">Add Inline Follow Up</div>
                <div className="text-[11px] text-gray-600">Add entries and they will be saved with the inquiry</div>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-1">
                  <label className={labelClass}>Date</label>
                  <input
                    type="date"
                    value={followUpDraft.date}
                    onChange={(e) => setFollowUpDraft((p) => ({ ...p, date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelClass}>Remark</label>
                  <input
                    type="text"
                    value={followUpDraft.note}
                    onChange={(e) => setFollowUpDraft((p) => ({ ...p, note: e.target.value }))}
                    className={inputClass}
                    placeholder="Follow up remark"
                  />
                </div>
                <div className="sm:col-span-1 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 px-4 py-2 rounded-lg bg-[#2A6BB5] hover:bg-[#2360A0] text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                    disabled={!followUpDraft.date && !followUpDraft.note.trim()}
                    onClick={() => {
                      const item: FollowUpItem = { date: followUpDraft.date, note: followUpDraft.note.trim() };
                      if (!item.date && !item.note) return;
                      setFollowUps((prev) => [...prev, item]);
                      setFollowUpDraft({ date: '', note: '' });
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="min-w-[600px] w-full text-xs">
                  <thead className="bg-white">
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <th className="text-left py-3 px-4 font-semibold">#</th>
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Remark</th>
                      <th className="text-left py-3 px-4 font-semibold w-[120px]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followUps.map((fu, idx) => (
                      <tr key={`${fu.date}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50/40">
                        <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                        <td className="py-3 px-4 text-gray-800">{fu.date || '—'}</td>
                        <td className="py-3 px-4 text-gray-800">{fu.note || '—'}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700"
                            onClick={() => setFollowUps((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {followUps.length === 0 && (
                      <tr>
                        <td className="py-4 px-4 text-gray-500" colSpan={4}>
                          No follow ups added.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#2A6BB5] hover:bg-[#2360A0] text-white rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <FaSave /> {saving ? 'Saving...' : 'Update Inquiry'}
          </button>
        </div>
      </form>
    </div>
  );
}
