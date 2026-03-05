'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5';
const inputCls = 'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700 placeholder:text-gray-300';
const selectCls = 'max-w-[220px] w-full border-2 border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E3093]/20 focus:border-[#2E3093] text-gray-700';

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { canUpdate, loading: permLoading } = useResourcePermissions('employee');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    Emp_Id: 0, Emp_Code: '', UserId: '', UserPswd: '', FName: '', MName: '', LName: '', Employee_Name: '',
    Designation: '', Emp_Type: '', Dept_Id: '', DOB: '', Gender: '', Married: '', Nationality: '',
    Joining_Date: '', Present_Status: '', EMail: '', OfficialEmail: '', Present_Mobile: '',
    Present_Address: '', Present_City: '', Present_Pin: '', Present_State: '', Present_Country: '', Present_Tel: '',
    Permanent_Address: '', Permanent_City: '', Permanent_Pin: '', Permanent_State: '', Permanent_Country: '', Permanent_Tel: '',
    PAN: '', PFNo: '', Basic_Salary: '', IsActive: 1
  });

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await fetch(`/api/masters/employee/${id}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        const formatDate = (d: string | null) => {
          if (!d) return '';
          const date = new Date(d);
          return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
        };
        
        setFormData({
          Emp_Id: data.Emp_Id || 0,
          Emp_Code: data.Emp_Code || '',
          UserId: data.UserId || '',
          UserPswd: data.UserPswd || '',
          FName: data.FName || '',
          MName: data.MName || '',
          LName: data.LName || '',
          Employee_Name: data.Employee_Name || '',
          Designation: data.Designation || '',
          Emp_Type: data.Emp_Type || '',
          Dept_Id: data.Dept_Id || '',
          DOB: formatDate(data.DOB),
          Gender: data.Gender || '',
          Married: data.Married || '',
          Nationality: data.Nationality || '',
          Joining_Date: formatDate(data.Joining_Date),
          Present_Status: data.Present_Status || '',
          EMail: data.EMail || '',
          OfficialEmail: data.OfficialEmail || '',
          Present_Mobile: data.Present_Mobile || '',
          Present_Address: data.Present_Address || '',
          Present_City: data.Present_City || '',
          Present_Pin: data.Present_Pin || '',
          Present_State: data.Present_State || '',
          Present_Country: data.Present_Country || '',
          Present_Tel: data.Present_Tel || '',
          Permanent_Address: data.Permanent_Address || '',
          Permanent_City: data.Permanent_City || '',
          Permanent_Pin: data.Permanent_Pin || '',
          Permanent_State: data.Permanent_State || '',
          Permanent_Country: data.Permanent_Country || '',
          Permanent_Tel: data.Permanent_Tel || '',
          PAN: data.PAN || '',
          PFNo: data.PFNo || '',
          Basic_Salary: data.Basic_Salary || '',
          IsActive: data.IsActive ?? 1
        });
      } catch {
        alert('Failed to load employee');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.Employee_Name.trim()) {
      alert('Employee Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/masters/employee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push('/dashboard/masters/employee');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save');
      }
    } catch {
      alert('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (permLoading) return <PermissionLoading />;
  if (!canUpdate) return <AccessDenied message="You do not have permission to edit employees." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span>Dashboard</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span>Masters</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <button onClick={() => router.push('/dashboard/masters/employee')} className="hover:text-[#2E3093]">
            Employee
          </button>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-[#2E3093] font-medium">Edit</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Edit Employee</h1>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-4 py-2">
          <h3 className="text-xs font-bold text-white tracking-wide">Employee Details</h3>
        </div>
        <form onSubmit={handleSubmit} className="px-3 py-2">
          {/* Basic Information */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-2 pb-1 border-b">Basic Information</h4>
            <div className="grid grid-cols-4 gap-x-3 gap-y-2">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Employee Code</label>
                <input type="text" value={formData.Emp_Code} onChange={(e) => handleChange('Emp_Code', e.target.value)} className={inputCls} placeholder="Code" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>User ID</label>
                <input type="text" value={formData.UserId} onChange={(e) => handleChange('UserId', e.target.value)} className={inputCls} placeholder="User ID" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Password</label>
                <input type="password" value={formData.UserPswd} onChange={(e) => handleChange('UserPswd', e.target.value)} className={inputCls} placeholder="Password" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Employee Name *</label>
                <input type="text" value={formData.Employee_Name} onChange={(e) => handleChange('Employee_Name', e.target.value)} className={inputCls} placeholder="Full Name" required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>First Name</label>
                <input type="text" value={formData.FName} onChange={(e) => handleChange('FName', e.target.value)} className={inputCls} placeholder="First Name" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Middle Name</label>
                <input type="text" value={formData.MName} onChange={(e) => handleChange('MName', e.target.value)} className={inputCls} placeholder="Middle Name" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Last Name</label>
                <input type="text" value={formData.LName} onChange={(e) => handleChange('LName', e.target.value)} className={inputCls} placeholder="Last Name" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Designation</label>
                <input type="text" value={formData.Designation} onChange={(e) => handleChange('Designation', e.target.value)} className={inputCls} placeholder="Designation" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Category/Type</label>
                <input type="text" value={formData.Emp_Type} onChange={(e) => handleChange('Emp_Type', e.target.value)} className={inputCls} placeholder="Type" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Department ID</label>
                <input type="text" value={formData.Dept_Id} onChange={(e) => handleChange('Dept_Id', e.target.value)} className={inputCls} placeholder="Dept ID" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>DOB</label>
                <input type="date" value={formData.DOB} onChange={(e) => handleChange('DOB', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Gender</label>
                <select value={formData.Gender} onChange={(e) => handleChange('Gender', e.target.value)} className={selectCls}>
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Marital Status</label>
                <select value={formData.Married} onChange={(e) => handleChange('Married', e.target.value)} className={selectCls}>
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Nationality</label>
                <input type="text" value={formData.Nationality} onChange={(e) => handleChange('Nationality', e.target.value)} className={inputCls} placeholder="Nationality" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Joining Date</label>
                <input type="date" value={formData.Joining_Date} onChange={(e) => handleChange('Joining_Date', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Present Status</label>
                <input type="text" value={formData.Present_Status} onChange={(e) => handleChange('Present_Status', e.target.value)} className={inputCls} placeholder="Status" />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-2 pb-1 border-b">Contact Information</h4>
            <div className="grid grid-cols-4 gap-x-3 gap-y-2">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Email</label>
                <input type="email" value={formData.EMail} onChange={(e) => handleChange('EMail', e.target.value)} className={inputCls} placeholder="Email" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Official Email</label>
                <input type="email" value={formData.OfficialEmail} onChange={(e) => handleChange('OfficialEmail', e.target.value)} className={inputCls} placeholder="Official Email" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Mobile</label>
                <input type="text" value={formData.Present_Mobile} onChange={(e) => handleChange('Present_Mobile', e.target.value)} className={inputCls} placeholder="Mobile" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Telephone</label>
                <input type="text" value={formData.Present_Tel} onChange={(e) => handleChange('Present_Tel', e.target.value)} className={inputCls} placeholder="Telephone" />
              </div>
            </div>
          </div>

          {/* Present Address */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-2 pb-1 border-b">Present Address</h4>
            <div className="grid grid-cols-4 gap-x-3 gap-y-2">
              <div className="col-span-4 sm:col-span-2">
                <label className={labelCls}>Address</label>
                <input type="text" value={formData.Present_Address} onChange={(e) => handleChange('Present_Address', e.target.value)} className={inputCls} placeholder="Address" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>City</label>
                <input type="text" value={formData.Present_City} onChange={(e) => handleChange('Present_City', e.target.value)} className={inputCls} placeholder="City" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>PIN</label>
                <input type="text" value={formData.Present_Pin} onChange={(e) => handleChange('Present_Pin', e.target.value)} className={inputCls} placeholder="PIN" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>State</label>
                <input type="text" value={formData.Present_State} onChange={(e) => handleChange('Present_State', e.target.value)} className={inputCls} placeholder="State" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Country</label>
                <input type="text" value={formData.Present_Country} onChange={(e) => handleChange('Present_Country', e.target.value)} className={inputCls} placeholder="Country" />
              </div>
            </div>
          </div>

          {/* Permanent Address */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-2 pb-1 border-b">Permanent Address</h4>
            <div className="grid grid-cols-4 gap-x-3 gap-y-2">
              <div className="col-span-4 sm:col-span-2">
                <label className={labelCls}>Address</label>
                <input type="text" value={formData.Permanent_Address} onChange={(e) => handleChange('Permanent_Address', e.target.value)} className={inputCls} placeholder="Address" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>City</label>
                <input type="text" value={formData.Permanent_City} onChange={(e) => handleChange('Permanent_City', e.target.value)} className={inputCls} placeholder="City" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>PIN</label>
                <input type="text" value={formData.Permanent_Pin} onChange={(e) => handleChange('Permanent_Pin', e.target.value)} className={inputCls} placeholder="PIN" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>State</label>
                <input type="text" value={formData.Permanent_State} onChange={(e) => handleChange('Permanent_State', e.target.value)} className={inputCls} placeholder="State" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Country</label>
                <input type="text" value={formData.Permanent_Country} onChange={(e) => handleChange('Permanent_Country', e.target.value)} className={inputCls} placeholder="Country" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Telephone</label>
                <input type="text" value={formData.Permanent_Tel} onChange={(e) => handleChange('Permanent_Tel', e.target.value)} className={inputCls} placeholder="Telephone" />
              </div>
            </div>
          </div>

          {/* Other Information */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-2 pb-1 border-b">Other Information</h4>
            <div className="grid grid-cols-4 gap-x-3 gap-y-2">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>PAN Number</label>
                <input type="text" value={formData.PAN} onChange={(e) => handleChange('PAN', e.target.value)} className={inputCls} placeholder="PAN" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>PF Number</label>
                <input type="text" value={formData.PFNo} onChange={(e) => handleChange('PFNo', e.target.value)} className={inputCls} placeholder="PF No" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Basic Salary</label>
                <input type="number" value={formData.Basic_Salary} onChange={(e) => handleChange('Basic_Salary', e.target.value)} className={inputCls} placeholder="Salary" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Status</label>
                <label className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={formData.IsActive === 1}
                    onChange={(e) => handleChange('IsActive', e.target.checked ? 1 : 0)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#2E3093] focus:ring-[#2E3093]"
                  />
                  <span className="text-xs text-gray-600">Active</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 mt-3 border-t">
            <button
              type="button"
              onClick={() => router.push('/dashboard/masters/employee')}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-xs font-semibold rounded shadow hover:shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
