'use client';

import { useState } from 'react';

export default function ForceChangePasswordModal({ onDone }: { onDone: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/student-portal/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Failed to change password');
      }
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex justify-center">
      <div className="relative w-full max-w-[480px] lg:max-w-3xl xl:max-w-5xl min-h-screen bg-[#f0f2f8] flex flex-col shadow-2xl">
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex flex-col items-center text-center mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sit.png" alt="SIT" className="h-8 w-auto object-contain mb-3" />
              <h1 className="text-base font-bold text-[#2E3093]">Set a New Password</h1>
              <p className="text-xs text-gray-500 mt-1">
                For your security, please set a new password before continuing.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border-[1.5px] border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border-[1.5px] border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/30 focus:border-[#2E3093] placeholder:text-gray-400"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-lg bg-[#2E3093] hover:bg-[#252773] text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save & Continue'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
