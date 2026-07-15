'use client';

import { useState, useEffect, useCallback } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Course  { Course_Id: number; Course_Name: string; }
interface Batch   { Batch_Id: number; Batch_code: string | null; Category: string | null; Timings: string | null; WhatsApp_Group_Link: string | null; StudentCount: number; }
interface Student { admissionId: number; studentId: number; studentCode: string | null; studentName: string; email: string; admissionDate: string | null; }
interface BatchInfo { Batch_Id: number; Batch_code: string | null; Category: string | null; Timings: string | null; WhatsApp_Group_Link: string | null; Course_Name: string | null; }

interface SendResult { email: string; studentName: string; success: boolean; error?: string; }

const labelCls   = 'block text-[11px] font-semibold text-gray-600 mb-0.5';
const selectCls  = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[16px] text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] transition-colors';
const inputCls   = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[16px] text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';
const textareaCls = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[16px] text-slate-800 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors resize-none';

export default function BatchCommunicationPage() {
  const { canView, loading: permLoading } = useResourcePermissions('annual_batch');

  const [courses,   setCourses]   = useState<Course[]>([]);
  const [batches,   setBatches]   = useState<Batch[]>([]);
  const [students,  setStudents]  = useState<Student[]>([]);
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);

  const [courseId,  setCourseId]  = useState('');
  const [batchId,   setBatchId]   = useState('');
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [totalPages,setTotalPages]= useState(0);
  const LIMIT = 50;

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Email compose
  const [subject,   setSubject]   = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendResults, setSendResults] = useState<{ sent: number; failed: number; results: SendResult[] } | null>(null);
  const [sendError, setSendError] = useState('');

  // Fetch courses on mount
  useEffect(() => {
    fetch('/api/daily-activities/batch-communication')
      .then(r => r.json())
      .then(d => setCourses(d.courses || []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (cId: string, bId: string, pg: number) => {
    if (!cId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ courseId: cId, limit: String(LIMIT), page: String(pg) });
      if (bId) params.set('batchId', bId);
      const res = await fetch(`/api/daily-activities/batch-communication?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setBatches(data.batches || []);
      setStudents(data.students || []);
      setBatchInfo(data.batchInfo || null);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (courseId) {
      setBatchId('');
      setStudents([]);
      setBatchInfo(null);
      setPage(1);
      setSendResults(null);
      fetchData(courseId, '', 1);
    } else {
      setBatches([]);
      setStudents([]);
      setBatchInfo(null);
    }
  }, [courseId, fetchData]);

  useEffect(() => {
    if (batchId) {
      setPage(1);
      setSendResults(null);
      fetchData(courseId, batchId, 1);
    } else {
      setStudents([]);
      setBatchInfo(null);
    }
  }, [batchId, courseId, fetchData]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(courseId, batchId, newPage);
  };

  const handleSendEmail = async () => {
    if (!batchId) { setSendError('Select a batch first'); return; }
    if (!subject.trim()) { setSendError('Subject is required'); return; }
    if (!emailBody.trim()) { setSendError('Message body is required'); return; }
    setSendError('');
    setSending(true);
    setSendResults(null);
    try {
      const res = await fetch('/api/daily-activities/batch-communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: Number(batchId), subject: subject.trim(), body: emailBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Send failed');
      setSendResults({ sent: data.sent, failed: data.failed, results: data.results || [] });
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const studentsWithEmail = students.filter(s => s.email);
  const whatsappLink = batchInfo?.WhatsApp_Group_Link;

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to access Batch Communication." />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-5 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Batch Communication</h2>
            <p className="text-xs text-white/70">Daily Activities &gt; Batch Communication</p>
          </div>
        </div>
      </div>

      {/* Course + Batch selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Select Course <span className="text-red-400">*</span></label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className={selectCls}>
              <option value="">— Select Course —</option>
              {courses.map(c => (
                <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Select Batch <span className="text-red-400">*</span></label>
            <select value={batchId} onChange={e => setBatchId(e.target.value)} disabled={!courseId || batches.length === 0} className={selectCls}>
              <option value="">— Select Batch —</option>
              {batches.map(b => (
                <option key={b.Batch_Id} value={b.Batch_Id}>
                  {[b.Batch_code, b.Category, b.Timings].filter(Boolean).join(' · ')} ({b.StudentCount} students)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
      )}

      {batchId && batchInfo && (
        <>
          {/* Batch info bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3 text-[12px] text-slate-600">
              {batchInfo.Course_Name && (
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#2E3093]">{batchInfo.Course_Name}</span>
                </span>
              )}
              {batchInfo.Batch_code && (
                <span className="px-2 py-0.5 rounded-full bg-[#2E3093]/10 text-[#2E3093] font-semibold">{batchInfo.Batch_code}</span>
              )}
              {batchInfo.Category && <span>{batchInfo.Category}</span>}
              {batchInfo.Timings && <span>{batchInfo.Timings}</span>}
              <span className="text-slate-500">{total} students total · {studentsWithEmail.length} with email (this page)</span>
            </div>

            {/* WhatsApp link */}
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Join WhatsApp Group
              </a>
            ) : (
              <span className="text-[11px] text-slate-400 italic">No WhatsApp group link set for this batch</span>
            )}
          </div>

          {/* Email Compose */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E3093]/7 to-[#2A6BB5]/7 px-4 py-2 border-b border-slate-200">
              <h3 className="text-[13px] font-bold text-[#2E3093] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Email to Batch
              </h3>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className={labelCls}>Subject <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Message <span className="text-red-400">*</span></label>
                <textarea
                  rows={5}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Type your message here..."
                  className={textareaCls}
                />
              </div>

              {sendError && (
                <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">{sendError}</div>
              )}

              {sendResults && (
                <div className={`px-3 py-3 rounded-lg border text-sm ${sendResults.failed === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <p className="font-semibold mb-1">
                    {sendResults.failed === 0
                      ? `All ${sendResults.sent} emails sent successfully!`
                      : `${sendResults.sent} sent, ${sendResults.failed} failed`}
                  </p>
                  {sendResults.results.filter(r => !r.success).length > 0 && (
                    <ul className="text-[12px] space-y-0.5 mt-1">
                      {sendResults.results.filter(r => !r.success).map((r, i) => (
                        <li key={i} className="text-red-600">✗ {r.studentName} ({r.email}): {r.error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEmail}
                  disabled={sending || !subject.trim() || !emailBody.trim()}
                  className="flex items-center gap-2 bg-[#2E3093] hover:bg-[#252780] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  {sending ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send to All ({total} students)
                    </>
                  )}
                </button>
                {(subject || emailBody) && !sending && (
                  <button
                    onClick={() => { setSubject(''); setEmailBody(''); setSendResults(null); setSendError(''); }}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Student List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E3093]/7 to-[#2A6BB5]/7 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-[#2E3093]">
                Students in Batch
                <span className="ml-2 text-[11px] font-normal text-slate-500">({total} total)</span>
              </h3>
              {loading && <div className="w-4 h-4 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">#</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Admission Date</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 text-[13px]">No students found</td>
                    </tr>
                  )}
                  {students.map((s, idx) => (
                    <tr key={s.admissionId} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="px-3 py-2 text-slate-400">{(page - 1) * LIMIT + idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{s.studentName}</td>
                      <td className="px-3 py-2">
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="text-[#2E3093] hover:underline">{s.email}</a>
                        ) : (
                          <span className="text-slate-400 italic">No email</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{s.studentCode || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {s.admissionDate ? new Date(s.admissionDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">
                  Page {page} of {totalPages} · {total} students
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || loading}
                    className="px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ‹ Prev
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {courseId && !batchId && batches.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-400 text-sm">No batches found for this course.</div>
      )}
    </div>
  );
}
