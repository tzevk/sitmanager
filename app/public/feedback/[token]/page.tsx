'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

/* ── SIT institute location ──────────────────────────────────────────
   No.18/140, near Vakola, Santacruz East, Mumbai 400055
   ─────────────────────────────────────────────────────────────────── */
const TARGET_LAT = 19.0773;
const TARGET_LNG = 72.8479;
const MAX_DISTANCE_M = 500;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const RATING_LABELS: Record<number, string> = {
  5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Satisfactory', 1: 'Unsatisfactory',
};

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

type GeoState = 'idle' | 'checking' | 'denied' | 'unavailable' | 'timeout' | 'inaccurate' | 'far' | 'ok' | 'unsupported';
type Student = { rollNo: string; studentName: string };

export default function FeedbackPage() {
  const params = useParams();
  const token = params.token as string;

  /* session */
  const [sessionInfo, setSessionInfo] = useState<{ batchName: string; date: string } | null>(null);
  const [tokenError, setTokenError] = useState('');

  /* students */
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  /* geo */
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [distance, setDistance] = useState<number | null>(null);

  /* device fingerprint */
  const [deviceId, setDeviceId] = useState('');

  /* form */
  const [rollNo, setRollNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [rating, setRating] = useState(0);
  const [improvement, setImprovement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  /* 0. Device ID — generate once, persist in localStorage */
  useEffect(() => {
    if (!token) return;
    const lsKey = `sit_fb_submitted_${token}`;
    /* If this device already submitted for this token, show thank-you immediately */
    if (localStorage.getItem(lsKey) === '1') {
      const savedName = localStorage.getItem(`sit_fb_name_${token}`) || '';
      setStudentName(savedName);
      setSubmitted(true);
    }
    /* Persist a stable device UUID */
    let id = localStorage.getItem('sit_device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('sit_device_id', id);
    }
    setDeviceId(id);
  }, [token]);

  /* 1. Validate token */
  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/feedback/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setTokenError(d.error); return; }
        setSessionInfo({ batchName: d.batchName || `Batch #${d.batchId}`, date: d.date });
      })
      .catch(() => setTokenError('Unable to load feedback session.'));
  }, [token]);

  /* 2. Load student list after session info is ready */
  useEffect(() => {
    if (!sessionInfo) return;
    setStudentsLoading(true);
    fetch(`/api/public/feedback/${token}?students=1`)
      .then(r => r.json())
      .then(d => setStudents(d.students ?? []))
      .catch(() => {/* non-critical */})
      .finally(() => setStudentsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo]);

  /* 3. Geolocation — uses watchPosition for Android reliability.
     Android's getCurrentPosition often fires the error callback before GPS
     warms up; watchPosition keeps trying until a fix arrives. */
  const checkLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoState('unsupported'); return; }
    setGeoState('checking');

    let watchId: number | null = null;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      fn();
    };

    // Hard timeout — if no position arrives within 25 s, give up
    const hardTimeout = setTimeout(() => settle(() => setGeoState('timeout')), 25000);

    watchId = navigator.geolocation.watchPosition(
      pos => {
        clearTimeout(hardTimeout);
        // Android 12+ "approximate location" grants yield accuracy ~3 km — detect and reject
        if (pos.coords.accuracy > 2000) {
          settle(() => setGeoState('inaccurate'));
          return;
        }
        const dist = haversineMeters(pos.coords.latitude, pos.coords.longitude, TARGET_LAT, TARGET_LNG);
        setDistance(Math.round(dist));
        settle(() => setGeoState(dist <= MAX_DISTANCE_M ? 'ok' : 'far'));
      },
      err => {
        clearTimeout(hardTimeout);
        if (err.code === 1 /* PERMISSION_DENIED */)  settle(() => setGeoState('denied'));
        else if (err.code === 2 /* POSITION_UNAVAILABLE */) settle(() => setGeoState('unavailable'));
        else /* TIMEOUT */                            settle(() => setGeoState('timeout'));
      },
      // enableHighAccuracy: false = WiFi/cell first (fast, works indoors on Android)
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );
  }, []);

  /* 4. Student picker */
  const handleStudentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setRollNo(val);
    const found = students.find(s => s.rollNo === val);
    setStudentName(found?.studentName ?? '');
    setSubmitError('');
  };

  /* 5. Submit */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNo) { setSubmitError('Please select your roll number.'); return; }
    if (rating < 1) { setSubmitError('Please select a rating.'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/public/feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo, studentName, rating, comments: rating === 1 ? improvement : undefined, deviceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      /* Mark this device as done in localStorage */
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
                <p className="text-[11px] text-gray-500">{fmtDate(sessionInfo.date)}</p>
              </div>

              {/* Thank-you screen */}
              {submitted && (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-800">Thank you, {studentName}!</p>
                  <p className="text-xs text-gray-500 mt-1">Your feedback has been recorded.</p>
                </div>
              )}

              {/* ── Geo gate ─────────────────────────────────────── */}
              {!submitted && geoState !== 'ok' && (
                <div className="p-6 flex flex-col items-center gap-4 text-center">

                  {geoState === 'idle' && (
                    <>
                      <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Location Verification Required</p>
                        <p className="text-xs text-gray-500 mt-1">You must be within <strong>500 metres</strong> of the institute to submit feedback.</p>
                      </div>
                      <button onClick={checkLocation} className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors">
                        Verify My Location
                      </button>
                    </>
                  )}

                  {geoState === 'checking' && (
                    <div className="py-4 flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-500">Detecting your location…</p>
                    </div>
                  )}

                  {geoState === 'denied' && (
                    <>
                      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Location Permission Denied</p>
                        <p className="text-xs text-gray-500 mt-1">Please allow location access in your browser settings and try again.</p>
                      </div>
                      <button onClick={checkLocation} className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors">Try Again</button>
                    </>
                  )}

                  {geoState === 'inaccurate' && (
                    <>
                      <div className="w-14 h-14 rounded-full bg-yellow-50 flex items-center justify-center">
                        <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Precise Location Required</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Your device is sharing only your <strong>approximate</strong> location, which is not accurate enough.
                          In your Android settings, go to <strong>Location → App permissions → Browser → Use precise location</strong> and try again.
                        </p>
                      </div>
                      <button onClick={checkLocation} className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors">Try Again</button>
                    </>
                  )}
                  )}

                  {geoState === 'unavailable' && (
                    <>
                      <div className="w-14 h-14 rounded-full bg-yellow-50 flex items-center justify-center">
                        <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Location Unavailable</p>
                        <p className="text-xs text-gray-500 mt-1">Your device could not determine your position. Enable Wi-Fi or move to a spot with better signal, then try again.</p>
                      </div>
                      <button onClick={checkLocation} className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors">Try Again</button>
                    </>
                  )}

                  {geoState === 'timeout' && (
                    <>
                      <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                        <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Location Timed Out</p>
                        <p className="text-xs text-gray-500 mt-1">Your device took too long to get a GPS fix. Make sure location is on and try again.</p>
                      </div>
                      <button onClick={checkLocation} className="w-full py-2.5 rounded-xl bg-[#2E3093] text-white text-sm font-semibold hover:bg-[#252780] transition-colors">Try Again</button>
                    </>
                  )}

                  {geoState === 'far' && (
                    <>
                      <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                        <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Too Far from Institute</p>
                        <p className="text-xs text-gray-500 mt-1">You are <strong>{distance} m</strong> away. Must be within <strong>500 m</strong>.</p>
                      </div>
                      <button onClick={checkLocation} className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Check Again</button>
                    </>
                  )}

                  {geoState === 'unsupported' && (
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Geolocation Not Supported</p>
                      <p className="text-xs text-gray-500 mt-1">Please use a modern mobile browser.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Feedback form — shown after geo passes ─────── */}
              {!submitted && geoState === 'ok' && (
                <form onSubmit={handleSubmit} className="p-5 space-y-5">

                  {/* Location badge */}
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {distance !== null ? `Location verified — ${distance}m from the institute` : 'Location verified'}
                  </div>

                  {/* Roll number dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                      Select Your Roll Number <span className="text-red-400">*</span>
                    </label>
                    {studentsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin block" />
                        Loading students…
                      </div>
                    ) : (
                      <select
                        value={rollNo}
                        onChange={handleStudentSelect}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      >
                        <option value="">— Select your roll number —</option>
                        {students.map(s => (
                          <option key={s.rollNo} value={s.rollNo}>
                            {s.rollNo} — {s.studentName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Student name (read-only, auto-filled) */}
                  {studentName && (
                    <div className="flex items-center gap-2 text-xs text-[#2E3093] bg-[#2E3093]/5 border border-[#2E3093]/20 rounded-lg px-3 py-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      <span className="font-semibold">{studentName}</span>
                    </div>
                  )}

                  {/* Rating */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Rate Today&apos;s Session <span className="text-red-400">*</span>
                    </label>
                    <div className="space-y-2">
                      {([5, 4, 3, 2, 1] as const).map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            rating === star
                              ? 'bg-[#2E3093] border-[#2E3093] text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-[#2E3093]/40 hover:bg-[#2E3093]/5'
                          }`}
                        >
                          <span className={`text-base font-bold w-5 text-center ${rating === star ? 'text-white' : 'text-[#2E3093]'}`}>{star}</span>
                          <span>{RATING_LABELS[star]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Improvement text — only for Unsatisfactory */}
                  {rating === 1 && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                        How can we improve?
                      </label>
                      <textarea
                        value={improvement}
                        onChange={e => setImprovement(e.target.value)}
                        placeholder="Please share what we can do better…"
                        rows={4}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      />
                    </div>
                  )}

                  {submitError && <p className="text-xs text-red-500">{submitError}</p>}

                  <button
                    type="submit"
                    disabled={submitting || rating < 1 || !rollNo}
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
          This link is valid for 24 hours after attendance is saved.
        </p>
      </div>
    </div>
  );
}
