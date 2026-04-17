"use client";

import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const labelCls = 'block text-[11px] font-semibold text-gray-700 mb-1';
const inputCls =
  'w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-400 transition-colors';

export default function PublicStudentIntakeTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countryCode, setCountryCode] = useState('91');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLoading, setCompanyLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setCompanyLoading(true);
    fetch(`/api/public/student-intake/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load company');
        if (!cancelled) setCompanyName(data.companyName || '');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load company');
      })
      .finally(() => {
        if (!cancelled) setCompanyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid link');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const fullPhone = `${countryCode}${phone}`;
      const res = await fetch(`/api/public/student-intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, middleName, lastName, phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit');
      }
      setSuccess('Submitted successfully. We will reach out soon.');
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setCountryCode('91');
      setPhone('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] px-6 py-4 shadow">
        <div className="max-w-3xl mx-auto flex items-center gap-5">
          <div className="flex-shrink-0 w-16 h-16 bg-white rounded-2xl grid place-items-center">
            <Image src="/sit.png" alt="SIT" width={72} height={72} className="object-contain" style={{ width: 'auto', height: 'auto' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Student Intake</h1>
            <p className="text-xs text-white/80">Provide your details to get started</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls} htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  className={inputCls}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="middleName">Middle Name</label>
                <input
                  id="middleName"
                  className={inputCls}
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Middle name (optional)"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  className={inputCls}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="phone">Phone Number</label>
              <div className="flex flex-nowrap items-stretch gap-2">
                <select
                  className={`${inputCls} pr-8 w-[96px] md:w-[120px]`}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  aria-label="Country code"
                >
                  <option value="91">+91 (IN)</option>
                  <option value="1">+1 (US/CA)</option>
                  <option value="44">+44 (UK)</option>
                  <option value="971">+971 (UAE)</option>
                  <option value="61">+61 (AU)</option>
                </select>
                <input
                  id="phone"
                  className={`${inputCls} flex-1 min-w-0`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  inputMode="numeric"
                  pattern="[0-9]{6,12}"
                  required
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Digits only; country code is applied automatically.</p>
            </div>
            <div>
              <label className={labelCls}>Company</label>
              <div className={`${inputCls} bg-gray-50`}>
                {companyLoading ? 'Loading…' : (companyName || '—')}
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{success}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white text-sm font-semibold shadow hover:shadow-md transition disabled:opacity-60"
            >
              {loading ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
