'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function StudentSigninPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [splash, setSplash] = useState<{ name: string } | null>(null);
  const splashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/student-portal/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sign in failed');
      const name = data.user?.name ?? '';
      sessionStorage.setItem('sit_student_name', name);
      setSplash({ name });
      splashTimer.current = setTimeout(() => router.push('/student-portal/dashboard'), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  if (splash) {
    const initials = splash.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1a1d5e 0%, #2E3093 40%, #2A6BB5 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#FAE452]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center gap-6 animate-[fadeInUp_0.5s_ease_both]">
          {/* Avatar ring */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#FAE452] blur-2xl opacity-30 scale-110" />
            <div className="relative w-32 h-32 rounded-full border-4 border-[#FAE452] bg-[#FAE452] flex items-center justify-center shadow-[0_24px_60px_rgba(250,228,82,0.3)]">
              <span className="text-4xl font-black text-[#2E3093] leading-none">{initials}</span>
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.3em]">Welcome back</p>
            <h1 className="text-3xl font-bold text-white">{splash.name}</h1>
          </div>

          {/* Go to Dashboard button */}
          <button
            onClick={() => {
              if (splashTimer.current) clearTimeout(splashTimer.current);
              router.push('/student-portal/dashboard');
            }}
            className="mt-2 px-6 py-2.5 rounded-2xl bg-[#FAE452] text-[#2E3093] text-sm font-bold shadow-[0_12px_32px_rgba(250,228,82,0.3)] hover:bg-white transition-colors"
          >
            Go to Dashboard →
          </button>

          {/* Loading dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/30"
                style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

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

          <form onSubmit={handleSignIn} className="space-y-5">
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
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#2E3093] focus:outline-none focus:ring-4 focus:ring-[#2E3093]/10 transition-all text-gray-900 placeholder-gray-400 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] hover:from-[#252780] hover:to-[#235BA0] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-[#2E3093]/30 disabled:opacity-60 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
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
