'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ADS_CONVERSION_ID, ADS_CONVERSION_LABEL } from './tracking-config';

interface Course { Course_Id: number; Course_Name: string }

// ─── Logo palette: navy #1B2A6B · gold #F5C518 · white ─────────────────────
const NAV   = '#1B2A6B';
const GOLD  = '#F5C518';

const QUALIFICATIONS = ['10th', '12th', 'Diploma', 'Graduate', 'Post Graduate', 'Other'];

const STATS = [
  { value: 18000, suffix: '+', label: 'Students Trained'    },
  { value: 650,   suffix: '+', label: 'Successful Batches'  },
  { value: 250,   suffix: '+', label: 'Corporate Training'  },
  { value: 40,    suffix: '+', label: 'Professional Training' },
];

const BASE = 'https://suvidya.ac.in/inquire-now/images/';
const PROGRAMMES = [
  { name: 'Piping Engineering',                      img: `${BASE}piping-engineering.jpg`,           desc: 'Structured to raise expertise in piping design and improve competitiveness in global markets.' },
  { name: 'Mechanical Design of Process Equipment',  img: `${BASE}mechanical-design.png`,            desc: 'Unique course discussing process equipment design in a single comprehensive programme.' },
  { name: 'Process Engineering',                     img: `${BASE}process-engineering.png`,          desc: 'Covers design of processes for desired physical and/or chemical transformation of materials.' },
  { name: 'Advance Pipe Stress Analysis',            img: `${BASE}advance-pipe-stress.jpg`,          desc: 'Fundamentals of Advance Pipe Stress Analysis with emphasis on piping systems.' },
  { name: 'Water & Waste Water Engineering',         img: `${BASE}water-waste_water-engineering.jpg`, desc: 'Design, construction, commissioning and troubleshooting of water and effluent treatment plants.' },
  { name: 'Process Instrumentation and Control',     img: `${BASE}process-instrumentation-control.png`, desc: 'Automation in process industries — Refinery, Chemical, Oil & Gas, Food Processing and more.' },
  { name: 'Air Conditioning System Design',          img: `${BASE}air-conditioning.png`,             desc: 'Critical HVAC component design to achieve efficient and effective environmental control.' },
  { name: 'Structural Engineering',                  img: `${BASE}structural-engineering.png`,       desc: 'In-depth understanding of structural behavior forming the basis for building structure design.' },
  { name: 'Electrical System Designing',             img: `${BASE}electrical-system-design.jpg`,     desc: 'Study and application of Electrical Power Systems, Machines and Control systems.' },
  { name: 'MEP (Mechanical, Electrical, Plumbing)',  img: `${BASE}MEP-engineering.png`,              desc: 'Electrical design details with various equipment used in MEP construction projects.' },
  { name: 'Rotating Equipment',                      img: `${BASE}rotating-equipment.png`,           desc: 'Training on pumps, compressors, turbines and rotating machinery used in process plants.' },
  { name: 'HSE in Construction',                     img: `${BASE}hse-in-construction.jpg`,          desc: 'Risk assessment and safe practices in Health, Safety and Environment for construction.' },
  { name: 'Piping Design and Drafting',              img: `${BASE}piping-design-drafting.jpg`,       desc: 'Intermediate piping drafting covering designing and drafting principles and techniques.' },
  { name: 'Engineering Design & Drafting',           img: `${BASE}engineering-design-drafting.jpg`,  desc: 'Production processes and materials using high-functioning math and advanced critical thinking.' },
  { name: 'HAVC Design and Drafting',                img: `${BASE}HVAC-design-drafting.jpg`,         desc: 'HVAC design knowledge built on level one course with advanced problem-solving skills.' },
  { name: 'Civil and Structural Drafting',           img: `${BASE}civil-structural-engineering.jpg`, desc: 'Civil and structural drawing standards, detailing and documentation for construction.' },
  { name: 'Solar PV Power System with Renewable Energy', img: `${BASE}solar.jpg`,                  desc: 'Design, installation and commissioning of solar PV systems integrated with renewable energy.' },
  { name: 'PDMS (Plant Design Management System)',   img: `${BASE}PDMS.jpg`,                        desc: 'Hands-on 3D plant design covering equipment, piping and engineering deliverables in PDMS.' },
  { name: 'Offshore Engineering',                    img: `${BASE}Offshore-Engineering.jpg`,        desc: 'Offshore design engineering for Oil and Gas construction and maintenance services.' },
  { name: 'Process Equipment Fabrication Engineering', img: `${BASE}equipment-fabrication.jpg`,    desc: 'Fabrication of Vessels, Heat Exchangers, Distillation Columns and Tanks.' },
  { name: 'Fundamentals Of Offshore',               img: `${BASE}Offshore-Engineering.jpg`,        desc: 'Introductory course covering offshore platforms, structures and operational processes.' },
  { name: 'Fire Alarm and Protection System',        img: `${BASE}Fire-Alarm.jpg`,                  desc: 'Design, installation and maintenance of fire alarm and suppression systems to industry standards.' },
  { name: 'E3D',                                     img: `${BASE}E3D.jpg`,                         desc: 'AVEVA E3D combines latest 3D graphics and user interface with state-of-the-art data management.' },
  { name: 'PV Elite',                                img: `${BASE}PV-Elite.jpg`,                    desc: 'Complete solution for design, evaluation and re-rating of pressure vessels including FFS analysis.' },
];

const TESTIMONIALS = [
  { name: 'Vishwadip Giridhar Yewale',     batch: 'Batch No.03053 · Process Engineering',     img: `${BASE}vishwadip.jpg`, text: 'This training was very useful to me. It made me understand various concepts easily. Faculties and staff are very co-operative.' },
  { name: 'Tabrej Ebrahim Lanjekar',       batch: 'Batch No.03053 · Process Engineering',     img: `${BASE}Tabrej.jpg`,   text: 'Training content was made easy to understand. The supportive nature of sir has helped me gain confidence. I got my concepts and basics cleared.' },
  { name: 'Sonal Nitin Barad',             batch: 'Batch No.03053 · Process Engineering',     img: `${BASE}sonal.jpg`,    text: 'Training contents are well organised. I have gained a lot of knowledge about process design field. Faculty have depth knowledge.' },
  { name: 'Mayur Ajit Patravale',          batch: 'Batch No.03053 · Process Engineering',     img: `${BASE}mayur.jpg`,    text: 'This Training Program bridges the gap between academic & industrial knowledge. Highly experienced faculty. It has changed my perspective towards industries.' },
  { name: 'Tilesh Sudhakar Patil',         batch: 'Batch No.09043 · Electrical System Design', img: `${BASE}tilesh.jpg`,  text: 'SIT has changed me a lot. Contents are very useful as per industry. Training gives real industrial exposure. I thank all trainers and staff.' },
  { name: 'Shukla Ambkeshwar Brijmohan',   batch: 'Batch No.09043 · Electrical System Design', img: `${BASE}shukla.jpg`,  text: 'The faculty has good knowledge of the Electrical industry. The supportive nature of sir has helped me gain confidence.' },
];

const FORM_ICONS: Record<string, string> = {
  name:          'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  phone:         'M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-1.687.845a11.037 11.037 0 006.105 6.105l.845-1.687a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  city:          'M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  email:         'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  course:        'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  qualification: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14z',
  discipline:    'M9.75 17L15.75 7m0 0h-4.5m4.5 0v4.5M6 21h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z',
  percentage:    'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z',
};

function FieldIcon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
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

function useCountUp(target: number, duration = 2200) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let t0: number | null = null;
    const step = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);

  return { count, ref };
}

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(value);
  return (
    <div ref={ref} className="flex flex-col items-center px-6 py-8">
      <span className="text-3xl font-black tabular-nums sm:text-4xl" style={{ color: NAV }}>
        {count.toLocaleString()}{suffix}
      </span>
      <span className="mt-1 h-0.5 w-8 rounded-full" style={{ background: GOLD }} />
      <span className="mt-2 text-center text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

export default function ApplyLandingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    Student_Name: '', Present_Mobile: '',
    Course_Id: '', Qualification: '', Discipline: '', City: '',
  });

  useEffect(() => {
    fetch('/api/public/courses').then(r => r.json()).then(d => { if (d.success) setCourses(d.courses || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!courses.length) return;
    const cp = new URLSearchParams(window.location.search).get('course');
    if (cp && courses.some(c => String(c.Course_Id) === cp))
      setForm(prev => prev.Course_Id ? prev : { ...prev, Course_Id: cp });
  }, [courses]);

  const set = (f: keyof typeof form, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.Student_Name.trim()) return setError('Please enter your full name.');
    if (!/^[0-9]{10}$/.test(form.Present_Mobile.trim())) return setError('Please enter a valid 10-digit mobile number.');
    if (!form.Qualification) return setError('Please select your highest qualification.');
    if (!form.Discipline.trim()) return setError('Please enter your discipline / stream.');
    setSubmitting(true);
    try {
      const utm = readUtmContext();
      const notes = ['Source: Google Ads Landing Page (/apply)', ...(form.City.trim() ? [`City: ${form.City.trim()}`] : []), ...(utm ? [utm] : [])].join(' | ');
      const res = await fetch('/api/public/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Student_Name: form.Student_Name.trim(), Present_Mobile: form.Present_Mobile.trim(),
          Course_Id: form.Course_Id ? Number(form.Course_Id) : undefined,
          Qualification: form.Qualification, Discipline: form.Discipline.trim(),
          Discussion: notes,
          Inquiry_From: 'Google Ads Landing Page', Inquiry_Type: 'Google Ads Leads',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong.');
      setSubmitted(true);
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      if (typeof w.gtag === 'function' && !ADS_CONVERSION_ID.includes('XXXXXXXXX'))
        w.gtag('event', 'conversion', { send_to: `${ADS_CONVERSION_ID}/${ADS_CONVERSION_LABEL}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => document.getElementById('enquiry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const fieldCls = 'flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 transition-all focus-within:border-[#1B2A6B] focus-within:ring-2 focus-within:ring-[#1B2A6B]/10';
  const inputCls = 'w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none';
  const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-400';

  return (
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Image src="/sit.png" alt="Suvidya Institute of Technology" width={200} height={112} className="h-10 w-auto sm:h-12" priority />
          <div className="hidden items-center gap-6 sm:flex">
            <a href="mailto:enquiry@suvidya.ac.in" className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
              enquiry@suvidya.ac.in
            </a>
            <a href="tel:+919821569885" className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors">
              +91 98215 69885
            </a>
          </div>
          <button onClick={scrollToForm} className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90" style={{ background: NAV }}>
            Enquire Now
          </button>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{ background: NAV }}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">

          {/* Copy */}
          <div>
            <span className="mb-5 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ background: `${GOLD}22`, color: GOLD }}>
              25+ Years Training Engineers
            </span>
            <h1 className="text-3xl font-black leading-snug text-white sm:text-4xl lg:text-5xl">
              Suvidya Institute<br />
              <span style={{ color: GOLD }}>World Class</span><br />
              Industrial Training
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">
              Industry-aligned programmes in Piping, Process, Mechanical, Electrical, HVAC, Structural &amp; more — for freshers and working professionals across India.
            </p>
            <button onClick={scrollToForm} className="mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-90" style={{ background: GOLD, color: NAV }}>
              Enquire today for your desired program
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </div>

          {/* Form */}
          <div id="enquiry-form" className="scroll-mt-20 rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            {submitted ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${GOLD}22`, color: GOLD }}>
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-bold" style={{ color: NAV }}>Thank you!</h3>
                <p className="mt-2 text-sm text-slate-500">Our admissions team will call you shortly.</p>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold" style={{ color: NAV }}>Enquire today for your desired program!</h2>
                <p className="mt-0.5 mb-5 text-xs text-slate-400">All fields are required.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className={fieldCls}>
                    <FieldIcon d={FORM_ICONS.name} />
                    <input className={inputCls} placeholder="Full Name *" value={form.Student_Name} onChange={e => set('Student_Name', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={fieldCls}>
                      <FieldIcon d={FORM_ICONS.phone} />
                      <input className={inputCls} type="tel" placeholder="Mobile *" value={form.Present_Mobile} onChange={e => set('Present_Mobile', e.target.value.replace(/\D/g,'').slice(0,10))} />
                    </div>
                    <div className={fieldCls}>
                      <FieldIcon d={FORM_ICONS.city} />
                      <input className={inputCls} placeholder="City" value={form.City} onChange={e => set('City', e.target.value)} />
                    </div>
                  </div>
                  <div className={fieldCls}>
                    <FieldIcon d={FORM_ICONS.course} />
                    <select className={inputCls} value={form.Course_Id} onChange={e => set('Course_Id', e.target.value)}>
                      <option value="">Select Course *</option>
                      {courses.map(c => <option key={c.Course_Id} value={c.Course_Id}>{c.Course_Name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={fieldCls}>
                      <FieldIcon d={FORM_ICONS.qualification} />
                      <select className={inputCls} value={form.Qualification} onChange={e => set('Qualification', e.target.value)}>
                        <option value="">Qualification *</option>
                        {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <div className={fieldCls}>
                      <FieldIcon d={FORM_ICONS.discipline} />
                      <input className={inputCls} placeholder="Discipline *" value={form.Discipline} onChange={e => set('Discipline', e.target.value)} />
                    </div>
                  </div>
                  {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>}
                  <button type="submit" disabled={submitting} className="mt-1 w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: NAV }}>
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                  <p className="text-center text-[10px] text-slate-400">By submitting you agree to be contacted by SIT regarding admissions.</p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 lg:grid-cols-4 lg:divide-y-0">
            {STATS.map(s => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── PROGRAMMES ─────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>What We Offer</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-wide sm:text-3xl" style={{ color: NAV }}>
              Training Programme for Learners<br className="hidden sm:block" /> at Every Career Stage
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-500">
              Our programs cover the entire spectrum of technical training in all engineering disciplines to meet the requirements of skilled manpower in the field of &ldquo;Oil &amp; Gas&rdquo;, Petrochemical &amp; various Process Chemical Plant industries.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {PROGRAMMES.map(p => (
              <button key={p.name} type="button" onClick={scrollToForm}
                className="group overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-[#1B2A6B]/20">
                <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.img} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                </div>
                <div className="p-3">
                  <p className="text-[11px] font-bold leading-snug text-slate-800 transition-colors group-hover:text-[#1B2A6B]">{p.name}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{p.desc}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: NAV }}>Enquire Now →</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY SIT ────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Why Choose Us</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-wide sm:text-3xl" style={{ color: NAV }}>Why Train With SIT</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Industry-Relevant Curriculum',  body: 'Hands-on training on the same tools and workflows used on live engineering projects.' },
              { title: 'Career Support',                body: 'Guidance and industry connections to help you move from training into the job market.' },
              { title: 'Experienced Faculty',           body: 'Learn from trainers with real design-office and industry experience, not just theory.' },
              { title: 'Flexible Payment Plans',        body: 'Full payment, instalment plans, or a 0% interest loan option — pick what works for you.' },
            ].map((b, i) => (
              <div key={b.title} className="rounded-xl border border-slate-100 p-6 transition-shadow hover:shadow-md">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: i === 0 ? NAV : `${NAV}cc` }}>
                  {i + 1}
                </div>
                <h3 className="text-sm font-bold text-slate-800">{b.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Student Stories</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-wide sm:text-3xl" style={{ color: NAV }}>Testimonials</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.img} alt={t.name} className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-offset-1 ring-yellow-300" loading="lazy" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{t.name}</p>
                    <p className="text-[10px] text-slate-400">{t.batch}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-slate-500 italic">&ldquo;{t.text}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ─────────────────────────────────────────────────────── */}
      <section className="py-16 text-center">
        <p className="text-sm text-slate-400">Still have questions?</p>
        <p className="mt-1 text-lg font-bold text-slate-700">Talk to our admissions team.</p>
        <button onClick={scrollToForm} className="mt-5 inline-flex items-center gap-2 rounded-lg px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90" style={{ background: NAV }}>
          Enquire Now
        </button>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ background: NAV }} className="px-4 py-8 text-center">
        <div className="mx-auto mb-4 inline-block rounded-lg bg-white px-3 py-1.5">
          <Image src="/sit.png" alt="SIT" width={120} height={68} className="h-10 w-auto" />
        </div>
        <div className="flex items-center justify-center gap-6 text-xs text-white/60">
          <a href="mailto:enquiry@suvidya.ac.in" className="hover:text-white transition-colors">enquiry@suvidya.ac.in</a>
          <a href="tel:+919821569885" className="hover:text-white transition-colors">+91 98215 69885</a>
        </div>
        <p className="mt-3 text-[11px] text-white/40">© {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.</p>
      </footer>

      {/* ── STICKY MOBILE BAR ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex sm:hidden border-t border-white/10 shadow-2xl">
        <a href="tel:+919821569885" className="flex flex-1 items-center justify-center py-4 text-xs font-black uppercase tracking-wider" style={{ background: GOLD, color: NAV }}>
          <svg className="mr-1.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
          Call Now
        </a>
        <div className="flex w-12 items-center justify-center bg-white">
          <span className="text-[10px] font-black text-slate-400">OR</span>
        </div>
        <button onClick={scrollToForm} className="flex flex-1 items-center justify-center py-4 text-xs font-black uppercase tracking-wider text-white" style={{ background: NAV }}>
          <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Enquire Now
        </button>
      </div>
      <div className="h-16 sm:hidden" />
    </div>
  );
}
