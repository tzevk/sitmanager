'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type PublicInquiryOptions = {
  inquiryTypes: string[];
  courseTypes: string[];
  qualifications: string[];
  disciplines: string[];
  sourceOptions: string[];
};

const labelCls = 'block text-[10px] font-semibold text-slate-700 mb-1';
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 transition-colors';
const selectCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#2E3093] focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 transition-colors';

const OPTIONS: PublicInquiryOptions = {
  inquiryTypes: [
    'Piping Engineering',
    'Mechanical Design of Process Equipment',
    'Process Engineering',
    'Advance Pipe Stress Analysis',
    'Water & Waste Water Engg.',
    'Process Instrumentation & Control',
    'Air Conditioning System Design (HVAC)',
    'Structural Engineering',
    'Electrical System Design',
    'Engineering Design & Drafting',
    'Offshore Engineering',
    'Piping Design & Drafting',
    'Masonry/Carpentry',
    'Autocad - Piping',
    'Others',
    'Health, Safety & Environment in Construction',
    'Pipeline Engineering',
    'Plant Design Management System (PDMS)',
    'Piping Materials',
    'Electrical & Instrumentation Design and Drafting',
  ],
  courseTypes: ['Part time', 'Full Time', 'Corporate Training', 'Weekend Batches', 'Transfer', 'ONLINE'],
  qualifications: [
    'S.S.C.',
    'H.S.C.',
    'BSC',
    'I.T.I.',
    'Diploma',
    'B.E.',
    'M.E.',
    'B. TECH',
    'M.TECH.',
    'P.HD.',
    'OTHERS',
    'Mech. Draughtsman',
    'Electronics',
    'B.A',
    'Civil Draughtsman',
    'Piping Draftsman',
    'B.Com',
    'MSC',
    'Electrical',
    'BE',
  ],
  disciplines: [
    'Commerce',
    'Chemical',
    'Computers',
    'Mechanical',
    'Science',
    'Production',
    'Arts',
    'Electronics & Tele-Communication',
    'Eletrical',
    'Civil',
    'Instrumentation',
    'Petrochemical',
    'Industrial',
    'Automobile',
    'Fabrication',
    'N.C.T.V.T.',
    'Chemistry',
    'M.C.V.C',
    'Refrigeration & Airconditioning',
    'Electrical & Electronics',
  ],
  sourceOptions: ['Website', 'Exhibition', 'Reference', 'TV interview', 'Advertisement', 'Shiksha', 'India Mart', 'Emagister', 'News Paper', 'Ex.student', 'Google', 'Seminar', 'Facebook'],
};

export default function PublicInquiryPage() {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showThankYouModal, setShowThankYouModal] = useState(false);

  const [inquiryAbout, setInquiryAbout] = useState('');
  const [courseType, setCourseType] = useState('');
  const [fullName, setFullName] = useState('');
  const [qualification, setQualification] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [percentage, setPercentage] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatDobInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const parts = [] as string[];
    if (digits.length <= 2) return digits;
    parts.push(digits.slice(0, 2));
    if (digits.length <= 4) {
      parts.push(digits.slice(2));
      return parts.filter(Boolean).join('/');
    }
    parts.push(digits.slice(2, 4));
    parts.push(digits.slice(4));
    return parts.filter(Boolean).join('/');
  };

  const resetForm = () => {
    setInquiryAbout('');
    setCourseType('');
    setFullName('');
    setQualification('');
    setDiscipline('');
    setPercentage('');
    setGender('');
    setDob('');
    setNationality('');
    setMobile('');
    setEmail('');
    setNotes('');
    setSource('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setShowThankYouModal(false);

    try {
      const res = await fetch('/api/public/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Student_Name: fullName,
          Inquiry_Type: 'Online Inquiry',
          Course_Name: inquiryAbout || null,
          Course_Type: courseType || null,
          Course_Id: null,
          Qualification: qualification,
          Discipline: discipline,
          Percentage: percentage ? Number(percentage) : null,
          Sex: gender || null,
          DOB: dob || null,
          Nationality: nationality || null,
          Present_Mobile: mobile,
          Email: email,
          Discussion: notes || null,
          Inquiry_From: source || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to submit enquiry');
      }

      resetForm();
      setShowThankYouModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#edf3f8_100%)] text-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-16 bg-white/70" />
        <div className="absolute -top-28 -right-24 h-80 w-80 rounded-full bg-[#2E3093]/8 blur-3xl" />
        <div className="absolute top-52 -left-28 h-96 w-96 rounded-full bg-[#2A6BB5]/8 blur-3xl" />
      </div>

      <header className="relative border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-none items-center gap-2.5 px-4 py-1.5 sm:px-6 lg:px-8">
          <Image src="/sit.png" alt="Suvidya Institute of Technology" width={80} height={80} className="h-20 w-20 shrink-0 object-contain" priority />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">Enquiry Form</h1>
            <p className="mt-0.5 text-[10px] text-slate-600"><span className="text-red-500">*</span> Mandatory fields</p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-none px-3 py-2 sm:px-5 lg:px-6">
        <section className="flex min-h-0 w-full flex-col border border-slate-200 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.18)]">
          <div className="h-1 w-full bg-gradient-to-r from-[#2E3093] via-[#2A6BB5] to-[#7aa0df]" />
          <div className="border-b border-slate-200 px-4 py-2.5 sm:px-5">
            <h3 className="text-sm font-bold text-slate-900">Public enquiry details</h3>
            <p className="mt-0.5 text-xs text-slate-600">Complete the details below. Mandatory fields are marked with <span className="text-red-500">*</span>.</p>
          </div>

          <div className="min-h-0 flex-1 px-2.5 pt-2.5 pb-4 sm:px-4 sm:pt-4 sm:pb-5 lg:px-4.5 lg:pt-4.5 lg:pb-6">
            <form className="grid h-full min-h-0 gap-2.5 xl:grid-cols-[1.1fr_1fr_0.95fr] xl:auto-rows-min xl:gap-2.5" onSubmit={handleSubmit}>
              <div className="xl:col-span-2 grid gap-2.5 xl:grid-cols-2 xl:gap-2.5 xl:content-start">
                <div>
                  <label className={labelCls}>I visited your site and I need more information about:</label>
                  <select className={selectCls} value={inquiryAbout} onChange={(e) => setInquiryAbout(e.target.value)}>
                    <option value="">Please select</option>
                    {OPTIONS.inquiryTypes.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Course Type:</label>
                  <select className={selectCls} value={courseType} onChange={(e) => setCourseType(e.target.value)}>
                    <option value="">Select</option>
                    {OPTIONS.courseTypes.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="xl:col-span-3 border-y border-slate-200 bg-slate-50/50 px-0 py-2.5">
                <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-[#2E3093] px-1">Fill Personal Details are as follow:</h3>
                <div className="mt-2.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  <div className="md:col-span-2 xl:col-span-3">
                    <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                    <input
                      className={inputCls}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name as you want in your certificate"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Academic Qualification <span className="text-red-500">*</span></label>
                    <select className={selectCls} value={qualification} onChange={(e) => setQualification(e.target.value)} required>
                      <option value="">Please select</option>
                      {OPTIONS.qualifications.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Discipline <span className="text-red-500">*</span></label>
                    <select className={selectCls} value={discipline} onChange={(e) => setDiscipline(e.target.value)} required>
                      <option value="">Please select</option>
                      {OPTIONS.disciplines.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Percentage (%) <span className="text-red-500">*</span></label>
                    <input
                      className={inputCls}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      placeholder="Enter percentage"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Gender</label>
                    <div className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1">
                      {['Male', 'Female'].map((item) => (
                        <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="radio"
                            name="gender"
                            value={item}
                            checked={gender === item}
                            onChange={(e) => setGender(e.target.value)}
                            className="h-4 w-4 accent-[#2E3093]"
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input
                      className={inputCls}
                      value={dob}
                        onChange={(e) => setDob(formatDobInput(e.target.value))}
                      placeholder="dd/mm/yyyy"
                        inputMode="numeric"
                        maxLength={10}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Nationality</label>
                    <input
                      className={inputCls}
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      placeholder="Enter..."
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Mobile Number <span className="text-red-500">*</span></label>
                    <input
                      className={inputCls}
                      type="tel"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="Enter mobile number"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                    <input
                      className={inputCls}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div className="md:col-span-2 xl:col-span-3">
                    <label className={labelCls}>Additional Notes</label>
                    <textarea
                      className={`${inputCls} min-h-[68px] resize-y`}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter any additional notes"
                    />
                  </div>

                  <div className="md:col-span-2 xl:col-span-3">
                    <label className={labelCls}>How they come to know about SIT</label>
                    <select className={selectCls} value={source} onChange={(e) => setSource(e.target.value)}>
                      <option value="">Please select</option>
                      {OPTIONS.sourceOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <div className="xl:col-span-3 space-y-2 px-1">
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              )}

              <div className="xl:col-span-3 flex flex-col gap-1.5 border-t border-slate-200 pt-2.5 sm:flex-row sm:items-center sm:justify-between px-1 pb-1">
                <p className="text-[11px] text-slate-500">Please review the details before submitting.</p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-lg bg-[#2E3093] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#252b7e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Submit Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {showThankYouModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <Image src="/sit.png" alt="SIT" width={72} height={72} className="h-[72px] w-[72px] object-contain" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Thank you for your enquiry</h4>
                <p className="text-xs text-slate-500">Suvidya Institute of Technology</p>
              </div>
            </div>
            <div className="px-5 py-4 text-sm text-slate-700">
              Your enquiry has been submitted successfully. Our team will contact you soon.
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowThankYouModal(false)}
                className="rounded-lg bg-[#2E3093] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#252b7e]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
