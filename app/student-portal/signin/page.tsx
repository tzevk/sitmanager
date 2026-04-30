'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function StudentSigninPage() {
  const router = useRouter();
  const [rollNo, setRollNo] = useState('');
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
        body: JSON.stringify({ rollNo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sign in failed');
      const name = data.user?.name ?? '';
      sessionStorage.setItem('sit_student_name', name);
      setSplash({ name });
      splashTimer.current = setTimeout(() => router.push('/student-portal/dashboard'), 2200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  if (splash) {
    const initials = splash.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#2E3093] px-6">
        <div className="flex flex-col items-center gap-6 text-center" style={{ animation: 'fadeUp 0.4s ease both' }}>
          <div className="w-24 h-24 rounded-2xl bg-[#FAE452] flex items-center justify-center">
            <span className="text-3xl font-black text-[#2E3093]">{initials}</span>
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-[0.25em] font-medium">Welcome back</p>
            <h1 className="text-2xl font-black text-white mt-1">{splash.name}</h1>
          </div>
          <button
            onClick={() => { if (splashTimer.current) clearTimeout(splashTimer.current); router.push('/student-portal/dashboard'); }}
            className="bg-[#FAE452] text-[#2E3093] font-black text-sm px-8 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Enter →
          </button>
        </div>
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#2E3093]">

      {/* Top — branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-10 gap-5">
        <div className="bg-white rounded-2xl p-4 w-20 h-20 flex items-center justify-center">
          <Image src="/sit.png" alt="SIT" width={64} height={64} className="w-16 h-16 object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black text-white leading-tight">Suvidya Institute<br />of Technology</h1>
          <p className="text-[#FAE452] text-xs font-semibold uppercase tracking-[0.2em] mt-2">Student Portal</p>
        </div>
      </div>

      {/* Bottom — form */}
      <div className="bg-[#f0f2f8] rounded-t-3xl px-6 pt-8 pb-10">
        <h2 className="text-2xl font-black text-[#2E3093]">Sign In</h2>
        <p className="text-gray-500 text-sm mt-1 mb-7">Enter your student roll number to continue</p>

        {error && (
          <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Roll Number</label>
            <input
              type="text"
              inputMode="numeric"
              value={rollNo}
              onChange={e => setRollNo(e.target.value)}
              placeholder="e.g. 26011660001"
              required
              autoFocus
              className="w-full px-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-[#2E3093] focus:outline-none text-gray-900 text-base font-medium placeholder-gray-300 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#2E3093] text-white text-sm font-black active:scale-[0.98] transition-transform disabled:opacity-50 mt-1"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : 'Sign In →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          Need access?{' '}
          <span className="text-[#2E3093] font-bold">Contact the Placement Cell</span>
        </p>
      </div>
    </div>
  );
}
