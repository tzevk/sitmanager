'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const RATING_LABELS: Record<number, string> = {
  5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Satisfactory', 1: 'Unsatisfactory',
};

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtTime(value: string | null | undefined) {
  if (!value) return '';
  const [hh = '00', mm = '00'] = String(value).split(':');
  const hours = Number(hh);
  const minutes = String(mm).padStart(2, '0');
  if (Number.isNaN(hours)) return String(value);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalized = hours % 12 || 12;
  return `${normalized}:${minutes} ${suffix}`;
}

export default function FeedbackPage() {
  const params = useParams();
  const token = params.token as string;

  /* session */
  const [sessionInfo, setSessionInfo] = useState<{
    batchName: string;
    date: string;
    feedbackSession: 'first_half' | 'second_half' | 'combined';
    trainerName: string | null;
    trainerTimeFrom: string | null;
    trainerTimeTo: string | null;
  } | null>(null);
  const [tokenError, setTokenError] = useState('');

  /* device fingerprint */
  const [deviceId, setDeviceId] = useState('');

  /* verify step */
  const [inputRollNo, setInputRollNo]     = useState('');
  const [inputPhone, setInputPhone]       = useState('');
  const [verifying, setVerifying]         = useState(false);
  const [verifyError, setVerifyError]     = useState('');
  const [verified, setVerified]           = useState(false);

  /* identity (set after verify) */
  const [rollNo, setRollNo]           = useState('');
  const [studentName, setStudentName] = useState('');

  /* rating form */
  const [firstHalfRating, setFirstHalfRating] = useState(0);
  const [secondHalfRating, setSecondHalfRating] = useState(0);
  const [firstHalfImprovement, setFirstHalfImprovement] = useState('');
  const [secondHalfImprovement, setSecondHalfImprovement] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submitError, setSubmitError] = useState('');

  const activeSession = sessionInfo?.feedbackSession === 'second_half' ? 'second_half' : 'first_half';
  const activeSessionTitle = activeSession === 'first_half' ? 'First Half' : 'Second Half';
  const activeRating = activeSession === 'first_half' ? firstHalfRating : secondHalfRating;
  const activeImprovement = activeSession === 'first_half' ? firstHalfImprovement : secondHalfImprovement;

  /* 0. Device ID + already-submitted check */
  useEffect(() => {
    if (!token) return;
    if (localStorage.getItem(`sit_fb_submitted_${token}`) === '1') {
      const savedName = localStorage.getItem(`sit_fb_name_${token}`) || '';
      setStudentName(savedName);
      setSubmitted(true);
    }
    let id = localStorage.getItem('sit_device_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('sit_device_id', id); }
    setDeviceId(id);
  }, [token]);

  /* 1. Validate token */
  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/feedback/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setTokenError(d.error); return; }
        setSessionInfo({
          batchName: d.batchName || `Batch #${d.batchId}`,
          date: d.date,
          feedbackSession: d.feedbackSession || 'first_half',
          trainerName: d.trainerName || null,
          trainerTimeFrom: d.trainerTimeFrom || null,
          trainerTimeTo: d.trainerTimeTo || null,
        });
      })
      .catch(() => setTokenError('Unable to load feedback session.'));
  }, [token]);

  /* 2. Verify roll number + phone */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRollNo.trim()) { setVerifyError('Enter your roll number.'); return; }
    if (!inputPhone.trim())  { setVerifyError('Enter your registered phone number.'); return; }
    setVerifying(true);
    setVerifyError('');
    try {
      const res = await fetch(
        `/api/public/feedback/${token}?verify=1&rollNo=${encodeURIComponent(inputRollNo.trim())}&phone=${encodeURIComponent(inputPhone.trim())}`
      );
      const data = await res.json();
      if (!res.ok) { setVerifyError(data.error || 'Verification failed.'); return; }
      setRollNo(data.rollNo);
      setStudentName(data.studentName);
      setVerified(true);
    } catch {
      setVerifyError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  /* 3. Submit feedback */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRating < 1) {
      setSubmitError(`Please select a rating for ${activeSessionTitle.toLowerCase()}.`);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/public/feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollNo,
          studentName,
          rating: activeRating,
          comments: activeRating === 1 ? activeImprovement : undefined,
          deviceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      localStorage.setItem(`sit_fb_submitted_${token}`, '1');
      localStorage.setItem(`sit_fb_name_${token}`, studentName);
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2E3093]/5 via-white to-[#2A6BB5]/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#2E3093] to-[#2A6BB5] flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Session Feedback</h1>
          <p className="text-xs text-gray-500 mt-0.5">Suvidya Institute of Technology</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

          {/* Token error */}
          {tokenError && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">{tokenError}</p>
            </div>
          )}

          {/* Initial loading */}
          {!tokenError && !sessionInfo && (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {sessionInfo && !tokenError && (
            <>
              {/* Session banner */}
              <div className="bg-gradient-to-r from-[#2E3093]/5 to-[#2A6BB5]/5 px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-[#2E3093]">{sessionInfo.batchName}</p>
                <div className="mt-0.5 space-y-0.5 text-[11px] text-gray-500">
                  <p>{fmtDate(sessionInfo.date)}</p>
                  <p>Feedback Window: <span className="font-semibold text-gray-700">{activeSessionTitle}</span></p>
                  {sessionInfo.trainerName && (
                    <p>Trainer: <span className="font-semibold text-gray-700">{sessionInfo.trainerName}</span></p>
                  )}
                  {(sessionInfo.trainerTimeFrom || sessionInfo.trainerTimeTo) && (
                    <p>
                      Time Allotted:{' '}
                      <span className="font-semibold text-gray-700">
                        {fmtTime(sessionInfo.trainerTimeFrom) || '—'}
                        {sessionInfo.trainerTimeFrom || sessionInfo.trainerTimeTo ? ' - ' : ''}
                        {fmtTime(sessionInfo.trainerTimeTo) || '—'}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Thank-you screen */}
              {submitted && (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-800">Thank you{studentName ? `, ${studentName}` : ''}!</p>
                  <p className="text-xs text-gray-500 mt-1">Your feedback has been recorded.</p>
                </div>
              )}

              {/* Step 1 — verify identity */}
              {!submitted && !verified && (
                <form onSubmit={handleVerify} className="p-5 space-y-4">
                  <p className="text-xs text-gray-500">Enter your roll number and registered phone number to verify your identity.</p>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                      Roll Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={inputRollNo}
                      onChange={e => { setInputRollNo(e.target.value); setVerifyError(''); }}
                      placeholder="e.g. 1234"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                      Registered Phone Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={inputPhone}
                      onChange={e => { setInputPhone(e.target.value); setVerifyError(''); }}
                      placeholder="10-digit mobile number"
                      maxLength={15}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                    />
                  </div>

                  {verifyError && (
                    <p className="text-xs text-red-500 flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {verifyError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors disabled:opacity-50"
                  >
                    {verifying ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying…
                      </span>
                    ) : 'Verify & Continue'}
                  </button>
                </form>
              )}

              {/* Step 2 — rating form */}
              {!submitted && verified && (
                <form onSubmit={handleSubmit} className="p-5 space-y-5">

                  {/* Verified identity badge */}
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><span className="font-semibold">{studentName}</span> — Roll No. {rollNo}</span>
                  </div>

                  <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      {activeSessionTitle} Rating <span className="text-red-400">*</span>
                    </label>
                    <div className="space-y-2">
                      {([5, 4, 3, 2, 1] as const).map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => activeSession === 'first_half' ? setFirstHalfRating(star) : setSecondHalfRating(star)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            activeRating === star
                              ? 'bg-[#2E3093] border-[#2E3093] text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-[#2E3093]/40 hover:bg-[#2E3093]/5'
                          }`}
                        >
                          <span className={`text-base font-bold w-5 text-center ${activeRating === star ? 'text-white' : 'text-[#2E3093]'}`}>{star}</span>
                          <span>{RATING_LABELS[star]}</span>
                        </button>
                      ))}
                    </div>

                    {activeRating === 1 && (
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                          How can we improve {activeSessionTitle.toLowerCase()}?
                        </label>
                        <textarea
                          value={activeImprovement}
                          onChange={e => activeSession === 'first_half' ? setFirstHalfImprovement(e.target.value) : setSecondHalfImprovement(e.target.value)}
                          placeholder="Please share what we can do better…"
                          rows={4}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                        />
                      </div>
                    )}
                  </div>

                  {submitError && <p className="text-xs text-red-500">{submitError}</p>}

                  <button
                    type="submit"
                    disabled={submitting || activeRating < 1}
                    className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting…
                      </span>
                    ) : 'Submit Feedback'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          Students marked present or late today can submit feedback.
        </p>
      </div>
    </div>
  );
}

