'use client';

import { useEffect, useRef, useState } from 'react';
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
    title: 'Career Support',
    body: 'Guidance and industry connections to help you move from training into the job market.',
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

const STATS = [
  { value: 18000, suffix: '+', label: 'Students Trained', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14zm0 0v6' },
  { value: 650,   suffix: '+', label: 'Successful Batches', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { value: 250,   suffix: '+', label: 'Corporate Trainings', icon: 'M3 21h18M5 21V7l8-4v18M13 21V11l6 3v7M9 9h.01M9 12h.01M9 15h.01' },
  { value: 25,    suffix: '+', label: 'Years of Excellence', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const BASE = 'https://suvidya.ac.in/inquire-now/images/';
const PROGRAMMES = [
  { name: 'Piping Engineering',                      img: `${BASE}piping-engineering.jpg` },
  { name: 'Mechanical Design of Process Equipment',  img: `${BASE}mechanical-design.png` },
  { name: 'Process Engineering',                     img: `${BASE}process-engineering.png` },
  { name: 'Advance Pipe Stress Analysis',            img: `${BASE}advance-pipe-stress.jpg` },
  { name: 'Water & Waste Water Engineering',         img: `${BASE}water-waste_water-engineering.jpg` },
  { name: 'Process Instrumentation and Control',     img: `${BASE}process-instrumentation-control.png` },
  { name: 'Air Conditioning System Design',          img: `${BASE}air-conditioning.png` },
  { name: 'Structural Engineering',                  img: `${BASE}structural-engineering.png` },
  { name: 'Electrical System Designing',             img: `${BASE}electrical-system-design.jpg` },
  { name: 'MEP (Mechanical, Electrical, Plumbing)',  img: `${BASE}MEP-engineering.png` },
  { name: 'Rotating Equipment',                      img: `${BASE}rotating-equipment.png` },
  { name: 'HSE in Construction',                     img: `${BASE}hse-in-construction.jpg` },
  { name: 'Piping Design and Drafting',              img: `${BASE}piping-design-drafting.jpg` },
  { name: 'Engineering Design & Drafting',           img: `${BASE}engineering-design-drafting.jpg` },
  { name: 'HAVC Design and Drafting',                img: `${BASE}HVAC-design-drafting.jpg` },
  { name: 'Civil and Structural Drafting',           img: `${BASE}civil-structural-engineering.jpg` },
  { name: 'Solar PV Power System with Renewable Energy', img: `${BASE}solar.jpg` },
  { name: 'PDMS (Plant Design Management System)',   img: `${BASE}PDMS.jpg` },
  { name: 'Offshore Engineering',                    img: `${BASE}Offshore-Engineering.jpg` },
  { name: 'Process Equipment Fabrication Engineering', img: `${BASE}equipment-fabrication.jpg` },
  { name: 'Fundamentals Of Offshore',               img: `${BASE}Offshore-Engineering.jpg` },
  { name: 'Fire Alarm and Protection System',        img: `${BASE}Fire-Alarm.jpg` },
  { name: 'E3D',                                     img: `${BASE}E3D.jpg` },
  { name: 'PV Elite',                                img: `${BASE}PV-Elite.jpg` },
];

const FORM_ICONS: Record<string, string> = {
  name: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  phone: 'M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.687.845a11.037 11.037 0 006.105 6.105l.845-1.687a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  city: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  course: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  qualification: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14z',
  discipline: 'M9.75 17L15.75 7m0 0h-4.5m4.5 0v4.5M6 21h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z',
  percentage: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z',
};

function FieldIcon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

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

// ─── Animated counter ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);

  return { count, ref };
}

function StatCard({ value, suffix, label, icon }: { value: number; suffix: string; label: string; icon: string }) {
  const { count, ref } = useCountUp(value);
  return (
    <div ref={ref} className="flex items-center gap-3 justify-center lg:justify-start">
      <div className="w-10 h-10 rounded-full bg-[#2E3093]/10 text-[#2E3093] flex items-center justify-center shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <div className="text-lg sm:text-xl font-extrabold text-gray-900 leading-none tabular-nums">
          {count.toLocaleString()}{suffix}
        </div>
        <div className="text-[11px] sm:text-xs text-gray-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="bg-white rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-md flex items-center shrink-0">
            <Image
              src="/sit.png"
              alt="Suvidya Institute of Technology"
              width={666}
              height={375}
              className="block h-12 sm:h-16 w-auto"
              priority
            />
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <a href="mailto:enquiry@suvidya.ac.in" className="inline-flex items-center gap-1.5 text-white/90 text-xs font-semibold hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              enquiry@suvidya.ac.in
            </a>
            <a href="tel:+912226682290" className="inline-flex items-center gap-1.5 text-white/90 text-xs font-semibold hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.687.845a11.037 11.037 0 006.105 6.105l.845-1.687a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              (022) 2668 2290
            </a>
          </div>
          <a href="tel:+912226682290" className="sm:hidden inline-flex items-center gap-1.5 text-white/90 text-xs font-semibold hover:text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.687.845a11.037 11.037 0 006.105 6.105l.845-1.687a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call
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
              Industry-Ready Training for Your Engineering Career
            </h1>
            <p className="mt-4 text-white/85 text-sm sm:text-base max-w-lg text-pretty">
              Industry-focused training in Piping, HVAC, Structural, Rotating Equipment, Engineering Design
              &amp; Drafting and Software programmes at Suvidya Institute of Technology, Mumbai.
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
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                      <FieldIcon d={FORM_ICONS.name} />
                      <input
                        type="text" placeholder="Full Name *" value={form.Student_Name}
                        onChange={(e) => set('Student_Name', e.target.value)}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                      <FieldIcon d={FORM_ICONS.phone} />
                      <input
                        type="tel" placeholder="Mobile Number *" value={form.Present_Mobile}
                        onChange={(e) => set('Present_Mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                      <FieldIcon d={FORM_ICONS.city} />
                      <input
                        type="text" placeholder="City" value={form.City}
                        onChange={(e) => set('City', e.target.value)}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                    <FieldIcon d={FORM_ICONS.email} />
                    <input
                      type="email" placeholder="Email Address *" value={form.Email}
                      onChange={(e) => set('Email', e.target.value)}
                      className="w-full bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                    <FieldIcon d={FORM_ICONS.course} />
                    <select
                      value={form.Course_Id} onChange={(e) => set('Course_Id', e.target.value)}
                      className="w-full bg-transparent text-sm focus:outline-none"
                    >
                      <option value="">Course Interested In</option>
                      {courses.map((c) => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                      <FieldIcon d={FORM_ICONS.qualification} />
                      <select
                        value={form.Qualification} onChange={(e) => set('Qualification', e.target.value)}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      >
                        <option value="">Qualification *</option>
                        {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                      <FieldIcon d={FORM_ICONS.discipline} />
                      <input
                        type="text" placeholder="Discipline *" value={form.Discipline}
                        onChange={(e) => set('Discipline', e.target.value)}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2 py-2.5 focus-within:ring-2 focus-within:ring-[#2A6BB5]/20 focus-within:border-[#2A6BB5]">
                      <FieldIcon d={FORM_ICONS.percentage} />
                      <input
                        type="number" placeholder="% / CGPA *" value={form.Percentage}
                        onChange={(e) => set('Percentage', e.target.value)}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
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

      {/* Stats — animated */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
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

      {/* Training Programmes — image cards */}
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-extrabold text-gray-900 text-center">Our Training Programmes</h2>
          <p className="mt-2 text-center text-sm text-gray-500 max-w-2xl mx-auto">
            Training for learners at every career stage — covering the entire spectrum of technical engineering disciplines.
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {PROGRAMMES.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={scrollToForm}
                className="group rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-[#2A6BB5]/40 transition-all text-left"
              >
                <div className="relative h-36 w-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.img}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-xs font-semibold text-gray-800 leading-snug group-hover:text-[#2A6BB5] transition-colors line-clamp-2">
                    {p.name}
                  </p>
                  <p className="mt-1 text-[10px] text-[#2E3093] font-medium">Enquire Now →</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

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
      <footer className="bg-[#2E3093] text-white/80 text-center py-6 text-xs">
        <div className="flex items-center justify-center gap-5">
          <a href="mailto:enquiry@suvidya.ac.in" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            enquiry@suvidya.ac.in
          </a>
          <a href="tel:+912226682290" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.687.845a11.037 11.037 0 006.105 6.105l.845-1.687a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            (022) 2668 2290
          </a>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.</p>
      </footer>
    </div>
  );
}
