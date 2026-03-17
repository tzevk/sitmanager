'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface EmailDraft {
  Email_Id: number;
  Company_Name: string;
  Company_Email: string;
  Subject: string;
  Body: string;
  Job_Submission_Link: string;
  Status: string;
  Created_Date: string;
}

export default function EmailCompanyPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    Company_Name: '', Company_Email: '', Subject: '', Body: '', Job_Id: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/placement/email-company');
      const data = await res.json();
      setDrafts(data.emails ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/placement/email-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSuccess('Draft saved! JD submission link: ' + data.submission_link);
      setForm({ Company_Name: '', Company_Email: '', Subject: '', Body: '', Job_Id: '' });
      fetchDrafts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
  const inputCls = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';
  const textareaCls = 'w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors resize-none';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/dashboard/placement')}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Email Company</h2>
            <p className="text-xs text-white/70">Compose emails with JD submission links</p>
          </div>
          <button onClick={() => setShowComposer(!showComposer)}
            className="ml-auto px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {showComposer
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />}
            </svg>
            {showComposer ? 'Close' : 'Compose Email'}
          </button>
        </div>
      </div>

      {/* Composer */}
      {showComposer && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-bold text-[#2E3093] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              New Email
            </h3>
          </div>
          <form onSubmit={handleSaveDraft} className="p-4 space-y-3">
            {error && <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-600 font-medium">{error}</div>}
            {success && <div className="px-3 py-2 rounded-md bg-green-50 border border-green-200 text-xs text-green-700 font-medium">{success}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Company Name</label><input type="text" value={form.Company_Name} onChange={e => set('Company_Name', e.target.value)} className={inputCls} required /></div>
              <div><label className={labelCls}>Company Email</label><input type="email" value={form.Company_Email} onChange={e => set('Company_Email', e.target.value)} className={inputCls} required /></div>
            </div>

            <div>
              <label className={labelCls}>Subject</label>
              <input type="text" value={form.Subject} onChange={e => set('Subject', e.target.value)} className={inputCls}
                placeholder="e.g. Campus Placement — Submit Job Description" required />
            </div>

            <div>
              <label className={labelCls}>Email Body</label>
              <textarea value={form.Body} onChange={e => set('Body', e.target.value)} rows={10} className={textareaCls}
                placeholder={`Dear Sir/Madam,\n\nGreetings from Suvidya Institute of Technology Pvt. Ltd.!\n\nWe would like to invite your esteemed organization for campus placement. Please submit your Job Description using the link below:\n\n[A unique JD submission link will be auto-generated]\n\nWe look forward to a fruitful association.\n\nRegards,\nPlacement Cell, SIT`} />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-amber-700">Email sending not implemented yet</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Saving this will create a draft and generate a unique JD submission link. You can copy the link and send it manually via your email client.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-1.5 rounded text-xs font-semibold transition-all shadow-md disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                Save Draft & Generate Link
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Drafts list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-700">Email History</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No emails composed yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {drafts.map(d => (
              <div key={d.Email_Id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">{d.Company_Name}</div>
                    <div className="text-[11px] text-gray-500">{d.Company_Email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${d.Status === 'Sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {d.Status}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(d.Created_Date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="mt-1">
                  <p className="text-xs text-gray-700 font-medium">{d.Subject}</p>
                </div>
                {d.Job_Submission_Link && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">JD Link:</span>
                    <code className="text-[11px] bg-gray-100 px-2 py-0.5 rounded text-[#2E3093] font-mono break-all">{d.Job_Submission_Link}</code>
                    <button onClick={() => { navigator.clipboard.writeText(d.Job_Submission_Link); }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold shrink-0">Copy</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
