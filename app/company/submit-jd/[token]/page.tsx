'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

export default function CompanyJDSubmitPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    Job_Title: '', Job_Description: '', Requirements: '',
    Location: '', Package: '', Min_Percentage: '',
    Max_Backlogs: '0', Application_Deadline: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/company-jd/${token}`);
        const data = await res.json();
        if (res.ok && data.valid) {
          setValid(true);
          setCompanyName(data.company_name || '');
          if (data.already_submitted) {
            setSubmitted(true);
          }
        }
      } catch { /* */ }
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`/api/public/company-jd/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Invalid or Expired Link</h2>
          <p className="text-sm text-gray-500 mt-2">This JD submission link is no longer valid. Please contact the placement cell for assistance.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Thank You!</h2>
          <p className="text-sm text-gray-500 mt-2">Your Job Description has been submitted successfully. The placement cell will review it shortly.</p>
        </div>
      </div>
    );
  }

  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1';
  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const textareaCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 mb-2">
            <Image src="/sit.png" alt="SIT Logo" width={40} height={40} className="w-10 h-10 object-contain" />
            <h1 className="text-xl font-bold text-gray-900">Suvidya Institute of Technology Pvt. Ltd.</h1>
          </div>
          <p className="text-sm text-gray-500">Campus Placement — Job Description Submission</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-6 py-4">
            <h2 className="text-base font-bold text-white">Submit Job Description</h2>
            {companyName && <p className="text-xs text-white/70 mt-0.5">Company: {companyName}</p>}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Job Title <span className="text-red-400">*</span></label>
                <input type="text" value={form.Job_Title} onChange={e => set('Job_Title', e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input type="text" value={form.Location} onChange={e => set('Location', e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Job Description <span className="text-red-400">*</span></label>
              <textarea value={form.Job_Description} onChange={e => set('Job_Description', e.target.value)} rows={6} className={textareaCls}
                placeholder="Describe the role, responsibilities, and expectations..." required />
            </div>

            <div>
              <label className={labelCls}>Requirements / Qualifications</label>
              <textarea value={form.Requirements} onChange={e => set('Requirements', e.target.value)} rows={4} className={textareaCls}
                placeholder="e.g. Skills required, educational qualifications, experience..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>CTC / Package</label>
                <input type="text" value={form.Package} onChange={e => set('Package', e.target.value)} className={inputCls} placeholder="e.g. 4-6 LPA" />
              </div>
              <div>
                <label className={labelCls}>Application Deadline</label>
                <input type="date" value={form.Application_Deadline} onChange={e => set('Application_Deadline', e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Minimum Percentage</label>
                <input type="number" step="0.01" value={form.Min_Percentage} onChange={e => set('Min_Percentage', e.target.value)} className={inputCls} placeholder="e.g. 60" />
              </div>
              <div>
                <label className={labelCls}>Max Backlogs Allowed</label>
                <input type="number" value={form.Max_Backlogs} onChange={e => set('Max_Backlogs', e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] hover:from-[#252780] hover:to-[#235BA0] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-50">
                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                Submit Job Description
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">&copy; {new Date().getFullYear()} Suvidya Institute of Technology Pvt. Ltd. All rights reserved.</p>
      </div>
    </div>
  );
}
