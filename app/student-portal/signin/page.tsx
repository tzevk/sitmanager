'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function StudentSigninPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/student-portal/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      setOtpRequested(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/student-portal/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'OTP verification failed');
      router.push('/student-portal/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden">

      {/* Left — decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#2E3093] via-[#2A6BB5] to-[#2E3093]">
        {/* Glow blobs */}
        <div className="absolute top-16 left-16 w-80 h-80 bg-[#FAE452]/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-16 right-16 w-96 h-96 bg-[#2A6BB5]/30 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-white/5 rounded-full blur-2xl" />

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        {/* Centered logo */}
        <div className="relative z-10 flex items-center justify-center w-full h-full">
          <div className="bg-white rounded-3xl border-4 p-6 shadow-2xl" style={{ borderColor: '#FAE452' }}>
            <Image src="/sit.png" alt="SIT Logo" width={220} height={220} className="w-56 h-56 object-contain" />
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="w-full lg:w-1/2 h-full flex items-center justify-center p-6 bg-white overflow-y-auto">
        <div className="w-full max-w-md">

          {/* Mobile logo (hidden on lg) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <Image src="/sit.png" alt="SIT Logo" width={100} height={100} className="w-24 h-24 object-contain mb-3" />
            <h1 className="text-lg font-bold text-gray-900">Suvidya Institute of Technology</h1>
            <p className="text-xs text-gray-400 mt-0.5">Student Placement Portal</p>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-3xl font-extrabold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your student portal</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={otpRequested ? handleVerifyOtp : handleRequestOtp} className="space-y-5">
            {/* Mobile field */}
            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mobile Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#2E3093] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="Enter your registered mobile"
                  required
                  autoFocus
                  disabled={otpRequested}
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#2E3093] focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 transition-all text-gray-900 placeholder-gray-400 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>

            {otpRequested && (
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  required
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#2E3093] focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 transition-all text-gray-900 placeholder-gray-400 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setOtpRequested(false);
                    setOtp('');
                    setError('');
                  }}
                  className="mt-3 text-xs font-semibold text-[#2E3093] hover:underline"
                >
                  Change mobile
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] hover:from-[#252780] hover:to-[#235BA0] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-[#2E3093]/30 disabled:opacity-60 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {otpRequested ? 'Verifying...' : 'Sending OTP...'}
                </>
              ) : (
                <>
                  {otpRequested ? 'Verify & Sign In' : 'Send OTP'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Need access? Contact the{' '}
            <span className="text-[#2E3093] font-semibold">Placement Cell</span>
          </p>
        </div>
      </div>
    </div>
  );
}
