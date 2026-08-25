'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ADS_CONVERSION_ID, ADS_CONVERSION_LABEL } from './tracking-config';

interface Course { Course_Id: number; Course_Name: string }

const QUALIFICATIONS = ['10th', '12th', 'Diploma', 'Graduate', 'Post Graduate', 'Other'];

const BENEFITS = [
  {
    title: 'Industry-Relevant Curriculum',
    body: 'Hands-on training on the same tools and workflows used on live engineering projects.',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Placement Assistance',
    body: '100% placement assistance for Indian students, based on performance and market demand.',
    icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4',
  },
  {
    title: 'Experienced Faculty',
    body: 'Learn from trainers with real design-office and industry experience, not just theory.',
    icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14zm0 0v6',
  },
  {
    title: 'Flexible Payment Plans',
    body: 'Full payment, instalment plans, or a 0% interest loan option — pick what works for you.',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 4.5h16.5a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z',
  },
];

function readUtmContext(): string {
  if (typeof window === 'undefined') return '';
  const p = new URLSearchParams(window.location.search);
  const parts: string[] = [];
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid']) {
    const v = p.get(key);
    if (v) parts.push(`${key}=${v}`);
  }
  return parts.join(' | ');
}

export default function ApplyLandingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    Student_Name: '',
    Present_Mobile: '',
    Email: '',
    Course_Id: '',
    Qualification: '',
    Discipline: '',
    Percentage: '',
    City: '',
  });

  useEffect(() => {
    fetch('/api/public/courses')
      .then((r) => r.json())
      .then((d) => { if (d.success) setCourses(d.courses || []); })
      .catch(() => {});
  }, []);

  // Pre-fill the course from a ?course=<Course_Id> query param, if the ad
  // campaign links to a course-specific landing URL.
  useEffect(() => {
    if (!courses.length) return;
    const courseParam = new URLSearchParams(window.location.search).get('course');
    if (courseParam && courses.some((c) => String(c.Course_Id) === courseParam)) {
      setForm((prev) => (prev.Course_Id ? prev : { ...prev, Course_Id: courseParam }));
    }
  }, [courses]);

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.Student_Name.trim()) return setError('Please enter your full name.');
    if (!/^[0-9]{10}$/.test(form.Present_Mobile.trim())) return setError('Please enter a valid 10-digit mobile number.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email.trim())) return setError('Please enter a valid email address.');
    if (!form.Qualification) return setError('Please select your highest qualification.');
    if (!form.Discipline.trim()) return setError('Please enter your discipline / stream.');
    if (form.Percentage === '' || Number.isNaN(Number(form.Percentage))) return setError('Please enter your percentage or CGPA.');

    setSubmitting(true);
    try {
      const utm = readUtmContext();
      const notesParts = ['Source: Google Ads Landing Page (/apply)'];
      if (form.City.trim()) notesParts.push(`City: ${form.City.trim()}`);
      if (utm) notesParts.push(utm);

      const res = await fetch('/api/public/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Student_Name: form.Student_Name.trim(),
          Present_Mobile: form.Present_Mobile.trim(),
          Email: form.Email.trim(),
          Course_Id: form.Course_Id ? Number(form.Course_Id) : undefined,
          Qualification: form.Qualification,
          Discipline: form.Discipline.trim(),
          Percentage: Number(form.Percentage),
          Discussion: notesParts.join(' | '),
          Inquiry_From: 'Google Ads Landing Page',
          Inquiry_Type: 'Google Ads Leads',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong. Please try again.');

      setSubmitted(true);
      const w = window as unknown as { gtag?: (...args: unknown[]) => void };
      if (typeof w.gtag === 'function' && !ADS_CONVERSION_ID.includes('XXXXXXXXX')) {
        w.gtag('event', 'conversion', { send_to: `${ADS_CONVERSION_ID}/${ADS_CONVERSION_LABEL}` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => document.getElementById('enquiry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Image src="/sit.png" alt="SIT logo" width={40} height={40} className="rounded-lg bg-white/10 p-0.5" />
            <span className="text-white font-bold text-sm sm:text-base leading-tight">Suvidya Institute of Technology</span>
          </div>
          <a
            href="tel:+912226682290"
            className="hidden sm:inline-flex items-center gap-1.5 text-white/90 text-xs font-semibold hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.687.845a11.037 11.037 0 006.105 6.105l.845-1.687a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            (022) 2668 2290
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#2E3093] via-[#2A6BB5] to-[#1e5a9e] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-[#FAE452] text-[#2E3093] text-[11px] font-bold px-3 py-1 rounded-full mb-4">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6 2.3-7.2-6-4.6h7.6z" /></svg>
              25+ Years Training Engineers
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold leading-tight text-balance">
              Build a Career in Engineering Design &amp; Drafting
            </h1>
            <p className="mt-4 text-white/85 text-sm sm:text-base max-w-lg text-pretty">
              Industry-focused training in Piping, HVAC, Structural, Rotating Equipment, Engineering Design
              &amp; Drafting and Software programmes — with placement assistance, at Suvidya Institute of
              Technology, Mumbai.
            </p>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-7 inline-flex items-center gap-2 bg-[#FAE452] text-[#2E3093] font-bold text-sm px-6 py-3 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Get Free Course Guidance
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>

          {/* Enquiry form card */}
          <div id="enquiry-form" className="bg-white rounded-2xl shadow-2xl p-5 sm:p-7 text-gray-900 scroll-mt-6">
            {submitted ? (
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Thank you!</h3>
                <p className="text-sm text-gray-500 mt-1.5">
                  Your enquiry has been received. Our admissions team will call you shortly.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#2E3093]">Get Free Course Guidance</h2>
                <p className="text-xs text-gray-500 mt-0.5 mb-4">Fill in your details — our team will call you back.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <input
                      type="text" placeholder="Full Name *" value={form.Student_Name}
                      onChange={(e) => set('Student_Name', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="tel" placeholder="Mobile Number *" value={form.Present_Mobile}
                      onChange={(e) => set('Present_Mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                    />
                    <input
                      type="text" placeholder="City" value={form.City}
                      onChange={(e) => set('City', e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                    />
                  </div>
                  <input
                    type="email" placeholder="Email Address *" value={form.Email}
                    onChange={(e) => set('Email', e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                  />
                  <select
                    value={form.Course_Id} onChange={(e) => set('Course_Id', e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                  >
                    <option value="">Course Interested In</option>
                    {courses.map((c) => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={form.Qualification} onChange={(e) => set('Qualification', e.target.value)}
                      className="col-span-1 w-full bg-white border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                    >
                      <option value="">Qualification *</option>
                      {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <input
                      type="text" placeholder="Discipline *" value={form.Discipline}
                      onChange={(e) => set('Discipline', e.target.value)}
                      className="col-span-1 w-full bg-white border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                    />
                    <input
                      type="number" placeholder="% / CGPA *" value={form.Percentage}
                      onChange={(e) => set('Percentage', e.target.value)}
                      className="col-span-1 w-full bg-white border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/20 focus:border-[#2A6BB5]"
                    />
                  </div>

                  {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold text-sm py-3 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit Enquiry'}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                    By submitting, you agree to be contacted by SIT regarding admissions.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-2xl font-extrabold text-gray-900 text-center">Why Train With SIT</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="w-11 h-11 rounded-lg bg-[#2E3093]/10 text-[#2E3093] flex items-center justify-center mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={b.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-900">{b.title}</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Courses */}
      {courses.length > 0 && (
        <section className="bg-gray-50 py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-extrabold text-gray-900 text-center">Our Training Programmes</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {courses.map((c) => (
                <button
                  key={c.Course_Id}
                  type="button"
                  onClick={() => { set('Course_Id', String(c.Course_Id)); scrollToForm(); }}
                  className="bg-white border border-gray-200 hover:border-[#2A6BB5] hover:text-[#2A6BB5] rounded-full px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors"
                >
                  {c.Course_Name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-center">
        <p className="text-sm text-gray-500 mb-3">Still have questions? Talk to our admissions team.</p>
        <button
          type="button"
          onClick={scrollToForm}
          className="inline-flex items-center gap-2 bg-[#2E3093] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          Enquire Now
        </button>
      </section>

      {/* Footer */}
      <footer className="bg-[#2E3093] text-white/80 text-center py-5 text-xs">
        <p>enquiry@suvidya.ac.in · (022) 2668 2290</p>
        <p className="mt-1">© {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.</p>
      </footer>
    </div>
  );
}
