'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
const inputCls = 'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-5 py-3">
        <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function EditFacultyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { canUpdate, loading: permLoading } = useResourcePermissions('faculty');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    Faculty_Name: '', Faculty_Code: '', Married: '', DOB: '', Nationality: '', Faculty_Type: '',
    Office_Tel: '', Res_Tel: '', Mobile: '', EMail: '',
    Present_Address: '', Present_City: '', Present_State: '', Present_Country: '', Present_Pin: '', Present_Tel: '',
    Permanent_Address: '', Permanent_City: '', Permanent_State: '', Permanent_Country: '', Permanent_Pin: '', Permanent_Tel: '',
    Service_Offered: '', Specialization: '', Experience: '', Company_Name: '', Company_Address: '', Company_Phone: '',
    Interview_Date: '', Working_At: '', Qualified: '', Joining_Date: '', Comments: '', Interviewer: '',
    Sal_Struct: '', Salary: '', TDS: '', PAN: '', Resigned: '', InvoiceName: '', CourseId: '', DesignExp: '', KnowSw: '',
    Working_Status: '', TrainingCategory: '', Interview_Status: '', Reference_by: ''
  });

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        const res = await fetch(`/api/masters/faculty/${id}`);
        const data = await res.json();
        if (data.faculty) {
          const f = data.faculty;
          setFormData({
            Faculty_Name: f.Faculty_Name || '',
            Faculty_Code: f.Faculty_Code?.toString() || '',
            Married: f.Married || '',
            DOB: f.DOB || '',
            Nationality: f.Nationality || '',
            Faculty_Type: f.Faculty_Type || '',
            Office_Tel: f.Office_Tel || '',
            Res_Tel: f.Res_Tel || '',
            Mobile: f.Mobile || '',
            EMail: f.EMail || '',
            Present_Address: f.Present_Address || '',
            Present_City: f.Present_City || '',
            Present_State: f.Present_State || '',
            Present_Country: f.Present_Country || '',
            Present_Pin: f.Present_Pin || '',
            Present_Tel: f.Present_Tel || '',
            Permanent_Address: f.Permanent_Address || '',
            Permanent_City: f.Permanent_City || '',
            Permanent_State: f.Permanent_State || '',
            Permanent_Country: f.Permanent_Country || '',
            Permanent_Pin: f.Permanent_Pin || '',
            Permanent_Tel: f.Permanent_Tel || '',
            Service_Offered: f.Service_Offered || '',
            Specialization: f.Specialization || '',
            Experience: f.Experience || '',
            Company_Name: f.Company_Name || '',
            Company_Address: f.Company_Address || '',
            Company_Phone: f.Company_Phone || '',
            Interview_Date: f.Interview_Date || '',
            Working_At: f.Working_At || '',
            Qualified: f.Qualified || '',
            Joining_Date: f.Joining_Date || '',
            Comments: f.Comments || '',
            Interviewer: f.Interviewer || '',
            Sal_Struct: f.Sal_Struct || '',
            Salary: f.Salary?.toString() || '',
            TDS: f.TDS || '',
            PAN: f.PAN || '',
            Resigned: f.Resigned || '',
            InvoiceName: f.InvoiceName || '',
            CourseId: f.CourseId?.toString() || '',
            DesignExp: f.DesignExp?.toString() || '',
            KnowSw: f.KnowSw || '',
            Working_Status: f.Working_Status || '',
            TrainingCategory: f.TrainingCategory || '',
            Interview_Status: f.Interview_Status || '',
            Reference_by: f.Reference_by || ''
          });
        }
      } catch {
        alert('Failed to fetch faculty');
      } finally {
        setLoading(false);
      }
    };
    fetchFaculty();
  }, [id]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.Faculty_Name.trim()) {
      alert('Faculty Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/masters/faculty', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Faculty_Id: id, ...formData }),
      });
      if (res.ok) {
        router.push('/dashboard/masters/faculty');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update');
      }
    } catch {
      alert('Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit faculty." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/dashboard" className="hover:text-[#2E3093]">Dashboard</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <Link href="/dashboard/masters/faculty" className="hover:text-[#2E3093]">Faculty</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-[#2E3093] font-medium">Edit</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Edit Faculty</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <SectionCard title="Basic Information">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Faculty Name *</label>
              <input type="text" value={formData.Faculty_Name} onChange={e => handleChange('Faculty_Name', e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Faculty Code</label>
              <input type="text" value={formData.Faculty_Code} onChange={e => handleChange('Faculty_Code', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Faculty Type</label>
              <input type="text" value={formData.Faculty_Type} onChange={e => handleChange('Faculty_Type', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Married</label>
              <select value={formData.Married} onChange={e => handleChange('Married', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>DOB</label>
              <input type="date" value={formData.DOB} onChange={e => handleChange('DOB', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nationality</label>
              <input type="text" value={formData.Nationality} onChange={e => handleChange('Nationality', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PAN</label>
              <input type="text" value={formData.PAN} onChange={e => handleChange('PAN', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Invoice Name</label>
              <input type="text" value={formData.InvoiceName} onChange={e => handleChange('InvoiceName', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Contact Information */}
        <SectionCard title="Contact Information">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Mobile</label>
              <input type="text" value={formData.Mobile} onChange={e => handleChange('Mobile', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={formData.EMail} onChange={e => handleChange('EMail', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Office Tel</label>
              <input type="text" value={formData.Office_Tel} onChange={e => handleChange('Office_Tel', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Res Tel</label>
              <input type="text" value={formData.Res_Tel} onChange={e => handleChange('Res_Tel', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Present Address */}
        <SectionCard title="Present Address">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Address</label>
              <input type="text" value={formData.Present_Address} onChange={e => handleChange('Present_Address', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input type="text" value={formData.Present_City} onChange={e => handleChange('Present_City', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input type="text" value={formData.Present_State} onChange={e => handleChange('Present_State', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input type="text" value={formData.Present_Country} onChange={e => handleChange('Present_Country', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PIN</label>
              <input type="text" value={formData.Present_Pin} onChange={e => handleChange('Present_Pin', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tel</label>
              <input type="text" value={formData.Present_Tel} onChange={e => handleChange('Present_Tel', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Permanent Address */}
        <SectionCard title="Permanent Address">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Address</label>
              <input type="text" value={formData.Permanent_Address} onChange={e => handleChange('Permanent_Address', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input type="text" value={formData.Permanent_City} onChange={e => handleChange('Permanent_City', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input type="text" value={formData.Permanent_State} onChange={e => handleChange('Permanent_State', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input type="text" value={formData.Permanent_Country} onChange={e => handleChange('Permanent_Country', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PIN</label>
              <input type="text" value={formData.Permanent_Pin} onChange={e => handleChange('Permanent_Pin', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tel</label>
              <input type="text" value={formData.Permanent_Tel} onChange={e => handleChange('Permanent_Tel', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Professional Details */}
        <SectionCard title="Professional Details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Service Offered</label>
              <input type="text" value={formData.Service_Offered} onChange={e => handleChange('Service_Offered', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Specialization</label>
              <input type="text" value={formData.Specialization} onChange={e => handleChange('Specialization', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Experience</label>
              <input type="text" value={formData.Experience} onChange={e => handleChange('Experience', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Design Exp</label>
              <input type="text" value={formData.DesignExp} onChange={e => handleChange('DesignExp', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Known Software</label>
              <input type="text" value={formData.KnowSw} onChange={e => handleChange('KnowSw', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Training Category</label>
              <input type="text" value={formData.TrainingCategory} onChange={e => handleChange('TrainingCategory', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Qualified</label>
              <select value={formData.Qualified} onChange={e => handleChange('Qualified', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Working Status</label>
              <input type="text" value={formData.Working_Status} onChange={e => handleChange('Working_Status', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Company Details */}
        <SectionCard title="Company Details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Company Name</label>
              <input type="text" value={formData.Company_Name} onChange={e => handleChange('Company_Name', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Company Address</label>
              <input type="text" value={formData.Company_Address} onChange={e => handleChange('Company_Address', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Company Phone</label>
              <input type="text" value={formData.Company_Phone} onChange={e => handleChange('Company_Phone', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Working At</label>
              <input type="text" value={formData.Working_At} onChange={e => handleChange('Working_At', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Interview & Joining */}
        <SectionCard title="Interview & Joining">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Interview Date</label>
              <input type="date" value={formData.Interview_Date} onChange={e => handleChange('Interview_Date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Interviewer</label>
              <input type="text" value={formData.Interviewer} onChange={e => handleChange('Interviewer', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Interview Status</label>
              <input type="text" value={formData.Interview_Status} onChange={e => handleChange('Interview_Status', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Joining Date</label>
              <input type="date" value={formData.Joining_Date} onChange={e => handleChange('Joining_Date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Reference By</label>
              <input type="text" value={formData.Reference_by} onChange={e => handleChange('Reference_by', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Resigned</label>
              <select value={formData.Resigned} onChange={e => handleChange('Resigned', e.target.value)} className={inputCls}>
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </SectionCard>

        {/* Salary Details */}
        <SectionCard title="Salary Details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Salary Structure</label>
              <input type="text" value={formData.Sal_Struct} onChange={e => handleChange('Sal_Struct', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Salary</label>
              <input type="number" value={formData.Salary} onChange={e => handleChange('Salary', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>TDS</label>
              <input type="text" value={formData.TDS} onChange={e => handleChange('TDS', e.target.value)} className={inputCls} />
            </div>
          </div>
        </SectionCard>

        {/* Comments */}
        <SectionCard title="Additional Information">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelCls}>Comments</label>
              <textarea value={formData.Comments} onChange={e => handleChange('Comments', e.target.value)} className={`${inputCls} resize-none`} rows={3} />
            </div>
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-50"
          >
            {submitting ? 'Updating...' : 'Update Faculty'}
          </button>
          <Link
            href="/dashboard/masters/faculty"
            className="px-6 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
